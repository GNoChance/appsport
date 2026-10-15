import type { ThemeChoice } from '../../ui/theme/theme';

/** Couleurs d'un aperçu de thème : fond, carte, texte, accent et accent 2. */
export interface ThemePreview {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
}

/**
 * Aperçu de chaque thème forcé dans Réglages › Apparence (maquette C03) : il montre son thème quel que soit
 * celui de la page, donc ses couleurs ne peuvent pas suivre les variables du thème appliqué. Ce sont celles de
 * tokens.css, la seule source des jetons ; un test vérifie qu'elles y correspondent, thème par thème.
 */
export const THEME_PREVIEWS: Readonly<Record<Exclude<ThemeChoice, 'auto'>, ThemePreview>> = {
  clair: { bg: '#f1f3f7', surface: '#ffffff', text: '#10151f', accent: '#1c6fb5', accent2: '#6a48e8' },
  sombre: { bg: '#070a12', surface: '#0e1424', text: '#eef6fb', accent: '#5ed8ff', accent2: '#8c6bff' },
  carnet: { bg: '#f2ecdf', surface: '#fbf8f1', text: '#211b16', accent: '#1f5f8b', accent2: '#c45c48' },
  nuit: { bg: '#05070d', surface: '#0b1222', text: '#f2fdff', accent: '#5ed8ff', accent2: '#8c6bff' },
};
