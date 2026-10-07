import { SYNC_PROTOCOL, SyncOp } from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import type { AppDb, OutboxOp } from '../../src/local-db/db';
import { applyPulledRows } from '../../src/sync/apply-pull';
import { DEFAULT_NOW } from './render';

const newOpId = createMonotonicUuidV7(
  () => DEFAULT_NOW,
  (n) => crypto.getRandomValues(new Uint8Array(n)),
);

/**
 * Lignes au format du pull (camelCase, valeurs décodées : booléens, objets) écrites dans le
 * miroir `entity` par le même chemin que la synchro ; `deletedAt` vaut null par défaut.
 */
export async function seedMirror(db: AppDb, entity: string, rows: Record<string, unknown>[]): Promise<void> {
  await applyPulledRows(
    db,
    rows.map((row, i) => ({ entity, rev: i + 1, row: { deletedAt: null, ...row } })),
  );
}

/** `n` ops en attente de `userId` (patch de `dismissedAt` sur `sync_rejection` par défaut). */
export async function seedOutbox(
  db: AppDb,
  userId: string,
  n: number,
  entity = 'sync_rejection',
): Promise<OutboxOp[]> {
  const clientTs = new Date(DEFAULT_NOW).toISOString();
  const ops = Array.from({ length: n }, (_, i) =>
    SyncOp.parse({
      opId: newOpId(),
      userId,
      entity,
      id: `${userId}-row-${i + 1}`,
      kind: 'patch',
      fields: { dismissedAt: clientTs },
      clientTs,
      protocol: SYNC_PROTOCOL,
      attempts: 0,
    }),
  );
  await db.outbox.bulkAdd(ops);
  return ops;
}
