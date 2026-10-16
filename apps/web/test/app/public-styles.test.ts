// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type CssBlock, declarationsOf, parseCssBlocks } from '../support/css-blocks';

const FILE = resolve(import.meta.dirname, '../../src/features/public/public.module.css');
const TOKENS_CSS = resolve(import.meta.dirname, '../../src/ui/theme/tokens.css');
const blocks = () => parseCssBlocks(readFileSync(FILE, 'utf8'));

/** Valeur sur une ligne, quel que soit le découpage du formateur. */
const flat = (value: string | undefined) =>
  (value ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

/** Sélecteurs d'une liste, sans couper dans les parenthèses (`:is(a, b)` reste entier). */
function selectorsOf(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out;
}

const merge = (matching: readonly CssBlock[]) => new Map(matching.flatMap((b) => [...b.declarations]));

/** Règles de ce contexte dont la liste de sélecteurs contient exactement `selector`, fusionnées. */
const rule = (selector: string, media: string | null = null) =>
  merge(blocks().filter((b) => b.media === media && selectorsOf(b.selector).includes(selector)));

type Theme = 'clair' | 'sombre' | 'nuit' | 'carnet' | 'auto-sombre';

/**
 * Déclarations qui s'appliquent à la classe `cls` dans `theme` : la règle de base, puis celles du thème
 * (`:root[data-theme="…"]`, ou `:root:not([data-theme])` sous `prefers-color-scheme: dark` pour Auto la nuit).
 */
function themed(cls: string, theme: Theme): Map<string, string> {
  const target = new RegExp(`${cls.replace('.', '\\.')}(?![\\w-])`);
  const marker = theme === 'auto-sombre' ? ':root:not([data-theme])' : `[data-theme="${theme}"]`;
  const media = theme === 'auto-sombre' ? '(prefers-color-scheme: dark)' : null;
  const own = blocks().filter(
    (b) => b.media === media && selectorsOf(b.selector).some((s) => s.includes(marker) && target.test(s)),
  );
  return new Map([...rule(cls), ...merge(own)]);
}

const REDUCED = '(prefers-reduced-motion: reduce)';

describe('page introuvable : « Retour à l’accueil » répond au doigt comme le bouton principal (spec refonte §7)', () => {
  it('pressé, il se tasse à 0,98 sur la courbe unique, fond et taille en --dur-fast', () => {
    expect(rule('.homeLink:active').get('transform')).toBe('scale(0.98)');
    const transition = flat(rule('.homeLink').get('transition'));
    expect(transition).toContain('transform var(--dur-fast) var(--ease)');
    expect(transition).toContain('background-color var(--dur-fast) var(--ease)');
  });

  it('sous mouvement réduit : plus de tassement, le fond seul change', () => {
    expect(rule('.homeLink:active', REDUCED).get('transform')).toBe('none');
    expect(rule('.homeLink', REDUCED).get('transition-property')).toBe('background-color');
  });
});

describe('public.module.css : rayons et cartes des jetons, justes dans les 5 thèmes (spec refonte §4)', () => {
  it('aucun rayon écrit en dur : chaque rayon vient de tokens.css (hors pastille ronde)', () => {
    const radii = blocks().flatMap((b) =>
      [...b.declarations]
        .filter(([prop]) => prop === 'border-radius')
        .map(([, value]) => `${b.selector} : ${value}`),
    );
    expect(radii.length).toBeGreaterThan(0);
    for (const radius of radii) {
      expect(radius).toMatch(/ : (?:var\(--radius-[\w-]+\)|50%)$/);
    }
  });

  // Maquette A06 : l'encadré « Hors ligne » est une carte, ombre douce en Clair, à plat en sombre.
  it('encadré « Hors ligne » (A06) : la carte commune, ombre douce en Clair, à plat en Sombre, Salle de nuit, Carnet et Auto la nuit', () => {
    expect(rule('.offline').get('border-radius')).toBe('var(--radius-card)');
    expect(rule('.offline').get('background')).toBe('var(--surface)');
    expect(flat(themed('.offline', 'clair').get('box-shadow'))).toBe(
      '0 1px 2px color-mix(in srgb, var(--text) 6%, transparent), 0 6px 18px color-mix(in srgb, var(--text) 5%, transparent)',
    );
    for (const theme of ['sombre', 'nuit', 'carnet', 'auto-sombre'] as const) {
      expect(themed('.offline', theme).get('box-shadow'), `.offline en ${theme}`).toBe('none');
    }
  });

  // Newsreader, police des titres du Carnet, n'est embarqué qu'en 600 : au-delà, le navigateur fabrique un faux gras.
  it('Carnet : chaque titre en gras plus de 600 repasse à 600, pas de gras synthétisé', () => {
    const headings = blocks().filter(
      (b) =>
        b.media === null &&
        !b.selector.includes('data-theme') &&
        /(?:^|\s)h[1-3]$/.test(b.selector) &&
        Number(b.declarations.get('font-weight') ?? 0) > 600,
    );
    expect(headings.map((b) => b.selector)).toContain('.section h2');
    for (const heading of headings) {
      expect(
        rule(`:global(:root[data-theme="carnet"]) ${heading.selector}`).get('font-weight'),
        `${heading.selector} en Carnet`,
      ).toBe('600');
    }
  });
});

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const TEXT = 4.5;

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

/**
 * Couleur peinte comme le navigateur : suit `var(--x)` et calcule `color-mix(in srgb, A N%, B)`. `transparent`
 * laisse voir ce qu'il y a dessous (`under`) : une teinte mêlée de transparent se pose sur ce fond.
 */
function paint(value: string, vars: ReadonlyMap<string, string>, under: string, depth = 0): string | null {
  if (depth > 8) return null;
  if (HEX.test(value)) return value;
  if (value === 'transparent') return under;
  const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
  if (ref) {
    const next = vars.get(ref[1] as string);
    return next === undefined ? null : paint(next, vars, under, depth + 1);
  }
  const mix = /^color-mix\(in srgb,\s*(\S+)\s+(\d+(?:\.\d+)?)%,\s*(\S+)\s*\)$/.exec(value);
  if (!mix) return null;
  const a = paint(mix[1] as string, vars, under, depth + 1);
  const b = paint(mix[3] as string, vars, under, depth + 1);
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

// L'encadré d'urgence de l'Aide se pose sur la page (aucune carte dessous) : sa teinte, ses boutons d'appel au
// repos et survolés gardent le texte à 4,5:1 (« SAMU », « Numéro européen » en 12,5 px), maquette A05.
describe('Aide : encadré d’urgence lisible dans chaque thème (contrastes ≥ 4,5:1, maquette A05)', () => {
  const tokens = parseCssBlocks(readFileSync(TOKENS_CSS, 'utf8'));
  const root = declarationsOf(tokens, ':root');
  for (const [name, selector, media] of RENDERS) {
    it(`rendu ${name} : danger et texte sur l’encadré, au repos et au survol`, () => {
      const block = declarationsOf(tokens, selector, media);
      expect(root && block, `bloc ${selector} absent de tokens.css`).toBeTruthy();
      const vars = new Map([...(root ?? []), ...(block ?? [])]);
      const page = paint('var(--bg)', vars, '#000000') ?? '';
      expect(page).toMatch(HEX);
      const boxValue = rule('.emergency').get('background') ?? 'transparent';
      const box = paint(boxValue, vars, page) ?? '';
      expect(box, `fond de l’encadré ${boxValue} (${name})`).toMatch(HEX);
      const callValue = rule('.emergencyCall').get('background') ?? 'transparent';
      const call = paint(callValue, vars, box) ?? '';
      const hoverValue = rule('.emergencyCall:hover', '(hover: hover)').get('background') ?? callValue;
      const hover = paint(hoverValue, vars, box) ?? '';
      expect(call, `bouton d’appel ${callValue} (${name})`).toMatch(HEX);
      expect(hover, `bouton d’appel survolé ${hoverValue} (${name})`).toMatch(HEX);
      const danger = paint('var(--danger)', vars, page) ?? '';
      const text = paint('var(--text)', vars, page) ?? '';
      for (const [pair, fg, bg] of [
        ['« En cas d’urgence… »', text, box],
        ['bouton d’appel au repos', danger, call],
        ['bouton d’appel survolé', danger, hover],
      ] as const) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio, `${pair} ${fg} sur ${bg} (${name}) : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          TEXT,
        );
      }
    });
  }
});
