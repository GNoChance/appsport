import type { SwRequest, SwScope, SwWindowClient } from '../../src/sw/sw';

// Navigateur factice du service worker (Cache Storage, réseau, clients), en mémoire et déterministe.

const DEFAULT_ORIGIN = 'https://appsport.test';

interface StoredResponse {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
}

/** Clé de cache : URL absolue sans fragment ; un chemin se résout sur l'origine, comme dans un SW. */
function keyOf(request: RequestInfo | URL, origin: string): string {
  const url = new URL(typeof request === 'string' || request instanceof URL ? request : request.url, origin);
  url.hash = '';
  return url.href;
}

class FakeCache implements Cache {
  readonly #entries = new Map<string, StoredResponse>();
  readonly #origin: string;

  constructor(origin: string) {
    this.#origin = origin;
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

  /** Consomme le corps, comme `Cache.put`. */
  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const body = await response.arrayBuffer();
    this.#entries.set(keyOf(request, this.#origin), {
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

/** Cache Storage en mémoire ; `keys()` dans l'ordre de création ; `match` avec `cacheName` ne crée rien. */
export function createFakeCacheStorage(origin: string = DEFAULT_ORIGIN): CacheStorage {
  const caches = new Map<string, FakeCache>();
  return {
    async open(name) {
      let cache = caches.get(name);
      if (!cache) {
        cache = new FakeCache(origin);
        caches.set(name, cache);
      }
      return cache;
    },
    async has(name) {
      return caches.has(name);
    },
    async delete(name) {
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
}

/** Réseau coupé par défaut (`TypeError`, comme `fetch`), jusqu'au premier `setNetwork`. */
export function createFakeSwScope(
  o: { origin?: string; caches?: CacheStorage; clientUrls?: string[] } = {},
): FakeSwScope {
  const origin = o.origin ?? DEFAULT_ORIGIN;
  let network: Network = () => Promise.reject(new TypeError('Failed to fetch'));
  const scope: FakeSwScope = {
    origin,
    caches: o.caches ?? createFakeCacheStorage(origin),
    fetchLog: [],
    skipWaitingCalls: 0,
    claimCalls: 0,
    unregistered: false,
    navigations: [],
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
      const wasRegistered = !scope.unregistered;
      scope.unregistered = true;
      return wasRegistered;
    },
    async windowClients(): Promise<readonly SwWindowClient[]> {
      return (o.clientUrls ?? []).map((url) => ({
        url,
        navigate: async (to: string) => {
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
