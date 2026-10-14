import { useCallback, useSyncExternalStore } from 'react';

/** Réponse d'une media query ; faux sans `matchMedia` (vieux navigateur, rendu hors navigateur). */
function matches(query: string): boolean {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(query).matches;
}

/**
 * Suit une media query : juste dès le premier rendu (aucun passage par une valeur fausse), puis à chaque
 * changement du réglage. Un navigateur sans écoute de media query garde la réponse du premier rendu.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof globalThis.matchMedia !== 'function') return () => {};
      const list = globalThis.matchMedia(query);
      if (typeof list.addEventListener !== 'function') return () => {};
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const read = () => matches(query);
  return useSyncExternalStore(subscribe, read, read);
}
