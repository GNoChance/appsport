import type { ReactNode } from 'react';
import styles from './ui.module.css';

const TONES = {
  accent: styles.badgeAccent,
  success: styles.badgeSuccess,
  muted: styles.badgeMuted,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
} as const;

/**
 * Badge de rôle (accent, contour) ou de statut (teinte et point) : « Admin », « Actif », « Désactivé »,
 * « En attente »… Le texte dit toujours l'état, la couleur ne fait que l'appuyer.
 */
export function Badge(p: {
  tone: 'accent' | 'success' | 'muted' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return (
    <span className={`${styles.badge} ${TONES[p.tone]}`}>
      {p.tone === 'accent' ? null : <span className={styles.badgeDot} aria-hidden="true" />}
      {p.children}
    </span>
  );
}
