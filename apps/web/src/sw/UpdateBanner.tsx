import { useCallback, useState, useSyncExternalStore } from 'react';
import { useLive, useMe } from '../app-services';
import { useRepos } from '../repos';
import { Button } from '../ui/Button';
import {
  NO_UPDATE,
  type SwController,
  shouldShowUpdateBanner,
  swControllerStore,
  type UpdateState,
} from './register';
import styles from './UpdateBanner.module.css';

/**
 * Bandeau « Nouvelle version disponible » (R-PWA-2). Non fermable (`dismissible` faux, après un 426,
 * R-PWA-5) : pas de « Plus tard », et la consigne pour reprendre la synchronisation.
 */
export function UpdateBannerView(p: {
  show: boolean;
  dismissible: boolean;
  onUpdate(): void;
  onDismiss(): void;
}) {
  if (!p.show) return null;
  return (
    <div
      role="status"
      data-testid="update-banner"
      data-dismissible={String(p.dismissible)}
      className={p.dismissible ? styles.banner : `${styles.banner} ${styles.forced}`}
    >
      <p className={styles.text}>
        <strong>Nouvelle version disponible</strong>
        {p.dismissible ? null : <span>Mets à jour l'appli pour reprendre la synchronisation.</span>}
      </p>
      <div className={styles.actions}>
        <Button onClick={p.onUpdate}>Mettre à jour</Button>
        {p.dismissible ? (
          <Button variant="secondary" onClick={p.onDismiss}>
            Plus tard
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function useUpdateState(controller: SwController | null): UpdateState {
  const subscribe = useCallback(
    (onChange: () => void) => (controller ? controller.subscribe(onChange) : () => {}),
    [controller],
  );
  const getSnapshot = useCallback(() => controller?.getState() ?? NO_UPDATE, [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Bandeau du cadre connecté, piloté par le contrôleur publié (`swControllerStore`). « Plus tard » le
 * masque jusqu'au prochain lancement, sauf après un 426. Sans version en attente, rien n'est lu dans la
 * base locale.
 */
export function UpdateBanner() {
  const controller = useSyncExternalStore(swControllerStore.subscribe, swControllerStore.get);
  const update = useUpdateState(controller);
  const [dismissed, setDismissed] = useState(false);
  if (!controller || !update.available) return null;
  return (
    <AvailableUpdateBanner
      forced={update.forced}
      dismissed={dismissed}
      onUpdate={() => void controller.applyUpdate()}
      onDismiss={() => setDismissed(true)}
    />
  );
}

/**
 * Version en attente : jamais pendant une séance (`activeSessionId`, rien tant qu'il n'est pas lu) ni
 * pendant l'onboarding (R-PWA-3), même forcé (R-PWA-5).
 */
function AvailableUpdateBanner(p: {
  forced: boolean;
  dismissed: boolean;
  onUpdate(): void;
  onDismiss(): void;
}) {
  const repos = useRepos();
  const me = useMe();
  const activeSessionId = useLive(() => repos.status.activeSessionId(), [repos]);
  if (activeSessionId === undefined) return null;
  const { show, dismissible } = shouldShowUpdateBanner({
    available: true,
    forced: p.forced,
    activeSessionId,
    onboardingInProgress: me !== null && me.onboardingCompletedAt === null,
  });
  return (
    <UpdateBannerView
      show={show && !(p.dismissed && dismissible)}
      dismissible={dismissible}
      onUpdate={p.onUpdate}
      onDismiss={p.onDismiss}
    />
  );
}
