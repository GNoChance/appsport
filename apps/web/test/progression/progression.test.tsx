import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUSCLE_GROUPS_LABELS, ProgressionPage } from '../../src/features/progression/ProgressionPage';
import { type CssBlock, parseCssBlocks } from '../support/css-blocks';
import { renderApp, renderWithServices } from '../support/render';

// Onglet Progression en avant-goût (spec refonte §9, maquettes ProgressionSombre / ProgressionClair) : rang
// global E et barre d'XP à 0, compteurs à 0, les 9 groupes musculaires au rang E, la fenêtre du Système.
// Aucune fausse donnée : le calcul réel arrive avec la brique 3.

const REDUCE = '(prefers-reduced-motion: reduce)';
const PROGRESSION_CSS = resolve(import.meta.dirname, '../../src/features/progression/progression.module.css');
const SYSTEM_TEXT = 'Aucune séance gravée. Ta première séance débloque tes rangs.';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Téléphone réglé en mouvement réduit : seule cette media query répond vrai. */
function reducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === REDUCE,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Texte lu par un lecteur d'écran : ce qui est caché (`aria-hidden`) en moins, espaces resserrés. */
function spoken(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const open = () => renderWithServices(<ProgressionPage />);
/** Élément de liste qui contient le libellé `label`. */
const statOf = (label: string) => screen.getByText(label).closest('li') as HTMLElement;
/** Chiffres affichés d'un compteur (la partie visible, cachée aux lecteurs d'écran). */
const shownDigits = (root: Element) =>
  [...root.querySelectorAll('span[aria-hidden="true"]')]
    .map((s) => s.textContent ?? '')
    .filter((t) => /^\d+$/.test(t));

describe('Progression en avant-goût (spec refonte §9)', () => {
  it('titre « Progression », rang global E, « 0 / 100 XP », prochain rang D', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Progression' })).toBeTruthy();
    const hero = screen.getByRole('region', { name: 'Rang global' });
    expect(within(hero).getByRole('img', { name: 'Rang E' })).toBeTruthy();
    expect(within(hero).getByText('Rang E')).toBeTruthy();
    expect(within(hero).getByText('0 / 100 XP')).toBeTruthy();
    expect(within(hero).getByText('Prochain : D')).toBeTruthy();
    // Lu « 0 sur 100 XP » : pas de barre oblique au lecteur d'écran.
    expect(spoken(hero)).toContain('0 sur 100 XP');
  });

  it('barre d’XP vide : aucun remplissage inventé, juste un reflet décoratif', async () => {
    const { container } = await open();
    const bar = container.querySelector('[data-xp]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect(bar?.getAttribute('data-xp')).toBe('0');
  });

  it('compteurs à 0 : séances, kg soulevés, semaines d’assiduité', async () => {
    await open();
    expect(spoken(statOf('séances'))).toBe('0 séances');
    expect(spoken(statOf('soulevés'))).toBe('0 kg soulevés');
    expect(spoken(statOf("d'assiduité"))).toBe("0 semaine d'assiduité");
    // À l'écran, l'abréviation de la maquette.
    expect(statOf("d'assiduité").textContent).toContain('sem.');
    for (const label of ['séances', 'soulevés', "d'assiduité"]) {
      expect(shownDigits(statOf(label)), label).toEqual(['0']);
    }
  });

  it('les 9 groupes musculaires au rang E, dans l’ordre', async () => {
    expect(MUSCLE_GROUPS_LABELS).toEqual([
      'Pectoraux',
      'Dos',
      'Épaules',
      'Bras',
      'Abdos',
      'Fessiers',
      'Quadriceps',
      'Ischios',
      'Mollets',
    ]);
    await open();
    const section = screen.getByRole('region', { name: 'Rangs par muscle' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Rangs par muscle' })).toBeTruthy();
    expect(within(section).getByText('9 groupes')).toBeTruthy();
    const items = within(section).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([...MUSCLE_GROUPS_LABELS]);
    for (const li of items) {
      expect(within(li).getByRole('img', { name: 'Rang E' }), li.textContent ?? '').toBeTruthy();
    }
    expect(within(section).getAllByRole('img', { name: 'Rang E' })).toHaveLength(9);
  });

  it('fenêtre du Système, texte mot pour mot', async () => {
    await open();
    const text = screen.getByText(SYSTEM_TEXT);
    const note = text.closest('[role="note"]');
    expect(note).not.toBeNull();
    expect(spoken(note as Element)).toBe(`SYSTÈME ${SYSTEM_TEXT}`);
  });

  it('aucune fausse donnée : seuls 0, 100 (seuil du rang D) et 9 (groupes) comme nombres', async () => {
    const { container } = await open();
    const numbers = new Set((spoken(container).match(/\d+/g) ?? []).map(Number));
    expect([...numbers].sort((a, b) => a - b)).toEqual([0, 9, 100]);
    // Aucun autre rang qu'E porté, et D seulement comme prochain rang.
    expect(screen.getAllByRole('img').every((img) => img.getAttribute('aria-label') === 'Rang E')).toBe(true);
  });

  it('mouvement réduit : les compteurs sont à leur valeur finale dès le premier rendu', async () => {
    reducedMotion();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    await open();
    for (const label of ['séances', 'soulevés', "d'assiduité"]) {
      expect(shownDigits(statOf(label)), label).toEqual(['0']);
    }
  });

  it('/progression dans l’appli : onglet « Progression » actif, contenu de l’avant-goût', async () => {
    await renderApp({ path: '/progression' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Progression' })).toBeTruthy();
    const tab = screen
      .getByRole('navigation', { name: 'Navigation principale' })
      .querySelector('[aria-current="page"]');
    expect(tab?.textContent).toBe('Progression');
    expect(screen.getByText(SYSTEM_TEXT)).toBeTruthy();
  });
});

describe('feuille de la Progression (progression.module.css)', () => {
  const css = () => readFileSync(PROGRESSION_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = (): CssBlock[] => parseCssBlocks(css());
  const at = (selector: string, media: string | null) =>
    blocks().filter((b) => b.media === media && b.selector.split(', ').includes(selector));

  it('couleurs prises dans les jetons : ni hexadécimal, ni rgb() en dur, hors ombres', () => {
    for (const block of blocks()) {
      for (const [prop, value] of block.declarations) {
        if (prop === 'box-shadow') continue;
        expect(value, `${block.selector} { ${prop} }`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
      }
    }
  });

  it('jamais caché hors animation : aucune règle ne pose opacity 0 en dehors des keyframes', () => {
    for (const block of blocks()) {
      if (block.selector.startsWith('@keyframes')) continue;
      expect(block.declarations.get('opacity'), block.selector).not.toBe('0');
      expect(block.declarations.get('visibility'), block.selector).not.toBe('hidden');
    }
  });

  it('reflet de la barre d’XP et cascade des groupes : durées de la spec, courbe unique', () => {
    const sweep = at('.xpSweep', null).find((b) => b.declarations.has('animation'));
    expect(sweep?.declarations.get('animation')).toMatch(/var\(--ease\)/);
    const muscle = at('.muscle', null).find((b) => b.declarations.has('animation'));
    expect(muscle?.declarations.get('animation')).toMatch(/var\(--ease\)/);
  });

  it('mouvement réduit : ni balayage, ni cascade des groupes (un fondu court, sans retard)', () => {
    const sweep = new Map(at('.xpSweep', REDUCE).flatMap((b) => [...b.declarations]));
    expect(sweep.get('animation')).toBe('none');
    const muscle = new Map(at('.muscle', REDUCE).flatMap((b) => [...b.declarations]));
    expect(muscle.get('animation-name')).toBe('fade');
    expect(muscle.get('animation-delay')).toBe('0ms');
  });
});
