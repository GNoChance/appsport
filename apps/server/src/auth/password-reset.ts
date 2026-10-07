import {
  RESET_TTL_HOURS,
  type ResetCheckResponse,
  type ResetLinkResponse,
  type ResetPasswordRequest,
} from '@appsport/contracts';
import { parseSecretCode, validatePassword } from '@appsport/domain';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { COMMON_PASSWORDS } from './common-passwords';
import { authLimiters } from './limiter';
import { storeNewPassword } from './me';
import { hashPassword } from './password-hash';
import { createSecretCode, hashSecret } from './secret';
import { logSecurityEvent } from './security-log';
import { createSession, revokeSessions } from './session';

const HOUR_MS = 3_600_000;

/**
 * Crée un lien de réinitialisation valable 24 h et annule les liens en attente de la cible (R-RST-1).
 * Un administrateur ne peut pas en créer pour lui-même (R-RST-4) ; la CLI passe `actorId: null`.
 */
export async function createPasswordReset(
  trx: DbExecutor,
  deps: AppDeps,
  targetUserId: string,
  actor: { actorId: string | null; ip: string | null },
): Promise<ResetLinkResponse> {
  if (actor.actorId !== null && actor.actorId === targetUserId) throw httpError('reset_self_forbidden');
  const target = await trx.selectFrom('user').select('id').where('id', '=', targetUserId).executeTakeFirst();
  if (!target) throw httpError('not_found');
  const now = deps.clock.now();
  await trx
    .updateTable('passwordReset')
    .set({ cancelledAt: now.toISOString() })
    .where('userId', '=', targetUserId)
    .where('usedAt', 'is', null)
    .where('cancelledAt', 'is', null)
    .execute();
  const secret = createSecretCode(deps.ids);
  const expiresAt = new Date(now.getTime() + RESET_TTL_HOURS * HOUR_MS).toISOString();
  await trx
    .insertInto('passwordReset')
    .values({
      id: deps.ids.uuidv7(),
      userId: targetUserId,
      codeHash: secret.hash,
      createdBy: actor.actorId,
      createdAt: now.toISOString(),
      expiresAt,
    })
    .execute();
  await logSecurityEvent(trx, deps, {
    type: 'password_reset_created',
    actorId: actor.actorId,
    targetId: targetUserId,
    ip: actor.ip,
    outcome: 'success',
  });
  return { code: secret.formatted, link: `${deps.config.appOrigin}/reset#${secret.formatted}`, expiresAt };
}

/** Lien en attente (ni utilisé, ni annulé, ni expiré) et sa cible, sinon `reset_invalid`. */
async function loadValidReset(db: DbExecutor, deps: AppDeps, rawCode: string) {
  const canonical = parseSecretCode(rawCode);
  if (canonical === null) throw httpError('reset_invalid');
  const row = await db
    .selectFrom('passwordReset')
    .innerJoin('user', 'user.id', 'passwordReset.userId')
    .select([
      'passwordReset.id as resetId',
      'passwordReset.usedAt',
      'passwordReset.cancelledAt',
      'passwordReset.expiresAt',
      'user.id as userId',
      'user.username',
      'user.usernameKey',
      'user.role',
      'user.status',
    ])
    .where('passwordReset.codeHash', '=', hashSecret(canonical))
    .executeTakeFirst();
  if (
    !row ||
    row.usedAt !== null ||
    row.cancelledAt !== null ||
    new Date(row.expiresAt).getTime() <= deps.clock.now().getTime()
  ) {
    throw httpError('reset_invalid');
  }
  return row;
}

export async function checkPasswordReset(
  db: DbExecutor,
  deps: AppDeps,
  rawCode: string,
): Promise<ResetCheckResponse> {
  const row = await loadValidReset(db, deps, rawCode);
  return { username: row.username, role: row.role };
}

/**
 * Consomme le lien (R-RST-3). Contrôles et hachage Argon2 avant la transaction : un refus ne consomme
 * pas le lien. Dans la transaction, l'UPDATE conditionnel garantit un seul usage.
 */
export async function consumePasswordReset(
  deps: AppDeps,
  input: ResetPasswordRequest,
  ip: string | null,
): Promise<{ userId: string; token: string }> {
  const row = await loadValidReset(deps.db, deps, input.code);
  if (row.status === 'disabled') throw httpError('account_disabled');
  const check = validatePassword(input.newPassword, {
    username: row.username,
    role: row.role,
    commonPasswords: COMMON_PASSWORDS,
  });
  if (!check.ok) throw httpError('password_rejected', { reason: check.reason });
  const passwordHash = await hashPassword(input.newPassword, deps.config.argon2, deps.ids);

  const session = await deps.db.transaction().execute(async (trx) => {
    const now = deps.clock.now().toISOString();
    const used = await trx
      .updateTable('passwordReset')
      .set({ usedAt: now })
      .where('id', '=', row.resetId)
      .where('usedAt', 'is', null)
      .where('cancelledAt', 'is', null)
      .where('expiresAt', '>', now)
      .executeTakeFirst();
    if (used.numUpdatedRows !== 1n) throw httpError('reset_invalid');
    await storeNewPassword(trx, deps, row.userId, passwordHash);
    await revokeSessions(trx, deps, row.userId, 'password_reset');
    const created = await createSession(trx, deps, row.userId);
    await logSecurityEvent(trx, deps, {
      type: 'password_reset_used',
      actorId: row.userId,
      targetId: row.userId,
      ip,
      outcome: 'success',
    });
    return created;
  });
  authLimiters(deps).login.unlock(row.usernameKey);
  return { userId: row.userId, token: session.token };
}
