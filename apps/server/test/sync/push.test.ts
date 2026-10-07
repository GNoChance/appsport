import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../src/logger';
import { type BatchCtx, type EntitySyncHooks, SYNC_HOOKS, type SyncHooksMap } from '../../src/sync/hooks';
import { OpRejection } from '../../src/sync/push';
import {
  createSyncTestContext,
  createUserAndLogin,
  dumpDatabase,
  makeOp,
  seqIds,
  syncPush,
  type TestContext,
} from '../support';

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
type Row = Record<string, unknown>;

const NOW = '2026-10-06T10:00:00.000Z';
const rowIds = seqIds(8000);
const newId = () => rowIds.uuidv7();

let ctx: TestContext;
afterEach(() => ctx?.close());

async function setup(opts: Parameters<typeof createSyncTestContext>[0] = {}): Promise<Member> {
  ctx = await createSyncTestContext(opts);
  return createUserAndLogin(ctx);
}

const note = (u: { id: string }, fields: Record<string, unknown> = { title: 'n' }, id = newId()) =>
  makeOp({ userId: u.id, entity: 'fixture_note', id, kind: 'create', fields });

const rowOf = (table: string, id: string) =>
  ctx.deps.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined;
const rowsOf = (table: string) => ctx.deps.sqlite.prepare(`SELECT * FROM ${table}`).all() as Row[];
const appliedOp = (opId: string) =>
  ctx.deps.sqlite.prepare('SELECT * FROM applied_op WHERE op_id = ?').get(opId) as Row | undefined;

describe('POST /api/sync/push : lot et idempotence', () => {
  it('exige une session', async () => {
    ctx = await createSyncTestContext();
    const res = await syncPush(ctx, '', []);
    expect(res.status).toBe(401);
  });

  it('201 ops → 400 validation ; 200 ops → toutes appliquées', async () => {
    const a = await setup();
    const tooMany = await syncPush(
      ctx,
      a.cookie,
      Array.from({ length: 201 }, () => note(a)),
    );
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toBe('validation');

    const ops = Array.from({ length: 200 }, () => note(a));
    const res = await syncPush(ctx, a.cookie, ops);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(200);
    expect(res.body.results.every((r: Row) => r.status === 'applied')).toBe(true);
    expect(rowsOf('fixture_note')).toHaveLength(200);
  });

  it('un opId déjà vu renvoie duplicate avec le rev du premier, une seule ligne applied_op', async () => {
    const a = await setup();
    const op = note(a);
    const first = await syncPush(ctx, a.cookie, [op]);
    const again = await syncPush(ctx, a.cookie, [op]);
    expect(again.body.results).toEqual([
      { opId: op.opId, status: 'duplicate', originalStatus: 'applied', rev: first.body.results[0].rev },
    ]);
    expect(
      ctx.deps.sqlite.prepare('SELECT count(*) AS n FROM applied_op WHERE op_id = ?').get(op.opId),
    ).toEqual({ n: 1 });
  });

  it('le même opId deux fois dans un lot : le second est duplicate', async () => {
    const a = await setup();
    const op = note(a);
    const res = await syncPush(ctx, a.cookie, [op, op]);
    const [first, second] = res.body.results;
    expect(first.status).toBe('applied');
    expect(second).toEqual({ opId: op.opId, status: 'duplicate', originalStatus: 'applied', rev: first.rev });
    expect(rowsOf('fixture_note')).toHaveLength(1);
  });

  it("le rejeu d'une op rejetée renvoie duplicate avec le statut et le code d'origine", async () => {
    const a = await setup();
    const op = note(a, { title: '' });
    const first = await syncPush(ctx, a.cookie, [op]);
    expect(first.body.results[0]).toMatchObject({ status: 'rejected', code: 'validation' });
    const again = await syncPush(ctx, a.cookie, [op]);
    expect(again.body.results).toEqual([
      { opId: op.opId, status: 'duplicate', originalStatus: 'rejected', code: 'validation' },
    ]);
    expect(rowsOf('sync_rejection')).toHaveLength(1);
  });

  it("l'opId d'un autre utilisateur est refusé forbidden sans écriture", async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const op = note(a);
    await syncPush(ctx, a.cookie, [op]);
    const res = await syncPush(ctx, b.cookie, [{ ...op, userId: b.id }]);
    expect(res.body.results).toEqual([{ opId: op.opId, status: 'rejected', code: 'forbidden' }]);
    expect(rowsOf('sync_rejection')).toHaveLength(0);
  });

  it('applied_op porte user, entité, ligne, statut et rev attribué', async () => {
    const a = await setup();
    const op = note(a);
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(appliedOp(op.opId)).toMatchObject({
      user_id: a.id,
      entity: 'fixture_note',
      row_id: op.id,
      status: 'applied',
      assigned_rev: res.body.results[0].rev,
    });
  });
});

describe('POST /api/sync/push : rejets', () => {
  it("kind 'upsert' → rejected validation et ligne sync_rejection", async () => {
    const a = await setup();
    const op = { ...note(a), kind: 'upsert' };
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(res.body.results).toEqual([{ opId: op.opId, status: 'rejected', code: 'validation' }]);
    const [rejection] = rowsOf('sync_rejection');
    expect(rejection).toMatchObject({
      owner_id: a.id,
      op_id: op.opId,
      entity: 'fixture_note',
      row_id: op.id,
      code: 'validation',
      dismissed_at: null,
    });
    expect(rejection?.rev as number).toBeGreaterThan(0);
    expect(appliedOp(op.opId)).toMatchObject({ status: 'rejected' });
  });

  it('table non J ou inconnue → unknown_entity ; kind hors allowedKinds → forbidden', async () => {
    const a = await setup();
    const ops = [
      makeOp({
        userId: a.id,
        entity: 'training_profile',
        id: a.id,
        kind: 'patch',
        fields: { goal: 'muscle' },
      }),
      makeOp({ userId: a.id, entity: 'nope', id: newId(), kind: 'create' }),
      makeOp({ userId: a.id, entity: 'sync_rejection', id: newId(), kind: 'create', fields: {} }),
    ];
    const res = await syncPush(ctx, a.cookie, ops);
    expect(res.body.results.map((r: Row) => r.code)).toEqual([
      'unknown_entity',
      'unknown_entity',
      'forbidden',
    ]);
    expect(rowsOf('sync_rejection')).toHaveLength(3);
  });

  it('userId différent de la session → forbidden sans sync_rejection ni applied_op', async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const op = note(b);
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(res.body.results).toEqual([{ opId: op.opId, status: 'rejected', code: 'forbidden' }]);
    expect(rowsOf('sync_rejection')).toHaveLength(0);
    expect(rowsOf('applied_op')).toHaveLength(0);
    expect(rowsOf('fixture_note')).toHaveLength(0);
  });

  it("create d'un id qui n'est pas un UUIDv7 minuscule → validation id_format", async () => {
    const a = await setup();
    const upper = newId().toUpperCase();
    const res = await syncPush(ctx, a.cookie, [
      note(a, { title: 'x' }, 'pas-un-uuid'),
      note(a, { title: 'y' }, upper),
    ]);
    expect(res.body.results.map((r: Row) => [r.status, r.code])).toEqual([
      ['rejected', 'validation'],
      ['rejected', 'validation'],
    ]);
    const reasons = rowsOf('sync_rejection').map((r) => JSON.parse(r.detail_json as string).reason);
    expect(reasons).toEqual(['id_format', 'id_format']);
    expect(rowsOf('fixture_note')).toHaveLength(0);
  });

  it('une op sans entity ni id entre deux notes est rejetée sans bloquer le lot', async () => {
    const a = await setup();
    const bare = {
      opId: makeOp({ userId: a.id, entity: 'x', id: 'x', kind: 'create' }).opId,
      kind: 'create',
    };
    const res = await syncPush(ctx, a.cookie, [note(a), bare, note(a)]);
    expect(res.body.results.map((r: Row) => r.status)).toEqual(['applied', 'rejected', 'applied']);
    expect(rowsOf('sync_rejection')).toEqual([
      expect.objectContaining({ op_id: bare.opId, entity: '', row_id: '', code: 'validation' }),
    ]);
  });

  it("patch de la ligne d'un autre → forbidden, ligne intacte", async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const theirs = note(b, { title: 'à b' });
    await syncPush(ctx, b.cookie, [theirs]);
    const res = await syncPush(ctx, a.cookie, [
      makeOp({
        userId: a.id,
        entity: 'fixture_note',
        id: theirs.id,
        kind: 'patch',
        fields: { title: 'volé' },
      }),
    ]);
    expect(res.body.results[0]).toMatchObject({ status: 'rejected', code: 'forbidden' });
    expect(rowOf('fixture_note', theirs.id)).toMatchObject({ owner_id: b.id, title: 'à b' });
    expect(JSON.parse(rowsOf('sync_rejection')[0]?.detail_json as string).reason).toBe('owner_mismatch');
  });

  it("patch d'une ligne absente → validation", async () => {
    const a = await setup();
    const res = await syncPush(ctx, a.cookie, [
      makeOp({ userId: a.id, entity: 'fixture_note', id: newId(), kind: 'patch', fields: { title: 't' } }),
    ]);
    expect(res.body.results.map((r: Row) => r.code)).toEqual(['validation']);
    const reasons = rowsOf('sync_rejection').map((r) => JSON.parse(r.detail_json as string).reason);
    expect(reasons).toEqual(['row_missing']);
  });

  it('une contrainte SQLite rejette une op sans annuler les autres (point de sauvegarde)', async () => {
    const a = await setup();
    const [n1, bad, n2] = [note(a), note(a, { title: '' }), note(a)];
    const res = await syncPush(ctx, a.cookie, [n1, bad, n2]);
    expect(res.body.results.map((r: Row) => r.status)).toEqual(['applied', 'rejected', 'applied']);
    expect(res.body.results[1].code).toBe('validation');
    expect(rowOf('fixture_note', bad.id)).toBeUndefined();
    expect(rowsOf('fixture_note')).toHaveLength(2);
    expect(JSON.parse(rowsOf('sync_rejection')[0]?.detail_json as string).reason).toBe('sql_constraint');
  });

  it("l'enfant d'un parent rejeté → parent_rejected, deux lignes sync_rejection", async () => {
    const a = await setup();
    const parent = note(a, { title: '' });
    const child = makeOp({
      userId: a.id,
      entity: 'fixture_note_item',
      id: newId(),
      kind: 'create',
      fields: { noteId: parent.id, label: 'l' },
    });
    const res = await syncPush(ctx, a.cookie, [parent, child]);
    expect(res.body.results.map((r: Row) => r.code)).toEqual(['validation', 'parent_rejected']);
    expect(rowsOf('sync_rejection')).toHaveLength(2);
    expect(rowsOf('fixture_note_item')).toHaveLength(0);
  });

  it("un parent absent ou d'un autre → parent_rejected", async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const theirs = note(b);
    await syncPush(ctx, b.cookie, [theirs]);
    const item = (noteId: unknown) =>
      makeOp({
        userId: a.id,
        entity: 'fixture_note_item',
        id: newId(),
        kind: 'create',
        fields: { noteId, label: 'l' },
      });
    const res = await syncPush(ctx, a.cookie, [item(newId()), item(theirs.id), item(undefined)]);
    expect(res.body.results.map((r: Row) => r.code)).toEqual([
      'parent_rejected',
      'parent_rejected',
      'parent_rejected',
    ]);
  });

  it("un patch qui rattache l'enfant au parent d'un autre → parent_rejected", async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const theirs = note(b);
    await syncPush(ctx, b.cookie, [theirs]);
    const mine = note(a);
    const item = makeOp({
      userId: a.id,
      entity: 'fixture_note_item',
      id: newId(),
      kind: 'create',
      fields: { noteId: mine.id, label: 'l' },
    });
    const move = makeOp({
      userId: a.id,
      entity: 'fixture_note_item',
      id: item.id,
      kind: 'patch',
      fields: { noteId: theirs.id },
    });
    const res = await syncPush(ctx, a.cookie, [mine, item, move]);
    expect(res.body.results.map((r: Row) => r.status)).toEqual(['applied', 'applied', 'rejected']);
    expect(res.body.results[2].code).toBe('parent_rejected');
    expect(rowOf('fixture_note_item', item.id)).toMatchObject({ note_id: mine.id });
  });

  it('detail_json ne garde que kind, noms de champs triés et raison, jamais de valeur', async () => {
    const lines: string[] = [];
    const u = await setup({ deps: { logger: createLogger((l) => lines.push(l)) } });
    const op = { ...note(u, { title: 'VALEUR-SECRETE', body: 'VALEUR-SECRETE' }), kind: 'upsert' };
    await syncPush(ctx, u.cookie, [op]);
    const detail = JSON.parse(rowsOf('sync_rejection')[0]?.detail_json as string);
    expect(Object.keys(detail).sort()).toEqual(['fieldNames', 'kind', 'reason']);
    expect(detail.fieldNames).toEqual(['body', 'title']);
    expect(dumpDatabase(ctx.deps.sqlite)).not.toContain('VALEUR-SECRETE');
    expect(lines.join('\n')).not.toContain('VALEUR-SECRETE');
    expect(lines.some((l) => JSON.parse(l).event === 'sync_rejected')).toBe(true);
    expect(lines.some((l) => JSON.parse(l).event === 'sync_push')).toBe(true);
  });

  it('protocole 99 → protocol', async () => {
    const a = await setup();
    const op = makeOp({
      userId: a.id,
      entity: 'fixture_note',
      id: newId(),
      kind: 'create',
      fields: { title: 'n' },
      protocol: 99,
    });
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(res.body.results[0]).toMatchObject({ status: 'rejected', code: 'protocol' });
  });

  it('patch dismissedAt sur son sync_rejection → applied', async () => {
    const a = await setup();
    await syncPush(ctx, a.cookie, [{ ...note(a), kind: 'upsert' }]);
    const rejection = rowsOf('sync_rejection')[0] as Row;
    const res = await syncPush(ctx, a.cookie, [
      makeOp({
        userId: a.id,
        entity: 'sync_rejection',
        id: rejection.id as string,
        kind: 'patch',
        fields: { dismissedAt: '2026-10-06T11:00:00.000Z', code: 'protocol' },
      }),
    ]);
    expect(res.body.results[0]).toMatchObject({ status: 'applied' });
    expect(rowOf('sync_rejection', rejection.id as string)).toMatchObject({
      dismissed_at: '2026-10-06T11:00:00.000Z',
      code: 'validation',
    });
  });
});

describe('POST /api/sync/push : application', () => {
  it('ownerId, rev, updatedBy et createdAt envoyés sont ignorés', async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const op = note(a, {
      title: 't',
      ownerId: b.id,
      rev: 999,
      updatedBy: b.id,
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(res.body.results[0].status).toBe('applied');
    expect(rowOf('fixture_note', op.id)).toMatchObject({
      owner_id: a.id,
      rev: res.body.results[0].rev,
      updated_by: a.id,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
      title: 't',
      body: null,
    });
  });

  it('un create répété sur le même id : les deux applied, même rev, premier contenu gardé', async () => {
    const a = await setup();
    const id = newId();
    const res = await syncPush(ctx, a.cookie, [
      note(a, { title: 'premier' }, id),
      note(a, { title: 'second' }, id),
    ]);
    const [r1, r2] = res.body.results;
    expect([r1.status, r2.status]).toEqual(['applied', 'applied']);
    expect(r2.rev).toBe(r1.rev);
    expect(rowOf('fixture_note', id)).toMatchObject({ title: 'premier' });
  });

  it('create puis deux patchs : revs croissants et champs fusionnés', async () => {
    const a = await setup();
    const c = note(a, { title: 't1', body: 'b1' });
    const patch = (fields: Row) =>
      makeOp({ userId: a.id, entity: 'fixture_note', id: c.id, kind: 'patch', fields });
    const res = await syncPush(ctx, a.cookie, [c, patch({ title: 't2' }), patch({ body: 'b3' })]);
    const revs = res.body.results.map((r: Row) => r.rev as number);
    expect(revs[0]).toBeLessThan(revs[1]);
    expect(revs[1]).toBeLessThan(revs[2]);
    expect(rowOf('fixture_note', c.id)).toMatchObject({ title: 't2', body: 'b3', rev: revs[2] });
  });

  it('create, delete puis patch : le patch est applied avec le rev du delete, tombstone gardé', async () => {
    const a = await setup();
    const c = note(a, { title: 'a' });
    const op = (kind: 'patch' | 'delete', fields: Row = {}) =>
      makeOp({ userId: a.id, entity: 'fixture_note', id: c.id, kind, fields });
    const res = await syncPush(ctx, a.cookie, [c, op('delete'), op('patch', { title: 'zombie' })]);
    const [, del, patch] = res.body.results;
    expect(del.status).toBe('applied');
    expect(patch).toEqual({ opId: expect.any(String), status: 'applied', rev: del.rev });
    expect(rowOf('fixture_note', c.id)).toMatchObject({ title: 'a', deleted_at: NOW, rev: del.rev });
    const again = await syncPush(ctx, a.cookie, [op('delete')]);
    expect(again.body.results[0]).toMatchObject({ status: 'applied', rev: del.rev });
  });

  it("delete d'une ligne absente → applied sans rev", async () => {
    const a = await setup();
    const op = makeOp({ userId: a.id, entity: 'fixture_note', id: newId(), kind: 'delete' });
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(res.body.results).toEqual([{ opId: op.opId, status: 'applied' }]);
    expect(appliedOp(op.opId)).toMatchObject({ status: 'applied', assigned_rev: null });
  });
});

describe('POST /api/sync/push : hooks de synchro', () => {
  const withHooks = (hooks: Record<string, EntitySyncHooks>): SyncHooksMap => ({ ...SYNC_HOOKS, ...hooks });

  it('une OpRejection levée par beforeApply rejette l’op', async () => {
    const beforeApply = vi.fn(async (_ctx: unknown, fields: Record<string, unknown>) => {
      if (fields.title === 'interdit') throw new OpRejection('validation', 'hook');
    });
    const a = await setup({ deps: { syncHooks: withHooks({ fixture_note: { beforeApply } }) } });
    const res = await syncPush(ctx, a.cookie, [
      note(a, { title: 'ok' }),
      note(a, { title: 'interdit', ownerId: 'x' }),
    ]);
    expect(res.body.results.map((r: Row) => r.status)).toEqual(['applied', 'rejected']);
    expect(beforeApply).toHaveBeenCalledTimes(2);
    expect(beforeApply.mock.calls[1]?.[1]).toEqual({ title: 'interdit' });
    expect(JSON.parse(rowsOf('sync_rejection')[0]?.detail_json as string).reason).toBe('hook');
  });

  it('afterBatch une fois par lot et par entité écrite, jamais sans écriture', async () => {
    const afterBatch = vi.fn(async (_b: BatchCtx) => {});
    const afterApply = vi.fn(async () => {});
    const a = await setup({
      deps: {
        syncHooks: withHooks({ fixture_note: { afterBatch, afterApply }, fixture_note_item: { afterBatch } }),
      },
    });
    const n1 = note(a);
    const n2 = note(a);
    await syncPush(ctx, a.cookie, [n1, n2, note(a, { title: '' })]);
    expect(afterBatch).toHaveBeenCalledTimes(1);
    expect(afterBatch.mock.calls[0]?.[0]).toMatchObject({
      userId: a.id,
      applied: [
        { entity: 'fixture_note', id: n1.id },
        { entity: 'fixture_note', id: n2.id },
      ],
    });
    expect(afterApply).toHaveBeenCalledTimes(2);

    afterBatch.mockClear();
    await syncPush(ctx, a.cookie, [n1, { ...note(a), kind: 'upsert' }]);
    expect(afterBatch).not.toHaveBeenCalled();
  });

  it('une erreur SQLite hors contrainte dans beforeApply → 500 et rien d’écrit', async () => {
    const beforeApply = vi.fn(async () => {
      throw Object.assign(new Error('disk I/O'), { code: 'ERR_SQLITE_ERROR', errcode: 13 });
    });
    const a = await setup({ deps: { syncHooks: withHooks({ fixture_note_item: { beforeApply } }) } });
    const parent = note(a);
    const child = makeOp({
      userId: a.id,
      entity: 'fixture_note_item',
      id: newId(),
      kind: 'create',
      fields: { noteId: parent.id, label: 'l' },
    });
    const res = await syncPush(ctx, a.cookie, [parent, child]);
    expect(res.status).toBe(500);
    expect(rowsOf('fixture_note')).toHaveLength(0);
    expect(rowsOf('applied_op')).toHaveLength(0);
    expect(rowsOf('sync_rejection')).toHaveLength(0);
  });

  it('une valeur non Error levée par un hook donne un 500 propre', async () => {
    const beforeApply = vi.fn(async () => {
      throw 'VALEUR-SECRETE';
    });
    const lines: string[] = [];
    const a = await setup({
      deps: {
        logger: createLogger((l) => lines.push(l)),
        syncHooks: withHooks({ fixture_note: { beforeApply } }),
      },
    });
    const res = await syncPush(ctx, a.cookie, [note(a)]);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal' });
    expect(rowsOf('fixture_note')).toHaveLength(0);
    expect(lines.join('\n')).not.toContain('VALEUR-SECRETE');
  });

  it("un create sans effet sur une ligne existante n'appelle ni afterApply ni afterBatch", async () => {
    const afterBatch = vi.fn(async (_b: BatchCtx) => {});
    const afterApply = vi.fn(async () => {});
    const a = await setup({ deps: { syncHooks: withHooks({ fixture_note: { afterBatch, afterApply } }) } });
    const id = newId();
    await syncPush(ctx, a.cookie, [note(a, { title: 'premier' }, id)]);
    afterBatch.mockClear();
    afterApply.mockClear();
    const res = await syncPush(ctx, a.cookie, [note(a, { title: 'second' }, id)]);
    expect(res.body.results[0].status).toBe('applied');
    expect(afterApply).not.toHaveBeenCalled();
    expect(afterBatch).not.toHaveBeenCalled();
  });
});
