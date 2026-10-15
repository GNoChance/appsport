import { COACH_IDS, type CoachId } from '@rune/contracts';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoachIntro } from '../../src/features/coach/CoachIntro';
import { COACHES, coachLine, coachText } from '../../src/features/coach/coach-lines';
import type { AppDb } from '../../src/local-db/db';
import { settle } from '../support/auth';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import {
  button,
  choose,
  currentStep,
  isChecked,
  newcomer,
  PROFILE_PATH,
  radio,
  seedPrimaryGym,
  seedProfile,
  serveProfile,
  writes,
} from '../support/onboarding';
import { renderApp } from '../support/render';
import { until } from '../support/wait';

/** Textes de la spec refonte §8, mot pour mot (brief de la tâche 7), avant remplacement de {pseudo} et {jours}. */
const TEXTS: Record<
  CoachId,
  {
    name: string;
    temper: string;
    sample: string;
    intro: string;
    nutri: string;
    ready: string;
    daily: readonly string[];
  }
> = {
  ombre: {
    name: "L'Ombre",
    temper: 'Froid et laconique. Exigeant, jamais humiliant.',
    sample: 'Quête acceptée. Rang E. Montre-moi ta discipline.',
    intro:
      "Je suis L'Ombre. Je fixe tes quêtes, tu les accomplis. Le dialogue viendra plus tard : d'ici là, avance.",
    nutri: "Bois régulièrement. Après l'effort, un vrai repas. La récupération fait partie de la quête.",
    ready: 'Éveil validé. Rang E. Le reste se gagne en séance.',
    daily: [
      'Jour 1. Rang E. La discipline se prouve, elle ne se promet pas.',
      'Une quête attend. Ton rang aussi.',
      "Pas d'excuse aujourd'hui. Juste la suite.",
    ],
  },
  skald: {
    name: 'Le Skald',
    temper: 'Mentor chaleureux. Il raconte, il explique.',
    sample: 'Chaque saga commence par un premier pas, {pseudo}. Je serai là pour la raconter.',
    intro:
      "Je suis le Skald. Je raconterai ta saga, séance après séance, et je t'expliquerai chaque étape. Nos vraies conversations viendront plus tard : pour l'instant, je pose les premiers vers.",
    nutri: "À table aussi, la saga s'écrit, {pseudo}. Un vrai repas après ta séance t'aidera à récupérer.",
    ready: 'Le prologue est écrit, {pseudo}. La saga commence.',
    daily: [
      "Le premier chapitre de ta saga s'ouvre aujourd'hui, {pseudo}. Les grands récits commencent toujours ainsi.",
      'Chaque jour ajoute une ligne à ta saga.',
      'Les héros aussi ont commencé au rang E.',
    ],
  },
  scribe: {
    name: 'Le Scribe',
    temper: 'Calme et précis. Il aime les plans clairs et les bilans.',
    sample: "Trois séances par semaine : c'est un rythme tenable. Je note tout.",
    intro:
      "Je suis le Scribe. Je prépare un plan clair et je note chaque série pour faire le point avec toi. Nos échanges viendront plus tard : pour l'instant, je consigne.",
    nutri: 'Note du jour : bois régulièrement, et prévois un vrai repas après ta séance.',
    ready: 'Profil complet, lieu noté. Le plan arrivera ici.',
    daily: [
      'Profil complet, lieu noté, rythme de {jours} séances par semaine. Le plan arrivera ici.',
      'Point du jour : ton profil est à jour.',
      'Je consigne. Les premières séances arriveront bientôt.',
    ],
  },
};

/**
 * Éléments qui portent exactement `text` et qu'aucun ancêtre ne cache aux lecteurs d'écran (copie animée de la
 * bulle, texte de l'autre mode). Pas d'option `ignore` à sélecteur descendant : happy-dom garde en cache le
 * résultat de `matches` quand l'aria-hidden d'un ancêtre change.
 */
const readable = (text: string) =>
  screen.queryAllByText(text).filter((el) => el.closest('[aria-hidden="true"]') === null);
const REDUCE = '(prefers-reduced-motion: reduce)';

/** Réglages du téléphone simulés : les media queries listées répondent vrai, les autres faux. */
function phoneSettings(...matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Onboarding dans l'appli (garde comprise) ; `prepare` remplit la base avant le premier rendu. */
async function openFlow(me = newcomer(), prepare?: (db: AppDb) => Promise<void>) {
  const db = createTestLocalDb();
  const api = createFakeApi();
  const server = serveProfile(api, db, me);
  await prepare?.(db);
  const rendered = await renderApp({ path: '/onboarding', me, db, api });
  return { ...rendered, server };
}

/** Le titre de l'écran, nommé avec l'indicateur d'étape, a le focus. */
const hasFocus = (name: string) =>
  screen.queryByRole('heading', { level: 2, name }) === document.activeElement;

/** Textes qui décrivent un élément (aria-describedby), dans l'ordre. */
const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe('étape coach de l’onboarding (spec refonte §8, §10.1)', () => {
  it('« Choisis ton coach », étape 1 sur 9 : L’Ombre, Le Skald, Le Scribe, « Continuer » attend un choix', async () => {
    await openFlow();
    await until(() => currentStep() === 'coach');
    await screen.findByRole('heading', { level: 2, name: 'Étape 1 sur 9 Choisis ton coach' });
    expect(screen.getByText('Étape 1 sur 9')).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
      'ombre',
      'skald',
      'scribe',
    ]);
    for (const name of ["L'Ombre", 'Le Skald', 'Le Scribe']) expect(radio(name).checked).toBe(false);
    // Chaque carte est décrite par le tempérament et l'aperçu du coach, {pseudo} remplacé.
    expect(described(radio('Le Skald'))).toBe(
      'Mentor chaleureux. Il raconte, il explique. « Chaque saga commence par un premier pas, lea. Je serai là pour la raconter. »',
    );
    expect(screen.getByText('Tu pourras changer de coach plus tard dans ton profil.')).toBeTruthy();
    expect(button('Continuer').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
    choose('Le Skald');
    expect(isChecked('Le Skald')).toBe(true);
    expect(button('Continuer').disabled).toBe(false);
  });

  it('« Le Skald » puis « Continuer » : setCoach, présentation, « C’est parti » mène à l’objectif (2 sur 9)', async () => {
    const t = await openFlow();
    await until(() => currentStep() === 'coach');
    await screen.findByRole('radio', { name: 'Le Skald' });
    choose('Le Skald');
    expect(t.server.patches).toEqual([]);
    fireEvent.click(button('Continuer'));
    await screen.findByRole('button', { name: "C'est parti" });
    expect(t.server.patches).toEqual([{ coach: 'skald' }]);
    expect(currentStep()).toBe('coach');
    // Présentation : le nom du coach prend le focus, toujours à l'étape 1 sur 9.
    await until(() => hasFocus('Étape 1 sur 9 Le Skald'));
    expect(screen.getByText("Message d'accueil")).toBeTruthy();
    expect(readable(COACHES.skald.intro)).toHaveLength(1);
    expect(screen.queryByText(/en train d'écrire/i)).toBeNull();
    expect(screen.getByRole('group', { name: 'Mode du coach' })).toBeTruthy();

    fireEvent.click(button("C'est parti"));
    await until(() => currentStep() === 'goal');
    expect(screen.getByText('Étape 2 sur 9')).toBeTruthy();
    await until(() => hasFocus('Étape 2 sur 9 Objectif'));
    expect(t.server.patches).toEqual([{ coach: 'skald' }]);
  });

  it('présentation : « Retour » revient au choix, le coach toujours coché', async () => {
    await openFlow();
    await until(() => currentStep() === 'coach');
    await screen.findByRole('radio', { name: 'Le Scribe' });
    choose('Le Scribe');
    fireEvent.click(button('Continuer'));
    await screen.findByRole('button', { name: "C'est parti" });
    fireEvent.click(button('Retour'));
    await until(() => hasFocus('Étape 1 sur 9 Choisis ton coach'));
    await until(() => isChecked('Le Scribe'));
  });

  it('« Retour » depuis l’objectif : le coach enregistré est coché, « Continuer » sans changement ne renvoie rien', async () => {
    const t = await openFlow();
    await until(() => currentStep() === 'coach');
    await screen.findByRole('radio', { name: "L'Ombre" });
    choose("L'Ombre");
    fireEvent.click(button('Continuer'));
    fireEvent.click(await screen.findByRole('button', { name: "C'est parti" }));
    await until(() => currentStep() === 'goal');
    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }));
    await until(() => currentStep() === 'coach');
    await until(() => isChecked("L'Ombre"));
    fireEvent.click(button('Continuer'));
    fireEvent.click(await screen.findByRole('button', { name: "C'est parti" }));
    await until(() => currentStep() === 'goal');
    expect(writes(t.api)).toEqual(['PATCH /api/me/training-profile']);
  });

  it('hors ligne : « Nécessite le réseau », on reste sur le choix sans coach enregistré', async () => {
    const t = await openFlow();
    await until(() => currentStep() === 'coach');
    await screen.findByRole('radio', { name: "L'Ombre" });
    t.api.setOffline('reject');
    choose("L'Ombre");
    fireEvent.click(button('Continuer'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(currentStep()).toBe('coach');
    expect(screen.queryByRole('button', { name: "C'est parti" })).toBeNull();
    expect(isChecked("L'Ombre")).toBe(true);
    expect(t.server.patches).toEqual([]);
  });

  it('erreur du serveur : le message, on reste sur le choix', async () => {
    const t = await openFlow();
    t.api.on('PATCH', PROFILE_PATH, { status: 500, body: { error: 'internal' } });
    await until(() => currentStep() === 'coach');
    await screen.findByRole('radio', { name: 'Le Scribe' });
    choose('Le Scribe');
    fireEvent.click(button('Continuer'));
    expect((await screen.findByRole('alert')).textContent).toBe('Le serveur a rencontré une erreur.');
    expect(currentStep()).toBe('coach');
    expect(screen.queryByRole('button', { name: "C'est parti" })).toBeNull();
  });

  it('reprise sans coach : l’étape coach d’abord, puis l’écran enregistré (disponibilité, 7 sur 9)', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'availability' }), async (db) => {
      await seedProfile(db, { coach: null, goal: 'muscle', experience: 'none' });
      await seedPrimaryGym(db);
    });
    await until(() => currentStep() === 'coach');
    expect(screen.getByText('Étape 1 sur 9')).toBeTruthy();
    await screen.findByRole('radio', { name: 'Le Scribe' });
    choose('Le Scribe');
    fireEvent.click(button('Continuer'));
    fireEvent.click(await screen.findByRole('button', { name: "C'est parti" }));
    await until(() => currentStep() === 'availability');
    expect(screen.getByText('Étape 7 sur 9')).toBeTruthy();
    expect(t.server.patches).toEqual([{ coach: 'scribe' }]);
  });

  it('reprise avec un coach : inchangée, directement à l’écran enregistré', async () => {
    await openFlow(newcomer({ onboardingStep: 'availability' }), async (db) => {
      await seedProfile(db, { coach: 'ombre', goal: 'muscle', experience: 'none' });
      await seedPrimaryGym(db);
    });
    await until(() => currentStep() === 'availability');
    expect(screen.getByText('Étape 7 sur 9')).toBeTruthy();
  });

  it('un coach choisi sur la carte : une synchro qui arrive ne déplace plus l’écran', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'goal' }));
    await until(() => currentStep() === 'coach');
    await screen.findByRole('radio', { name: 'Le Skald' });
    choose('Le Skald');
    // Un autre appareil avait déjà choisi un coach : la synchro l'apporte après le geste.
    await seedProfile(t.db, { coach: 'ombre', goal: 'muscle' });
    t.sync.set({ lastPullOkAt: '2026-10-06T12:00:00.000Z' });
    await settle();
    expect(currentStep()).toBe('coach');
    expect(isChecked('Le Skald')).toBe(true);
  });
});

/** Avance l'horloge simulée par pas de 50 ms jusqu'à `cond` ; rend le temps écoulé. */
function advanceUntil(cond: () => boolean, maxMs: number): number {
  let elapsed = 0;
  while (!cond()) {
    if (elapsed >= maxMs) throw new Error(`condition jamais remplie en ${maxMs} ms`);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    elapsed += 50;
  }
  return elapsed;
}

function renderIntro(coach: CoachId = 'skald') {
  const onBack = vi.fn();
  const onStart = vi.fn();
  const view = render(<CoachIntro coach={coach} pseudo="lea" onBack={onBack} onStart={onStart} />);
  return { ...view, onBack, onStart };
}

/** Copie animée du texte de la bulle (cachée aux lecteurs d'écran), absente une fois le texte entier. */
const typedCopy = (root: HTMLElement) => root.querySelector('[data-reveal]');
const pressed = (name: string) => button(name).getAttribute('aria-pressed');
const nutritionShown = () => screen.queryByText('Aperçu') !== null;

describe('présentation du coach (CoachIntro)', () => {
  it('texte entier lisible dès le départ, copie animée cachée qui se dévoile, jamais d’indicateur de frappe', () => {
    vi.useFakeTimers();
    phoneSettings();
    const { container } = renderIntro('skald');
    const full = COACHES.skald.intro;
    expect(readable(full)).toHaveLength(1);
    expect(screen.getByText("Message d'accueil")).toBeTruthy();
    expect(button("C'est parti")).toBeTruthy();
    const copy = typedCopy(container);
    expect(copy?.closest('[aria-hidden="true"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const partial = typedCopy(container)?.textContent ?? '';
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(full.length);
    expect(full.startsWith(partial)).toBe(true);
    expect(readable(full)).toHaveLength(1);
    expect(screen.queryByText(/écrire/i)).toBeNull();
    expect(container.querySelector('[data-typing], [aria-busy="true"]')).toBeNull();
    advanceUntil(() => typedCopy(container) === null, 15_000);
    expect(readable(full)).toHaveLength(1);
  });

  it('démonstration nutrition jouée une fois après le texte : ligne nutri, « Aperçu », puis retour', () => {
    vi.useFakeTimers();
    phoneSettings();
    const { container } = renderIntro('skald');
    advanceUntil(nutritionShown, 20_000);
    // La démonstration attend la fin du texte.
    expect(typedCopy(container)).toBeNull();
    expect(readable(coachText('skald', 'nutri', 'lea'))).toHaveLength(1);
    // Le texte de l'autre mode reste dans la bulle (même hauteur) mais sort de l'arbre d'accessibilité.
    expect(readable(COACHES.skald.intro)).toEqual([]);
    expect(screen.getByText('Le Skald · Nutrition')).toBeTruthy();
    expect(pressed('Nutrition')).toBe('true');
    expect(pressed('Entraînement')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe(
      `Mode nutrition. ${coachText('skald', 'nutri', 'lea')}`,
    );
    const shown = advanceUntil(() => !nutritionShown(), 10_000);
    expect(shown).toBeGreaterThanOrEqual(2000);
    expect(screen.getByText("Message d'accueil")).toBeTruthy();
    expect(readable(COACHES.skald.intro)).toHaveLength(1);
    expect(readable(coachText('skald', 'nutri', 'lea'))).toEqual([]);
    expect(pressed('Entraînement')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Mode entraînement.');
    // Une seule fois.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(nutritionShown()).toBe(false);
  });

  it('interrupteur « Entraînement / Nutrition » : rejoue la nutrition à la demande, sans retour automatique', () => {
    vi.useFakeTimers();
    phoneSettings();
    renderIntro('ombre');
    fireEvent.click(button('Nutrition'));
    expect(pressed('Nutrition')).toBe('true');
    expect(readable(COACHES.ombre.nutri)).toHaveLength(1);
    expect(screen.getByText('Aperçu')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(nutritionShown()).toBe(true);
    fireEvent.click(button('Entraînement'));
    expect(pressed('Entraînement')).toBe('true');
    expect(readable(COACHES.ombre.intro)).toHaveLength(1);
    expect(screen.getByText("Message d'accueil")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(nutritionShown()).toBe(false);
  });

  it('mouvement réduit : texte entier et « C’est parti » d’emblée, sans copie animée', () => {
    vi.useFakeTimers();
    phoneSettings(REDUCE);
    const { container, onStart, onBack } = renderIntro('scribe');
    expect(typedCopy(container)).toBeNull();
    expect(readable(COACHES.scribe.intro)).toHaveLength(1);
    fireEvent.click(button("C'est parti"));
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.click(button('Retour'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('textes des coachs (coach-lines)', () => {
  it('textes écrits à l’avance, mot pour mot', () => {
    expect(Object.keys(COACHES)).toEqual([...COACH_IDS]);
    for (const id of COACH_IDS) expect(COACHES[id]).toEqual(TEXTS[id]);
  });

  it('coachText remplace {pseudo}', () => {
    expect(coachText('skald', 'ready', 'lea')).toBe('Le prologue est écrit, lea. La saga commence.');
    expect(coachText('skald', 'sample', 'lea')).toBe(
      'Chaque saga commence par un premier pas, lea. Je serai là pour la raconter.',
    );
    expect(coachText('ombre', 'intro', 'lea')).toBe(TEXTS.ombre.intro);
  });

  it('ligne du jour : jour civil de Paris modulo 3, {pseudo} et {jours} remplacés', () => {
    // 2026-10-16 à Paris : jour 20742 depuis le 1970-01-01, 20742 % 3 = 0.
    const day16 = new Date('2026-10-16T10:00:00Z');
    expect(coachLine('scribe', 'daily', day16, 'lea', 3)).toBe(
      'Profil complet, lieu noté, rythme de 3 séances par semaine. Le plan arrivera ici.',
    );
    expect(coachLine('skald', 'daily', day16, 'lea', 3)).toBe(
      "Le premier chapitre de ta saga s'ouvre aujourd'hui, lea. Les grands récits commencent toujours ainsi.",
    );
    expect(coachLine('ombre', 'daily', new Date('2026-10-17T10:00:00Z'), 'lea', 3)).toBe(
      'Une quête attend. Ton rang aussi.',
    );
    expect(coachLine('ombre', 'daily', new Date('2026-10-18T10:00:00Z'), 'lea', 3)).toBe(
      "Pas d'excuse aujourd'hui. Juste la suite.",
    );
    expect(coachLine('ombre', 'daily', new Date('2026-10-19T10:00:00Z'), 'lea', 3)).toBe(
      TEXTS.ombre.daily[0],
    );
  });

  it('ligne du jour : jamais le jour UTC (minuit de Paris, heure d’été et d’hiver)', () => {
    // 2026-10-15 22:30 UTC = 2026-10-16 00:30 à Paris (UTC+2) : jour 0, pas le jour 2 du 15 en UTC.
    expect(coachLine('scribe', 'daily', new Date('2026-10-15T22:30:00Z'), 'lea', 4)).toBe(
      'Profil complet, lieu noté, rythme de 4 séances par semaine. Le plan arrivera ici.',
    );
    // 2026-10-16 21:59 UTC = 23:59 à Paris, encore le 16 ; 22:00 UTC = minuit, le 17.
    expect(coachLine('ombre', 'daily', new Date('2026-10-16T21:59:00Z'), 'lea', 3)).toBe(
      TEXTS.ombre.daily[0],
    );
    expect(coachLine('ombre', 'daily', new Date('2026-10-16T22:00:00Z'), 'lea', 3)).toBe(
      TEXTS.ombre.daily[1],
    );
    // 2026-12-31 23:30 UTC = 2027-01-01 00:30 à Paris (UTC+1) : jour 20819, 20819 % 3 = 2.
    expect(coachLine('ombre', 'daily', new Date('2026-12-31T23:30:00Z'), 'lea', 3)).toBe(
      TEXTS.ombre.daily[2],
    );
  });

  it('ligne du jour du Scribe sans rythme connu : la ligne suivante, jamais « {jours} » ni une valeur inventée', () => {
    expect(coachLine('scribe', 'daily', new Date('2026-10-16T10:00:00Z'), 'lea', null)).toBe(
      'Point du jour : ton profil est à jour.',
    );
  });

  it('garde-fous : aucun chiffre nutritionnel (kcal, g, kg, %) dans aucune ligne', () => {
    const lines = COACH_IDS.flatMap((id) => {
      const c = COACHES[id];
      return [c.temper, c.sample, c.intro, c.nutri, c.ready, ...c.daily].flatMap((text) =>
        [2, 3, 4].map((jours) => text.replaceAll('{pseudo}', 'lea').replaceAll('{jours}', String(jours))),
      );
    });
    const days = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2026, 9, 16 + i, 10)));
    lines.push(
      ...COACH_IDS.flatMap((id) =>
        days.flatMap((d) => [2, 3, 4].map((n) => coachLine(id, 'daily', d, 'lea', n))),
      ),
    );
    for (const line of lines) {
      expect(line).not.toMatch(/\d\s*(?:kcal|kg|g)\b|\d\s*%/i);
      expect(line).not.toMatch(/[{}]/);
      expect(line).not.toMatch(/[’‘]/);
    }
  });
});
