import type { Kysely, Transaction } from 'kysely';

// Squelette : les tables du socle arrivent avec la Task 4b.
// biome-ignore lint/suspicious/noEmptyInterface: interface étendue table par table (Task 4b)
export interface Database {}

export type DbExecutor = Kysely<Database> | Transaction<Database>;
