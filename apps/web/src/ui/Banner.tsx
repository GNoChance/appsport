import type { ReactNode } from 'react';
import styles from './ui.module.css';

const TONES = { info: styles.bannerInfo, warning: styles.bannerWarning, error: styles.bannerError } as const;

/** Icône du ton : i pour une info, triangle pour un avertissement, croix cerclée pour une erreur. */
function ToneGlyph(p: { tone: 'info' | 'warning' | 'error' }) {
  return (
    <svg
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
      {p.tone === 'info' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </>
      ) : p.tone === 'warning' ? (
        <>
          <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
          <path d="M12 9.5v4" />
          <path d="M12 17h.01" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </>
      )}
    </svg>
  );
}

/**
 * Bandeau info, avertissement ou erreur, icône et texte : une erreur est annoncée tout de suite
 * (`alert`), le reste poliment (`status`).
 */
export function Banner(p: { tone: 'info' | 'warning' | 'error'; children: ReactNode }) {
  return (
    <div role={p.tone === 'error' ? 'alert' : 'status'} className={`${styles.banner} ${TONES[p.tone]}`}>
      <span className={styles.bannerIcon} aria-hidden="true">
        <ToneGlyph tone={p.tone} />
      </span>
      <div className={styles.bannerBody}>{p.children}</div>
    </div>
  );
}
