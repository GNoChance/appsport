import type { Kysely } from 'kysely';

export interface Migration {
  id: string;
  breaking: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: une migration écrit du DDL hors du schéma typé
  up(db: Kysely<any>): Promise<void>;
}

/** Migrations du socle ; la Task 4b ajoute '0001_socle'. */
export const MIGRATIONS: readonly Migration[] = [];
