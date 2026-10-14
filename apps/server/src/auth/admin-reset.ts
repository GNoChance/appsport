import type { ResetLinkResponse } from '@rune/contracts';
import { usernameKey } from '@rune/domain';
import { writeStamp } from '../db/rev';
import type { AppDeps } from '../deps';
import { createPasswordReset } from './password-reset';
import { logSecurityEvent } from './security-log';

export interface AdminResetResult extends ResetLinkResponse {
  username: string;
  /** Administrateur désactivé remis en service avant la création du lien. */
  reactivated: boolean;
}

/**
 * Secours de R-ROLE-5, lancé sur le serveur (`admin:reset <pseudo>`) : lien de réinitialisation de 24 h.
 * Un administrateur désactivé est d'abord réactivé (T45-F51) : l'accès à l'hôte vaut confiance totale, et
 * sans cela un admin unique désactivé ne pourrait plus jamais se connecter. Un membre désactivé le reste :
 * son lien est refusé à l'usage, comme avant. Pseudo inconnu (ou compte supprimé) : null.
 */
export async function adminReset(deps: AppDeps, username: string): Promise<AdminResetResult | null> {
  return deps.db.transaction().execute(async (trx) => {
    const user = await trx
      .selectFrom('user')
      .select(['id', 'username', 'role', 'status'])
      .where('usernameKey', '=', usernameKey(username))
      .executeTakeFirst();
    if (!user) return null;
    const reactivated = user.role === 'admin' && user.status === 'disabled';
    if (reactivated) {
      const stamp = await writeStamp(trx, deps, null);
      await trx
        .updateTable('user')
        .set({ status: 'active', ...stamp })
        .where('id', '=', user.id)
        .execute();
      await logSecurityEvent(trx, deps, {
        type: 'status_changed',
        actorId: null,
        targetId: user.id,
        ip: null,
        outcome: 'success',
        details: { status: 'active' },
      });
    }
    const link = await createPasswordReset(trx, deps, user.id, { actorId: null, ip: null });
    return { ...link, username: user.username, reactivated };
  });
}
