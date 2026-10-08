import type { SwRequest, SwScope, SwWindowClient } from '../../src/sw/sw';

// Navigateur factice du service worker (Cache Storage, réseau, clients), en mémoire et déterministe.

const DEFAULT_ORIGIN = 'https://appsport.test';

interface StoredResponse {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
}

/** Panne injectée : l'erreur à lever (QuotaExceededError…), ou `undefined` pour laisser faire. */
export type FakeFailure = Error | undefined;

export interface FakeCacheStorageOptions {
  /** 'https://appsport.test' par défaut. */
  origin?: string;
  /** `Cache.put` de `url` (absolue) dans `cacheName` : lève l'erreur rendue, sans rien écrire. */
  failPut?: (cacheName: string, url: string) => FakeFailure;
  /** `caches.delete(cacheName)` : rejette avec l'erreur rendue, sans rien supprimer. */
  failDelete?: (cacheName: string) => FakeFailure;
}

/** Erreur d'un stockage plein, comme celle des navigateurs. */
export const quotaExceeded = () => new DOMException('Quota exceeded', 'QuotaExceededError');

/** Clé de cache : URL absolue sans fragment ; un chemin se résout sur l'origine, comme dans un SW. */
function keyOf(request: RequestInfo | URL, origin: string): string {
  const url = new URL(typeof request === 'string' || request instanceof URL ? request : request.url, origin);
  url.hash = '';
  return url.href;
}

class FakeCache implements Cache {
  readonly #entries = new Map<string, StoredResponse>();
  readonly #origin: string;
  readonly #name: string;
  readonly #failPut: FakeCacheStorageOptions['failPut'];

  constructor(origin: string, name: string, failPut: FakeCacheStorageOptions['failPut']) {
    this.#origin = origin;
    this.#name = name;
    this.#failPut = failPut;
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const stored = this.#entries.get(keyOf(request, this.#origin));
    // Une réponse neuve à chaque lecture : le corps se relit autant de fois que voulu, comme un vrai cache.
    return stored && new Response(stored.body.slice(0), stored);
  }

  async matchAll(request?: RequestInfo | URL): Promise<readonly Response[]> {
    if (request !== undefined) {
      const one = await this.match(request);
      return one ? [one] : [];
    }
    return [...this.#entries.values()].map((s) => new Response(s.body.slice(0), s));
  }

  async keys(): Promise<readonly Request[]> {
    return [...this.#entries.keys()].map((url) => new Request(url));
  }

  /** Consomme le corps, comme `Cache.put` ; un corps illisible ou une panne injectée n'écrivent rien. */
  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const key = keyOf(request, this.#origin);
    const failure = this.#failPut?.(this.#name, key);
    if (failure) throw failure;
    const body = await response.arrayBuffer();
    this.#entries.set(key, {
      body,
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
    });
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.#entries.delete(keyOf(request, this.#origin));
  }

  async add(): Promise<void> {
    throw new Error('FakeCache.add : non utilisé par le SW');
  }

  async addAll(): Promise<void> {
    throw new Error('FakeCache.addAll : non utilisé par le SW');
  }
}

/**
 * Cache Storage en mémoire ; `keys()` dans l'ordre de création ; `match` avec `cacheName` ne crée rien.
 * `failPut` et `failDelete` simulent un stockage plein ou en panne.
 */
export function createFakeCacheStorage(o: FakeCacheStorageOptions = {}): CacheStorage {
  const origin = o.origin ?? DEFAULT_ORIGIN;
  const caches = new Map<string, FakeCache>();
  return {
    async open(name) {
      let cache = caches.get(name);
      if (!cache) {
        cache = new FakeCache(origin, name, o.failPut);
        caches.set(name, cache);
      }
      return cache;
    },
    async has(name) {
      return caches.has(name);
    },
    async delete(name) {
      const failure = o.failDelete?.(name);
      if (failure) throw failure;
      return caches.delete(name);
    },
    async keys() {
      return [...caches.keys()];
    },
    async match(request, options) {
      if (options?.cacheName !== undefined) return caches.get(options.cacheName)?.match(request);
      for (const cache of caches.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
}

type Network = (url: string, init?: RequestInit) => Promise<Response>;

export interface FakeSwScope extends SwScope {
  setNetwork(fn: Network): void;
  /** URL absolue de chaque appel à `fetch`, dans l'ordre. */
  fetchLog: string[];
  skipWaitingCalls: number;
  claimCalls: number;
  unregistered: boolean;
  /** URL de chaque `navigate` des fenêtres. */
  navigations: string[];
  /**
   * Effets dans l'ordre : 'unregister' une fois fait, 'cache-delete:<nom>' à l'appel et 'cache-deleted:<nom>'
   * une fois fait, 'navigate:<url>' à l'appel.
   */
  events: string[];
}

/**
 * Désenregistrement et suppression d'un cache se terminent à la tâche suivante, comme un aller-retour avec
 * le navigateur : un effet lancé sans être attendu se voit dans l'ordre de `events`.
 */
const nextTask = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Réseau coupé par défaut (`TypeError`, comme `fetch`), jusqu'au premier `setNetwork`. */
export function createFakeSwScope(
  o: { origin?: string; caches?: CacheStorage; clientUrls?: string[] } = {},
): FakeSwScope {
  const origin = o.origin ?? DEFAULT_ORIGIN;
  const storage = o.caches ?? createFakeCacheStorage({ origin });
  let network: Network = () => Promise.reject(new TypeError('Failed to fetch'));
  const scope: FakeSwScope = {
    origin,
    // Même stockage ; suppressions journalisées dans `events` à l'appel et une fois faites.
    caches: {
      open: (name) => storage.open(name),
      has: (name) => storage.has(name),
      keys: () => storage.keys(),
      match: (request, options) => storage.match(request, options),
      delete: async (name) => {
        scope.events.push(`cache-delete:${name}`);
        await nextTask();
        const deleted = await storage.delete(name);
        scope.events.push(`cache-deleted:${name}`);
        return deleted;
      },
    },
    fetchLog: [],
    skipWaitingCalls: 0,
    claimCalls: 0,
    unregistered: false,
    navigations: [],
    events: [],
    setNetwork(fn) {
      network = fn;
    },
    async fetch(input: SwRequest | string, init?: RequestInit) {
      const url = typeof input === 'string' ? new URL(input, origin).href : input.url;
      scope.fetchLog.push(url);
      return network(url, init);
    },
    async skipWaiting() {
      scope.skipWaitingCalls++;
    },
    async claimClients() {
      scope.claimCalls++;
    },
    async unregister() {
      await nextTask();
      scope.events.push('unregister');
      const wasRegistered = !scope.unregistered;
      scope.unregistered = true;
      return wasRegistered;
    },
    async windowClients(): Promise<readonly SwWindowClient[]> {
      return (o.clientUrls ?? []).map((url) => ({
        url,
        navigate: async (to: string) => {
          scope.events.push(`navigate:${to}`);
          scope.navigations.push(to);
          return null;
        },
      }));
    },
  };
  return scope;
}

/** Réseau qui sert `files` par chemin (200), et 404 pour tout le reste. */
export function staticNetwork(files: Record<string, string>): (url: string) => Promise<Response> {
  return async (url) => {
    const body = files[new URL(url).pathname];
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body);
  };
}

/** Promesse résolue à la main : `release()` la libère. */
export function deferred(): { promise: Promise<void>; release(): void } {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
