import type { EntityRulesMap } from '@appsport/contracts';
import type { Hono } from 'hono';
import { createApp } from '../../src/app';
import type { AppEnv } from '../../src/app-env';
import { type AppConfig, loadConfig } from '../../src/config';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS, type Migration } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { initServerMeta } from '../../src/db/server-meta';
import { type AppDeps, type Argon2Params, createAppDeps } from '../../src/deps';
import { createLogger } from '../../src/logger';
import { FakeClock } from './clock';
import { seqIds } from './ids';

export const TEST_ARGON2: Argon2Params = {
  memoryKiB: 1024,
  passes: 1,
  parallelism: 1,
  tagLength: 32,
  saltLength: 16,
};

export interface TestRequestInit {
  method?: string;
  json?: unknown;
  cookie?: string;
  origin?: string | null;
  ip?: string;
  headers?: Record<string, string>;
}

export interface TestContext {
  app: Hono<AppEnv>;
  deps: AppDeps;
  clock: FakeClock;
  request(path: string, init?: TestRequestInit): Promise<Response>;
  close(): void;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function createTestContext(
  opts: {
    now?: string;
    config?: Partial<AppConfig>;
    extraMigrations?: Migration[];
    entityRules?: EntityRulesMap;
    deps?: Partial<AppDeps>;
    /** Fichier au lieu de ':memory:' ; initServerMeta si server_meta est vide. */
    dbPath?: string;
  } = {},
): Promise<TestContext> {
  const clock = new FakeClock(opts.now);
  const ids = seqIds();
  const { sqlite, db } = openDatabase(opts.dbPath ?? ':memory:');
  try {
    await migrate(db, [...MIGRATIONS, ...(opts.extraMigrations ?? [])], clock);
    const existing = await db.selectFrom('serverMeta').select('serverEpoch').executeTakeFirst();
    if (!existing) await initServerMeta(db, { ids, clock });
  } catch (error) {
    sqlite.close();
    throw error;
  }
  const config: AppConfig = {
    ...loadConfig({ APP_ORIGIN: 'https://appsport.test.ts.net' }),
    argon2: TEST_ARGON2,
    ...opts.config,
  };
  const deps: AppDeps = {
    ...createAppDeps({
      sqlite,
      db,
      config,
      clock,
      ids,
      logger: createLogger(() => {}),
      ...(opts.entityRules ? { entityRules: opts.entityRules } : {}),
    }),
    ...opts.deps,
  };
  const app = createApp(deps);
  return {
    app,
    deps,
    clock,
    request(path, init = {}) {
      const method = (init.method ?? 'GET').toUpperCase();
      const headers: Record<string, string> = {};
      if (WRITE_METHODS.has(method) && init.origin !== null) {
        headers.Origin = init.origin ?? deps.config.appOrigin;
      }
      if (init.json !== undefined) headers['Content-Type'] = 'application/json';
      if (init.cookie) headers.Cookie = init.cookie;
      if (init.ip) headers['X-Forwarded-For'] = init.ip;
      Object.assign(headers, init.headers);
      const body = init.json !== undefined ? JSON.stringify(init.json) : undefined;
      return Promise.resolve(app.request(path, { method, headers, ...(body !== undefined ? { body } : {}) }));
    },
    close() {
      if (deps.sqlite.isOpen) deps.sqlite.close();
    },
  };
}
