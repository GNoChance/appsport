import { encodeWatermark } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { getServerMeta } from '../../src/db/server-meta';
import { DAILY_JOBS } from '../../src/jobs/registry';
import { createLogger } from '../../src/logger';
import { syncPurgeJob } from '../../src/sync/purge';
import {
  createSyncTestContext,
  createUserAndLogin,
  insertFixtureRow,
  seqIds,
  syncPull,
  type TestContext,
} from '../support';

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
type Row = Record<string, unknown>;

const NOW = '2026-10-06T10:00:00.000Z';
const OLD = '2026-07-07T10:00:00.000Z'; // 91 j
const RECENT = '2026-07-09T10:00:00.000Z'; // 89 j
const rowIds = seqIds(8000);

let ctx: TestContext;
let lines: string[];
afterEach(() => ctx?.close());

async function setup(): Promise<Member> {
  lines = [];
  ctx = await createSyncTestContext({ now: NOW, deps: { logger: createLogger((l) => lines.push(l)) } });
  return createUserAndLogin(ctx);
}

const bumpRev = () =>
  (
    ctx.deps.sqlite
      .prepare('UPDATE server_meta SET sync_counter = sync_counter + 1 RETURNING sync_counter')
      .get() as { sync_counter: number }
  ).sync_counter;

const rowOf = (table: string, id: string) =>
  ctx.deps.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined;

function insertNote(owner: { id: string }, deletedAt: string | null): { id: string; rev: number } {
  const id = rowIds.uuidv7();
  const rev = bumpRev();
  ctx.deps.sqlite
    .prepare(
      'INSERT INTO fixture_note (id, owner_id, rev, created_at, updated_at, updated_by, deleted_at, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, owner.id, rev, NOW, NOW, owner.id, deletedAt, 'note');
  return { id, rev };
}

function insertItem(
  owner: { id: string },
  noteId: string,
  deletedAt: string | null,
): { id: string; rev: number } {
  const id = rowIds.uuidv7();
  const rev = bumpRev();
  ctx.deps.sqlite
    .prepare(
      'INSERT INTO fixture_note_item (id, owner_id, rev, created_at, updated_at, updated_by, deleted_at, note_id, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, owner.id, rev, NOW, NOW, owner.id, deletedAt, noteId, 'item');
  return { id, rev };
}

function insertAppliedOp(owner: { id: string }, appliedAt: string): string {
  const opId = rowIds.uuidv7();
  ctx.deps.sqlite
    .prepare(
      "INSERT INTO applied_op (op_id, user_id, entity, row_id, status, assigned_rev, applied_at) VALUES (?, ?, 'fixture_note', ?, 'applied', 1, ?)",
    )
    .run(opId, owner.id, rowIds.uuidv7(), appliedAt);
  return opId;
}

const purgeRev = async () => (await getServerMeta(ctx.deps.db)).tombstonePurgeRev;

describe('syncPurgeJob (tombstones à 90 j, applied_op à 12 mois)', () => {
  it('tombstone de 91 j supprimée, de 89 j gardée ; gym et place jamais purgées', async () => {
    const a = await setup();
    const old = insertNote(a, OLD);
    const recent = insertNote(a, RECENT);
    const live = insertNote(a, null);
    const gym = await insertFixtureRow(ctx.deps.db, 'gym', { deletedAt: '2026-01-01T00:00:00.000Z' });
    const place = await insertFixtureRow(ctx.deps.db, 'place', {
      ownerId: a.id,
      deletedAt: '2026-01-01T00:00:00.000Z',
    });

    await syncPurgeJob.run(ctx.deps);

    expect(rowOf('fixture_note', old.id)).toBeUndefined();
    expect(rowOf('fixture_note', recent.id)).toBeDefined();
    expect(rowOf('fixture_note', live.id)).toBeDefined();
    expect(rowOf('gym', gym.id as string)).toBeDefined();
    expect(rowOf('place', place.id as string)).toBeDefined();
    expect(await purgeRev()).toBe(old.rev);
    const log = lines.map((l) => JSON.parse(l)).find((l) => l.msg === 'sync purge');
    expect(log).toMatchObject({ job: 'sync-purge', count: 1 });
  });

  it('enfant et parent à 91 j supprimés sans erreur de FK ; parent avec un enfant vivant gardé', async () => {
    const a = await setup();
    const parent = insertNote(a, OLD);
    const child = insertItem(a, parent.id, OLD);
    const keptParent = insertNote(a, OLD);
    const liveChild = insertItem(a, keptParent.id, null);
    const other = insertNote(a, OLD);

    await syncPurgeJob.run(ctx.deps);

    expect(rowOf('fixture_note', parent.id)).toBeUndefined();
    expect(rowOf('fixture_note_item', child.id)).toBeUndefined();
    expect(rowOf('fixture_note', other.id)).toBeUndefined();
    expect(rowOf('fixture_note', keptParent.id)).toBeDefined();
    expect(rowOf('fixture_note_item', liveChild.id)).toBeDefined();
    expect(await purgeRev()).toBe(other.rev);
  });

  it('tombstone_purge_rev ne diminue jamais', async () => {
    const a = await setup();
    insertNote(a, OLD);
    ctx.deps.sqlite.prepare('UPDATE server_meta SET tombstone_purge_rev = 1000').run();
    await syncPurgeJob.run(ctx.deps);
    expect(await purgeRev()).toBe(1000);
    await syncPurgeJob.run(ctx.deps);
    expect(await purgeRev()).toBe(1000);
  });

  it('applied_op de plus de 12 mois calendaires supprimée', async () => {
    const a = await setup();
    const oldOp = insertAppliedOp(a, '2025-10-05T10:00:00.000Z');
    const keptOp = insertAppliedOp(a, '2025-11-06T10:00:00.000Z');
    await syncPurgeJob.run(ctx.deps);
    const ops = (ctx.deps.sqlite.prepare('SELECT op_id FROM applied_op').all() as Row[]).map((r) => r.op_id);
    expect(ops).not.toContain(oldOp);
    expect(ops).toContain(keptOp);
  });

  it('après purge, un watermark antérieur au rev purgé donne 410', async () => {
    const a = await setup();
    const old = insertNote(a, OLD);
    insertNote(a, null);
    const { serverEpoch } = await getServerMeta(ctx.deps.db);
    const since = encodeWatermark(serverEpoch, old.rev - 1);
    expect((await syncPull(ctx, a.cookie, { since })).status).toBe(200);

    await syncPurgeJob.run(ctx.deps);
    const res = await syncPull(ctx, a.cookie, { since });
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('watermark_expired');
  });

  it('est enregistré parmi les jobs quotidiens', () => {
    expect(DAILY_JOBS).toContain(syncPurgeJob);
  });
});
