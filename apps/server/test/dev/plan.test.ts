import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DevError,
  devSettings,
  invitationLinkFrom,
  planDataDir,
  portBusyMessage,
  usersFromDbStats,
} from '../../scripts/dev/plan';

// Chemins absolus sur la plateforme qui lance le test (C:… sous Windows, /… ailleurs).
const HOME = resolve('/Users/proche');
const REPO = resolve('/depot/rune');
const ELSEWHERE = resolve('/autre');
const ctx = { homeDir: HOME, repoRoot: REPO, webDistExists: true };

describe('devSettings', () => {
  it('donne les valeurs de dev par défaut, données hors du dépôt', () => {
    const s = devSettings({}, ctx);
    const dataDir = join(HOME, 'rune-data-dev');
    expect(s.dataDir).toBe(dataDir);
    expect(s.serverPort).toBe(3000);
    expect(s.webPort).toBe(5173);
    expect(s.birthDate).toBe('1990-01-01');
    expect(s.emptyPublicDir).toBeNull();
    expect(s.serverEnv).toEqual({
      APP_ORIGIN: 'http://localhost:5173',
      HOST: '127.0.0.1',
      PORT: '3000',
      RUNE_DATA_DIR: dataDir,
      RUNE_PUBLIC_DIR: join(REPO, 'apps', 'web', 'dist'),
      RUNE_CONTENT_DIR: join(REPO, 'data'),
    });
  });

  it('sans build web, sert un dossier vide pris dans le dossier de données', () => {
    const s = devSettings({}, { ...ctx, webDistExists: false });
    const empty = join(HOME, 'rune-data-dev', 'public-vide');
    expect(s.emptyPublicDir).toBe(empty);
    expect(s.serverEnv.RUNE_PUBLIC_DIR).toBe(empty);
  });

  it("toute variable déjà définie dans l'environnement gagne", () => {
    const env = {
      APP_ORIGIN: 'http://127.0.0.1:4000',
      HOST: 'localhost',
      PORT: '3100',
      RUNE_DATA_DIR: join(ELSEWHERE, 'essai'),
      RUNE_PUBLIC_DIR: join(ELSEWHERE, 'pub'),
      RUNE_CONTENT_DIR: join(ELSEWHERE, 'contenu'),
      RUNE_DEV_WEB_PORT: '5300',
      RUNE_DEV_BIRTH_DATE: '1985-06-15',
      RUNE_DEV_ANY_PORT: '1',
    };
    const s = devSettings(env, { ...ctx, webDistExists: false });
    expect(s.dataDir).toBe(join(ELSEWHERE, 'essai'));
    expect(s.serverPort).toBe(3100);
    expect(s.webPort).toBe(5300);
    expect(s.birthDate).toBe('1985-06-15');
    expect(s.emptyPublicDir).toBeNull();
    expect(s.serverEnv).toEqual({
      APP_ORIGIN: 'http://127.0.0.1:4000',
      HOST: 'localhost',
      PORT: '3100',
      RUNE_DATA_DIR: join(ELSEWHERE, 'essai'),
      RUNE_PUBLIC_DIR: join(ELSEWHERE, 'pub'),
      RUNE_CONTENT_DIR: join(ELSEWHERE, 'contenu'),
    });
  });

  it("l'origine par défaut suit le port du web ; une variable vide compte comme absente", () => {
    const s = devSettings({ RUNE_DEV_WEB_PORT: '5301', APP_ORIGIN: '', PORT: '' }, ctx);
    expect(s.serverEnv.APP_ORIGIN).toBe('http://localhost:5301');
    expect(s.serverPort).toBe(3000);
  });

  it('refuse un port du serveur que le proxy de Vite ne vise pas, sauf dérogation explicite', () => {
    // Cas typique : PORT=3100 laissé par la procédure « Comme en production » dans le même terminal.
    expect(() => devSettings({ PORT: '3100' }, ctx)).toThrow(DevError);
    expect(() => devSettings({ PORT: '3100' }, ctx)).toThrow(/3000.*nouveau terminal/s);
    expect(devSettings({ PORT: '3100', RUNE_DEV_ANY_PORT: '1' }, ctx).serverPort).toBe(3100);
    expect(devSettings({ PORT: '3000' }, ctx).serverPort).toBe(3000);
  });

  it('refuse le dossier de données de la procédure « Comme en production »', () => {
    const prod = join(HOME, 'rune-data');
    expect(() => devSettings({ RUNE_DATA_DIR: prod }, ctx)).toThrow(DevError);
    expect(() => devSettings({ RUNE_DATA_DIR: prod }, ctx)).toThrow(/rune-data-dev|nouveau terminal/);
    // Même dossier écrit autrement : séparateur final, barres obliques, détour par « .. » (join les effacerait).
    for (const variant of [
      `${prod}${sep}`,
      `${prod.split(sep).join('/')}/`,
      [HOME, 'x', '..', 'rune-data'].join(sep),
    ]) {
      expect(() => devSettings({ RUNE_DATA_DIR: variant }, ctx), variant).toThrow(DevError);
    }
    expect(devSettings({ RUNE_DATA_DIR: join(HOME, 'rune-data-essai') }, ctx).dataDir).toBe(
      join(HOME, 'rune-data-essai'),
    );
  });

  it('refuse un RUNE_DATA_DIR relatif : il dépendrait du dossier où pnpm lance le script', () => {
    for (const relative of ['essai', join('.', 'essai'), join('..', 'essai')]) {
      expect(() => devSettings({ RUNE_DATA_DIR: relative }, ctx)).toThrow(DevError);
      expect(() => devSettings({ RUNE_DATA_DIR: relative }, ctx)).toThrow(/absolu/);
    }
  });

  it('refuse un dossier de données dans le dépôt, qui pourrait finir dans un commit', () => {
    const insideRepo = [
      REPO,
      join(REPO, 'essai'),
      join(REPO, 'apps', 'server', 'essai'),
      join(REPO, '..essai'),
    ];
    for (const inside of insideRepo) {
      expect(() => devSettings({ RUNE_DATA_DIR: inside }, ctx)).toThrow(DevError);
      expect(() => devSettings({ RUNE_DATA_DIR: inside }, ctx)).toThrow(/dépôt/);
    }
    // À côté du dépôt (même préfixe de nom, ou dossier parent) : accepté.
    expect(devSettings({ RUNE_DATA_DIR: `${REPO}-donnees` }, ctx).dataDir).toBe(`${REPO}-donnees`);
    for (const beside of [join(REPO, '..'), join(REPO, '..', 'donnees')]) {
      expect(devSettings({ RUNE_DATA_DIR: beside }, ctx).dataDir).toBe(beside);
    }
  });

  it('sous Windows, compare les dossiers sans tenir compte de la casse', () => {
    const win = {
      homeDir: 'C:\\Users\\Proche',
      repoRoot: 'C:\\Depot\\Rune',
      webDistExists: true,
      platform: 'win32' as const,
    };
    expect(() => devSettings({ RUNE_DATA_DIR: 'c:\\users\\proche\\RUNE-DATA' }, win)).toThrow(
      /Comme en production/,
    );
    expect(() => devSettings({ RUNE_DATA_DIR: 'c:\\depot\\rune\\essai' }, win)).toThrow(/dépôt/);
    expect(() => devSettings({ RUNE_DATA_DIR: 'essai' }, win)).toThrow(/absolu/);
    expect(devSettings({ RUNE_DATA_DIR: 'D:\\essai' }, win).dataDir).toBe('D:\\essai');
    // Ailleurs, la casse compte : /home/proche/Rune-Data n'est pas /home/proche/rune-data.
    const posix = {
      homeDir: '/home/proche',
      repoRoot: '/depot/rune',
      webDistExists: true,
      platform: 'linux' as const,
    };
    expect(() => devSettings({ RUNE_DATA_DIR: '/home/proche/rune-data' }, posix)).toThrow(DevError);
    expect(devSettings({ RUNE_DATA_DIR: '/home/proche/Rune-Data' }, posix).dataDir).toBe(
      '/home/proche/Rune-Data',
    );
    expect(() => devSettings({ RUNE_DATA_DIR: '/depot/rune/essai' }, posix)).toThrow(/dépôt/);
  });

  it.each([1, 65535])('accepte les bornes de port (%i)', (port) => {
    const s = devSettings(
      { PORT: String(port), RUNE_DEV_ANY_PORT: '1', RUNE_DEV_WEB_PORT: String(port) },
      ctx,
    );
    expect(s.serverPort).toBe(port);
    expect(s.webPort).toBe(port);
  });

  it.each(['abc', '0', '65536', '70000', '-1', '3000x'])('refuse un port invalide (%s)', (port) => {
    expect(() => devSettings({ PORT: port }, ctx)).toThrow(DevError);
    expect(() => devSettings({ RUNE_DEV_WEB_PORT: port }, ctx)).toThrow(/port/i);
  });
});

describe('planDataDir', () => {
  const dir = join(HOME, 'rune-data-dev');

  it('premier lancement : sentinelle puis init', () => {
    expect(planDataDir({ sentinelExists: false, dbExists: false, devMarkerExists: false }, dir)).toEqual({
      kind: 'init',
      writeSentinel: true,
      writeDevMarker: true,
    });
  });

  it('sentinelle sans base : init seul', () => {
    expect(planDataDir({ sentinelExists: true, dbExists: false, devMarkerExists: true }, dir)).toEqual({
      kind: 'init',
      writeSentinel: false,
      writeDevMarker: false,
    });
  });

  it('la base existe : rien à refaire', () => {
    expect(planDataDir({ sentinelExists: true, dbExists: true, devMarkerExists: true }, dir)).toEqual({
      kind: 'ready',
    });
  });

  it('une base sans sentinelle est refusée, sans rien écrire', () => {
    const plan = planDataDir({ sentinelExists: false, dbExists: true, devMarkerExists: false }, dir);
    expect(plan.kind).toBe('refused');
    expect(plan.kind === 'refused' && plan.message).toContain(dir);
    expect(plan.kind === 'refused' && plan.message).toContain('.rune-volume');
  });

  it("une base que pnpm dev n'a pas créée (sans le repère .rune-dev) est refusée, sans rien écrire", () => {
    // Le dossier de la procédure « Comme en production » a la sentinelle et la base, mais pas le repère.
    const plan = planDataDir({ sentinelExists: true, dbExists: true, devMarkerExists: false }, dir);
    expect(plan.kind).toBe('refused');
    expect(plan.kind === 'refused' && plan.message).toContain(dir);
    expect(plan.kind === 'refused' && plan.message).toContain('.rune-dev');
  });
});

describe('usersFromDbStats', () => {
  it('lit le nombre de comptes de db:stats', () => {
    const line = JSON.stringify({ integrity: 'ok', users: 0, syncCounter: 0, lastWriteAt: null });
    expect(usersFromDbStats(`${line}\n`)).toBe(0);
    expect(usersFromDbStats(JSON.stringify({ integrity: 'ok', users: 2, syncCounter: 5 }))).toBe(2);
  });

  it('refuse une sortie illisible ou une base abîmée', () => {
    expect(() => usersFromDbStats('')).toThrow(DevError);
    expect(() => usersFromDbStats('pas du json')).toThrow(DevError);
    expect(() => usersFromDbStats(JSON.stringify({ integrity: 'ok' }))).toThrow(DevError);
    expect(() => usersFromDbStats(JSON.stringify({ integrity: 'page 3 abîmée', users: 0 }))).toThrow(
      /intégrité/,
    );
  });
});

describe('invitationLinkFrom', () => {
  it('extrait le lien de la sortie de admin:bootstrap', () => {
    const stdout = [
      'Invitation administrateur (valable 24 h)',
      'Lien : http://localhost:5173/invite#AAAA-BBBB',
      'Code : AAAA-BBBB',
      '',
    ].join('\r\n');
    expect(invitationLinkFrom(stdout)).toBe('http://localhost:5173/invite#AAAA-BBBB');
  });

  it('refuse une sortie sans lien', () => {
    expect(() => invitationLinkFrom('Invitation administrateur (valable 24 h)\n')).toThrow(DevError);
  });
});

describe('portBusyMessage', () => {
  it('dit en français quel port est pris et comment en sortir', () => {
    expect(portBusyMessage(3000, 'serveur', 'linux')).toBe(
      "Le port 3000 (serveur) est déjà pris : arrête le programme qui l'utilise (un autre pnpm dev ?), puis relance. Pour le trouver : lsof -nP -iTCP:3000 -sTCP:LISTEN",
    );
  });

  it('sous Windows, donne la commande PowerShell qui montre le programme qui tient le port', () => {
    expect(portBusyMessage(5173, 'web', 'win32')).toBe(
      "Le port 5173 (web) est déjà pris : arrête le programme qui l'utilise (un autre pnpm dev ?), puis relance. Pour le trouver (PowerShell) : Get-Process -Id (Get-NetTCPConnection -LocalPort 5173 -State Listen).OwningProcess",
    );
  });
});
