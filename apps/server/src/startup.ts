import type { DatabaseSync } from 'node:sqlite';
import type { Kysely } from 'kysely';
import { CATALOG_STARTUP_TASK } from './catalog/loader';
import type { AppConfig } from './config';
import { migrate } from './db/migrate';
import { MIGRATIONS } from './db/migrations/index';
import { openDatabase } from './db/open';
import type { Database } from './db/schema';
import { type AppDeps, type Clock, systemClock } from './deps';
import type { Logger } from './logger';

export interface StartupTask {
  name: string;
  run(deps: AppDeps): Promise<void>;
}

/** Tâches exécutées avant l'écoute ; les tâches suivantes s'ajoutent ici. */
export const STARTUP_TASKS: StartupTask[] = [CATALOG_STARTUP_TASK];

/** Ouvre la base et applique les migrations ; en cas d'échec, la base est refermée avant de relancer. */
export async function openMigrated(
  config: AppConfig,
  logger: Logger,
  clock: Clock = systemClock,
): Promise<{ sqlite: DatabaseSync; db: Kysely<Database> }> {
  const opened = openDatabase(config.dbPath);
  try {
    const { unknownNonBreaking } = await migrate(opened.db, MIGRATIONS, clock);
    for (const migration of unknownNonBreaking) logger.warn('unknown_migration', { migration });
  } catch (error) {
    opened.sqlite.close();
    throw error;
  }
  return opened;
}
