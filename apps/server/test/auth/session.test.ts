import { createHash } from 'node:crypto';
import { type Context, Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../src/app-env';
import {
  clearSessionCookie,
  createSession,
  requireAdmin,
  requireUser,
  revokeSessions,
  sessionMiddleware,
  setSessionCookie,
} from '../../src/auth/session';
import { errorHandler } from '../../src/http/errors';
import { createLogger } from '../../src/logger';
import { createTestContext, insertFixtureRow, type TestContext } from '../support';

const DAY = 86_400_000;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

let ctx: TestContext;
afterEach(() => ctx.close());

function probe(c: TestContext): Hono<AppEnv> {
  const { deps } = c;
  const app = new Hono<AppEnv>();
  app.onError(errorHandler(deps.logger));
  app.use('*', sessionMiddleware(deps));
  app.post('/probe/login/:id', async (h) => {
    const s = await createSession(deps.db, deps, h.req.param('id'), {
      mustChangePassword: h.req.query('mcp') === '1',
    });
    setSessionCookie(h, deps, s.token);
    return h.json(s);
  });
  app.post('/probe/clear', (h) => {
    clearSessionCookie(h, deps);
    return h.json({});
  });
  app.get('/probe/user', requireUser, (h) => h.json({ ok: true }));
  app.get('/probe/admin', requireAdmin, (h) => h.json({ ok: true }));
  const me = (h: Context<AppEnv>) => {
    const u = h.get('user');
    return h.json({
      id: u?.id,
      role: u?.role,
      birthDate: u?.birthDate,
      mustChangePassword: u?.mustChangePassword,
    });
  };
  app.get('/api/me', requireUser, me);
  app.post('/api/auth/password', requireUser, me);
  app.post('/api/auth/logout', requireUser, me);
  app.post('/api/auth/logout-all', requireUser, me);
  return app;
}

async function setup(opts: Parameters<typeof createTestContext>[0] = {}) {
  ctx = await createTestContext(opts);
  const app = probe(ctx);
  const get = (path: string, token?: string, method = 'GET') =>
    Promise.resolve(
      app.request(path, {
        method,
        headers: token ? { Cookie: `${ctx.deps.config.sessionCookieName}=${token}` } : {},
      }),
    );
  const user = async (v: Record<string, unknown> = {}) =>
    (await insertFixtureRow(ctx.deps.db, 'user', v)).id as string;
  const login = async (id: string, query = '') => {
    const res = await app.request(`/probe/login/${id}${query}`, { method: 'POST' });
    const body = (await res.json()) as { token: string; sessionId: string };
    return { ...body, setCookie: res.headers.get('set-cookie') ?? '' };
  };
  return { app, get, user, login };
}

const sessionRow = (id: string) =>
  ctx.deps.db.selectFrom('session').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

describe('cookie de session (P-AUT-3)', () => {
  it('pose __Host-session avec les attributs requis', async () => {
    const { user, login } = await setup();
    const { setCookie } = await login(await user());
    expect(setCookie).toMatch(/^__Host-session=[A-Za-z0-9_-]{43};/);
    for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=31536000']) {
      expect(setCookie).toContain(a);
    }
    expect(setCookie).not.toMatch(/Domain=/i);
  });

  it('en développement (http) : dev-session sans Secure', async () => {
    const { user, login } = await setup({
      config: { appOrigin: 'http://localhost:5173', sessionCookieName: 'dev-session', secureCookie: false },
    });
    const { setCookie } = await login(await user());
    expect(setCookie).toMatch(/^dev-session=/);
    expect(setCookie).not.toContain('Secure');
  });

  it('clearSessionCookie expire le cookie', async () => {
    const { app } = await setup();
    const res = await app.request('/probe/clear', { method: 'POST' });
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=;.*Max-Age=0/);
  });
});

describe('stockage du jeton (02 §15 n°4)', () => {
  it('ne stocke que le SHA-256 du jeton', async () => {
    const { user, login } = await setup();
    const id = await user();
    const { token, sessionId } = await login(id);
    const row = await sessionRow(sessionId);
    expect(row.tokenHash).toBe(sha256(token));
    expect(Object.values(row)).not.toContain(token);
    expect(row.userId).toBe(id);
    expect(row.expiresAt).toBe('2027-10-06T10:00:00.000Z');
    expect(row.mustChangePassword).toBe(0);
    expect(row.revokedAt).toBeNull();
  });

  it('enregistre must_change_password à 1 à la demande', async () => {
    const { user, login } = await setup();
    const { sessionId } = await login(await user(), '?mcp=1');
    expect((await sessionRow(sessionId)).mustChangePassword).toBe(1);
  });
});

describe('sessionMiddleware', () => {
  it('sans cookie : 401 unauthenticated', async () => {
    const { get } = await setup();
    const res = await get('/probe/user');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('avec cookie : expose l’utilisateur', async () => {
    const { get, user, login } = await setup();
    const id = await user();
    const { token } = await login(id);
    const res = await get('/api/me', token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id,
      role: 'member',
      birthDate: '1990-01-01',
      mustChangePassword: false,
    });
  });

  it('jeton inconnu : 401', async () => {
    const { get } = await setup();
    expect((await get('/probe/user', 'A'.repeat(43))).status).toBe(401);
  });

  it('expire après 90 jours d’inactivité, glissants', async () => {
    const { get, user, login } = await setup();
    const id = await user();
    const a = await login(id);
    const b = await login(id);
    ctx.clock.advance(89 * DAY);
    expect((await get('/probe/user', a.token)).status).toBe(200);
    ctx.clock.advance(DAY);
    expect((await get('/probe/user', b.token)).status).toBe(401);
    ctx.clock.advance(88 * DAY);
    expect((await get('/probe/user', a.token)).status).toBe(200);
  });

  it('expire à la durée absolue de 365 jours même si la session est active', async () => {
    const { get, user, login } = await setup();
    const { token } = await login(await user());
    for (let i = 0; i < 4; i++) {
      ctx.clock.advance(80 * DAY);
      expect((await get('/probe/user', token)).status).toBe(200);
    }
    ctx.clock.set('2027-10-06T09:59:59.999Z');
    expect((await get('/probe/user', token)).status).toBe(200);
    ctx.clock.advance(1);
    expect((await get('/probe/user', token)).status).toBe(401);
  });

  it('réécrit last_seen_at au plus une fois par heure', async () => {
    const { get, user, login } = await setup();
    const { token, sessionId } = await login(await user());
    ctx.clock.advance(30 * 60_000);
    await get('/probe/user', token);
    expect((await sessionRow(sessionId)).lastSeenAt).toBe('2026-10-06T10:00:00.000Z');
    ctx.clock.advance(31 * 60_000);
    await get('/probe/user', token);
    expect((await sessionRow(sessionId)).lastSeenAt).toBe('2026-10-06T11:01:00.000Z');
  });

  it('touche exactement à +60 min, pas à +59 min 59 s 999 ms', async () => {
    const { get, user, login } = await setup();
    const { token, sessionId } = await login(await user());
    ctx.clock.advance(3_600_000 - 1);
    await get('/probe/user', token);
    expect((await sessionRow(sessionId)).lastSeenAt).toBe('2026-10-06T10:00:00.000Z');
    ctx.clock.advance(1);
    await get('/probe/user', token);
    expect((await sessionRow(sessionId)).lastSeenAt).toBe('2026-10-06T11:00:00.000Z');
  });

  it('une session révoquée ne passe plus ; revokeSessions épargne la session exceptée', async () => {
    const { get, user, login } = await setup();
    const id = await user();
    const a = await login(id);
    const b = await login(id);
    expect(await revokeSessions(ctx.deps.db, ctx.deps, id, 'admin', a.sessionId)).toBe(1);
    expect((await get('/probe/user', a.token)).status).toBe(200);
    const res = await get('/probe/user', b.token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('compte désactivé : 401', async () => {
    const { get, user, login } = await setup();
    const { token } = await login(await user({ status: 'disabled' }));
    expect((await get('/probe/user', token)).status).toBe(401);
  });

  it('session account_deleted : 410, mais /api/health reste 200 (P-DRT-4)', async () => {
    const { get } = await setup();
    const token = 'deleted-account-token';
    await insertFixtureRow(ctx.deps.db, 'session', {
      tokenHash: sha256(token),
      userId: null,
      revokedAt: '2026-10-06T09:00:00.000Z',
      revokedReason: 'account_deleted',
    });
    const res = await get('/probe/user', token);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'account_deleted' });
    const health = await ctx.app.request('/api/health', {
      headers: { Cookie: `${ctx.deps.config.sessionCookieName}=${token}` },
    });
    expect(health.status).toBe(200);
  });
});

describe('requireAdmin (R-ROLE-4)', () => {
  it('403 forbidden pour un membre, 200 pour un admin', async () => {
    const { get, user, login } = await setup();
    const member = await login(await user());
    const admin = await login(await user({ role: 'admin' }));
    const res = await get('/probe/admin', member.token);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect((await get('/probe/admin', admin.token)).status).toBe(200);
  });
});

describe('mot de passe à changer (R-MDP-1)', () => {
  it('seules les routes autorisées restent ouvertes', async () => {
    const { get, user, login } = await setup();
    const { token } = await login(await user(), '?mcp=1');
    expect((await get('/api/me', token)).status).toBe(200);
    expect((await get('/api/auth/password', token, 'POST')).status).toBe(200);
    expect((await get('/api/auth/logout', token, 'POST')).status).toBe(200);
    for (const [path, method] of [
      ['/api/auth/logout-all', 'POST'],
      ['/probe/user', 'GET'],
    ] as const) {
      const res = await get(path, token, method);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'password_change_required' });
    }
  });
});

describe('base illisible', () => {
  it('/api/health reste en 503 dégradé avec swKill, pas en 500', async () => {
    const { user, login } = await setup({ config: { swKillSwitch: true } });
    const { token } = await login(await user());
    ctx.deps.sqlite.close();
    const res = await ctx.app.request('/api/health', {
      headers: { Cookie: `${ctx.deps.config.sessionCookieName}=${token}` },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'error', db: 'error', swKill: true });
  });

  it('une route protégée répond 503 et non 401', async () => {
    const lines: string[] = [];
    const { get, user, login } = await setup({ deps: { logger: createLogger((l) => lines.push(l)) } });
    const { token } = await login(await user());
    ctx.deps.sqlite.close();
    for (const path of ['/probe/user', '/probe/admin']) {
      const res = await get(path, token);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'internal' });
    }
    expect(lines.join(' ')).not.toContain(token);
  });
});

describe('journaux (03 §17 n°7)', () => {
  it('ni le jeton ni son empreinte n’apparaissent', async () => {
    const lines: string[] = [];
    const { get, user, login } = await setup({ deps: { logger: createLogger((l) => lines.push(l)) } });
    const { token } = await login(await user());
    await get('/probe/user', token);
    await ctx.app.request('/api/health', {
      headers: { Cookie: `${ctx.deps.config.sessionCookieName}=${token}` },
    });
    const notFound = await ctx.app.request('/api/inconnu', {
      headers: { Cookie: `${ctx.deps.config.sessionCookieName}=${token}` },
    });
    expect(notFound.status).toBe(404);
    const log = lines.join('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(log).not.toContain(token);
    expect(log).not.toContain(sha256(token));
  });
});
