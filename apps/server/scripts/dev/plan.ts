import { join } from 'node:path';

// Logique pure de `pnpm dev` : variables, dossier de données, lecture de la sortie de la CLI du serveur.

export class DevError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevError';
  }
}

export const DEV_DATA_DIR_NAME = 'rune-data-dev';
export const EMPTY_PUBLIC_DIR_NAME = 'public-vide';
const DEFAULT_SERVER_PORT = '3000';
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
  const dataDir = given(env, 'RUNE_DATA_DIR') ?? join(ctx.homeDir, DEV_DATA_DIR_NAME);
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
  | { kind: 'init'; writeSentinel: boolean }
  | { kind: 'refused'; message: string };

/** Premier lancement : sentinelle puis `init`, une seule fois ; une base existante n'est jamais refaite. */
export function planDataDir(
  state: { sentinelExists: boolean; dbExists: boolean },
  dataDir: string,
): DataDirPlan {
  if (state.dbExists) {
    if (state.sentinelExists) return { kind: 'ready' };
    return {
      kind: 'refused',
      message: `Une base existe dans ${dataDir} mais pas la sentinelle .rune-volume : ce dossier n'est pas un dossier de dev, rien n'est lancé.`,
    };
  }
  return { kind: 'init', writeSentinel: !state.sentinelExists };
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
