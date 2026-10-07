import { DeleteAccountRequest, UpdateMeRequest } from '@appsport/contracts';
import { parisDate, usernameKey, validateUsername } from '@appsport/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { writeStamp } from '../db/rev';
import type { AppDeps } from '../deps';
import { validClientIp } from '../http/client-ip';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import { deleteAccount } from '../privacy/delete-account';
import { buildExport } from '../privacy/export';
import { buildMe, verifyUserPassword } from './me';
import { logSecurityEvent } from './security-log';
import { clearSessionCookie, requireUser } from './session';

const isUsernameConflict = (error: unknown): boolean =>
  error instanceof Error && /UNIQUE constraint failed: user\.username_key/.test(error.message);

export function meRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireUser);

  routes.get('/', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    return c.json(await buildMe(deps.db, deps, user.id, { mustChangePassword: user.mustChangePassword }));
  });

  routes.patch('/', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const body = await parseJson(c, UpdateMeRequest);
    const username = body.username.normalize('NFC');
    const check = validateUsername(username);
    if (!check.ok) throw httpError('username_invalid', { reason: check.reason });
    const key = usernameKey(username);
    try {
      await deps.db.transaction().execute(async (trx) => {
        const taken = await trx
          .selectFrom('user')
          .select('id')
          .where('usernameKey', '=', key)
          .where('id', '!=', user.id)
          .executeTakeFirst();
        if (taken) throw httpError('username_taken');
        const stamp = await writeStamp(trx, deps, user.id);
        await trx
          .updateTable('user')
          .set({ username, usernameKey: key, ...stamp })
          .where('id', '=', user.id)
          .execute();
        await logSecurityEvent(trx, deps, {
          type: 'username_changed',
          actorId: user.id,
          targetId: user.id,
          ip: validClientIp(c),
          outcome: 'success',
        });
      });
    } catch (error) {
      throw isUsernameConflict(error) ? httpError('username_taken') : error;
    }
    return c.json(await buildMe(deps.db, deps, user.id, { mustChangePassword: user.mustChangePassword }));
  });

  routes.get('/export', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const exported = await deps.db.transaction().execute(async (trx) => {
      const data = await buildExport(trx, deps, user.id);
      await logSecurityEvent(trx, deps, {
        type: 'data_exported',
        actorId: user.id,
        targetId: user.id,
        ip: validClientIp(c),
        outcome: 'success',
      });
      return data;
    });
    c.header(
      'Content-Disposition',
      `attachment; filename="appsport-export-${parisDate(deps.clock.now())}.json"`,
    );
    c.header('Cache-Control', 'no-store');
    return c.json(exported);
  });

  routes.post('/delete', async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const body = await parseJson(c, DeleteAccountRequest);
    const ip = validClientIp(c);
    await verifyUserPassword(deps.db, deps, user, body.password, ip);
    await deps.db.transaction().execute((trx) => deleteAccount(trx, deps, user.id, { actorId: user.id, ip }));
    clearSessionCookie(c, deps);
    return c.body(null, 204);
  });

  return routes;
}
