// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const UI = resolve(import.meta.dirname, '../../src/ui');
const read = (path: string) => readFileSync(resolve(UI, path), 'utf8');
const tokens = () => parseCssBlocks(read('theme/tokens.css'));
const base = () => parseCssBlocks(read('ui.module.css'));
const rootTokens = () => declarationsOf(tokens(), ':root');
const themeTokens = (choice: string) => declarationsOf(tokens(), `:root[data-theme="${choice}"]`);
const rule = (selector: string) => declarationsOf(base(), selector);
const px = (value: string | undefined) => Number.parseFloat(value ?? '');
/** Valeur sur une ligne, telle que l'écrit la maquette, quel que soit le découpage du formateur. */
const flat = (value: string | undefined) =>
  (value ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

describe('feuille de base (ui.module.css) : rien que des jetons', () => {
  it('aucune couleur écrite en dur : chaque couleur vient de tokens.css', () => {
    const css = read('ui.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = css.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi) ?? [];
    expect(literals).toEqual([]);
  });

  it('voile derrière un dialogue : le jeton --backdrop, noir à 55 % (GUIDE, feuille du bas)', () => {
    expect(rule('.backdrop')?.get('background')).toBe('var(--backdrop)');
    expect(rootTokens()?.get('--backdrop')).toBe('rgb(0 0 0 / 0.55)');
  });

  it('cases à cocher et boutons radio natifs prennent l’accent du thème', () => {
    expect(rule(':global(body)')?.get('accent-color')).toBe('var(--accent)');
  });
});

describe('décor de page (spec refonte §4 : lignes et marge du Carnet, fond nuit du logo)', () => {
  it('la page pose le fond du thème puis son décor, sans raccourci qui effacerait l’un des deux', () => {
    const body = rule(':global(body)');
    expect(body?.get('background')).toBeUndefined();
    expect(body?.get('background-color')).toBe('var(--bg)');
    expect(body?.get('background-image')).toBe('var(--page-decor)');
  });

  it('le contenu et le pied de page commencent après le retrait du thème', () => {
    expect(rule('.main')?.get('padding-inline-start')).toBe('var(--page-inset-start)');
    expect(rule('.footer')?.get('padding-inline-start')).toBe('var(--page-inset-start)');
  });

  it('par défaut (clair, sombre, Auto) : aucun décor, retrait habituel de 16 px', () => {
    expect(rootTokens()?.get('--page-decor')).toBe('none');
    expect(rootTokens()?.get('--page-inset-start')).toBe('var(--space-4)');
    expect(rootTokens()?.get('--space-4')).toBe('16px');
    const dark = declarationsOf(tokens(), ':root:not([data-theme])', '(prefers-color-scheme: dark)');
    for (const [name, block] of [
      ['auto en sombre', dark],
      ['clair', themeTokens('clair')],
      ['sombre', themeTokens('sombre')],
    ] as const) {
      expect(block, name).not.toBeNull();
      expect(block?.has('--page-decor'), name).toBe(false);
      expect(block?.has('--page-inset-start'), name).toBe(false);
    }
  });

  it('Carnet : marge rouge entre 33 et 34 px et lignes de cahier toutes les 32 px (maquette Carnet)', () => {
    const decor = flat(themeTokens('carnet')?.get('--page-decor'));
    expect(decor).toContain(
      'linear-gradient(to right, transparent 33px, rgb(196 92 72 / 0.35) 33px, rgb(196 92 72 / 0.35) 34px, transparent 34px)',
    );
    expect(decor).toContain(
      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, #e4dac6 31px, #e4dac6 32px)',
    );
  });

  it('Carnet : le texte commence à 46 px, après la marge, qui ne le traverse jamais', () => {
    const inset = themeTokens('carnet')?.get('--page-inset-start');
    expect(inset).toBe('46px');
    expect(px(inset)).toBeGreaterThan(34);
  });

  it('Salle de nuit : halo néon en haut de page sur le fond nuit (maquette Main), retrait habituel', () => {
    const nuit = themeTokens('nuit');
    expect(flat(nuit?.get('--page-decor'))).toBe(
      'radial-gradient(420px 260px at 50% 230px, rgb(94 216 255 / 0.1), rgb(5 7 13 / 0) 70%)',
    );
    expect(nuit?.get('--bg')).toBe('#05070d');
    expect(nuit?.has('--page-inset-start')).toBe(false);
  });
});

describe('composants de base : tailles d’écran, gros texte, contraste élevé (spec refonte §6)', () => {
  it('bouton block : pleine largeur sur téléphone, largeur propre (240 px au moins) au-delà', () => {
    expect(rule('.block')?.get('width')).toBe('100%');
    const wide = declarationsOf(base(), '.block', '(min-width: 600px)');
    expect(wide?.get('width')).toBe('auto');
    expect(wide?.get('min-width')).toBe('240px');
  });

  it('champ en lecture seule : visé par l’attribut readonly, pas par :read-only (désactivé, case, curseur)', () => {
    const readonly = rule('.field input[readonly]');
    expect(readonly?.get('border-style')).toBe('dashed');
    expect(readonly?.get('color')).toBe('var(--text-muted)');
    expect(read('ui.module.css')).not.toMatch(/:read-only/);
  });

  it('valeur d’une ligne de liste : passe à la ligne au lieu d’être coupée par des points de suspension', () => {
    const value = rule('.rowValue');
    expect(value?.get('white-space')).toBeUndefined();
    expect(value?.get('text-overflow')).toBeUndefined();
    expect(value?.get('overflow')).toBeUndefined();
    expect(value?.get('overflow-wrap')).toBe('anywhere');
    expect(rule('.row')?.get('min-height')).toBe('56px');
  });

  it('interrupteur en couleurs forcées : rail cerné, bouton dessiné, rail plein quand il est activé', () => {
    const forced = (selector: string) => declarationsOf(base(), selector, '(forced-colors: active)');
    expect(forced('.switchTrack')?.get('border')).toBe('1px solid ButtonText');
    // Bordure prise sur le rembourrage (border-box) : le bouton de 24 px tient toujours dans le rail.
    expect(forced('.switchTrack')?.get('padding')).toBe('2px');
    expect(forced('.switchThumb')?.get('forced-color-adjust')).toBe('none');
    expect(forced('.switchThumb')?.get('background')).toBe('ButtonText');
    const onTrack = forced('.switch[aria-checked="true"] .switchTrack');
    expect(onTrack?.get('forced-color-adjust')).toBe('none');
    expect(onTrack?.get('background')).toBe('Highlight');
    expect(forced('.switch[aria-checked="true"] .switchThumb')?.get('background')).toBe('HighlightText');
  });
});
