import {
  ILLUSTRATIONS_CACHE,
  LOCAL_DB_MARKER_CACHE,
  LOCAL_DB_MARKER_KEY,
  PRECACHE_GLOBAL,
  type PrecacheManifest,
  SHELL_CACHE_PREFIX,
} from './precache-manifest';
import type { PageToSw, SwStatus } from './protocol';

// Service worker maison (ADR 0001), compilé par `precachePlugin` en un script iife précédé du manifeste de
// précache (dist/sw.js). Lib DOM seulement : le SW ne voit le navigateur qu'à travers `SwScope`, que
// `installServiceWorker` branche sur le global réel et les tests sur `test/support/fake-sw-scope.ts`.
// Il n'ouvre jamais IndexedDB (R-PWA-4, R-PWA-6) : la version de la base locale passe par le marqueur
// `LOCAL_DB_MARKER_CACHE` de Cache Storage.

/** Noms des illustrations référencées (JSON) : entrée de ILLUSTRATIONS_CACHE, hors planIllustrationSync. */
export const REFERENCED_ILLUSTRATIONS_KEY = '/__sw/illustrations-referenced.json';

const ILLUSTRATIONS_PATH = '/illustrations/';
const ILLUSTRATIONS_CACHE_PREFIX = 'illustrations-';
const INDEX_PATH = '/index.html';
const HEALTH_PATH = '/api/health';
const HEALTH_TIMEOUT_MS = 4000;
const PARALLEL_DOWNLOADS = 4;
/** Une illustration (quelques Ko) : une connexion bloquée ne retient pas la file des synchros. */
const DOWNLOAD_TIMEOUT_MS = 30_000;
/** Reprises des illustrations manquantes au GET_STATUS : la première tout de suite, puis 2 s à 5 min (R-SYN-30). */
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 300_000;
/** Un seul segment, sans `/` ni `.` ou `..` isolés : l'URL reste sous /illustrations/. */
const SAFE_FILE_RE = /^[\w-]+(?:\.[\w-]+)*$/;

export type SwRequest = { url: string; method: string; mode: string };

export interface SwWindowClient {
  url: string;
  navigate(url: string): Promise<unknown>;
}

export interface SwScope {
  origin: string;
  caches: CacheStorage;
  fetch(input: SwRequest | string, init?: RequestInit): Promise<Response>;
  skipWaiting(): Promise<void>;
  claimClients(): Promise<void>;
  unregister(): Promise<boolean>;
  windowClients(): Promise<readonly SwWindowClient[]>;
}

export interface SwHandlers {
  install(): Promise<void>;
  activate(): Promise<void>;
  /** `null` : pas de `respondWith`, la requête va au réseau sans le SW. */
  handleFetch(r: SwRequest): Promise<Response> | null;
  handleMessage(msg: PageToSw, port: MessagePort | null): Promise<void>;
  status(): Promise<SwStatus>;
  syncIllustrations(files: readonly string[]): Promise<void>;
  checkKillSwitch(): Promise<boolean>;
}

/** Caches `shell-*` des autres builds (R-PWA-4) ; illustrations, marqueur et caches inconnus restent. */
export function cachesToDelete(names: readonly string[], buildHash: string): string[] {
  const current = SHELL_CACHE_PREFIX + buildHash;
  return names.filter((name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== current);
}

/** Référencées absentes du cache à télécharger, en cache non référencées à supprimer (R-SYN-32). */
export function planIllustrationSync(
  referenced: readonly string[],
  cached: readonly string[],
): { toFetch: string[]; toDelete: string[] } {
  const wanted = new Set(referenced);
  const present = new Set(cached);
  return {
    toFetch: [...wanted].filter((f) => !present.has(f)),
    toDelete: [...present].filter((f) => !wanted.has(f)),
  };
}

const isApi = (path: string) => path === '/api' || path.startsWith('/api/');
const illustrationPath = (file: string) => ILLUSTRATIONS_PATH + file;
/** Noms valides (l'URL reste sous /illustrations/) et distincts : une illustration partagée compte une fois. */
const referencedList = (files: readonly unknown[]): string[] => [
  ...new Set(files.filter((f): f is string => typeof f === 'string' && SAFE_FILE_RE.test(f))),
];

/** Au plus `limit` appels de `fn` en cours ; les workers se partagent un seul itérateur. */
async function forEachLimited<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = items.values();
  const worker = async () => {
    for (const item of queue) await fn(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * `run` borné à `ms` : à l'échéance, la requête est annulée et `fallback` rendu, même si elle ignore
 * l'annulation. AbortController et minuteur plutôt qu'`AbortSignal.timeout` (absent de Safari avant la 16).
 * `run` ne doit pas rejeter.
 */
async function withDeadline<T>(
  ms: number,
  fallback: T,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

export function createSwHandlers(scope: SwScope, manifest: PrecacheManifest): SwHandlers {
  const shellCache = SHELL_CACHE_PREFIX + manifest.buildHash;
  const shellFiles = new Set(manifest.files);
  let syncQueue: Promise<unknown> = Promise.resolve();
  let syncsPending = 0;
  /**
   * Dernière liste reçue par ce SW : elle fait foi dès son arrivée, avant même d'être enregistrée (synchro en
   * file, écriture refusée par un stockage plein). Perdue au redémarrage du SW : la liste enregistrée prend
   * le relais, et la page la renvoie à chaque démarrage (T37).
   */
  let latestReferenced: string[] | null = null;
  /** Délai de la prochaine reprise au GET_STATUS (0 : immédiate) et instant avant lequel elle attend. */
  let retryDelay = 0;
  let retryNotBefore = 0;
  /** Change à chaque liste reçue : une reprise lancée avant ne touche plus au délai. */
  let listGeneration = 0;

  // `caches.match` avec `cacheName` ne crée pas le cache, contrairement à `caches.open`.
  const fromShell = (path: string) => scope.caches.match(path, { cacheName: shellCache });

  async function readMarker(): Promise<number | null> {
    const res = await scope.caches.match(LOCAL_DB_MARKER_KEY, { cacheName: LOCAL_DB_MARKER_CACHE });
    if (!res) return null;
    const version = Number(await res.text());
    return Number.isSafeInteger(version) ? version : null;
  }

  async function install(): Promise<void> {
    // ADR 0001 décision 5 : un build de schéma plus ancien que la base de l'appareil n'atteint jamais l'attente.
    const marker = await readMarker();
    if (marker !== null && marker > manifest.localDbVersion) {
      throw new Error(`localDbVersion ${manifest.localDbVersion} inférieure au marqueur ${marker}`);
    }
    // Tout télécharger, corps compris, avant d'écrire : un fichier en échec, même au milieu de son corps,
    // ne laisse pas de coquille partielle. La copie perd aussi `redirected`, refusé pour une navigation.
    const responses = await Promise.all(
      manifest.files.map(async (file) => {
        const res = await scope.fetch(file, { cache: 'reload' });
        if (!res.ok) throw new Error(`précache de ${file} : HTTP ${res.status}`);
        return { file, res: new Response(await res.arrayBuffer(), res) };
      }),
    );
    // Un SW qui ne change que sw.js garde le buildHash : son cache est alors celui du SW actif, qu'une
    // écriture en échec ne doit jamais supprimer. Seul un cache créé par cette installation est retiré.
    const created = !(await scope.caches.has(shellCache));
    const cache = await scope.caches.open(shellCache);
    const writes = await Promise.allSettled(responses.map(({ file, res }) => cache.put(file, res)));
    const failed = writes.find((w) => w.status === 'rejected');
    if (failed) {
      if (created) await scope.caches.delete(shellCache);
      throw failed.reason;
    }
    // Mode prompt (R-PWA-2) : pas de skipWaiting ici, seulement sur le message SKIP_WAITING.
  }

  async function activate(): Promise<void> {
    const stale = cachesToDelete(await scope.caches.keys(), manifest.buildHash);
    await Promise.all(stale.map((name) => scope.caches.delete(name)));
    await scope.caches.open(ILLUSTRATIONS_CACHE);
    // Marqueur écrit avant que la page de ce build ne tourne, jamais abaissé (ADR 0001 décision 5).
    const marker = await readMarker();
    if (marker === null || marker < manifest.localDbVersion) {
      const meta = await scope.caches.open(LOCAL_DB_MARKER_CACHE);
      await meta.put(LOCAL_DB_MARKER_KEY, new Response(String(manifest.localDbVersion)));
    }
    await scope.claimClients();
  }

  async function fromShellOrNetwork(r: SwRequest, path: string): Promise<Response> {
    return (await fromShell(path)) ?? scope.fetch(r);
  }

  async function illustration(r: SwRequest, path: string): Promise<Response> {
    const cached = await scope.caches.match(path, { cacheName: ILLUSTRATIONS_CACHE });
    if (cached) return cached;
    const res = await scope.fetch(r);
    if (res.status === 200) {
      try {
        await (await scope.caches.open(ILLUSTRATIONS_CACHE)).put(path, res.clone());
      } catch {
        // Cache plein ou indisponible : l'image s'affiche quand même.
      }
    }
    return res;
  }

  function handleFetch(r: SwRequest): Promise<Response> | null {
    if (r.method !== 'GET') return null;
    const url = new URL(r.url);
    // /api/* jamais intercepté, navigations comprises (GET /api/me/export, R-EXP-1).
    if (url.origin !== scope.origin || isApi(url.pathname)) return null;
    // R-PWA-8, ADR 0001 décision 4 : coquille du build courant d'abord, réseau seulement si index.html manque.
    if (r.mode === 'navigate') return fromShellOrNetwork(r, INDEX_PATH);
    if (url.pathname.startsWith(ILLUSTRATIONS_PATH)) return illustration(r, url.pathname);
    if (shellFiles.has(url.pathname)) return fromShellOrNetwork(r, url.pathname);
    return null;
  }

  async function readReferenced(): Promise<string[] | null> {
    const res = await scope.caches.match(REFERENCED_ILLUSTRATIONS_KEY, { cacheName: ILLUSTRATIONS_CACHE });
    if (!res) return null;
    try {
      const files: unknown = await res.json();
      return Array.isArray(files) ? referencedList(files) : null;
    } catch {
      return null;
    }
  }

  /** Liste que le statut et les reprises comptent : la dernière reçue, sinon celle enregistrée. */
  async function currentReferenced(): Promise<string[] | null> {
    return latestReferenced ?? (await readReferenced());
  }

  async function cachedIllustrations(cache: Cache): Promise<string[]> {
    return (await cache.keys())
      .map((request) => new URL(request.url).pathname)
      .filter((path) => path.startsWith(ILLUSTRATIONS_PATH));
  }

  async function saveReferenced(cache: Cache, referenced: readonly string[]): Promise<void> {
    const list = new Response(JSON.stringify(referenced), {
      headers: { 'Content-Type': 'application/json' },
    });
    try {
      await cache.put(REFERENCED_ILLUSTRATIONS_KEY, list);
    } catch {
      // Stockage plein : la liste en mémoire fait foi ; l'écriture est retentée à la prochaine synchro.
    }
  }

  /**
   * Échec ignoré (réseau, statut autre que 200, délai dépassé, stockage plein) : l'illustration reste
   * manquante et sera reprise au GET_STATUS. Le corps est lu dans le délai : une connexion qui cale au
   * milieu du corps est abandonnée aussi.
   */
  async function downloadIllustration(cache: Cache, path: string): Promise<boolean> {
    const response = await withDeadline(DOWNLOAD_TIMEOUT_MS, null, async (signal) => {
      try {
        const res = await scope.fetch(path, { signal });
        return res.status === 200 ? new Response(await res.arrayBuffer(), res) : null;
      } catch {
        return null;
      }
    });
    if (response === null) return false;
    try {
      await cache.put(path, response);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * `files` null : reprise sur la liste courante (après un échec ou un redémarrage du SW).
   * Rend le nombre d'illustrations restées manquantes.
   */
  async function runSync(files: readonly string[] | null): Promise<number> {
    const received = files ?? latestReferenced;
    const referenced = received ?? (await readReferenced());
    if (referenced === null) return 0;
    const cache = await scope.caches.open(ILLUSTRATIONS_CACHE);
    const plan = planIllustrationSync(referenced.map(illustrationPath), await cachedIllustrations(cache));
    // Suppressions d'abord : elles libèrent la place que la liste et les téléchargements vont prendre.
    await Promise.allSettled(plan.toDelete.map((path) => cache.delete(path)));
    if (received !== null) await saveReferenced(cache, received);
    let failed = 0;
    await forEachLimited(plan.toFetch, PARALLEL_DOWNLOADS, async (path) => {
      if (!(await downloadIllustration(cache, path))) failed++;
    });
    return failed;
  }

  /** Une synchro à la fois, dans l'ordre des demandes : la dernière liste reçue fait foi. */
  function enqueueSync(files: readonly string[] | null): Promise<number> {
    syncsPending++;
    const run = syncQueue.then(() => runSync(files)).finally(() => syncsPending--);
    syncQueue = run.catch(() => undefined);
    return run;
  }

  async function shellCached(): Promise<boolean> {
    const hits = await Promise.all(manifest.files.map(fromShell));
    return hits.every((hit) => hit !== undefined);
  }

  /** `referenced` null : aucune liste, inconnu et non vide (la page doit renvoyer la sienne). */
  async function illustrationsStatus(): Promise<{ missing: number; referenced: number | null }> {
    const referenced = await currentReferenced();
    if (referenced === null) return { missing: 0, referenced: null };
    if (!(await scope.caches.has(ILLUSTRATIONS_CACHE))) {
      return { missing: referenced.length, referenced: referenced.length };
    }
    const cache = await scope.caches.open(ILLUSTRATIONS_CACHE);
    const plan = planIllustrationSync(referenced.map(illustrationPath), await cachedIllustrations(cache));
    return { missing: plan.toFetch.length, referenced: referenced.length };
  }

  async function status(): Promise<SwStatus> {
    const [shell, illustrations] = await Promise.all([shellCached(), illustrationsStatus()]);
    return {
      type: 'STATUS',
      buildHash: manifest.buildHash,
      shellCached: shell,
      illustrationsMissing: illustrations.missing,
      illustrationsReferenced: illustrations.referenced,
      localDbVersion: manifest.localDbVersion,
    };
  }

  /**
   * La liste reçue fait foi tout de suite, même si une synchro la précède dans la file ; elle remet à zéro
   * le délai des reprises (R-SYN-32 : téléchargement après chaque mise à jour du catalogue).
   */
  function syncIllustrations(files: readonly string[]): Promise<void> {
    latestReferenced = referencedList(files);
    listGeneration++;
    retryDelay = 0;
    retryNotBefore = 0;
    return enqueueSync(latestReferenced).then(() => undefined);
  }

  /**
   * Reprise des manquantes : la première tout de suite, puis un délai doublé de 2 s à 5 min tant qu'il en
   * reste (R-SYN-30), pour qu'une illustration toujours en échec ne soit pas redemandée à chaque GET_STATUS.
   */
  async function retryMissing(): Promise<void> {
    const generation = listGeneration;
    let complete = false;
    try {
      complete = (await enqueueSync(null)) === 0;
    } finally {
      if (generation === listGeneration) {
        retryDelay = complete ? 0 : Math.min(Math.max(retryDelay * 2, RETRY_MIN_MS), RETRY_MAX_MS);
        retryNotBefore = complete ? 0 : Date.now() + retryDelay;
      }
    }
  }

  async function handleMessage(msg: PageToSw, port: MessagePort | null): Promise<void> {
    switch (msg.type) {
      case 'SKIP_WAITING':
        return scope.skipWaiting();
      case 'SYNC_ILLUSTRATIONS':
        return syncIllustrations(msg.files);
      case 'GET_STATUS': {
        const current = await status();
        port?.postMessage(current);
        // R-SYN-32 : les manquantes sont reprises en tâche de fond, après la réponse, dans le waitUntil.
        const due = syncsPending === 0 && Date.now() >= retryNotBefore;
        if (current.illustrationsMissing > 0 && due) await retryMissing();
        return;
      }
    }
  }

  /** `/api/health` en 4 s au plus, corps compris. */
  function killRequested(): Promise<boolean> {
    return withDeadline(HEALTH_TIMEOUT_MS, false, async (signal) => {
      try {
        const res = await scope.fetch(HEALTH_PATH, { cache: 'no-store', signal });
        // JSON lu quel que soit le statut ; seul `swKill === true` compte (pas de Zod dans le SW).
        const body: unknown = await res.json();
        return typeof body === 'object' && body !== null && 'swKill' in body && body.swKill === true;
      } catch {
        return false;
      }
    });
  }

  async function checkKillSwitch(): Promise<boolean> {
    if (!(await killRequested())) return false;
    // R-PWA-6 : désenregistrement, caches shell-* et illustrations-* vidés (ni IndexedDB ni le marqueur),
    // puis chaque fenêtre rechargée, depuis le réseau puisque plus aucun SW ne la sert.
    await scope.unregister();
    const doomed = (await scope.caches.keys()).filter(
      (name) => name.startsWith(SHELL_CACHE_PREFIX) || name.startsWith(ILLUSTRATIONS_CACHE_PREFIX),
    );
    await Promise.all(doomed.map((name) => scope.caches.delete(name)));
    const windows = await scope.windowClients();
    await Promise.allSettled(windows.map((client) => client.navigate(client.url)));
    return true;
  }

  return {
    install,
    activate,
    handleFetch,
    handleMessage,
    status,
    syncIllustrations,
    checkKillSwitch,
  };
}

export interface SwEvent {
  waitUntil(p: Promise<unknown>): void;
}

export interface SwFetchEvent extends SwEvent {
  request: SwRequest;
  respondWith(r: Promise<Response>): void;
}

export interface SwMessageEvent extends SwEvent {
  data: unknown;
  ports: readonly MessagePort[];
}

export interface SwGlobalLike {
  caches: CacheStorage;
  fetch: SwScope['fetch'];
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void>; matchAll(o: { type: 'window' }): Promise<readonly SwWindowClient[]> };
  registration: { unregister(): Promise<boolean> };
  location: { origin: string };
  [PRECACHE_GLOBAL]?: PrecacheManifest;
  addEventListener(t: 'install' | 'activate', fn: (e: SwEvent) => void): void;
  addEventListener(t: 'fetch', fn: (e: SwFetchEvent) => void): void;
  addEventListener(t: 'message', fn: (e: SwMessageEvent) => void): void;
}

/** Message de la page, validé à la main (pas de Zod dans le SW) ; `null` s'il est inconnu ou mal formé. */
function parsePageToSw(data: unknown): PageToSw | null {
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  switch (data.type) {
    case 'SKIP_WAITING':
      return { type: 'SKIP_WAITING' };
    case 'GET_STATUS':
      return { type: 'GET_STATUS' };
    case 'SYNC_ILLUSTRATIONS': {
      const files: unknown = 'files' in data ? data.files : undefined;
      if (!Array.isArray(files)) return null;
      const names = files.filter((f): f is string => typeof f === 'string');
      return names.length === files.length ? { type: 'SYNC_ILLUSTRATIONS', files: names } : null;
    }
    default:
      return null;
  }
}

export function installServiceWorker(g: SwGlobalLike, manifest: PrecacheManifest): void {
  const handlers = createSwHandlers(
    {
      origin: g.location.origin,
      caches: g.caches,
      fetch: (input, init) => g.fetch(input, init),
      skipWaiting: () => g.skipWaiting(),
      claimClients: () => g.clients.claim(),
      unregister: () => g.registration.unregister(),
      windowClients: () => g.clients.matchAll({ type: 'window' }),
    },
    manifest,
  );
  g.addEventListener('install', (e) => e.waitUntil(handlers.install()));
  g.addEventListener('activate', (e) => e.waitUntil(handlers.activate()));
  g.addEventListener('fetch', (e) => {
    const response = handlers.handleFetch(e.request);
    if (response === null) return;
    e.respondWith(response);
    // R-PWA-6 : interrupteur vérifié à chaque navigation, sans retarder la réponse.
    if (e.request.mode === 'navigate') e.waitUntil(handlers.checkKillSwitch());
  });
  g.addEventListener('message', (e) => {
    const msg = parsePageToSw(e.data);
    if (msg !== null) e.waitUntil(handlers.handleMessage(msg, e.ports[0] ?? null));
  });
}

// Amorçage sans effet de bord hors d'un service worker (page, tests) : dans sw.js, la ligne du manifeste
// a posé `self.__APPSPORT_PRECACHE__` avant ce code.
const g = globalThis as unknown as Partial<SwGlobalLike>;
const precache = g[PRECACHE_GLOBAL];
if (typeof g.skipWaiting === 'function' && 'registration' in g && precache) {
  installServiceWorker(g as SwGlobalLike, precache);
}
