import type { HealthResponse } from '@appsport/contracts';
import { type AppDb, LOCAL_DB_VERSION } from '../local-db/db';
import { getMeta } from '../local-db/meta';
import type { StatusRepo } from '../repos/status-repo';
import type { SyncEngine, SyncState } from '../sync/engine';
import {
  applyKillSwitchIfNeeded,
  browserCaches,
  browserServiceWorker,
  type KillSwitchEnv,
} from './kill-switch';
import { LOCAL_DB_MARKER_CACHE, LOCAL_DB_MARKER_KEY } from './precache-manifest';
import type { PageToSw } from './protocol';
import { requestSwStatus } from './sw-client';

// Côté page du service worker (R-PWA-2 à R-PWA-6, ADR 0001) : enregistrement en mode prompt, recherche de
// mise à jour, SW en attente proposé ou non, SKIP_WAITING au clic, 426, et démarrage (interrupteur
// d'urgence, marqueur de base locale, liste des illustrations).

/** `ServiceWorker` vu de la page. */
export interface SwWorkerLike {
  state: string;
  postMessage(m: PageToSw, transfer?: Transferable[]): void;
  addEventListener(t: 'statechange', fn: () => void): void;
}

/** `ServiceWorkerRegistration` vu de la page. */
export interface SwRegistrationLike {
  waiting: SwWorkerLike | null;
  installing: SwWorkerLike | null;
  update(): Promise<unknown>;
  addEventListener(t: 'updatefound', fn: () => void): void;
}

/** `navigator.serviceWorker` vu de la page ; le vrai par défaut, factice dans les tests. */
export interface SwContainerLike {
  readonly controller: { postMessage(m: PageToSw): void } | null;
  register(url: string, o: { scope: string; updateViaCache: 'none' }): Promise<SwRegistrationLike>;
  getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]>;
  addEventListener(t: 'controllerchange', fn: () => void): void;
}

/** `available` : une version plus récente attend le clic ; `forced` : un 426 a été reçu (R-PWA-5). */
export interface UpdateState {
  available: boolean;
  forced: boolean;
}

export interface SwController {
  getState(): UpdateState;
  /** Appelé à chaque changement d'état seulement. */
  subscribe(fn: (s: UpdateState) => void): () => void;
  checkForUpdate(): Promise<void>;
  applyUpdate(): Promise<void>;
  markForced(): void;
}

export const SW_URL = '/sw.js';
/** Recherche de mise à jour périodique, quand la page est visible (R-PWA-2). */
export const UPDATE_INTERVAL_MS = 3_600_000;
/** Délai de réponse du SW en attente à GET_STATUS (ADR 0001 décision 5). */
const WAITING_STATUS_TIMEOUT_MS = 1000;

export const NO_UPDATE: UpdateState = Object.freeze({ available: false, forced: false });

/**
 * Bandeau de mise à jour (R-PWA-2, R-PWA-3, R-PWA-5) : jamais pendant une séance ni pendant l'onboarding,
 * même après un 426 ; fermable tant qu'aucun 426 n'a été reçu.
 */
export function shouldShowUpdateBanner(i: {
  available: boolean;
  forced: boolean;
  activeSessionId: string | null;
  onboardingInProgress: boolean;
}): { show: boolean; dismissible: boolean } {
  return {
    show: i.available && i.activeSessionId === null && !i.onboardingInProgress,
    dismissible: !i.forced,
  };
}

let publishedController: SwController | null = null;
const storeListeners = new Set<() => void>();

/** Contrôleur publié par `bootServiceWorker`, lu par le bandeau ; `null` sans enregistrement. */
export const swControllerStore = {
  get: (): SwController | null => publishedController,
  set(c: SwController | null): void {
    if (c === publishedController) return;
    publishedController = c;
    for (const fn of [...storeListeners]) fn();
  },
  subscribe(fn: () => void): () => void {
    storeListeners.add(fn);
    return () => {
      storeListeners.delete(fn);
    };
  },
};

/** Navigateur sans service worker (contexte non sécurisé, navigateur ancien) : jamais de mise à jour. */
function inertController(): SwController {
  return {
    getState: () => NO_UPDATE,
    subscribe: () => () => {},
    checkForUpdate: async () => {},
    applyUpdate: async () => {},
    markForced: () => {},
  };
}

/**
 * Enregistre `/sw.js` en mode prompt (R-PWA-2) et cherche une mise à jour au lancement, au retour au premier
 * plan, puis `intervalMs` après la dernière recherche tant que la page reste visible.
 *
 * Un SW en attente n'est proposé (`available`) que si la page est contrôlée et qu'il a répondu lui-même à
 * GET_STATUS en 1 s avec un `localDbVersion` au moins égal à celui de la page (R-PWA-9, ADR 0001
 * décision 5) : un SW muet ou de schéma plus ancien ne reçoit jamais SKIP_WAITING (R-DEP-4). Un SW muet est
 * redemandé à la recherche suivante.
 *
 * `applyUpdate` (R-PWA-4) envoie un seul SKIP_WAITING au SW proposé, sauf pendant une séance (R-PWA-3), et
 * la page ne se recharge qu'au `controllerchange` qui suit, une seule fois. Un `controllerchange` sans
 * clic (première installation, clic dans une autre fenêtre) ne recharge jamais.
 *
 * Un 426 (`protocol_unsupported`, R-VER-2) rend le bandeau non fermable et relance une recherche ; l'outbox
 * n'est pas touchée.
 */
export function registerServiceWorker(opts: {
  db: AppDb;
  sync: SyncEngine;
  intervalMs?: number;
  container?: SwContainerLike;
  reload?: () => void;
  doc?: Pick<Document, 'visibilityState' | 'addEventListener'>;
}): SwController {
  const container = opts.container ?? browserServiceWorker();
  if (!container) return inertController();
  const { db, sync } = opts;
  const intervalMs = opts.intervalMs ?? UPDATE_INTERVAL_MS;
  const doc = opts.doc ?? document;
  const reload = opts.reload ?? (() => window.location.reload());

  let state: UpdateState = NO_UPDATE;
  const listeners = new Set<(s: UpdateState) => void>();
  /** Seul destinataire possible de SKIP_WAITING : le SW en attente qui a répondu. */
  let offered: SwWorkerLike | null = null;
  let reloading = false;
  let reloaded = false;
  let evaluation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Réponse de chaque SW en attente : true (proposable), false (schéma plus ancien), null (muet). */
  const verdicts = new WeakMap<SwWorkerLike, Promise<boolean | null>>();
  const watched = new WeakSet<SwWorkerLike>();

  function setState(patch: Partial<UpdateState>): void {
    const next = { ...state, ...patch };
    if (next.available === state.available && next.forced === state.forced) return;
    state = next;
    for (const fn of [...listeners]) fn(state);
  }

  /** Tout changement d'état d'un SW (installé, remplacé, activé ailleurs) fait réévaluer l'attente. */
  function watch(worker: SwWorkerLike): void {
    if (watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => void reevaluate());
  }

  function verdictOf(worker: SwWorkerLike): Promise<boolean | null> {
    const known = verdicts.get(worker);
    if (known) return known;
    const verdict = requestSwStatus(worker, WAITING_STATUS_TIMEOUT_MS).then((status) =>
      status === null
        ? null
        : typeof status.localDbVersion === 'number' && status.localDbVersion >= LOCAL_DB_VERSION,
    );
    verdicts.set(worker, verdict);
    // Muet (réveil lent, panne) : redemandé à la prochaine évaluation.
    void verdict.then((v) => {
      if (v === null && verdicts.get(worker) === verdict) verdicts.delete(worker);
    });
    return verdict;
  }

  async function evaluate(reg: SwRegistrationLike): Promise<void> {
    const run = ++evaluation;
    const waiting = reg.waiting;
    let next: SwWorkerLike | null = null;
    // Sans contrôleur (première installation), il n'y a rien à mettre à jour.
    if (waiting && container?.controller) {
      watch(waiting);
      if ((await verdictOf(waiting)) === true && reg.waiting === waiting) next = waiting;
    }
    // Une évaluation plus récente (nouveau SW en attente entre-temps) l'emporte.
    if (run !== evaluation) return;
    offered = next;
    setState({ available: next !== null });
  }

  const registration: Promise<SwRegistrationLike | null> = Promise.resolve()
    .then(() => container.register(SW_URL, { scope: '/', updateViaCache: 'none' }))
    .then(
      (reg) => {
        reg.addEventListener('updatefound', () => {
          if (reg.installing) watch(reg.installing);
        });
        return reg;
      },
      // sw.js introuvable ou refusé : pas de mise à jour proposée, l'appli tourne quand même.
      () => null,
    );

  async function reevaluate(): Promise<void> {
    const reg = await registration;
    if (reg) await evaluate(reg);
  }

  function scheduleNext(): void {
    clearTimeout(timer);
    timer =
      doc.visibilityState === 'visible'
        ? setTimeout(() => {
            if (doc.visibilityState === 'visible') void checkForUpdate();
          }, intervalMs)
        : undefined;
  }

  async function checkForUpdate(): Promise<void> {
    scheduleNext();
    const reg = await registration;
    if (!reg) return;
    try {
      await reg.update();
    } catch {
      // Serveur injoignable : la recherche suivante réessaiera.
    }
    await evaluate(reg);
  }

  async function applyUpdate(): Promise<void> {
    const target = offered;
    if (reloading || !target) return;
    // R-PWA-3 : jamais pendant une séance, même avec le bandeau déjà affiché ; base illisible → rien.
    const inSession = await getMeta(db, 'activeSessionId').then(
      (id) => (id ?? null) !== null,
      () => true,
    );
    if (inSession || reloading || offered !== target) return;
    reloading = true;
    try {
      target.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      reloading = false;
    }
  }

  const controller: SwController = {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    checkForUpdate,
    applyUpdate,
    markForced: () => setState({ forced: true }),
  };

  container.addEventListener('controllerchange', () => {
    if (reloading) {
      if (!reloaded) {
        reloaded = true;
        reload();
      }
      return;
    }
    void reevaluate();
  });

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') {
      void checkForUpdate();
    } else {
      clearTimeout(timer);
      timer = undefined;
    }
  });

  // 426 (R-VER-2, R-PWA-5) : une fois par passage à protocol_unsupported.
  let unsupported = false;
  const onSync = (s: SyncState) => {
    const now = s.connection === 'protocol_unsupported';
    if (now && !unsupported) {
      controller.markForced();
      void checkForUpdate();
    }
    unsupported = now;
  };
  sync.subscribe(onSync);
  onSync(sync.getState());

  void checkForUpdate();
  return controller;
}

/**
 * Marqueur de base locale (ADR 0001 décision 5), après l'ouverture de Dexie : `max(marqueur, LOCAL_DB_VERSION)`,
 * jamais abaissé ; un marqueur illisible est remplacé. Un stockage plein ou absent n'arrête pas le démarrage
 * (le SW pose aussi le marqueur à son activation).
 */
export async function raiseLocalDbMarker(storage: CacheStorage | undefined = browserCaches()): Promise<void> {
  if (!storage) return;
  try {
    const current = await storage.match(LOCAL_DB_MARKER_KEY, { cacheName: LOCAL_DB_MARKER_CACHE });
    const version = current ? Number(await current.text()) : Number.NaN;
    if (Number.isSafeInteger(version) && version >= LOCAL_DB_VERSION) return;
    const meta = await storage.open(LOCAL_DB_MARKER_CACHE);
    await meta.put(LOCAL_DB_MARKER_KEY, new Response(String(LOCAL_DB_VERSION)));
  } catch {
    // Stockage plein ou indisponible : rien de plus à faire ici.
  }
}

async function markLocalDb(db: AppDb, storage: CacheStorage | undefined): Promise<void> {
  try {
    await db.open();
  } catch {
    // Base illisible : elle ne décrit rien qu'un marqueur doive protéger.
    return;
  }
  await raiseLocalDbMarker(storage);
}

/**
 * Démarrage du SW côté page, en production et sans retarder le premier rendu (appelé en `void`).
 * Sonde `/api/health` : `swKill` → interrupteur d'urgence (R-PWA-6) et arrêt **sans** enregistrer ; sinon
 * (`swKill` faux ou pas de réponse) enregistrement, contrôleur publié dans `swControllerStore`, puis liste des
 * illustrations (SYNC_ILLUSTRATIONS, R-SYN-32) au contrôleur, et de nouveau à chaque `controllerchange` :
 * le SW compte les illustrations sur la dernière liste reçue. En parallèle, marqueur de base locale une
 * fois Dexie ouverte. `killEnv` : navigateur factice des tests, Cache Storage du marqueur et rechargement
 * compris.
 */
export async function bootServiceWorker(o: {
  db: AppDb;
  status: Pick<StatusRepo, 'illustrationFiles'>;
  sync: SyncEngine;
  fetchHealth: () => Promise<HealthResponse | null>;
  container?: SwContainerLike;
  killEnv?: KillSwitchEnv;
}): Promise<void> {
  const env = o.killEnv ?? {};
  await Promise.all([markLocalDb(o.db, env.caches ?? browserCaches()), startWorker(o, env)]);
}

async function startWorker(o: Parameters<typeof bootServiceWorker>[0], env: KillSwitchEnv): Promise<void> {
  let health: HealthResponse | null = null;
  try {
    health = await o.fetchHealth();
  } catch {
    // Sonde en échec : comme sans réponse, on enregistre.
  }
  if (health?.swKill) {
    await applyKillSwitchIfNeeded(health, { ...env, serviceWorker: env.serviceWorker ?? o.container });
    return;
  }
  const container = o.container ?? browserServiceWorker();
  swControllerStore.set(registerServiceWorker({ db: o.db, sync: o.sync, container, reload: env.reload }));
  if (!container) return;

  async function sendIllustrations(): Promise<void> {
    if (!container?.controller) return;
    try {
      const files = await o.status.illustrationFiles();
      container.controller?.postMessage({ type: 'SYNC_ILLUSTRATIONS', files });
    } catch {
      // Base illisible ou SW parti : la liste suivante viendra du catalogue ou du prochain contrôleur.
    }
  }
  container.addEventListener('controllerchange', () => void sendIllustrations());
  await sendIllustrations();
}
