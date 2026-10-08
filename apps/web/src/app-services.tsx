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
      // Requête enveloppée dans une fonction async : Dexie ne suit les lectures faites après un
      // `await` natif que si la fonction passée à liveQuery est elle-même async.
      const subscription = liveQuery(async () => query()).subscribe({ next: setValue, error: () => {} });
      return () => subscription.unsubscribe();
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: dépendances de la requête fournies par l'appelant
    deps,
  );
  return value;
}

export interface MeState {
  loaded: boolean;
  me: MeResponse | null;
}

const ME_NOT_LOADED: MeState = { loaded: false, me: null };

interface MeStore {
  subscribe(onChange: () => void): () => void;
  get(): MeState;
}

const meStores = new WeakMap<AppDb, MeStore>();

/**
 * Une seule requête observée sur `meta.me` par base : la garde et les écrans voient le même
 * utilisateur au même rendu (un écran qui navigue dès qu'il voit la nouvelle session ne devance
 * jamais la garde). Arrêtée avec son dernier abonné.
 */
function meStore(db: AppDb): MeStore {
  const known = meStores.get(db);
  if (known) return known;
  let snapshot = ME_NOT_LOADED;
  const listeners = new Set<() => void>();
  let subscription: { unsubscribe(): void } | null = null;
  const store: MeStore = {
    subscribe(onChange) {
      listeners.add(onChange);
      subscription ??= liveQuery(async () => (await getMeta(db, 'me')) ?? null).subscribe({
        next: (me) => {
          snapshot = { loaded: true, me };
          for (const fn of listeners) fn();
        },
        error: () => {},
      });
      return () => {
        listeners.delete(onChange);
        if (listeners.size > 0) return;
        subscription?.unsubscribe();
        subscription = null;
        snapshot = ME_NOT_LOADED;
      };
    },
    get: () => snapshot,
  };
  meStores.set(db, store);
  return store;
}

/** Utilisateur connu de l'appareil (`meta.me`) ; `loaded` faux tant que la base n'a pas répondu. */
export function useMeState(): MeState {
  const { db } = useServices();
  const store = meStore(db);
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useMe(): MeResponse | null {
  return useMeState().me;
}

/** Attente au plus de `whenSignedOut` : la requête observée répond en quelques millisecondes. */
const SIGNED_OUT_WAIT_MS = 2000;

/**
 * Résout quand la requête observée de `meta.me` (celle de la garde) ne voit plus d'utilisateur,
 * tout de suite si personne ne l'observe, au plus tard après `timeoutMs`. Une navigation faite
 * ensuite n'est pas renvoyée ailleurs par la garde encore sur l'ancien utilisateur (de
 * `/login?reason=account_deleted` vers l'accueil, puis vers `/login` sans la raison).
 */
export function whenSignedOut(db: AppDb, timeoutMs = SIGNED_OUT_WAIT_MS): Promise<void> {
  const store = meStores.get(db);
  if (!store || store.get().me === null) return Promise.resolve();
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const done = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    unsubscribe = store.subscribe(() => {
      if (store.get().me === null) done();
    });
  });
}

/**
 * `410 account_deleted` (P-DRT-4) : base locale effacée, file comprise, puis écran de connexion
 * « Ce compte a été supprimé », une fois que la garde ne voit plus l'utilisateur. Un effacement en
 * échec n'empêche pas la navigation et ne rejette pas (appelé en `void`).
 */
export async function handleAccountDeleted(db: AppDb, navigate: (to: string) => void): Promise<void> {
  try {
    await wipeUserData(db, { keepOutbox: false });
    await whenSignedOut(db);
  } catch {
    // Base locale inaccessible : le moteur de synchro l'effacera au prochain 410.
  } finally {
    navigate('/login?reason=account_deleted');
  }
}
