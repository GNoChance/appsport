import type { CoachId } from '@rune/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CoachAvatar, CoachBubble, useReducedMotion } from '../../ui';
import type { CoachMode } from '../../ui/art/art-types';
import { StepActions } from '../onboarding/StepActions';
import { StepTitle } from '../onboarding/StepTitle';
import styles from './coach.module.css';
import { COACHES, coachText } from './coach-lines';

/** Rythme du dévoilement de la présentation, d'après le prototype : l'avatar grandit d'abord. */
const REVEAL_START_MS = 650;
const CHAR_MS = 19;
/** Pauses après une fin de phrase (. ! ?) et après une virgule ou un deux-points. */
const SENTENCE_PAUSE_MS = 210;
const CLAUSE_PAUSE_MS = 130;
/** Démonstration du mode nutrition : jouée une fois, peu après le texte entier, puis retour. */
const DEMO_DELAY_MS = 750;
const DEMO_HOLD_MS = 3300;

const pauseAfter = (ch: string | undefined) =>
  ch !== undefined && '.!?'.includes(ch)
    ? SENTENCE_PAUSE_MS
    : ch === ':' || ch === ','
      ? CLAUSE_PAUSE_MS
      : CHAR_MS;

/** Durée du dévoilement de `text` par TypedText, du premier rendu au dernier caractère. */
function revealMs(text: string): number {
  let ms = REVEAL_START_MS;
  for (let i = 0; i < text.length - 1; i++) ms += pauseAfter(text[i]);
  return ms;
}

const MODES: readonly { mode: CoachMode; label: string }[] = [
  { mode: 'training', label: 'Entraînement' },
  { mode: 'nutrition', label: 'Nutrition' },
];

/**
 * Présentation du coach choisi (spec refonte §8, prototype « intro ») : l'avatar grandit, la bulle « Message
 * d'accueil » dévoile sa présentation, puis une courte démonstration du mode nutrition (ligne `nutri`,
 * étiquette « Aperçu ») revient d'elle-même à l'entraînement ; l'interrupteur « Entraînement / Nutrition » la
 * rejoue à la demande, sans retour automatique. Chaque changement de mode est annoncé poliment.
 *
 * Le dévoilement n'est qu'une copie animée, cachée aux lecteurs d'écran : le texte entier est dans l'arbre
 * d'accessibilité dès le premier rendu, il n'y a jamais d'indicateur « en train d'écrire », et sous mouvement
 * réduit le texte entier s'affiche d'emblée. « C'est parti » est là dès le départ : rien n'attend l'animation.
 */
export function CoachIntro(p: { coach: CoachId; pseudo: string; onBack(): void; onStart(): void }) {
  const reduced = useReducedMotion();
  const intro = coachText(p.coach, 'intro', p.pseudo);
  const nutri = coachText(p.coach, 'nutri', p.pseudo);
  const [typed, setTyped] = useState(false);
  const [mode, setMode] = useState<CoachMode>('training');
  const [announcement, setAnnouncement] = useState('');
  // Un geste sur l'interrupteur coupe la démonstration automatique.
  const touched = useRef(false);
  const demoPlayed = useRef(false);
  const revealed = reduced || typed;
  const markTyped = useCallback(() => setTyped(true), []);

  function switchMode(next: CoachMode) {
    setMode(next);
    setAnnouncement(next === 'nutrition' ? `Mode nutrition. ${nutri}` : 'Mode entraînement.');
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: démonstration programmée une fois, à la fin du texte
  useEffect(() => {
    if (!revealed) return;
    // Mouvement réduit : le texte entier est là d'emblée ; la démonstration attend autant que le dévoilement
    // l'aurait fait, pour que la présentation puisse être lue avant de céder la place à la ligne nutri.
    const delay = typed ? DEMO_DELAY_MS : revealMs(intro) + DEMO_DELAY_MS;
    let back: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(() => {
      if (touched.current || demoPlayed.current) return;
      demoPlayed.current = true;
      switchMode('nutrition');
      back = setTimeout(() => {
        if (!touched.current) switchMode('training');
      }, DEMO_HOLD_MS);
    }, delay);
    return () => {
      clearTimeout(start);
      clearTimeout(back);
    };
  }, [revealed]);

  function choose(next: CoachMode) {
    touched.current = true;
    setTyped(true);
    if (next !== mode) switchMode(next);
  }

  return (
    <div className={styles.intro}>
      <div className={styles.stage} data-mode={mode} aria-hidden="true">
        <span className={styles.halo} data-tone="training" />
        <span className={styles.halo} data-tone="nutrition" />
        <span className={styles.grow}>
          {MODES.map((m) => (
            <span key={m.mode} className={styles.layer} data-layer={m.mode}>
              <CoachAvatar coach={p.coach} mode={m.mode} size={184} animated={m.mode === mode} decorative />
            </span>
          ))}
        </span>
      </div>
      <div className={`${styles.identity} ${styles.introFade}`}>
        <StepTitle>{COACHES[p.coach].name}</StepTitle>
        <fieldset className={styles.modeSwitch} aria-label="Mode du coach" data-mode={mode}>
          <span className={styles.modePill} aria-hidden="true" />
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              className={styles.modeButton}
              aria-pressed={mode === m.mode}
              onClick={() => choose(m.mode)}
            >
              <span className={styles.modeDot} aria-hidden="true" />
              {m.label}
            </button>
          ))}
        </fieldset>
      </div>
      <div className={styles.introFade}>
        <CoachBubble
          coach={p.coach}
          mode={mode}
          label={mode === 'nutrition' ? 'Aperçu' : "Message d'accueil"}
        >
          {/* Les deux textes superposés : la bulle garde sa hauteur d'un mode à l'autre ; l'autre est caché. */}
          <div className={styles.modeTexts} data-mode={mode}>
            <div data-text="training" aria-hidden={mode === 'training' ? undefined : true}>
              <TypedText text={intro} done={revealed} onDone={markTyped} />
            </div>
            <p data-text="nutrition" aria-hidden={mode === 'nutrition' ? undefined : true}>
              {nutri}
            </p>
          </div>
        </CoachBubble>
      </div>
      <p className={`${styles.hint} ${styles.introFade}`}>
        Touche « Nutrition » pour voir ton coach à table.
      </p>
      <p className={styles.srOnly} role="status">
        {announcement}
      </p>
      <StepActions onBack={p.onBack} primary={{ label: "C'est parti", onClick: p.onStart }} />
    </div>
  );
}

/**
 * Texte qui se dévoile caractère par caractère tant que `done` est faux, puis appelle `onDone`. Le texte entier
 * garde sa place (il fixe la hauteur de la bulle et c'est lui que lisent les lecteurs d'écran) ; la copie
 * animée, posée dessus, leur est cachée. Seul ce composant suit les caractères : l'écran ne se redessine pas
 * à chaque lettre.
 */
function TypedText(p: { text: string; done: boolean; onDone(): void }) {
  const [shown, setShown] = useState(0);
  const { text, done, onDone } = p;

  useEffect(() => {
    if (done) return;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      count += 1;
      setShown((s) => Math.max(s, count));
      if (count < text.length) timer = setTimeout(step, pauseAfter(text[count - 1]));
      else onDone();
    };
    timer = setTimeout(step, REVEAL_START_MS);
    return () => clearTimeout(timer);
  }, [text, done, onDone]);

  return (
    <p className={styles.reveal} data-revealing={done ? undefined : ''}>
      <span className={styles.fullText}>{text}</span>
      {done ? null : (
        <span className={styles.typed} aria-hidden="true" data-reveal="">
          {text.slice(0, shown)}
        </span>
      )}
    </p>
  );
}
