import { Page } from '../../ui';
import styles from './public.module.css';
import { usePublicBack } from './use-public-back';

/**
 * Contenu des crédits, montré dans Aide (spec refonte §5, P10) et sur /credits. Statique au socle, sans
 * requête : la brique 2 y ajoute l'auteur, la licence et la source de chaque illustration, depuis une source
 * publique (`/api/catalog` exige une session).
 */
export function CreditsContent() {
  return (
    <div className={`${styles.card} ${styles.credits}`}>
      <p>Aucune illustration pour le moment.</p>
      <p className={styles.muted}>
        Chaque illustration ajoutée portera ici son auteur, sa licence, sa source et la mention « modifié » le
        cas échéant.
      </p>
    </div>
  );
}

/** /credits reste servi (P10) : le même contenu que la section Crédits d'Aide. */
export function CreditsPage() {
  const back = usePublicBack();
  return (
    <Page title="Crédits" back={back}>
      <CreditsContent />
    </Page>
  );
}
