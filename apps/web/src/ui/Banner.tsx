import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** Bandeau : une erreur est annoncée tout de suite (`alert`), le reste poliment (`status`). */
export function Banner(p: { tone: 'info' | 'warning' | 'error'; children: ReactNode }) {
  return (
    <div role={p.tone === 'error' ? 'alert' : 'status'} className={`${styles.banner} ${styles[p.tone]}`}>
      {p.children}
    </div>
  );
}
