import Dexie from 'dexie';
import {
  type AppDb,
  createAppDb,
  type DeadletterEntry,
  type MirrorRow,
  type OutboxOp,
} from '../../src/local-db/db';
import dumpV1 from '../fixtures/local-db/v1/dump.json';

/** Miroirs des tables J de test (`SYNC_FIXTURE_RULES`). */
export const FIXTURE_MIRRORS: Record<string, string> = {
  fixture_note: 'id',
  fixture_note_item: 'id, noteId',
  fixture_c2_log: 'id',
};

let counter = 0;
const uniqueName = (prefix: string): string => `${prefix}-${++counter}-${crypto.randomUUID()}`;

export function createTestLocalDb(name: string = uniqueName('test')): AppDb {
  return createAppDb(name);
}

export function createFixtureLocalDb(name: string = uniqueName('fixture')): AppDb {
  return createAppDb(name, { extraMirrors: FIXTURE_MIRRORS });
}

/** Jeu figé d'une version de la base locale (`test/fixtures/local-db/v<n>/dump.json`). */
export interface FrozenLocalDbDump {
  localDbVersion: number;
  protocol: number;
  stores: Record<string, string>;
  meta: Record<string, unknown>;
  outbox: OutboxOp[];
  deadletter: DeadletterEntry[];
  mirrors: Record<string, MirrorRow[]>;
}

const FROZEN_DUMPS: Record<number, unknown> = { 1: dumpV1 };

export async function readFrozenDump(version: number): Promise<FrozenLocalDbDump> {
  const dump = FROZEN_DUMPS[version];
  if (!dump) throw new Error(`no frozen local db v${version}`);
  return structuredClone(dump) as FrozenLocalDbDump;
}

/** Écrit le jeu figé `version` dans la base `name`, avec le schéma de cette version, puis la ferme. */
export async function loadFrozenLocalDb(version: number, name: string): Promise<void> {
  const dump = await readFrozenDump(version);
  const db = new Dexie(name);
  db.version(dump.localDbVersion).stores(dump.stores);
  await db.open();
  try {
    await db.transaction('rw', db.tables, async () => {
      await db.table('meta').bulkPut(Object.entries(dump.meta).map(([key, value]) => ({ key, value })));
      await db.table('outbox').bulkPut(dump.outbox);
      await db.table('deadletter').bulkPut(dump.deadletter);
      for (const [store, rows] of Object.entries(dump.mirrors)) await db.table(store).bulkPut(rows);
    });
  } finally {
    db.close();
  }
}

/** JSON de toutes les tables, pour chercher une valeur témoin. */
export async function dumpLocalDb(db: AppDb): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const table of db.tables) out[table.name] = await table.toArray();
  return JSON.stringify(out);
}
