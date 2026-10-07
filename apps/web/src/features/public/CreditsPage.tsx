import { Page } from '../../ui';
import styles from './public.module.css';

/**
 * Statique au socle, sans requête : la brique 2 y ajoute l'auteur, la licence et la source de
 * chaque illustration, depuis une source publique (`/api/catalog` exige une session).
 */
export function CreditsPage() {
  return (
    <Page title="Crédits">
      <p>Aucune illustration pour le moment.</p>
      <p className={styles.muted}>
        Chaque illustration ajoutée portera ici son auteur, sa licence, sa source et la mention « modifié » le
        cas échéant.
      </p>
    </Page>
  );
}
