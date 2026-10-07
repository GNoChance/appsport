import { backup, type DatabaseSync } from 'node:sqlite';
import {
  type EntityRule,
  type EntityRulesMap,
  entityRules,
  PROTOCOL_HEADER,
  SYNC_COLUMNS,
  SYNC_PROTOCOL,
  type SyncOp,
} from '@appsport/contracts';
import { sql } from 'kysely';
import type { Migration } from '../../src/db/migrations/index';
import { rotateServerEpoch } from '../../src/sync/epoch';
import { createTestContext, type TestContext } from './context';
import { seqIds } from './ids';

/** Colonnes +SYNC de la Task 4b. */
const SYNC_DDL =
  'owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, rev INTEGER NOT NULL, created_at TEXT NOT NULL, ' +
  'updated_at TEXT NOT NULL, updated_by TEXT REFERENCES user(id) ON DELETE SET NULL, deleted_at TEXT';

const FIXTURE_DDL: Record<string, string> = {
  fixture_note: `CREATE TABLE fixture_note (id TEXT PRIMARY KEY, ${SYNC_DDL}, title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100), body TEXT) STRICT`,
  fixture_note_item: `CREATE TABLE fixture_note_item (id TEXT PRIMARY KEY, ${SYNC_DDL}, note_id TEXT NOT NULL REFERENCES fixture_note(id), label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 100), pain_note TEXT, reason TEXT) STRICT`,
  fixture_c2_log: `CREATE TABLE fixture_c2_log (id TEXT PRIMARY KEY, ${SYNC_DDL}, value INTEGER, CHECK (deleted_at IS NOT NULL OR value IS NOT NULL)) STRICT`,
};

/** Tables J de test pour la synchro (non cassante, hors MIGRATIONS). */
export const SYNC_FIXTURE_MIGRATION: Migration = {
  id: '9001_sync_fixtures',
  breaking: false,
  up: async (db) => {
    for (const [table, ddl] of Object.entries(FIXTURE_DDL)) {
      await sql.raw(ddl).execute(db);
      await sql.raw(`CREATE INDEX ${table}_rev_idx ON ${table} (rev)`).execute(db);
      await sql.raw(`CREATE INDEX ${table}_owner_rev_idx ON ${table} (owner_id, rev)`).execute(db);
    }
  },
};

const fixtureRule = (
  spec: Pick<EntityRule, 'category' | 'columns' | 'clientWritable'> & Partial<EntityRule>,
): EntityRule => ({
  syncClass: 'J',
  ownerColumn: 'owner_id',
  c2Columns: [],
  secretColumns: [],
  exported: true,
  onUserDelete: 'cascade',
  ...spec,
});

export const SYNC_FIXTURE_RULES: EntityRulesMap = {
  ...entityRules,
  fixture_note: fixtureRule({
    category: 'C1',
    columns: ['id', ...SYNC_COLUMNS, 'title', 'body'],
    clientWritable: ['title', 'body'],
  }),
  fixture_note_item: fixtureRule({
    category: 'C1',
    columns: ['id', ...SYNC_COLUMNS, 'note_id', 'label', 'pain_note', 'reason'],
    clientWritable: ['note_id', 'label', 'pain_note', 'reason'],
    c2Columns: ['pain_note'],
    c2Values: { reason: ['pain'] },
    parent: { entity: 'fixture_note', column: 'note_id' },
  }),
  fixture_c2_log: fixtureRule({
    category: 'C2',
    columns: ['id', ...SYNC_COLUMNS, 'value'],
    clientWritable: ['value'],
  }),
};

/** Contexte de test avec les tables et règles de synchro de test. */
export async function createSyncTestContext(
  opts: Parameters<typeof createTestContext>[0] = {},
): Promise<TestContext> {
  return createTestContext({
    ...opts,
    extraMigrations: [SYNC_FIXTURE_MIGRATION, ...(opts.extraMigrations ?? [])],
    entityRules: opts.entityRules ?? SYNC_FIXTURE_RULES,
  });
}

export const PROTOCOL_HEADERS: Record<string, string> = { [PROTOCOL_HEADER]: String(SYNC_PROTOCOL) };

const opIds = seqIds(7000);

export function makeOp(o: {
  userId: string;
  entity: string;
  id: string;
  kind: SyncOp['kind'];
  fields?: Record<string, unknown>;
  opId?: string;
  serverRevSeen?: number | null;
  protocol?: number;
}): SyncOp {
  return {
    opId: o.opId ?? opIds.uuidv7(),
    userId: o.userId,
    entity: o.entity,
    id: o.id,
    kind: o.kind,
    fields: o.fields ?? {},
    clientTs: '2026-10-06T10:00:00.000Z',
    protocol: o.protocol ?? SYNC_PROTOCOL,
    attempts: 0,
    serverRevSeen: o.serverRevSeen ?? null,
  };
}

export async function syncPush(
  ctx: TestContext,
  cookie: string,
  ops: unknown[],
  // biome-ignore lint/suspicious/noExplicitAny: corps de réponse lu librement par les tests
): Promise<{ status: number; body: any }> {
  const res = await ctx.request('/api/sync/push', {
    method: 'POST',
    json: { ops },
    cookie,
    headers: PROTOCOL_HEADERS,
  });
  return { status: res.status, body: await res.json() };
}

export async function syncPull(
  ctx: TestContext,
  cookie: string,
  q: { since?: string; limit?: number } = {},
  // biome-ignore lint/suspicious/noExplicitAny: corps de réponse lu librement par les tests
): Promise<{ status: number; body: any; headers: Headers }> {
  const params = new URLSearchParams();
  if (q.since !== undefined) params.set('since', q.since);
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  const query = params.size > 0 ? `?${params.toString()}` : '';
  const res = await ctx.request(`/api/sync/pull${query}`, { cookie, headers: PROTOCOL_HEADERS });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

/** JSON de toutes les lignes de toutes les tables, pour chercher des valeurs témoins. */
export function dumpDatabase(sqlite: DatabaseSync): string {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const dump: Record<string, unknown[]> = {};
  for (const { name } of tables) dump[name] = sqlite.prepare(`SELECT * FROM "${name}"`).all();
  return JSON.stringify(dump);
}

/** Instantané de la base du contexte par l'API `backup` de `node:sqlite`. */
export async function snapshotDb(ctx: TestContext, path: string): Promise<void> {
  await backup(ctx.deps.sqlite, path);
}

/**
 * Restauration sur place (la connexion du contexte reste ouverte) : chaque table est recopiée
 * depuis l'instantané, puis l'époque du serveur est renouvelée comme après une vraie restauration.
 */
export async function restoreInPlace(
  ctx: TestContext,
  snapshotPath: string,
): Promise<{ epoch: string; baseRev: number }> {
  const { sqlite } = ctx.deps;
  sqlite.exec('PRAGMA foreign_keys = OFF');
  sqlite.prepare('ATTACH DATABASE ? AS snap').run(snapshotPath);
  try {
    const tables = sqlite
      .prepare("SELECT name FROM main.sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    sqlite.exec('BEGIN');
    try {
      for (const { name } of tables) {
        sqlite.exec(`DELETE FROM main."${name}"`);
        sqlite.exec(`INSERT INTO main."${name}" SELECT * FROM snap."${name}"`);
      }
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  } finally {
    sqlite.exec('DETACH DATABASE snap');
    sqlite.exec('PRAGMA foreign_keys = ON');
  }
  return rotateServerEpoch(ctx.deps.db, ctx.deps);
}
