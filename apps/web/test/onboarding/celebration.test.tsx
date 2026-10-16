import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COACH_IDS, type CoachId } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coachText } from '../../src/features/coach/coach-lines';
import { awakeningQuests } from '../../src/features/onboarding/AwakeningQuests';
import { ReadyStep } from '../../src/features/onboarding/ReadyStep';
import type { AppDb } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import type { TrainingProfileView } from '../../src/repos';
import ui from '../../src/ui/ui.module.css';
import { settle } from '../support/auth';
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
const VOICE_CSS = resolve(import.meta.dirname, '../../src/ui/voice.module.css');

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
const IN_PROGRESS = "Quêtes d'éveil en cours. Ta progression commencera au rang E.";

describe('« Éveil terminé » (spec refonte §7, §10.1)', () => {
  it('fenêtre du Système « Éveil terminé. », quêtes 3/3 cochées en lecture seule, rang E', async () => {
    await openReady();
    // La fenêtre du Système elle-même (groupe nommé par son titre), pas un titre seul : étiquette, rang et
    // quêtes sont dedans.
    const win = await screen.findByRole('group', { name: 'Éveil terminé.' });
    expect(within(win).getByText('SYSTÈME')).toBeTruthy();
    expect(within(win).getByRole('heading', { name: 'Éveil terminé.' })).toBeTruthy();
    expect(within(win).getByRole('img', { name: 'Rang E' })).toBeTruthy();
    expect(
      within(win)
        .getAllByRole('checkbox')
        .map((c) => c.textContent),
    ).toEqual([...QUESTS]);
    await until(() => QUESTS.every(isDone));
    for (const name of QUESTS) expect(quest(name).getAttribute('aria-readonly')).toBe('true');
    expect(within(win).getByText("Quêtes d'éveil")).toBeTruthy();
    expect(within(win).getByText('3/3')).toBeTruthy();
    expect(within(win).getByText("Quêtes d'éveil remplies. Ta progression commence au rang E.")).toBeTruthy();
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

  it.each(COACH_IDS)(
    'mot de la fin du coach (%s) seulement à 3/3 : absent à 2/3, il arrive avec la dernière quête',
    async (coach) => {
      const { db } = await openReady({ coach, pullAgoMs: 25 * HOUR });
      const line = coachText(coach, 'ready', 'lea');
      await screen.findByRole('button', { name: 'Réessayer' });
      await until(() => isDone('Profil complété') && isDone('Lieu principal choisi'));
      expect(screen.getByText('2/3')).toBeTruthy();
      // Aucune fausse donnée : le coach ne valide pas un éveil encore en cours.
      expect(screen.queryByText(line)).toBeNull();
      expect(screen.queryByText("Message d'accueil")).toBeNull();
      // La synchro de « Réessayer » rapporte un pull frais : la dernière quête se coche, le coach parle.
      await setMeta(db, 'lastPullOkAt', new Date(DEFAULT_NOW - HOUR).toISOString());
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      await until(() => isDone('Prêt hors ligne'));
      expect(screen.getByText('3/3')).toBeTruthy();
      const bubble = (await screen.findByText(line)).closest('[data-mode]');
      expect(bubble?.textContent).toContain("Message d'accueil");
    },
  );

  it('pas encore prêt hors ligne : « Réessayer » prend toute la largeur de la carte sur téléphone', async () => {
    await openReady({ pullAgoMs: 25 * HOUR });
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    // Bouton pleine largeur de la boîte à outils sur téléphone (contraintes globales), borné au-delà de 600 px.
    expect(ui.block).toBeTruthy();
    expect(retry.classList.contains(ui.block as string)).toBe(true);
  });

  /** Écran « C'est prêt » seul, profil `fields`, prêt hors ligne, sans lieu principal. */
  async function openReadyAlone(fields: Parameters<typeof seedProfile>[1]) {
    const db = createTestLocalDb();
    const me = newcomer({ onboardingStep: 'health' });
    await seedProfile(db, fields);
    await seedReadiness(db, HOUR);
    await renderWithServices(<ReadyStep onBack={() => {}} onIncomplete={() => {}} />, { me, db });
    // Profil lu (le récapitulatif montre l'objectif), puis les autres lectures abouties : l'état vérifié est le
    // vrai, pas celui d'avant les lectures (tout non atteint).
    await screen.findByText('Prendre du muscle');
    await until(() => isDone('Prêt hors ligne'));
    await settle();
  }

  it('vrais états : sans lieu principal ni niveau, ces quêtes restent décochées', async () => {
    await openReadyAlone({ goal: 'muscle', experience: null, daysPerWeek: 3, sessionMinutes: 45 });
    expect(isDone('Profil complété')).toBe(false);
    expect(isDone('Lieu principal choisi')).toBe(false);
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText(IN_PROGRESS)).toBeTruthy();
  });

  it('vrais états, contre-épreuve : niveau donné, « Profil complété » cochée ; sans lieu principal, 2/3', async () => {
    await openReadyAlone({ goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
    expect(isDone('Profil complété')).toBe(true);
    expect(isDone('Lieu principal choisi')).toBe(false);
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText(IN_PROGRESS)).toBeTruthy();
  });

  it('mouvement réduit : « Commencer », la fenêtre, le rang et les quêtes sont là dès le premier rendu', async () => {
    // Aucun composant de l'écran ne lit la media query : ce réglage ne fait que planter le décor. Le mouvement
    // réduit lui-même (fondus courts, sans retard ni étincelles) est vérifié sur la feuille de style plus bas
    // (« mouvement de la célébration ») : happy-dom n'anime rien.
    reducedMotion();
    const me = newcomer({ onboardingStep: 'health' });
    const db = createTestLocalDb();
    await seedProfile(db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
    await seedPrimaryGym(db);
    await seedReadiness(db, HOUR);
    await renderWithServices(<ReadyStep onBack={() => {}} onIncomplete={() => {}} />, { me, db });
    // Premier rendu, avec son témoin : aucune lecture de la base n'a encore abouti (0/3, quêtes en cours,
    // « Commencer » pas encore actif), aucune minuterie n'a tourné. Tout est déjà là.
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.getByText(IN_PROGRESS)).toBeTruthy();
    expect(button('Commencer').disabled).toBe(true);
    expect(screen.getByRole('heading', { name: 'Éveil terminé.' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Rang E' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox').map((c) => c.textContent)).toEqual([...QUESTS]);
    await until(() => QUESTS.every(isDone));
  });
});

describe('awakeningQuests : vrais états seulement (spec refonte §10.2)', () => {
  /** Profil complet : coach, objectif, niveau et disponibilité donnés. */
  const COMPLETE: TrainingProfileView = {
    coach: 'skald',
    goal: 'muscle',
    experience: 'none',
    daysPerWeek: 3,
    sessionMinutes: 45,
    sportCode: null,
    sportOtherLabel: null,
    cautiousMode: false,
  };
  const REQUIRED = ['coach', 'goal', 'experience', 'daysPerWeek', 'sessionMinutes'] as const;
  const done = (s: Parameters<typeof awakeningQuests>[0]) =>
    Object.fromEntries(awakeningQuests(s).map((q) => [q.label, q.done]));
  const others = { hasPrimaryPlace: true, offlineReady: true };

  it('trois quêtes, dans l’ordre de la maquette', () => {
    expect(awakeningQuests({ profile: COMPLETE, ...others }).map((q) => q.label)).toEqual([...QUESTS]);
  });

  it.each<[string, TrainingProfileView | null | undefined]>([
    ['profil pas encore lu', undefined],
    ['aucun profil', null],
    ...REQUIRED.map((field): [string, TrainingProfileView] => [
      `${field} manquant`,
      { ...COMPLETE, [field]: null },
    ]),
  ])('%s : « Profil complété » non cochée, les autres suivent leur état', (_, profile) => {
    expect(done({ profile, ...others })).toEqual({
      'Profil complété': false,
      'Lieu principal choisi': true,
      'Prêt hors ligne': true,
    });
  });

  it('profil complet (sport et mode prudent facultatifs) : « Profil complété » cochée', () => {
    expect(done({ profile: COMPLETE, hasPrimaryPlace: false, offlineReady: false })).toEqual({
      'Profil complété': true,
      'Lieu principal choisi': false,
      'Prêt hors ligne': false,
    });
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('lieu principal %s, prêt hors ligne %s : chaque case suit son état', (hasPrimaryPlace, offlineReady) => {
    expect(done({ profile: COMPLETE, hasPrimaryPlace, offlineReady })).toEqual({
      'Profil complété': true,
      'Lieu principal choisi': hasPrimaryPlace,
      'Prêt hors ligne': offlineReady,
    });
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

/** Longueur en px (`-12px`, `0`) ; autre chose (pourcentage, mot) → NaN. */
const px = (token: string) => (/^-?\d*\.?\d+(px)?$/.test(token) ? Number.parseFloat(token) : Number.NaN);

/** Débord en px d'une ombre `x y [flou [étalement]] couleur, …`, de chaque côté : [haut, droite, bas, gauche]. */
function shadowReach(shadow: string): number[] {
  const reach = [0, 0, 0, 0];
  for (const layer of selectorList(shadow)) {
    const lengths: number[] = [];
    for (const token of layer.split(/\s+/)) {
      if (Number.isNaN(px(token))) break;
      lengths.push(px(token));
    }
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
    const out = [blur + spread - y, blur + spread + x, blur + spread + y, blur + spread - x];
    out.forEach((v, i) => {
      reach[i] = Math.max(reach[i] ?? 0, v);
    });
  }
  return reach;
}

/** `inset(-12px -18px -24px round …)` → [haut, droite, bas, gauche] en px (NaN pour un pourcentage). */
function insets(clip: string): number[] {
  const inner = /^inset\((.*)\)$/.exec(clip.trim())?.[1] ?? '';
  const [top = Number.NaN, right = top, bottom = top, left = right] = (inner.split(/\s+round\s+/)[0] ?? '')
    .trim()
    .split(/\s+/)
    .map(px);
  return [top, right, bottom, left];
}

/** Étapes (`0%`, `35%`, `100%`) d'un `@keyframes` de la feuille de l'onboarding, avec leurs déclarations. */
function keyframes(name: string): Map<string, Map<string, string>> {
  const css = readFileSync(ONBOARDING_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.indexOf(`@keyframes ${name} {`);
  if (at < 0) throw new Error(`@keyframes ${name} absent`);
  const open = css.indexOf('{', at);
  let close = open;
  for (let depth = 0; close < css.length; close++) {
    if (css[close] === '{') depth++;
    else if (css[close] === '}' && --depth === 0) break;
  }
  return new Map(parseCssBlocks(css.slice(open + 1, close)).map((b) => [b.selector, b.declarations]));
}

describe('mouvement de la célébration (onboarding.module.css)', () => {
  it('ordre du prototype : la fenêtre, le rang, les 3 quêtes une à une, le mot du coach, puis « Commencer »', () => {
    const all = blocks();
    /** Départ d'une animation : son `animation-delay`, sinon le second temps de son `animation`. */
    const start = (selector: string) => {
      const d = declarations(all, selector);
      const delay = d.get('animation-delay');
      return delay ? (times(delay)[0] ?? 0) : (times(d.get('animation') ?? '')[1] ?? 0);
    };
    const order = [
      '.celebration',
      '.rank',
      '.questCheck',
      '.questList > :nth-child(2) .questCheck',
      '.questList > :nth-child(3) .questCheck',
      '.coachLine',
      '.revealActions',
    ];
    const starts = order.map(start);
    for (let i = 1; i < order.length; i++) {
      expect(starts[i], `${order[i]} part après ${order[i - 1]}`).toBeGreaterThan(starts[i - 1] ?? 0);
    }
  });

  it('la fenêtre s’ouvre sans rogner l’ombre du panneau (clair, Carnet) : rien ne surgit à la fin', () => {
    const shadows = parseCssBlocks(readFileSync(VOICE_CSS, 'utf8'))
      .filter((b) => selectorList(b.selector).some((s) => s.endsWith('.panel')))
      .map((b) => b.declarations.get('box-shadow'))
      .filter((s): s is string => s !== undefined && s !== 'none');
    // L'ombre douce du clair et l'ombre d'encre du Carnet.
    expect(shadows).toHaveLength(2);
    const reach = shadows.map(shadowReach).reduce((a, b) => a.map((v, i) => Math.max(v, b[i] ?? 0)));
    const steps = keyframes('window-open');
    // Fenêtre ouverte : le découpage passe autour de l'ombre, de chaque côté.
    const open = insets(steps.get('100%')?.get('clip-path') ?? '');
    ['haut', 'droite', 'bas', 'gauche'].forEach((side, i) => {
      expect(-(open[i] ?? Number.NaN), `ouverte, ${side}`).toBeGreaterThanOrEqual(reach[i] ?? 0);
    });
    // Ligne déjà pleine largeur (35 %) : les côtés de l'ombre y sont aussi.
    const line = insets(steps.get('35%')?.get('clip-path') ?? '');
    expect(-(line[1] ?? Number.NaN), 'ligne, droite').toBeGreaterThanOrEqual(reach[1] ?? 0);
    expect(-(line[3] ?? Number.NaN), 'ligne, gauche').toBeGreaterThanOrEqual(reach[3] ?? 0);
  });

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
