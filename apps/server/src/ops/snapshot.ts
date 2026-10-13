import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { parisDate } from '@rune/domain';
import type { Clock } from '../deps';

/** `daily` (instantané quotidien) ou `pre-vX.Y.Z` (avant le déploiement de vX.Y.Z) : rien d'autre, pas de chemin. */
export const SNAPSHOT_TAG_RE = /^(daily|pre-v\d+\.\d+\.\d+)$/;

const DAY_MS = 86_400_000;
/** Groupes élagués au nombre (`keep`) ; les bases remplacées (`replaced-*`) ne le sont qu'à l'âge. */
const COUNTED_PREFIXES = ['daily-', 'pre-'] as const;

export class SnapshotError extends Error {
  readonly code: 'invalid_tag';

  constructor(code: SnapshotError['code'], message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

export function assertSnapshotTag(tag: string): void {
  if (!SNAPSHOT_TAG_RE.test(tag)) {
    throw new SnapshotError('invalid_tag', `Étiquette invalide « ${tag} » : attendu daily ou pre-vX.Y.Z.`);
  }
}

export function snapshotsDir(dataDir: string): string {
  return join(dataDir, 'snapshots');
}

function snapshotName(tag: string, now: Date): string {
  return tag === 'daily' ? `daily-${parisDate(now).replaceAll('-', '')}.db` : `${tag}.db`;
}

/**
 * Copie cohérente à chaud (API de sauvegarde SQLite, une seule étape : les écritures concurrentes ne la
 * font pas recommencer) dans `<dataDir>/snapshots/daily-AAAAMMJJ.db` (date de Paris) ou `pre-vX.Y.Z.db`.
 * Écrite sous `.partial`, passée en journal DELETE (fichier seul, sans -wal), puis renommée : jamais
 * d'instantané partiel sous le nom final ; un instantané du même nom est remplacé.
 */
export async function takeSnapshot(
  deps: { sqlite: DatabaseSync; dataDir: string; clock: Clock },
  tag: string,
): Promise<string> {
  assertSnapshotTag(tag);
  const dir = snapshotsDir(deps.dataDir);
  mkdirSync(dir, { recursive: true });
  const final = join(dir, snapshotName(tag, deps.clock.now()));
  const partial = `${final}.partial`;
  const removePartial = (): void => {
    for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${partial}${suffix}`, { force: true });
  };
  removePartial();
  try {
    await backup(deps.sqlite, partial, { rate: 0x7fffffff });
    const copy = new DatabaseSync(partial);
    try {
      copy.exec('PRAGMA journal_mode = DELETE');
    } finally {
      copy.close();
    }
    renameSync(partial, final);
  } catch (error) {
    removePartial();
    throw error;
  }
  return final;
}

interface Entry {
  name: string;
  path: string;
  mtimeMs: number;
  /** Point de départ de la limite d'âge : le mtime, ou l'horodatage du nom s'il est plus ancien (`replaced-*`). */
  agedFromMs: number;
}

/** Instantané complet : élagué à l'âge et au nombre. */
const COUNTED_RE = /^(daily|pre)-.+\.db$/;
/** Reste d'un instantané interrompu par un arrêt brutal (le nom change chaque jour) : élagué à l'âge seul. */
const PARTIAL_RE = /^(daily|pre)-.+\.db\.partial(-wal|-shm|-journal)?$/;
const REPLACED_RE = /^replaced-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

/**
 * Horodatage UTC de `replaced-<AAAAMMJJTHHMMSSZ>`, ou `undefined` s'il est illisible. Ouvrir la base remplacée
 * (sqlite3, privacy:collect) crée puis retire des fichiers dans le dossier : son mtime rajeunit, pas son nom.
 */
function replacedStampMs(name: string): number | undefined {
  const m = REPLACED_RE.exec(name);
  if (!m) return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const ms = Date.parse(`${iso}Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 19) !== iso ? undefined : ms;
}

/**
 * Élagage de `<dataDir>/snapshots` : d'abord tout `daily-*.db`, `pre-*.db`, reste d'instantané interrompu
 * (`*.db.partial` et ses -wal, -shm, -journal) et dossier `replaced-*` de plus de `maxAgeDays` jours (rien ne
 * reste plus de 30 jours, 03 §7, R-OPS-10, R-OPS-16 ; pour `replaced-*`, le plus ancien du mtime et de
 * l'horodatage du nom), puis seuls les `keep` plus récents de `daily-` et de `pre-` (mtime, puis nom ; les
 * `.partial` n'y comptent pas). Les autres fichiers ne sont pas touchés. Rend les noms supprimés.
 */
export async function pruneSnapshots(
  dataDir: string,
  now: Date,
  opts: { keep?: number; maxAgeDays?: number } = {},
): Promise<string[]> {
  const { keep = 3, maxAgeDays = 30 } = opts;
  const dir = snapshotsDir(dataDir);
  if (!existsSync(dir)) return [];
  const entries: Entry[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const { name } = dirent;
    const replaced = dirent.isDirectory() && name.startsWith('replaced-');
    const managed = replaced || (dirent.isFile() && (COUNTED_RE.test(name) || PARTIAL_RE.test(name)));
    if (!managed) continue;
    const path = join(dir, name);
    const { mtimeMs } = statSync(path);
    const stampMs = replaced ? replacedStampMs(name) : undefined;
    const agedFromMs = stampMs === undefined ? mtimeMs : Math.min(mtimeMs, stampMs);
    entries.push({ name, path, mtimeMs, agedFromMs });
  }

  const removed: string[] = [];
  const remove = (entry: Entry): void => {
    rmSync(entry.path, { recursive: true, force: true });
    removed.push(entry.name);
  };
  const oldest = now.getTime() - maxAgeDays * DAY_MS;
  const kept = entries.filter((entry) => {
    if (entry.agedFromMs >= oldest) return true;
    remove(entry);
    return false;
  });
  for (const prefix of COUNTED_PREFIXES) {
    kept
      .filter((entry) => entry.name.startsWith(prefix) && COUNTED_RE.test(entry.name))
      .sort((a, b) => b.mtimeMs - a.mtimeMs || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
      .slice(keep)
      .forEach(remove);
  }
  return removed;
}
