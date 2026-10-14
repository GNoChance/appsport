import type { ReactNode } from 'react';
import type { CoachMode } from './art/art-types';
import type { CoachId } from './art/coach-id';
import { COACH_NAMES, CoachAvatar } from './CoachAvatar';
import styles from './voice.module.css';

/**
 * Bulle du coach : avatar animé de 40 px et texte écrit à l'avance, étiqueté « Aujourd'hui », « Aperçu » ou
 * « Message d'accueil » (spec refonte §8). Le texte est là d'emblée : ni frappe simulée, ni « en train
 * d'écrire ». L'avatar est tu (le nom est écrit dans la bulle).
 */
export function CoachBubble(p: {
  coach: CoachId;
  label: "Aujourd'hui" | 'Aperçu' | "Message d'accueil";
  mode?: CoachMode;
  children: ReactNode;
}) {
  const mode = p.mode ?? 'training';
  const name = mode === 'nutrition' ? `${COACH_NAMES[p.coach]} · Nutrition` : COACH_NAMES[p.coach];
  return (
    <div className={styles.bubbleRow} data-mode={mode}>
      <span className={styles.bubbleAvatar} aria-hidden="true">
        <CoachAvatar coach={p.coach} mode={mode} size={40} animated />
      </span>
      <div className={styles.bubble}>
        <div className={styles.bubbleHead}>
          <span className={styles.bubbleName}>{name}</span>
          <span className={styles.bubbleLabel}>{p.label}</span>
        </div>
        <div className={styles.bubbleText}>{p.children}</div>
      </div>
    </div>
  );
}
