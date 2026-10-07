import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { type AddressInfo, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli';
import { loadConfig } from '../src/config';
import { MigrationError } from '../src/db/migrate';
import { openDatabase } from '../src/db/open';
import { createLogger } from '../src/logger';
import { main, startServer } from '../src/main';
import { assertStartupPreconditions, StartupError } from '../src/startup-guard';

let dir: string;
let env: Record<string, string>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'appsport-start-'));
  env = { APP_ORIGIN: 'http://localhost:3999', APPSPORT_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' };
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

const initVolume = async (): Promise<void> => {
  writeFileSync(join(dir, '.appsport-volume'), '');
  expect(
    await runCli(
      ['init'],
      env,
      () => {},
      () => {},
    ),
  ).toBe(0);
};

const startupError = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('garde de démarrage', () => {
  it('sans sentinelle → StartupError no_sentinel', () => {
    const error = startupError(() => assertStartupPreconditions(loadConfig(env)));
    expect(error).toBeInstanceOf(StartupError);
    expect((error as StartupError).code).toBe('no_sentinel');
    expect((error as StartupError).message).toContain('Volume de données absent');
  });

  it('sentinelle sans base → no_database ; startServer rejette et ne crée aucun fichier', async () => {
    writeFileSync(join(dir, '.appsport-volume'), '');
    const error = startupError(() => assertStartupPreconditions(loadConfig(env)));
    expect((error as StartupError).code).toBe('no_database');
    await expect(startServer(env)).rejects.toMatchObject({ code: 'no_database' });
    expect(readdirSync(dir)).toEqual(['.appsport-volume']);
  });
});

describe('startServer', () => {
  it("tâches de démarrage avant l'écoute, /api/health 200, arrêt en moins de 9 s", async () => {
    await initVolume();
    const free = await new Promise<number>((resolve) => {
      const probe = createServer().listen(0, '127.0.0.1', () => {
        const { port } = probe.address() as AddressInfo;
        probe.close(() => resolve(port));
      });
    });
    const calls: string[] = [];
    const s = await startServer(
      { ...env, PORT: String(free) },
      {
        logger: createLogger(() => {}),
        startupTasks: [
          {
            name: 't',
            run: async () => {
              const listening = await fetch(`http://127.0.0.1:${free}/api/health`).then(
                () => true,
                () => false,
              );
              calls.push(listening ? 'startup:already-listening' : 'startup');
            },
          },
        ],
        dailyJobs: [
          {
            name: 'j',
            run: async () => {
              calls.push('job');
            },
          },
        ],
      },
    );
    expect(s.port).toBe(free);
    expect(calls[0]).toBe('startup');
    await vi.waitFor(() => expect(calls).toEqual(['startup', 'job']));
    const res = await fetch(`http://127.0.0.1:${s.port}/api/health`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('ok');
    const t0 = performance.now();
    await s.close();
    expect(performance.now() - t0).toBeLessThan(9000);
  });

  it('échec après openDatabase → base fermée (rmSync réussit) et erreur relancée', async () => {
    await initVolume();
    await expect(
      startServer(env, {
        logger: createLogger(() => {}),
        startupTasks: [
          {
            name: 'boom',
            run: async () => {
              throw new Error('échec');
            },
          },
        ],
      }),
    ).rejects.toThrow('échec');
  });

  it("migration inconnue cassante → { name: 'MigrationError', code: 'unknown_breaking_migration' }", async () => {
    await initVolume();
    const { sqlite } = openDatabase(join(dir, 'appsport.db'));
    sqlite.exec("INSERT INTO schema_migrations (id, breaking, applied_at) VALUES ('0002_future', 1, 't')");
    sqlite.close();
    const error = await startServer(env, { logger: createLogger(() => {}) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MigrationError);
    expect(error).toMatchObject({ name: 'MigrationError', code: 'unknown_breaking_migration' });
  });

  it('migrations inconnues non cassantes → démarre et journalise unknown_migration', async () => {
    await initVolume();
    const { sqlite } = openDatabase(join(dir, 'appsport.db'));
    sqlite.exec("INSERT INTO schema_migrations (id, breaking, applied_at) VALUES ('0002_future', 0, 't')");
    sqlite.close();
    const lines: string[] = [];
    const s = await startServer(env, { logger: createLogger((l) => lines.push(l)) });
    await s.close();
    const entries = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(entries).toContainEqual(
      expect.objectContaining({ level: 'warn', msg: 'unknown_migration', migration: '0002_future' }),
    );
  });
});

it("main(['nope']) → 1", async () => {
  expect(await main(['nope'])).toBe(1);
});
