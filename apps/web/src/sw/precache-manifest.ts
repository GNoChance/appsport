/**
 * Manifeste de précache que `precachePlugin` écrit en tête de `dist/sw.js` (ADR 0001) :
 * `self.__APPSPORT_PRECACHE__ = {"buildHash":…,"files":[…],"localDbVersion":…};`
 */
export interface PrecacheManifest {
  /** 12 hex : empreinte des fichiers de la coquille, nom du cache `shell-<buildHash>`. */
  buildHash: string;
  /** Chemins absolus de la coquille (`/index.html`, `/assets/…`), triés, sans `/sw.js` ni `*.map`. */
  files: string[];
  /**
   * LOCAL_DB_VERSION du build (R-PWA-9, ADR 0001 décision 5) : un SW de version inférieure à celle de la page
   * n'est jamais proposé ni activé.
   */
  localDbVersion: number;
}

export const PRECACHE_GLOBAL = '__APPSPORT_PRECACHE__';

// Noms des caches ici et non dans sw.ts : la page les lit sans embarquer le code du SW.
export const SHELL_CACHE_PREFIX = 'shell-';
export const ILLUSTRATIONS_CACHE = 'illustrations-v1';

/**
 * Marqueur de la plus haute version de base locale connue de l'appareil (ADR 0001 décision 5) : réponse
 * synthétique dont le corps est l'entier, jamais abaissée, écrite par la page après l'ouverture de Dexie et
 * par l'`activate` du SW. Ni la purge à l'activation ni l'interrupteur d'urgence ne la suppriment.
 */
export const LOCAL_DB_MARKER_CACHE = 'appsport-meta';
export const LOCAL_DB_MARKER_KEY = '/__sw/local-db-version';
