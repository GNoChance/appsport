import {
  ChangePasswordRequest,
  CodeRequest,
  LoginRequest,
  PASSWORD_MIN_ADMIN,
  ResetPasswordRequest,
} from '@appsport/contracts';
import { passwordLength, usernameKey, validatePassword } from '@appsport/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { writeStamp } from '../db/rev';
import type { AppDeps } from '../deps';
import { validClientIp } from '../http/client-ip';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import { COMMON_PASSWORDS } from './common-passwords';
import { authLimiters } from './limiter';
import { buildMe, storeNewPassword, verifyUserPassword } from './me';
import { hashPassword, needsRehash, verifyPassword } from './password-hash';
import { checkPasswordReset, consumePasswordReset } from './password-reset';
import { logSecurityEvent } from './security-log';
import {
  clearSessionCookie,
  createSession,
  requireUser,
  revokeSession,
  revokeSessions,
  setSessionCookie,
} from './session';

/** Vérifications de code et réinitialisations partagent le même compteur par IP (P-AUT-2). */
function limitResetAttempts(deps: AppDeps, ip: string | null): void {
  const verdict = authLimiters(deps).resetCheck.hit(ip);
  if (!verdict.allowed) throw httpError('rate_limited', { retryAfterS: verdict.retryAfterS });
}

/** Empreinte factice, calculée une fois par `deps` : égalise le temps d'un pseudo inconnu. */
const dummyHashes = new WeakMap<AppDeps, Promise<string>>();
function dummyHash(deps: AppDeps): Promise<string> {
  let hash = dummyHashes.get(deps);
  if (!hash) {
    hash = hashPassword('mot de passe factice', deps.config.argon2, deps.ids);
    dummyHashes.set(deps, hash);
  }
  return hash;
}

export function authRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/login', async (c) => {
    const body = await parseJson(c, LoginRequest);
    const ip = validClientIp(c);
    const key = usernameKey(body.username);
    const limiter = authLimiters(deps).login;

    const verdict = limiter.check(key, ip);
    if (!verdict.allowed) {
      await logSecurityEvent(deps.db, deps, {
        type: 'login_blocked',
        actorId: null,
        targetId: null,
        ip,
        outcome: 'blocked',
      });
      throw httpError('rate_limited', { retryAfterS: verdict.retryAfterS });
    }

    const user = await deps.db
      .selectFrom('user')
      .selectAll()
      .where('usernameKey', '=', key)
      .executeTakeFirst();
    const valid = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash(deps)));
    if (!user || !valid) {
      limiter.recordFailure(key, ip);
      await logSecurityEvent(deps.db, deps, {
        type: 'login_failed',
        actorId: null,
        targetId: user?.id ?? null,
        ip,
        outcome: 'failure',
      });
      throw httpError('invalid_credentials');
    }
    if (user.status === 'disabled') {
      await logSecurityEvent(deps.db, deps, {
        type: 'login_failed',
        actorId: null,
        targetId: user.id,
        ip,
        outcome: 'failure',
        details: { reason: 'disabled' },
      });
      throw httpError('account_disabled');
    }
    limiter.recordSuccess(key);

    if (needsRehash(user.passwordHash, deps.config.argon2)) {
      // Hors transaction ; ni password_changed_at ni storeNewPassword : les liens en attente restent valides (R-MDP-4).
      const passwordHash = await hashPassword(body.password, deps.config.argon2, deps.ids);
      await deps.db.updateTable('user').set({ passwordHash }).where('id', '=', user.id).execute();
    }

    const mustChangePassword = user.role === 'admin' && passwordLength(body.password) < PASSWORD_MIN_ADMIN;
    const { token } = await deps.db.transaction().execute(async (trx) => {
      const stamp = await writeStamp(trx, deps, user.id);
      await trx
        .updateTable('user')
        .set({ lastLoginAt: stamp.updatedAt, ...stamp })
        .where('id', '=', user.id)
        .execute();
      const session = await createSession(trx, deps, user.id, { mustChangePassword });
      await logSecurityEvent(trx, deps, {
        type: 'login_succeeded',
        actorId: user.id,
        targetId: user.id,
        ip,
        outcome: 'success',
      });
      return session;
    });
    setSessionCookie(c, deps, token);
    return c.json(await buildMe(deps.db, deps, user.id, { mustChangePassword }));
  });

  routes.post('/logout', requireUser, async (c) => {
    const user = c.get('user');
    const sessionId = c.get('sessionId');
    if (!user || !sessionId) throw httpError('unauthenticated');
    await deps.db.transaction().execute(async (trx) => {
      await revokeSession(trx, deps, sessionId, 'logout');
      await logSecurityEvent(trx, deps, {
        type: 'logout',
        actorId: user.id,
        targetId: user.id,
        ip: validClientIp(c),
        outcome: 'success',
      });
    });
    clearSessionCookie(c, deps);
    return c.body(null, 204);
  });

  routes.post('/logout-all', requireUser, async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    await deps.db.transaction().execute(async (trx) => {
      const count = await revokeSessions(trx, deps, user.id, 'logout_all');
      await logSecurityEvent(trx, deps, {
        type: 'logout_all',
        actorId: user.id,
        targetId: user.id,
        ip: validClientIp(c),
        outcome: 'success',
        details: { sessions: count },
      });
    });
    clearSessionCookie(c, deps);
    return c.body(null, 204);
  });

  routes.post('/password', requireUser, async (c) => {
    const user = c.get('user');
    const sessionId = c.get('sessionId');
    if (!user || !sessionId) throw httpError('unauthenticated');
    const body = await parseJson(c, ChangePasswordRequest);
    const ip = validClientIp(c);
    await verifyUserPassword(deps.db, deps, user, body.currentPassword, ip);
    const check = validatePassword(body.newPassword, {
      username: user.username,
      role: user.role,
      commonPasswords: COMMON_PASSWORDS,
    });
    if (!check.ok) throw httpError('password_rejected', { reason: check.reason });
    const passwordHash = await hashPassword(body.newPassword, deps.config.argon2, deps.ids);
    await deps.db.transaction().execute(async (trx) => {
      await storeNewPassword(trx, deps, user.id, passwordHash);
      await revokeSessions(trx, deps, user.id, 'password_change', sessionId);
      await trx.updateTable('session').set({ mustChangePassword: 0 }).where('id', '=', sessionId).execute();
      await logSecurityEvent(trx, deps, {
        type: 'password_changed',
        actorId: user.id,
        targetId: user.id,
        ip,
        outcome: 'success',
      });
    });
    return c.body(null, 204);
  });

  routes.post('/reset/check', async (c) => {
    limitResetAttempts(deps, validClientIp(c));
    const body = await parseJson(c, CodeRequest);
    return c.json(await checkPasswordReset(deps.db, deps, body.code));
  });

  routes.post('/reset', async (c) => {
    const ip = validClientIp(c);
    limitResetAttempts(deps, ip);
    const body = await parseJson(c, ResetPasswordRequest);
    const { userId, token } = await consumePasswordReset(deps, body, ip);
    setSessionCookie(c, deps, token);
    return c.json(await buildMe(deps.db, deps, userId));
  });

  return routes;
}
