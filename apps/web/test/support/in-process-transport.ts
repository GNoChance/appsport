import type { TestContext } from '@appsport/server/testing';
import type { SyncTransport } from '../../src/sync/transport';

export interface InProcessLogEntry {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Transport vers le vrai serveur en mémoire : ajoute le cookie courant et `Origin = appOrigin`,
 * et journalise chaque requête qui atteint le serveur (`body` JSON décodé, sinon undefined).
 */
export function inProcessTransport(
  ctx: TestContext,
  getCookie: () => string,
): SyncTransport & { log: InProcessLogEntry[] } {
  const log: InProcessLogEntry[] = [];
  return {
    log,
    async fetch(path, init) {
      const method = (init.method ?? 'GET').toUpperCase();
      const headers = new Headers(init.headers);
      const cookie = getCookie();
      if (cookie) headers.set('Cookie', cookie);
      headers.set('Origin', ctx.deps.config.appOrigin);
      const raw = typeof init.body === 'string' ? init.body : undefined;
      log.push({ method, path, body: raw === undefined ? undefined : (JSON.parse(raw) as unknown) });
      return ctx.app.request(path, { ...init, method, headers });
    },
  };
}
