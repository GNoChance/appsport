import { type ReactNode, useId } from 'react';
import styles from './voice.module.css';

/**
 * Fenêtre du Système (sa voix froide, aux moments clés seulement) : étiquette « [ SYSTÈME ] », titre, texte.
 * En sombre et en Salle de nuit, un coin HUD ; en clair et en Carnet, une barre dégradée en haut.
 * `success` : la même fenêtre au vert du succès (quête remplie, action réussie).
 */
export function SystemPanel(p: { title: string; children: ReactNode; tone?: 'default' | 'success' }) {
  const titleId = useId();
  const tone = p.tone ?? 'default';
  return (
    <section
      aria-labelledby={titleId}
      data-tone={tone}
      className={[styles.panel, tone === 'success' ? styles.success : null].filter(Boolean).join(' ')}
    >
      <span className={styles.hudCorner} aria-hidden="true" />
      <div className={styles.panelHead}>
        <div className={styles.systemLabel}>[ SYSTÈME ]</div>
        <h2 id={titleId} className={styles.panelTitle}>
          {p.title}
        </h2>
      </div>
      <div className={styles.panelBody}>{p.children}</div>
    </section>
  );
}
