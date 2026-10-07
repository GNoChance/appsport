import {
  AcceptInvitationRequest,
  CodeRequest,
  CreateInvitationRequest,
  INVITATION_TTL_DAYS,
} from '@appsport/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { validClientIp } from '../http/client-ip';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import {
  acceptInvitation,
  checkInvitation,
  createInvitation,
  listInvitations,
  revokeInvitation,
} from './invitations';
import { authLimiters } from './limiter';
import { buildMe } from './me';
import { requireAdmin, setSessionCookie } from './session';

const DAY_MS = 86_400_000;

/** Vérifications de code et acceptations partagent le même compteur par IP (R-INV-8). */
function limitCodeAttempts(deps: AppDeps, ip: string | null): void {
  const verdict = authLimiters(deps).invitationCheck.hit(ip);
  if (!verdict.allowed) throw httpError('rate_limited', { retryAfterS: verdict.retryAfterS });
}

export function invitationRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/check', async (c) => {
    limitCodeAttempts(deps, validClientIp(c));
    const body = await parseJson(c, CodeRequest);
    return c.json(await checkInvitation(deps.db, deps, body.code));
  });

  routes.post('/accept', async (c) => {
    const ip = validClientIp(c);
    limitCodeAttempts(deps, ip);
    const body = await parseJson(c, AcceptInvitationRequest);
    const { userId, token } = await acceptInvitation(deps, body, ip);
    setSessionCookie(c, deps, token);
    return c.json(await buildMe(deps.db, deps, userId), 201);
  });

  return routes;
}

export function adminInvitationRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireAdmin);

  routes.get('/', async (c) => c.json(await listInvitations(deps.db, deps)));

  routes.post('/', async (c) => {
    const admin = c.get('user');
    if (!admin) throw httpError('unauthenticated');
    const body = await parseJson(c, CreateInvitationRequest);
    const created = await deps.db.transaction().execute((trx) =>
      createInvitation(trx, deps, {
        birthDate: body.birthDate,
        note: body.note ? body.note : null,
        createdBy: admin.id,
        isAdminBootstrap: false,
        ttlMs: INVITATION_TTL_DAYS * DAY_MS,
        ip: validClientIp(c),
      }),
    );
    return c.json(created, 201);
  });

  routes.post('/:id/revoke', async (c) => {
    const admin = c.get('user');
    if (!admin) throw httpError('unauthenticated');
    const id = c.req.param('id');
    const ip = validClientIp(c);
    await deps.db.transaction().execute((trx) => revokeInvitation(trx, deps, id, { actorId: admin.id, ip }));
    return c.body(null, 204);
  });

  return routes;
}
