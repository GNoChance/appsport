import type { SyncOp } from '@appsport/contracts';
import Dexie, { type Table } from 'dexie';

export const LOCAL_DB_NAME = 'appsport';
export const LOCAL_DB_VERSION = 1;

export type OutboxOp = SyncOp;

export interface DeadletterEntry {
  opId: string;
  userId: string;
  entity: string;
  id: string;
  code: string;
  detail: unknown;
  receivedAt: string;
}

/** Ligne miroir : colonnes du registre en camelCase, valeurs décodées (booléens, objets), `null` gardé. */
export type MirrorRow = Record<string, unknown> & {
  id: string;
  serverRevSeen: number | null;
  deletedAt: string | null;
};

/**
 * Schéma Dexie de LOCAL_DB_VERSION. Une version suivante ajoute son propre schéma et convertit
 * l'outbox dans `.upgrade()` par `convertOutboxOp` (R-VER-4).
 */
export const STORE_SCHEMAS: Record<string, string> = {
  meta: 'key',
  outbox: 'opId, userId, [entity+id]',
  deadletter: 'opId, userId',
  user: 'id',
  training_profile: 'id',
  health_screening: 'id',
  limitation: 'id',
  consent_event: 'id, [type+createdAt]',
  gym: 'id, nameKey',
  gym_equipment: 'id, gymId',
  place: 'id, gymId',
  home_equipment: 'id, placeId',
  sync_rejection: 'id, dismissedAt',
  exercises: 'id',
  illustrations: 'id',
  programTemplates: 'id',
  adviceSheets: 'id',
};

export const NON_MIRROR_STORES: readonly string[] = [
  'meta',
  'outbox',
  'deadletter',
  'exercises',
  'illustrations',
  'programTemplates',
  'adviceSheets',
];

export class AppDb extends Dexie {
  declare meta: Table<{ key: string; value: unknown }, string>;
  declare outbox: Table<OutboxOp, string>;
  declare deadletter: Table<DeadletterEntry, string>;
  readonly mirrorNames: readonly string[];

  constructor(name: string, extraMirrors: Record<string, string> = {}) {
    super(name);
    const stores = { ...STORE_SCHEMAS, ...extraMirrors };
    this.version(LOCAL_DB_VERSION).stores(stores);
    this.mirrorNames = Object.keys(stores)
      .filter((s) => !NON_MIRROR_STORES.includes(s))
      .sort();
  }

  /** Table miroir d'une entité ; lève pour une entité sans miroir. */
  mirror(entity: string): Table<MirrorRow, string> {
    if (!this.mirrorNames.includes(entity)) throw new Error(`unknown_mirror:${entity}`);
    return this.table(entity);
  }
}

export function createAppDb(
  name: string = LOCAL_DB_NAME,
  opts: { extraMirrors?: Record<string, string> } = {},
): AppDb {
  return new AppDb(name, opts.extraMirrors);
}

/** Magasins miroirs, triés. */
export function mirrorStoreNames(db: AppDb): string[] {
  return [...db.mirrorNames];
}
