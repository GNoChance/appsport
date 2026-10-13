import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** État vide : icône dans un cercle teinté d'accent, titre, une phrase et l'action quand il y en a une. */
export function EmptyState(p: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {p.icon}
      </span>
      <p className={styles.emptyTitle}>{p.title}</p>
      <p className={styles.emptyText}>{p.text}</p>
      {p.action ? <div className={styles.emptyAction}>{p.action}</div> : null}
    </div>
  );
}
