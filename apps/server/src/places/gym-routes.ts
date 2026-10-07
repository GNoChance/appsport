import { CreateGymRequest, GymEquipmentCode, UpdateGymRequest } from '@appsport/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { requireUser } from '../auth/session';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { parseJson, parseQuery } from '../http/validate';
import {
  createGym,
  gymDetail,
  loadEditableGym,
  putGymEquipment,
  removeGymEquipment,
  searchGyms,
  similarGyms,
  updateGym,
} from './gyms';

const SearchQuery = z.object({ q: z.string().max(120).optional() });
const SimilarQuery = z.object({
  name: z.string().max(120).default(''),
  city: z.string().max(120).default(''),
});

export function gymRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireUser);

  const userOf = (c: { get(key: 'user'): AppEnv['Variables']['user'] }) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    return user;
  };

  const equipmentCode = (raw: string) => {
    const parsed = GymEquipmentCode.safeParse(raw);
    if (!parsed.success) throw httpError('validation', { field: 'code' });
    return parsed.data;
  };

  routes.get('/', async (c) => {
    const { q } = parseQuery(c, SearchQuery);
    return c.json(await searchGyms(deps.db, deps, q ?? ''));
  });

  // Déclaré avant `/:id`.
  routes.get('/similar', async (c) => {
    const { name, city } = parseQuery(c, SimilarQuery);
    return c.json(await similarGyms(deps.db, deps, name, city));
  });

  routes.post('/', async (c) => {
    const user = userOf(c);
    const body = await parseJson(c, CreateGymRequest);
    const created = await deps.db.transaction().execute((trx) => createGym(trx, deps, user, body));
    return c.json(created, 201);
  });

  routes.get('/:id', async (c) => c.json(await gymDetail(deps.db, deps, userOf(c), c.req.param('id'))));

  routes.patch('/:id', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    // Salle (404) et droits (403) avant le corps ; `updateGym` les revérifie dans la transaction.
    await loadEditableGym(deps.db, user, id);
    const body = await parseJson(c, UpdateGymRequest);
    await deps.db.transaction().execute((trx) => updateGym(trx, deps, user, id, body));
    return c.body(null, 204);
  });

  routes.put('/:id/equipment/:code', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadEditableGym(deps.db, user, id);
    const code = equipmentCode(c.req.param('code'));
    await deps.db.transaction().execute((trx) => putGymEquipment(trx, deps, user, id, code));
    return c.body(null, 204);
  });

  routes.delete('/:id/equipment/:code', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadEditableGym(deps.db, user, id);
    const code = equipmentCode(c.req.param('code'));
    await deps.db.transaction().execute((trx) => removeGymEquipment(trx, deps, user, id, code));
    return c.body(null, 204);
  });

  return routes;
}
