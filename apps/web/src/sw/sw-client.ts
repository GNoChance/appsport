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
    (s.localDbVersion === undefined || typeof s.localDbVersion === 'number')
  );
}

/**
 * État du service worker (`GET_STATUS`, réponse sur un MessageChannel) ; `null` sans contrôleur,
 * sans réponse valide dans `timeoutMs`, ou si l'envoi échoue.
 */
export async function getSwStatus(timeoutMs = 1000): Promise<SwStatus | null> {
  const controller = currentController();
  if (!controller) return null;
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
      controller.postMessage({ type: 'GET_STATUS' } satisfies PageToSw, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}
