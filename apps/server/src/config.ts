import { join } from 'node:path';
import { ARGON2_PARAMS, type Argon2Params } from './deps';

export interface AppConfig {
  appOrigin: string;
  version: string;
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  sentinelPath: string;
  publicDir: string;
  contentDir: string;
  swKillSwitch: boolean;
  coachModel: string;
  anthropicApiKey: string | null;
  argon2: Argon2Params;
  sessionCookieName: '__Host-session' | 'dev-session';
  secureCookie: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function parseOrigin(raw: string | undefined): URL {
  if (!raw) throw new ConfigError('APP_ORIGIN est obligatoire (ex. https://appsport.exemple.ts.net).');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError("APP_ORIGIN n'est pas une URL valide.");
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new ConfigError('APP_ORIGIN doit être une origine seule (schéma, hôte, port), sans chemin.');
  }
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) return url;
  throw new ConfigError('APP_ORIGIN doit être en https (http seulement pour localhost ou 127.0.0.1).');
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 3000;
  if (!/^\d+$/.test(raw) || Number(raw) > 65535) {
    throw new ConfigError('PORT doit être un entier de 0 à 65535.');
  }
  return Number(raw);
}

const orDefault = (value: string | undefined, fallback: string): string =>
  value === undefined || value === '' ? fallback : value;

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const origin = parseOrigin(env.APP_ORIGIN);
  const secure = origin.protocol === 'https:';
  const dataDir = orDefault(env.APPSPORT_DATA_DIR, '/data');
  return {
    appOrigin: origin.origin,
    version: orDefault(env.APP_VERSION, 'dev'),
    port: parsePort(env.PORT),
    host: orDefault(env.HOST, '0.0.0.0'),
    dataDir,
    dbPath: join(dataDir, 'appsport.db'),
    sentinelPath: join(dataDir, '.appsport-volume'),
    publicDir: orDefault(env.APPSPORT_PUBLIC_DIR, '/app/public'),
    contentDir: orDefault(env.APPSPORT_CONTENT_DIR, '/app/data'),
    swKillSwitch: env.SW_KILL_SWITCH === '1',
    coachModel: orDefault(env.COACH_MODEL, 'claude-opus-5-5'),
    anthropicApiKey: env.ANTHROPIC_API_KEY ? env.ANTHROPIC_API_KEY : null,
    argon2: { ...ARGON2_PARAMS },
    sessionCookieName: secure ? '__Host-session' : 'dev-session',
    secureCookie: secure,
  };
}
