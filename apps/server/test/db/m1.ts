import { sql } from 'kysely';
import type { Migration } from '../../src/db/migrations/index';

/** Migration de test : crée server_meta selon le DDL de la Task 4b (remplacée par MIGRATIONS en Task 4b). */
export const m1: Migration = {
  id: '0001_t',
  breaking: false,
  up: async (db) => {
    await sql`CREATE TABLE server_meta (id INTEGER PRIMARY KEY CHECK (id = 1), server_epoch TEXT NOT NULL, epoch_started_at TEXT NOT NULL, epoch_base_rev INTEGER NOT NULL DEFAULT 0, sync_counter INTEGER NOT NULL DEFAULT 0, tombstone_purge_rev INTEGER NOT NULL DEFAULT 0, catalog_version TEXT, catalog_updated_at TEXT) STRICT`.execute(
      db,
    );
  },
};
