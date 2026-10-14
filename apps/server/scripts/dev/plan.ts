import { join, resolve } from 'node:path';

// Logique pure de `pnpm dev` : variables, dossier de données, lecture de la sortie de la CLI du serveur.

export class DevError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevError';
  }
}

export const DEV_DATA_DIR_NAME = 'rune-data-dev';
export const EMPTY_PUBLIC_DIR_NAME = 'public-vide';
/** Dossier de données de la procédure « Comme en production » du README : jamais celui de pnpm dev. */
export const PROD_LIKE_DATA_DIR_NAME = 'rune-data';
/** Repère écrit par pnpm dev au premier lancement : seule une base qui l'a est une base de dev. */
export const DEV_MARKER_FILE = '.rune-dev';
/** Port visé par le proxy `/api` et `/illustrations` de `apps/web/vite.config.ts`. */
export const PROXY_PORT = 3000;
/** Dérogation explicite (tests) : un autre port du serveur, que le proxy de Vite n'atteint pas. */
const ANY_PORT_VARIABLE = 'RUNE_DEV_ANY_PORT';
const FRESH_TERMINAL_HINT =
  'Des variables de la procédure « Comme en production » restent peut-être dans ce terminal : il faut lancer pnpm dev dans un nouveau terminal.';
const DEFAULT_SERVER_PORT = String(PROXY_PORT);
const DEFAULT_WEB_PORT = '5173';
const DEFAULT_BIRTH_DATE = '1990-01-01';

export interface DevSettings {
  dataDir: string;
  serverPort: number;
  webPort: number;
  birthDate: string;
  /** Dossier vide à créer et à servir quand le web n'a pas de build (`apps/web/dist`), sinon null. */
  emptyPublicDir: string | null;
  /** Variables du serveur ; celles de l'environnement gagnent toujours. */
  serverEnv: Record<string, string>;
}

type Env = Record<string, string | undefined>;

/** Une variable vide compte comme absente, comme dans la configuration du serveur. */
const given = (env: Env, key: string): string | undefined => {
  const value = env[key];
  return value === undefined || value === '' ? undefined : value;
};

function parsePort(raw: string, name: string): number {
  const port = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!(port >= 1 && port <= 65535))
    throw new DevError(`${name} doit être un port de 1 à 65535 (reçu : ${raw}).`);
  return port;
}

export function devSettings(
  env: Env,
  ctx: { homeDir: string; repoRoot: string; webDistExists: boolean },
): DevSettings {
  const webPortRaw = given(env, 'RUNE_DEV_WEB_PORT') ?? DEFAULT_WEB_PORT;
  const webPort = parsePort(webPortRaw, 'RUNE_DEV_WEB_PORT');
  const portRaw = given(env, 'PORT') ?? DEFAULT_SERVER_PORT;
  const serverPort = parsePort(portRaw, 'PORT');
  if (serverPort !== PROXY_PORT && given(env, ANY_PORT_VARIABLE) !== '1') {
    throw new DevError(
      `PORT vaut ${serverPort}, mais le proxy /api de Vite vise le port ${PROXY_PORT}. ${FRESH_TERMINAL_HINT}`,
    );
  }
  const dataDir = given(env, 'RUNE_DATA_DIR') ?? join(ctx.homeDir, DEV_DATA_DIR_NAME);
  if (resolve(dataDir) === resolve(ctx.homeDir, PROD_LIKE_DATA_DIR_NAME)) {
    throw new DevError(
      `RUNE_DATA_DIR vise ${dataDir}, le dossier de la procédure « Comme en production » ; pnpm dev utilise ${DEV_DATA_DIR_NAME}. ${FRESH_TERMINAL_HINT}`,
    );
  }
  const publicGiven = given(env, 'RUNE_PUBLIC_DIR');
  const emptyPublicDir =
    publicGiven === undefined && !ctx.webDistExists ? join(dataDir, EMPTY_PUBLIC_DIR_NAME) : null;
  return {
    dataDir,
    serverPort,
    webPort,
    birthDate: given(env, 'RUNE_DEV_BIRTH_DATE') ?? DEFAULT_BIRTH_DATE,
    emptyPublicDir,
    serverEnv: {
      APP_ORIGIN: given(env, 'APP_ORIGIN') ?? `http://localhost:${webPort}`,
      HOST: given(env, 'HOST') ?? '127.0.0.1',
      PORT: portRaw,
      RUNE_DATA_DIR: dataDir,
      RUNE_PUBLIC_DIR: publicGiven ?? emptyPublicDir ?? join(ctx.repoRoot, 'apps', 'web', 'dist'),
      RUNE_CONTENT_DIR: given(env, 'RUNE_CONTENT_DIR') ?? join(ctx.repoRoot, 'data'),
    },
  };
}

export type DataDirPlan =
  | { kind: 'ready' }
  | { kind: 'init'; writeSentinel: boolean; writeDevMarker: boolean }
  | { kind: 'refused'; message: string };

/**
 * Premier lancement : sentinelle et repère de dev, puis `init`, une seule fois ; une base existante n'est
 * jamais refaite. Une base sans le repère `.rune-dev` n'a pas été créée par pnpm dev : elle est refusée.
 */
export function planDataDir(
  state: { sentinelExists: boolean; dbExists: boolean; devMarkerExists: boolean },
  dataDir: string,
): DataDirPlan {
  if (state.dbExists) {
    if (!state.sentinelExists) {
      return {
        kind: 'refused',
        message: `Une base existe dans ${dataDir} mais pas la sentinelle .rune-volume : ce dossier n'est pas un dossier de dev, rien n'est lancé.`,
      };
    }
    if (!state.devMarkerExists) {
      return {
        kind: 'refused',
        message: `La base de ${dataDir} n'a pas été créée par pnpm dev (pas de repère ${DEV_MARKER_FILE}) : rien n'est lancé. ${FRESH_TERMINAL_HINT}`,
      };
    }
    return { kind: 'ready' };
  }
  return { kind: 'init', writeSentinel: !state.sentinelExists, writeDevMarker: !state.devMarkerExists };
}

/** Nombre de comptes lu dans la ligne JSON de `db:stats`. */
export function usersFromDbStats(stdout: string): number {
  let stats: unknown;
  try {
    stats = JSON.parse(stdout.trim());
  } catch {
    throw new DevError('Sortie de db:stats illisible.');
  }
  const { integrity, users } = (stats ?? {}) as { integrity?: unknown; users?: unknown };
  if (integrity !== 'ok') throw new DevError(`Base de dev abîmée (intégrité : ${String(integrity)}).`);
  if (typeof users !== 'number') throw new DevError('Sortie de db:stats sans nombre de comptes.');
  return users;
}

/** Lien d'invitation de `admin:bootstrap` (ligne « Lien : … ») ; il ne s'affiche que dans la console. */
export function invitationLinkFrom(stdout: string): string {
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('Lien : ')) return line.slice('Lien : '.length).trim();
  }
  throw new DevError("admin:bootstrap n'a pas donné de lien d'invitation.");
}

export function portBusyMessage(port: number, role: 'serveur' | 'web'): string {
  return `Le port ${port} (${role}) est déjà pris : arrête le programme qui l'utilise (un autre pnpm dev ?), puis relance.`;
}
