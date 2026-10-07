import type { PulledRow } from '@appsport/contracts';
import type { AppDb, MirrorRow } from '../local-db/db';

/**
 * Écrit les lignes tirées dans les miroirs, en une transaction (R-SYN-22) : la ligne serveur
 * remplace la copie, puis les ops en attente sur la même ligne sont rejouées dans l'ordre des
 * opId (patch → champs, delete → deletedAt ; un create en attente est ignoré). Entité sans miroir
 * ignorée.
 */
export async function applyPulledRows(db: AppDb, rows: PulledRow[]): Promise<void> {
  const known = rows.filter((r) => db.mirrorNames.includes(r.entity));
  if (known.length === 0) return;
  const stores = [...new Set(known.map((r) => r.entity))].map((e) => db.mirror(e));
  await db.transaction('rw', [db.outbox, ...stores], async () => {
    for (const { entity, rev, row } of known) {
      const merged = { ...row, serverRevSeen: rev } as MirrorRow;
      const pending = await db.outbox.where('[entity+id]').equals([entity, merged.id]).sortBy('opId');
      for (const op of pending) {
        if (op.kind === 'patch') Object.assign(merged, op.fields);
        else if (op.kind === 'delete') merged.deletedAt = op.clientTs;
      }
      await db.mirror(entity).put(merged);
    }
  });
}
