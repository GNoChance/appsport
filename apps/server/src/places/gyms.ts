import { isDeepStrictEqual } from 'node:util';
import {
  type CreateGymRequest,
  type CreateGymResponse,
  defaultLoadSettings,
  EQUIPMENT,
  type EquipmentCode,
  type GymDetail,
  type GymHistoryAction,
  type GymSummary,
  type LoadSettings,
  type UpdateGymRequest,
} from '@appsport/contracts';
import { normalize } from '@appsport/domain';
import { sql } from 'kysely';
import type { SessionUser } from '../app-env';
import { logSecurityEvent } from '../auth/security-log';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { insertGymPlace } from './place-rows';

const HISTORY_LIMIT = 10;
const MIN_SIMILAR = 2;

const SQLITE_CONSTRAINT = 19;

/** Une violation UNIQUE sur la clé (nom, ville) devient 409 gym_duplicate. */
async function uniqueAsDuplicate<T>(
  trx: DbExecutor,
  keys: { nameKey: string; cityKey: string },
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = (error as { errcode?: unknown }).errcode;
    if (typeof code !== 'number' || (code & 0xff) !== SQLITE_CONSTRAINT) throw error;
    const clash = await trx
      .selectFrom('gym')
      .select('id')
      .where('nameKey', '=', keys.nameKey)
      .where('cityKey', '=', keys.cityKey)
      .executeTakeFirst();
    throw httpError('gym_duplicate', clash ? { gymId: clash.id } : undefined);
  }
}

async function loadGym(db: DbExecutor, gymId: string) {
  return db.selectFrom('gym').selectAll().where('id', '=', gymId).executeTakeFirst();
}

/** Salle présente et non supprimée, sinon 404. */
async function loadActiveGym(db: DbExecutor, gymId: string) {
  const gym = await loadGym(db, gymId);
  if (!gym || gym.deletedAt !== null) throw httpError('not_found');
  return gym;
}

async function addHistory(
  trx: DbExecutor,
  deps: AppDeps,
  gymId: string,
  authorId: string,
  action: GymHistoryAction,
  detail: unknown,
): Promise<void> {
  await trx
    .insertInto('gymHistory')
    .values({
      id: deps.ids.uuidv7(),
      gymId,
      authorId,
      at: deps.clock.now().toISOString(),
      action,
      detail: JSON.stringify(detail),
    })
    .execute();
}

/** Membres visibles (R-VIS) : lieu actif avec visible_at_gym = 1 et compte actif (un mineur l'active lieu par lieu). */
async function visibleRowsByGym(
  db: DbExecutor,
  gymIds: string[],
): Promise<Map<string, { id: string; username: string }[]>> {
  const result = new Map<string, { id: string; username: string }[]>(gymIds.map((id) => [id, []]));
  if (gymIds.length === 0) return result;
  const rows = await db
    .selectFrom('place')
    .innerJoin('user', 'user.id', 'place.ownerId')
    .select(['place.gymId as gymId', 'user.id as id', 'user.username as username'])
    .where('place.gymId', 'in', gymIds)
    .where('place.deletedAt', 'is', null)
    .where('place.visibleAtGym', '=', 1)
    .where('user.status', '=', 'active')
    .orderBy('user.usernameKey')
    .execute();
  for (const row of rows) {
    if (row.gymId !== null) result.get(row.gymId)?.push({ id: row.id, username: row.username });
  }
  return result;
}

async function summaries(
  db: DbExecutor,
  gyms: { id: string; name: string; city: string }[],
): Promise<GymSummary[]> {
  const members = await visibleRowsByGym(
    db,
    gyms.map((g) => g.id),
  );
  return gyms.map((g) => ({
    id: g.id,
    name: g.name,
    city: g.city,
    visibleMemberCount: members.get(g.id)?.length ?? 0,
  }));
}

export async function searchGyms(db: DbExecutor, q: string): Promise<GymSummary[]> {
  const key = normalize(q);
  let query = db
    .selectFrom('gym')
    .select(['id', 'name', 'city'])
    .where('deletedAt', 'is', null)
    .orderBy('nameKey')
    .orderBy('id');
  if (key !== '') {
    query = query.where((eb) =>
      eb.or([eb(sql`instr(name_key, ${key})`, '>', 0), eb(sql`instr(city_key, ${key})`, '>', 0)]),
    );
  }
  return summaries(db, await query.execute());
}

export async function similarGyms(db: DbExecutor, name: string, city: string): Promise<GymSummary[]> {
  const nameKey = normalize(name);
  const cityKey = normalize(city);
  const useName = nameKey.length >= MIN_SIMILAR;
  const useCity = cityKey.length >= MIN_SIMILAR;
  if (!useName && !useCity) return [];
  const close = (a: string, b: string) => a.includes(b) || b.includes(a);
  const gyms = await db
    .selectFrom('gym')
    .select(['id', 'name', 'city', 'nameKey', 'cityKey'])
    .where('deletedAt', 'is', null)
    .orderBy('nameKey')
    .orderBy('id')
    .execute();
  return summaries(
    db,
    gyms.filter((g) => (useName && close(g.nameKey, nameKey)) || (useCity && close(g.cityKey, cityKey))),
  );
}

async function canEditGym(db: DbExecutor, user: SessionUser, gymId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const place = await db
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', user.id)
    .where('gymId', '=', gymId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  return place !== undefined;
}

/** Charge la salle active et exige le droit d'écriture (404 puis 403). */
export async function loadEditableGym(db: DbExecutor, user: SessionUser, gymId: string) {
  const gym = await loadActiveGym(db, gymId);
  if (!(await canEditGym(db, user, gymId))) throw httpError('forbidden');
  return gym;
}

export async function gymDetail(db: DbExecutor, user: SessionUser, gymId: string): Promise<GymDetail> {
  const gym = await loadGym(db, gymId);
  if (!gym) throw httpError('not_found');
  const active = new Set(
    (
      await db
        .selectFrom('gymEquipment')
        .select('equipmentCode')
        .where('gymId', '=', gymId)
        .where('deletedAt', 'is', null)
        .execute()
    ).map((r) => r.equipmentCode),
  );
  const history = await db
    .selectFrom('gymHistory')
    .leftJoin('user', 'user.id', 'gymHistory.authorId')
    .select([
      'gymHistory.at as at',
      'gymHistory.action as action',
      'gymHistory.detail as detail',
      'user.username as authorUsername',
      'user.role as authorRole',
      'gymHistory.authorId as authorId',
    ])
    .where('gymHistory.gymId', '=', gymId)
    .orderBy('gymHistory.at', 'desc')
    .orderBy('gymHistory.id', 'desc')
    .limit(HISTORY_LIMIT)
    .execute();
  const members = (await visibleRowsByGym(db, [gymId])).get(gymId) ?? [];
  const visibleIds = new Set(members.map((m) => m.id));
  return {
    id: gym.id,
    name: gym.name,
    city: gym.city,
    loadSettings: JSON.parse(gym.loadSettings) as LoadSettings,
    deletedAt: gym.deletedAt,
    equipment: EQUIPMENT.filter((code) => active.has(code)),
    canEdit: gym.deletedAt === null && (await canEditGym(db, user, gymId)),
    visibleMembers: members.map((m) => m.username),
    history: history.map((h) => ({
      at: h.at,
      action: h.action,
      // Le pseudo n'est rendu que pour un admin ou un membre visible à cette salle.
      authorUsername:
        h.authorId !== null && (h.authorRole === 'admin' || visibleIds.has(h.authorId))
          ? h.authorUsername
          : null,
      detail: JSON.parse(h.detail) as unknown,
    })),
  };
}

/** Ajoute, réactive ou retire une ligne de matériel ; renvoie vrai s'il y a eu écriture. */
async function setEquipment(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  gymId: string,
  code: EquipmentCode,
  present: boolean,
): Promise<boolean> {
  const id = `${gymId}:${code}`;
  const row = await trx
    .selectFrom('gymEquipment')
    .select('deletedAt')
    .where('id', '=', id)
    .executeTakeFirst();
  const isActive = row !== undefined && row.deletedAt === null;
  if (isActive === present) return false;
  const stamp = await writeStamp(trx, deps, userId);
  if (!row) {
    await trx
      .insertInto('gymEquipment')
      .values({
        id,
        gymId,
        equipmentCode: code,
        addedBy: userId,
        rev: stamp.rev,
        createdAt: stamp.updatedAt,
        updatedAt: stamp.updatedAt,
      })
      .execute();
  } else {
    await trx
      .updateTable('gymEquipment')
      .set({
        deletedAt: present ? null : stamp.updatedAt,
        ...(present ? { addedBy: userId } : {}),
        rev: stamp.rev,
        updatedAt: stamp.updatedAt,
      })
      .where('id', '=', id)
      .execute();
  }
  return true;
}

export async function putGymEquipment(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  gymId: string,
  code: EquipmentCode,
): Promise<void> {
  await loadEditableGym(trx, user, gymId);
  if (await setEquipment(trx, deps, user.id, gymId, code, true)) {
    await addHistory(trx, deps, gymId, user.id, 'add_equipment', { code });
  }
}

export async function removeGymEquipment(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  gymId: string,
  code: EquipmentCode,
): Promise<void> {
  await loadEditableGym(trx, user, gymId);
  if (await setEquipment(trx, deps, user.id, gymId, code, false)) {
    await addHistory(trx, deps, gymId, user.id, 'remove_equipment', { code });
  }
}

export async function createGym(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  req: CreateGymRequest,
): Promise<CreateGymResponse> {
  const nameKey = normalize(req.name);
  const cityKey = normalize(req.city);
  const codes = EQUIPMENT.filter((code) => (req.equipment as readonly string[]).includes(code));
  const existing = await trx
    .selectFrom('gym')
    .select(['id', 'deletedAt'])
    .where('nameKey', '=', nameKey)
    .where('cityKey', '=', cityKey)
    .executeTakeFirst();
  if (existing && existing.deletedAt === null) {
    throw httpError('gym_duplicate', { gymId: existing.id });
  }

  let gymId: string;
  if (existing) {
    // Réactivation : nom et ville envoyés, réglages de charge conservés, matériel remplacé.
    gymId = existing.id;
    const stamp = await writeStamp(trx, deps, user.id);
    await trx
      .updateTable('gym')
      .set({ name: req.name, city: req.city, deletedAt: null, ...stamp })
      .where('id', '=', gymId)
      .execute();
    const rows = await trx
      .selectFrom('gymEquipment')
      .select('equipmentCode')
      .where('gymId', '=', gymId)
      .where('deletedAt', 'is', null)
      .execute();
    for (const row of rows) {
      const code = row.equipmentCode as EquipmentCode;
      if (!codes.includes(code)) await setEquipment(trx, deps, user.id, gymId, code, false);
    }
  } else {
    gymId = deps.ids.uuidv7();
    const stamp = await writeStamp(trx, deps, user.id);
    await uniqueAsDuplicate(trx, { nameKey, cityKey }, () =>
      trx
        .insertInto('gym')
        .values({
          id: gymId,
          name: req.name,
          nameKey,
          city: req.city,
          cityKey,
          loadSettings: JSON.stringify(defaultLoadSettings('gym')),
          createdBy: user.id,
          createdAt: stamp.updatedAt,
          ...stamp,
        })
        .execute(),
    );
  }
  for (const code of codes) await setEquipment(trx, deps, user.id, gymId, code, true);
  await addHistory(trx, deps, gymId, user.id, 'create', {
    name: req.name,
    city: req.city,
    equipment: codes,
  });
  const placeId = await insertGymPlace(trx, deps, user, {
    gymId,
    isPrimary: req.isPrimary,
    ...(req.visibleAtGym !== undefined ? { visibleAtGym: req.visibleAtGym } : {}),
  });
  return { gymId, placeId };
}

export async function updateGym(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  gymId: string,
  req: UpdateGymRequest,
): Promise<void> {
  const gym = await loadEditableGym(trx, user, gymId);
  const name = req.name ?? gym.name;
  const city = req.city ?? gym.city;
  const nameKey = normalize(name);
  const cityKey = normalize(city);
  if (nameKey !== gym.nameKey || cityKey !== gym.cityKey) {
    const clash = await trx
      .selectFrom('gym')
      .select('id')
      .where('nameKey', '=', nameKey)
      .where('cityKey', '=', cityKey)
      .where('id', '!=', gymId)
      .executeTakeFirst();
    if (clash) throw httpError('gym_duplicate', { gymId: clash.id });
  }

  const info: { name?: { from: string; to: string }; city?: { from: string; to: string } } = {};
  if (name !== gym.name) info.name = { from: gym.name, to: name };
  if (city !== gym.city) info.city = { from: gym.city, to: city };
  const from = JSON.parse(gym.loadSettings) as LoadSettings;
  const settingsChanged = req.loadSettings !== undefined && !isDeepStrictEqual(req.loadSettings, from);
  const infoChanged = info.name !== undefined || info.city !== undefined;
  if (!infoChanged && !settingsChanged) return;

  const stamp = await writeStamp(trx, deps, user.id);
  await uniqueAsDuplicate(trx, { nameKey, cityKey }, () =>
    trx
      .updateTable('gym')
      .set({
        name,
        nameKey,
        city,
        cityKey,
        ...(settingsChanged ? { loadSettings: JSON.stringify(req.loadSettings) } : {}),
        ...stamp,
      })
      .where('id', '=', gymId)
      .execute(),
  );
  if (infoChanged) await addHistory(trx, deps, gymId, user.id, 'update_info', info);
  if (settingsChanged) {
    await addHistory(trx, deps, gymId, user.id, 'update_load_settings', { from, to: req.loadSettings });
  }
}

export async function deleteGymAsAdmin(
  trx: DbExecutor,
  deps: AppDeps,
  actor: { actorId: string; ip: string | null },
  gymId: string,
): Promise<void> {
  await loadActiveGym(trx, gymId);
  const used = await trx
    .selectFrom('place')
    .select('id')
    .where('gymId', '=', gymId)
    .where('deletedAt', 'is', null)
    .limit(1)
    .executeTakeFirst();
  if (used) throw httpError('gym_in_use');
  const stamp = await writeStamp(trx, deps, actor.actorId);
  await trx
    .updateTable('gym')
    .set({ deletedAt: stamp.updatedAt, ...stamp })
    .where('id', '=', gymId)
    .execute();
  await logSecurityEvent(trx, deps, {
    type: 'gym_deleted',
    actorId: actor.actorId,
    targetId: gymId,
    ip: actor.ip,
    outcome: 'success',
  });
}
