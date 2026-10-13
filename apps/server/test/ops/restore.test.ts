import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isUuidV7 } from '@rune/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/open';
import { nextRev } from '../../src/db/rev';
import { getServerMeta } from '../../src/db/server-meta';
import type { IdGen } from '../../src/deps';
import { RestoreError, restoreSnapshot } from '../../src/ops/restore';
import { takeSnapshot } from '../../src/ops/snapshot';
import { FakeClock, seqIds } from '../support';
import { createOpsDataDir, integrity, type OpsDataDir, readOnly, sha256 } from './helpers';

const RESTORED_AT = '2026-10-07T20:00:00.000Z';

let ops: OpsDataDir | undefined;

afterEach(() => {
  ops?.close();
  if (ops) rmSync(ops.dir, { recursive: true });
  ops = undefined;
});

async function prepare(): Promise<{ ops: OpsDataDir; snapshot: string }> {
  ops = await createOpsDataDir();
  const snapshot = await takeSnapshot(
    { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock('2026-10-07T01:30:00.000Z') },
    'daily',
  );
  return { ops, snapshot };
}

/**
 * Compte les marqueurs 'apres-instantane' d'une copie jetable des fichiers `sources` (suffixe → chemin),
 * pour ne jamais ouvrir les originaux : la fermeture reporterait leur WAL dans la base.
 */
function countMarkersInCopy(dir: string, sources: Partial<Record<'' | '-wal' | '-shm', string>>): unknown {
  mkdirSync(dir);
  const path = join(dir, 'db');
  for (const [suffix, source] of Object.entries(sources)) copyFileSync(source, `${path}${suffix}`);
  const sqlite = new DatabaseSync(path);
  try {
    // Base principale seule : la table elle-même peut n'exister que dans le WAL.
    if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name = 'marker'").get()) return { c: 0 };
    return sqlite.prepare("SELECT count(*) AS c FROM marker WHERE label = 'apres-instantane'").get();
  } finally {
    sqlite.close();
  }
}

/** Rien n'a bougé : ni copie en cours, ni base remplacée. */
function expectNoLeftovers(o: OpsDataDir): void {
  expect(readdirSync(o.dir).filter((name) => name.includes('.restoring'))).toEqual([]);
  expect(readdirSync(join(o.dir, 'snapshots')).filter((name) => name.startsWith('replaced-'))).toEqual([]);
}

describe('restoreSnapshot', () => {
  it("nouvelle époque dans la copie, base au compteur de l'instantané, ancienne base gardée", async () => {
    ops = await createOpsDataDir();
    for (let i = 0; i < 3; i += 1) await nextRev(ops.db);
    const before = await getServerMeta(ops.db);
    const snapshot = await takeSnapshot(
      { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock('2026-10-07T01:30:00.000Z') },
      'daily',
    );
    for (let i = 0; i < 5; i += 1) await nextRev(ops.db);
    ops.close();
    const oldHash = sha256(ops.dbPath);

    const result = await restoreSnapshot({
      dataDir: ops.dir,
      snapshotPath: snapshot,
      ids: seqIds(40),
      clock: new FakeClock(RESTORED_AT),
    });

    expect(isUuidV7(result.epoch)).toBe(true);
    expect(result.epoch).not.toBe(before.serverEpoch);
    expect(result.baseRev).toBe(3);
    const replacedDir = join(ops.dir, 'snapshots', 'replaced-20261007T200000Z');
    expect(result.replacedDir).toBe(replacedDir);
    expect(readdirSync(replacedDir)).toEqual(['rune.db']);
    expect(sha256(join(replacedDir, 'rune.db'))).toBe(oldHash);
    expect(readdirSync(ops.dir).filter((name) => name.includes('.restoring'))).toEqual([]);
    // Étape 4 : la copie restaurée repasse en journal DELETE, sans -wal ni -shm à côté.
    expect(readOnly(ops.dbPath, (s) => s.prepare('PRAGMA journal_mode').get())).toEqual({
      journal_mode: 'delete',
    });
    expect(existsSync(`${ops.dbPath}-wal`)).toBe(false);
    expect(existsSync(`${ops.dbPath}-shm`)).toBe(false);

    const restored = openDatabase(ops.dbPath);
    try {
      expect(await getServerMeta(restored.db)).toMatchObject({
        serverEpoch: result.epoch,
        epochBaseRev: 3,
        syncCounter: 3,
        epochStartedAt: RESTORED_AT,
      });
    } finally {
      restored.sqlite.close();
    }
  });

  it('instantané corrompu → integrity_failed, base courante intacte', async () => {
    const { ops: o, snapshot } = await prepare();
    // Pages 2 et 3 écrasées (pages de 4096 octets).
    const fd = openSync(snapshot, 'r+');
    writeSync(fd, Buffer.alloc(2 * 4096, 0xa5), 0, 2 * 4096, 4096);
    closeSync(fd);
    o.close();
    const hash = sha256(o.dbPath);
    const attempt = restoreSnapshot({
      dataDir: o.dir,
      snapshotPath: snapshot,
      ids: seqIds(40),
      clock: new FakeClock(RESTORED_AT),
    });
    await expect(attempt).rejects.toBeInstanceOf(RestoreError);
    await expect(attempt).rejects.toMatchObject({ code: 'integrity_failed' });
    expect(sha256(o.dbPath)).toBe(hash);
    expectNoLeftovers(o);
  });

  it("échec pendant la rotation d'époque → erreur relancée, base courante intacte", async () => {
    const { ops: o, snapshot } = await prepare();
    o.close();
    const hash = sha256(o.dbPath);
    const failing: IdGen = {
      uuidv7: () => {
        throw new Error('uuidv7 en panne');
      },
      randomBytes: (n) => new Uint8Array(n),
    };
    await expect(
      restoreSnapshot({
        dataDir: o.dir,
        snapshotPath: snapshot,
        ids: failing,
        clock: new FakeClock(RESTORED_AT),
      }),
    ).rejects.toThrow('uuidv7 en panne');
    expect(sha256(o.dbPath)).toBe(hash);
    expectNoLeftovers(o);
  });

  it('seconde restauration dans la même seconde → refusée, la première base remplacée reste intacte', async () => {
    const { ops: o, snapshot } = await prepare();
    o.close();
    const firstHash = sha256(o.dbPath);
    const restore = () =>
      restoreSnapshot({
        dataDir: o.dir,
        snapshotPath: snapshot,
        ids: seqIds(40),
        clock: new FakeClock(RESTORED_AT),
      });
    const { replacedDir } = await restore();
    const currentHash = sha256(o.dbPath);
    await expect(restore()).rejects.toThrow(/existe déjà/);
    expect(sha256(join(replacedDir as string, 'rune.db'))).toBe(firstHash);
    expect(sha256(o.dbPath)).toBe(currentHash);
    expect(readdirSync(o.dir).filter((name) => name.includes('.restoring'))).toEqual([]);
  });

  it('instantané absent → snapshot_missing', async () => {
    const { ops: o } = await prepare();
    o.close();
    const hash = sha256(o.dbPath);
    await expect(
      restoreSnapshot({
        dataDir: o.dir,
        snapshotPath: join(o.dir, 'snapshots', 'absent.db'),
        ids: seqIds(40),
        clock: new FakeClock(RESTORED_AT),
      }),
    ).rejects.toMatchObject({ code: 'snapshot_missing' });
    expect(sha256(o.dbPath)).toBe(hash);
    expectNoLeftovers(o);
  });

  it("WAL étranger : les -wal et -shm de l'ancienne base partent avec elle (Review Focus 4)", async () => {
    ops = await createOpsDataDir();
    ops.sqlite.exec('CREATE TABLE marker (label TEXT)');
    const snapshot = await takeSnapshot(
      { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock('2026-10-07T01:30:00.000Z') },
      'daily',
    );
    ops.sqlite.exec("INSERT INTO marker (label) VALUES ('apres-instantane')");
    // Serveur arrêté net : la base et son WAL non reporté sont recopiés avant la fermeture, qui viderait le WAL.
    const crash = join(ops.dir, 'crash');
    mkdirSync(crash);
    for (const suffix of ['', '-wal', '-shm'])
      copyFileSync(`${ops.dbPath}${suffix}`, join(crash, `db${suffix}`));
    ops.close();
    // Le marqueur n'existe que dans le WAL copié : sinon l'absence du marqueur après restauration ne prouverait rien.
    expect(statSync(join(crash, 'db-wal')).size).toBeGreaterThan(0);
    const crashPair = { '': join(crash, 'db'), '-wal': join(crash, 'db-wal'), '-shm': join(crash, 'db-shm') };
    expect(countMarkersInCopy(join(ops.dir, 'crash-pair'), crashPair)).toEqual({ c: 1 });
    expect(countMarkersInCopy(join(ops.dir, 'crash-main'), { '': join(crash, 'db') })).toEqual({ c: 0 });
    for (const suffix of ['', '-wal', '-shm'])
      copyFileSync(join(crash, `db${suffix}`), `${ops.dbPath}${suffix}`);

    const result = await restoreSnapshot({
      dataDir: ops.dir,
      snapshotPath: snapshot,
      ids: seqIds(40),
      clock: new FakeClock(RESTORED_AT),
    });

    expect(existsSync(`${ops.dbPath}-wal`)).toBe(false);
    expect(existsSync(`${ops.dbPath}-shm`)).toBe(false);
    expect(readdirSync(result.replacedDir as string).sort()).toEqual([
      'rune.db',
      'rune.db-shm',
      'rune.db-wal',
    ]);
    const markers = readOnly(ops.dbPath, (s) =>
      s.prepare("SELECT count(*) AS c FROM marker WHERE label = 'apres-instantane'").get(),
    );
    expect(markers).toEqual({ c: 0 });
    expect(integrity(ops.dbPath)).toEqual([{ integrity_check: 'ok' }]);
  });

  it('réparation R-OPS-16 : restaurer replaced-*/rune.db reprend les transactions de son -wal', async () => {
    ops = await createOpsDataDir();
    const snapshot = await takeSnapshot(
      { sqlite: ops.sqlite, dataDir: ops.dir, clock: new FakeClock('2026-10-07T01:30:00.000Z') },
      'daily',
    );
    // Seule la table marker reste à reporter : le reste de la base est déjà dans le fichier principal.
    ops.sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    ops.sqlite.exec("CREATE TABLE marker (label TEXT); INSERT INTO marker (label) VALUES ('dans-le-wal')");
    // Arrêt brutal : la base et son WAL non reporté sont recopiés avant la fermeture, qui viderait le WAL.
    const crash = join(ops.dir, 'crash');
    mkdirSync(crash);
    for (const suffix of ['', '-wal', '-shm'])
      copyFileSync(`${ops.dbPath}${suffix}`, join(crash, `db${suffix}`));
    ops.close();
    for (const suffix of ['', '-wal', '-shm'])
      copyFileSync(join(crash, `db${suffix}`), `${ops.dbPath}${suffix}`);

    // Mauvais choix d'instantané en P4, puis réparation depuis la base remplacée.
    const wrong = await restoreSnapshot({
      dataDir: ops.dir,
      snapshotPath: snapshot,
      ids: seqIds(40),
      clock: new FakeClock(RESTORED_AT),
    });
    const source = join(wrong.replacedDir as string, 'rune.db');
    const sourceHashes = [sha256(source), sha256(`${source}-wal`)];
    await restoreSnapshot({
      dataDir: ops.dir,
      snapshotPath: source,
      ids: seqIds(60),
      clock: new FakeClock('2026-10-07T20:05:00.000Z'),
    });

    const markers = readOnly(ops.dbPath, (s) =>
      s.prepare("SELECT count(*) AS c FROM marker WHERE label = 'dans-le-wal'").get(),
    );
    expect(markers).toEqual({ c: 1 });
    expect(integrity(ops.dbPath)).toEqual([{ integrity_check: 'ok' }]);
    expect(existsSync(`${ops.dbPath}-wal`)).toBe(false);
    // La source n'est pas modifiée : la base remplacée reste disponible telle quelle.
    expect([sha256(source), sha256(`${source}-wal`)]).toEqual(sourceHashes);
  });
});
