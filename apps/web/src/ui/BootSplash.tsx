import { useEffect, useState } from 'react';
import { RuneMark } from './Logo';
import styles from './shell.module.css';
import { useReducedMotion } from './use-reduced-motion';

const SHOWN_KEY = 'rune.boot-splash';
/** Filet de sécurité : retiré même si la fin de son animation n'arrive jamais (onglet en arrière-plan). */
const MAX_MS = 2000;

/** Repli quand le stockage de session est refusé (navigation privée, données bloquées) : une fois par chargement. */
let shownThisPage = false;

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === '1';
  } catch {
    return shownThisPage;
  }
}

function markShown(): void {
  shownThisPage = true;
  try {
    sessionStorage.setItem(SHOWN_KEY, '1');
  } catch {
    // Stockage refusé : le repli du chargement suffit.
  }
}

/**
 * Démarrage (spec refonte §7) : au premier affichage d'une session, le logo se dessine (moins de 1,2 s) puis
 * le voile s'efface. Il se pose par-dessus l'écran sans jamais le retarder ni prendre le toucher
 * (`pointer-events: none`), reste muet pour les lecteurs d'écran, et se retire à la fin de son animation.
 * Sous mouvement réduit, il ne rend rien.
 */
export function BootSplash() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(() => !alreadyShown());
  const playing = show && !reduced;

  useEffect(() => {
    if (!playing) return;
    markShown();
    const timer = setTimeout(() => setShow(false), MAX_MS);
    return () => clearTimeout(timer);
  }, [playing]);

  if (!playing) return null;
  return (
    <div
      aria-hidden="true"
      className={styles.splash}
      onAnimationEnd={(e) => {
        // Les animations du dessin remontent jusqu'ici : seule celle du voile le retire.
        if (e.target === e.currentTarget) setShow(false);
      }}
    >
      <span className={styles.splashMark}>
        <RuneMark size={132} />
      </span>
    </div>
  );
}
