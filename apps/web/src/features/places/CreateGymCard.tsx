import { useId } from 'react';
import styles from './places.module.css';

/**
 * Carte en pointillés « Créer une salle » sous la liste des salles (maquette B04, onboarding) : un bouton
 * nommé par son titre et décrit par sa phrase ; l'icône « + » et le chevron sont décoratifs.
 */
export function CreateGymCard(p: { onClick(): void }) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return (
    <button
      type="button"
      className={styles.createCard}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={p.onClick}
    >
      <span className={styles.createIcon}>
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className={styles.createText}>
        <span id={titleId} className={styles.createTitle}>
          Créer une salle
        </span>
        <span id={descriptionId} className={styles.createDescription}>
          Ma salle n'est pas dans la liste
        </span>
      </span>
      <svg
        className={styles.createChevron}
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
