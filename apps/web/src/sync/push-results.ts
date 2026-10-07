import type { PushResult } from '@appsport/contracts';
import type { AppDb, DeadletterEntry, OutboxOp } from '../local-db/db';
import { deleteMeta } from '../local-db/meta';

/** Issue à appliquer : un `duplicate` vaut son issue d'origine. */
export const effectiveStatus = (r: PushResult): 'applied' | 'applied_partial' | 'rejected' =>
  r.status === 'duplicate' ? (r.originalStatus ?? 'applied') : r.status;

export const deadletterOf = (
  op: OutboxOp,
  code: string | undefined,
  receivedAt: string,
): DeadletterEntry => ({
  opId: op.opId,
  userId: op.userId,
  entity: op.entity,
  id: op.id,
  code: code ?? 'unknown',
  detail: { kind: op.kind, fieldNames: Object.keys(op.fields).sort() },
  receivedAt,
});

/**
 * Résultats d'un lot de push, en une transaction : op acquittée retirée (serverRevSeen = rev si
 * présent, droppedFields → null, dropped → copie supprimée) ; op rejetée → deadletter puis retirée.
 * En fin de lot, une ligne rejetée jamais acceptée et sans autre op perd sa copie ; une ligne
 * présente déjà acceptée, ou avec d'autres ops, impose un pull complet (watermark retiré).
 * Une op sans résultat reste dans l'outbox.
 */
export async function applyPushResults(
  db: AppDb,
  batch: readonly OutboxOp[],
  results: readonly PushResult[],
  receivedAt: string,
): Promise<void> {
  const hasMirror = (entity: string) => db.mirrorNames.includes(entity);
  const byId = new Map(batch.map((o) => [o.opId, o]));
  const stores = [...new Set(batch.map((o) => o.entity))].filter(hasMirror).map((e) => db.mirror(e));
  await db.transaction('rw', [db.outbox, db.deadletter, db.meta, ...stores], async () => {
    const rejected: OutboxOp[] = [];
    for (const r of results) {
      const op = byId.get(r.opId);
      if (!op) continue;
      byId.delete(r.opId);
      await db.outbox.delete(op.opId);
      if (effectiveStatus(r) === 'rejected') {
        await db.deadletter.put(deadletterOf(op, r.code, receivedAt));
        rejected.push(op);
        continue;
      }
      if (!hasMirror(op.entity)) continue;
      const mirror = db.mirror(op.entity);
      if (r.dropped) {
        await mirror.delete(op.id);
        continue;
      }
      const row = await mirror.get(op.id);
      if (!row) continue;
      const updated = { ...row };
      if (r.rev !== undefined) updated.serverRevSeen = r.rev;
      for (const field of r.droppedFields ?? []) updated[field] = null;
      await mirror.put(updated);
    }
    let refetch = false;
    for (const op of rejected) {
      const row = hasMirror(op.entity) ? await db.mirror(op.entity).get(op.id) : undefined;
      if (!row) continue;
      const others = await db.outbox.where('[entity+id]').equals([op.entity, op.id]).count();
      if (row.serverRevSeen == null && others === 0) await db.mirror(op.entity).delete(op.id);
      else refetch = true;
    }
    if (refetch) await deleteMeta(db, 'watermark');
  });
}
