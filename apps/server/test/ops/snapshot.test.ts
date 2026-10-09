import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { nextRev } from '../../src/db/rev';
import { pruneSnapshots, SnapshotError, takeSnapshot } from '../../src/ops/snapshot';
import { FakeClock } from '../support';
import { createOpsDataDir, integrity, type OpsDataDir, readOnly } from './helpers';

const OK = [{ integrity_check: 'ok' }];

let ops: OpsDataDir | undefined;
let scratch: string | undefined;

afterEach(() => {
  ops?.close();
  // Sans `force` : sous Windows, EBUSY si une base reste ouverte.
  if (ops) rmSync(ops.dir, { recursive: true });
  if (scratch) rmSync(scratch, { recursive: true });
  ops = undefined;
  scratch = undefined;
});

const snapshots = (dir: string) => join(dir, 'snapshots');

describe('takeSnapshot', () => {
  it('daily : date civile de Paris, copie en journal DELETE, sans -wal ni .partial', async () => {
    ops = await createOpsDataDir();
    mkdirSync(snapshots(ops.dir));
    // Reste d'un instantané interrompu : supprimé avant la copie.
    writeFileSync(join(snapshots(ops.dir), 'daily-20261007.db.partial'), 'interrompu');
    const clock = new FakeClock('2026-10-06T22:30:00.000Z');
    const path = await takeSnapshot({ sqlite: ops.sqlite, dataDir: ops.dir, clock }, 'daily');
    expect(path).toBe(join(ops.dir, 'snapshots', 'daily-20261007.db'));
    expect(readdirSync(snapshots(ops.dir))).toEqual(['daily-20261007.db']);
    expect(readOnly(path, (s) => s.prepare('PRAGMA journal_mode').get())).toEqual({ journal_mode: 'delete' });
    expect(integrity(path)).toEqual(OK);
  });

  it('pre-vX.Y.Z → snapshots/pre-vX.Y.Z.db', async () => {
    ops = await createOpsDataDir();
    const path = await takeSnapshot(
      { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock() },
      'pre-v1.2.3',
    );
    expect(path).toBe(join(ops.dir, 'snapshots', 'pre-v1.2.3.db'));
    expect(readdirSync(snapshots(ops.dir))).toEqual(['pre-v1.2.3.db']);
  });

  it.each(['', 'weekly', 'pre-1.2.3', 'pre-v1.2', 'daily-20261006', '../x', 'pre-v1.2.3/../../x'])(
    '« %s » → { code: invalid_tag }, aucun fichier',
    async (tag) => {
      ops = await createOpsDataDir();
      const attempt = takeSnapshot({ sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock() }, tag);
      await expect(attempt).rejects.toBeInstanceOf(SnapshotError);
      await expect(attempt).rejects.toMatchObject({ code: 'invalid_tag' });
      expect(existsSync(snapshots(ops.dir))).toBe(false);
    },
  );

  it('copie cohérente pendant des écritures concurrentes', { timeout: 60_000 }, async () => {
    ops = await createOpsDataDir();
    ops.sqlite.exec(
      'CREATE TABLE pair_a (n INTEGER PRIMARY KEY, pad TEXT); CREATE TABLE pair_b (n INTEGER PRIMARY KEY, pad TEXT);',
    );
    // Second écrivain sur le même fichier : l'instantané est pris à chaud, le service tourne.
    const writer = new DatabaseSync(ops.dbPath);
    try {
      writer.exec('PRAGMA busy_timeout = 5000');
      const a = writer.prepare('INSERT INTO pair_a (n, pad) VALUES (?, ?)');
      const b = writer.prepare('INSERT INTO pair_b (n, pad) VALUES (?, ?)');
      const pad = 'x'.repeat(200);
      let n = 0;
      const insertPair = () => {
        n += 1;
        a.run(n, pad);
        b.run(n, pad);
      };
      writer.exec('BEGIN IMMEDIATE');
      while (n < 20_000) insertPair();
      writer.exec('COMMIT');

      let settled = false;
      let during = 0;
      const pending = takeSnapshot(
        { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock() },
        'daily',
      ).finally(() => {
        settled = true;
      });
      while (!settled) {
        writer.exec('BEGIN IMMEDIATE');
        insertPair();
        writer.exec('COMMIT');
        during += 1;
        await new Promise((resolve) => setImmediate(resolve));
      }
      const path = await pending;
      expect(during).toBeGreaterThan(0);
      const counts = readOnly(path, (s) => ({
        a: (s.prepare('SELECT count(*) AS c FROM pair_a').get() as { c: number }).c,
        b: (s.prepare('SELECT count(*) AS c FROM pair_b').get() as { c: number }).c,
      }));
      expect(counts.a).toBe(counts.b);
      expect(counts.a).toBeGreaterThanOrEqual(20_000);
      expect(integrity(path)).toEqual(OK);
    } finally {
      writer.close();
    }
  });

  it('un second instantané du même nom remplace le premier', async () => {
    ops = await createOpsDataDir();
    const deps = { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock() };
    const first = await takeSnapshot(deps, 'daily');
    await nextRev(ops.db);
    const second = await takeSnapshot(deps, 'daily');
    expect(second).toBe(first);
    expect(readdirSync(snapshots(ops.dir))).toEqual(['daily-20261006.db']);
    const counter = readOnly(second, (s) => s.prepare('SELECT sync_counter FROM server_meta').get());
    expect(counter).toEqual({ sync_counter: 1 });
  });
});

describe('pruneSnapshots', () => {
  const place = (dir: string, name: string, iso: string, kind: 'file' | 'dir' = 'file') => {
    const path = join(dir, name);
    if (kind === 'dir') {
      mkdirSync(path);
      writeFileSync(join(path, 'appsport.db'), 'ancienne');
    } else {
      writeFileSync(path, name);
    }
    utimesSync(path, new Date(iso), new Date(iso));
  };

  it('garde les 3 plus récents de chaque préfixe (mtime, pas le nom) ; les autres fichiers sont ignorés', async () => {
    scratch = mkdtempSync(join(tmpdir(), 'appsport-prune-'));
    const dir = snapshots(scratch);
    mkdirSync(dir);
    for (const day of [1, 2, 3, 4, 5]) place(dir, `daily-2026100${day}.db`, `2026-10-0${day}T01:30:00Z`);
    place(dir, 'pre-v1.9.0.db', '2026-10-01T12:00:00Z');
    place(dir, 'pre-v1.10.0.db', '2026-10-02T12:00:00Z');
    place(dir, 'pre-v1.11.0.db', '2026-10-03T12:00:00Z');
    place(dir, 'pre-v1.12.0.db', '2026-10-04T12:00:00Z');
    place(dir, 'notes.txt', '2026-08-01T00:00:00Z');

    const removed = await pruneSnapshots(scratch, new Date('2026-10-07T12:00:00Z'));
    expect([...removed].sort()).toEqual(['daily-20261001.db', 'daily-20261002.db', 'pre-v1.9.0.db']);
    expect(readdirSync(dir).sort()).toEqual([
      'daily-20261003.db',
      'daily-20261004.db',
      'daily-20261005.db',
      'notes.txt',
      'pre-v1.10.0.db',
      'pre-v1.11.0.db',
      'pre-v1.12.0.db',
    ]);
  });

  it('rien de plus de 30 jours, même seul de son groupe ; bases remplacées comprises (R-OPS-10, R-OPS-16)', async () => {
    scratch = mkdtempSync(join(tmpdir(), 'appsport-prune-'));
    const dir = snapshots(scratch);
    mkdirSync(dir);
    place(dir, 'pre-v1.0.0.db', '2026-09-06T00:00:00Z');
    place(dir, 'replaced-20260906T000000Z', '2026-09-06T00:00:00Z', 'dir');
    place(dir, 'replaced-20261001T000000Z', '2026-10-01T00:00:00Z', 'dir');

    const removed = await pruneSnapshots(scratch, new Date('2026-10-07T12:00:00Z'));
    expect([...removed].sort()).toEqual(['pre-v1.0.0.db', 'replaced-20260906T000000Z']);
    expect(readdirSync(dir)).toEqual(['replaced-20261001T000000Z']);
  });

  it("base remplacée : l'âge vient de l'horodatage du nom, qu'un accès récent ne rajeunit pas (R-OPS-16, T40-F10)", async () => {
    scratch = mkdtempSync(join(tmpdir(), 'appsport-prune-'));
    const dir = snapshots(scratch);
    mkdirSync(dir);
    // Ouverte récemment (sqlite3, privacy:collect) : mtime du dossier remis à neuf, données de plus de 30 jours.
    place(dir, 'replaced-20260906T000000Z', '2026-10-06T00:00:00Z', 'dir');
    // Nom illisible : repli sur le mtime, récent ici.
    place(dir, 'replaced-illisible', '2026-10-06T00:00:00Z', 'dir');
    // Horodatage récent mais mtime ancien : le plus ancien des deux l'emporte.
    place(dir, 'replaced-20261005T000000Z', '2026-09-01T00:00:00Z', 'dir');

    const removed = await pruneSnapshots(scratch, new Date('2026-10-07T12:00:00Z'));
    expect([...removed].sort()).toEqual(['replaced-20260906T000000Z', 'replaced-20261005T000000Z']);
    expect(readdirSync(dir)).toEqual(['replaced-illisible']);
  });

  it('instantané interrompu (.partial et annexes) : supprimé passé 30 jours, jamais compté (R-OPS-10, T40-F3)', async () => {
    scratch = mkdtempSync(join(tmpdir(), 'appsport-prune-'));
    const dir = snapshots(scratch);
    mkdirSync(dir);
    place(dir, 'daily-20261001.db.partial', '2026-09-01T03:30:00Z');
    place(dir, 'daily-20261001.db.partial-journal', '2026-09-01T03:30:00Z');
    place(dir, 'pre-v1.0.0.db.partial-wal', '2026-09-01T03:30:00Z');
    // Récent : peut-être en cours d'écriture, laissé en place et hors du compte des 3 derniers.
    place(dir, 'daily-20261006.db.partial', '2026-10-06T01:30:00Z');
    for (const day of [3, 4, 5]) place(dir, `daily-2026100${day}.db`, `2026-10-0${day}T01:30:00Z`);
    place(dir, 'notes.txt', '2026-08-01T00:00:00Z');

    const removed = await pruneSnapshots(scratch, new Date('2026-10-07T12:00:00Z'));
    expect([...removed].sort()).toEqual([
      'daily-20261001.db.partial',
      'daily-20261001.db.partial-journal',
      'pre-v1.0.0.db.partial-wal',
    ]);
    expect(readdirSync(dir).sort()).toEqual([
      'daily-20261003.db',
      'daily-20261004.db',
      'daily-20261005.db',
      'daily-20261006.db.partial',
      'notes.txt',
    ]);
  });

  it('sans dossier snapshots → rien à faire', async () => {
    scratch = mkdtempSync(join(tmpdir(), 'appsport-prune-'));
    expect(await pruneSnapshots(scratch, new Date())).toEqual([]);
  });
});
