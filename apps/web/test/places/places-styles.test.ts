// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type CssBlock, parseCssBlocks } from '../support/css-blocks';

const FILE = resolve(import.meta.dirname, '../../src/features/places/places.module.css');
const source = () => readFileSync(FILE, 'utf8');
const blocks = () => parseCssBlocks(source());

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

/** Règles hors media query dont la liste de sélecteurs contient exactement `selector`, fusionnées. */
const rule = (selector: string, media: string | null = null) =>
  merge(blocks().filter((b) => b.media === media && selectorsOf(b.selector).includes(selector)));

type Theme = 'clair' | 'sombre' | 'nuit' | 'carnet' | 'auto-sombre';
const DARK: Theme[] = ['sombre', 'nuit', 'auto-sombre'];

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

/** Bas d'un `padding` : `padding-bottom`, sinon la 3e valeur du raccourci (la 1re s'il en a une ou deux). */
function paddingBottom(declarations: Map<string, string>): number {
  const own = declarations.get('padding-bottom');
  if (own !== undefined) return Number.parseFloat(own);
  const parts = (declarations.get('padding') ?? '0').split(/\s+/);
  return Number.parseFloat(parts[parts.length >= 3 ? 2 : 0] ?? '0');
}

const CARDS = ['.card', '.whoCard', '.placeCard', '.actionsCard', '.editor', '.toggleCard', '.similarItem'];

describe('places.module.css : rien que des jetons, justes dans les 5 thèmes (spec refonte §4)', () => {
  it('aucune couleur écrite en dur : chaque couleur vient de tokens.css', () => {
    const css = source().replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = css.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi) ?? [];
    expect(literals).toEqual([]);
  });

  // GUIDE (Tokens, carte) : ombre douce en clair, tirée de l'encre ; en sombre (maquettes D01-D05 Sombre) et en
  // Carnet (papier à plat), le bord fin suffit.
  it('cartes : ombre douce en Clair, à plat en Sombre, Salle de nuit, Carnet et Auto la nuit', () => {
    for (const cls of CARDS) {
      expect(flat(themed(cls, 'clair').get('box-shadow')), `${cls} en clair`).toBe(
        '0 1px 2px color-mix(in srgb, var(--text) 6%, transparent), 0 6px 18px color-mix(in srgb, var(--text) 5%, transparent)',
      );
      for (const theme of ['sombre', 'nuit', 'carnet', 'auto-sombre'] as const) {
        expect(themed(cls, theme).get('box-shadow'), `${cls} en ${theme}`).toBe('none');
      }
    }
  });
});

describe('historique en frise (maquettes D01, D02)', () => {
  // La carte n'a pas de marge en bas ; chaque entrée garde 14 px sous elle, la dernière comprise.
  it('14 px sous la dernière entrée, pas le double', () => {
    const last = new Map([...rule('.timelineItem'), ...rule('.timelineItem:last-child')]);
    expect(paddingBottom(rule('.card')) + paddingBottom(last)).toBe(14);
  });
});

describe('pastilles de l’écran Matériel (maquette D03, spec refonte §7)', () => {
  // « Un choix fait un petit ressort » : pas l'ouverture de l'écran, ni le dépliage d'une catégorie.
  it('le ressort de la coche ne part que d’un choix, et jamais sous mouvement réduit', () => {
    const pops = blocks().filter(
      (b) => b.media === null && /places-pop/.test(b.declarations.get('animation') ?? ''),
    );
    expect(pops.length).toBeGreaterThan(0);
    for (const pop of pops) {
      expect(pop.selector, 'attaché au choix qui vient d’être fait').toContain('[data-pop]');
      expect(pop.selector, 'pas à toute case cochée').not.toContain(':checked');
      expect(rule(pop.selector, '(prefers-reduced-motion: reduce)').get('animation')).toBe('none');
    }
  });
});

describe('barre des changements (maquette D03, spec refonte §10.3)', () => {
  const LIFT = '0 -8px 28px color-mix(in srgb, var(--bg) 90%, transparent)';

  // D03 Sombre : liseré glacé et relief vers le haut, fondu dans la page ; D03 Clair : ombre portée douce.
  it('liseré teinté d’accent et relief vers le haut dans tous les thèmes ; ombre portée en thème clair seulement', () => {
    expect(flat(rule('.draftBar').get('border'))).toBe(
      '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    );
    for (const theme of ['clair', 'carnet', ...DARK] as const) {
      expect(flat(themed('.draftBar', theme).get('box-shadow')), `relief en ${theme}`).toContain(LIFT);
    }
    expect(flat(themed('.draftBar', 'clair').get('box-shadow'))).toContain(
      '0 12px 30px color-mix(in srgb, var(--text) 12%, transparent)',
    );
    // En sombre, une ombre tirée de l'encre claire éclairerait la carte au lieu de l'assombrir.
    for (const theme of DARK) {
      expect(flat(themed('.draftBar', theme).get('box-shadow')), `ombre en ${theme}`).toBe(LIFT);
    }
  });

  // WCAG 2.2, 2.4.11 : tant que la barre est là, tabulation et focus() s'arrêtent au-dessus d'elle (sa hauteur
  // mesurée, en plus de sa distance au bas de l'écran). `:root` l'emporte sur `html:has(.tabBar)` de la coquille.
  it('tant qu’elle est là, la page garde sa place en bas : le focus ne finit pas dessous', () => {
    const bottom = flat(rule('.draftBar').get('bottom'));
    const inner = /^calc\((.*)\)$/.exec(bottom)?.[1];
    expect(inner, `bas de la barre : ${bottom}`).toBeTruthy();
    const phone = flat(rule(':global(:root):has(.draftBar)').get('scroll-padding-bottom'));
    expect(phone).toContain(inner ?? '∅');
    expect(phone).toContain('var(--draft-bar-height');
    const wide = '(min-width: 900px)';
    const pcBottom = rule('.draftBar', wide).get('bottom');
    expect(pcBottom).toBeTruthy();
    const pc = flat(rule(':global(:root):has(.draftBar)', wide).get('scroll-padding-bottom'));
    expect(pc).toContain(pcBottom ?? '∅');
    expect(pc).toContain('var(--draft-bar-height');
    expect(pc).not.toContain('94px');
  });
});
