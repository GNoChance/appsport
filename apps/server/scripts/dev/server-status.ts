// Lignes de service que l'entrée de dev du serveur (`server-entry.ts`) écrit sur sa sortie : `tsx watch` survit à
// l'arrêt du serveur et n'en dit rien, ces lignes le disent au script, qui les retire de l'affichage.

const MARK = '@@rune-dev serveur';
const PATTERN = /^@@rune-dev serveur (?:(pret)|sortie (\d+))$/;

export const serverReadyLine = (): string => `${MARK} pret`;
export const serverExitLine = (code: number): string => `${MARK} sortie ${String(code)}`;

export type ServerStatus = { kind: 'ready' } | { kind: 'exit'; code: number };

export function parseServerStatus(line: string): ServerStatus | null {
  const match = PATTERN.exec(line);
  if (!match) return null;
  return match[1] ? { kind: 'ready' } : { kind: 'exit', code: Number(match[2]) };
}

/**
 * - `failed-at-start` : sorti avant d'avoir jamais écouté (port, adresse, base) ; il faut tout arrêter.
 * - `crashed` : sorti après avoir tourné (erreur dans le code modifié) ; `tsx watch` le relance à la prochaine
 *   modification, le web reste lancé.
 * - `restarted` : de nouveau prêt après un arrêt en erreur. `started` : prêt, rien à signaler.
 */
export type ServerEvent = 'started' | 'failed-at-start' | 'crashed' | 'restarted';

export function createServerWatch(): (status: ServerStatus) => ServerEvent {
  let startedOnce = false;
  let down = false;
  return (status) => {
    if (status.kind === 'exit') {
      if (!startedOnce) return 'failed-at-start';
      down = true;
      return 'crashed';
    }
    startedOnce = true;
    if (!down) return 'started';
    down = false;
    return 'restarted';
  };
}
