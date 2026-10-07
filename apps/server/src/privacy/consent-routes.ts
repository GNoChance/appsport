import {
  CODE_CHECKS_PER_HOUR,
  GrantConsentRequest,
  HEALTH_CONSENT_TEXT,
  HEALTH_QUESTIONNAIRE,
  HealthScreeningRequest,
  LimitationInput,
  LimitationPatch,
  LOGIN_LIMITS,
  ReplayWithdrawRequest,
  WithdrawConsentRequest,
} from '@appsport/contracts';
import { type Context, Hono } from 'hono';
import type { AppEnv, SessionUser } from '../app-env';
import { createIpLimiter, type IpLimiter } from '../auth/limiter';
import { buildMe, verifyUserPassword } from '../auth/me';
import { requireUser } from '../auth/session';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import { getServerMeta } from '../db/server-meta';
import type { AppDeps } from '../deps';
import { validClientIp } from '../http/client-ip';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import { grantConsent, latestGrant, withdrawHealthConsent } from './consent';
import { isHealthConsentActive } from './consent-state';

/** Limiteur propre au renvoi du retrait (20 par heure et par IP), un par jeu de dépendances. */
const replayLimiters = new WeakMap<AppDeps, IpLimiter>();
function replayLimiter(deps: AppDeps): IpLimiter {
  let limiter = replayLimiters.get(deps);
  if (!limiter) {
    limiter = createIpLimiter(deps.clock, { limit: CODE_CHECKS_PER_HOUR, windowMs: LOGIN_LIMITS.windowMs });
    replayLimiters.set(deps, limiter);
  }
  return limiter;
}

const userOf = (c: Context<AppEnv>): SessionUser => {
  const user = c.get('user');
  if (!user) throw httpError('unauthenticated');
  return user;
};

/** Garde C2 (R-CST-4, P-CST-2). */
async function requireHealthConsent(db: DbExecutor, userId: string): Promise<void> {
  if (!(await isHealthConsentActive(db, userId))) throw httpError('health_consent_required');
}

/** Limitation vivante de l'utilisateur ; sinon 404 (absente, supprimée ou à un autre, P-ADM-2). */
async function loadOwnLimitation(db: DbExecutor, userId: string, id: string): Promise<void> {
  const row = await db
    .selectFrom('limitation')
    .select(['id', 'ownerId'])
    .where('id', '=', id)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  if (!row || row.ownerId !== userId) throw httpError('not_found');
}

export function consentRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const me = (user: SessionUser) =>
    buildMe(deps.db, deps, user.id, { mustChangePassword: user.mustChangePassword });

  routes.post('/consents', requireUser, async (c) => {
    const user = userOf(c);
    const body = await parseJson(c, GrantConsentRequest);
    if (body.textVersion !== HEALTH_CONSENT_TEXT.version)
      throw httpError('validation', { field: 'textVersion' });
    const ip = validClientIp(c);
    await deps.db
      .transaction()
      .execute((trx) => grantConsent(trx, deps, user.id, body.type, body.textVersion, ip));
    return c.json(await me(user));
  });

  routes.post('/consents/withdraw', requireUser, async (c) => {
    const user = userOf(c);
    const body = await parseJson(c, WithdrawConsentRequest);
    const ip = validClientIp(c);
    await verifyUserPassword(deps.db, deps, user, body.password, ip);
    await deps.db
      .transaction()
      .execute((trx) => withdrawHealthConsent(trx, deps, user.id, { actorId: user.id, ip }));
    return c.json(await me(user));
  });

  // R-SYN-28 : renvoi d'un retrait perdu par une restauration, sans mot de passe (exception à P-AUT-5).
  routes.post('/consents/health/replay-withdraw', requireUser, async (c) => {
    const user = userOf(c);
    const ip = validClientIp(c);
    const verdict = replayLimiter(deps).hit(ip);
    if (!verdict.allowed) throw httpError('rate_limited', { retryAfterS: verdict.retryAfterS });
    const body = await parseJson(c, ReplayWithdrawRequest);
    const withdrawnAt = new Date(body.withdrawnAt).getTime();
    await deps.db.transaction().execute(async (trx) => {
      const grant = await latestGrant(trx, user.id, 'health');
      const { epochStartedAt } = await getServerMeta(trx);
      const accepted =
        grant !== undefined &&
        (await isHealthConsentActive(trx, user.id)) &&
        withdrawnAt > new Date(grant.createdAt).getTime() &&
        withdrawnAt < new Date(epochStartedAt).getTime();
      if (!accepted) throw httpError('conflict');
      await withdrawHealthConsent(trx, deps, user.id, { actorId: user.id, ip }, { replay: true });
    });
    return c.json(await me(user));
  });

  routes.put('/health-screening', requireUser, async (c) => {
    const user = userOf(c);
    await requireHealthConsent(deps.db, user.id);
    const body = await parseJson(c, HealthScreeningRequest);
    if (body.questionnaireVersion !== HEALTH_QUESTIONNAIRE.version) {
      throw httpError('validation', { field: 'questionnaireVersion' });
    }
    // Seul le résultat est gardé : les réponses ne sont jamais stockées (02 §12 E7).
    const caution = body.answers.some(Boolean);
    await deps.db.transaction().execute(async (trx) => {
      const stamp = await writeStamp(trx, deps, user.id);
      const content = {
        caution: caution ? 1 : 0,
        questionnaireVersion: body.questionnaireVersion,
        answeredAt: stamp.updatedAt,
        deletedAt: null,
        ...stamp,
      };
      await trx
        .insertInto('healthScreening')
        .values({ id: user.id, ownerId: user.id, createdAt: stamp.updatedAt, ...content })
        .onConflict((oc) => oc.column('id').doUpdateSet(content))
        .execute();
    });
    return c.json({ caution });
  });

  routes.post('/limitations', requireUser, async (c) => {
    const user = userOf(c);
    await requireHealthConsent(deps.db, user.id);
    const body = await parseJson(c, LimitationInput);
    const id = deps.ids.uuidv7();
    await deps.db.transaction().execute(async (trx) => {
      const stamp = await writeStamp(trx, deps, user.id);
      await trx
        .insertInto('limitation')
        .values({
          id,
          ownerId: user.id,
          createdAt: stamp.updatedAt,
          bodyArea: body.bodyArea,
          side: body.side,
          severity: body.severity,
          note: body.note ?? null,
          active: body.active === false ? 0 : 1,
          ...stamp,
        })
        .execute();
    });
    return c.json({ id }, 201);
  });

  routes.patch('/limitations/:id', requireUser, async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadOwnLimitation(deps.db, user.id, id);
    await requireHealthConsent(deps.db, user.id);
    const body = await parseJson(c, LimitationPatch);
    const { active, ...rest } = body;
    await deps.db.transaction().execute(async (trx) => {
      const stamp = await writeStamp(trx, deps, user.id);
      await trx
        .updateTable('limitation')
        .set({ ...rest, ...(active === undefined ? {} : { active: active ? 1 : 0 }), ...stamp })
        .where('id', '=', id)
        .where('deletedAt', 'is', null)
        .execute();
    });
    return c.body(null, 204);
  });

  routes.delete('/limitations/:id', requireUser, async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadOwnLimitation(deps.db, user.id, id);
    await requireHealthConsent(deps.db, user.id);
    await deps.db.transaction().execute(async (trx) => {
      const stamp = await writeStamp(trx, deps, user.id);
      await trx
        .updateTable('limitation')
        .set({
          bodyArea: null,
          side: null,
          severity: null,
          note: null,
          active: null,
          deletedAt: stamp.updatedAt,
          ...stamp,
        })
        .where('id', '=', id)
        .where('deletedAt', 'is', null)
        .execute();
    });
    return c.body(null, 204);
  });

  return routes;
}
