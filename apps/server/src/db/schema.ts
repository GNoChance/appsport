import type { Kysely, Transaction } from 'kysely';

export interface ServerMetaTable {
  id: number;
  serverEpoch: string;
  epochStartedAt: string;
  epochBaseRev: number;
  syncCounter: number;
  tombstonePurgeRev: number;
  catalogVersion: string | null;
  catalogUpdatedAt: string | null;
}

export interface SchemaMigrationsTable {
  id: string;
  breaking: number;
  appliedAt: string;
}

// Les autres tables du socle arrivent avec la Task 4b.
export interface Database {
  serverMeta: ServerMetaTable;
  schemaMigrations: SchemaMigrationsTable;
}

export type DbExecutor = Kysely<Database> | Transaction<Database>;

/** Nom de table SQL (snake_case) vers clé de `Database` (camelCase) : 'training_profile' → 'trainingProfile'. */
export function tableKey(sqlTable: string): keyof Database {
  return sqlTable.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as keyof Database;
}
