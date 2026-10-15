import type { TrainingProfileView } from '../../repos';
import styles from './onboarding.module.css';

/** Une quête d'éveil et son état réel. */
export interface AwakeningQuest {
  label: string;
  done: boolean;
}

/**
 * Les 3 quêtes d'éveil (spec refonte §10.2), d'après les vrais états seulement : profil complété (coach,
 * objectif, niveau et disponibilité donnés), lieu principal choisi, prêt hors ligne (le voyant de R-SYN-33).
 * Un état encore inconnu (profil pas encore lu) compte comme non atteint : jamais de coche inventée.
 */
export function awakeningQuests(s: {
  profile: TrainingProfileView | null | undefined;
  hasPrimaryPlace: boolean;
  offlineReady: boolean;
}): AwakeningQuest[] {
  const p = s.profile;
  const profileComplete =
    !!p &&
    p.coach !== null &&
    p.goal !== null &&
    p.experience !== null &&
    p.daysPerWeek !== null &&
    p.sessionMinutes !== null;
  return [
    { label: 'Profil complété', done: profileComplete },
    { label: 'Lieu principal choisi', done: s.hasPrimaryPlace },
    { label: 'Prêt hors ligne', done: s.offlineReady },
  ];
}

function QuestCheck() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

/**
 * Carte « Quêtes d'éveil » (maquette B08, prototype « Éveil terminé ») : le compte « n/3 », la barre qui se
 * remplit, puis chaque quête en case à cocher en lecture seule (cochée seulement quand l'état réel l'est) :
 * atteignable au clavier comme toute case en lecture seule, elle ne se coche pas à la main. Les coches se gravent
 * une à une (onboarding.module.css) ; l'état, lui, est là dès le premier rendu.
 */
export function AwakeningQuests(p: { quests: readonly AwakeningQuest[] }) {
  const done = p.quests.filter((q) => q.done).length;
  const total = p.quests.length;
  return (
    <div className={styles.quests}>
      <p className={styles.questsHead}>
        <span>Quêtes d'éveil</span>
        <span className={styles.questsCount}>
          <span aria-hidden="true">{`${done}/${total}`}</span>
          <span className={styles.srOnly}>{`${done} sur ${total}`}</span>
        </span>
      </p>
      <div className={styles.questsBar} aria-hidden="true">
        {done > 0 ? (
          <span className={styles.questsFill} style={{ width: `${(done / total) * 100}%` }} />
        ) : null}
      </div>
      <ul className={styles.questList}>
        {p.quests.map((q) => (
          <li key={q.label}>
            {/* biome-ignore lint/a11y/useSemanticElements: case en lecture seule, l'état d'une quête et non un champ à remplir */}
            <span
              role="checkbox"
              aria-checked={q.done}
              aria-readonly="true"
              tabIndex={0}
              className={styles.quest}
            >
              <span className={styles.questBox} aria-hidden="true">
                {q.done ? (
                  <span className={styles.questCheck}>
                    <QuestCheck />
                  </span>
                ) : null}
              </span>
              {q.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
