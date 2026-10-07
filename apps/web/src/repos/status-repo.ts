import type { AppServices } from '../app-services';
import { getMeta, setMeta } from '../local-db/meta';
import { refreshCatalog } from '../sync/catalog';
import { pendingCount } from '../sync/outbox';
import { currentUserId, text } from './rows';

type PersistentStorage = Pick<StorageManager, 'persist' | 'persisted'>;

export interface StatusRepo {
  readinessInputs(): Promise<{
    catalogVersion: string | null;
    serverCatalogVersion: string | null;
    lastPullOkAt: string | null;
  }>;
  persistGranted(): Promise<boolean | null>;
  pendingCount(): Promise<number>;
  /** Synchro manuelle puis catalogue (bouton « Réessayer »). */
  retry(): Promise<void>;
  activeSessionId(): Promise<string | null>;
  /** Champ `file` du magasin `illustrations`, trié. */
  illustrationFiles(): Promise<string[]>;
  /**
   * Stockage persistant (navigator.storage par défaut) ; résultat écrit dans meta.persistGranted.
   * API absente, refus ou erreur → false. L'appelant vérifie isStandalone().
   */
  requestPersistentStorage(storage?: PersistentStorage): Promise<boolean>;
}

const defaultStorage = (): PersistentStorage | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator.storage;

async function askPersistence(storage: PersistentStorage | undefined): Promise<boolean> {
  if (typeof storage?.persist !== 'function') return false;
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return (await storage.persist()) === true;
  } catch {
    return false;
  }
}

export function createStatusRepo(s: AppServices): StatusRepo {
  const { db } = s;
  return {
    async readinessInputs() {
      return {
        catalogVersion: (await getMeta(db, 'catalogVersion')) ?? null,
        serverCatalogVersion: (await getMeta(db, 'serverCatalogVersion')) ?? null,
        lastPullOkAt: (await getMeta(db, 'lastPullOkAt')) ?? null,
      };
    },
    async persistGranted() {
      return (await getMeta(db, 'persistGranted')) ?? null;
    },
    async pendingCount() {
      const userId = await currentUserId(db);
      return userId === null ? 0 : pendingCount(db, userId);
    },
    async retry() {
      await s.sync.syncNow('manual');
      await refreshCatalog(db, s.transport);
    },
    async activeSessionId() {
      return (await getMeta(db, 'activeSessionId')) ?? null;
    },
    async illustrationFiles() {
      const rows: { file?: unknown }[] = await db.table('illustrations').toArray();
      return rows
        .map((r) => text(r.file))
        .filter((f): f is string => f !== null)
        .sort();
    },
    async requestPersistentStorage(storage = defaultStorage()) {
      const granted = await askPersistence(storage);
      await setMeta(db, 'persistGranted', granted);
      return granted;
    },
  };
}
