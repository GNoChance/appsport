import { type EntityRulesMap, entityRules, SYNC_COLUMNS } from '@appsport/contracts';
import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Migration } from '../../src/db/migrations/index';
import { createLogger } from '../../src/logger';
import { HEALTH_WITHDRAW_HOOKS, withdrawHealthConsent } from '../../src/privacy/consent';
import { createTestContext, createUserAndLogin, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const WITNESS = 'TEMOIN-C2-5a1f';
const SYNC_DDL =
  'owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT, deleted_at TEXT';

const fixtureMigration: Migration = {
  id: '0002_fixture_t19',
  breaking: false,
  up: async (db) => {
    await sql
      .raw(
        `CREATE TABLE t19_note (id TEXT PRIMARY KEY, ${SYNC_DDL}, label TEXT NOT NULL, pain_note TEXT, reason TEXT) STRICT`,
      )
      .execute(db);
    await sql
      .raw(`CREATE TABLE t19_c2_log (id TEXT PRIMARY KEY, ${SYNC_DDL}, value TEXT) STRICT`)
      .execute(db);
  },
};

const rules: EntityRulesMap = {
  ...entityRules,
  t19_note: {
    category: 'C1',
    syncClass: 'J',
    ownerColumn: 'owner_id',
    columns: ['id', ...SYNC_COLUMNS, 'label', 'pain_note', 'reason'],
    clientWritable: ['label', 'pain_note', 'reason'],
    c2Columns: ['pain_note'],
    secretColumns: [],
    exported: true,
    onUserDelete: 'cascade',
    c2Values: { reason: ['pain'] },
  },
  t19_c2_log: {
    category: 'C2',
    syncClass: 'J',
    ownerColumn: 'owner_id',
    columns: ['id', ...SYNC_COLUMNS, 'value'],
    clientWritable: ['value'],
    c2Columns: [],
    secretColumns: [],
    exported: true,
    onUserDelete: 'cascade',
  },
};

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
type Row = Record<string, unknown>;

const call = (u: Member, path: string, method = 'GET', json?: unknown) =>
  ctx.request(path, { method, cookie: u.cookie, ...(json !== undefined ? { json } : {}) });
const withdraw = (u: Member, password = u.password) =>
  call(u, '/api/me/consents/withdraw', 'POST', { type: 'health', password });
const rowsOf = async (table: string, ownerId: string): Promise<Row[]> =>
  (
    await sql<Row>`select * from ${sql.table(table)} where owner_id = ${ownerId} order by id`.execute(
      ctx.deps.db,
    )
  ).rows;
const syncCounter = async () =>
  (await ctx.deps.db.selectFrom('serverMeta').select('syncCounter').executeTakeFirstOrThrow()).syncCounter;
const me = async (u: Member) =>
  (await (await call(u, '/api/me')).json()) as {
    cautious: boolean;
    consents: { health: { active: boolean } };
  };

let seq = 0;
async function insertRaw(table: string, ownerId: string, values: Row): Promise<void> {
  seq += 1;
  const row: Row = {
    id: `${table}-${seq}`,
    owner_id: ownerId,
    rev: 1,
    created_at: '2026-10-06T09:00:00.000Z',
    updated_at: '2026-10-06T09:00:00.000Z',
    ...values,
  };
  const cols = Object.keys(row);
  await sql`insert into ${sql.table(table)} (${sql.join(cols.map((c) => sql.ref(c)))}) values (${sql.join(
    Object.values(row),
  )})`.execute(ctx.deps.db);
}

async function equip(u: Member, opts: { cautiousMode?: boolean } = {}): Promise<void> {
  expect((await call(u, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' })).status).toBe(
    200,
  );
  const mode = await call(u, '/api/me/training-profile', 'PATCH', {
    cautiousMode: opts.cautiousMode ?? true,
  });
  expect(mode.status).toBe(200);
  const answers = [true, false, false, false];
  expect(
    (await call(u, '/api/me/health-screening', 'PUT', { answers, questionnaireVersion: '1.0' })).status,
  ).toBe(200);
  for (const json of [
    { bodyArea: 'knee', side: 'left', severity: 'mild', note: WITNESS },
    { bodyArea: 'lower_back', side: 'not_applicable', severity: 'severe' },
  ]) {
    expect((await call(u, '/api/me/limitations', 'POST', json)).status).toBe(201);
  }
  await insertRaw('t19_note', u.id, { label: 'séance', pain_note: WITNESS, reason: 'pain' });
  await insertRaw('t19_note', u.id, { label: 'repos', pain_note: null, reason: 'tired' });
  await insertRaw('t19_c2_log', u.id, { value: WITNESS });
}

async function setup(opts: { cautiousMode?: boolean; lines?: string[] } = {}) {
  ctx = await createTestContext({
    entityRules: rules,
    extraMigrations: [fixtureMigration],
    ...(opts.lines ? { deps: { logger: createLogger((l) => opts.lines?.push(l)) } } : {}),
  });
  const u = await createUserAndLogin(ctx, { username: 'lea' });
  const other = await createUserAndLogin(ctx, { username: 'tom' });
  await equip(u, opts);
  await equip(other);
  ctx.clock.advance(1000);
  return { u, other };
}

const snapshot = async (userId: string) => ({
  screening: await rowsOf('health_screening', userId),
  limitations: await rowsOf('limitation', userId),
  notes: await rowsOf('t19_note', userId),
  logs: await rowsOf('t19_c2_log', userId),
  consents: await rowsOf('consent_event', userId),
});

describe('POST /api/me/consents/withdraw : mot de passe (P-AUT-5)', () => {
  it('refuse un mot de passe faux et garde le consentement', async () => {
    const { u } = await setup();
    const res = await withdraw(u, 'faux faux faux faux');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
    expect((await me(u)).consents.health.active).toBe(true);
  });

  it('bloque après cinq échecs, même avec le bon mot de passe', async () => {
    const { u } = await setup();
    for (let i = 0; i < 5; i += 1) expect((await withdraw(u, 'faux faux faux faux')).status).toBe(401);
    const res = await withdraw(u);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited' });
    expect((await me(u)).consents.health.active).toBe(true);
  });
});

describe('retrait du consentement santé (R-CST-5, P-CST-3, 09 §8)', () => {
  it('efface les données C2 et garde le mode prudent', async () => {
    const { u, other } = await setup();
    const otherBefore = await snapshot(other.id);
    const limitationsBefore = await rowsOf('limitation', u.id);

    const res = await withdraw(u);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cautious: boolean; consents: { health: { active: boolean } } };
    expect(body.consents.health.active).toBe(false);
    expect(body.cautious).toBe(true);
    const profile = await ctx.deps.db
      .selectFrom('trainingProfile')
      .select('cautiousMode')
      .where('id', '=', u.id)
      .executeTakeFirstOrThrow();
    expect(profile.cautiousMode).toBe(1);

    expect(await rowsOf('health_screening', u.id)).toEqual([
      expect.objectContaining({
        caution: null,
        questionnaireVersion: null,
        answeredAt: null,
        deletedAt: '2026-10-06T10:00:01.000Z',
        updatedBy: u.id,
      }),
    ]);
    const limitations = await rowsOf('limitation', u.id);
    expect(limitations).toHaveLength(2);
    limitations.forEach((l, i) => {
      expect(l).toMatchObject({
        bodyArea: null,
        side: null,
        severity: null,
        note: null,
        active: null,
        deletedAt: '2026-10-06T10:00:01.000Z',
      });
      expect(l.rev as number).toBeGreaterThan(limitationsBefore[i]?.rev as number);
    });

    const [pain, tired] = await rowsOf('t19_note', u.id);
    expect(pain).toMatchObject({ label: 'séance', painNote: null, reason: null, deletedAt: null });
    expect(pain?.rev as number).toBeGreaterThan(1);
    expect(tired).toMatchObject({ label: 'repos', painNote: null, reason: 'tired', deletedAt: null, rev: 1 });
    expect(await rowsOf('t19_c2_log', u.id)).toEqual([
      expect.objectContaining({ value: null, deletedAt: '2026-10-06T10:00:01.000Z' }),
    ]);

    const consents = await rowsOf('consent_event', u.id);
    expect(consents.map((e) => [e.action, e.textVersion])).toEqual([
      ['grant', '1.0'],
      ['withdraw', '1.0'],
    ]);
    const revoked = await ctx.deps.db
      .selectFrom('securityEvent')
      .selectAll()
      .where('type', '=', 'consent_revoked')
      .execute();
    expect(revoked).toHaveLength(1);
    expect(revoked[0]).toMatchObject({ actorId: u.id, targetId: u.id, outcome: 'success' });
    expect(JSON.parse(revoked[0]?.details ?? 'null')).toEqual({ consentType: 'health' });

    expect(await snapshot(other.id)).toEqual(otherBefore);
  });

  it('un second retrait n’écrit rien', async () => {
    const { u } = await setup();
    expect((await withdraw(u)).status).toBe(200);
    const counter = await syncCounter();
    const security = await ctx.deps.db.selectFrom('securityEvent').selectAll().execute();
    const second = await withdraw(u);
    expect(second.status).toBe(200);
    expect(await syncCounter()).toBe(counter);
    expect(await ctx.deps.db.selectFrom('securityEvent').selectAll().execute()).toEqual(security);
    expect(await rowsOf('consent_event', u.id)).toHaveLength(2);
  });

  it('sans mode prudent choisi, le retrait lève la prudence venue du questionnaire', async () => {
    const { u } = await setup({ cautiousMode: false });
    expect((await me(u)).cautious).toBe(true);
    const res = await withdraw(u);
    expect(((await res.json()) as { cautious: boolean }).cautious).toBe(false);
  });

  it('un nouveau consentement puis le questionnaire réactivent la même ligne', async () => {
    const { u } = await setup();
    await withdraw(u);
    expect((await call(u, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' })).status).toBe(
      200,
    );
    const answers = [false, false, false, false];
    const res = await call(u, '/api/me/health-screening', 'PUT', { answers, questionnaireVersion: '1.0' });
    expect(await res.json()).toEqual({ caution: false });
    expect(await rowsOf('health_screening', u.id)).toEqual([
      expect.objectContaining({ id: u.id, caution: 0, questionnaireVersion: '1.0', deletedAt: null }),
    ]);
  });
});

describe('HEALTH_WITHDRAW_HOOKS', () => {
  it('est vide au socle', () => {
    expect(HEALTH_WITHDRAW_HOOKS).toEqual({});
  });

  it('un hook remplace la règle générique pour sa table', async () => {
    const { u } = await setup();
    const spy = vi.fn(async () => {});
    await ctx.deps.db.transaction().execute(async (trx) => {
      await withdrawHealthConsent(
        trx,
        ctx.deps,
        u.id,
        { actorId: u.id, ip: null },
        { hooks: { t19_c2_log: spy } },
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(trx, ctx.deps, u.id);
    });
    expect(await rowsOf('t19_c2_log', u.id)).toEqual([
      expect.objectContaining({ value: WITNESS, deletedAt: null }),
    ]);
    expect(await rowsOf('t19_note', u.id)).toEqual([
      expect.objectContaining({ painNote: null }),
      expect.objectContaining({ painNote: null }),
    ]);
  });
});

describe('Review Focus 3 : aucune trace C2 après retrait', () => {
  it('le témoin n’apparaît ni en base ni dans le journal', async () => {
    const lines: string[] = [];
    const { u, other } = await setup({ lines });
    expect((await withdraw(u)).status).toBe(200);
    expect((await withdraw(other)).status).toBe(200);
    const { sqlite } = ctx.deps;
    const tables = sqlite
      .prepare("select name from sqlite_schema where type = 'table' and name not like 'sqlite_%'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['t19_note', 't19_c2_log', 'limitation']),
    );
    for (const { name } of tables) {
      const dump = JSON.stringify(sqlite.prepare(`select * from "${name}"`).all());
      expect(dump, name).not.toContain(WITNESS);
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(WITNESS);
  });
});
