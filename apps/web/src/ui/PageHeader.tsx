import { Link } from 'wouter';
import styles from './ui.module.css';

function ChevronLeft() {
  return (
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
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

/**
 * En-tête d'une page interne : bouton « Retour » de 44 × 44 (un lien vers `back`, ou un bouton qui
 * appelle `back`), puis le titre de niveau 1. Les onglets de premier niveau n'ont pas de Retour.
 */
export function PageHeader(p: { title: string; back?: string | (() => void) }) {
  const { back } = p;
  return (
    <header className={styles.pageHeader}>
      {typeof back === 'string' ? (
        <Link href={back} aria-label="Retour" className={styles.backButton}>
          <ChevronLeft />
        </Link>
      ) : back ? (
        <button type="button" aria-label="Retour" onClick={() => back()} className={styles.backButton}>
          <ChevronLeft />
        </button>
      ) : null}
      <h1 className={styles.pageTitle}>{p.title}</h1>
    </header>
  );
}
