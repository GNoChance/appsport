import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, createUser, insertFixtureRow, login, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

const NEW = 'tortue verte du jardin';
const WRONG = 'faux faux faux faux';
const post = (path: string, cookie: string, json?: unknown) =>
  ctx.request(path, { method: 'POST', cookie, json: json ?? {}, ip: '100.64.0.1' });
const events = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).execute();

describe('POST /api/auth/password', () => {
  it('change le mot de passe, garde la session courante, révoque les autres (R-MDP-6)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa', password: 'ancien mot de passe' });
    const current = await login(ctx, 'Léa', u.password);
    const other = await login(ctx, 'Léa', u.password);
    ctx.clock.advance(1000);
    const res = await post('/api/auth/password', current, { currentPassword: u.password, newPassword: NEW });
    expect(res.status).toBe(204);
    expect((await ctx.request('/api/me', { cookie: current })).status).toBe(200);
    expect((await ctx.request('/api/me', { cookie: other })).status).toBe(401);
    const old = await ctx.request('/api/auth/login', {
      method: 'POST',
      json: { username: 'Léa', password: u.password },
    });
    expect(old.status).toBe(401);
    await login(ctx, 'Léa', NEW);
    const row = await ctx.deps.db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', u.id)
      .executeTakeFirstOrThrow();
    expect(row.passwordChangedAt).toBe('2026-10-06T10:00:01.000Z');
    expect(await events('password_changed')).toHaveLength(1);
  });

  it('annule les réinitialisations en attente', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    const reset = await insertFixtureRow(ctx.deps.db, 'password_reset', { userId: u.id });
    await post('/api/auth/password', cookie, { currentPassword: u.password, newPassword: NEW });
    const row = await ctx.deps.db
      .selectFrom('passwordReset')
      .selectAll()
      .where('id', '=', reset.id as string)
      .executeTakeFirstOrThrow();
    expect(row.cancelledAt).toBe('2026-10-06T10:00:00.000Z');
  });

  it('mot de passe actuel faux : 401 ; 5 faux puis le bon : 429 partagé avec la connexion (P-AUT-5)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    const bad = await post('/api/auth/password', cookie, { currentPassword: WRONG, newPassword: NEW });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: 'invalid_credentials' });
    for (let i = 0; i < 4; i += 1) {
      await post('/api/auth/password', cookie, { currentPassword: WRONG, newPassword: NEW });
    }
    const blocked = await post('/api/auth/password', cookie, {
      currentPassword: u.password,
      newPassword: NEW,
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'rate_limited', retryAfterS: 60 });
    const loginRes = await ctx.request('/api/auth/login', {
      method: 'POST',
      json: { username: 'Léa', password: u.password },
      ip: '100.64.0.1',
    });
    expect(loginRes.status).toBe(429);
  });

  it('nouveau mot de passe refusé : 400 password_rejected', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const cookie = await login(ctx, 'Léa', u.password);
    const res = await post('/api/auth/password', cookie, {
      currentPassword: u.password,
      newPassword: 'court',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'password_rejected', reason: 'too_short' });
  });

  it('lève l obligation de changement de l admin', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Chef', role: 'admin', password: 'abcdefghijklm' });
    const cookie = await login(ctx, 'Chef', u.password);
    const patch = () => ctx.request('/api/me', { method: 'PATCH', cookie, json: { username: 'Chef2' } });
    expect((await patch()).status).toBe(403);
    const res = await post('/api/auth/password', cookie, {
      currentPassword: u.password,
      newPassword: 'quatorze carac',
    });
    expect(res.status).toBe(204);
    const me = await ctx.request('/api/me', { cookie });
    expect(await me.json()).toMatchObject({ mustChangePassword: false });
    expect((await patch()).status).toBe(200);
  });
});

describe('déconnexion (R-AUTH-7)', () => {
  it('logout ne ferme que la session courante', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const current = await login(ctx, 'Léa', u.password);
    const other = await login(ctx, 'Léa', u.password);
    const res = await post('/api/auth/logout', current);
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await ctx.request('/api/me', { cookie: current })).status).toBe(401);
    expect((await ctx.request('/api/me', { cookie: other })).status).toBe(200);
    expect(await events('logout')).toHaveLength(1);
  });

  it('logout-all ferme toutes les sessions', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const a = await login(ctx, 'Léa', u.password);
    const b = await login(ctx, 'Léa', u.password);
    const res = await post('/api/auth/logout-all', a);
    expect(res.status).toBe(204);
    expect((await ctx.request('/api/me', { cookie: a })).status).toBe(401);
    expect((await ctx.request('/api/me', { cookie: b })).status).toBe(401);
    const rows = await ctx.deps.db.selectFrom('session').select('revokedReason').execute();
    expect(rows.map((r) => r.revokedReason)).toEqual(['logout_all', 'logout_all']);
    expect(await events('logout_all')).toHaveLength(1);
  });
});
