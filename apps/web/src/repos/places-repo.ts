import {
  type CreatePlaceRequest,
  type DeletePlaceRequest,
  EQUIPMENT,
  type EquipmentCode,
  HOME_PLACE_DEFAULT_NAME,
  type LoadSettings,
  LoadSettingsSchema,
  type UpdatePlaceRequest,
} from '@appsport/contracts';
import type { AppServices } from '../app-services';
import type { AppDb, MirrorRow } from '../local-db/db';
import { currentUserId, isLive, ownedRows, parseJsonColumn, sendThenPull, text } from './rows';

export interface PlaceView {
  id: string;
  kind: 'gym' | 'home';
  gymId: string | null;
  name: string;
  city: string | null;
  isPrimary: boolean;
  visibleAtGym: boolean | null;
  loadSettings: LoadSettings | null;
  equipment: EquipmentCode[];
}

export interface PlacesRepo {
  /** Lieux vivants de l'utilisateur, le principal d'abord puis par nom. */
  list(): Promise<PlaceView[]>;
  get(id: string): Promise<PlaceView | null>;
  create(r: CreatePlaceRequest): Promise<void>;
  update(id: string, r: UpdatePlaceRequest): Promise<void>;
  remove(id: string, r: DeletePlaceRequest): Promise<void>;
  setEquipment(placeId: string, code: EquipmentCode, present: boolean): Promise<void>;
}

/** Codes vivants d'un miroir de matériel (`gym_equipment` ou `home_equipment`), dans l'ordre de la taxonomie. */
export async function equipmentOf(
  db: AppDb,
  entity: 'gym_equipment' | 'home_equipment',
  key: 'gymId' | 'placeId',
  id: string,
): Promise<EquipmentCode[]> {
  const rows = await db.mirror(entity).where(key).equals(id).toArray();
  const codes = new Set(rows.filter(isLive).map((r) => r.equipmentCode));
  return EQUIPMENT.filter((c) => codes.has(c));
}

async function toView(db: AppDb, row: MirrorRow): Promise<PlaceView> {
  const own = parseJsonColumn(row.loadSettings, LoadSettingsSchema);
  if (row.kind === 'gym') {
    const gymId = text(row.gymId);
    const gym = gymId ? await db.mirror('gym').get(gymId) : undefined;
    return {
      id: row.id,
      kind: 'gym',
      gymId,
      name: text(gym?.name) ?? text(row.name) ?? '',
      city: text(gym?.city),
      isPrimary: row.isPrimary === true,
      visibleAtGym: typeof row.visibleAtGym === 'boolean' ? row.visibleAtGym : null,
      loadSettings: own ?? parseJsonColumn(gym?.loadSettings, LoadSettingsSchema),
      equipment: gymId ? await equipmentOf(db, 'gym_equipment', 'gymId', gymId) : [],
    };
  }
  return {
    id: row.id,
    kind: 'home',
    gymId: null,
    name: text(row.name) ?? HOME_PLACE_DEFAULT_NAME,
    city: null,
    isPrimary: row.isPrimary === true,
    visibleAtGym: null,
    loadSettings: own,
    equipment: await equipmentOf(db, 'home_equipment', 'placeId', row.id),
  };
}

export function createPlacesRepo(s: AppServices): PlacesRepo {
  const { db } = s;

  async function list(): Promise<PlaceView[]> {
    const rows = await ownedRows(db, 'place', await currentUserId(db));
    const views = await Promise.all(rows.map((r) => toView(db, r)));
    return views.sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, 'fr'),
    );
  }

  return {
    list,
    async get(id) {
      return (await list()).find((p) => p.id === id) ?? null;
    },
    async create(r) {
      await sendThenPull(s, 'POST', '/api/places', { body: r });
    },
    async update(id, r) {
      await sendThenPull(s, 'PATCH', `/api/places/${encodeURIComponent(id)}`, { body: r });
    },
    async remove(id, r) {
      await sendThenPull(s, 'DELETE', `/api/places/${encodeURIComponent(id)}`, { body: r });
    },
    async setEquipment(placeId, code, present) {
      const path = `/api/places/${encodeURIComponent(placeId)}/equipment/${code}`;
      await sendThenPull(s, present ? 'PUT' : 'DELETE', path);
    },
  };
}
