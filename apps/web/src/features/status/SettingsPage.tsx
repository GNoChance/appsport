import { useId } from 'react';
import { Link } from 'wouter';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Page } from '../../ui';
import styles from './status.module.css';

const PERSISTENCE_LABELS = {
  granted: 'Stockage persistant : accordé',
  refused: 'Stockage persistant : refusé',
  unknown: 'Stockage persistant : pas encore demandé',
} as const;

export const STORAGE_ADVICE =
  "Ton navigateur peut effacer les données de l'appli si l'espace manque. Pense à télécharger tes données régulièrement.";

/**
 * Réglages : résultat de la demande de stockage persistant (R-SYN-31), faite à la fin de
 * l'onboarding dans l'appli installée. Un refus ne bloque rien mais conseille l'export.
 */
export function SettingsPage() {
  const repos = useRepos();
  // undefined : lecture en cours ; null : jamais demandé.
  const granted = useLive(() => repos.status.persistGranted(), [repos]);
  const headingId = useId();
  return (
    <Page title="Réglages" back="/profile">
      <section aria-labelledby={headingId} className={styles.section}>
        <h2 id={headingId}>Stockage</h2>
        {granted === undefined ? null : (
          <>
            <p>
              {granted === null
                ? PERSISTENCE_LABELS.unknown
                : granted
                  ? PERSISTENCE_LABELS.granted
                  : PERSISTENCE_LABELS.refused}
            </p>
            {granted === false ? (
              <>
                <p>{STORAGE_ADVICE}</p>
                <p>
                  <Link href="/profile/privacy">Télécharger mes données</Link>
                </p>
              </>
            ) : null}
          </>
        )}
      </section>
    </Page>
  );
}
