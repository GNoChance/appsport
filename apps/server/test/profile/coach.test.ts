import { COACH_IDS } from '@rune/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS, type Migration } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { deleteAccount } from '../../src/privacy/delete-account';
import {
  createTestContext,
  createUserAndLogin,
  FakeClock,
  insertFixtureRow,
  syncPull,
  type TestContext,
} from '../support';

// Spec refonte §8 : coach choisi à l'onboarding, rangé dans training_profile (C1, classe E).

let ctx: TestContext | undefined;
afterEach(() => {
  ctx?.close();
  ctx = undefined;
});

const context = async () => {
  ctx = await createTestContext({ now: '2026-10-06T10:00:00.000Z' });
  return ctx;
};
const patch = (c: TestContext, cookie: string, json: unknown) =>
  c.request('/api/me/training-profile', { method: 'PATCH', cookie, json });
const complete = (c: TestContext, cookie: string) =>
  c.request('/api/me/onboarding/complete', { method: 'POST', cookie, json: {} });
const profileRow = (c: TestContext, id: string) =>
  c.deps.db.selectFrom('trainingProfile').selectAll().where('id', '=', id).executeTakeFirst();
const userRow = (c: TestContext, id: string) =>
  c.deps.db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const syncCounter = async (c: TestContext) =>
  (await c.deps.db.selectFrom('serverMeta').select('syncCounter').executeTakeFirstOrThrow()).syncCounter;

/** Toutes les étapes du serveur validées, sans coach. */
const READY_WITHOUT_COACH = {
  goal: 'muscle',
  experience: 'none',
  daysPerWeek: 3,
  sessionMinutes: 45,
  onboardingStep: 'health',
};

describe('migration 0002_coach', () => {
  const socleOnly = MIGRATIONS.filter((m) => m.id === '0001_socle');
  const open = () => openDatabase(':memory:');
  const columns = (h: ReturnType<typeof open>, table: string) =>
    (h.sqlite.prepare('SELECT name FROM pragma_table_info(?)').all(table) as { name: string }[]).map(
      (r) => r.name,
    );
  const rows = (h: ReturnType<typeof open>, table: string) =>
    h.sqlite.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all();

  it("suit 0001_socle et n'est pas cassante", () => {
    expect(MIGRATIONS.map((m) => ({ id: m.id, breaking: m.breaking }))).toEqual([
      { id: '0001_socle', breaking: false },
      { id: '0002_coach', breaking: false },
    ]);
  });

  it("une base 0001 avec des lignes migre sans perte ; coach vaut null puis n'admet que les trois coachs", async () => {
    const h = open();
    try {
      await migrate(h.db, socleOnly, new FakeClock());
      const user = await insertFixtureRow(h.db, 'user');
      await insertFixtureRow(h.db, 'training_profile', {
        ownerId: user.id,
        goal: 'strength',
        experience: 'gt_24_months',
        daysPerWeek: 4,
        sessionMinutes: 60,
        sportCode: 'other',
        sportOtherLabel: 'Ultimate',
        cautiousMode: 1,
      });
      await insertFixtureRow(h.db, 'place', { ownerId: user.id, kind: 'home', isPrimary: 1 });
      const before = {
        user: rows(h, 'user'),
        profile: rows(h, 'training_profile'),
        place: rows(h, 'place'),
      };
      expect(columns(h, 'training_profile')).not.toContain('coach');

      expect(await migrate(h.db, MIGRATIONS, new FakeClock())).toEqual({
        applied: ['0002_coach'],
        unknownNonBreaking: [],
      });
      expect(rows(h, 'user')).toEqual(before.user);
      expect(rows(h, 'place')).toEqual(before.place);
      expect(rows(h, 'training_profile')).toEqual(before.profile.map((r) => ({ ...r, coach: null })));

      expect(() => h.sqlite.exec("UPDATE training_profile SET coach = 'berserker'")).toThrow(
        'CHECK constraint failed',
      );
      for (const coach of COACH_IDS) {
        expect(() => h.sqlite.exec(`UPDATE training_profile SET coach = '${coach}'`)).not.toThrow();
      }
    } finally {
      h.sqlite.close();
    }
  });

  it('écrite dans la transaction des migrations : un échec qui la suit la retire', async () => {
    const h = open();
    try {
      await migrate(h.db, socleOnly, new FakeClock());
      const boom: Migration = {
        id: '0003_boom',
        breaking: false,
        up: async () => {
          throw new Error('boum');
        },
      };
      await expect(migrate(h.db, [...MIGRATIONS, boom], new FakeClock())).rejects.toMatchObject({
        name: 'MigrationError',
        code: 'migration_failed',
      });
      expect(columns(h, 'training_profile')).not.toContain('coach');
      expect(rows(h, 'schema_migrations')).toEqual([
        { id: '0001_socle', breaking: 0, applied_at: '2026-10-06T10:00:00.000Z' },
      ]);
    } finally {
      h.sqlite.close();
    }
  });
});

describe('PATCH /api/me/training-profile : coach', () => {
  it('pose puis change le coach ; un patch sans coach le garde', async () => {
    const c = await context();
    const u = await createUserAndLogin(c);
    expect((await patch(c, u.cookie, { coach: 'skald' })).status).toBe(200);
    expect(await profileRow(c, u.id)).toMatchObject({ coach: 'skald', goal: null, updatedBy: u.id });

    const rev = (await profileRow(c, u.id))?.rev ?? 0;
    expect((await patch(c, u.cookie, { coach: 'scribe', goal: 'muscle' })).status).toBe(200);
    const changed = await profileRow(c, u.id);
    expect(changed).toMatchObject({ coach: 'scribe', goal: 'muscle' });
    expect(changed?.rev).toBeGreaterThan(rev);

    expect((await patch(c, u.cookie, { experience: 'none' })).status).toBe(200);
    expect(await profileRow(c, u.id)).toMatchObject({ coach: 'scribe', experience: 'none' });
  });

  it.each([
    [{ coach: 'berserker' }],
    [{ coach: 'Skald' }],
    [{ coach: '' }],
    [{ coach: null }],
    [{ coach: 1 }],
  ])('400 validation pour %o, coach inchangé', async (body) => {
    const c = await context();
    const u = await createUserAndLogin(c);
    expect((await patch(c, u.cookie, { coach: 'ombre' })).status).toBe(200);
    const res = await patch(c, u.cookie, body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation');
    expect(await profileRow(c, u.id)).toMatchObject({ coach: 'ombre' });
  });
});

describe('POST /api/me/onboarding/complete : coach exigé', () => {
  it('toutes les autres étapes faites mais sans coach : 400 { field: coach }, rien écrit', async () => {
    const c = await context();
    const u = await createUserAndLogin(c);
    expect((await patch(c, u.cookie, READY_WITHOUT_COACH)).status).toBe(200);
    await insertFixtureRow(c.deps.db, 'place', { ownerId: u.id, kind: 'home', isPrimary: 1 });
    const before = { user: await userRow(c, u.id), counter: await syncCounter(c) };

    const res = await complete(c, u.cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', field: 'coach' });
    expect(await userRow(c, u.id)).toEqual(before.user);
    expect(await syncCounter(c)).toBe(before.counter);
  });

  it("le coach passe avant les autres étapes, comme dans l'interface (étape 1 sur 9)", async () => {
    const c = await context();
    const u = await createUserAndLogin(c);
    const res = await complete(c, u.cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', field: 'coach' });
  });

  it('avec un coach : 200 et onboarding terminé', async () => {
    const c = await context();
    const u = await createUserAndLogin(c);
    expect((await patch(c, u.cookie, { ...READY_WITHOUT_COACH, coach: 'skald' })).status).toBe(200);
    await insertFixtureRow(c.deps.db, 'place', { ownerId: u.id, kind: 'home', isPrimary: 1 });
    const res = await complete(c, u.cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ onboardingCompletedAt: '2026-10-06T10:00:00.000Z' });
  });
});

describe('coach : donnée du seul propriétaire (C1, classe E)', () => {
  it("le pull du propriétaire porte son coach ; un autre membre ne le lit ni ne l'écrit", async () => {
    const c = await context();
    const a = await createUserAndLogin(c);
    const b = await createUserAndLogin(c);
    expect((await patch(c, a.cookie, { coach: 'ombre' })).status).toBe(200);
    expect((await patch(c, b.cookie, { coach: 'scribe' })).status).toBe(200);
    expect(await profileRow(c, a.id)).toMatchObject({ coach: 'ombre' });

    type Pulled = { entity: string; row: Record<string, unknown> };
    const profiles = async (cookie: string) => {
      const res = await syncPull(c, cookie);
      expect(res.status).toBe(200);
      const rows = res.body.rows as Pulled[];
      return { rows, profiles: rows.filter((r) => r.entity === 'training_profile').map((r) => r.row) };
    };
    const ofA = await profiles(a.cookie);
    expect(ofA.profiles).toEqual([expect.objectContaining({ id: a.id, coach: 'ombre' })]);
    const ofB = await profiles(b.cookie);
    expect(ofB.profiles).toEqual([expect.objectContaining({ id: b.id, coach: 'scribe' })]);
    expect(JSON.stringify(ofB.rows)).not.toContain(a.id);
  });

  it("l'export JSON contient le coach", async () => {
    const c = await context();
    const u = await createUserAndLogin(c);
    expect((await patch(c, u.cookie, { coach: 'skald' })).status).toBe(200);
    const res = await c.request('/api/me/export', { cookie: u.cookie });
    expect(res.status).toBe(200);
    const exported = (await res.json()) as { tables: Record<string, Record<string, unknown>[]> };
    expect(exported.tables.training_profile).toEqual([expect.objectContaining({ id: u.id, coach: 'skald' })]);
  });

  it('supprimé avec le compte', async () => {
    const c = await context();
    const u = await createUserAndLogin(c);
    expect((await patch(c, u.cookie, { coach: 'skald' })).status).toBe(200);
    await c.deps.db
      .transaction()
      .execute((trx) => deleteAccount(trx, c.deps, u.id, { actorId: u.id, ip: null }));
    expect(await profileRow(c, u.id)).toBeUndefined();
  });
});
