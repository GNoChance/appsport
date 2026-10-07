import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireUser } from '../auth/session';
import type { AppDeps } from '../deps';
import { getLoadedCatalog, loadCatalog } from './loader';

const etagMatches = (header: string | undefined, etag: string): boolean =>
  (header ?? '')
    .split(',')
    .map((v) => v.trim().replace(/^W\//, ''))
    .includes(etag);

/** Monté sous /api/catalog : le catalogue complet, validé par ETag = version. */
export function catalogRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireUser);

  routes.get('/', async (c) => {
    const bundle = getLoadedCatalog(deps) ?? (await loadCatalog(deps));
    const etag = `"${bundle.version}"`;
    c.header('ETag', etag);
    c.header('Cache-Control', 'no-cache');
    if (etagMatches(c.req.header('If-None-Match'), etag)) return c.body(null, 304);
    return c.json(bundle);
  });

  return routes;
}
