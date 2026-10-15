import styles from './ui.module.css';

export const HEALTH_WARNING_TEXT =
  'Rune ne remplace pas un avis médical. Consultez un médecin avant de reprendre une activité si vous avez un problème de santé, et arrêtez en cas de douleur.';

/** Avertissement santé, mot pour mot et en « vous » (spec refonte §11.6) ; un petit i le précède (maquette B07). */
export function HealthWarning() {
  return (
    <p className={styles.healthWarning}>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span>{HEALTH_WARNING_TEXT}</span>
    </p>
  );
}
