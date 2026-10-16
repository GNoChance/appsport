import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS_LABELS, ProgressionPage } from '../../src/features/progression/ProgressionPage';
import { type CssBlock, declarationsOf, parseCssBlocks } from '../support/css-blocks';
import { renderApp, renderWithServices } from '../support/render';

// Onglet Progression en avant-goût (spec refonte §9, maquettes ProgressionSombre / ProgressionClair) : rang
// global E et barre d'XP à 0, compteurs à 0, les 9 groupes musculaires au rang E, la fenêtre du Système.
// Aucune fausse donnée : le calcul réel arrive avec la brique 3.
// CountUp sous mouvement réduit n'est pas testé ici : tous ces compteurs valent 0, le test ne pourrait pas
// échouer. La vraie vérification est celle du rythme de l'accueil (à 3), dans test/home/home.test.tsx.

const REDUCE = '(prefers-reduced-motion: reduce)';
const PROGRESSION_CSS = resolve(import.meta.dirname, '../../src/features/progression/progression.module.css');
const MOTION_CSS = resolve(import.meta.dirname, '../../src/ui/motion.css');
const SYSTEM_TEXT = 'Aucune séance gravée. Ta première séance débloque tes rangs.';
/** Fourchettes de durée de la spec refonte §7, en ms : retour d'un geste, changement d'écran, célébration. */
const GESTURE_MS = [150, 250] as const;
const SCREEN_MS = [300, 450] as const;
const CELEBRATION_MS = [600, 1200] as const;

/**
 * Durée d'une animation en raccourci, en ms : son premier temps (`800ms`, `.25s`, ou un jeton `var(--dur-…)`
 * lu dans motion.css) ; NaN s'il n'y en a pas.
 */
function durationMs(animation: string): number {
  const root = declarationsOf(parseCssBlocks(readFileSync(MOTION_CSS, 'utf8')), ':root');
  const time = animation
    .split(/\s+/)
    .map((part) => root?.get(/^var\((--[\w-]+)\)$/.exec(part)?.[1] ?? '') ?? part)
    .find((part) => /^\d*\.?\d+m?s$/.test(part));
  if (time === undefined) return Number.NaN;
  return time.endsWith('ms') ? Number.parseFloat(time) : Number.parseFloat(time) * 1000;
}

/** La durée tombe dans la fourchette `[min, max]` de la spec. */
function expectWithin(animation: string, [min, max]: readonly [number, number], label: string) {
  const ms = durationMs(animation);
  expect(ms, `${label} : ${animation}`).toBeGreaterThanOrEqual(min);
  expect(ms, `${label} : ${animation}`).toBeLessThanOrEqual(max);
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
    const bar = container.querySelector('[data-xp]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect(bar?.getAttribute('data-xp')).toBe('0');
    // Rien d'autre dans la piste que le reflet : ni enfant de remplissage, ni largeur posée en ligne.
    expect(bar?.getAttribute('style')).toBeNull();
    expect(bar?.children).toHaveLength(1);
    const sweep = bar?.firstElementChild as HTMLElement;
    expect(sweep.tagName).toBe('SPAN');
    expect(sweep.getAttribute('style')).toBeNull();
    expect(sweep.childNodes).toHaveLength(0);
    expect(bar?.textContent).toBe('');
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

  it('barre d’XP : la feuille ne dessine aucun remplissage, le reflet repart hors de la piste', () => {
    // Ni ::before ni ::after sur la piste : une largeur y dessinerait une progression jamais faite.
    for (const block of blocks()) {
      expect(block.selector).not.toMatch(/\.xpBar\b[^,]*::?(before|after)\b/i);
    }
    // Au repos, le reflet attend hors de la piste rognée…
    expect(declarationsOf(blocks(), '.xpSweep')?.get('transform')).toBe('translateX(-100%)');
    // … et il y retourne après son passage : aucun remplissage d'animation (forwards, both) ne le garde en place.
    const sweepBlocks = blocks().filter((b) => /\.xpSweep\b/.test(b.selector));
    expect(sweepBlocks.length).toBeGreaterThan(0);
    for (const block of sweepBlocks) {
      const animation = (block.declarations.get('animation') ?? '').split(/[\s,]+/);
      const fillMode = (block.declarations.get('animation-fill-mode') ?? '').split(/[\s,]+/);
      for (const fill of ['forwards', 'both']) {
        expect(animation, `${block.selector} { animation }`).not.toContain(fill);
        expect(fillMode, `${block.selector} { animation-fill-mode }`).not.toContain(fill);
      }
    }
  });

  it('rang global, reflet de la barre d’XP et cascade des groupes : durées de la spec, courbe unique', () => {
    const animationOf = (selector: string) =>
      at(selector, null)
        .find((b) => b.declarations.has('animation'))
        ?.declarations.get('animation') ?? '';
    for (const selector of ['.heroBadge', '.xpSweep', '.muscle']) {
      expect(animationOf(selector), selector).toMatch(/var\(--ease\)/);
    }
    // Le rang E grandit avec l'entrée de l'écran : durée d'un changement d'écran.
    expectWithin(animationOf('.heroBadge'), SCREEN_MS, '.heroBadge');
    // Le reflet traverse la barre une fois (800 ms au prototype) : durée d'une célébration.
    expectWithin(animationOf('.xpSweep'), CELEBRATION_MS, '.xpSweep');
    // Chaque groupe surgit d'un petit ressort (250 ms au prototype) : durée d'un retour de geste.
    expectWithin(animationOf('.muscle'), GESTURE_MS, '.muscle');
  });

  it('mouvement réduit : ni balayage, ni croissance du rang, ni cascade des groupes (un fondu court, sans retard)', () => {
    const sweep = new Map(at('.xpSweep', REDUCE).flatMap((b) => [...b.declarations]));
    expect(sweep.get('animation')).toBe('none');
    for (const selector of ['.heroBadge', '.muscle']) {
      const reduced = new Map(at(selector, REDUCE).flatMap((b) => [...b.declarations]));
      expect(reduced.get('animation-name'), selector).toBe('fade');
      expect(reduced.get('animation-duration'), selector).toBe('var(--dur-fast)');
      expect(reduced.get('animation-delay'), selector).toBe('0ms');
    }
  });
});
