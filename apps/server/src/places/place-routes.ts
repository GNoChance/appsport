import {
  CreatePlaceRequest,
  DeletePlaceRequest,
  EquipmentCodeSchema,
  UpdatePlaceRequest,
} from '@appsport/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireUser } from '../auth/session';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';
import { createPlace, deletePlace, loadOwnPlace, setPlaceEquipment, updatePlace } from './places';

export function placeRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireUser);

  const userOf = (c: { get(key: 'user'): AppEnv['Variables']['user'] }) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    return user;
  };

  const equipmentCode = (raw: string) => {
    const parsed = EquipmentCodeSchema.safeParse(raw);
    if (!parsed.success) throw httpError('validation', { field: 'code' });
    return parsed.data;
  };

  routes.post('/', async (c) => {
    const user = userOf(c);
    const body = await parseJson(c, CreatePlaceRequest);
    const id = await deps.db.transaction().execute((trx) => createPlace(trx, deps, user, body));
    return c.json({ id }, 201);
  });

  routes.patch('/:id', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadOwnPlace(deps.db, user.id, id);
    const body = await parseJson(c, UpdatePlaceRequest);
    await deps.db.transaction().execute((trx) => updatePlace(trx, deps, user, id, body));
    return c.body(null, 204);
  });

  routes.delete('/:id', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadOwnPlace(deps.db, user.id, id);
    // Le corps est facultatif : un lieu non principal se supprime sans corps.
    const hasBody = (await c.req.raw.clone().text()).trim() !== '';
    const body = hasBody ? await parseJson(c, DeletePlaceRequest) : {};
    await deps.db.transaction().execute((trx) => deletePlace(trx, deps, user, id, body.newPrimaryId));
    return c.body(null, 204);
  });

  routes.put('/:id/equipment/:code', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadOwnPlace(deps.db, user.id, id);
    const code = equipmentCode(c.req.param('code'));
    await deps.db.transaction().execute((trx) => setPlaceEquipment(trx, deps, user, id, code, true));
    return c.body(null, 204);
  });

  routes.delete('/:id/equipment/:code', async (c) => {
    const user = userOf(c);
    const id = c.req.param('id');
    await loadOwnPlace(deps.db, user.id, id);
    const code = equipmentCode(c.req.param('code'));
    await deps.db.transaction().execute((trx) => setPlaceEquipment(trx, deps, user, id, code, false));
    return c.body(null, 204);
  });

  return routes;
}
