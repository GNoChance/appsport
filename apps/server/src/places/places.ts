import {
  type CreatePlaceRequest,
  defaultLoadSettings,
  EQUIPMENT,
  type EquipmentCode,
  HOME_PLACE_DEFAULT_NAME,
  type UpdatePlaceRequest,
} from '@appsport/contracts';
import type { SessionUser } from '../app-env';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { demotePrimaries, insertGymPlace } from './place-rows';

/** Lieu actif de l'utilisateur, sinon 404 : aucune exception pour l'admin (P-ADM-2). */
export async function loadOwnPlace(db: DbExecutor, userId: string, placeId: string) {
  const place = await db
    .selectFrom('place')
    .select(['id', 'kind', 'isPrimary'])
    .where('id', '=', placeId)
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  if (!place) throw httpError('not_found');
  return place;
}

/** Ajoute, réactive ou retire une ligne de matériel de maison ; idempotent. */
async function setHomeEquipment(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  placeId: string,
  code: EquipmentCode,
  present: boolean,
): Promise<void> {
  const id = `${placeId}:${code}`;
  const row = await trx
    .selectFrom('homeEquipment')
    .select('deletedAt')
    .where('id', '=', id)
    .executeTakeFirst();
  if ((row !== undefined && row.deletedAt === null) === present) return;
  const stamp = await writeStamp(trx, deps, userId);
  if (!row) {
    await trx
      .insertInto('homeEquipment')
      .values({ id, ownerId: userId, placeId, equipmentCode: code, createdAt: stamp.updatedAt, ...stamp })
      .execute();
  } else {
    await trx
      .updateTable('homeEquipment')
      .set({ deletedAt: present ? null : stamp.updatedAt, ...stamp })
      .where('id', '=', id)
      .execute();
  }
}

export async function createPlace(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  req: CreatePlaceRequest,
): Promise<string> {
  if (req.kind === 'gym') {
    return insertGymPlace(trx, deps, user, {
      gymId: req.gymId,
      isPrimary: req.isPrimary,
      ...(req.visibleAtGym !== undefined ? { visibleAtGym: req.visibleAtGym } : {}),
    });
  }
  const active = await trx
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', user.id)
    .where('deletedAt', 'is', null)
    .limit(1)
    .executeTakeFirst();
  const isPrimary = req.isPrimary || active === undefined;
  if (isPrimary) await demotePrimaries(trx, deps, user.id);
  const id = deps.ids.uuidv7();
  const stamp = await writeStamp(trx, deps, user.id);
  await trx
    .insertInto('place')
    .values({
      id,
      ownerId: user.id,
      kind: 'home',
      gymId: null,
      name: req.name ?? HOME_PLACE_DEFAULT_NAME,
      isPrimary: isPrimary ? 1 : 0,
      visibleAtGym: 0,
      loadSettings: JSON.stringify(defaultLoadSettings('home')),
      createdAt: stamp.updatedAt,
      ...stamp,
    })
    .execute();
  for (const code of EQUIPMENT.filter((c) => (req.equipment as readonly string[]).includes(c))) {
    await setHomeEquipment(trx, deps, user.id, id, code, true);
  }
  return id;
}

export async function updatePlace(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  placeId: string,
  req: UpdatePlaceRequest,
): Promise<void> {
  const place = await loadOwnPlace(trx, user.id, placeId);
  const isHome = place.kind === 'home';
  // Nom et réglages de charge : maison seulement (R-CHG-3) ; visibilité : salle seulement (R-VIS-3).
  if (!isHome && req.name !== undefined) throw httpError('validation', { field: 'name' });
  if (!isHome && req.loadSettings !== undefined) throw httpError('validation', { field: 'loadSettings' });
  if (isHome && req.visibleAtGym !== undefined) throw httpError('validation', { field: 'visibleAtGym' });
  if (req.isPrimary) await demotePrimaries(trx, deps, user.id, placeId);
  const stamp = await writeStamp(trx, deps, user.id);
  await trx
    .updateTable('place')
    .set({
      ...(req.name !== undefined ? { name: req.name } : {}),
      ...(req.isPrimary ? { isPrimary: 1 } : {}),
      ...(req.visibleAtGym !== undefined ? { visibleAtGym: req.visibleAtGym ? 1 : 0 } : {}),
      ...(req.loadSettings !== undefined ? { loadSettings: JSON.stringify(req.loadSettings) } : {}),
      ...stamp,
    })
    .where('id', '=', placeId)
    .execute();
}

export async function deletePlace(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  placeId: string,
  newPrimaryId: string | undefined,
): Promise<void> {
  const place = await loadOwnPlace(trx, user.id, placeId);
  const others = await trx
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', user.id)
    .where('deletedAt', 'is', null)
    .where('id', '!=', placeId)
    .execute();
  let promote: string | undefined;
  if (others.length === 0) {
    const account = await trx
      .selectFrom('user')
      .select('onboardingCompletedAt')
      .where('id', '=', user.id)
      .executeTakeFirst();
    if (account?.onboardingCompletedAt != null) throw httpError('last_place');
  } else if (place.isPrimary === 1) {
    if (newPrimaryId === undefined) throw httpError('primary_required');
    if (!others.some((o) => o.id === newPrimaryId)) {
      throw httpError('validation', { field: 'newPrimaryId' });
    }
    promote = newPrimaryId;
  }
  const stamp = await writeStamp(trx, deps, user.id);
  await trx
    .updateTable('place')
    .set({ deletedAt: stamp.updatedAt, isPrimary: 0, ...stamp })
    .where('id', '=', placeId)
    .execute();
  if (promote !== undefined) {
    const next = await writeStamp(trx, deps, user.id);
    await trx
      .updateTable('place')
      .set({ isPrimary: 1, ...next })
      .where('id', '=', promote)
      .execute();
  }
}

export async function setPlaceEquipment(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  placeId: string,
  code: EquipmentCode,
  present: boolean,
): Promise<void> {
  const place = await loadOwnPlace(trx, user.id, placeId);
  if (place.kind !== 'home') throw httpError('validation', { field: 'kind' });
  await setHomeEquipment(trx, deps, user.id, placeId, code, present);
}
