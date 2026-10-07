import { type HealthResponse, MIN_PROTOCOL, SYNC_PROTOCOL } from '@appsport/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { getServerMeta } from '../db/server-meta';
import type { AppDeps } from '../deps';

export function healthRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.get('/api/health', async (c) => {
    const base = {
      version: deps.config.version,
      protocol: SYNC_PROTOCOL,
      minProtocol: MIN_PROTOCOL,
      swKill: deps.config.swKillSwitch,
    };
    try {
      const meta = await getServerMeta(deps.db);
      const body: HealthResponse = { status: 'ok', db: 'ok', epoch: meta.serverEpoch, ...base };
      return c.json(body);
    } catch {
      const body: HealthResponse = { status: 'error', db: 'error', epoch: null, ...base };
      return c.json(body, 503);
    }
  });
  return routes;
}
