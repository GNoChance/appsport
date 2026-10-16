import { type CSSProperties, useId } from 'react';
import { CountUp, Page, RankBadge } from '../../ui';
import styles from './progression.module.css';

/** Les 9 groupes musculaires de l'avant-goût, dans l'ordre de la maquette (constante d'affichage). */
export const MUSCLE_GROUPS_LABELS = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Bras',
  'Abdos',
  'Fessiers',
  'Quadriceps',
  'Ischios',
  'Mollets',
] as const;

/**
 * Onglet Progression en avant-goût (spec refonte §9, maquettes ProgressionSombre / ProgressionClair, prototype
 * « Progression ») : rang global E et sa barre d'XP vide (seul un reflet la traverse), compteurs à 0 (séances,
 * kg soulevés, semaines d'assiduité), les 9 groupes musculaires au rang E, puis la note du Système. Aucune
 * valeur inventée : le calcul réel arrive avec la brique 3. Les cartes entrent en cascade, les compteurs
 * défilent (`CountUp`, à leur valeur finale tout de suite sous mouvement réduit).
 */
export function ProgressionPage() {
  const rankTitle = useId();
  const musclesTitle = useId();
  return (
    <Page title="Progression">
      <div className={`${styles.content} stagger`}>
        <section aria-labelledby={rankTitle} className={styles.hero}>
          <span className={styles.heroBadge}>
            <RankBadge rank="E" size={92} />
          </span>
          <div className={styles.heroInfo}>
            <h2 id={rankTitle} className={styles.kicker}>
              Rang global
            </h2>
            <p className={styles.rankName}>Rang E</p>
            <div className={styles.xpBar} data-xp="0" aria-hidden="true">
              <span className={styles.xpSweep} />
            </div>
            <p className={styles.xpMeta}>
              <span>
                <span aria-hidden="true">0 / 100 XP</span>
                <span className={styles.srOnly}>0 sur 100 XP</span>
              </span>{' '}
              <span>Prochain : D</span>
            </p>
          </div>
        </section>
        <ul className={styles.stats}>
          <li className={styles.stat}>
            <span className={styles.statValue}>
              <CountUp to={0} />
            </span>{' '}
            <span className={styles.statLabel}>séances</span>
          </li>
          <li className={styles.stat}>
            <span className={styles.statValue}>
              <CountUp to={0} />
              <small> kg</small>
            </span>{' '}
            <span className={styles.statLabel}>soulevés</span>
          </li>
          <li className={styles.stat}>
            <span className={styles.statValue}>
              <CountUp to={0} />
              <small aria-hidden="true"> sem.</small>
              <span className={styles.srOnly}> semaine</span>
            </span>{' '}
            <span className={styles.statLabel}>d'assiduité</span>
          </li>
        </ul>
        <section aria-labelledby={musclesTitle} className={styles.muscles}>
          <div className={styles.sectionHead}>
            <h2 id={musclesTitle} className={styles.sectionTitle}>
              Rangs par muscle
            </h2>
            <span className={styles.sectionCount}>{`${MUSCLE_GROUPS_LABELS.length} groupes`}</span>
          </div>
          <ul className={styles.muscleGrid}>
            {MUSCLE_GROUPS_LABELS.map((label, index) => (
              <li key={label} className={styles.muscle} style={{ '--i': index } as CSSProperties}>
                <RankBadge rank="E" size={32} mini />
                <span className={styles.muscleLabel}>{label}</span>
              </li>
            ))}
          </ul>
        </section>
        <div role="note" className={styles.systemNote}>
          <p className={styles.systemLabel}>
            <span aria-hidden="true">[ </span>SYSTÈME<span aria-hidden="true"> ]</span>
          </p>{' '}
          <p className={styles.noteText}>Aucune séance gravée. Ta première séance débloque tes rangs.</p>
        </div>
      </div>
    </Page>
  );
}
