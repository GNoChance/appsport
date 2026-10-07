import type { Clock } from '../deps';
import type { DbExecutor } from './schema';

/**
 * Prochaine révision globale ; à appeler dans la transaction qui écrit.
 * Invariant dont dépend la pagination du pull : chaque écriture d'une ligne synchronisée prend son
 * propre rev neuf (une ligne, un rev), strictement croissant et jamais réutilisé ; les écritures étant
 * sérialisées par SQLite, toute ligne modifiée après un pull porte un rev supérieur au watermark rendu.
 * Le pull tolère des lignes partageant un rev (groupe gardé entier), mais ce n'est pas l'usage normal.
 */
export async function nextRev(trx: DbExecutor): Promise<number> {
  const row = await trx
    .updateTable('serverMeta')
    .set((eb) => ({ syncCounter: eb('syncCounter', '+', 1) }))
    .where('id', '=', 1)
    .returning('syncCounter')
    .executeTakeFirst();
  if (!row) throw new Error("server_meta absent : la base n'est pas initialisée.");
  return row.syncCounter;
}

export async function writeStamp(
  trx: DbExecutor,
  deps: { clock: Clock },
  actorId: string | null,
): Promise<{ rev: number; updatedAt: string; updatedBy: string | null }> {
  const rev = await nextRev(trx);
  return { rev, updatedAt: deps.clock.now().toISOString(), updatedBy: actorId };
}
