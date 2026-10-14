// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_CHOICES, type ThemeChoice } from '../../src/ui/theme/theme';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const TOKENS_CSS = resolve(import.meta.dirname, '../../src/ui/theme/tokens.css');
const VOICE_CSS = resolve(import.meta.dirname, '../../src/ui/voice.module.css');
const SHELL_CSS = resolve(import.meta.dirname, '../../src/ui/shell.module.css');
const DARK = '(prefers-color-scheme: dark)';

/** `#rgb` ou `#rrggbb` → [r, g, b] de 0 à 255. */
function hexToRgb(hex: string): number[] {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
}

/** Luminance relative WCAG 2.x d'une couleur `#rgb` ou `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2.x, de 1 à 21, quel que soit l'ordre des couleurs. */
function contrastRatio(hexA: string, hexB: string): number {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Texte courant : 4,5:1 ; grand texte et éléments d'interface (icônes, pastilles, contour du focus) : 3:1. */
const TEXT = 4.5;
const UI = 3;

/** Paires déclarées : [premier plan, fond, minimum]. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ['--text', '--bg', TEXT],
  ['--text', '--surface', TEXT],
  ['--text', '--surface-strong', TEXT],
  ['--text', '--field-bg', TEXT],
  ['--text', '--warning-bg', TEXT],
  ['--text-muted', '--bg', TEXT],
  ['--text-muted', '--surface', TEXT],
  ['--text-muted', '--surface-strong', TEXT],
  ['--accent-text', '--accent', TEXT],
  // L'accent colore aussi les liens : texte courant, sur la page comme dans une carte.
  ['--accent', '--bg', TEXT],
  ['--accent', '--surface', TEXT],
  ['--accent-2', '--bg', UI],
  ['--accent-2', '--surface', UI],
  ['--danger', '--bg', TEXT],
  ['--danger', '--surface', TEXT],
  ['--success', '--bg', UI],
  ['--success', '--surface', UI],
  ['--warning-text', '--warning-bg', TEXT],
  ['--focus', '--bg', UI],
  ['--focus', '--surface', UI],
];

const CHECKED_TOKENS = [...new Set([...PAIRS.map(([fg]) => fg), ...PAIRS.map(([, bg]) => bg)])];

/**
 * Paires que lisent les écrans pas encore refaits, à travers le pont `--color-*` de tokens.css : le texte
 * courant se pose sur les fonds du pont (bandeaux de mise à jour, pastille « mineur » des membres), le
 * primaire sert de contour du focus, de point « prêt » et de cadre.
 */
const BRIDGE_PAIRS: readonly (readonly [string, string, number])[] = [
  ['--color-text', '--color-bg', TEXT],
  ['--color-text', '--color-surface', TEXT],
  ['--color-text', '--color-info-bg', TEXT],
  ['--color-text', '--color-warning-bg', TEXT],
  ['--color-muted', '--color-bg', TEXT],
  ['--color-muted', '--color-surface', TEXT],
  ['--color-primary-text', '--color-primary', TEXT],
  ['--color-danger', '--color-bg', TEXT],
  ['--color-danger', '--color-surface', TEXT],
  ['--color-primary', '--color-bg', UI],
  ['--color-primary', '--color-surface', UI],
];

/**
 * Libellés actifs de la coquille, texte courant (12 à 16 px), sur leur teinte d'accent : [nom, règle qui
 * colore le texte, règle qui pose le fond]. La teinte est opaque, mélangée à --surface : le calcul la lit.
 */
const SHELL_PAIRS: readonly (readonly [string, string, string])[] = [
  ['onglet actif', '.tab[aria-current="page"]', '.tabPill'],
  ['entrée latérale active', '.sideItem[aria-current="page"]', '.sideItem[aria-current="page"]'],
  ['initiale du profil', '.avatar > span', '.avatar > span'],
];

const rgbToHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/**
 * Couleur calculée d'une variable comme le navigateur la lit : suit les `var(--x)` et calcule
 * `color-mix(in srgb, var(--a) N%, var(--b))` ; null si la valeur n'aboutit pas à un hexadécimal.
 */
function resolveColor(name: string, vars: ReadonlyMap<string, string>, depth = 0): string | null {
  const value = vars.get(name);
  if (value === undefined || depth > 8) return null;
  if (HEX.test(value)) return value;
  const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
  if (ref) return resolveColor(ref[1] as string, vars, depth + 1);
  const mix = /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+(\d+(?:\.\d+)?)%,\s*var\((--[\w-]+)\)\s*\)$/.exec(
    value,
  );
  if (!mix) return null;
  const a = resolveColor(mix[1] as string, vars, depth + 1);
  const b = resolveColor(mix[3] as string, vars, depth + 1);
  if (!a || !b) return null;
  const p = Number(mix[2]) / 100;
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(ra.map((c, i) => c * p + (rb[i] as number) * (1 - p)));
}

type ForcedTheme = Exclude<ThemeChoice, 'auto'>;
type Scheme = 'light' | 'only light' | 'dark';

/** Thèmes forcés, tirés de THEME_CHOICES : un thème ajouté au choix doit avoir son bloc et ses contrastes. */
const FORCED = THEME_CHOICES.filter((c): c is ForcedTheme => c !== 'auto');

/**
 * `color-scheme` attendu : les contrôles natifs (champs, cases, barres de défilement) suivent le fond ; un
 * thème clair forcé dit « only light » pour que le navigateur ne l'assombrisse pas de lui-même.
 */
const SCHEMES: Record<ForcedTheme, Scheme> = {
  clair: 'only light',
  sombre: 'dark',
  carnet: 'only light',
  nuit: 'dark',
};

interface Palette {
  name: string;
  selector: string;
  media: string | null;
  scheme: Scheme;
  /** Couleurs reprises de `:root` (le clair) ; sinon le bloc les déclare toutes, sans rien hériter du clair. */
  fromRoot: boolean;
}

/** Chaque rendu possible : Auto sur un téléphone clair puis sombre, puis chaque thème forcé. */
const PALETTES: readonly Palette[] = [
  { name: 'Auto, téléphone clair', selector: ':root', media: null, scheme: 'light', fromRoot: true },
  {
    name: 'Auto, téléphone sombre',
    selector: ':root:not([data-theme])',
    media: DARK,
    scheme: 'dark',
    fromRoot: false,
  },
  ...FORCED.map((c) => ({
    name: `${c} forcé`,
    selector: `:root[data-theme="${c}"]`,
    media: null,
    scheme: SCHEMES[c],
    fromRoot: c === 'clair',
  })),
];

describe('contrastRatio (WCAG 2.x)', () => {
  it('noir sur blanc vaut 21, une couleur sur elle-même vaut 1, dans les deux sens', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#1C6FB5', '#1C6FB5')).toBe(1);
  });

  it('#777777 sur blanc reste sous 4,5:1 (4,48), #767676 passe (4,54)', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});

describe('contrastes des jetons, pour chaque thème', () => {
  const blocks = parseCssBlocks(readFileSync(TOKENS_CSS, 'utf8'));
  const voice = parseCssBlocks(readFileSync(VOICE_CSS, 'utf8'));
  const shell = parseCssBlocks(readFileSync(SHELL_CSS, 'utf8'));
  const root = declarationsOf(blocks, ':root');
  const own = (p: Palette) => declarationsOf(blocks, p.selector, p.media);
  /** Ce que voit la page dans ce rendu : `:root`, puis le bloc du thème par-dessus (la cascade). */
  const seen = (p: Palette) => {
    const block = own(p);
    return root && block ? new Map([...root, ...block]) : null;
  };

  it('un bloc :root[data-theme] pour chaque thème forcé de THEME_CHOICES, et aucun autre', () => {
    const themed = blocks
      .filter((b) => b.media === null)
      .flatMap((b) => /^:root\[data-theme="([^"]+)"\]$/.exec(b.selector)?.[1] ?? []);
    expect([...new Set(themed)].sort()).toEqual([...FORCED].sort());
  });

  for (const p of PALETTES) {
    describe(`rendu ${p.name}`, () => {
      it('son bloc existe et chaque jeton vérifié y vaut un hexadécimal', () => {
        expect(own(p), `bloc ${p.selector} absent de tokens.css`).not.toBeNull();
        const tokens = p.fromRoot ? seen(p) : own(p);
        for (const token of CHECKED_TOKENS) {
          expect(tokens?.get(token), `${token} (${p.name})`).toMatch(HEX);
        }
      });

      it(`color-scheme: ${p.scheme}`, () => {
        expect(seen(p)?.get('color-scheme')).toBe(p.scheme);
      });

      it('chaque paire déclarée atteint son minimum', () => {
        const tokens = seen(p);
        expect(tokens, `bloc ${p.selector} absent de tokens.css`).not.toBeNull();
        for (const [fg, bg, min] of PAIRS) {
          const a = tokens?.get(fg);
          const b = tokens?.get(bg);
          expect(a, `${fg} (${p.name})`).toMatch(HEX);
          expect(b, `${bg} (${p.name})`).toMatch(HEX);
          const ratio = contrastRatio(a as string, b as string);
          expect(
            ratio,
            `${fg} ${a} sur ${bg} ${b} (${p.name}) : ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(min);
        }
      });

      // L'étiquette « [ SYSTÈME ] » (12 px, demi-gras) est du texte courant : 4,5:1 dans chaque ton, sur le
      // fond de la fenêtre (--surface en clair, dégradé de --surface-strong à --surface en sombre).
      it('fenêtre du Système : l’étiquette atteint 4,5:1 dans chaque ton', () => {
        const tokens = seen(p);
        expect(tokens, `bloc ${p.selector} absent de tokens.css`).not.toBeNull();
        const label = declarationsOf(voice, '.systemLabel')?.get('color');
        expect(label, '.systemLabel color').toBeTruthy();
        for (const tone of ['.panel', '.success']) {
          const vars = new Map([
            ...(tokens ?? []),
            ...(declarationsOf(voice, '.panel') ?? []),
            ...(declarationsOf(voice, tone) ?? []),
            ['--label', label as string],
          ]);
          const fg = resolveColor('--label', vars);
          expect(fg, `${label} (${tone}, ${p.name})`).toMatch(HEX);
          for (const bg of ['--surface', '--surface-strong']) {
            const b = vars.get(bg) as string;
            const ratio = contrastRatio(fg as string, b);
            expect(
              ratio,
              `étiquette ${fg} (${tone}) sur ${bg} ${b} (${p.name}) : ${ratio.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(TEXT);
          }
        }
      });

      it('coquille : onglet actif, entrée latérale active et initiale atteignent 4,5:1 sur leur teinte', () => {
        const tokens = seen(p);
        expect(tokens, `bloc ${p.selector} absent de tokens.css`).not.toBeNull();
        for (const [name, text, tint] of SHELL_PAIRS) {
          const color = declarationsOf(shell, text)?.get('color');
          const background = declarationsOf(shell, tint)?.get('background');
          const vars = new Map([
            ...(tokens ?? []),
            ['--pair-text', color ?? ''],
            ['--pair-tint', background ?? ''],
          ]);
          const fg = resolveColor('--pair-text', vars);
          const bg = resolveColor('--pair-tint', vars);
          // Une teinte qui laisse voir dessous (transparent) ne se calcule pas : elle échoue ici, lisiblement.
          expect(fg ?? '', `${name} : couleur ${color} (${p.name})`).toMatch(HEX);
          expect(bg ?? '', `${name} : fond ${background} (${p.name})`).toMatch(HEX);
          const ratio = contrastRatio(fg as string, bg as string);
          expect(ratio, `${name} ${fg} sur ${bg} (${p.name}) : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
            TEXT,
          );
        }
      });

      // Le pont est déclaré sur :root ; le bloc du thème, plus spécifique, l'emporte pour les jetons.
      it('à travers le pont --color-* : chaque paire lue par les écrans atteint son minimum', () => {
        const vars = seen(p);
        expect(vars, `bloc ${p.selector} absent de tokens.css`).not.toBeNull();
        for (const [fg, bg, min] of BRIDGE_PAIRS) {
          const a = resolveColor(fg, vars ?? new Map());
          const b = resolveColor(bg, vars ?? new Map());
          expect(a, `${fg} → ${vars?.get(fg)} (${p.name})`).toMatch(HEX);
          expect(b, `${bg} → ${vars?.get(bg)} (${p.name})`).toMatch(HEX);
          const ratio = contrastRatio(a as string, b as string);
          expect(
            ratio,
            `${fg} ${a} sur ${bg} ${b} (${p.name}) : ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(min);
        }
      });
    });
  }
});
