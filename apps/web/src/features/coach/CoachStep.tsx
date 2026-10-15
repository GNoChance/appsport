import { COACH_IDS, type CoachId } from '@rune/contracts';
import { useContext, useId, useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { CheckGlyph, CoachAvatar, useAction } from '../../ui';
import { StepActions } from '../onboarding/StepActions';
import { StepTitle, StepTitleContext } from '../onboarding/StepTitle';
import { CoachIntro } from './CoachIntro';
import styles from './coach.module.css';
import { COACHES, coachText } from './coach-lines';

/**
 * Étape 1 sur 9 de l'onboarding, « Choisis ton coach » (spec refonte §8) : trois cartes, puis « Continuer »
 * enregistre le coach sur le serveur (`setCoach`, classe E) et ouvre sa présentation ; « C'est parti » passe
 * à la suite (`onNext`). Un échec (hors ligne, erreur du serveur) laisse sur le choix avec le message : on
 * n'avance jamais sans coach enregistré. Pendant l'envoi, les cartes sont figées, et la présentation montre le
 * coach envoyé. Le coach déjà enregistré est coché au retour et n'est pas renvoyé tant qu'aucune carte n'est
 * touchée. `onChange` : un coach a été touché (la reprise calculée ne doit plus déplacer l'écran).
 */
export function CoachStep(p: { onNext(): void; onChange(): void }) {
  const repos = useRepos();
  const me = useMe();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [choice, setChoice] = useState<CoachId | null>(null);
  // Coach enregistré par « Continuer » et présenté ; null sur le choix.
  const [presented, setPresented] = useState<CoachId | null>(null);
  const titles = useContext(StepTitleContext);
  const saved = profile?.coach ?? null;

  /** Choix ↔ présentation : le titre de l'écran affiché prend le focus. */
  function present(coach: CoachId | null) {
    if (titles) titles.focusNext.current = true;
    setPresented(coach);
  }

  // `send` : une carte a été touchée sur cet écran. Le PATCH est idempotent : il part même quand le miroir dit
  // déjà ce coach, car un pull manqué après un envoi précédent peut laisser le miroir en retard sur le serveur.
  const save = useAction(async (coach: CoachId, send: boolean) => {
    if (send) await repos.profile.setCoach(coach);
    present(coach);
  });

  if (!me || profile === undefined) return null;
  const value = choice ?? saved;

  if (presented) {
    return (
      <CoachIntro coach={presented} pseudo={me.username} onBack={() => present(null)} onStart={p.onNext} />
    );
  }

  return (
    <>
      <StepTitle>Choisis ton coach</StepTitle>
      <CoachChoices
        name="coach"
        legend="Il t'accompagnera à l'entraînement comme en nutrition. Choisis la voix qui te correspond."
        pseudo={me.username}
        value={value}
        disabled={save.pending}
        onChange={(coach) => {
          setChoice(coach);
          save.reset();
          p.onChange();
        }}
      />
      <p className={styles.note}>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        Tu pourras changer de coach plus tard dans ton profil.
      </p>
      <StepActions
        pending={save.pending}
        error={save.error}
        primary={{
          label: 'Continuer',
          disabled: value === null,
          onClick: () => {
            if (value !== null) void save.run(value, choice !== null);
          },
        }}
      />
    </>
  );
}

/**
 * Les trois coachs en cartes de choix unique (prototype « coach ») : avatar, nom, tempérament et aperçu de sa
 * voix entre guillemets. Chaque carte est un `<label>` qui contient le vrai bouton radio, transparent et posé
 * sur toute la carte ; le radio est nommé par le nom du coach et décrit par le tempérament et l'aperçu.
 * `disabled` fige les cartes, pendant un envoi par exemple.
 *
 * La cascade d'entrée anime une enveloppe autour de chaque carte (prototype : `.rise` autour de
 * `.coach-card`) : le ressort de la carte choisie remplace l'animation de la carte, et changer de coach
 * rejouerait sinon l'entrée de la carte quittée.
 */
export function CoachChoices(p: {
  name: string;
  legend: string;
  pseudo: string;
  value: CoachId | null;
  disabled?: boolean;
  onChange(coach: CoachId): void;
}) {
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.lead}>{p.legend}</legend>
      <div className={`${styles.cards} stagger`}>
        {COACH_IDS.map((coach) => (
          <div key={coach}>
            <CoachCard
              name={p.name}
              coach={coach}
              pseudo={p.pseudo}
              checked={p.value === coach}
              disabled={p.disabled === true}
              onChange={() => p.onChange(coach)}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function CoachCard(p: {
  name: string;
  coach: CoachId;
  pseudo: string;
  checked: boolean;
  disabled: boolean;
  onChange(): void;
}) {
  const id = useId();
  const texts = COACHES[p.coach];
  return (
    <label className={styles.card}>
      <input
        type="radio"
        name={p.name}
        value={p.coach}
        checked={p.checked}
        disabled={p.disabled}
        onChange={() => p.onChange()}
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-temper ${id}-sample`}
        className={styles.cardInput}
      />
      <span className={styles.cardAvatar}>
        <CoachAvatar coach={p.coach} size={84} animated="brief" decorative />
      </span>
      <span className={styles.cardText}>
        <span id={`${id}-name`} className={styles.cardName}>
          {texts.name}
        </span>
        <span id={`${id}-temper`} className={styles.cardTemper}>
          {texts.temper}
        </span>
        <span id={`${id}-sample`} className={styles.cardQuote}>
          {`« ${coachText(p.coach, 'sample', p.pseudo)} »`}
        </span>
      </span>
      <span className={styles.cardMark} aria-hidden="true">
        {p.checked ? <CheckGlyph /> : null}
      </span>
    </label>
  );
}
