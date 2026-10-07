import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';
import type { AppEnv } from '../app-env';
import type { Logger } from '../logger';

/** Une ligne par requête : méthode, route (motif, sans paramètres), statut, durée. Rien d'autre (P-LOG-2). */
export function requestLog(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now();
    await next();
    logger.info('request', {
      requestId: c.get('requestId'),
      method: c.req.method,
      route: routePath(c, -1),
      status: c.res.status,
      durationMs: Math.round(performance.now() - start),
    });
  };
}
