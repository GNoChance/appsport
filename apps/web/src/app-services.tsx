import type { MeResponse } from '@appsport/contracts';
import { liveQuery } from 'dexie';
import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ApiClient } from './api/client';
import type { AppDb } from './local-db/db';
import { getMeta } from './local-db/meta';
import { wipeUserData } from './local-db/wipe';
import type { SwStatus } from './sw/protocol';
import type { SyncEngine, SyncState } from './sync/engine';
import type { SyncTransport } from './sync/transport';

/** Dépendances de l'appli, injectées : réelles dans `main.tsx`, factices dans les tests. */
export interface AppServices {
  db: AppDb;
  api: ApiClient;
  sync: SyncEngine;
  transport: SyncTransport;
  now(): number;
  newOpId(): string;
  /** État du service worker (voyant « Prêt hors ligne ») ; null sans SW ou sans réponse. */
  swStatus(): Promise<SwStatus | null>;
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider(p: { services: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={p.services}>{p.children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices hors de ServicesProvider');
  return services;
}

export function useSyncState(): SyncState {
  const { sync } = useServices();
  return useSyncExternalStore(sync.subscribe, sync.getState);
}

/** Requête Dexie observée : `undefined` tant que le premier résultat n'est pas arrivé. */
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(
    () => {
      const subscription = liveQuery(query).subscribe({ next: setValue, error: () => {} });
      return () => subscription.unsubscribe();
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: dépendances de la requête fournies par l'appelant
    deps,
  );
  return value;
}

/** Utilisateur connu de l'appareil (`meta.me`) ; `loaded` faux tant que la base n'a pas répondu. */
export function useMeState(): { loaded: boolean; me: MeResponse | null } {
  const { db } = useServices();
  const state = useLive(async () => ({ me: (await getMeta(db, 'me')) ?? null }), [db]);
  return state ? { loaded: true, me: state.me } : { loaded: false, me: null };
}

export function useMe(): MeResponse | null {
  return useMeState().me;
}

/**
 * `410 account_deleted` (P-DRT-4) : base locale effacée, file comprise, puis écran de connexion.
 * Un effacement en échec n'empêche pas la navigation et ne rejette pas (appelé en `void`).
 */
export async function handleAccountDeleted(db: AppDb, navigate: (to: string) => void): Promise<void> {
  try {
    await wipeUserData(db, { keepOutbox: false });
  } catch {
    // Base locale inaccessible : le moteur de synchro l'effacera au prochain 410.
  } finally {
    navigate('/login?reason=account_deleted');
  }
}
