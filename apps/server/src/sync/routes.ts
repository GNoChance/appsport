import { PullQuery, type PullResponse, PushEnvelope, type PushResponse } from '@appsport/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireUser } from '../auth/session';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { parseJson, parseQuery } from '../http/validate';
import { protocolGuard } from './protocol-guard';
import { buildPull } from './pull';
import { applyPush } from './push';

/** Monté sous /api/sync ; la garde de protocole passe avant la session (426 avant 401). */
export function syncRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', protocolGuard);
  routes.use('*', requireUser);

  routes.post('/push', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const { ops } = await parseJson(c, PushEnvelope);
    const body: PushResponse = { results: await applyPush(deps, user, ops) };
    return c.json(body);
  });

  routes.get('/pull', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const { since, limit } = parseQuery(c, PullQuery);
    const body: PullResponse = await buildPull(deps, user, since ?? null, limit);
    return c.json(body);
  });

  return routes;
}
