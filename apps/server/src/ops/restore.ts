import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../db/open';
import type { Clock, IdGen } from '../deps';
import { rotateServerEpoch } from '../sync/epoch';
import { snapshotsDir } from './snapshot';

const DB_FILE = 'appsport.db';
/** La base et ses fichiers annexes : un -wal laissé à côté serait rejoué sur la base restaurée. */
const DB_SUFFIXES = ['', '-wal', '-shm'] as const;

export class RestoreError extends Error {
  readonly code: 'snapshot_missing' | 'integrity_failed';

  constructor(code: RestoreError['code'], message: string) {
    super(message);
    this.name = 'RestoreError';
    this.code = code;
  }
}

function assertIntact(snapshotPath: string): void {
  let result: unknown;
  try {
    const sqlite = new DatabaseSync(snapshotPath, { readOnly: true });
    try {
      result = sqlite.prepare('PRAGMA integrity_check').all();
    } finally {
      sqlite.close();
    }
  } catch {
    result = null;
  }
  const rows = result as { integrity_check?: unknown }[] | null;
  if (rows?.length !== 1 || rows[0]?.integrity_check !== 'ok') {
    throw new RestoreError(
      'integrity_failed',
      'Instantané corrompu (PRAGMA integrity_check) : base actuelle laissée intacte.',
    );
  }
}

/** `2026-10-07T20:00:00.000Z` → `20261007T200000Z`. */
function compactUtc(at: Date): string {
  return `${at.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '')}Z`;
}

/**
 * Restaure `snapshotPath` à la place de `<dataDir>/appsport.db`, service arrêté (08 §12 P4, R-SYN-25,
 * R-OPS-16). Ordre imposé (Review Focus 4) : instantané présent et intègre ; copie en `.restoring` où
 * l'époque est tournée (base = compteur de l'instantané) et le journal repassé en DELETE ; alors seulement,
 * la base courante et ses -wal et -shm partent dans `snapshots/replaced-<AAAAMMJJTHHMMSSZ>/`, puis la copie
 * prend sa place. Tout échec avant ce déplacement laisse la base courante intacte, sans `.restoring`.
 */
export async function restoreSnapshot(o: {
  dataDir: string;
  snapshotPath: string;
  ids: IdGen;
  clock: Clock;
}): Promise<{ epoch: string; baseRev: number; replacedDir: string | null }> {
  if (!existsSync(o.snapshotPath)) {
    throw new RestoreError('snapshot_missing', `Instantané introuvable : ${o.snapshotPath}.`);
  }
  assertIntact(o.snapshotPath);

  const dbPath = join(o.dataDir, DB_FILE);
  const restoring = `${dbPath}.restoring`;
  const removeRestoring = (): void => {
    for (const suffix of [...DB_SUFFIXES, '-journal']) rmSync(`${restoring}${suffix}`, { force: true });
  };
  removeRestoring();
  let rotated: { epoch: string; baseRev: number };
  try {
    copyFileSync(o.snapshotPath, restoring);
    const { sqlite, db } = openDatabase(restoring);
    try {
      rotated = await rotateServerEpoch(db, { ids: o.ids, clock: o.clock });
      sqlite.exec('PRAGMA journal_mode = DELETE');
    } finally {
      sqlite.close();
    }
  } catch (error) {
    removeRestoring();
    throw error;
  }

  const present = DB_SUFFIXES.filter((suffix) => existsSync(`${dbPath}${suffix}`));
  let replacedDir: string | null = null;
  if (present.length > 0) {
    replacedDir = join(snapshotsDir(o.dataDir), `replaced-${compactUtc(o.clock.now())}`);
    if (existsSync(replacedDir)) {
      // Deux restaurations dans la même seconde : la base remplacée par la première ne doit pas être écrasée.
      removeRestoring();
      throw new Error(`${replacedDir} existe déjà : relancez la restauration dans une seconde.`);
    }
    mkdirSync(replacedDir, { recursive: true });
    const moved: string[] = [];
    try {
      for (const suffix of present) {
        renameSync(`${dbPath}${suffix}`, join(replacedDir, `${DB_FILE}${suffix}`));
        moved.push(suffix);
      }
    } catch (error) {
      // Base encore ouverte (service en marche, sous Windows) : tout est remis en place.
      for (const suffix of moved) renameSync(join(replacedDir, `${DB_FILE}${suffix}`), `${dbPath}${suffix}`);
      rmSync(replacedDir, { recursive: true, force: true });
      removeRestoring();
      throw error;
    }
  }
  renameSync(restoring, dbPath);
  return { ...rotated, replacedDir };
}
