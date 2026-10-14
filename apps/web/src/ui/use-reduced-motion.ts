import { useMediaQuery } from './use-media-query';

/**
 * Mouvement réduit demandé par le téléphone (spec refonte §7) : les composants animés en JavaScript
 * (compteurs) montrent alors directement leur état final ; les animations CSS, elles, suivent la media query.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
