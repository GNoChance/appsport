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

  /** Rejets serveur non écartés, puis rejets locaux que le serveur n'a pas (encore) enregistrés. */
  async function list(): Promise<RejectionView[]> {
    const userId = await currentUserId(db);
    if (userId === null) return [];
    const server: RejectionView[] = (await ownedRows(db, 'sync_rejection', userId))
      .filter((r) => r.dismissedAt == null && typeof r.opId === 'string')
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
    const covered = new Set(server.map((r) => r.opId));
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
     * Rejet serveur : `dismissedAt` écrit par l'outbox (seule écriture J du socle), deadletter de
     * même opId retirée. Rejet local : deadletter retirée. Puis synchro « mutation », qui envoie
     * l'op et met à jour les compteurs du moteur (l'intervalle de 60 s voit l'op en attente).
     */
    async dismiss(id) {
      const userId = await currentUserId(db);
      if (userId === null) return;
      if (id.startsWith(LOCAL_PREFIX)) {
        await dropDeadletter(id.slice(LOCAL_PREFIX.length), userId);
      } else {
        const row = await db.mirror('sync_rejection').get(id);
        if (!row || row.ownerId !== userId) return;
        await writeLocal(
          db,
          {
            entity: 'sync_rejection',
            id,
            kind: 'patch',
            fields: { dismissedAt: new Date(s.now()).toISOString() },
          },
          {
            userId,
            now: () => new Date(s.now()).toISOString(),
            newOpId: s.newOpId,
            healthConsentActive: (await getMeta(db, 'me'))?.consents.health.active === true,
          },
        );
        if (typeof row.opId === 'string') await dropDeadletter(row.opId, userId);
      }
      void s.sync.syncNow('mutation');
    },
  };
}
