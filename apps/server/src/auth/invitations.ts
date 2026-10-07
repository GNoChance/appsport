import {
  AcceptInvitationRequest,
  type CreateInvitationResponse,
  type InvitationCheckResponse,
  type InvitationState,
  type InvitationSummary,
  MIN_AGE,
  PRIVACY_POLICY_VERSION,
} from '@appsport/contracts';
import {
  ageOn,
  parisDate,
  parseSecretCode,
  usernameKey,
  validatePassword,
  validateUsername,
} from '@appsport/domain';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { COMMON_PASSWORDS } from './common-passwords';
import { hashPassword } from './password-hash';
import { createSecretCode, hashSecret } from './secret';
import { logSecurityEvent } from './security-log';
import { createSession } from './session';

const isUsernameConflict = (error: unknown): boolean =>
  error instanceof Error && /UNIQUE constraint failed: user\.username_key/.test(error.message);

/** used > revoked > expired > pending (R-INV-7). */
export function invitationState(
  row: { usedAt: string | null; revokedAt: string | null; expiresAt: string },
  now: Date,
): InvitationState {
  if (row.usedAt !== null) return 'used';
  if (row.revokedAt !== null) return 'revoked';
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

export function invitationLink(deps: AppDeps, formatted: string): string {
  return `${deps.config.appOrigin}/invite#${formatted}`;
}

const STATE_ERRORS = {
  used: 'invitation_used',
  revoked: 'invitation_revoked',
  expired: 'invitation_expired',
} as const;

/** Invitation à l'état `pending` pour ce code, sinon l'erreur d'API correspondante. */
async function loadPending(db: DbExecutor, deps: AppDeps, rawCode: string) {
  const canonical = parseSecretCode(rawCode);
  if (canonical === null) throw httpError('invitation_unknown');
  const row = await db
    .selectFrom('invitation')
    .select(['id', 'birthDate', 'isAdminBootstrap', 'expiresAt', 'usedAt', 'revokedAt'])
    .where('codeHash', '=', hashSecret(canonical))
    .executeTakeFirst();
  if (!row) throw httpError('invitation_unknown');
  const state = invitationState(row, deps.clock.now());
  if (state !== 'pending') throw httpError(STATE_ERRORS[state]);
  if (row.birthDate === null) throw httpError('invitation_unknown');
  return { id: row.id, birthDate: row.birthDate, isAdminBootstrap: row.isAdminBootstrap === 1 };
}

export async function createInvitation(
  trx: DbExecutor,
  deps: AppDeps,
  input: {
    birthDate: string;
    note: string | null;
    createdBy: string | null;
    isAdminBootstrap: boolean;
    ttlMs: number;
    ip: string | null;
  },
): Promise<CreateInvitationResponse> {
  const now = deps.clock.now();
  if (ageOn(input.birthDate, parisDate(now)) < MIN_AGE) throw httpError('under_min_age');
  const secret = createSecretCode(deps.ids);
  const id = deps.ids.uuidv7();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + input.ttlMs).toISOString();
  await trx
    .insertInto('invitation')
    .values({
      id,
      codeHash: secret.hash,
      note: input.note,
      birthDate: input.birthDate,
      isAdminBootstrap: input.isAdminBootstrap ? 1 : 0,
      createdBy: input.createdBy,
      createdAt,
      expiresAt,
    })
    .execute();
  await logSecurityEvent(trx, deps, {
    type: 'invitation_created',
    actorId: input.createdBy,
    targetId: null,
    ip: input.ip,
    outcome: 'success',
    details: { invitationId: id, bootstrap: input.isAdminBootstrap },
  });
  return {
    invitation: { id, note: input.note, createdAt, expiresAt, state: 'pending', usedByUsername: null },
    code: secret.formatted,
    link: invitationLink(deps, secret.formatted),
  };
}

export async function listInvitations(db: DbExecutor, deps: AppDeps): Promise<InvitationSummary[]> {
  const rows = await db
    .selectFrom('invitation')
    .leftJoin('user', 'user.id', 'invitation.usedBy')
    .select([
      'invitation.id',
      'invitation.note',
      'invitation.createdAt',
      'invitation.expiresAt',
      'invitation.usedAt',
      'invitation.revokedAt',
      'user.username as usedByUsername',
    ])
    .orderBy('invitation.createdAt', 'desc')
    .orderBy('invitation.id', 'desc')
    .execute();
  const now = deps.clock.now();
  return rows.map((r) => ({
    id: r.id,
    note: r.note,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    state: invitationState(r, now),
    usedByUsername: r.usedByUsername,
  }));
}

export async function revokeInvitation(
  trx: DbExecutor,
  deps: AppDeps,
  id: string,
  actor: { actorId: string; ip: string | null },
): Promise<void> {
  const row = await trx
    .selectFrom('invitation')
    .select(['usedAt', 'revokedAt', 'expiresAt'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) throw httpError('not_found');
  if (invitationState(row, deps.clock.now()) !== 'pending') throw httpError('conflict');
  await trx
    .updateTable('invitation')
    .set({ revokedAt: deps.clock.now().toISOString(), birthDate: null })
    .where('id', '=', id)
    .execute();
  await logSecurityEvent(trx, deps, {
    type: 'invitation_revoked',
    actorId: actor.actorId,
    targetId: null,
    ip: actor.ip,
    outcome: 'success',
    details: { invitationId: id },
  });
}

export async function checkInvitation(
  db: DbExecutor,
  deps: AppDeps,
  rawCode: string,
): Promise<InvitationCheckResponse> {
  const row = await loadPending(db, deps, rawCode);
  return { birthDate: row.birthDate, role: row.isAdminBootstrap ? 'admin' : 'member' };
}

/**
 * Création de compte (R-CPT-1, R-CPT-2). Les contrôles et le hachage Argon2 passent avant la
 * transaction : un refus ne consomme jamais l'invitation. Dans la transaction (BEGIN IMMEDIATE,
 * donc sérialisée), l'état est relu et la consommation est un UPDATE conditionnel : de deux
 * acceptations simultanées, une seule réussit.
 */
export async function acceptInvitation(
  deps: AppDeps,
  input: AcceptInvitationRequest,
  ip: string | null,
): Promise<{ userId: string; token: string }> {
  const parsed = AcceptInvitationRequest.safeParse(input);
  if (!parsed.success) throw httpError('validation');
  const { code, username, password, termsVersion } = parsed.data;
  if (termsVersion !== PRIVACY_POLICY_VERSION) throw httpError('validation', { field: 'termsVersion' });

  const invitation = await loadPending(deps.db, deps, code);
  const role = invitation.isAdminBootstrap ? 'admin' : 'member';
  const name = username.normalize('NFC');
  const nameCheck = validateUsername(name);
  if (!nameCheck.ok) throw httpError('username_invalid', { reason: nameCheck.reason });
  const passwordCheck = validatePassword(password, {
    username: name,
    role,
    commonPasswords: COMMON_PASSWORDS,
  });
  if (!passwordCheck.ok) throw httpError('password_rejected', { reason: passwordCheck.reason });
  const key = usernameKey(name);
  const usernameTaken = async (db: DbExecutor): Promise<boolean> =>
    (await db.selectFrom('user').select('id').where('usernameKey', '=', key).executeTakeFirst()) !==
    undefined;
  if (await usernameTaken(deps.db)) throw httpError('username_taken');
  const passwordHash = await hashPassword(password, deps.config.argon2, deps.ids);

  return deps.db.transaction().execute(async (trx) => {
    const current = await loadPending(trx, deps, code);
    if (await usernameTaken(trx)) throw httpError('username_taken');
    const userId = deps.ids.uuidv7();
    const now = deps.clock.now().toISOString();
    const stamp = await writeStamp(trx, deps, null);
    try {
      await trx
        .insertInto('user')
        .values({
          id: userId,
          username: name,
          usernameKey: key,
          passwordHash,
          role,
          birthDate: current.birthDate,
          termsVersion,
          termsAcceptedAt: now,
          lastLoginAt: now,
          passwordChangedAt: now,
          invitationId: current.id,
          createdAt: now,
          ...stamp,
        })
        .execute();
    } catch (error) {
      if (isUsernameConflict(error)) throw httpError('username_taken');
      throw error;
    }
    // Après le compte : invitation.used_by référence user(id) et les clés étrangères sont immédiates.
    const result = await trx
      .updateTable('invitation')
      .set({ usedAt: now, usedBy: userId, birthDate: null })
      .where('id', '=', current.id)
      .where('usedAt', 'is', null)
      .where('revokedAt', 'is', null)
      .executeTakeFirst();
    if (result.numUpdatedRows !== 1n) throw httpError('invitation_used');
    const session = await createSession(trx, deps, userId);
    await logSecurityEvent(trx, deps, {
      type: 'invitation_used',
      actorId: userId,
      targetId: userId,
      ip,
      outcome: 'success',
      details: { invitationId: current.id },
    });
    return { userId, token: session.token };
  });
}
