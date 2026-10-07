import type { Kysely } from 'kysely';
import { socle } from './0001_socle';

export interface Migration {
  id: string;
  breaking: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: une migration écrit du DDL hors du schéma typé
  up(db: Kysely<any>): Promise<void>;
}

/** Migrations du socle, dans l'ordre. */
export const MIGRATIONS: readonly Migration[] = [socle];
