import { ADMIN_PASSWORD_REMINDER_MONTHS, type AgeBand, type MeResponse } from '@appsport/contracts';
import { ageBandOn, computeCautious, parisDate, usernameKey } from '@appsport/domain';
import type { SessionUser } from '../app-env';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { getConsentState, isHealthConsentActive } from '../privacy/consent-state';
import { authLimiters } from './limiter';
import { verifyPassword } from './password-hash';

/** Ajoute des mois calendaires en UTC ; le jour est ramené à la fin du mois cible si besoin. */
function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  target.setUTCHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return target;
}

/**
 * Point d'extension R-AGE-3 : tranche d'âge et mode prudent, seuls éléments d'âge exposés
 * aux autres briques (jamais `birthDate`).
 */
export async function userTraits(
  db: DbExecutor,
  deps: AppDeps,
  userId: string,
): Promise<{ ageBand: AgeBand; cautious: boolean }> {
  const user = await db
    .selectFrom('user')
    .select('birthDate')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  const profile = await db
    .selectFrom('trainingProfile')
    .select('cautiousMode')
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  const screening = await db
    .selectFrom('healthScreening')
    .select('caution')
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  const ageBand = ageBandOn(user.birthDate, parisDate(deps.clock.now()));
  const cautious = computeCautious({
    ageBand,
    cautiousMode: profile?.cautiousMode === 1,
    healthConsentActive: await isHealthConsentActive(db, userId),
    caution: screening?.caution == null ? null : screening.caution === 1,
  });
  return { ageBand, cautious };
}

export async function buildMe(
  db: DbExecutor,
  deps: AppDeps,
  userId: string,
  opts: { mustChangePassword?: boolean } = {},
): Promise<MeResponse> {
  const user = await db.selectFrom('user').selectAll().where('id', '=', userId).executeTakeFirstOrThrow();
  const { ageBand, cautious } = await userTraits(db, deps, userId);
  const reminderDue =
    user.role === 'admin' &&
    addMonths(user.passwordChangedAt ?? user.createdAt, ADMIN_PASSWORD_REMINDER_MONTHS).getTime() <=
      deps.clock.now().getTime();
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    birthDate: user.birthDate,
    ageBand,
    cautious,
    mustChangePassword: opts.mustChangePassword ?? false,
    passwordReminderDue: reminderDue,
    onboardingStep: user.onboardingStep,
    onboardingCompletedAt: user.onboardingCompletedAt,
    termsVersion: user.termsVersion,
    consents: await getConsentState(db, userId),
  };
}

/**
 * Toute ressaisie du mot de passe passe par le limiteur de connexion du pseudo (P-AUT-5) :
 * bloqué → 429, faux → 401, juste → compteur consécutif remis à zéro.
 */
export async function verifyUserPassword(
  db: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  password: string,
  ip: string | null,
): Promise<void> {
  const limiter = authLimiters(deps).login;
  const key = usernameKey(user.username);
  const verdict = limiter.check(key, ip);
  if (!verdict.allowed) throw httpError('rate_limited', { retryAfterS: verdict.retryAfterS });
  const row = await db
    .selectFrom('user')
    .select('passwordHash')
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();
  if (!(await verifyPassword(password, row.passwordHash))) {
    limiter.recordFailure(key, ip);
    throw httpError('invalid_credentials');
  }
  limiter.recordSuccess(key);
}

/** Écrit le nouveau haché et annule les réinitialisations en attente (leurs liens ne valent plus). */
export async function storeNewPassword(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  passwordHash: string,
): Promise<void> {
  const stamp = await writeStamp(trx, deps, userId);
  await trx
    .updateTable('user')
    .set({ passwordHash, passwordChangedAt: stamp.updatedAt, ...stamp })
    .where('id', '=', userId)
    .execute();
  await trx
    .updateTable('passwordReset')
    .set({ cancelledAt: stamp.updatedAt })
    .where('userId', '=', userId)
    .where('usedAt', 'is', null)
    .where('cancelledAt', 'is', null)
    .execute();
}
