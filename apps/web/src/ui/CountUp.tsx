import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './use-reduced-motion';

/** Courbe de sortie proche de cubic-bezier(.2,.8,.2,1) : vite au départ, posée à l'arrivée. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Compteur qui défile jusqu'à `to` (spec refonte §7), en entiers. Sous mouvement réduit, affiche
 * directement `to` dès le premier rendu. Une nouvelle valeur repart de celle affichée.
 */
export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(() => (reduced ? to : 0));
  const current = useRef(shown);
  current.current = shown;

  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') {
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
  }, [to, duration, reduced]);

  return <>{shown}</>;
}
