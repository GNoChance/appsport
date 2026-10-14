import { useSyncState } from '../app-services';
import { CONNECTION_LABELS, CONNECTION_TONES } from '../features/status/ConnectionStatus';
import styles from './shell.module.css';

/**
 * Pastille compacte de l'en-tête de l'accueil (maquettes MixSombre / MixClair) : un point, puis l'état de
 * connexion. Une seule source de vérité, `useSyncState().connection`, celle des écrans qui répondent
 * « Nécessite le réseau » : jamais « En ligne » quand ils sont hors ligne. Annoncée poliment quand elle change.
 */
export function ConnectionPill() {
  const { connection } = useSyncState();
  return (
    <span data-testid="connection-status" data-state={connection} role="status" className={styles.pill}>
      <span aria-hidden="true" className={styles.pillDot} data-tone={CONNECTION_TONES[connection]} />
      {CONNECTION_LABELS[connection]}
    </span>
  );
}
