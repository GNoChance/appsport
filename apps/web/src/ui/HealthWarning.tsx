import styles from './ui.module.css';

export const HEALTH_WARNING_TEXT =
  'appsport ne remplace pas un avis médical. Consultez un médecin avant de reprendre une activité si vous avez un problème de santé, et arrêtez en cas de douleur.';

export function HealthWarning() {
  return <p className={styles.healthWarning}>{HEALTH_WARNING_TEXT}</p>;
}
