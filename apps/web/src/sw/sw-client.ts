import type { PageToSw, SwStatus } from './protocol';

function currentController(): ServiceWorker | null {
  return typeof navigator === 'undefined' ? null : (navigator.serviceWorker?.controller ?? null);
}

/** Poste au service worker qui contrôle la page ; `false` sans contrôleur. */
export function postToSw(msg: PageToSw): boolean {
  const controller = currentController();
  if (!controller) return false;
  controller.postMessage(msg);
  return true;
}

function isSwStatus(v: unknown): v is SwStatus {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s.type === 'STATUS' &&
    typeof s.buildHash === 'string' &&
    typeof s.shellCached === 'boolean' &&
    typeof s.illustrationsMissing === 'number' &&
    (s.illustrationsReferenced === undefined ||
      s.illustrationsReferenced === null ||
      typeof s.illustrationsReferenced === 'number') &&
    (s.localDbVersion === undefined || typeof s.localDbVersion === 'number')
  );
}

/** Destinataire de `GET_STATUS` : le contrôleur de la page, ou un SW en attente (T37). */
export interface SwStatusTarget {
  postMessage(msg: PageToSw, transfer: Transferable[]): void;
}

/**
 * `GET_STATUS` à `target`, réponse sur un MessageChannel ; `null` sans réponse valide dans `timeoutMs`,
 * ou si l'envoi échoue.
 */
export function requestSwStatus(target: SwStatusTarget, timeoutMs = 1000): Promise<SwStatus | null> {
  return new Promise<SwStatus | null>((resolve) => {
    const channel = new MessageChannel();
    const finish = (status: SwStatus | null) => {
      clearTimeout(timer);
      channel.port1.onmessage = null;
      channel.port1.close();
      resolve(status);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent) => finish(isSwStatus(event.data) ? event.data : null);
    try {
      target.postMessage({ type: 'GET_STATUS' } satisfies PageToSw, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

/**
 * État du service worker qui contrôle la page (`GET_STATUS`) ; `null` sans contrôleur, sans réponse
 * valide dans `timeoutMs`, ou si l'envoi échoue.
 */
export async function getSwStatus(timeoutMs = 1000): Promise<SwStatus | null> {
  const controller = currentController();
  return controller ? requestSwStatus(controller, timeoutMs) : null;
}
