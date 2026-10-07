import { afterEach, describe, expect, it } from 'vitest';
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
type Pulled = { entity: string; rev: number; row: Row };

const NOW = '2026-10-06T10:00:00.000Z';
const rowIds = seqIds(8000);

let ctx: TestContext;
afterEach(() => ctx?.close());

async function setup(): Promise<Member> {
  ctx = await createSyncTestContext();
  return createUserAndLogin(ctx);
}

const meta = () =>
  ctx.deps.sqlite.prepare('SELECT server_epoch, sync_counter FROM server_meta').get() as {
    server_epoch: string;
    sync_counter: number;
  };

const bumpRev = () =>
  (
    ctx.deps.sqlite
      .prepare('UPDATE server_meta SET sync_counter = sync_counter + 1 RETURNING sync_counter')
      .get() as {
      sync_counter: number;
    }
  ).sync_counter;

/** Note de test écrite directement (rev pris au compteur, ou imposé). */
function insertNote(owner: { id: string }, o: { rev?: number; deletedAt?: string | null } = {}): string {
  const id = rowIds.uuidv7();
  ctx.deps.sqlite
    .prepare(
      'INSERT INTO fixture_note (id, owner_id, rev, created_at, updated_at, updated_by, deleted_at, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, owner.id, o.rev ?? bumpRev(), NOW, NOW, owner.id, o.deletedAt ?? null, 'note');
  return id;
}

/** Watermark courant après un pull complet (point de départ des tests de pagination). */
async function drain(u: Member): Promise<string> {
  const res = await syncPull(ctx, u.cookie);
  expect(res.status).toBe(200);
  expect(res.body.hasMore).toBe(false);
  return res.body.nextWatermark;
}

const notes = (rows: Pulled[]) => rows.filter((r) => r.entity === 'fixture_note');

describe('GET /api/sync/pull : pagination', () => {
  it('3 notes triées par rev ; sans since : hasMore false et watermark au compteur', async () => {
    const a = await setup();
    const ids = [insertNote(a), insertNote(a), insertNote(a)];
    const res = await syncPull(ctx, a.cookie);
    expect(res.status).toBe(200);
    const rows = res.body.rows as Pulled[];
    expect(notes(rows).map((r) => r.row.id)).toEqual(ids);
    const revs = rows.map((r) => r.rev);
    expect(revs).toEqual([...revs].sort((x, y) => x - y));
    const { server_epoch, sync_counter } = meta();
    expect(res.body).toMatchObject({ hasMore: false, nextWatermark: `${server_epoch}:${sync_counter}` });
  });

  it('5 notes, limit=2 : 2 lignes, hasMore, watermark au dernier rev ; reprise → les 2 suivantes', async () => {
    const a = await setup();
    const since = await drain(a);
    const ids = Array.from({ length: 5 }, () => insertNote(a));
    const first = await syncPull(ctx, a.cookie, { since, limit: 2 });
    const rows = first.body.rows as Pulled[];
    expect(rows.map((r) => r.row.id)).toEqual(ids.slice(0, 2));
    const epoch = meta().server_epoch;
    expect(first.body).toMatchObject({ hasMore: true, nextWatermark: `${epoch}:${rows[1]?.rev}` });

    const second = await syncPull(ctx, a.cookie, { since: first.body.nextWatermark, limit: 2 });
    expect((second.body.rows as Pulled[]).map((r) => r.row.id)).toEqual(ids.slice(2, 4));
    expect(second.body.hasMore).toBe(true);

    const third = await syncPull(ctx, a.cookie, { since: second.body.nextWatermark, limit: 2 });
    expect((third.body.rows as Pulled[]).map((r) => r.row.id)).toEqual(ids.slice(4));
    expect(third.body).toMatchObject({ hasMore: false, nextWatermark: `${epoch}:${meta().sync_counter}` });
  });

  it('600 notes : 500 lignes par défaut, hasMore ; limit=501 → validation', async () => {
    const a = await setup();
    const since = await drain(a);
    for (let i = 0; i < 600; i++) insertNote(a);
    const res = await syncPull(ctx, a.cookie, { since });
    expect(res.body.rows).toHaveLength(500);
    expect(res.body.hasMore).toBe(true);

    const tooMany = await syncPull(ctx, a.cookie, { since, limit: 501 });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toBe('validation');
  });

  it('ne coupe jamais un groupe de même rev (3 notes dont 2 au même rev, limit=2 → 3 lignes)', async () => {
    const a = await setup();
    const since = await drain(a);
    const first = insertNote(a);
    const shared = bumpRev();
    const second = insertNote(a, { rev: shared });
    const third = insertNote(a, { rev: shared });
    const res = await syncPull(ctx, a.cookie, { since, limit: 2 });
    const rows = res.body.rows as Pulled[];
    expect(rows.map((r) => r.row.id).sort()).toEqual([first, second, third].sort());
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextWatermark).toBe(`${meta().server_epoch}:${shared}`);
  });

  it('un watermark sans ligne nouvelle garde son rev au moins', async () => {
    const a = await setup();
    const since = await drain(a);
    const res = await syncPull(ctx, a.cookie, { since });
    expect(res.body).toMatchObject({ rows: [], hasMore: false, nextWatermark: since });
  });
});

describe('GET /api/sync/pull : contenu des lignes', () => {
  it('tombstone avec deletedAt ; tombstone health_screening → caution null ; booléens décodés', async () => {
    const a = await setup();
    const deleted = insertNote(a, { deletedAt: NOW });
    await insertFixtureRow(ctx.deps.db, 'health_screening', {
      ownerId: a.id,
      caution: null,
      questionnaireVersion: null,
      answeredAt: null,
      deletedAt: NOW,
    });
    await insertFixtureRow(ctx.deps.db, 'training_profile', { ownerId: a.id, cautiousMode: 1 });
    const res = await syncPull(ctx, a.cookie);
    const rows = res.body.rows as Pulled[];
    expect(rows.find((r) => r.row.id === deleted)?.row.deletedAt).toBe(NOW);
    const screening = rows.find((r) => r.entity === 'health_screening');
    expect(screening?.row).toMatchObject({ id: a.id, caution: null, deletedAt: NOW });
    expect(rows.find((r) => r.entity === 'training_profile')?.row.cautiousMode).toBe(true);
    for (const r of rows) expect(r.row).toHaveProperty('deletedAt');
  });

  it('ligne user : la sienne seulement, sans passwordHash, deletedAt null', async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const res = await syncPull(ctx, a.cookie);
    const users = (res.body.rows as Pulled[]).filter((r) => r.entity === 'user');
    expect(users.map((r) => r.row.id)).toEqual([a.id]);
    expect(users[0]?.row).not.toHaveProperty('passwordHash');
    expect(users[0]?.row).toMatchObject({ username: a.username, deletedAt: null });
    expect(JSON.stringify(res.body)).not.toContain(b.id);
  });

  it('salle créée par b : gym et gym_equipment présents, loadSettings objet ; aucun place de b', async () => {
    const a = await setup();
    const b = await createUserAndLogin(ctx);
    const gym = await insertFixtureRow(ctx.deps.db, 'gym', { loadSettings: '{"barG":20000}' });
    const equipment = await insertFixtureRow(ctx.deps.db, 'gym_equipment', { gymId: gym.id });
    const place = await insertFixtureRow(ctx.deps.db, 'place', {
      ownerId: b.id,
      kind: 'gym',
      gymId: gym.id,
      name: null,
      loadSettings: null,
    });
    const rows = (await syncPull(ctx, a.cookie)).body.rows as Pulled[];
    expect(rows.find((r) => r.entity === 'gym')?.row).toMatchObject({
      id: gym.id,
      loadSettings: { barG: 20000 },
    });
    expect(rows.find((r) => r.entity === 'gym_equipment')?.row.id).toBe(equipment.id);
    expect(rows.some((r) => r.row.id === place.id)).toBe(false);
  });

  it('place : booléens et réglages JSON décodés, réglages null restent null', async () => {
    const a = await setup();
    await insertFixtureRow(ctx.deps.db, 'place', {
      ownerId: a.id,
      isPrimary: 1,
      visibleAtGym: 0,
      loadSettings: '{"barG":15000}',
    });
    const place = (await syncPull(ctx, a.cookie)).body.rows.find((r: Pulled) => r.entity === 'place');
    expect(place.row).toMatchObject({ isPrimary: true, visibleAtGym: false, loadSettings: { barG: 15000 } });
  });
});

describe('GET /api/sync/pull : watermark et métadonnées', () => {
  it("since d'une autre époque → 410 watermark_expired", async () => {
    const a = await setup();
    const res = await syncPull(ctx, a.cookie, { since: '0199aaaa-0000-7000-8000-000000000000:3' });
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'watermark_expired' });
  });

  it('tombstone_purge_rev = 10 : since rev 5 → 410, rev 10 → 200', async () => {
    const a = await setup();
    ctx.deps.sqlite.prepare('UPDATE server_meta SET tombstone_purge_rev = 10').run();
    const epoch = meta().server_epoch;
    const old = await syncPull(ctx, a.cookie, { since: `${epoch}:5` });
    expect(old.status).toBe(410);
    expect(old.body).toEqual({ error: 'watermark_expired' });
    expect((await syncPull(ctx, a.cookie, { since: `${epoch}:10` })).status).toBe(200);
  });

  it("since 'abc' → 400 validation", async () => {
    const a = await setup();
    const res = await syncPull(ctx, a.cookie, { since: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });

  it('catalogVersion reprend server_meta.catalog_version', async () => {
    const a = await setup();
    expect((await syncPull(ctx, a.cookie)).body.catalogVersion).toBeNull();
    ctx.deps.sqlite.prepare("UPDATE server_meta SET catalog_version = 'abc'").run();
    expect((await syncPull(ctx, a.cookie)).body.catalogVersion).toBe('abc');
  });
});
