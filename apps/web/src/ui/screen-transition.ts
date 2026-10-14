import { type RefObject, useLayoutEffect, useState } from 'react';
import { activeTab } from './TabBar';
import { useReducedMotion } from './use-reduced-motion';

/** Entrée d'un écran (spec refonte §7) : vers l'avant depuis la droite, retour depuis la gauche, onglet en fondu. */
export type ScreenTransition = 'forward' | 'back' | 'tab' | 'none';

const clean = (path: string) => path.toLowerCase().replace(/\/+$/, '') || '/';

/**
 * Transition de `from` vers `to`, d'après la pile des écrans visités dans l'onglet (`stack`, `from` en dernier) :
 * autre onglet → fondu ; écran parent, ou écran juste avant dans la pile (retour du navigateur) → retour ;
 * sinon → avant.
 */
export function screenTransition(from: string, to: string, stack: readonly string[]): ScreenTransition {
  const a = clean(from);
  const b = clean(to);
  if (a === b) return 'none';
  if (activeTab(a) !== activeTab(b)) return 'tab';
  if (a.startsWith(`${b}/`)) return 'back';
  const before = stack.at(-2);
  if (before !== undefined && clean(before) === b) return 'back';
  return 'forward';
}

/** Pile après la transition : un onglet repart de son écran, un retour dépile, un écran nouveau s'empile. */
function nextStack(stack: readonly string[], to: string, transition: ScreenTransition): string[] {
  if (transition === 'tab') return [to];
  if (transition === 'back') {
    const before = stack.at(-2);
    return before !== undefined && clean(before) === clean(to)
      ? stack.slice(0, -1)
      : [...stack.slice(0, -1), to];
  }
  return transition === 'none' ? [...stack] : [...stack, to];
}

interface NavState {
  path: string;
  stack: string[];
  transition: ScreenTransition;
}

/** Transition de l'écran affiché, recalculée à chaque changement d'adresse du routeur (wouter). */
export function useScreenTransition(path: string): ScreenTransition {
  const [nav, setNav] = useState<NavState>({ path, stack: [path], transition: 'none' });
  if (nav.path === path) return nav.transition;
  const transition = screenTransition(nav.path, path, nav.stack);
  // État dérivé de l'adresse : posé pendant le rendu, React rend aussitôt de nouveau avec lui.
  setNav({ path, stack: nextStack(nav.stack, path, transition), transition });
  return transition;
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const SLIDE = '48px';

/**
 * Joue l'entrée de l'écran `ref` à chaque changement de `path` (Web Animations : aucun style en ligne, rien
 * de figé à la fin). Sous mouvement réduit, un simple fondu ; sans `animate` (navigateur ancien), rien.
 */
export function useScreenEntrance(
  ref: RefObject<HTMLElement | null>,
  path: string,
  transition: ScreenTransition,
) {
  const reduced = useReducedMotion();
  // biome-ignore lint/correctness/useExhaustiveDependencies: l'entrée se rejoue à chaque nouvelle adresse.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || transition === 'none' || typeof el.animate !== 'function') return;
    const fade = { opacity: [0, 1] };
    const keyframes =
      reduced || transition === 'tab'
        ? fade
        : {
            ...fade,
            transform: [`translateX(${transition === 'forward' ? SLIDE : `-${SLIDE}`})`, 'none'],
          };
    const duration = reduced ? 200 : transition === 'tab' ? 300 : 380;
    const animation = el.animate(keyframes, { duration, easing: EASE });
    // Annulée par l'écran suivant : sa promesse `finished` rejetée n'est pas une erreur.
    animation.finished?.catch(() => {});
    return () => animation.cancel();
  }, [path]);
}
