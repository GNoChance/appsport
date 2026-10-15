import { useId } from 'react';
import { Link } from 'wouter';
import { useLive, useSyncState } from '../../app-services';
import { useRepos } from '../../repos';
import { ListGroup, ListRow, Page, plural } from '../../ui';
import { AlertIcon, OfflineIcon, SignalIcon, StorageIcon, UploadIcon } from '../profile/icons';
import { AppearanceSection } from './AppearanceSection';
import { CONNECTION_LABELS, CONNECTION_TONES } from './ConnectionStatus';
import { PendingCounter } from './PendingCounter';
import styles from './status.module.css';
import { useReadiness } from './use-readiness';

const PERSISTENCE_VALUES = {
  granted: 'Accordé',
  refused: 'Refusé',
  unknown: 'Pas encore demandé',
} as const;

export const STORAGE_ADVICE =
  "Ton navigateur peut effacer les données de l'appli si l'espace manque. Pense à télécharger tes données régulièrement.";

/**
 * Profil › Réglages (spec refonte §4 et §5, maquette C03) : Apparence, puis Synchronisation (état de connexion,
 * prêt hors ligne, envois en attente et refus du serveur, passés de l'ancien en-tête) et Stockage (résultat de
 * la demande de stockage persistant, R-SYN-31 : un refus ne bloque rien mais conseille l'export).
 */
export function SettingsPage() {
  return (
    <Page title="Réglages" back="/profile">
      <AppearanceSection />
      <SyncSection />
      <StorageSection />
    </Page>
  );
}

/**
 * Synchronisation (R-SYN-30, R-SYN-34) : tout vient du moteur de synchro, la même source que la pastille de
 * l'accueil et que les écrans qui répondent « Nécessite le réseau » (jamais `navigator.onLine`). Des refus : la
 * ligne mène aux éléments refusés.
 */
function SyncSection() {
  const { connection, rejected } = useSyncState();
  const { readiness, loaded } = useReadiness();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.sectionTitle}>
        Synchronisation
      </h2>
      <ListGroup>
        <ListRow
          icon={<SignalIcon />}
          label="Connexion"
          emphasis="value"
          value={
            <span className={styles.connection} data-tone={CONNECTION_TONES[connection]}>
              <span className={styles.connectionDot} aria-hidden="true" />
              {CONNECTION_LABELS[connection]}
            </span>
          }
        />
        <ListRow
          icon={<OfflineIcon />}
          label="Sans réseau"
          emphasis="value"
          value={loaded ? (readiness.ready ? 'Prêt hors ligne' : 'Pas encore prêt hors ligne') : undefined}
        />
        <ListRow icon={<UploadIcon />} label="Envoi au serveur" value={<PendingCounter />} emphasis="value" />
        {rejected > 0 ? (
          <ListRow
            icon={<AlertIcon />}
            label="Refus du serveur"
            // Le nom dit l'action, puis reprend le libellé visible (maquette C03, WCAG 2.5.3).
            name="Voir les éléments refusés : Refus du serveur"
            emphasis="value"
            value={
              <span className={styles.refused}>{`${rejected} ${plural(rejected, 'refusé', 'refusés')}`}</span>
            }
            href="/rejections"
          />
        ) : (
          <ListRow icon={<AlertIcon />} label="Refus du serveur" value="Aucun refus" emphasis="value" />
        )}
      </ListGroup>
    </section>
  );
}

/** Stockage persistant (R-SYN-31), demandé à la fin de l'onboarding dans l'appli installée. */
function StorageSection() {
  const repos = useRepos();
  // undefined : lecture en cours ; null : jamais demandé.
  const granted = useLive(() => repos.status.persistGranted(), [repos]);
  const headingId = useId();
  const value =
    granted === undefined
      ? undefined
      : granted === null
        ? PERSISTENCE_VALUES.unknown
        : granted
          ? PERSISTENCE_VALUES.granted
          : PERSISTENCE_VALUES.refused;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.sectionTitle}>
        Stockage
      </h2>
      <ListGroup>
        <ListRow icon={<StorageIcon />} label="Stockage persistant" value={value} emphasis="value" />
      </ListGroup>
      {granted === false ? (
        <>
          <p>{STORAGE_ADVICE}</p>
          <p>
            <Link href="/profile/privacy" className={styles.textLink}>
              Télécharger mes données
            </Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
