import { ONBOARDING_COMPLETED_EVENT } from '../app-events';
import { isStandalone } from '../features/auth/install-help';
import type { StatusRepo } from '../repos/status-repo';

/**
 * Stockage persistant à la fin de l'onboarding, dans l'appli installée seulement (R-SYN-31) : écoute
 * ONBOARDING_COMPLETED_EVENT (émis par l'écran « C'est prêt ») ; le résultat va dans meta.persistGranted
 * (Réglages). Rend la fonction qui retire l'écoute.
 */
export function installPersistOnOnboarding(
  status: Pick<StatusRepo, 'requestPersistentStorage'>,
  env: { win?: Window; standalone?: () => boolean } = {},
): () => void {
  const win = env.win ?? window;
  const standalone = env.standalone ?? (() => isStandalone(win));
  const onCompleted = () => {
    if (standalone()) void status.requestPersistentStorage().catch(() => {});
  };
  win.addEventListener(ONBOARDING_COMPLETED_EVENT, onCompleted);
  return () => win.removeEventListener(ONBOARDING_COMPLETED_EVENT, onCompleted);
}
