// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const FILE = resolve(import.meta.dirname, '../../src/features/auth/auth.module.css');
const TOKENS_CSS = resolve(import.meta.dirname, '../../src/ui/theme/tokens.css');

/** Déclarations des règles dont la liste de sélecteurs contient `selector`, hors media query, fusionnées. */
const rule = (selector: string) =>
  new Map(
    parseCssBlocks(readFileSync(FILE, 'utf8'))
      .filter((b) => b.media === null && b.selector.split(', ').includes(selector))
      .flatMap((b) => [...b.declarations]),
  );

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Texte courant (13 px gras n'est pas du grand texte) : 4,5:1 ; pictogramme : 3:1. */
const TEXT = 4.5;
const UI = 3;

const hexToRgb = (hex: string) => {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
};
const rgbToHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** Rapport de contraste WCAG 2.x, quel que soit l'ordre des couleurs. */
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur calculée comme le navigateur : suit `var(--x)` et calcule `color-mix(in srgb, var(--a) N%, var(--b))`. */
function resolveColor(value: string, vars: ReadonlyMap<string, string>, depth = 0): string | null {
  if (depth > 8) return null;
  if (HEX.test(value)) return value;
  const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
  if (ref) {
    const next = vars.get(ref[1] as string);
    return next === undefined ? null : resolveColor(next, vars, depth + 1);
  }
  const mix = /^color-mix\(in srgb,\s*(var\(--[\w-]+\))\s+(\d+(?:\.\d+)?)%,\s*(var\(--[\w-]+\))\s*\)$/.exec(
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

/** Chaque rendu : Auto sur un téléphone clair puis sombre, puis les thèmes forcés (le bloc du thème sur `:root`). */
const RENDERS: readonly (readonly [string, string, string | null])[] = [
  ['Auto, téléphone clair', ':root', null],
  ['Auto, téléphone sombre', ':root:not([data-theme])', '(prefers-color-scheme: dark)'],
  ['clair forcé', ':root[data-theme="clair"]', null],
  ['sombre forcé', ':root[data-theme="sombre"]', null],
  ['carnet forcé', ':root[data-theme="carnet"]', null],
  ['nuit forcé', ':root[data-theme="nuit"]', null],
];

describe('auth.module.css : pastilles des étapes d’installation (maquette A05, spec refonte §4)', () => {
  it('numéro et pictogramme dans la même pastille : même teinte d’accent, même encre', () => {
    expect(rule('.stepIcon').get('background')).toBe(rule('.stepNumber').get('background'));
    expect(rule('.stepIcon').get('color')).toBe(rule('.stepNumber').get('color'));
  });

  const tokens = parseCssBlocks(readFileSync(TOKENS_CSS, 'utf8'));
  const root = declarationsOf(tokens, ':root');
  for (const [name, selector, media] of RENDERS) {
    it(`rendu ${name} : numéro de l’étape à 4,5:1, pictogramme à 3:1 sur leur teinte`, () => {
      const block = declarationsOf(tokens, selector, media);
      expect(root && block, `bloc ${selector} absent de tokens.css`).toBeTruthy();
      const vars = new Map([...(root ?? []), ...(block ?? [])]);
      for (const [selectorOf, min] of [
        ['.stepNumber', TEXT],
        ['.stepIcon', UI],
      ] as const) {
        const fg = resolveColor(rule(selectorOf).get('color') ?? '', vars);
        const bg = resolveColor(rule(selectorOf).get('background') ?? '', vars);
        expect(fg ?? '', `${selectorOf} : encre (${name})`).toMatch(HEX);
        expect(bg ?? '', `${selectorOf} : fond (${name})`).toMatch(HEX);
        const ratio = contrastRatio(fg as string, bg as string);
        expect(
          ratio,
          `${selectorOf} ${fg} sur ${bg} (${name}) : ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
