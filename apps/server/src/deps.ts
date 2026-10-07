import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { entityRules as defaultEntityRules, type EntityRulesMap } from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import type { Kysely } from 'kysely';
import type { AppConfig } from './config';
import type { Database } from './db/schema';
import { createLogger, type Logger } from './logger';
import { SYNC_HOOKS, type SyncHooksMap } from './sync/hooks';

export interface Clock {
  now(): Date;
}

export interface IdGen {
  uuidv7(): string;
  randomBytes(n: number): Uint8Array;
}

export const systemClock: Clock = { now: () => new Date() };

export function cryptoIds(): IdGen {
  const bytes = (n: number): Uint8Array => new Uint8Array(randomBytes(n));
  return { uuidv7: createMonotonicUuidV7(() => Date.now(), bytes), randomBytes: bytes };
}

export interface Argon2Params {
  memoryKiB: number;
  passes: number;
  parallelism: number;
  tagLength: number;
  saltLength: number;
}

export const ARGON2_PARAMS: Argon2Params = {
  memoryKiB: 19456,
  passes: 2,
  parallelism: 1,
  tagLength: 32,
  saltLength: 16,
};

export interface AppDeps {
  db: Kysely<Database>;
  sqlite: DatabaseSync;
  clock: Clock;
  ids: IdGen;
  config: AppConfig;
  logger: Logger;
  entityRules: EntityRulesMap;
  syncHooks: SyncHooksMap;
}

export function createAppDeps(o: {
  sqlite: DatabaseSync;
  db: Kysely<Database>;
  config: AppConfig;
  clock?: Clock;
  ids?: IdGen;
  logger?: Logger;
  entityRules?: EntityRulesMap;
  syncHooks?: SyncHooksMap;
}): AppDeps {
  return {
    db: o.db,
    sqlite: o.sqlite,
    config: o.config,
    clock: o.clock ?? systemClock,
    ids: o.ids ?? cryptoIds(),
    logger: o.logger ?? createLogger(),
    entityRules: o.entityRules ?? defaultEntityRules,
    syncHooks: o.syncHooks ?? SYNC_HOOKS,
  };
}
