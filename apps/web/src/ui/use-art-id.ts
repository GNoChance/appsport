import { useId } from 'react';

/**
 * Préfixe d'identifiants propre à une instance de dessin : l'id de React sans ses caractères spéciaux
 * (deux-points, guillemets), qui casseraient les références `url(#…)`. Deux dessins d'une page n'ont jamais
 * le même préfixe.
 */
export function useArtId(name: string): string {
  return `${name}-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
}
