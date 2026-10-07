import type { Clock } from '../deps';
import type { DbExecutor } from './schema';

/** Prochaine révision globale ; à appeler dans la transaction qui écrit. */
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
