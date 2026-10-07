import type { DbExecutor } from '../db/schema';
import type { Clock, IdGen } from '../deps';

/**
 * Nouvelle époque du serveur (après une restauration, R-SYN-25) : UUIDv7 neuf, base au compteur
 * courant (les lignes de rev ≤ base viennent de la sauvegarde), début à l'heure de la rotation.
 */
export async function rotateServerEpoch(
  db: DbExecutor,
  deps: { ids: IdGen; clock: Clock },
): Promise<{ epoch: string; baseRev: number }> {
  const row = await db
    .updateTable('serverMeta')
    .set((eb) => ({
      serverEpoch: deps.ids.uuidv7(),
      epochBaseRev: eb.ref('syncCounter'),
      epochStartedAt: deps.clock.now().toISOString(),
    }))
    .where('id', '=', 1)
    .returning(['serverEpoch', 'epochBaseRev'])
    .executeTakeFirst();
  if (!row) throw new Error("server_meta absent : la base n'est pas initialisée.");
  return { epoch: row.serverEpoch, baseRev: row.epochBaseRev };
}
