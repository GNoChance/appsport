import { useSyncState } from '../../app-services';
import type { ConnectionState } from '../../sync/engine';
import styles from './status.module.css';

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  online: 'En ligne',
  offline: 'Hors ligne',
  unknown: 'Connexion…',
  unauthenticated: 'Session expirée',
  protocol_unsupported: 'Mise à jour nécessaire',
  account_deleted: 'Compte supprimé',
};

/**
 * État de connexion tel que le moteur de synchro l'a constaté (résultat des appels et sonde
 * `/api/health`, R-SYN-30) ; annoncé poliment quand il change.
 */
export function ConnectionStatus() {
  const { connection } = useSyncState();
  return (
    <span data-testid="connection-status" data-state={connection} role="status" className={styles.connection}>
      {CONNECTION_LABELS[connection]}
    </span>
  );
}
