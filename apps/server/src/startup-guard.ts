import { existsSync } from 'node:fs';
import type { AppConfig } from './config';

export class StartupError extends Error {
  readonly code: 'no_sentinel' | 'no_database';

  constructor(code: StartupError['code'], message: string) {
    super(message);
    this.name = 'StartupError';
    this.code = code;
  }
}

/** Refuse de démarrer sans volume monté ni base : jamais de base vide créée par erreur. */
export function assertStartupPreconditions(
  cfg: AppConfig,
  fs: { existsSync(p: string): boolean } = { existsSync },
): void {
  if (!fs.existsSync(cfg.sentinelPath)) {
    throw new StartupError(
      'no_sentinel',
      `Volume de données absent : fichier sentinelle ${cfg.sentinelPath} introuvable. Le volume chiffré est-il déverrouillé ?`,
    );
  }
  if (!fs.existsSync(cfg.dbPath)) {
    throw new StartupError(
      'no_database',
      `Base introuvable : ${cfg.dbPath}. Lancez « server.mjs init » sur un volume neuf, ou restaurez une sauvegarde.`,
    );
  }
}
