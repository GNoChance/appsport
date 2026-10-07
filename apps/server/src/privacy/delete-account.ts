import type { Transaction } from 'kysely';
import { assertNotLastAdmin } from '../admin/members';
import { logSecurityEvent } from '../auth/security-log';
import type { Database } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';

/**
 * Supprime le compte dans la transaction reçue (R-SUP-1 à R-SUP-6). Les sessions sont anonymisées
 * (410 pour leurs porteurs, puis purge) ; `gym_history` perd son auteur ; les clés étrangères
 * suppriment ou détachent le reste. `security_event` n'est jamais modifié.
 * `enforceLastAdmin: false` : réapplication des suppressions (privacy:reapply), où le dernier admin
 * peut avoir été supprimé après la sauvegarde.
 */
export async function deleteAccount(
  trx: Transaction<Database>,
  deps: AppDeps,
  userId: string,
  actor: { actorId: string | null; ip: string | null },
  opts: { enforceLastAdmin?: boolean } = {},
): Promise<void> {
  const user = await trx.selectFrom('user').select('id').where('id', '=', userId).executeTakeFirst();
  if (!user) throw httpError('not_found');
  if (opts.enforceLastAdmin !== false) await assertNotLastAdmin(trx, userId);

  const now = deps.clock.now().toISOString();
  await trx
    .updateTable('session')
    .set((eb) => ({
      userId: null,
      revokedReason: 'account_deleted',
      revokedAt: eb.fn.coalesce('revokedAt', eb.val(now)),
    }))
    .where('userId', '=', userId)
    .execute();
  await trx.updateTable('gymHistory').set({ authorId: null }).where('authorId', '=', userId).execute();
  await trx.deleteFrom('user').where('id', '=', userId).execute();
  await logSecurityEvent(trx, deps, {
    type: 'account_deleted',
    actorId: actor.actorId,
    targetId: userId,
    ip: actor.ip,
    outcome: 'success',
  });
}
