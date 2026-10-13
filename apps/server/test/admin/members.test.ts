import { afterEach, describe, expect, it } from 'vitest';
import { listMembers } from '../../src/admin/members';
import { createTestContext, createUser, insertFixtureRow, login, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const WRONG = 'faux faux faux faux';
const post = (path: string, cookie: string, json: unknown = {}, ip = '100.64.0.1') =>
  ctx.request(path, { method: 'POST', cookie, json, ip });
const events = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).execute();
const sessionCount = async (name: string): Promise<number | undefined> =>
  (await listMembers(ctx.deps.db, ctx.deps)).find((x) => x.username === name)?.activeSessions;

async function setup() {
  ctx = await createTestContext();
  const admin = await createUser(ctx, { username: 'porteur', role: 'admin', password: 'quatorze carac' });
  const adminCookie = await login(ctx, 'porteur', admin.password);
  return { admin, adminCookie };
}

describe('GET /api/admin/members', () => {
  it('liste triée, sans donnée C1 à C3 (R-ADM-1)', async () => {
    const { adminCookie } = await setup();
    const m = await createUser(ctx, { username: 'lea', birthDate: '2010-01-01', onboarded: true });
    await login(ctx, 'lea', m.password);
    await login(ctx, 'lea', m.password);
    await insertFixtureRow(ctx.deps.db, 'consent_event', {
      ownerId: m.id,
      type: 'health',
      action: 'grant',
      textVersion: '1.0',
      rev: 5,
      createdAt: '2026-10-06T10:00:00.000Z',
    });
    const res = await ctx.request('/api/admin/members', { cookie: adminCookie });
    expect(res.status).toBe(200);
    const list = (await res.json()) as { username: string }[];
    expect(list[0]).toEqual({
      id: m.id,
      username: 'lea',
      role: 'member',
      status: 'active',
      isMinor: true,
      lastLoginAt: '2026-10-06T10:00:00.000Z',
      onboardingCompleted: true,
      consents: { health: true, aiCoach: false },
      activeSessions: 2,
    });
    expect(list.map((x) => x.username)).toEqual(['lea', 'porteur']);
  });

  it('ne compte pas les sessions révoquées ni inactives depuis 90 jours', async () => {
    await setup();
    const m = await createUser(ctx, { username: 'lea' });
    await login(ctx, 'lea', m.password);
    await login(ctx, 'lea', m.password);
    const first = await ctx.deps.db
      .selectFrom('session')
      .select('id')
      .where('userId', '=', m.id)
      .executeTakeFirstOrThrow();
    await ctx.deps.db
      .updateTable('session')
      .set({ revokedAt: '2026-10-06T10:00:00.000Z', revokedReason: 'logout' })
      .where('id', '=', first.id)
      .execute();
    expect(await sessionCount('lea')).toBe(1);
    ctx.clock.advance(90 * 86_400_000 - 1);
    expect(await sessionCount('lea')).toBe(1);
    ctx.clock.advance(1);
    expect(await sessionCount('lea')).toBe(0);
  });

  it('refuse un membre (R-ROLE-4)', async () => {
    await setup();
    const m = await createUser(ctx, { username: 'lea' });
    const cookie = await login(ctx, 'lea', m.password);
    for (const path of ['/api/admin/members', '/api/admin/ops-status']) {
      const res = await ctx.request(path, { cookie });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    }
    const denied = await post(`/api/admin/members/${m.id}/status`, cookie, { status: 'disabled' });
    expect(denied.status).toBe(403);
  });
});

describe('dernier administrateur (R-ROLE-2)', () => {
  it('refuse de rétrograder ou désactiver le dernier admin actif', async () => {
    const { admin, adminCookie } = await setup();
    const role = await post(`/api/admin/members/${admin.id}/role`, adminCookie, {
      role: 'member',
      password: admin.password,
    });
    expect(role.status).toBe(409);
    expect(await role.json()).toEqual({ error: 'last_admin' });
    const status = await post(`/api/admin/members/${admin.id}/status`, adminCookie, { status: 'disabled' });
    expect(await status.json()).toEqual({ error: 'last_admin' });
  });

  it('un autre admin désactivé ne compte pas ; un autre admin actif autorise', async () => {
    const { admin, adminCookie } = await setup();
    const other = await createUser(ctx, { username: 'second', role: 'admin', status: 'disabled' });
    const res = await post(`/api/admin/members/${admin.id}/status`, adminCookie, { status: 'disabled' });
    expect(res.status).toBe(409);
    await ctx.deps.db.updateTable('user').set({ status: 'active' }).where('id', '=', other.id).execute();
    const ok = await post(`/api/admin/members/${admin.id}/role`, adminCookie, {
      role: 'member',
      password: admin.password,
    });
    expect(ok.status).toBe(204);
  });

  it('deux admins qui se rétrogradent en même temps : un seul réussit', async () => {
    const { admin, adminCookie } = await setup();
    const b = await createUser(ctx, { username: 'second', role: 'admin', password: 'quatorze carac' });
    const bCookie = await login(ctx, 'second', b.password, '100.64.0.2');
    const [r1, r2] = await Promise.all([
      post(`/api/admin/members/${b.id}/role`, adminCookie, { role: 'member', password: admin.password }),
      post(
        `/api/admin/members/${admin.id}/role`,
        bCookie,
        { role: 'member', password: b.password },
        '100.64.0.2',
      ),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([204, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect(await loser.json()).toEqual({ error: 'last_admin' });
    const active = await ctx.deps.db
      .selectFrom('user')
      .select('id')
      .where('role', '=', 'admin')
      .where('status', '=', 'active')
      .execute();
    expect(active).toHaveLength(1);
  });
});

describe('rôle, statut, date de naissance, sessions', () => {
  it('rôle : mot de passe admin faux → 401, bon → 204 et journal (P-AUT-5)', async () => {
    const { admin, adminCookie } = await setup();
    const m = await createUser(ctx, { username: 'lea' });
    const bad = await post(`/api/admin/members/${m.id}/role`, adminCookie, {
      role: 'admin',
      password: WRONG,
    });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: 'invalid_credentials' });
    const ok = await post(`/api/admin/members/${m.id}/role`, adminCookie, {
      role: 'admin',
      password: admin.password,
    });
    expect(ok.status).toBe(204);
    const row = await ctx.deps.db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', m.id)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ role: 'admin', updatedBy: admin.id });
    const logged = await events('role_changed');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ actorId: admin.id, targetId: m.id, details: '{"role":"admin"}' });
  });

  it('désactivation : sessions révoquées, connexion refusée ; réactivation (R-ADM-1)', async () => {
    const { adminCookie } = await setup();
    const m = await createUser(ctx, { username: 'lea' });
    const cookie = await login(ctx, 'lea', m.password);
    const off = await post(`/api/admin/members/${m.id}/status`, adminCookie, { status: 'disabled' });
    expect(off.status).toBe(204);
    expect((await ctx.request('/api/me', { cookie })).status).toBe(401);
    const denied = await ctx.request('/api/auth/login', {
      method: 'POST',
      json: { username: 'lea', password: m.password },
    });
    expect(await denied.json()).toEqual({ error: 'account_disabled' });
    const on = await post(`/api/admin/members/${m.id}/status`, adminCookie, { status: 'active' });
    expect(on.status).toBe(204);
    await login(ctx, 'lea', m.password);
    expect(await events('status_changed')).toHaveLength(2);
  });

  it('date de naissance : sous 16 ans refusé, correction journalisée sans détail (R-AGE-4)', async () => {
    const { adminCookie } = await setup();
    const m = await createUser(ctx, { username: 'lea' });
    const bad = await post(`/api/admin/members/${m.id}/birth-date`, adminCookie, { birthDate: '2010-10-07' });
    expect(await bad.json()).toEqual({ error: 'under_min_age' });
    const ok = await post(`/api/admin/members/${m.id}/birth-date`, adminCookie, { birthDate: '2009-01-01' });
    expect(ok.status).toBe(204);
    const row = await ctx.deps.db
      .selectFrom('user')
      .select('birthDate')
      .where('id', '=', m.id)
      .executeTakeFirstOrThrow();
    expect(row.birthDate).toBe('2009-01-01');
    const logged = await events('birth_date_corrected');
    expect(logged).toHaveLength(1);
    expect(logged[0]?.details).toBeNull();
  });

  it('révocation des sessions (R-AUTH-7) ; membre inconnu → not_found', async () => {
    const { adminCookie } = await setup();
    const m = await createUser(ctx, { username: 'lea' });
    const cookie = await login(ctx, 'lea', m.password);
    expect((await post(`/api/admin/members/${m.id}/revoke-sessions`, adminCookie)).status).toBe(204);
    expect((await ctx.request('/api/me', { cookie })).status).toBe(401);
    const logged = await events('sessions_revoked');
    expect(logged).toHaveLength(1);
    expect(logged[0]?.details).toBe('{"count":1}');
    const unknown = await post('/api/admin/members/inconnu/revoke-sessions', adminCookie);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'not_found' });
  });
});
