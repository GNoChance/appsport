import type { ColorScheme } from './art/art-types';
import { useThemeChoice } from './theme/theme';
import { useMediaQuery } from './use-media-query';

/**
 * Clair ou sombre, d'après le thème effectif : Clair et Carnet en clair, Sombre et Salle de nuit en sombre,
 * Auto selon le réglage du téléphone. Choisit la version d'un dessin (avatars des coachs).
 */
export function useColorScheme(): ColorScheme {
  const [choice] = useThemeChoice();
  const phoneDark = useMediaQuery('(prefers-color-scheme: dark)');
  if (choice === 'clair' || choice === 'carnet') return 'light';
  if (choice === 'sombre' || choice === 'nuit') return 'dark';
  return phoneDark ? 'dark' : 'light';
}
