import { afterEach, describe, expect, it } from 'vitest';
import { rotateServerEpoch } from '../../src/sync/epoch';
import { SYNC_HOOKS } from '../../src/sync/hooks';
import {
  createSyncTestContext,
  createUserAndLogin,
  makeOp,
  seqIds,
  syncPush,
  type TestContext,
} from '../support';

// Review Focus 2 (serveur, R-SYN-27) : les trois branches de restore_upsert après une nouvelle époque.
type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
type Row = Record<string, unknown>;

const rowIds = seqIds(8000);
const newId = () => rowIds.uuidv7();

let ctx: TestContext;
afterEach(() => ctx?.close());

async function setup(opts: Parameters<typeof createSyncTestContext>[0] = {}): Promise<Member> {
  ctx = await createSyncTestContext(opts);
  return createUserAndLogin(ctx);
}

const rowOf = (table: string, id: string) =>
  ctx.deps.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined;

const ru = (
  u: { id: string },
  id: string,
  fields: Record<string, unknown>,
  serverRevSeen: number | null = null,
  entity = 'fixture_note',
) => makeOp({ userId: u.id, entity, id, kind: 'restore_upsert', fields, serverRevSeen });

/** Note créée avant la restauration puis époque tournée : rev r1 ≤ epoch_base_rev. */
async function restoredNote(u: Member): Promise<{ id: string; r1: number; baseRev: number }> {
  const id = newId();
  const created = await syncPush(ctx, u.cookie, [
    makeOp({ userId: u.id, entity: 'fixture_note', id, kind: 'create', fields: { title: 'sauvegarde' } }),
  ]);
  const r1 = created.body.results[0].rev as number;
  const { baseRev } = await rotateServerEpoch(ctx.deps.db, ctx.deps);
  return { id, r1, baseRev };
}

describe('restore_upsert : trois branches (R-SYN-27)', () => {
  it('ligne absente → insérée, tombstone comprise', async () => {
    const a = await setup();
    const live = newId();
    const dead = newId();
    const res = await syncPush(ctx, a.cookie, [
      ru(a, live, { title: 'vivante', body: 'b' }),
      ru(a, dead, { title: 'morte', deletedAt: '2026-09-01T00:00:00.000Z' }),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.results.map((r: Row) => r.status)).toEqual(['applied', 'applied']);
    expect(rowOf('fixture_note', live)).toMatchObject({
      owner_id: a.id,
      title: 'vivante',
      body: 'b',
      deleted_at: null,
      rev: res.body.results[0].rev,
    });
    expect(rowOf('fixture_note', dead)).toMatchObject({
      title: 'morte',
      deleted_at: '2026-09-01T00:00:00.000Z',
      rev: res.body.results[1].rev,
    });
  });

  it('rev ≤ epoch_base_rev et serverRevSeen > rev → remplacée par la version client', async () => {
    const a = await setup();
    const { id, r1, baseRev } = await restoredNote(a);
    expect(r1).toBeLessThanOrEqual(baseRev);
    const res = await syncPush(ctx, a.cookie, [ru(a, id, { title: 'client', body: 'x' }, r1 + 1)]);
    const result = res.body.results[0];
    expect(result).toEqual({ opId: expect.any(String), status: 'applied', rev: expect.any(Number) });
    expect(result.rev).toBeGreaterThan(baseRev);
    expect(rowOf('fixture_note', id)).toMatchObject({ title: 'client', body: 'x', rev: result.rev });
  });

  it('rev ≤ epoch_base_rev et serverRevSeen ≤ rev ou null → laissée (sauvegarde)', async () => {
    const a = await setup();
    const { id, r1 } = await restoredNote(a);
    const res = await syncPush(ctx, a.cookie, [
      ru(a, id, { title: 'client' }, r1),
      ru(a, id, { title: 'client' }, null),
    ]);
    for (const r of res.body.results)
      expect(r).toEqual({ opId: expect.any(String), status: 'applied', rev: r1 });
    expect(rowOf('fixture_note', id)).toMatchObject({ title: 'sauvegarde', rev: r1 });
  });

  it('modifiée après la restauration → laissée ; la suppression du client l’emporte', async () => {
    const a = await setup();
    const { id } = await restoredNote(a);
    const patched = await syncPush(ctx, a.cookie, [
      makeOp({
        userId: a.id,
        entity: 'fixture_note',
        id,
        kind: 'patch',
        fields: { title: 'apres-restauration' },
      }),
    ]);
    const rp = patched.body.results[0].rev as number;

    const r = await syncPush(ctx, a.cookie, [ru(a, id, { title: 'client' }, 1_000_000)]);
    expect(r.body.results[0]).toEqual({ opId: expect.any(String), status: 'applied', rev: rp });
    expect(rowOf('fixture_note', id)).toMatchObject({
      title: 'apres-restauration',
      rev: rp,
      deleted_at: null,
    });

    const del = await syncPush(ctx, a.cookie, [
      ru(a, id, { title: 'client', deletedAt: '2026-10-01T08:00:00.000Z' }, null),
    ]);
    const delRev = del.body.results[0].rev as number;
    expect(del.body.results[0].status).toBe('applied');
    expect(delRev).toBeGreaterThan(rp);
    expect(rowOf('fixture_note', id)).toMatchObject({
      title: 'apres-restauration',
      deleted_at: '2026-10-01T08:00:00.000Z',
      rev: delRev,
    });
  });

  it('tombstone gardée : un restore_upsert sans deletedAt ne la ressuscite pas', async () => {
    const a = await setup();
    const { id } = await restoredNote(a);
    const deleted = await syncPush(ctx, a.cookie, [
      makeOp({ userId: a.id, entity: 'fixture_note', id, kind: 'delete' }),
    ]);
    const rd = deleted.body.results[0].rev as number;
    const r = await syncPush(ctx, a.cookie, [ru(a, id, { title: 'client' }, 1_000_000)]);
    expect(r.body.results[0]).toEqual({ opId: expect.any(String), status: 'applied', rev: rd });
    expect(rowOf('fixture_note', id)?.deleted_at).not.toBeNull();
  });

  it('deletedAt invalide → validation', async () => {
    const a = await setup();
    const res = await syncPush(ctx, a.cookie, [ru(a, newId(), { title: 't', deletedAt: 'hier' })]);
    expect(res.body.results[0]).toMatchObject({ status: 'rejected', code: 'validation' });
  });

  it('deletedAt ramené dans [now − 60 j, now] (horloge du client fausse)', async () => {
    const a = await setup();
    const future = newId();
    const past = newId();
    const res = await syncPush(ctx, a.cookie, [
      ru(a, future, { title: 'f', deletedAt: '2099-01-01T00:00:00.000Z' }),
      ru(a, past, { title: 'p', deletedAt: '1970-01-01T00:00:00.000Z' }),
    ]);
    expect(res.body.results.map((r: Row) => r.status)).toEqual(['applied', 'applied']);
    expect(rowOf('fixture_note', future)?.deleted_at).toBe('2026-10-06T10:00:00.000Z');
    expect(rowOf('fixture_note', past)?.deleted_at).toBe('2026-08-07T10:00:00.000Z');
  });
});

describe('restore_upsert : garde-fous du push', () => {
  it('sur sync_rejection → forbidden', async () => {
    const a = await setup();
    const res = await syncPush(ctx, a.cookie, [
      ru(a, newId(), { dismissedAt: null }, null, 'sync_rejection'),
    ]);
    expect(res.body.results[0]).toMatchObject({ status: 'rejected', code: 'forbidden' });
  });

  it('table C2 sans consentement → applied_partial dropped, rien écrit', async () => {
    const a = await setup();
    const id = newId();
    const res = await syncPush(ctx, a.cookie, [ru(a, id, { value: 3 }, null, 'fixture_c2_log')]);
    expect(res.body.results[0]).toEqual({
      opId: expect.any(String),
      status: 'applied_partial',
      dropped: true,
    });
    expect(rowOf('fixture_c2_log', id)).toBeUndefined();
  });

  it('table C2 sans consentement : un restore_upsert portant deletedAt pose la tombstone, sans contenu', async () => {
    const a = await setup();
    const absent = newId();
    const live = newId();
    ctx.deps.sqlite
      .prepare(
        'INSERT INTO fixture_c2_log (id, owner_id, rev, created_at, updated_at, updated_by, deleted_at, value) VALUES (?, ?, 1, ?, ?, ?, NULL, 7)',
      )
      .run(live, a.id, '2026-10-06T10:00:00.000Z', '2026-10-06T10:00:00.000Z', a.id);
    const deletedAt = '2026-10-01T08:00:00.000Z';
    const res = await syncPush(ctx, a.cookie, [
      ru(a, absent, { value: 3, deletedAt }, null, 'fixture_c2_log'),
      ru(a, live, { value: 3, deletedAt }, null, 'fixture_c2_log'),
    ]);
    for (const r of res.body.results) {
      expect(r).toEqual({ opId: expect.any(String), status: 'applied', rev: expect.any(Number) });
    }
    expect(rowOf('fixture_c2_log', absent)).toMatchObject({ deleted_at: deletedAt, value: null });
    expect(rowOf('fixture_c2_log', live)).toMatchObject({ deleted_at: deletedAt, value: 7 });
  });

  it("ligne d'un autre → forbidden, ligne intacte", async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx, { username: 'bob' });
    const { id, r1 } = await restoredNote(a);
    const res = await syncPush(ctx, b.cookie, [ru(b, id, { title: 'vol' }, r1 + 1)]);
    expect(res.body.results[0]).toMatchObject({ status: 'rejected', code: 'forbidden' });
    expect(rowOf('fixture_note', id)).toMatchObject({ owner_id: a.id, title: 'sauvegarde' });
  });

  it('beforeApply puis afterApply seulement si la ligne est écrite', async () => {
    const calls: string[] = [];
    const a = await setup({
      deps: {
        syncHooks: {
          ...SYNC_HOOKS,
          fixture_note: {
            beforeApply: async (_c, fields) => {
              calls.push(`before:${String(fields.title)}`);
            },
            afterApply: async () => {
              calls.push('after');
            },
          },
        },
      },
    });
    const id = newId();
    await syncPush(ctx, a.cookie, [ru(a, id, { title: 'un' })]);
    await syncPush(ctx, a.cookie, [ru(a, id, { title: 'deux' })]);
    expect(calls).toEqual(['before:un', 'after', 'before:deux']);
  });
});
