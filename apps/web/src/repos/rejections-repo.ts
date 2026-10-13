import type { AppServices } from '../app-services';
import { getMeta } from '../local-db/meta';
import { writeLocal } from '../sync/outbox';
import { currentUserId, ownedRows, text } from './rows';

export interface RejectionView {
  /** id de la ligne sync_rejection, ou 'local:<opId>' pour un rejet reçu au push (deadletter). */
  id: string;
  source: 'server' | 'local';
  opId: string;
  entity: string;
  rowId: string;
  code: string;
  detail: unknown;
  at: string;
}

export interface RejectionsRepo {
  list(): Promise<RejectionView[]>;
  count(): Promise<number>;
  dismiss(id: string): Promise<void>;
}

const LOCAL_PREFIX = 'local:';

export function createRejectionsRepo(s: AppServices): RejectionsRepo {
  const { db } = s;

  /**
   * Rejets serveur non écartés, puis rejets locaux (deadletter) que le serveur n'a pas enregistrés.
   * Une deadletter couverte par une ligne sync_rejection, même écartée (sur un autre appareil),
   * n'est pas affichée.
   */
  async function list(): Promise<RejectionView[]> {
    const userId = await currentUserId(db);
    if (userId === null) return [];
    const rows = (await ownedRows(db, 'sync_rejection', userId)).filter((r) => typeof r.opId === 'string');
    const covered = new Set(rows.map((r) => String(r.opId)));
    const server: RejectionView[] = rows
      .filter((r) => r.dismissedAt == null)
      .map((r) => ({
        id: r.id,
        source: 'server' as const,
        opId: String(r.opId),
        entity: text(r.entity) ?? '',
        rowId: text(r.rowId) ?? '',
        code: text(r.code) ?? '',
        detail: r.detailJson ?? null,
        at: text(r.createdAt) ?? '',
      }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const local: RejectionView[] = (await db.deadletter.where('userId').equals(userId).toArray())
      .filter((d) => !covered.has(d.opId))
      .map((d) => ({
        id: `${LOCAL_PREFIX}${d.opId}`,
        source: 'local' as const,
        opId: d.opId,
        entity: d.entity,
        rowId: d.id,
        code: d.code,
        detail: d.detail,
        at: d.receivedAt,
      }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.opId.localeCompare(b.opId));
    return [...server, ...local];
  }

  const dropDeadletter = (opId: string, userId: string) =>
    db.deadletter
      .where('opId')
      .equals(opId)
      .filter((d) => d.userId === userId)
      .delete();

  return {
    list,
    async count() {
      return (await list()).length;
    },
    /**
     * Rejet serveur : `dismissedAt` écrit par l'outbox (seule écriture J du socle) et deadletter de
     * même opId retirée, en une transaction. Rejet local : deadletter retirée. Puis synchro
     * « mutation », qui envoie l'op et met à jour les compteurs du moteur (l'intervalle de 60 s
     * voit l'op en attente).
     */
    async dismiss(id) {
      const userId = await currentUserId(db);
      if (userId === null) return;
      if (id.startsWith(LOCAL_PREFIX)) {
        await dropDeadletter(id.slice(LOCAL_PREFIX.length), userId);
      } else {
        // meta hors de la transaction : lu avant.
        const healthConsentActive = (await getMeta(db, 'me'))?.consents.health.active === true;
        const nowIso = () => new Date(s.now()).toISOString();
        const mirror = db.mirror('sync_rejection');
        const written = await db.transaction('rw', [db.outbox, mirror, db.deadletter], async () => {
          const row = await mirror.get(id);
          if (!row || row.ownerId !== userId) return false;
          await writeLocal(
            db,
            { entity: 'sync_rejection', id, kind: 'patch', fields: { dismissedAt: nowIso() } },
            { userId, now: nowIso, newOpId: s.newOpId, healthConsentActive },
          );
          if (typeof row.opId === 'string') await dropDeadletter(row.opId, userId);
          return true;
        });
        if (!written) return;
      }
      void s.sync.syncNow('mutation');
    },
  };
}
