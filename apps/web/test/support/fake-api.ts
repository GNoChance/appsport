import type { SyncEngine, SyncState, SyncTrigger } from '../../src/sync/engine';
import type { SyncTransport } from '../../src/sync/transport';

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
  init: RequestInit;
}

export type FakeReply = { status: number; body?: unknown; headers?: Record<string, string> };
type FakeHandler = ((r: FakeRequest) => FakeReply | Promise<FakeReply>) | FakeReply;

export interface FakeApi {
  transport: SyncTransport;
  calls: FakeRequest[];
  on(method: string, pattern: string /* '/api/gyms/:id' */, h: FakeHandler): FakeApi;
  setOffline(mode: false | 'reject' | 'hang'): void;
}

interface Route {
  method: string;
  regex: RegExp;
  handler: FakeHandler;
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}$`);
}

/** Faux serveur HTTP : routes déclarées par les tests ; route inconnue → 404 { error: 'not_found' }. */
export function createFakeApi(): FakeApi {
  const routes: Route[] = [];
  const calls: FakeRequest[] = [];
  let offline: false | 'reject' | 'hang' = false;

  const transport: SyncTransport = {
    async fetch(url, init) {
      const [path = '', qs = ''] = url.split('?');
      const method = init.method ?? 'GET';
      let body: unknown;
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = init.body;
        }
      }
      const req: FakeRequest = {
        method,
        path,
        query: new URLSearchParams(qs),
        body,
        headers: new Headers(init.headers),
        init,
      };
      calls.push(req);
      if (offline === 'hang') return new Promise<Response>(() => {});
      if (offline === 'reject') throw new TypeError('Failed to fetch');
      // Dernière déclaration prioritaire : un test peut remplacer une route.
      const route = [...routes].reverse().find((r) => r.method === method && r.regex.test(path));
      const reply: FakeReply = route
        ? typeof route.handler === 'function'
          ? await route.handler(req)
          : route.handler
        : { status: 404, body: { error: 'not_found' } };
      const hasBody = reply.body !== undefined && reply.status !== 204 && reply.status !== 304;
      return new Response(hasBody ? JSON.stringify(reply.body) : null, {
        status: reply.status,
        headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...reply.headers },
      });
    },
  };

  const api: FakeApi = {
    transport,
    calls,
    on(method, pattern, handler) {
      routes.push({ method, regex: patternToRegex(pattern), handler });
      return api;
    },
    setOffline(mode) {
      offline = mode;
    },
  };
  return api;
}

export type FakeSyncEngine = SyncEngine & {
  set(p: Partial<SyncState>): void;
  triggers: SyncTrigger[];
  pullCount: number;
  started: boolean;
  /** Appels à `sessionOpened()`. */
  sessionsOpened: number;
};

/**
 * Moteur de synchro factice : enregistre les déclencheurs, état modifiable par `set`.
 * `sessionOpened()` remet `connection` à 'unknown', comme le moteur réel.
 */
export function createFakeSyncEngine(initial: Partial<SyncState> = {}): FakeSyncEngine {
  let state: SyncState = {
    connection: 'online',
    pending: 0,
    rejected: 0,
    lastPullOkAt: null,
    syncing: false,
    serverEpoch: null,
    ...initial,
  };
  const listeners = new Set<(s: SyncState) => void>();
  const engine: FakeSyncEngine = {
    triggers: [],
    pullCount: 0,
    started: false,
    sessionsOpened: 0,
    set(p) {
      state = { ...state, ...p };
      for (const fn of listeners) fn(state);
    },
    async syncNow(t) {
      engine.triggers.push(t);
    },
    async pullNow() {
      engine.pullCount += 1;
    },
    async flushBefore() {
      engine.triggers.push('coach');
    },
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    start() {
      engine.started = true;
      engine.triggers.push('launch');
    },
    stop() {
      engine.started = false;
    },
    sessionOpened() {
      engine.sessionsOpened += 1;
      engine.set({ connection: 'unknown' });
    },
  };
  return engine;
}
