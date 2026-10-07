import { type EntityRulesMap, entityRules } from '@appsport/contracts';
import { sql } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import type { Migration } from '../../src/db/migrations/index';
import { createTestContext, createUser, insertFixtureRow, login, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const fixtureMigration: Migration = {
  id: '0002_fixture_export',
  breaking: false,
  up: async (db) => {
    await sql
      .raw(
        'CREATE TABLE fixture_export (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, label TEXT NOT NULL, secret_hash TEXT NOT NULL) STRICT',
      )
      .execute(db);
  },
};

const rulesWithFixture: EntityRulesMap = {
  ...entityRules,
  fixture_export: {
    category: 'C1',
    syncClass: 'H',
    ownerColumn: 'owner_id',
    columns: ['id', 'owner_id', 'label', 'secret_hash'],
    clientWritable: [],
    c2Columns: [],
    secretColumns: ['secret_hash'],
    exported: true,
    onUserDelete: 'cascade',
  },
};

describe('GET /api/me/export (R-EXP-1, R-EXP-2, P-DRT-1)', () => {
  it('exporte uniquement les données du compte, sans secret ni session', async () => {
    ctx = await createTestContext({ entityRules: rulesWithFixture, extraMigrations: [fixtureMigration] });
    const u = await createUser(ctx, { username: 'lea' });
    const other = await createUser(ctx, { username: 'tom' });
    const cookie = await login(ctx, 'lea', u.password);
    await login(ctx, 'tom', other.password);
    const { db } = ctx.deps;

    const mine = await insertFixtureRow(db, 'gym', { createdBy: u.id });
    const frequented = await insertFixtureRow(db, 'gym');
    const foreign = await insertFixtureRow(db, 'gym', { createdBy: other.id });
    const historyOnly = await insertFixtureRow(db, 'gym');
    const place = await insertFixtureRow(db, 'place', {
      ownerId: u.id,
      kind: 'gym',
      gymId: frequented.id,
      name: null,
      loadSettings: null,
    });
    await insertFixtureRow(db, 'place', { ownerId: other.id });
    const written = await insertFixtureRow(db, 'gym_history', { gymId: historyOnly.id, authorId: u.id });
    await insertFixtureRow(db, 'gym_history', { gymId: foreign.id, authorId: other.id });
    await insertFixtureRow(db, 'limitation', { ownerId: u.id });
    await insertFixtureRow(db, 'limitation', { ownerId: other.id });
    await sql`insert into fixture_export (id, owner_id, label, secret_hash) values ('f1', ${u.id}, 'témoin', 'x'), ('f2', ${other.id}, 'autre', 'y')`.execute(
      db,
    );

    const res = await ctx.request('/api/me/export', { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="appsport-export-2026-10-06.json"',
    );
    const text = await res.text();
    expect(text).not.toContain('$argon2id');
    const exp = JSON.parse(text);

    expect(exp.format).toBe('appsport-export/1');
    expect(exp.exportedAt).toBe('2026-10-06T10:00:00.000Z');
    expect(exp.account).toMatchObject({ id: u.id, username: 'lea' });
    expect(exp.account).not.toHaveProperty('passwordHash');
    expect(Object.keys(exp.tables).sort()).toEqual(
      Object.entries(rulesWithFixture)
        .filter(([t, r]) => r.exported && t !== 'user')
        .map(([t]) => t)
        .sort(),
    );
    expect(exp.tables).not.toHaveProperty('session');
    expect(exp.tables.place.map((r: { id: string }) => r.id)).toEqual([place.id]);
    expect(exp.tables.limitation).toHaveLength(1);
    expect(exp.tables.limitation[0].ownerId).toBe(u.id);
    expect(exp.tables.fixture_export).toEqual([{ id: 'f1', ownerId: u.id, label: 'témoin' }]);
    expect(exp.gyms.map((g: { id: string }) => g.id).sort()).toEqual(
      [mine.id, frequented.id, historyOnly.id].sort(),
    );
    expect(exp.gymHistory.map((h: { id: string }) => h.id)).toEqual([written.id]);
  });

  it('inclut les lieux supprimés et leurs salles, valeurs telles que stockées', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'lea' });
    const cookie = await login(ctx, 'lea', u.password);
    const gym = await insertFixtureRow(ctx.deps.db, 'gym');
    await insertFixtureRow(ctx.deps.db, 'place', {
      ownerId: u.id,
      kind: 'gym',
      gymId: gym.id,
      name: null,
      loadSettings: null,
      deletedAt: '2026-10-05T10:00:00.000Z',
    });
    const exp = (await (await ctx.request('/api/me/export', { cookie })).json()) as {
      gyms: { id: string; loadSettings: string }[];
      tables: Record<string, Record<string, unknown>[]>;
    };
    expect(exp.gyms.map((g: { id: string }) => g.id)).toEqual([gym.id]);
    expect(exp.tables.place?.[0]).toMatchObject({ isPrimary: 0, deletedAt: '2026-10-05T10:00:00.000Z' });
    expect(exp.gyms[0]?.loadSettings).toBe('{}');
  });

  it('journalise data_exported sans détail', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'lea' });
    const cookie = await login(ctx, 'lea', u.password);
    await ctx.request('/api/me/export', { cookie });
    const events = await ctx.deps.db
      .selectFrom('securityEvent')
      .selectAll()
      .where('type', '=', 'data_exported')
      .execute();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: u.id, targetId: u.id, details: null, outcome: 'success' });
  });

  it('exige une session', async () => {
    ctx = await createTestContext();
    const res = await ctx.request('/api/me/export');
    expect(res.status).toBe(401);
  });
});
