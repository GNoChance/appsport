import { Link } from 'wouter';
import { useSyncState } from '../../app-services';
import { plural } from '../../ui/format';
import styles from './status.module.css';

/** « N en attente » : opérations de l'outbox pas encore acceptées par le serveur (R-SYN-34). */
export function PendingCounter() {
  const { pending } = useSyncState();
  return (
    <span data-testid="pending-counter" data-count={pending} className={styles.counter}>
      {`${pending} en attente`}
    </span>
  );
}

/**
 * « N refusé(s) », lien vers les rejets (R-SYN-18, R-SYN-34) ; compte du moteur de synchro, mis à
 * jour à la fin de chaque cycle. Sans refus : élément vide (data-count '0'), rien à lire.
 */
export function RejectedCounter() {
  const { rejected } = useSyncState();
  return (
    <span data-testid="rejected-counter" data-count={rejected} className={styles.counter}>
      {rejected > 0 ? (
        <Link href="/rejections" className={styles.rejected}>
          {`${rejected} ${plural(rejected, 'refusé', 'refusés')}`}
        </Link>
      ) : null}
    </span>
  );
}
