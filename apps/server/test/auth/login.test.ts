import { afterEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../src/auth/password-hash';
import { createTestContext, createUser, login, TEST_ARGON2, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

const IP = '100.64.0.1';
const BAD = 'faux faux faux faux';
const post = (username: string, password: string, ip = IP) =>
  ctx.request('/api/auth/login', { method: 'POST', json: { username, password }, ip });
const events = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).orderBy('id').execute();
const userRow = (id: string) =>
  ctx.deps.db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

describe('POST /api/auth/login', () => {
  it('connecte, pose le cookie et journalise (casse ignorée)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const before = await userRow(u.id);
    ctx.clock.advance(1000);
    const res = await post('LÉA', u.password);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ username: 'Léa', role: 'member', mustChangePassword: false });
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=/);
    const after = await userRow(u.id);
    expect(after.lastLoginAt).toBe('2026-10-06T10:00:01.000Z');
    expect(after.rev).toBeGreaterThan(before.rev);
    const [ev] = await events('login_succeeded');
    expect(ev).toMatchObject({ outcome: 'success', tailnetIp: '100.64.0.1', actorId: u.id });
  });

  it('mauvais mot de passe ou pseudo inconnu : 401 et login_failed', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    for (const name of ['Léa', 'inconnu']) {
      const res = await post(name, BAD);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'invalid_credentials' });
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    const failed = await events('login_failed');
    expect(failed.map((e) => [e.outcome, e.targetId])).toEqual([
      ['failure', u.id],
      ['failure', null],
    ]);
  });

  it('5 échecs bloquent 60 s (pseudo existant ou non), puis 200 (02 §15 n°7)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    for (let i = 0; i < 5; i += 1) expect((await post('Léa', BAD)).status).toBe(401);
    for (let i = 0; i < 2; i += 1) {
      const res = await post('Léa', u.password);
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ error: 'rate_limited', retryAfterS: 60 });
    }
    expect(await events('login_blocked')).toHaveLength(2);
    ctx.clock.advance(60_000);
    expect((await post('Léa', u.password)).status).toBe(200);
    for (let i = 0; i < 5; i += 1) expect((await post('fantome', 'x')).status).toBe(401);
    const ghost = await post('fantome', 'x');
    expect(ghost.status).toBe(429);
    expect(await ghost.json()).toEqual({ error: 'rate_limited', retryAfterS: 60 });
  });

  it('10e échec dans l heure : verrou d une heure ; un succès intercalé remet le compteur à zéro', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    for (let i = 0; i < 4; i += 1) await post('Léa', BAD);
    expect((await post('Léa', u.password)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) await post('Léa', BAD);
    expect((await post('Léa', u.password)).status).toBe(200);
    await post('Léa', BAD);
    await post('Léa', BAD);
    const res = await post('Léa', u.password);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited', retryAfterS: 3600 });
    ctx.clock.advance(3_600_000);
    expect((await post('Léa', u.password)).status).toBe(200);
  });

  it('30 échecs d une IP la bloquent, une autre IP passe (R-AUTH-3)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    for (let i = 0; i < 30; i += 1) await post(`inconnu${i}`, 'x', '100.64.0.9');
    expect((await post('Léa', u.password, '100.64.0.9')).status).toBe(429);
    expect((await post('Léa', u.password, '100.64.0.10')).status).toBe(200);
  });

  it('adresse illisible : ignorée par le limiteur et journalisée sans IP', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa' });
    const res = await ctx.request('/api/auth/login', {
      method: 'POST',
      json: { username: 'Léa', password: u.password },
      headers: { 'X-Forwarded-For': 'pas-une-ip' },
    });
    expect(res.status).toBe(200);
    const [ev] = await events('login_succeeded');
    expect(ev?.tailnetIp).toBeNull();
  });

  it('compte désactivé : invalid_credentials si faux, account_disabled sans cookie si juste (R-AUTH-5)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Léa', status: 'disabled' });
    const bad = await post('Léa', BAD);
    expect(await bad.json()).toEqual({ error: 'invalid_credentials' });
    const res = await post('Léa', u.password);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'account_disabled' });
    expect(res.headers.get('set-cookie')).toBeNull();
    const failed = await events('login_failed');
    expect(JSON.parse(failed[1]?.details ?? '{}')).toEqual({ reason: 'disabled' });
  });

  it('admin avec moins de 14 caractères : changement obligatoire (R-MDP-1)', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx, { username: 'Chef', role: 'admin', password: 'abcdefghijklm' });
    const res = await post('Chef', u.password);
    expect(await res.json()).toMatchObject({ role: 'admin', mustChangePassword: true });
    const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect((await ctx.request('/api/me', { cookie })).status).toBe(200);
    const out = await ctx.request('/api/auth/logout-all', { method: 'POST', cookie, json: {} });
    expect(out.status).toBe(403);
    expect(await out.json()).toEqual({ error: 'password_change_required' });
  });

  it('re-hache au besoin sans toucher password_changed_at (R-MDP-4)', async () => {
    ctx = await createTestContext({ config: { argon2: { ...TEST_ARGON2, memoryKiB: 2048 } } });
    const u = await createUser(ctx, { username: 'Léa' });
    const old = await hashPassword(u.password, TEST_ARGON2, ctx.deps.ids);
    await ctx.deps.db
      .updateTable('user')
      .set({ passwordHash: old, passwordChangedAt: '2026-09-01T00:00:00.000Z' })
      .where('id', '=', u.id)
      .execute();
    await login(ctx, 'Léa', u.password);
    const row = await userRow(u.id);
    expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=2048,t=1,p=1\$/);
    expect(row.passwordHash).not.toBe(old);
    expect(row.passwordChangedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});
