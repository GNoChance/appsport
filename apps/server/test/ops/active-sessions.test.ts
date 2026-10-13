import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli';
import { listActiveWorkoutSessions } from '../../src/ops/active-sessions';
import { createTestContext, createUser, type TestContext } from '../support';

const NOW = '2026-10-06T20:00:00.000Z';

/** Table de la brique 2, réduite aux colonnes lues (le socle ne la crée pas). */
function createWorkoutSessionTable(sqlite: DatabaseSync): void {
  sqlite.exec(`CREATE TABLE workout_session (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES user(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    deleted_at TEXT
  ) STRICT`);
}

function insertSession(
  sqlite: DatabaseSync,
  id: string,
  ownerId: string,
  startedAt: string,
  o: { status?: string; deletedAt?: string } = {},
): void {
  sqlite
    .prepare(
      'INSERT INTO workout_session (id, owner_id, started_at, ended_at, status, deleted_at) VALUES (?, ?, ?, NULL, ?, ?)',
    )
    .run(id, ownerId, startedAt, o.status ?? 'in_progress', o.deletedAt ?? null);
}

async function withContext(fn: (ctx: TestContext) => Promise<void>, dbPath?: string): Promise<void> {
  const ctx = await createTestContext({ now: NOW, ...(dbPath ? { dbPath } : {}) });
  try {
    await fn(ctx);
  } finally {
    ctx.close();
  }
}

describe('listActiveWorkoutSessions (R-DEP-3, 08 §8)', () => {
  it('base du socle, sans table workout_session : []', async () => {
    await withContext(async ({ deps }) => {
      expect(listActiveWorkoutSessions(deps.sqlite, new Date(NOW))).toEqual([]);
    });
  });

  it('séances in_progress, non supprimées, démarrées depuis strictement moins de 3 h, triées par début', async () => {
    await withContext(async (ctx) => {
      const { sqlite } = ctx.deps;
      const alice = await createUser(ctx, { username: 'alice' });
      const bob = await createUser(ctx, { username: 'bob' });
      const carol = await createUser(ctx, { username: 'carol' });
      createWorkoutSessionTable(sqlite);
      insertSession(sqlite, 's-alice', alice.id, '2026-10-06T19:00:00.000Z');
      insertSession(sqlite, 's-old', bob.id, '2026-10-06T16:59:59.000Z');
      // Pile 3 h avant NOW : exclue (started_at > now − 3 h, pas >=).
      insertSession(sqlite, 's-boundary', carol.id, '2026-10-06T17:00:00.000Z');
      insertSession(sqlite, 's-done', bob.id, '2026-10-06T19:30:00.000Z', { status: 'completed' });
      insertSession(sqlite, 's-abandoned', bob.id, '2026-10-06T19:40:00.000Z', { status: 'abandoned' });
      insertSession(sqlite, 's-deleted', bob.id, '2026-10-06T19:45:00.000Z', {
        deletedAt: '2026-10-06T19:50:00.000Z',
      });
      const now = new Date(NOW);

      expect(listActiveWorkoutSessions(sqlite, now)).toEqual([
        { username: 'alice', startedAt: '2026-10-06T19:00:00.000Z' },
      ]);
      // maxAgeHours : les séances de 16:59:59 et 17:00:00 entrent, et l'ordre suit le début, pas l'insertion.
      expect(listActiveWorkoutSessions(sqlite, now, 4)).toEqual([
        { username: 'bob', startedAt: '2026-10-06T16:59:59.000Z' },
        { username: 'carol', startedAt: '2026-10-06T17:00:00.000Z' },
        { username: 'alice', startedAt: '2026-10-06T19:00:00.000Z' },
      ]);
    });
  });
});

describe('CLI sessions:active', () => {
  it('base du socle → 0 sans ligne ; --hours N filtre, une ligne <pseudo>\\t<startedAt> ; --hours 0 → 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rune-sessions-'));
    try {
      const env = {
        APP_ORIGIN: 'http://localhost:3999',
        RUNE_DATA_DIR: dir,
        HOST: '127.0.0.1',
        PORT: '0',
      };
      const lines: string[] = [];
      const errors: string[] = [];
      const cli = (...argv: string[]) =>
        runCli(
          argv,
          env,
          (line) => lines.push(line),
          (line) => errors.push(line),
        );
      writeFileSync(join(dir, '.rune-volume'), '');
      expect(await cli('init')).toBe(0);
      lines.length = 0;

      expect(await cli('sessions:active', '--hours', '3')).toBe(0);
      expect(lines).toEqual([]);
      expect(errors).toEqual([]);

      // La CLI lit l'horloge système : séance démarrée il y a deux heures.
      const startedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
      await withContext(
        async (ctx) => {
          const alice = await createUser(ctx, { username: 'alice' });
          createWorkoutSessionTable(ctx.deps.sqlite);
          insertSession(ctx.deps.sqlite, 's-alice', alice.id, startedAt);
        },
        join(dir, 'rune.db'),
      );

      expect(await cli('sessions:active', '--hours', '3')).toBe(0);
      expect(lines).toEqual([`alice\t${startedAt}`]);
      expect(errors).toEqual([]);

      // --hours est lu : à 1 h, la séance démarrée il y a 2 h est hors fenêtre.
      lines.length = 0;
      expect(await cli('sessions:active', '--hours', '1')).toBe(0);
      expect(lines).toEqual([]);
      expect(errors).toEqual([]);

      expect(await cli('sessions:active', '--hours', '0')).toBe(1);
      expect(lines).toEqual([]);
      expect(errors).toEqual(["Option --hours invalide : nombre entier d'heures attendu."]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
