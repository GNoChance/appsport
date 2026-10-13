import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { logSecurityEvent } from '../../src/auth/security-log';
import { runCli } from '../../src/cli';
import { dbStats } from '../../src/ops/db-stats';
import { createTestContext, createUser, insertFixtureRow, type TestContext } from '../support';
import { sha256 } from './helpers';

async function withContext(fn: (ctx: TestContext) => Promise<void>, dbPath?: string): Promise<void> {
  const ctx = await createTestContext({ now: '2026-10-06T10:00:00.000Z', ...(dbPath ? { dbPath } : {}) });
  try {
    await fn(ctx);
  } finally {
    ctx.close();
  }
}

describe('dbStats (R-OPS-11, Interfaces §8)', () => {
  it('base vide : intégrité ok, aucun utilisateur, aucune écriture', async () => {
    await withContext(async ({ deps }) => {
      expect(dbStats(deps.sqlite)).toEqual({ integrity: 'ok', users: 0, syncCounter: 0, lastWriteAt: null });
    });
  });

  it('un utilisateur : users 1, syncCounter ≥ 1, lastWriteAt = security_event.at le plus récent', async () => {
    await withContext(async (ctx) => {
      const alice = await createUser(ctx, { username: 'alice' });
      ctx.clock.set('2026-10-07T08:00:00.000Z');
      await logSecurityEvent(ctx.deps.db, ctx.deps, {
        type: 'login_succeeded',
        actorId: alice.id,
        targetId: alice.id,
        ip: null,
        outcome: 'success',
      });
      const stats = dbStats(ctx.deps.sqlite);
      expect(stats).toMatchObject({ integrity: 'ok', users: 1, lastWriteAt: '2026-10-07T08:00:00.000Z' });
      expect(stats.syncCounter).toBeGreaterThanOrEqual(1);
    });
  });

  it("lastWriteAt : updated_at de toute table qui l'a (pas seulement user), plus récent que le journal", async () => {
    await withContext(async (ctx) => {
      const alice = await createUser(ctx, { username: 'alice' });
      await logSecurityEvent(ctx.deps.db, ctx.deps, {
        type: 'login_succeeded',
        actorId: alice.id,
        targetId: alice.id,
        ip: null,
        outcome: 'success',
      });
      await insertFixtureRow(ctx.deps.db, 'place', {
        ownerId: alice.id,
        updatedAt: '2026-10-08T09:00:00.000Z',
      });
      expect(dbStats(ctx.deps.sqlite).lastWriteAt).toBe('2026-10-08T09:00:00.000Z');
    });
  });

  /** Base factice : seul `PRAGMA integrity_check` répond (lignes ou exception) ; chaque prepare est noté. */
  function integrityStub(integrity: Record<string, unknown>[] | Error): {
    sqlite: DatabaseSync;
    prepared: string[];
  } {
    const prepared: string[] = [];
    const prepare = (sql: string) => {
      prepared.push(sql);
      if (integrity instanceof Error) throw integrity;
      if (sql !== 'PRAGMA integrity_check') throw new Error(`lecture inattendue : ${sql}`);
      return { all: () => integrity, get: () => integrity[0] };
    };
    return { sqlite: { prepare } as unknown as DatabaseSync, prepared };
  }

  it('intégrité KO sur plusieurs lignes : lignes jointes par \\n, rien d’autre lu', () => {
    const { sqlite, prepared } = integrityStub([{ integrity_check: 'a' }, { integrity_check: 'b' }]);
    expect(dbStats(sqlite)).toEqual({ integrity: 'a\nb', users: 0, syncCounter: 0, lastWriteAt: null });
    expect(prepared).toEqual(['PRAGMA integrity_check']);
  });

  it('integrity_check qui lève : son message, compteurs à 0, rien d’autre lu', () => {
    const { sqlite, prepared } = integrityStub(new Error('boom'));
    expect(dbStats(sqlite)).toEqual({ integrity: 'boom', users: 0, syncCounter: 0, lastWriteAt: null });
    expect(prepared).toEqual(['PRAGMA integrity_check']);
  });
});

describe('CLI db:stats (sans APP_ORIGIN : lancé par rune-restore-test sans env_file)', () => {
  let dir: string;
  let dbPath: string;
  let lines: string[];
  let errors: string[];
  /** Seul RUNE_DATA_DIR : ni APP_ORIGIN, ni garde, ni migration. */
  const cli = (...argv: string[]) =>
    runCli(
      argv,
      { RUNE_DATA_DIR: dir },
      (line) => lines.push(line),
      (line) => errors.push(line),
    );

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'rune-db-stats-'));
    dbPath = join(dir, 'rune.db');
    lines = [];
    errors = [];
    writeFileSync(join(dir, '.rune-volume'), '');
    const init = await runCli(
      ['init'],
      { APP_ORIGIN: 'http://localhost:3999', RUNE_DATA_DIR: dir },
      () => {},
    );
    expect(init).toBe(0);
  });

  afterEach(() => {
    // Sans `force` : sous Windows, EBUSY si la CLI laissait la base ouverte.
    rmSync(dir, { recursive: true });
  });

  it('après init : une ligne JSON, code 0', async () => {
    expect(await cli('db:stats')).toBe(0);
    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toEqual({
      integrity: 'ok',
      users: 0,
      syncCounter: 0,
      lastWriteAt: null,
    });
  });

  it('migration cassante inconnue (0099_future) : lue quand même, base inchangée', async () => {
    await withContext(async (ctx) => {
      await createUser(ctx, { username: 'alice' });
    }, dbPath);
    const writer = new DatabaseSync(dbPath);
    writer
      .prepare('INSERT INTO schema_migrations (id, breaking, applied_at) VALUES (?, 1, ?)')
      .run('0099_future', '2026-10-07T00:00:00.000Z');
    writer.close();
    const before = sha256(dbPath);

    expect(await cli('db:stats')).toBe(0);
    expect(errors).toEqual([]);
    const stats = JSON.parse(lines[0] as string);
    expect(stats).toMatchObject({ integrity: 'ok', users: 1 });
    expect(stats.syncCounter).toBeGreaterThanOrEqual(1);
    expect(sha256(dbPath)).toBe(before);
  });

  it('pages 2 et 3 écrasées : code 0, intégrité KO, compteurs à 0, aucune date', async () => {
    await withContext(async (ctx) => {
      await createUser(ctx, { username: 'alice' });
    }, dbPath);
    const fd = openSync(dbPath, 'r+');
    writeSync(fd, Buffer.alloc(2 * 4096, 0xa5), 0, 2 * 4096, 4096);
    closeSync(fd);

    expect(await cli('db:stats')).toBe(0);
    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    const stats = JSON.parse(lines[0] as string);
    expect(stats.integrity).not.toBe('ok');
    expect(stats.integrity).not.toBe('');
    expect(stats).toMatchObject({ users: 0, syncCounter: 0, lastWriteAt: null });
  });

  it('base absente : code 1, « Base introuvable : <chemin>. »', async () => {
    rmSync(dbPath);
    expect(await cli('db:stats')).toBe(1);
    expect(lines).toEqual([]);
    expect(errors).toEqual([`Base introuvable : ${dbPath}.`]);
  });
});
