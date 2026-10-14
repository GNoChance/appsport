import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';
import styles from './ui.module.css';

/**
 * Page d'écran : son en-tête (`PageHeader` : Retour de 44 × 44 si `back`, puis le seul titre de niveau 1),
 * puis le contenu. Les onglets de premier niveau n'ont pas de Retour.
 */
export function Page(p: { title: string; back?: string | (() => void); children: ReactNode }) {
  return (
    <section className={styles.page}>
      <PageHeader title={p.title} back={p.back} />
      {p.children}
    </section>
  );
}
