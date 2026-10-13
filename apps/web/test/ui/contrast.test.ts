// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const TOKENS_CSS = resolve(import.meta.dirname, '../../src/ui/theme/tokens.css');

/** Luminance relative WCAG 2.x d'une couleur `#rgb` ou `#rrggbb`. */
function luminance(hex: string): number {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const s = Number.parseInt(full.slice(i, i + 2), 16) / 255;
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

/** Les 5 jeux de couleurs : clair (`:root`), Auto en sombre, puis chaque thème forcé. */
const PALETTES: readonly { name: string; selector: string; media: string | null }[] = [
  { name: 'clair', selector: ':root', media: null },
  { name: 'auto en sombre', selector: ':root:not([data-theme])', media: '(prefers-color-scheme: dark)' },
  { name: 'sombre', selector: ':root[data-theme="sombre"]', media: null },
  { name: 'carnet', selector: ':root[data-theme="carnet"]', media: null },
  { name: 'nuit', selector: ':root[data-theme="nuit"]', media: null },
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

  it('les 5 jeux de couleurs sont présents et chacun déclare tous les jetons vérifiés en hexadécimal', () => {
    expect(PALETTES).toHaveLength(5);
    for (const { name, selector, media } of PALETTES) {
      const tokens = declarationsOf(blocks, selector, media);
      expect(tokens, `bloc ${name} absent de tokens.css`).not.toBeNull();
      for (const token of CHECKED_TOKENS) {
        expect(tokens?.get(token), `${token} dans le thème ${name}`).toMatch(HEX);
      }
    }
  });

  for (const { name, selector, media } of PALETTES) {
    it(`thème ${name} : chaque paire déclarée atteint son minimum`, () => {
      const tokens = declarationsOf(blocks, selector, media);
      expect(tokens, `bloc ${name} absent de tokens.css`).not.toBeNull();
      for (const [fg, bg, min] of PAIRS) {
        const a = tokens?.get(fg);
        const b = tokens?.get(bg);
        expect(a, `${fg} (${name})`).toMatch(HEX);
        expect(b, `${bg} (${name})`).toMatch(HEX);
        const ratio = contrastRatio(a as string, b as string);
        expect(ratio, `${fg} ${a} sur ${bg} ${b} (${name}) : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          min,
        );
      }
    });
  }
});
