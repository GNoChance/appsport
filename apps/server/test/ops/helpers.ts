import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Kysely } from 'kysely';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import type { Database } from '../../src/db/schema';
import { initServerMeta } from '../../src/db/server-meta';
import { FakeClock, seqIds } from '../support';

export interface OpsDataDir {
  dir: string;
  dbPath: string;
  sqlite: DatabaseSync;
  db: Kysely<Database>;
  /** Ferme la base (sous Windows, un fichier SQLite ouvert ne peut être ni renommé ni déplacé). */
  close(): void;
}

/** Dossier de données temporaire : sentinelle, base fichier migrée et server_meta initialisé. */
export async function createOpsDataDir(): Promise<OpsDataDir> {
  const dir = mkdtempSync(join(tmpdir(), 'rune-ops-'));
  writeFileSync(join(dir, '.rune-volume'), '');
  const dbPath = join(dir, 'rune.db');
  const { sqlite, db } = openDatabase(dbPath);
  try {
    const clock = new FakeClock();
    await migrate(db, MIGRATIONS, clock);
    await initServerMeta(db, { ids: seqIds(1), clock });
  } catch (error) {
    sqlite.close();
    throw error;
  }
  return {
    dir,
    dbPath,
    sqlite,
    db,
    close() {
      if (sqlite.isOpen) sqlite.close();
    },
  };
}

export function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Ouvre `path` en lecture seule le temps de `fn`. */
export function readOnly<T>(path: string, fn: (sqlite: DatabaseSync) => T): T {
  const sqlite = new DatabaseSync(path, { readOnly: true });
  try {
    return fn(sqlite);
  } finally {
    sqlite.close();
  }
}

export function integrity(path: string): unknown {
  return readOnly(path, (sqlite) => sqlite.prepare('PRAGMA integrity_check').all());
}
