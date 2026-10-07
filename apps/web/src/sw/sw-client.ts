import type { PageToSw } from './protocol';

/** Poste au service worker qui contrôle la page ; `false` sans contrôleur. */
export function postToSw(msg: PageToSw): boolean {
  const controller = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker?.controller;
  if (!controller) return false;
  controller.postMessage(msg);
  return true;
}
