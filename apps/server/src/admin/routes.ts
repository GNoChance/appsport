import { SetBirthDateRequest, SetRoleRequest, SetStatusRequest } from '@appsport/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { verifyUserPassword } from '../auth/me';
import { createPasswordReset } from '../auth/password-reset';
import { requireAdmin } from '../auth/session';
import type { AppDeps } from '../deps';
import { validClientIp } from '../http/client-ip';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import { listMembers, revokeMemberSessions, setBirthDate, setRole, setStatus } from './members';
import { readOpsStatus } from './ops-status';

export function adminRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireAdmin);

  routes.get('/members', async (c) => c.json(await listMembers(deps.db, deps)));

  routes.get('/ops-status', async (c) =>
    c.json({ version: deps.config.version, opsStatus: await readOpsStatus(deps.config.dataDir) }),
  );

  const actorOf = (c: Parameters<typeof validClientIp>[0]) => {
    const admin = c.get('user');
    if (!admin) throw httpError('unauthenticated');
    return { admin, actor: { actorId: admin.id, ip: validClientIp(c) } };
  };

  routes.post('/members/:id/reset-link', async (c) => {
    const { actor } = actorOf(c);
    const id = c.req.param('id');
    const created = await deps.db.transaction().execute((trx) => createPasswordReset(trx, deps, id, actor));
    return c.json(created);
  });

  routes.post('/members/:id/revoke-sessions', async (c) => {
    const { actor } = actorOf(c);
    const id = c.req.param('id');
    await deps.db.transaction().execute((trx) => revokeMemberSessions(trx, deps, actor, id));
    return c.body(null, 204);
  });

  routes.post('/members/:id/status', async (c) => {
    const { actor } = actorOf(c);
    const body = await parseJson(c, SetStatusRequest);
    const id = c.req.param('id');
    await deps.db.transaction().execute((trx) => setStatus(trx, deps, actor, id, body.status));
    return c.body(null, 204);
  });

  routes.post('/members/:id/role', async (c) => {
    const { admin, actor } = actorOf(c);
    const body = await parseJson(c, SetRoleRequest);
    const id = c.req.param('id');
    await verifyUserPassword(deps.db, deps, admin, body.password, actor.ip);
    await deps.db.transaction().execute((trx) => setRole(trx, deps, actor, id, body.role));
    return c.body(null, 204);
  });

  routes.post('/members/:id/birth-date', async (c) => {
    const { actor } = actorOf(c);
    const body = await parseJson(c, SetBirthDateRequest);
    const id = c.req.param('id');
    await deps.db.transaction().execute((trx) => setBirthDate(trx, deps, actor, id, body.birthDate));
    return c.body(null, 204);
  });

  return routes;
}
