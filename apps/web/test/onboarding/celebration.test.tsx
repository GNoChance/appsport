import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COACH_IDS, type CoachId } from '@rune/contracts';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coachText } from '../../src/features/coach/coach-lines';
import { ReadyStep } from '../../src/features/onboarding/ReadyStep';
import type { AppDb } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import { type CssBlock, normalizeSelector, parseCssBlocks } from '../support/css-blocks';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import {
  button,
  currentStep,
  newcomer,
  seedPrimaryGym,
  seedProfile,
  serveProfile,
} from '../support/onboarding';
import { DEFAULT_NOW, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

// Écran « C'est prêt » en célébration « Éveil terminé » (spec refonte §7 et §10.1, maquette B08, prototype).

const HOUR = 3_600_000;
const REDUCE = '(prefers-reduced-motion: reduce)';
const QUESTS = ['Profil complété', 'Lieu principal choisi', 'Prêt hors ligne'] as const;
const ONBOARDING_CSS = resolve(import.meta.dirname, '../../src/features/onboarding/onboarding.module.css');

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

/** Catalogue à jour et dernier pull il y a `pullAgoMs` : prêt hors ligne à moins de 24 h (R-SYN-33). */
async function seedReadiness(db: AppDb, pullAgoMs: number) {
  await setMeta(db, 'catalogVersion', 'cat-1');
  await setMeta(db, 'serverCatalogVersion', 'cat-1');
  await setMeta(db, 'lastPullOkAt', new Date(DEFAULT_NOW - pullAgoMs).toISOString());
}

/** Onboarding repris à « C'est prêt » (santé validée), coach `coach`, dernier pull il y a `pullAgoMs`. */
async function openReady(o: { coach?: CoachId; pullAgoMs?: number } = {}) {
  const me = newcomer({ onboardingStep: 'health' });
  const db = createTestLocalDb();
  const api = createFakeApi().on('GET', '/api/catalog', { status: 304 });
  await seedProfile(db, {
    coach: o.coach ?? 'skald',
    goal: 'muscle',
    experience: 'none',
    daysPerWeek: 3,
    sessionMinutes: 45,
  });
  await seedPrimaryGym(db);
  await seedReadiness(db, o.pullAgoMs ?? HOUR);
  serveProfile(api, db, me);
  const rendered = await renderApp({ path: '/onboarding', me, db, api });
  await until(() => currentStep() === 'ready');
  return rendered;
}

const quest = (name: string) => screen.getByRole('checkbox', { name });
const isDone = (name: string) => quest(name).getAttribute('aria-checked') === 'true';

describe('« Éveil terminé » (spec refonte §7, §10.1)', () => {
  it('fenêtre du Système « Éveil terminé. », quêtes 3/3 cochées en lecture seule, rang E', async () => {
    await openReady();
    expect(await screen.findByRole('heading', { name: 'Éveil terminé.' })).toBeTruthy();
    await until(() => QUESTS.every(isDone));
    for (const name of QUESTS) expect(quest(name).getAttribute('aria-readonly')).toBe('true');
    expect(screen.getByText("Quêtes d'éveil")).toBeTruthy();
    expect(screen.getByText('3/3')).toBeTruthy();
    expect(screen.getByText("Quêtes d'éveil remplies. Ta progression commence au rang E.")).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Rang E' })).toBeTruthy();
    await until(() => !button('Commencer').disabled);
  });

  it.each(COACH_IDS)('bulle du coach choisi (%s) : son mot de la fin, pseudo remplacé', async (coach) => {
    await openReady({ coach });
    const line = coachText(coach, 'ready', 'lea');
    const text = await screen.findByText(line);
    const bubble = text.closest('[data-mode]');
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toContain(
      { ombre: "L'Ombre", skald: 'Le Skald', scribe: 'Le Scribe' }[coach],
    );
    expect(bubble?.textContent).toContain("Message d'accueil");
    expect(line).not.toContain('{pseudo}');
  });

  it('prêt hors ligne non atteint (dernier pull il y a 25 h) : 2/3, sa case non cochée, « Commencer » désactivé', async () => {
    await openReady({ pullAgoMs: 25 * HOUR });
    // « Réessayer » n'apparaît qu'une fois l'état calculé, et seulement s'il n'est pas prêt.
    await screen.findByRole('button', { name: 'Réessayer' });
    await until(() => isDone('Profil complété') && isDone('Lieu principal choisi'));
    expect(isDone('Prêt hors ligne')).toBe(false);
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.queryByText('3/3')).toBeNull();
    expect(screen.queryByText("Quêtes d'éveil remplies. Ta progression commence au rang E.")).toBeNull();
    expect(button('Commencer').disabled).toBe(true);
  });

  it('vrais états : sans lieu principal ni niveau, ces quêtes restent décochées', async () => {
    const db = createTestLocalDb();
    const me = newcomer({ onboardingStep: 'health' });
    await seedProfile(db, { goal: 'muscle', experience: null, daysPerWeek: 3, sessionMinutes: 45 });
    await seedReadiness(db, HOUR);
    await renderWithServices(<ReadyStep onBack={() => {}} onIncomplete={() => {}} />, { me, db });
    await until(() => isDone('Prêt hors ligne'));
    expect(isDone('Profil complété')).toBe(false);
    expect(isDone('Lieu principal choisi')).toBe(false);
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('mouvement réduit : « Commencer », la fenêtre, le rang et les quêtes sont là dès le premier rendu', async () => {
    reducedMotion();
    const me = newcomer({ onboardingStep: 'health' });
    const db = createTestLocalDb();
    await seedProfile(db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
    await seedPrimaryGym(db);
    await seedReadiness(db, HOUR);
    await renderWithServices(<ReadyStep onBack={() => {}} onIncomplete={() => {}} />, { me, db });
    // Premier rendu : aucune lecture de la base n'a encore abouti, aucune minuterie n'a tourné.
    expect(button('Commencer')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Éveil terminé.' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Rang E' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox').map((c) => c.textContent)).toEqual([...QUESTS]);
    await until(() => QUESTS.every(isDone));
  });
});

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

const blocks = () => parseCssBlocks(readFileSync(ONBOARDING_CSS, 'utf8'));

/** Déclarations fusionnées d'un sélecteur dans ce contexte, dans l'ordre du fichier. */
const declarations = (all: readonly CssBlock[], selector: string, media: string | null = null) =>
  new Map(
    all
      .filter((b) => b.media === media && selectorList(b.selector).includes(normalizeSelector(selector)))
      .flatMap((b) => [...b.declarations]),
  );

/** Durées en ms d'une valeur (`600ms`, `1.2s`) ; `var(--dur-celebrate)` vaut 900 ms (motion.css). */
const times = (value: string) =>
  [...value.replaceAll('var(--dur-celebrate)', '900ms').matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)].map(
    ([, n, unit]) => Number(n) * (unit === 's' ? 1000 : 1),
  );

/** Sélecteurs de la célébration, chacun animé (fenêtre, rang, étincelles, quêtes, coach, « Commencer »). */
const CELEBRATION = [
  '.celebration',
  '.rank',
  '.spark',
  '.questsFill',
  '.questCheck',
  '.coachLine',
  '.revealActions',
];

const NTH_CHILD = /:nth-child\(\d+\)/g;

/**
 * Sélecteurs hors media query qui animent un élément de la célébration ou décalent son départ (une quête après
 * l'autre), avec leurs déclarations.
 */
const animatedRules = (all: readonly CssBlock[]) =>
  all
    .filter((b) => b.media === null && !b.selector.startsWith('@'))
    .filter((b) => b.declarations.has('animation') || b.declarations.has('animation-delay'))
    .flatMap((b) => selectorList(b.selector).map((selector) => ({ selector, d: b.declarations })))
    .filter((r) => CELEBRATION.some((c) => r.selector.endsWith(c)));

describe('mouvement de la célébration (onboarding.module.css)', () => {
  it('600 à 1 200 ms sur la courbe unique, finie à 1 200 ms', () => {
    const all = blocks();
    const durations = new Map<string, number>();
    for (const selector of CELEBRATION) {
      const animation = declarations(all, selector).get('animation') ?? '';
      expect(animation, `${selector} : animation`).not.toBe('');
      expect(animation, `${selector} : courbe`).toContain('var(--ease)');
      const [duration = 0] = times(animation);
      expect(duration, `${selector} : durée`).toBeGreaterThanOrEqual(600);
      expect(duration, `${selector} : durée`).toBeLessThanOrEqual(1200);
      durations.set(selector, duration);
    }
    for (const { selector, d } of animatedRules(all)) {
      const base = CELEBRATION.find((c) => selector.endsWith(c)) ?? '';
      const own = d.get('animation');
      const delay = d.has('animation-delay')
        ? (times(d.get('animation-delay') ?? '')[0] ?? 0)
        : own
          ? (times(own)[1] ?? 0)
          : 0;
      const duration = own ? (times(own)[0] ?? 0) : (durations.get(base) ?? 0);
      expect(delay + duration, `${selector} : fin`).toBeLessThanOrEqual(1200);
    }
  });

  it('mouvement réduit : fondus courts sans retard (décalages compris), pas d’étincelles', () => {
    const all = blocks();
    const selectors = new Set([...CELEBRATION, ...animatedRules(all).map((r) => r.selector)]);
    for (const selector of selectors) {
      const reduced = declarations(all, selector.replace(NTH_CHILD, ':nth-child(n)'), REDUCE);
      if (reduced.get('animation') === 'none' || reduced.get('display') === 'none') continue;
      expect(reduced.get('animation-delay'), `${selector} : retard`).toBe('0ms');
      expect(reduced.get('animation-duration'), `${selector} : durée`).toBe('var(--dur-fast)');
    }
    const spark = declarations(all, '.spark', REDUCE);
    expect(spark.get('display') === 'none' || spark.get('animation') === 'none').toBe(true);
  });
});
