import { sql, type Transaction } from 'kysely';
import { assertNotLastAdmin } from '../admin/members';
import { logSecurityEvent } from '../auth/security-log';
import { nextRev } from '../db/rev';
import type { Database } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';

type Row = Record<string, unknown>;

/**
 * Les clés étrangères `ON DELETE SET NULL` vers `user` détachent les lignes sans nouvelle révision :
 * les miroirs des autres membres garderaient l'identifiant effacé. Pour chaque table synchronisée
 * (J, D, E) et chaque colonne concernée, on met la colonne à NULL avec une nouvelle révision.
 * `updated_by` n'est pas renseigné : l'auteur de l'écriture n'est pas l'utilisateur supprimé.
 */
async function detachMirroredReferences(trx: Transaction<Database>, deps: AppDeps, userId: string) {
  const fks = await sql<{ tbl: string; col: string }>`
    select m.name as tbl, f."from" as col
    from sqlite_schema m, pragma_foreign_key_list(m.name) f
    where m.type = 'table' and f."table" = 'user' and f."on_delete" = 'SET NULL'`.execute(trx);
  const now = deps.clock.now().toISOString();
  for (const { tbl, col } of fks.rows) {
    const rule = deps.entityRules[tbl];
    if (!rule || !['J', 'D', 'E'].includes(rule.syncClass)) continue;
    if (!rule.columns.includes('rev') || !rule.columns.includes('updated_at')) continue;
    const owner = rule.ownerColumn === null ? sql`1 = 1` : sql`${sql.ref(rule.ownerColumn)} != ${userId}`;
    const rows =
      await sql<Row>`select rowid as rid from ${sql.table(tbl)} where ${sql.ref(col)} = ${userId} and ${owner}`.execute(
        trx,
      );
    for (const { rid } of rows.rows) {
      const rev = await nextRev(trx);
      await sql`update ${sql.table(tbl)} set ${sql.ref(col)} = null, rev = ${rev}, updated_at = ${now} where rowid = ${rid}`.execute(
        trx,
      );
    }
  }
}

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
  await detachMirroredReferences(trx, deps, userId);
  await trx.deleteFrom('user').where('id', '=', userId).execute();
  await logSecurityEvent(trx, deps, {
    type: 'account_deleted',
    actorId: actor.actorId,
    targetId: userId,
    ip: actor.ip,
    outcome: 'success',
  });
}
