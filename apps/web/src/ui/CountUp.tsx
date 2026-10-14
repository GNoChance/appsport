import { useEffect, useRef, useState } from 'react';
import styles from './ui.module.css';
import { useReducedMotion } from './use-reduced-motion';

/** Courbe de sortie proche de cubic-bezier(.2,.8,.2,1) : vite au départ, posée à l'arrivée. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Compteur qui défile jusqu'à `to` (spec refonte §7), en entiers. Sous mouvement réduit, ou avec une durée
 * nulle, négative ou non finie, affiche directement `to` dès le premier rendu. Une nouvelle valeur repart de
 * celle affichée. Les chiffres de passage sont cachés aux lecteurs d'écran, qui lisent toujours `to` : aucune
 * information ne passe uniquement par l'animation, et une région live n'annonce pas chaque image.
 */
export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const reduced = useReducedMotion();
  const instant = reduced || !Number.isFinite(duration) || duration <= 0;
  const [shown, setShown] = useState(() => (instant ? to : 0));
  const current = useRef(shown);
  current.current = shown;

  useEffect(() => {
    if (instant || typeof requestAnimationFrame !== 'function') {
      setShown(to);
      return;
    }
    const from = current.current;
    if (from === to) return;
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      setShown(t === 1 ? to : Math.round(from + (to - from) * easeOut(t)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, duration, instant]);

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className={styles.visuallyHidden}>{to}</span>
    </>
  );
}
