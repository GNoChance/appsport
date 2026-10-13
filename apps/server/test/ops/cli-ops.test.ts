import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parisDate } from '@rune/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli';
import { readOnly, sha256 } from './helpers';

const BAD_TAG = (tag: string) => `Étiquette invalide « ${tag} » : attendu daily ou pre-vX.Y.Z.`;
const SNAPSHOT_LINE = /^Instantané écrit : (.*[\\/]snapshots[\\/]daily-\d{8}\.db)$/;

let dir: string;
let dbPath: string;
let sentinelPath: string;
let env: Record<string, string>;
let lines: string[];
let errors: string[];
const cli = (...argv: string[]) =>
  runCli(
    argv,
    env,
    (line) => lines.push(line),
    (line) => errors.push(line),
  );
const snapshotsDir = () => join(dir, 'snapshots');
const listSnapshots = () => (existsSync(snapshotsDir()) ? readdirSync(snapshotsDir()).sort() : []);
/** Nom `daily-` attendu à l'instant présent : date civile de Paris selon l'horloge système. */
const dailyNameNow = () => `daily-${parisDate(new Date()).replaceAll('-', '')}.db`;

/** Crée sous snapshots/ un fichier (ou un dossier) daté de `days` jours. */
function agedEntry(name: string, days: number, kind: 'file' | 'dir' = 'file'): void {
  mkdirSync(snapshotsDir(), { recursive: true });
  const path = join(snapshotsDir(), name);
  if (kind === 'dir') mkdirSync(path);
  else writeFileSync(path, '');
  const mtime = new Date(Date.now() - days * 86_400_000);
  utimesSync(path, mtime, mtime);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'rune-cli-ops-'));
  dbPath = join(dir, 'rune.db');
  sentinelPath = join(dir, '.rune-volume');
  env = { APP_ORIGIN: 'http://localhost:3999', RUNE_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' };
  lines = [];
  errors = [];
  writeFileSync(sentinelPath, '');
  expect(await cli('init')).toBe(0);
  lines = [];
});

afterEach(() => {
  // Sans `force` : sous Windows, EBUSY si une base reste ouverte.
  rmSync(dir, { recursive: true });
});

/** `snapshot --tag daily` ; chemin absolu lu sur la dernière ligne. */
async function snapshotDaily(): Promise<string> {
  expect(await cli('snapshot', '--tag', 'daily')).toBe(0);
  const path = SNAPSHOT_LINE.exec(lines.at(-1) ?? '')?.[1];
  if (!path) throw new Error(`ligne inattendue : ${lines.at(-1)}`);
  return path;
}

describe('snapshot', () => {
  it('--tag daily : daily-AAAAMMJJ.db du jour (Paris, horloge système), chemin absolu', async () => {
    const before = dailyNameNow();
    expect(await cli('snapshot', '--tag', 'daily')).toBe(0);
    // Deux noms admis si minuit (Paris) passe pendant la commande.
    const expected = [before, dailyNameNow()].map(
      (name) => `Instantané écrit : ${join(dir, 'snapshots', name)}`,
    );
    expect(expected).toContain(lines.at(-1));
    const path = SNAPSHOT_LINE.exec(lines.at(-1) ?? '')?.[1] as string;
    expect(path).toBe(resolve(path));
    expect(readOnly(path, (s) => s.prepare('PRAGMA integrity_check').all())).toEqual([
      { integrity_check: 'ok' },
    ]);
    expect(errors).toEqual([]);
  });

  it('--tag pre-v1.2.3 : fichier créé', async () => {
    expect(await cli('snapshot', '--tag', 'pre-v1.2.3')).toBe(0);
    expect(lines.at(-1)).toBe(`Instantané écrit : ${join(dir, 'snapshots', 'pre-v1.2.3.db')}`);
    expect(listSnapshots()).toEqual(['pre-v1.2.3.db']);
  });

  it('sans --tag ou étiquette inconnue → 1, aucun fichier', async () => {
    expect(await cli('snapshot')).toBe(1);
    expect(errors.at(-1)).toBe(BAD_TAG(''));
    expect(await cli('snapshot', '--tag', 'weekly')).toBe(1);
    expect(errors.at(-1)).toBe(BAD_TAG('weekly'));
    expect(existsSync(snapshotsDir())).toBe(false);
    expect(lines).toEqual([]);
  });

  it('sans sentinelle → 1, aucun fichier', async () => {
    rmSync(sentinelPath);
    expect(await cli('snapshot', '--tag', 'daily')).toBe(1);
    expect(errors.at(-1)).toBe(`Volume de données absent : sentinelle ${sentinelPath} introuvable.`);
    expect(existsSync(snapshotsDir())).toBe(false);
  });

  it('sans base → 1, aucun fichier', async () => {
    rmSync(dbPath);
    expect(await cli('snapshot', '--tag', 'daily')).toBe(1);
    expect(errors.at(-1)).toMatch(/^Base introuvable/);
    expect(existsSync(snapshotsDir())).toBe(false);
  });

  it('élague après écriture : 4 instantanés quotidiens anciens + 1 → 3 restent', async () => {
    const first = await snapshotDaily();
    const old = ['daily-20000101.db', 'daily-20000102.db', 'daily-20000103.db', 'daily-20000104.db'];
    old.forEach((name, i) => {
      const path = join(snapshotsDir(), name);
      copyFileSync(first, path);
      const mtime = new Date(Date.now() - (i + 1) * 86_400_000);
      utimesSync(path, mtime, mtime);
    });
    const latest = await snapshotDaily();
    expect(listSnapshots()).toEqual(
      ['daily-20000101.db', 'daily-20000102.db', latest.slice(snapshotsDir().length + 1)].sort(),
    );
  });

  it("instantané en échec → l'élagage passe quand même (R-OPS-10 : rien de plus de 30 jours)", async () => {
    agedEntry('daily-20000101.db', 40);
    agedEntry('pre-v0.1.0.db', 40);
    agedEntry('replaced-20000101T000000Z', 40, 'dir');
    agedEntry('daily-20000102.db', 2);
    rmSync(dbPath);
    expect(await cli('snapshot', '--tag', 'daily')).toBe(1);
    expect(errors.at(-1)).toMatch(/^Base introuvable/);
    expect(listSnapshots()).toEqual(['daily-20000102.db']);
  });
});

describe('restore', () => {
  it('nouvelle époque, base remplacée gardée, rappel de privacy:reapply', async () => {
    const snapshot = await snapshotDaily();
    const start = Date.now();
    expect(await cli('restore', snapshot)).toBe(0);
    const end = Date.now();
    const prefix = `Base remplacée conservée 30 jours dans ${join(dir, 'snapshots', 'replaced-')}`;
    expect(lines.at(-3)?.startsWith(prefix), lines.at(-3)).toBe(true);
    const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.$/.exec(
      lines.at(-3)?.slice(prefix.length) ?? '',
    );
    expect(stamp, lines.at(-3)).not.toBeNull();
    // Horodatage UTC de l'horloge système, tronqué à la seconde : pris pendant la commande.
    const [, y, mo, d, h, mi, s] = stamp as RegExpExecArray;
    const at = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
    expect(at).toBeGreaterThanOrEqual(start - 1000);
    expect(at).toBeLessThanOrEqual(end);
    expect(lines.at(-2)).toMatch(
      /^Restauration terminée\. Nouvelle époque : [0-9a-f-]{36} \(epoch_base_rev \d+\)\.$/,
    );
    expect(lines.at(-1)).toBe('Lancez maintenant privacy:reapply, avant de redémarrer le service.');
    const [, epoch, baseRev] = /: ([0-9a-f-]{36}) \(epoch_base_rev (\d+)\)/.exec(lines.at(-2) ?? '') ?? [];
    const meta = readOnly(dbPath, (s) =>
      s.prepare('SELECT server_epoch, epoch_base_rev FROM server_meta').get(),
    );
    expect(meta).toEqual({ server_epoch: epoch, epoch_base_rev: Number(baseRev) });
    expect(errors).toEqual([]);
  });

  it('instantané absent → 1, base inchangée', async () => {
    const hash = sha256(dbPath);
    expect(await cli('restore', 'absent.db')).toBe(1);
    expect(errors.at(-1)).toBe(`Instantané introuvable : ${resolve('absent.db')}.`);
    expect(sha256(dbPath)).toBe(hash);
    expect(listSnapshots()).toEqual([]);
  });

  it('instantané corrompu → 1, base inchangée', async () => {
    const corrupt = join(dir, 'corrompu.db');
    writeFileSync(corrupt, 'ceci n’est pas une base SQLite');
    const hash = sha256(dbPath);
    expect(await cli('restore', corrupt)).toBe(1);
    expect(errors.at(-1)).toBe(
      'Instantané corrompu (PRAGMA integrity_check) : base actuelle laissée intacte.',
    );
    expect(sha256(dbPath)).toBe(hash);
    expect(listSnapshots()).toEqual([]);
  });

  it('sans base courante mais avec sentinelle (machine neuve, P4 (b)) → 0, aucune base remplacée', async () => {
    const snapshot = await snapshotDaily();
    rmSync(dbPath);
    lines = [];
    expect(await cli('restore', snapshot)).toBe(0);
    expect(lines).toHaveLength(2);
    expect(lines.at(-1)).toBe('Lancez maintenant privacy:reapply, avant de redémarrer le service.');
    expect(listSnapshots().filter((name) => name.startsWith('replaced-'))).toEqual([]);
    expect(existsSync(dbPath)).toBe(true);
  });

  it('sans sentinelle → 1, base inchangée', async () => {
    const snapshot = await snapshotDaily();
    rmSync(sentinelPath);
    const hash = sha256(dbPath);
    expect(await cli('restore', snapshot)).toBe(1);
    expect(errors.at(-1)).toBe(`Volume de données absent : sentinelle ${sentinelPath} introuvable.`);
    expect(sha256(dbPath)).toBe(hash);
  });
});
