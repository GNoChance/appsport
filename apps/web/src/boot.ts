import type { AppServices } from './app-services';

/**
 * Démarrage de l'appli : le moteur pose ses déclencheurs (premier plan, `online`, intervalle) puis
 * lance la synchro de lancement (R-SYN-29). Rend la fonction d'arrêt.
 */
export function bootApp(s: AppServices): () => void {
  s.sync.start();
  return () => s.sync.stop();
}
