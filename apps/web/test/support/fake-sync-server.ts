import { EPOCH_HEADER, type PulledRow, type PushResult, type SyncOp } from '@appsport/contracts';
import type { SyncTransport } from '../../src/sync/transport';

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  // biome-ignore lint/suspicious/noExplicitAny: corps lu librement par les tests
  body: any;
  headers: Headers;
}

export type FakeHandler = (req: FakeRequest) => Response | Promise<Response>;

export interface FakeSyncServer extends SyncTransport {
  epoch: string;
  /** Lignes servies par le pull par défaut (une seule page). */
  rows: PulledRow[];
  catalogVersion: string | null;
  healthConsentActive: boolean;
  /** Ops reçues par push, lot par lot. */
  sent: SyncOp[][];
  log: FakeRequest[];
  /** 'METHOD /chemin' de chaque requête, sans la chaîne de requête. */
  paths(): string[];
  /** Remplace une route (clé 'METHOD /chemin') ; `undefined` rend la route par défaut. */
  on(route: string, handler: FakeHandler | undefined): void;
  /** Tout appel sans réponse (transport muet) ou rejeté (TypeError) ; `null` rétablit. */
  fault: 'hang' | 'offline' | null;
  inFlight: number;
  maxInFlight: number;
  json(status: number, body: unknown, epoch?: string): Response;
}

export function createFakeSyncServer(epoch = 'E1'): FakeSyncServer {
  let rev = 100;
  const handlers = new Map<string, FakeHandler>();
  const server: FakeSyncServer = {
    epoch,
    rows: [],
    catalogVersion: null,
    healthConsentActive: true,
    sent: [],
    log: [],
    fault: null,
    inFlight: 0,
    maxInFlight: 0,
    paths: () => server.log.map((r) => `${r.method} ${r.path}`),
    on(route, handler) {
      if (handler) handlers.set(route, handler);
      else handlers.delete(route);
    },
    json(status, body, e = server.epoch) {
      return new Response(status === 304 ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', [EPOCH_HEADER]: e },
      });
    },
    async fetch(url, init) {
      const [path = '', qs = ''] = url.split('?');
      const method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const req: FakeRequest = {
        method,
        path,
        query: new URLSearchParams(qs),
        body,
        headers: new Headers(init.headers),
      };
      server.log.push(req);
      if (server.fault === 'hang') return new Promise<Response>(() => {});
      if (server.fault === 'offline') throw new TypeError('Failed to fetch');
      server.inFlight += 1;
      server.maxInFlight = Math.max(server.maxInFlight, server.inFlight);
      try {
        const route = `${method} ${path}`;
        const handler = handlers.get(route) ?? defaults[route];
        if (!handler) return server.json(404, { error: 'not_found' });
        return await handler(req);
      } finally {
        server.inFlight -= 1;
      }
    },
  };

  const defaults: Record<string, FakeHandler> = {
    'GET /api/health': () =>
      server.json(200, {
        status: 'ok',
        version: 'dev',
        db: 'ok',
        protocol: 1,
        minProtocol: 1,
        epoch: server.epoch,
        swKill: false,
      }),
    'POST /api/sync/push': (req) => {
      const ops = req.body.ops as SyncOp[];
      server.sent.push(ops);
      const results: PushResult[] = ops.map((o) => ({ opId: o.opId, status: 'applied', rev: ++rev }));
      return server.json(200, { results });
    },
    'GET /api/sync/pull': () =>
      server.json(200, {
        rows: server.rows,
        nextWatermark: `${server.epoch}:${rev}`,
        hasMore: false,
        catalogVersion: server.catalogVersion,
      }),
    'GET /api/me': () =>
      server.json(200, {
        consents: {
          health: { active: server.healthConsentActive, textVersion: 'v1', at: null },
          aiCoach: { active: false, textVersion: null, at: null },
        },
      }),
    'POST /api/me/consents/health/replay-withdraw': () => server.json(200, {}),
    'GET /api/catalog': () => server.json(304, null),
  };
  return server;
}
