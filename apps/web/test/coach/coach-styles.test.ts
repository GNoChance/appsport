// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type CssBlock, normalizeSelector, parseCssBlocks } from '../support/css-blocks';

const COACH_CSS = resolve(import.meta.dirname, '../../src/features/coach/coach.module.css');
const REDUCE = '(prefers-reduced-motion: reduce)';
const CARNET = ':global(:root[data-theme="carnet"])';

const blocks = () => parseCssBlocks(readFileSync(COACH_CSS, 'utf8'));

/** `a, b:not(c, d)` → [`a`, `b:not(c, d)`] : coupe aux virgules hors parenthèses. */
function selectorList(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(selector.slice(start).trim());
  return out;
}

/** Règles (hors at-rules) de ce contexte, y compris celles qui listent ce sélecteur parmi d'autres. */
const rulesFor = (all: readonly CssBlock[], selector: string, media: string | null = null) => {
  const wanted = normalizeSelector(selector);
  return all.filter((b) => b.media === media && selectorList(b.selector).includes(wanted));
};

/** Déclarations fusionnées dans l'ordre du fichier, comme la cascade à spécificité égale. */
const declarations = (all: readonly CssBlock[], selector: string, media: string | null = null) =>
  new Map(rulesFor(all, selector, media).flatMap((b) => [...b.declarations]));

/** Règles de style hors media query (ni @keyframes ni @font-face). */
const styleRules = (all: readonly CssBlock[]) =>
  all.filter((b) => b.media === null && !b.selector.startsWith('@'));

describe('feuille du coach (coach.module.css)', () => {
  it('Carnet : un titre en police des titres repasse en 600 (Newsreader n’est embarqué qu’en 600)', () => {
    const all = blocks();
    const titled = styleRules(all)
      .filter((b) => b.declarations.get('font-family') === 'var(--font-title)')
      .flatMap((b) => selectorList(b.selector));
    expect(titled).toContain('.cardName');
    for (const selector of titled) {
      const weight = declarations(all, selector).get('font-weight');
      if (weight === undefined || weight === '600') continue;
      expect(
        declarations(all, `${CARNET} ${selector}`).get('font-weight'),
        `${selector} en ${weight} : gras synthétisé en Carnet`,
      ).toBe('600');
    }
  });

  it('halo : seul celui de l’entraînement rejoue l’arrivée ; celui de la nutrition ne réagit qu’au mode', () => {
    const all = blocks();
    expect(declarations(all, '.halo[data-tone="training"]').get('animation') ?? '').toMatch(/^intro-fade /);
    // Une animation d'entrée sur le halo d'or l'emporterait sur son opacité nulle : éclair à chaque arrivée.
    expect(declarations(all, '.halo').has('animation')).toBe(false);
    expect(declarations(all, '.halo[data-tone="nutrition"]').has('animation')).toBe(false);
    expect(declarations(all, '.halo[data-tone="nutrition"]').get('opacity')).toBe('0');
  });

  it('mouvement réduit : chaque animation part sans attendre, en fondu court, ou disparaît (sans cascade)', () => {
    const all = blocks();
    const animated = styleRules(all)
      .filter((b) => b.declarations.has('animation'))
      .flatMap((b) => selectorList(b.selector));
    expect(animated).toEqual(expect.arrayContaining(['.introFade', '.grow', '.halo[data-tone="training"]']));
    for (const selector of animated) {
      const reduced = declarations(all, selector, REDUCE);
      if (reduced.get('animation') === 'none') continue;
      expect(reduced.get('animation-delay'), `${selector} : retard sous mouvement réduit`).toBe('0ms');
      expect(reduced.get('animation-duration'), `${selector} : durée sous mouvement réduit`).toBe(
        'var(--dur-fast)',
      );
    }
  });
});
