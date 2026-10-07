import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli';
import { openDatabase } from '../../src/db/open';
import { insertFixtureRow } from '../support';

const SINCE = '2026-10-06T00:00:00.000Z';
const DONE = 'Réapplication terminée : 0 compte(s) supprimé(s), 0 accord(s) santé retiré(s).';
const NO_ADMIN = 'Aucun administrateur actif : lancer admin:bootstrap';

let dir: string;
let dbPath: string;
let env: Record<string, string>;
let lines: string[];
let errors: string[];
const o = (line: string): void => {
  lines.push(line);
};
const e = (line: string): void => {
  errors.push(line);
};
const cli = (...argv: string[]) => runCli(argv, env, o, e);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'appsport-privacy-cli-'));
  dbPath = join(dir, 'appsport.db');
  env = { APP_ORIGIN: 'http://localhost:3999', APPSPORT_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' };
  lines = [];
  errors = [];
  writeFileSync(join(dir, '.appsport-volume'), '');
  expect(await cli('init')).toBe(0);
  withDb((sqlite) => {
    const insert = sqlite.prepare(
      "INSERT INTO security_event (id, at, type, actor_id, target_id, tailnet_ip, outcome, details) VALUES (?, ?, ?, NULL, ?, NULL, 'success', ?)",
    );
    insert.run('ev-0', '2026-10-05T23:59:59.000Z', 'account_deleted', 'u-old', null);
    insert.run('ev-1', '2026-10-06T10:00:00.000Z', 'account_deleted', 'u-x', null);
    insert.run('ev-2', '2026-10-06T10:00:01.000Z', 'consent_revoked', 'u-y', '{"consentType":"health"}');
    insert.run('ev-3', '2026-10-06T10:00:02.000Z', 'login_succeeded', 'u-z', null);
  });
  lines = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

function withDb(fn: (sqlite: DatabaseSync) => void): void {
  const sqlite = new DatabaseSync(dbPath);
  try {
    fn(sqlite);
  } finally {
    sqlite.close();
  }
}

const readList = (path: string) =>
  JSON.parse(readFileSync(path, 'utf8')) as {
    since: string;
    collectedAt: string;
    source: string;
    events: { type: string; at: string; targetId: string; consentType?: string }[];
  };
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('privacy:collect', () => {
  it('écrit les suppressions et retraits postérieurs à --since (base principale)', async () => {
    const out = join(dir, 'l.json');
    expect(await cli('privacy:collect', '--since', SINCE, '--out', out)).toBe(0);
    expect(lines).toEqual([`2 événement(s) écrit(s) dans ${out}`]);
    const list = readList(out);
    expect(list).toMatchObject({ since: SINCE, source: dbPath });
    expect(list.events.map((ev) => ev.targetId)).toEqual(['u-x', 'u-y']);
    expect(list.events[1]).toEqual({
      type: 'consent_revoked',
      at: '2026-10-06T10:00:01.000Z',
      targetId: 'u-y',
      consentType: 'health',
    });
    expect(readFileSync(out, 'utf8')).toBe(`${JSON.stringify(list, null, 2)}`);
  });

  it('lit une base portant une migration cassante inconnue, sans migrer', async () => {
    withDb((sqlite) => {
      sqlite
        .prepare("INSERT INTO schema_migrations (id, breaking, applied_at) VALUES ('9999_future', 1, ?)")
        .run('2026-10-06T12:00:00.000Z');
    });
    expect(await cli('db:check')).toBe(1);
    const out = join(dir, 'l.json');
    expect(await cli('privacy:collect', '--since', SINCE, '--out', out)).toBe(0);
    expect(readList(out).events.map((ev) => ev.targetId)).toEqual(['u-x', 'u-y']);
  });

  it('--source : lit la copie sans la modifier (empreinte, date, journal DELETE)', async () => {
    const copy = join(dir, 'copie.db');
    withDb((sqlite) => {
      sqlite.prepare('VACUUM INTO ?').run(copy);
    });
    const c = new DatabaseSync(copy);
    c.exec('PRAGMA journal_mode = DELETE');
    c.close();
    rmSync(dbPath);
    const hash = sha256(copy);
    const mtime = statSync(copy).mtimeMs;

    const out = join(dir, 'l.json');
    expect(await cli('privacy:collect', '--since', SINCE, '--source', copy, '--out', out)).toBe(0);
    const list = readList(out);
    expect(list.source).toBe(copy);
    expect(list.events.map((ev) => ev.targetId)).toEqual(['u-x', 'u-y']);
    expect(sha256(copy)).toBe(hash);
    expect(statSync(copy).mtimeMs).toBe(mtime);
    expect(existsSync(`${copy}-wal`)).toBe(false);
    expect(existsSync(`${copy}-shm`)).toBe(false);
  });

  it('--since invalide ou --out manquant → 1', async () => {
    expect(await cli('privacy:collect', '--since', 'hier', '--out', join(dir, 'l.json'))).toBe(1);
    expect(errors).toContain('Date --since invalide (format ISO 8601 attendu)');
    expect(await cli('privacy:collect', '--since', SINCE)).toBe(1);
    expect(errors).toContain('Option --out obligatoire');
    expect(existsSync(join(dir, 'l.json'))).toBe(false);
  });
});

describe('privacy:reapply', () => {
  it('sans admin actif : réapplique puis invite à lancer admin:bootstrap', async () => {
    const out = join(dir, 'l.json');
    expect(await cli('privacy:collect', '--since', SINCE, '--out', out)).toBe(0);
    lines = [];
    expect(await cli('privacy:reapply', out)).toBe(0);
    expect(lines).toContain(DONE);
    expect(lines).toContain(NO_ADMIN);
  });

  it('avec un admin actif : supprime le compte listé, sans avertissement', async () => {
    const { sqlite, db } = openDatabase(dbPath);
    await insertFixtureRow(db, 'user', { id: 'u-x', username: 'xavier', usernameKey: 'xavier' });
    await insertFixtureRow(db, 'user', { username: 'chef', usernameKey: 'chef', role: 'admin' });
    sqlite.close();
    const out = join(dir, 'l.json');
    expect(await cli('privacy:collect', '--since', SINCE, '--out', out)).toBe(0);
    lines = [];
    expect(await cli('privacy:reapply', out)).toBe(0);
    expect(lines).toContain('Réapplication terminée : 1 compte(s) supprimé(s), 0 accord(s) santé retiré(s).');
    expect(lines).not.toContain(NO_ADMIN);
    withDb((s) => {
      expect(s.prepare("SELECT id FROM user WHERE id = 'u-x'").all()).toEqual([]);
    });
  });

  it('fichier de liste invalide → 1', async () => {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{ pas du json');
    const wrong = join(dir, 'wrong.json');
    writeFileSync(wrong, JSON.stringify({ since: 'hier', events: [] }));
    for (const args of [[bad], [wrong], [join(dir, 'absent.json')], []]) {
      errors = [];
      expect(await cli('privacy:reapply', ...args)).toBe(1);
      expect(errors).toEqual(['Fichier de réapplication invalide']);
    }
  });
});

describe('--since sans millisecondes (comparaison canonique)', () => {
  const BOUNDARY = '2026-10-07T03:30:00Z';

  it("garde l'événement de la première seconde, exclut celui pile à since, à la collecte et à la réapplication", async () => {
    const { sqlite, db } = openDatabase(dbPath);
    await insertFixtureRow(db, 'user', { id: 'u-a', username: 'alba', usernameKey: 'alba' });
    await insertFixtureRow(db, 'user', { id: 'u-b', username: 'bruno', usernameKey: 'bruno' });
    await insertFixtureRow(db, 'user', { username: 'chef', usernameKey: 'chef', role: 'admin' });
    const insert = sqlite.prepare(
      "INSERT INTO security_event (id, at, type, actor_id, target_id, tailnet_ip, outcome, details) VALUES (?, ?, 'account_deleted', NULL, ?, NULL, 'success', NULL)",
    );
    insert.run('ev-a', '2026-10-07T03:30:00.500Z', 'u-a');
    insert.run('ev-b', '2026-10-07T03:30:00.000Z', 'u-b');
    sqlite.close();

    const out = join(dir, 'l.json');
    expect(await cli('privacy:collect', '--since', BOUNDARY, '--out', out)).toBe(0);
    const list = readList(out);
    expect(list.since).toBe('2026-10-07T03:30:00.000Z');
    expect(list.events.map((ev) => ev.targetId)).toEqual(['u-a']);

    const handmade = join(dir, 'main.json');
    writeFileSync(
      handmade,
      JSON.stringify({
        since: BOUNDARY,
        collectedAt: '2026-10-07T04:00:00Z',
        source: 'main',
        events: [
          { type: 'account_deleted', at: '2026-10-07T03:30:00.000Z', targetId: 'u-b' },
          { type: 'account_deleted', at: '2026-10-07T03:30:00.500Z', targetId: 'u-a' },
        ],
      }),
    );
    lines = [];
    expect(await cli('privacy:reapply', handmade)).toBe(0);
    expect(lines).toContain('Réapplication terminée : 1 compte(s) supprimé(s), 0 accord(s) santé retiré(s).');
    withDb((s) => {
      expect(s.prepare("SELECT id FROM user WHERE id IN ('u-a', 'u-b')").all()).toEqual([{ id: 'u-b' }]);
    });
  });
});
