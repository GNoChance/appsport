import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'appsport-cli-ops-'));
  dbPath = join(dir, 'appsport.db');
  sentinelPath = join(dir, '.appsport-volume');
  env = { APP_ORIGIN: 'http://localhost:3999', APPSPORT_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' };
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
  it('--tag daily : instantané daily-AAAAMMJJ.db, chemin absolu', async () => {
    expect(await cli('snapshot', '--tag', 'daily')).toBe(0);
    expect(lines.at(-1)).toMatch(/^Instantané écrit : .*[\\/]snapshots[\\/]daily-\d{8}\.db$/);
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
});

describe('restore', () => {
  it('nouvelle époque, base remplacée gardée, rappel de privacy:reapply', async () => {
    const snapshot = await snapshotDaily();
    expect(await cli('restore', snapshot)).toBe(0);
    expect(lines.at(-3)).toMatch(
      /^Base remplacée conservée 30 jours dans .*[\\/]snapshots[\\/]replaced-\d{8}T\d{6}Z\.$/,
    );
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
