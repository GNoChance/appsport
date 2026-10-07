import { afterEach, describe, expect, it } from 'vitest';
import { userTraits } from '../../src/auth/me';
import { createTestContext, createUser, insertFixtureRow, login, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

const me = async (cookie: string) =>
  (await (await ctx.request('/api/me', { cookie })).json()) as Record<string, unknown>;
const patch = (cookie: string, json: unknown) => ctx.request('/api/me', { method: 'PATCH', cookie, json });
const userRow = (id: string) =>
  ctx.deps.db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

describe('GET /api/me', () => {
  it('rend le profil complet', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa', onboarded: true });
    const body = await me(await login(ctx, 'Léa', u.password));
    expect(body).toMatchObject({
      id: u.id,
      username: 'Léa',
      role: 'member',
      status: 'active',
      birthDate: '1990-01-01',
      ageBand: 'adult',
      cautious: false,
      mustChangePassword: false,
      passwordReminderDue: false,
      onboardingStep: 'ready',
      termsVersion: '1.0',
    });
    expect(body.consents).toEqual({
      health: { active: false, textVersion: null, at: null },
      aiCoach: { active: false, textVersion: null, at: null },
    });
  });

  it('âge à la date de Paris (R-AGE-2, R-AGE-3)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa', birthDate: '2008-10-07' });
    const cookie = await login(ctx, 'Léa', u.password);
    expect(await me(cookie)).toMatchObject({ ageBand: 'minor', cautious: true });
    expect(await userTraits(ctx.deps.db, ctx.deps, u.id)).toEqual({ ageBand: 'minor', cautious: true });
    ctx.clock.set('2026-10-06T22:30:00.000Z');
    expect(await me(cookie)).toMatchObject({ ageBand: 'adult', cautious: false });
    expect(await userTraits(ctx.deps.db, ctx.deps, u.id)).toEqual({ ageBand: 'adult', cautious: false });
  });

  it('mode prudent et précaution déclarée (R-CST-7)', async () => {
    ctx = await createTestContext();
    const a = await createUser(ctx, { username: 'Ana' });
    await insertFixtureRow(ctx.deps.db, 'training_profile', { ownerId: a.id, cautiousMode: 1 });
    expect(await me(await login(ctx, 'Ana', a.password))).toMatchObject({ cautious: true });
    const b = await createUser(ctx, { username: 'Bob' });
    await insertFixtureRow(ctx.deps.db, 'health_screening', { ownerId: b.id, caution: 1 });
    const cookie = await login(ctx, 'Bob', b.password);
    expect(await me(cookie)).toMatchObject({ cautious: false });
    await insertFixtureRow(ctx.deps.db, 'consent_event', {
      ownerId: b.id,
      type: 'health',
      action: 'grant',
      textVersion: '1.0',
    });
    expect(await me(cookie)).toMatchObject({ cautious: true });
  });

  it('rappel de mot de passe des admins à 12 mois (R-MDP-5)', async () => {
    ctx = await createTestContext();
    const password = 'quatorze carac';
    const ada = await createUser(ctx, {
      username: 'Ada',
      role: 'admin',
      password,
      passwordChangedAt: '2025-10-06T09:00:00.000Z',
    });
    const eve = await createUser(ctx, {
      username: 'Eve',
      role: 'admin',
      password,
      passwordChangedAt: '2025-10-06T11:00:00.000Z',
    });
    const max = await createUser(ctx, { username: 'Max', passwordChangedAt: '2020-01-01T00:00:00.000Z' });
    expect(await me(await login(ctx, 'Ada', ada.password))).toMatchObject({ passwordReminderDue: true });
    expect(await me(await login(ctx, 'Eve', eve.password))).toMatchObject({ passwordReminderDue: false });
    expect(await me(await login(ctx, 'Max', max.password))).toMatchObject({ passwordReminderDue: false });
  });

  it('sans session : 401', async () => {
    ctx = await createTestContext();
    expect((await ctx.request('/api/me')).status).toBe(401);
  });
});

describe('PATCH /api/me', () => {
  it('change le pseudo (R-CPT-3)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    const before = await userRow(u.id);
    const res = await patch(cookie, { username: 'Léa.B' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ username: 'Léa.B' });
    const row = await userRow(u.id);
    expect(row.usernameKey).toBe('léa.b');
    expect(row.rev).toBeGreaterThan(before.rev);
    const ev = await ctx.deps.db
      .selectFrom('securityEvent')
      .selectAll()
      .where('type', '=', 'username_changed')
      .execute();
    expect(ev).toHaveLength(1);
  });

  it('pseudo pris : 409 ; invalide : 400 ; changement de casse de soi-même accepté', async () => {
    ctx = await createTestContext();
    await createUser(ctx, { username: 'Éloïse' });
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    const taken = await patch(cookie, { username: 'ÉLOÏSE' });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'username_taken' });
    const bad = await patch(cookie, { username: 'ab' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'username_invalid', reason: 'length' });
    expect((await patch(cookie, { username: 'LÉA' })).status).toBe(200);
  });

  it('stocke le pseudo en NFC', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    expect((await patch(cookie, { username: 'Léa2' })).status).toBe(200);
    expect((await userRow(u.id)).username).toBe('Léa2');
  });

  it('deux changements simultanés vers le même pseudo : un seul passe', async () => {
    ctx = await createTestContext();
    const a = await createUser(ctx, { username: 'Ana' });
    const b = await createUser(ctx, { username: 'Bob' });
    const ca = await login(ctx, 'Ana', a.password);
    const cb = await login(ctx, 'Bob', b.password);
    const results = await Promise.all([patch(ca, { username: 'Zoé' }), patch(cb, { username: 'Zoé' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(await loser?.json()).toEqual({ error: 'username_taken' });
  });

  it('champ inconnu (birthDate) : 400 validation, rien ne change (P-MIN-2)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    const res = await patch(cookie, { username: 'lea2', birthDate: '2000-01-01' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation');
    const row = await userRow(u.id);
    expect(row.birthDate).toBe('1990-01-01');
    expect(row.username).toBe('Léa');
  });
});
