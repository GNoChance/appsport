import {
  type MemberSummary,
  MIN_AGE,
  type Role,
  SESSION_IDLE_DAYS,
  type UserStatus,
} from '@appsport/contracts';
import { ageBandOn, ageOn, parisDate } from '@appsport/domain';
import { logSecurityEvent } from '../auth/security-log';
import { revokeSessions } from '../auth/session';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { getConsentState } from '../privacy/consent-state';

type AdminActor = { actorId: string; ip: string | null };

const DAY_MS = 86_400_000;

/**
 * Liste des membres (R-ADM-1) : aucune table C1 à C3, sauf `consent_event` (état des accords)
 * et `session` (comptage seul : non révoquées, non expirées, vues depuis moins de 90 jours).
 */
export async function listMembers(db: DbExecutor, deps: AppDeps): Promise<MemberSummary[]> {
  const now = deps.clock.now();
  const users = await db
    .selectFrom('user')
    .select(['id', 'username', 'role', 'status', 'birthDate', 'lastLoginAt', 'onboardingCompletedAt'])
    .orderBy('usernameKey')
    .execute();
  const counts = await db
    .selectFrom('session')
    .select(['userId', (eb) => eb.fn.countAll<number>().as('n')])
    .where('revokedAt', 'is', null)
    .where('expiresAt', '>', now.toISOString())
    .where('lastSeenAt', '>', new Date(now.getTime() - SESSION_IDLE_DAYS * DAY_MS).toISOString())
    .groupBy('userId')
    .execute();
  const active = new Map(counts.map((c) => [c.userId, Number(c.n)]));
  const today = parisDate(now);
  const members: MemberSummary[] = [];
  for (const u of users) {
    const consents = await getConsentState(db, u.id);
    members.push({
      id: u.id,
      username: u.username,
      role: u.role,
      status: u.status,
      isMinor: ageBandOn(u.birthDate, today) === 'minor',
      lastLoginAt: u.lastLoginAt,
      onboardingCompleted: u.onboardingCompletedAt !== null,
      consents: { health: consents.health.active, aiCoach: consents.aiCoach.active },
      activeSessions: active.get(u.id) ?? 0,
    });
  }
  return members;
}

async function assertExists(db: DbExecutor, id: string): Promise<void> {
  const row = await db.selectFrom('user').select('id').where('id', '=', id).executeTakeFirst();
  if (!row) throw httpError('not_found');
}

/**
 * Refuse de retirer le dernier administrateur actif (R-ROLE-2). À appeler dans la transaction
 * qui écrit : la lecture et l'écriture sont alors sérialisées.
 */
export async function assertNotLastAdmin(db: DbExecutor, targetId: string): Promise<void> {
  const target = await db
    .selectFrom('user')
    .select(['role', 'status'])
    .where('id', '=', targetId)
    .executeTakeFirst();
  if (!target) throw httpError('not_found');
  if (target.role !== 'admin' || target.status !== 'active') return;
  const other = await db
    .selectFrom('user')
    .select('id')
    .where('role', '=', 'admin')
    .where('status', '=', 'active')
    .where('id', '!=', targetId)
    .executeTakeFirst();
  if (!other) throw httpError('last_admin');
}

async function updateUser(
  trx: DbExecutor,
  deps: AppDeps,
  actorId: string,
  targetId: string,
  values: { role: Role } | { status: UserStatus } | { birthDate: string },
): Promise<void> {
  const stamp = await writeStamp(trx, deps, actorId);
  await trx
    .updateTable('user')
    .set({ ...values, ...stamp })
    .where('id', '=', targetId)
    .execute();
}

/** La vérification du mot de passe de l'admin (P-AUT-5) se fait avant, hors transaction (la route). */
export async function setRole(
  trx: DbExecutor,
  deps: AppDeps,
  actor: AdminActor,
  targetId: string,
  role: Role,
): Promise<void> {
  if (role === 'member') await assertNotLastAdmin(trx, targetId);
  else await assertExists(trx, targetId);
  await updateUser(trx, deps, actor.actorId, targetId, { role });
  await logSecurityEvent(trx, deps, {
    type: 'role_changed',
    actorId: actor.actorId,
    targetId,
    ip: actor.ip,
    outcome: 'success',
    details: { role },
  });
}

export async function setStatus(
  trx: DbExecutor,
  deps: AppDeps,
  actor: AdminActor,
  targetId: string,
  status: UserStatus,
): Promise<void> {
  if (status === 'disabled') await assertNotLastAdmin(trx, targetId);
  else await assertExists(trx, targetId);
  await updateUser(trx, deps, actor.actorId, targetId, { status });
  if (status === 'disabled') await revokeSessions(trx, deps, targetId, 'admin');
  await logSecurityEvent(trx, deps, {
    type: 'status_changed',
    actorId: actor.actorId,
    targetId,
    ip: actor.ip,
    outcome: 'success',
    details: { status },
  });
}

export async function setBirthDate(
  trx: DbExecutor,
  deps: AppDeps,
  actor: AdminActor,
  targetId: string,
  birthDate: string,
): Promise<void> {
  await assertExists(trx, targetId);
  if (ageOn(birthDate, parisDate(deps.clock.now())) < MIN_AGE) throw httpError('under_min_age');
  await updateUser(trx, deps, actor.actorId, targetId, { birthDate });
  await logSecurityEvent(trx, deps, {
    type: 'birth_date_corrected',
    actorId: actor.actorId,
    targetId,
    ip: actor.ip,
    outcome: 'success',
  });
}

export async function revokeMemberSessions(
  trx: DbExecutor,
  deps: AppDeps,
  actor: AdminActor,
  targetId: string,
): Promise<number> {
  await assertExists(trx, targetId);
  const count = await revokeSessions(trx, deps, targetId, 'admin');
  await logSecurityEvent(trx, deps, {
    type: 'sessions_revoked',
    actorId: actor.actorId,
    targetId,
    ip: actor.ip,
    outcome: 'success',
    details: { count },
  });
  return count;
}
