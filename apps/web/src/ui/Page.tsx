import type { ReactNode } from 'react';
import { Link } from 'wouter';
import styles from './ui.module.css';

/** Page d'écran : un seul titre de niveau 1, lien de retour facultatif. */
export function Page(p: { title: string; back?: string; children: ReactNode }) {
  return (
    <section className={styles.page}>
      {p.back ? (
        <Link href={p.back} className={styles.back}>
          Retour
        </Link>
      ) : null}
      <h1>{p.title}</h1>
      {p.children}
    </section>
  );
}
