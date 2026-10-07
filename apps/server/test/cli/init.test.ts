import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isUuidV7 } from '@appsport/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFlags, runCli, runInit } from '../../src/cli';
import { loadConfig } from '../../src/config';
import { MIGRATIONS } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { getServerMeta } from '../../src/db/server-meta';

let dir: string;
let env: Record<string, string>;
let out: string[];
let err: string[];
const o = (line: string): void => {
  out.push(line);
};
const e = (line: string): void => {
  err.push(line);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'appsport-cli-'));
  env = { APP_ORIGIN: 'http://localhost:3999', APPSPORT_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' };
  out = [];
  err = [];
});

afterEach(() => {
  // Sans `force` : sous Windows, EBUSY si une base reste ouverte.
  rmSync(dir, { recursive: true });
});

const sentinel = (): void => writeFileSync(join(dir, '.appsport-volume'), '');

describe('init', () => {
  it('exige la sentinelle', async () => {
    expect(await runCli(['init'], env, o, e)).toBe(1);
    expect(err.join('\n')).toMatch(/sentinelle/i);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("crée la base, migre, initialise l'époque ; un second init est refusé", async () => {
    sentinel();
    expect(await runCli(['init'], env, o, e)).toBe(0);
    const { sqlite, db } = openDatabase(join(dir, 'appsport.db'));
    const meta = await getServerMeta(db);
    await db.destroy();
    sqlite.close();
    expect(isUuidV7(meta.serverEpoch)).toBe(true);
    expect(out).toContain(`Base initialisée : ${join(dir, 'appsport.db')}`);
    expect(out).toContain(`Époque du serveur : ${meta.serverEpoch}`);
    expect(await runCli(['init'], env, o, e)).toBe(1);
    expect(err.join('\n')).toMatch(/existe déjà/);
  });
});

it('un init en échec ne laisse aucun fichier et un second init réussit', async () => {
  sentinel();
  const failing = {
    id: '0002_boom',
    breaking: false,
    up: async () => {
      throw new Error('boom');
    },
  };
  const ctx = { env, out: o, err: e };
  await expect(runInit(loadConfig(env), ctx, [...MIGRATIONS, failing])).rejects.toThrow();
  expect(readdirSync(dir)).toEqual(['.appsport-volume']);
  expect(await runCli(['init'], env, o, e)).toBe(0);
});

describe('db:check', () => {
  it('sur une base saine', async () => {
    sentinel();
    await runCli(['init'], env, o, e);
    out = [];
    expect(await runCli(['db:check'], env, o, e)).toBe(0);
    expect(out.at(-1)).toBe('OK');
  });

  it('sur une base corrompue → 1', async () => {
    sentinel();
    await runCli(['init'], env, o, e);
    const { sqlite, db } = openDatabase(join(dir, 'appsport.db'));
    sqlite.exec('PRAGMA foreign_keys = OFF');
    sqlite
      .prepare(
        "INSERT INTO applied_op (op_id, user_id, entity, row_id, status, applied_at) VALUES ('x', 'ghost', 'e', 'i', 'applied', 't')",
      )
      .run();
    await db.destroy();
    sqlite.close();
    expect(await runCli(['db:check'], env, o, e)).toBe(1);
    expect(err.join('\n')).toMatch(/Base corrompue/);
  });

  it('sans base → 1, aucun fichier créé', async () => {
    sentinel();
    expect(await runCli(['db:check'], env, o, e)).toBe(1);
    expect(readdirSync(dir)).toEqual(['.appsport-volume']);
  });
});

it('commande inconnue → 1', async () => {
  expect(await runCli(['nope'], env, o, e)).toBe(1);
  expect(err.join('\n')).toMatch(/Commande inconnue : nope/);
  expect(err.join('\n')).toMatch(/init/);
});

it('parseFlags', () => {
  expect(parseFlags(['alice', '--birth-date', '2000-01-01'])).toEqual({
    positional: ['alice'],
    flags: { 'birth-date': '2000-01-01' },
  });
});
