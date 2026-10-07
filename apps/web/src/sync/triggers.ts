import { SYNC_INTERVAL_MS } from '@appsport/contracts';
import type { SyncEngine } from './engine';

/**
 * Déclencheurs de la synchro : retour au premier plan, événement `online` (simple indice, l'état
 * vient des requêtes, jamais de `navigator.onLine`), et toutes les 60 s tant que l'outbox n'est
 * pas vide et l'appli visible. Rend la fonction qui les retire.
 */
export function installSyncTriggers(
  engine: SyncEngine,
  env: { doc?: Document; win?: Window } = {},
): () => void {
  const doc = env.doc ?? document;
  const win = env.win ?? window;
  const visible = () => doc.visibilityState === 'visible';
  const onVisibility = () => {
    if (visible()) void engine.syncNow('foreground');
  };
  const onOnline = () => {
    void engine.syncNow('online');
  };
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('online', onOnline);
  const interval = setInterval(() => {
    if (visible() && engine.getState().pending > 0) void engine.syncNow('interval');
  }, SYNC_INTERVAL_MS);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('online', onOnline);
    clearInterval(interval);
  };
}
