import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { DB_FILE } from '../config';
import { openDatabase } from '../db/open';
import type { Clock, IdGen } from '../deps';
import { rotateServerEpoch } from '../sync/epoch';
import { snapshotsDir } from './snapshot';

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

function integrityFailed(): RestoreError {
  return new RestoreError(
    'integrity_failed',
    'Instantané corrompu (PRAGMA integrity_check) : base actuelle laissée intacte.',
  );
}

/** `PRAGMA integrity_check` rend exactement `[{ integrity_check: 'ok' }]` ; une exception compte comme un échec. */
function isIntact(sqlite: DatabaseSync): boolean {
  try {
    const rows = sqlite.prepare('PRAGMA integrity_check').all() as { integrity_check?: unknown }[];
    return rows.length === 1 && rows[0]?.integrity_check === 'ok';
  } catch {
    return false;
  }
}

/**
 * Vérifie l'instantané ouvert en lecture seule, puis le copie par l'API de sauvegarde depuis cette même
 * connexion : les octets copiés sont ceux qui ont été vérifiés, -wal voisin compris. Une copie du seul
 * fichier principal perdrait les transactions de ce -wal (base remplacée après un arrêt brutal, puis
 * restaurée pour réparer un mauvais choix, R-OPS-16). La source n'est pas modifiée.
 */
async function copyIntactSnapshot(snapshotPath: string, target: string): Promise<void> {
  let source: DatabaseSync;
  try {
    source = new DatabaseSync(snapshotPath, { readOnly: true });
  } catch {
    throw integrityFailed();
  }
  try {
    if (!isIntact(source)) throw integrityFailed();
    await backup(source, target, { rate: 0x7fffffff });
  } finally {
    source.close();
  }
}

/** `2026-10-07T20:00:00.000Z` → `20261007T200000Z`. */
function compactUtc(at: Date): string {
  return `${at.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '')}Z`;
}

/**
 * Restaure `snapshotPath` à la place de `<dataDir>/rune.db`, service arrêté (08 §12 P4, R-SYN-25,
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

  const dbPath = join(o.dataDir, DB_FILE);
  const restoring = `${dbPath}.restoring`;
  const removeRestoring = (): void => {
    for (const suffix of [...DB_SUFFIXES, '-journal']) rmSync(`${restoring}${suffix}`, { force: true });
  };
  removeRestoring();
  let rotated: { epoch: string; baseRev: number };
  try {
    await copyIntactSnapshot(o.snapshotPath, restoring);
    const { sqlite, db } = openDatabase(restoring);
    try {
      // La copie elle-même est vérifiée : c'est elle qui deviendra la base.
      if (!isIntact(sqlite)) throw integrityFailed();
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
