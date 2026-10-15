import { useEffect, useRef } from 'react';

/**
 * Quand une feuille du bas se referme (`open` repasse à faux), rend le focus à `target()` (la ligne ou le
 * bouton qui l'a ouverte) si personne ne l'a repris : Safari ne donne pas le focus au bouton touché, la feuille
 * n'a alors aucun déclencheur à qui le rendre. L'effet passe après le démontage de la feuille, une fois le
 * reste de la page de nouveau atteignable.
 */
export function useFocusAfterClose(open: boolean, target: () => HTMLElement | null | undefined): void {
  const wasOpen = useRef(open);
  const latest = useRef(target);
  latest.current = target;
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    const active = document.activeElement;
    if (active === null || active === document.body) latest.current()?.focus();
  }, [open]);
}
