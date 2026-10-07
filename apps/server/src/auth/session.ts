import { SESSION_IDLE_DAYS, SESSION_MAX_DAYS, SESSION_TOUCH_INTERVAL_MS } from '@appsport/contracts';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../app-env';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { HttpError, httpError } from '../http/errors';
import { hashSecret } from './secret';

const DAY_MS = 86_400_000;

export async function createSession(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  opts: { mustChangePassword?: boolean } = {},
): Promise<{ token: string; sessionId: string }> {
  const token = Buffer.from(deps.ids.randomBytes(32)).toString('base64url');
  const sessionId = deps.ids.uuidv7();
  const now = deps.clock.now();
  await trx
    .insertInto('session')
    .values({
      id: sessionId,
      tokenHash: hashSecret(token),
      userId,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_MAX_DAYS * DAY_MS).toISOString(),
      mustChangePassword: opts.mustChangePassword ? 1 : 0,
    })
    .execute();
  return { token, sessionId };
}

export function setSessionCookie(c: Context<AppEnv>, deps: AppDeps, token: string): void {
  setCookie(c, deps.config.sessionCookieName, token, {
    httpOnly: true,
    secure: deps.config.secureCookie,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_DAYS * 86400,
  });
}

export function clearSessionCookie(c: Context<AppEnv>, deps: AppDeps): void {
  deleteCookie(c, deps.config.sessionCookieName, {
    path: '/',
    secure: deps.config.secureCookie,
  });
}

export async function revokeSession(
  trx: DbExecutor,
  deps: AppDeps,
  sessionId: string,
  reason: 'logout',
): Promise<void> {
  await trx
    .updateTable('session')
    .set({ revokedAt: deps.clock.now().toISOString(), revokedReason: reason })
    .where('id', '=', sessionId)
    .where('revokedAt', 'is', null)
    .execute();
}

/** Révoque les sessions actives de l'utilisateur (sauf `exceptSessionId`) ; renvoie leur nombre. */
export async function revokeSessions(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  reason: 'logout' | 'logout_all' | 'password_change' | 'password_reset' | 'admin',
  exceptSessionId?: string,
): Promise<number> {
  let query = trx
    .updateTable('session')
    .set({ revokedAt: deps.clock.now().toISOString(), revokedReason: reason })
    .where('userId', '=', userId)
    .where('revokedAt', 'is', null);
  if (exceptSessionId) query = query.where('id', '!=', exceptSessionId);
  const result = await query.executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/** Ne bloque jamais : sans session valide, `user` et `sessionId` valent null (sauf compte supprimé). */
export function sessionMiddleware(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('user', null);
    c.set('sessionId', null);
    const token = getCookie(c, deps.config.sessionCookieName);
    if (token) {
      try {
        await resolveSession(c, deps, token);
      } catch (error) {
        // Base illisible : ni 401 (déconnecterait le client) ni 500 ; requireUser répond 503.
        c.set('user', null);
        c.set('sessionId', null);
        c.set('sessionUnavailable', true);
        deps.logger.error('session_unavailable', {
          requestId: c.get('requestId'),
          code: 'internal',
          event: error instanceof Error ? error.name : 'unknown',
        });
      }
    }
    await next();
  };
}

async function resolveSession(c: Context<AppEnv>, deps: AppDeps, token: string): Promise<void> {
  const session = await deps.db
    .selectFrom('session')
    .selectAll()
    .where('tokenHash', '=', hashSecret(token))
    .executeTakeFirst();
  if (!session) return;
  if (session.revokedReason === 'account_deleted') {
    c.set('sessionId', session.id);
    return;
  }
  if (session.revokedAt !== null || session.userId === null) return;
  const nowMs = deps.clock.now().getTime();
  const lastSeenMs = new Date(session.lastSeenAt).getTime();
  if (new Date(session.expiresAt).getTime() <= nowMs) return;
  if (lastSeenMs + SESSION_IDLE_DAYS * DAY_MS <= nowMs) return;
  const user = await deps.db
    .selectFrom('user')
    .select(['id', 'username', 'role', 'birthDate', 'status'])
    .where('id', '=', session.userId)
    .executeTakeFirst();
  if (!user || user.status === 'disabled') return;
  if (nowMs - lastSeenMs >= SESSION_TOUCH_INTERVAL_MS) {
    await deps.db
      .updateTable('session')
      .set({ lastSeenAt: new Date(nowMs).toISOString() })
      .where('id', '=', session.id)
      .execute();
  }
  c.set('sessionId', session.id);
  c.set('user', {
    id: user.id,
    username: user.username,
    role: user.role,
    birthDate: user.birthDate,
    mustChangePassword: session.mustChangePassword === 1,
  });
}

export const MUST_CHANGE_ALLOWED: readonly string[] = [
  'GET /api/me',
  'POST /api/auth/password',
  'POST /api/auth/logout',
];

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('sessionUnavailable')) throw new HttpError(503, 'internal');
  const user = c.get('user');
  if (!user) throw httpError(c.get('sessionId') ? 'account_deleted' : 'unauthenticated');
  if (user.mustChangePassword && !MUST_CHANGE_ALLOWED.includes(`${c.req.method} ${c.req.path}`)) {
    throw httpError('password_change_required');
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireUser(c, async () => {
    if (c.get('user')?.role !== 'admin') throw httpError('forbidden');
    await next();
  });
};
