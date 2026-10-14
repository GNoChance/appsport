import { useId } from 'react';

/**
 * Préfixe d'identifiants d'un dessin : son nom puis l'id de React sans ses caractères spéciaux (deux-points
 * de `:r0:`, guillemets de `«r1»`), qui casseraient les références `url(#…)`. Ne garde que [A-Za-z0-9_-].
 */
export function artIdPrefix(name: string, reactId: string): string {
  return `${name}-${reactId.replace(/[^A-Za-z0-9_-]/g, '')}`;
}

/** Préfixe propre à une instance de dessin : deux dessins d'une page n'ont jamais le même. */
export function useArtId(name: string): string {
  return artIdPrefix(name, useId());
}
