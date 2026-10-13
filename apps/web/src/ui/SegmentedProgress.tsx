import type { CSSProperties } from 'react';
import styles from './ui.module.css';

/**
 * Barre de progression segmentée de l'onboarding : `total` segments, les `step` premiers faits, dans
 * le dégradé d'accent qui court sur toute la barre ; « Étape n sur total » dit la même chose en texte.
 */
export function SegmentedProgress(p: { step: number; total: number }) {
  const done = Math.min(Math.max(p.step, 0), p.total);
  return (
    <div className={styles.progress}>
      <div className={styles.segments} aria-hidden="true">
        {Array.from({ length: p.total }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: segments sans identité propre, toujours dans le même ordre
            key={i}
            data-segment=""
            data-done={i < done ? '' : undefined}
            className={styles.segment}
            style={{ '--segment-index': i, '--segment-last': Math.max(p.total - 1, 1) } as CSSProperties}
          />
        ))}
      </div>
      <p className={styles.progressText}>
        Étape {p.step} sur {p.total}
      </p>
    </div>
  );
}
