import { BOOTSTRAP_INVITATION_TTL_HOURS } from '@appsport/contracts';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { createInvitation } from './invitations';

const HOUR_MS = 3_600_000;

/**
 * Invitation d'amorçage du premier administrateur (R-ROLE-5) : une seule à la fois, valable 24 h.
 * Refusée dès qu'un administrateur existe.
 */
export async function bootstrapAdminInvitation(
  deps: AppDeps,
  birthDate: string,
): Promise<{ code: string; link: string; expiresAt: string }> {
  return deps.db.transaction().execute(async (trx) => {
    const admin = await trx.selectFrom('user').select('id').where('role', '=', 'admin').executeTakeFirst();
    if (admin) throw httpError('conflict', { reason: 'admin_exists' });
    const now = deps.clock.now().toISOString();
    await trx
      .updateTable('invitation')
      .set({ revokedAt: now, birthDate: null })
      .where('isAdminBootstrap', '=', 1)
      .where('usedAt', 'is', null)
      .where('revokedAt', 'is', null)
      .where('expiresAt', '>', now)
      .execute();
    const created = await createInvitation(trx, deps, {
      birthDate,
      note: null,
      createdBy: null,
      isAdminBootstrap: true,
      ttlMs: BOOTSTRAP_INVITATION_TTL_HOURS * HOUR_MS,
      ip: null,
    });
    return { code: created.code, link: created.link, expiresAt: created.invitation.expiresAt };
  });
}
