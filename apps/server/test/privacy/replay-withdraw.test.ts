import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, createUserAndLogin, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;

const IP = '100.64.0.7';
const call = (u: Member, path: string, method = 'GET', json?: unknown) =>
  ctx.request(path, { method, cookie: u.cookie, ip: IP, ...(json !== undefined ? { json } : {}) });
const replay = (u: Member, withdrawnAt: unknown) =>
  call(u, '/api/me/consents/health/replay-withdraw', 'POST', { withdrawnAt });
const revoked = () =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'consent_revoked').execute();
const state = async (userId: string) => ({
  counter: (await ctx.deps.db.selectFrom('serverMeta').select('syncCounter').executeTakeFirstOrThrow())
    .syncCounter,
  screening: await ctx.deps.db
    .selectFrom('healthScreening')
    .selectAll()
    .where('ownerId', '=', userId)
    .execute(),
  limitations: await ctx.deps.db.selectFrom('limitation').selectAll().where('ownerId', '=', userId).execute(),
  consents: await ctx.deps.db.selectFrom('consentEvent').selectAll().where('ownerId', '=', userId).execute(),
  security: await ctx.deps.db.selectFrom('securityEvent').selectAll().execute(),
});

/** Accord à 10:00, questionnaire et une limitation ; époque commencée à 12:00 ; appels à 12:30. */
async function setup(): Promise<Member> {
  ctx = await createTestContext();
  const u = await createUserAndLogin(ctx);
  expect((await call(u, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' })).status).toBe(
    200,
  );
  const answers = [true, false, false, false];
  expect(
    (await call(u, '/api/me/health-screening', 'PUT', { answers, questionnaireVersion: '1.0' })).status,
  ).toBe(200);
  const limitation = { bodyArea: 'knee', side: 'left', severity: 'mild' };
  expect((await call(u, '/api/me/limitations', 'POST', limitation)).status).toBe(201);
  await ctx.deps.db
    .updateTable('serverMeta')
    .set({ epochStartedAt: '2026-10-06T12:00:00.000Z' })
    .where('id', '=', 1)
    .execute();
  ctx.clock.set('2026-10-06T12:30:00.000Z');
  return u;
}

describe('POST /api/me/consents/health/replay-withdraw (R-SYN-28)', () => {
  it('rejoue un retrait fait avant le début de l’époque, sans mot de passe', async () => {
    const u = await setup();
    const res = await replay(u, '2026-10-06T11:00:00.000Z');
    expect(res.status).toBe(200);
    const me = (await res.json()) as { consents: { health: { active: boolean } } };
    expect(me.consents.health.active).toBe(false);
    const after = await state(u.id);
    expect(after.screening).toEqual([
      expect.objectContaining({ caution: null, deletedAt: '2026-10-06T12:30:00.000Z' }),
    ]);
    expect(after.limitations).toEqual([
      expect.objectContaining({ bodyArea: null, note: null, deletedAt: '2026-10-06T12:30:00.000Z' }),
    ]);
    expect(after.consents.map((e) => [e.action, e.textVersion])).toEqual([
      ['grant', '1.0'],
      ['withdraw', '1.0'],
    ]);
    const events = await revoked();
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]?.details ?? 'null')).toEqual({ consentType: 'health', replay: true });
  });

  it.each([
    ['égal au dernier accord', '2026-10-06T10:00:00.000Z'],
    ["égal au début de l'époque", '2026-10-06T12:00:00.000Z'],
  ])('refuse un retrait %s (409, rien ne change)', async (_label, withdrawnAt) => {
    const u = await setup();
    const before = await state(u.id);
    const res = await replay(u, withdrawnAt);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'conflict' });
    expect(await state(u.id)).toEqual(before);
  });

  it('refuse quand l’accord est déjà retiré', async () => {
    const u = await setup();
    const withdraw = await call(u, '/api/me/consents/withdraw', 'POST', {
      type: 'health',
      password: u.password,
    });
    expect(withdraw.status).toBe(200);
    const before = await state(u.id);
    const res = await replay(u, '2026-10-06T11:00:00.000Z');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'conflict' });
    expect(await state(u.id)).toEqual(before);
  });

  it('refuse quand aucun accord n’a jamais existé', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    ctx.clock.set('2026-10-06T12:30:00.000Z');
    const before = await state(u.id);
    const res = await replay(u, '2026-10-06T09:00:00.000Z');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'conflict' });
    expect(await state(u.id)).toEqual(before);
  });

  it('refuse une date illisible', async () => {
    const u = await setup();
    expect((await replay(u, 'hier')).status).toBe(400);
  });

  it('limite à 20 appels par heure et par IP', async () => {
    const u = await setup();
    for (let i = 0; i < 20; i += 1) expect((await replay(u, 'hier')).status).toBe(400);
    const res = await replay(u, '2026-10-06T11:00:00.000Z');
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited' });
    expect((await state(u.id)).consents).toHaveLength(1);
  });
});
