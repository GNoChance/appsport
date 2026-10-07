import { PushEnvelope, type PushResponse } from '@appsport/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireUser } from '../auth/session';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import { applyPush } from './push';

/** Monté sous /api/sync. */
export function syncRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireUser);

  routes.post('/push', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const { ops } = await parseJson(c, PushEnvelope);
    const body: PushResponse = { results: await applyPush(deps, user, ops) };
    return c.json(body);
  });

  return routes;
}
