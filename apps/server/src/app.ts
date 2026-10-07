import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import { sessionMiddleware } from './auth/session';
import type { AppDeps } from './deps';
import { clientIp } from './http/client-ip';
import { epochHeader } from './http/epoch-header';
import { errorHandler } from './http/errors';
import { originGuard } from './http/origin-guard';
import { requestLog } from './http/request-log';
import { securityHeaders } from './http/security-headers';
import { mountRoutes } from './routes';

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('requestId', randomUUID());
    c.set('clientIp', clientIp(c));
    c.set('user', null);
    c.set('sessionId', null);
    await next();
  });
  app.use('*', requestLog(deps.logger));
  app.use('*', securityHeaders());
  app.use('/api/*', epochHeader(deps.db));
  app.use('*', originGuard(deps.config));
  app.use('/api/*', sessionMiddleware(deps));
  mountRoutes(app, deps);
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError(errorHandler(deps.logger));
  return app;
}
