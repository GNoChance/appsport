// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const FILE = resolve(import.meta.dirname, '../../src/features/admin/admin.module.css');
const TOKENS_CSS = resolve(import.meta.dirname, '../../src/ui/theme/tokens.css');
const source = () => readFileSync(FILE, 'utf8');

/** Déclarations des règles dont la liste de sélecteurs contient `selector`, dans ce contexte, fusionnées. */
const rule = (selector: string, media: string | null = null) =>
  new Map(
    parseCssBlocks(source())
      .filter((b) => b.media === media && b.selector.split(', ').includes(selector))
      .flatMap((b) => [...b.declarations]),
  );

/** Taille du code de l'invitation, `max(<plancher>rem, min(1.25rem, <part>cqi))` : [plancher, part], ou null. */
function codeSize(): [number, number] | null {
  const m = /^max\(([\d.]+)rem, min\(1\.25rem, ([\d.]+)cqi\)\)$/.exec(rule('.code').get('font-size') ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

describe('admin.module.css : jetons, cibles tactiles et mouvement (spec refonte §4, §7)', () => {
  it('aucune couleur écrite en dur : chaque couleur vient de tokens.css, juste dans les 5 thèmes', () => {
    const css = source().replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = css.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi) ?? [];
    expect(literals).toEqual([]);
    expect(css).not.toMatch(/var\(--color-/);
  });

  it('cibles de 44 px : sous-navigation, « Actions pour … », « Fermer » de la feuille, boutons compacts, nom d’une salle', () => {
    expect(rule('.nav a').get('min-height')).toBe('44px');
    // Le nom d'une salle est le seul chemin vers sa fiche : son lien fait 44 px de haut, texte centré.
    expect(rule('.gymLink').get('min-height')).toBe('44px');
    expect(rule('.gymLink').get('display')).toBe('flex');
    expect(rule('.gymLink').get('align-items')).toBe('center');
    for (const selector of ['.moreButton', '.closeButton']) {
      expect(rule(selector).get('width'), selector).toBe('44px');
      expect(rule(selector).get('height'), selector).toBe('44px');
    }
    expect(rule('.compact').get('min-height')).toBe('44px');
  });

  it('sous-navigation : les segments passent à la ligne plutôt que de se chevaucher (320 px, texte à 200 %)', () => {
    expect(rule('.nav ul').get('flex-wrap')).toBe('wrap');
    // min-width: 0 laissait la case rétrécir sous son libellé : le lien en débordait sur la case voisine.
    expect(rule('.nav li').get('min-width')).toBeUndefined();
    expect(rule('.nav a').get('white-space')).not.toBe('nowrap');
    expect(rule('.nav a').get('overflow-wrap')).toBe('anywhere');
    expect(rule('.nav a').get('text-align')).toBe('center');
  });

  it('sous-navigation : le rayon du segment suit celui du cadre, moins son retrait (5 thèmes)', () => {
    expect(rule('.nav ul').get('padding')).toBe('var(--space-1)');
    expect(rule('.nav a').get('border-radius')).toBe('max(2px, calc(var(--radius-card) - var(--space-1)))');
  });

  it('nom d’une salle passé à la ligne : il garde sa place dans la carte, le lien rembourré de ses marges négatives', () => {
    // Haut, bas d'une déclaration abrégée `a [b [c]]` (margin, padding), en px.
    const block = (value: string | undefined): [number, number] => {
      const [top = '', , bottom = top] = (value ?? '').split(' ');
      return [Number.parseFloat(top), Number.parseFloat(bottom)];
    };
    const [marginTop, marginBottom] = block(rule('.gymLink').get('margin'));
    const [paddingTop, paddingBottom] = block(rule('.gymLink').get('padding'));
    // Sur une ligne, le nom est centré dans les 44 px ; sur deux, il commence et finit là où il était sans le lien
    // agrandi : ni dans le rembourrage de la carte, ni collé à la ville en dessous.
    expect(marginTop, 'marge haute négative').toBeLessThan(0);
    expect(paddingTop, 'rembourrage haut = marge haute').toBe(-marginTop);
    expect(paddingBottom, 'rembourrage bas = marge basse').toBe(-marginBottom);
  });

  it('pseudos, notes et noms de salle entiers : passés à la ligne, jamais coupés d’une ellipse', () => {
    for (const selector of ['.memberName', '.cardTitle']) {
      expect(rule(selector).get('white-space'), selector).toBeUndefined();
      expect(rule(selector).get('text-overflow'), selector).toBeUndefined();
      expect(rule(selector).get('overflow'), selector).toBeUndefined();
      expect(rule(selector).get('overflow-wrap'), selector).toBe('anywhere');
    }
    for (const selector of ['.fact dt', '.fact dd', '.hostFacts dt', '.hostFacts dd']) {
      expect(rule(selector).get('overflow-wrap'), selector).toBe('anywhere');
    }
    // Icône et mot sur une ligne trop étroite : l'icône cède sa ligne avant que le mot ne se coupe (« Termin / é »).
    for (const selector of ['.fact dd', '.hostFacts dt']) {
      expect(rule(selector).get('flex-wrap'), selector).toBe('wrap');
    }
  });

  it('le code de l’invitation tient sur une ligne : taille réglée sur la largeur de sa boîte (E04)', () => {
    expect(rule('.codeBox').get('container-type')).toBe('inline-size');
    expect(rule('.code').get('white-space')).toBe('nowrap');
    const size = codeSize();
    expect(size, `font-size de .code : ${rule('.code').get('font-size')}`).not.toBeNull();
    const [floorRem, cqi] = size ?? [Number.NaN, Number.NaN];
    // Chakra Petch 700 à 0,03 em : un code fait 12,06 em en moyenne, 13,77 em pour un sur un million (W, M larges).
    expect(cqi * 13.77, 'un code large tient dans la boîte').toBeLessThanOrEqual(100);
    // Plancher en rem (le texte agrandi agrandit le code), lisible, et sous la taille réglée sur la boîte la plus
    // étroite au texte par défaut (Carnet à 320 px : 188 px, 11,75rem) : sans quoi le code s'y couperait.
    expect(floorRem, 'plancher lisible').toBeGreaterThanOrEqual(0.75);
    expect(floorRem, 'plancher sous la taille de la boîte la plus étroite').toBeLessThanOrEqual(
      (cqi * 11.75) / 100,
    );
  });

  it('très grand texte : le code, à son plancher, passe à la ligne au lieu de déborder de la boîte', () => {
    const css = source().replace(/\/\*[\s\S]*?\*\//g, '');
    const [floorRem, cqi] = codeSize() ?? [Number.NaN, Number.NaN];
    const query = /@container \(width < ([\d.]+)rem\)\s*\{([\s\S]*?\})\s*\}/.exec(css);
    expect(query, 'requête de conteneur du code').not.toBeNull();
    // Seuil = largeur où le plancher l'emporte sur la taille réglée sur la boîte : en deçà, le code déborderait.
    expect(Number(query?.[1]) * cqi).toBeCloseTo(floorRem * 100, 0);
    const inner = declarationsOf(parseCssBlocks(query?.[2] ?? ''), '.code');
    expect(inner?.get('white-space')).toBe('normal');
    expect(inner?.get('overflow-wrap')).toBe('anywhere');
  });

  it('le code ne se coupe jamais en fin de ligne dans le message à envoyer', () => {
    expect(rule('.messageCode').get('white-space')).toBe('nowrap');
  });

  it('les barres de disque se remplissent sur la courbe unique, et plus du tout sous mouvement réduit', () => {
    const animation = rule('.barFill').get('animation') ?? '';
    expect(animation).toContain('var(--dur-screen)');
    expect(animation).toContain('var(--ease)');
    expect(rule('.barFill', '(prefers-reduced-motion: reduce)').get('animation')).toBe('none');
  });
});

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
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

/** Une couleur : un jeton (`--danger`), ou la propriété d'une règle de admin.module.css (`.avatar|color`). */
type Paint = string;
const paint = (p: Paint): string => {
  if (p.startsWith('--')) return `var(${p})`;
  const [selector, prop] = p.split('|') as [string, string];
  const value = rule(selector).get(prop);
  if (value === undefined) throw new Error(`${prop} absent de ${selector}`);
  return value;
};

/**
 * Textes et éléments d'interface posés sur une teinte propre à l'administration (opaque, mélangée à une
 * surface) : [nom, premier plan, fond, minimum].
 */
const PAIRS: readonly (readonly [string, Paint, Paint, number])[] = [
  [
    'sous-navigation : section affichée',
    '.nav a[aria-current="page"]|color',
    '.nav a[aria-current="page"]|background',
    TEXT,
  ],
  ['initiale du membre', '.avatar|color', '.avatar|background', TEXT],
  [
    'initiale d’un membre désactivé',
    '.memberCard[data-status="disabled"] .avatar|color',
    '.memberCard[data-status="disabled"] .avatar|background',
    TEXT,
  ],
  [
    'pseudo d’un membre désactivé',
    '.memberCard[data-status="disabled"] .memberName|color',
    '.memberCard[data-status="disabled"]|background',
    TEXT,
  ],
  [
    'badge « Admin » d’un membre désactivé',
    '--accent',
    '.memberCard[data-status="disabled"]|background',
    TEXT,
  ],
  ['texte d’un membre désactivé', '--text', '.memberCard[data-status="disabled"]|background', TEXT],
  ['« Actions pour … »', '.moreButton|color', '.moreButton|background', UI],
  ['actions sensibles : libellé', '--danger', '.sensitive ul|background', TEXT],
  ['actions sensibles : détail', '--text-muted', '.sensitive ul|background', TEXT],
  ['code : étiquette', '.codeLabel|color', '.codeBox|background', TEXT],
  ['code', '.code|color', '.codeBox|background', TEXT],
  ['code : « Ce code ne sera plus affiché. »', '.codeWarning|color', '.codeBox|background', TEXT],
  ['message à envoyer', '.message|color', '.message|background', TEXT],
  ['icône du résumé du serveur', '.summaryIcon|color', '.summaryIcon|background', UI],
];

describe('admin.module.css : contrastes des teintes, dans chaque thème (spec refonte §4)', () => {
  const tokens = parseCssBlocks(readFileSync(TOKENS_CSS, 'utf8'));
  const root = declarationsOf(tokens, ':root');
  for (const [name, selector, media] of RENDERS) {
    it(`rendu ${name} : chaque paire atteint son minimum`, () => {
      const block = declarationsOf(tokens, selector, media);
      expect(root && block, `bloc ${selector} absent de tokens.css`).toBeTruthy();
      const vars = new Map([...(root ?? []), ...(block ?? [])]);
      for (const [pair, fg, bg, min] of PAIRS) {
        const a = resolveColor(paint(fg), vars);
        const b = resolveColor(paint(bg), vars);
        expect(a ?? '', `${pair} : premier plan ${paint(fg)} (${name})`).toMatch(HEX);
        expect(b ?? '', `${pair} : fond ${paint(bg)} (${name})`).toMatch(HEX);
        const ratio = contrastRatio(a as string, b as string);
        expect(ratio, `${pair} ${a} sur ${b} (${name}) : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
