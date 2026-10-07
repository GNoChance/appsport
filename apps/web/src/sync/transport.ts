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

/** Réponse HTTP en erreur ; `code` = champ `error` du corps, seule base des décisions. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(code ?? `http_${status}`);
    this.name = 'HttpError';
  }
}

/** Réponse et corps JSON déjà lu (`null` si vide, `undefined` si illisible). */
export interface JsonReply {
  res: Response;
  body: unknown;
}

export function httpErrorOf(reply: JsonReply): HttpError {
  const { body } = reply;
  const code =
    typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : null;
  return new HttpError(reply.res.status, code);
}

interface Deadline {
  signal: AbortSignal;
  race<T>(p: Promise<T>): Promise<T>;
  /** Annule l'échéance ; `abort` libère aussi la requête (corps non lu). */
  end(abort: boolean): void;
}

function createDeadline(timeoutMs: number): Deadline {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new OfflineError('timeout'));
    }, timeoutMs);
  });
  expired.catch(() => {});
  return {
    signal: controller.signal,
    race(p) {
      // Rejet tardif d'une étape déjà abandonnée : ignoré.
      p.catch(() => {});
      return Promise.race([p, expired]);
    },
    end(abort) {
      clearTimeout(timer);
      if (abort) controller.abort();
    },
  };
}

function asOffline(error: unknown): unknown {
  if (error instanceof OfflineError) return error;
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
    return new OfflineError(error.message);
  }
  return error;
}

/**
 * Requête abandonnée sans réponse après `timeoutMs` (OfflineError) ; une erreur réseau (TypeError)
 * devient OfflineError ; toute réponse HTTP, même 5xx, est rendue telle quelle. Le délai couvre
 * l'arrivée des en-têtes seulement : l'appelant lit le corps à ses risques.
 */
export async function fetchWithTimeout(
  t: SyncTransport,
  path: string,
  init: RequestInit,
  timeoutMs: number = SYNC_TIMEOUT_MS,
): Promise<Response> {
  const deadline = createDeadline(timeoutMs);
  try {
    return await deadline.race(t.fetch(path, { ...init, signal: deadline.signal }));
  } catch (error) {
    throw asOffline(error);
  } finally {
    deadline.end(false);
  }
}

/**
 * Comme `fetchWithTimeout`, mais l'échéance court jusqu'à la fin de la lecture du corps : un corps
 * bloqué donne OfflineError au lieu de geler l'appelant. `onHeaders` est appelé avant la lecture
 * du corps (lecture de l'époque) ; son exception est propagée et la requête abandonnée.
 */
export async function fetchJsonWithTimeout(
  t: SyncTransport,
  path: string,
  init: RequestInit,
  timeoutMs: number = SYNC_TIMEOUT_MS,
  onHeaders?: (res: Response) => void,
): Promise<JsonReply> {
  const deadline = createDeadline(timeoutMs);
  try {
    const res = await deadline.race(t.fetch(path, { ...init, signal: deadline.signal }));
    onHeaders?.(res);
    const text = await deadline.race(res.text());
    if (text === '') return { res, body: null };
    try {
      return { res, body: JSON.parse(text) as unknown };
    } catch {
      return { res, body: undefined };
    }
  } catch (error) {
    throw asOffline(error);
  } finally {
    deadline.end(true);
  }
}
