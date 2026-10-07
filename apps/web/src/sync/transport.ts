import { SYNC_TIMEOUT_MS } from '@appsport/contracts';

/** Accès HTTP de la synchro : `fetch` du navigateur en production, faux serveur en test. */
export interface SyncTransport {
  fetch(path: string, init: RequestInit): Promise<Response>;
}

export function browserTransport(baseUrl = ''): SyncTransport {
  return { fetch: (path, init) => fetch(`${baseUrl}${path}`, { credentials: 'same-origin', ...init }) };
}

/** Pas de réponse à temps, ou réseau injoignable : seule source de l'état « hors ligne ». */
export class OfflineError extends Error {
  constructor(message = 'offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

/**
 * Requête abandonnée sans réponse après `timeoutMs` (OfflineError) ; une erreur réseau (TypeError)
 * devient OfflineError ; toute réponse HTTP, même 5xx, est rendue telle quelle. Le délai couvre
 * l'arrivée de la réponse, pas la lecture du corps.
 */
export async function fetchWithTimeout(
  t: SyncTransport,
  path: string,
  init: RequestInit,
  timeoutMs: number = SYNC_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new OfflineError('timeout'));
    }, timeoutMs);
  });
  const request = t.fetch(path, { ...init, signal: controller.signal });
  // Rejet tardif d'une requête déjà abandonnée : ignoré.
  request.catch(() => {});
  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof OfflineError) throw error;
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      throw new OfflineError(error.message);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
