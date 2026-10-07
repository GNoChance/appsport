import { DatabaseSync } from 'node:sqlite';
import { CamelCasePlugin, Kysely } from 'kysely';
import type { Database } from './schema';
import { NodeSqliteDialect } from './sqlite-dialect';

const PRAGMAS = ['journal_mode = WAL', 'synchronous = FULL', 'foreign_keys = ON', 'busy_timeout = 5000'];

export function openDatabase(path: string): { sqlite: DatabaseSync; db: Kysely<Database> } {
  const sqlite = new DatabaseSync(path);
  try {
    for (const pragma of PRAGMAS) sqlite.exec(`PRAGMA ${pragma}`);
  } catch (error) {
    sqlite.close();
    throw error;
  }
  const db = new Kysely<Database>({
    dialect: new NodeSqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
  });
  return { sqlite, db };
}
