import { type CSSProperties, useId } from 'react';
import { CheckGlyph } from '../../ui';
import { type ThemeChoice, useThemeChoice } from '../../ui/theme/theme';
import styles from './status.module.css';
import { THEME_PREVIEWS, type ThemePreview } from './theme-previews';

/** Nom affiché de chaque apparence (spec refonte §4). */
export const THEME_LABELS: Readonly<Record<ThemeChoice, string>> = {
  auto: 'Auto',
  clair: 'Clair',
  sombre: 'Sombre',
  carnet: 'Carnet',
  nuit: 'Salle de nuit',
};

const AUTO_HINT = 'Clair ou sombre selon le téléphone';
const FORCED = ['clair', 'sombre', 'carnet', 'nuit'] as const;

/**
 * Réglages › Apparence (spec refonte §4, maquette C03) : cinq boutons radio, Auto (par défaut) en grand puis
 * les quatre thèmes forcés en grille, chacun avec son aperçu. Choisir garde le choix sur l'appareil et
 * l'applique aussitôt (`useThemeChoice` : writeThemeChoice puis applyTheme) ; le choix coché suit le thème
 * appliqué à la page.
 */
export function AppearanceSection() {
  const [choice, choose] = useThemeChoice();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.sectionTitle}>
        Apparence
      </h2>
      <div role="radiogroup" aria-labelledby={headingId} className={styles.themes}>
        <ThemeOption theme="auto" checked={choice === 'auto'} onChoose={choose} hint={AUTO_HINT} />
        <div className={styles.themeGrid}>
          {FORCED.map((theme) => (
            <ThemeOption key={theme} theme={theme} checked={choice === theme} onChoose={choose} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Un choix : un `<label>` qui contient le vrai bouton radio, transparent et posé sur toute la carte, nommé par
 * le nom du thème et décrit par son aide. Coché : bord d'accent, teinte et coche.
 */
function ThemeOption(p: {
  theme: ThemeChoice;
  checked: boolean;
  onChoose(t: ThemeChoice): void;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className={styles.theme} data-wide={p.theme === 'auto' ? '' : undefined}>
      <input
        type="radio"
        name="theme"
        value={p.theme}
        checked={p.checked}
        onChange={() => p.onChoose(p.theme)}
        aria-labelledby={`${id}-name`}
        aria-describedby={p.hint ? `${id}-hint` : undefined}
        className={styles.themeInput}
      />
      <Preview theme={p.theme} />
      <span className={styles.themeText}>
        <span id={`${id}-name`} className={styles.themeName}>
          {THEME_LABELS[p.theme]}
        </span>
        {p.hint ? (
          <span id={`${id}-hint`} className={styles.themeHint}>
            {p.hint}
          </span>
        ) : null}
      </span>
      <span className={styles.themeMark} aria-hidden="true">
        {p.checked ? <CheckGlyph /> : null}
      </span>
    </label>
  );
}

/** Couleurs d'un aperçu, en variables lues par la feuille (noms écrits en entier : la feuille les cherche ici). */
const previewVars = (c: ThemePreview) => ({
  '--pv-bg': c.bg,
  '--pv-surface': c.surface,
  '--pv-text': c.text,
  '--pv-accent': c.accent,
  '--pv-accent-2': c.accent2,
});

/** Auto : la moitié claire et la moitié sombre. */
const AUTO_VARS = {
  '--light-bg': THEME_PREVIEWS.clair.bg,
  '--light-text': THEME_PREVIEWS.clair.text,
  '--light-accent': THEME_PREVIEWS.clair.accent,
  '--dark-bg': THEME_PREVIEWS.sombre.bg,
  '--dark-text': THEME_PREVIEWS.sombre.text,
  '--dark-accent': THEME_PREVIEWS.sombre.accent,
};

/**
 * Aperçu décoratif : un écran miniature aux couleurs du thème (fond, carte, titre en dégradé, ligne de texte,
 * bouton). Auto : moitié claire, moitié sombre. Les couleurs passent par des variables posées par React
 * (CSSOM, permis par la CSP) ; la feuille fait le dessin.
 */
function Preview(p: { theme: ThemeChoice }) {
  if (p.theme === 'auto') {
    return (
      <span
        className={styles.previewAuto}
        data-theme-preview="auto"
        aria-hidden="true"
        style={AUTO_VARS as CSSProperties}
      >
        <span data-part="light-title" />
        <span data-part="light-line" />
        <span data-part="dark-title" />
        <span data-part="dark-line" />
      </span>
    );
  }
  return (
    <span
      className={styles.preview}
      data-theme-preview={p.theme}
      aria-hidden="true"
      style={previewVars(THEME_PREVIEWS[p.theme]) as CSSProperties}
    >
      <span data-part="card" />
      <span data-part="title" />
      <span data-part="line" />
      <span data-part="button" />
    </span>
  );
}
