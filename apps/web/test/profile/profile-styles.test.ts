// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const PROFILE_CSS = resolve(import.meta.dirname, '../../src/features/profile/profile.module.css');
const REDUCE = '(prefers-reduced-motion: reduce)';
const SWITCH = '.cautious input[role="switch"]';

const blocks = () => parseCssBlocks(readFileSync(PROFILE_CSS, 'utf8'));

describe('feuille du Profil (profile.module.css)', () => {
  it('mouvement réduit (spec refonte §7) : rien ne glisse, comme l’interrupteur de la boîte à outils', () => {
    const all = blocks();
    const sliding = all.filter(
      (b) => b.media === null && /\btransform\b/.test(b.declarations.get('transition') ?? ''),
    );
    // Le bouton de l'interrupteur du mode prudent glisse ; il n'est pas le seul à devoir s'arrêter.
    expect(sliding.map((b) => b.selector)).toContain(`${SWITCH}::after`);
    for (const { selector } of sliding) {
      const reduced = declarationsOf(all, selector, REDUCE);
      expect(reduced?.get('transition-property'), `${selector} : déplacement sous mouvement réduit`).toBe(
        'background-color',
      );
    }
  });

  it('mode prudent (maquette C02) : icône et interrupteur centrés, la note dans la colonne du libellé', () => {
    const all = blocks();
    expect(declarationsOf(all, '.cautious')?.get('align-items')).toBe('center');
    // L'interrupteur sort du flux du texte, à droite et centré sur toute la colonne (libellé et notes) ; la
    // colonne lui garde sa place (52 px de cible, 14 px d'écart) : la note ne passe plus dessous.
    const column = declarationsOf(all, '.cautious > :last-child');
    expect(column?.get('position')).toBe('relative');
    expect(column?.get('padding-inline-end')).toBe('calc(52px + 14px)');
    const control = declarationsOf(all, SWITCH);
    expect(control?.get('position')).toBe('absolute');
    expect(control?.get('inset-inline-end')).toBe('0');
    expect(control?.get('inset-block')).toBe('0');
    expect(control?.get('margin-block')).toBe('auto');
  });

  it('cible tactile ≥ 44 px : la case fait 52 × 44 et dessine la piste de 50 × 30, comme le Switch', () => {
    const all = blocks();
    const control = declarationsOf(all, SWITCH);
    expect(control?.get('width')).toBe('52px');
    expect(control?.get('height')).toBe('44px');
    // Piste : 7 px en haut et en bas, 1 px sur les côtés → 50 × 30 ; bouton de 24 px, course de 20 px.
    expect(declarationsOf(all, `${SWITCH}::before`)?.get('inset')).toBe('7px 1px');
    expect(declarationsOf(all, `${SWITCH}::after`)?.get('width')).toBe('24px');
    expect(declarationsOf(all, `${SWITCH}:checked::after`)?.get('transform')).toBe('translateX(20px)');
  });
});
