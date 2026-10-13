import { type Kysely, sql } from 'kysely';
import type { Clock } from '../deps';
import type { Migration } from './migrations/index';

export class MigrationError extends Error {
  readonly code: 'migration_failed' | 'unknown_breaking_migration';

  constructor(code: MigrationError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MigrationError';
    this.code = code;
  }
}

/** Applique les migrations manquantes en une seule transaction ; refuse une base plus récente (R-VER-7). */
export async function migrate(
  // biome-ignore lint/suspicious/noExplicitAny: les migrations écrivent du DDL hors du schéma typé
  db: Kysely<any>,
  migrations: readonly Migration[],
  clock: Clock,
): Promise<{ applied: string[]; unknownNonBreaking: string[] }> {
  try {
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, breaking INTEGER NOT NULL CHECK (breaking IN (0,1)), applied_at TEXT NOT NULL) STRICT`.execute(
      db,
    );
  } catch (cause) {
    throw new MigrationError('migration_failed', 'Impossible de préparer la table schema_migrations.', {
      cause,
    });
  }
  const rows = (await db.selectFrom('schemaMigrations').select(['id', 'breaking']).execute()) as {
    id: string;
    breaking: number;
  }[];
  const known = new Set(migrations.map((m) => m.id));
  const unknown = rows.filter((r) => !known.has(r.id));
  const futureBreaking = unknown.find((r) => r.breaking === 1);
  if (futureBreaking) {
    throw new MigrationError(
      'unknown_breaking_migration',
      `La base contient la migration cassante inconnue ${futureBreaking.id} : elle vient d'une version plus récente de l'application.`,
    );
  }
  const done = new Set(rows.map((r) => r.id));
  const pending = migrations.filter((m) => !done.has(m.id));
  const applied: string[] = [];
  if (pending.length > 0) {
    let current = '';
    try {
      await db.transaction().execute(async (trx) => {
        for (const m of pending) {
          current = m.id;
          await m.up(trx);
          await trx
            .insertInto('schemaMigrations')
            .values({ id: m.id, breaking: m.breaking ? 1 : 0, appliedAt: clock.now().toISOString() })
            .execute();
          applied.push(m.id);
        }
      });
    } catch (cause) {
      throw new MigrationError(
        'migration_failed',
        `La migration ${current} a échoué : toute la série est annulée.`,
        {
          cause,
        },
      );
    }
  }
  return { applied, unknownNonBreaking: unknown.map((r) => r.id) };
}
