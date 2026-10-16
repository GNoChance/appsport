import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COACH_IDS, type CoachId, type MeResponse } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coachLine } from '../../src/features/coach/coach-lines';
import type { AppDb } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import { reposFor } from '../../src/repos';
import { settle } from '../support/auth';
import { parseCssBlocks } from '../support/css-blocks';
import { createTestLocalDb } from '../support/local-db';
import { seedPrimaryGym, seedProfile } from '../support/onboarding';
import { DEFAULT_NOW, makeMe, renderApp } from '../support/render';
import { until } from '../support/wait';

// Accueil Rune (spec refonte §10.2, maquettes MixSombre / MixClair, prototype « Accueil ») : salutation selon
// l'heure de Paris, bulle du coach « Aujourd'hui », fenêtre « Quêtes d'éveil » aux vrais états, tuiles lieu
// principal et rythme, ligne objectif et niveau ; aucune fausse donnée.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const REDUCE = '(prefers-reduced-motion: reduce)';
const QUESTS = ['Profil complété', 'Lieu principal choisi', 'Prêt hors ligne'] as const;
const HOME_CSS = resolve(import.meta.dirname, '../../src/features/home/home.module.css');

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

interface HomeOptions {
  /** Horloge injectée (services.now) ; DEFAULT_NOW : 14 h à Paris. */
  now?: number;
  /** Coach du profil ; `null` : aucun profil d'entraînement dans le miroir. */
  coach?: CoachId | null;
  /** Lieu principal « Basic Fit » dans le miroir (vrai par défaut). */
  place?: boolean;
  /** Dernier pull réussi il y a… ; null : jamais (pas prêt hors ligne). */
  pullAgoMs?: number | null;
  me?: Partial<MeResponse>;
}

/** Profil complet (objectif, niveau, 3 séances de 45 min) du coach demandé, lieu principal, catalogue à jour. */
async function seedHome(db: AppDb, o: HomeOptions, now: number) {
  const coach = o.coach === undefined ? 'skald' : o.coach;
  if (coach !== null) {
    await seedProfile(db, { coach, goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
  }
  if (o.place !== false) await seedPrimaryGym(db);
  await setMeta(db, 'catalogVersion', 'cat-1');
  await setMeta(db, 'serverCatalogVersion', 'cat-1');
  const pullAgo = o.pullAgoMs === undefined ? HOUR : o.pullAgoMs;
  if (pullAgo !== null) await setMeta(db, 'lastPullOkAt', new Date(now - pullAgo).toISOString());
}

/** Accueil rendu dans l'appli entière (garde, coquille), avec son état local. */
async function openHome(o: HomeOptions = {}) {
  const db = createTestLocalDb();
  const now = o.now ?? DEFAULT_NOW;
  await seedHome(db, o, now);
  const rendered = await renderApp({ db, now, me: makeMe(o.me) });
  await screen.findByRole('heading', { level: 1 });
  // La pile des cartes n'entre qu'une fois les lectures locales faites (profil, lieux, voyant).
  await until(() => cardStack() !== null);
  return rendered;
}

/** Pile des cartes de l'accueil, en cascade (classe globale `.stagger`). */
const cardStack = () => document.querySelector('.stagger');

/** Lecture retenue jusqu'à `gate`, puis faite pour de bon. */
function heldUntil<T>(gate: Promise<void>, read: () => Promise<T>): () => Promise<T> {
  return async () => {
    await gate;
    return read();
  };
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const questsWindow = () => screen.getByRole('group', { name: 'Éveil terminé.' });
const quest = (name: string) => within(questsWindow()).getByRole('checkbox', { name });
const isDone = (name: string) => quest(name).getAttribute('aria-checked') === 'true';
/** Texte lu par un lecteur d'écran : ce qui est caché (`aria-hidden`) en moins. */
function spoken(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('salutation selon l’heure de Paris (bascule à 18 h)', () => {
  // Les tests tournent à New York : une heure locale ou UTC à la place de celle de Paris échoue ici.
  it.each([
    ['05:00 (heure d’été)', 'Bonjour, lea', '2026-10-06T03:00:00Z'],
    ['14:00 (heure d’été)', 'Bonjour, lea', '2026-10-06T12:00:00Z'],
    ['17:59 (heure d’été)', 'Bonjour, lea', '2026-10-06T15:59:00Z'],
    ['18:00 (heure d’été)', 'Bonsoir, lea', '2026-10-06T16:00:00Z'],
    ['00:30 (heure d’été)', 'Bonsoir, lea', '2026-10-06T22:30:00Z'],
    ['04:59 (heure d’été)', 'Bonsoir, lea', '2026-10-06T02:59:00Z'],
    ['17:59 (heure d’hiver)', 'Bonjour, lea', '2026-12-01T16:59:00Z'],
    ['18:00 (heure d’hiver)', 'Bonsoir, lea', '2026-12-01T17:00:00Z'],
    ['05:00 (heure d’hiver)', 'Bonjour, lea', '2026-12-01T04:00:00Z'],
  ])('%s à Paris : « %s »', async (_, expected, iso) => {
    await openHome({ now: Date.parse(iso) });
    expect(heading()).toBe(expected);
  });

  it('le pseudo tel quel', async () => {
    await openHome({ me: { username: 'Léa.M' } });
    expect(heading()).toBe('Bonjour, Léa.M');
  });
});

describe('bulle du coach « Aujourd’hui »', () => {
  it.each(COACH_IDS)(
    '%s : sa ligne du jour, pseudo et rythme remplacés, étiquetée « Aujourd’hui »',
    async (coach) => {
      await openHome({ coach });
      const line = coachLine(coach, 'daily', new Date(DEFAULT_NOW), 'lea', 3);
      expect(line).not.toMatch(/[{}]/);
      const bubble = (await screen.findByText(line)).closest('[data-mode]');
      expect(bubble).not.toBeNull();
      expect(bubble?.textContent).toContain(
        { ombre: "L'Ombre", skald: 'Le Skald', scribe: 'Le Scribe' }[coach],
      );
      expect(bubble?.textContent).toContain("Aujourd'hui");
      expect(bubble?.getAttribute('data-mode')).toBe('training');
    },
  );

  it('la ligne suit le jour de l’horloge injectée, et le rythme du profil y est écrit', async () => {
    const shown: string[] = [];
    for (let day = 0; day < 3; day++) {
      const now = DEFAULT_NOW + day * DAY;
      const { unmount } = await openHome({ coach: 'scribe', now });
      const line = coachLine('scribe', 'daily', new Date(now), 'lea', 3);
      await screen.findByText(line);
      shown.push(line);
      unmount();
    }
    // Trois jours, trois lignes : le jour vient de l'horloge injectée, pas de l'horloge du poste.
    expect(new Set(shown).size).toBe(3);
    expect(shown).toContain(
      'Profil complet, lieu noté, rythme de 3 séances par semaine. Le plan arrivera ici.',
    );
  });

  it('aucun coach connu (profil pas encore reçu) : pas de bulle', async () => {
    await openHome({ coach: null });
    // Lectures abouties (lieu lu, voyant calculé) : l'absence de bulle n'est pas celle d'avant les lectures.
    await until(() => isDone('Lieu principal choisi') && isDone('Prêt hors ligne'));
    await settle();
    expect(screen.queryByText("Aujourd'hui")).toBeNull();
    expect(document.querySelector('[data-mode]')).toBeNull();
  });
});

describe('fenêtre « Quêtes d’éveil » aux vrais états', () => {
  it('fenêtre du Système « Éveil terminé. », texte de l’accueil, 3 quêtes cochées à 3/3', async () => {
    await openHome();
    const win = questsWindow();
    expect(within(win).getByText('SYSTÈME')).toBeTruthy();
    expect(within(win).getByRole('heading', { level: 2, name: 'Éveil terminé.' })).toBeTruthy();
    expect(within(win).getByText('Tes programmes et tes séances arriveront ici.')).toBeTruthy();
    expect(within(win).getByText("Quêtes d'éveil")).toBeTruthy();
    expect(
      within(win)
        .getAllByRole('checkbox')
        .map((c) => c.textContent),
    ).toEqual([...QUESTS]);
    await until(() => QUESTS.every(isDone));
    for (const name of QUESTS) expect(quest(name).getAttribute('aria-readonly')).toBe('true');
    expect(within(win).getByText('3/3')).toBeTruthy();
  });

  it('pas prêt hors ligne (dernier pull il y a 25 h) : « Prêt hors ligne » décochée, 2/3', async () => {
    await openHome({ pullAgoMs: 25 * HOUR });
    await until(() => isDone('Profil complété') && isDone('Lieu principal choisi'));
    // Le voyant a rendu son verdict : la quête suit le même état, sans coche inventée.
    await until(() => screen.queryByTestId('offline-ready')?.getAttribute('data-state') === 'not-ready');
    expect(isDone('Prêt hors ligne')).toBe(false);
    expect(within(questsWindow()).getByText('2/3')).toBeTruthy();
  });

  it('sans lieu principal ni profil : ces quêtes restent décochées', async () => {
    await openHome({ coach: null, place: false });
    await until(() => isDone('Prêt hors ligne'));
    expect(isDone('Profil complété')).toBe(false);
    expect(isDone('Lieu principal choisi')).toBe(false);
    expect(within(questsWindow()).getByText('1/3')).toBeTruthy();
  });

  it('le voyant « Prêt hors ligne » reste affiché, au même état que la quête', async () => {
    await openHome();
    await until(() => screen.queryByTestId('offline-ready')?.getAttribute('data-state') === 'ready');
    expect(isDone('Prêt hors ligne')).toBe(true);
  });

  it('voyant pas prêt : « Réessayer » lance une synchro manuelle', async () => {
    const { sync, api } = await openHome({ pullAgoMs: null });
    api.on('GET', '/api/catalog', { status: 304 });
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await until(() => sync.triggers.includes('manual'));
  });
});

describe('tuiles et ligne objectif · niveau', () => {
  it('« Lieu principal » : le nom du lieu principal, vers sa fiche', async () => {
    await openHome();
    const tile = await screen.findByRole('link', { name: /^Lieu principal/ });
    expect(spoken(tile)).toBe('Lieu principal Basic Fit');
    expect(tile.getAttribute('href')).toBe('/places/p-1');
  });

  it('« Rythme » : daysPerWeek du profil, lu « 3 séances par semaine »', async () => {
    await openHome();
    const tile = await screen.findByRole('link', { name: /^Rythme/ });
    expect(spoken(tile)).toBe('Rythme 3 séances par semaine');
    // À l'écran : le chiffre en grand, « séances / sem. » à côté (maquette).
    expect(tile.textContent).toContain('séances / sem.');
    expect(tile.getAttribute('href')).toBe('/profile');
  });

  it('« Objectif · niveau » : les libellés du profil, avec chevron, vers le profil', async () => {
    await openHome();
    const row = await screen.findByRole('link', { name: /^Objectif · niveau/ });
    expect(spoken(row)).toBe('Objectif · niveau Prendre du muscle · Jamais');
    expect(row.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(row.getAttribute('href')).toBe('/profile');
  });

  it('aucune fausse donnée : sans profil ni lieu, ni tuile, ni ligne, ni bulle', async () => {
    await openHome({ coach: null, place: false });
    await until(() => isDone('Prêt hors ligne'));
    await settle();
    expect(screen.queryByText('Lieu principal')).toBeNull();
    expect(screen.queryByText('Rythme')).toBeNull();
    expect(screen.queryByText('Objectif · niveau')).toBeNull();
    expect(screen.queryByText("Aujourd'hui")).toBeNull();
  });

  it('mouvement réduit : le rythme est à sa valeur finale dès son premier rendu', async () => {
    reducedMotion();
    // Aucune image d'animation ne passe : sans mouvement réduit, le compteur resterait à 0.
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    await openHome();
    const tile = await screen.findByRole('link', { name: /^Rythme/ });
    const digits = [...tile.querySelectorAll('span[aria-hidden="true"]')]
      .map((s) => s.textContent ?? '')
      .filter((t) => /^\d+$/.test(t));
    expect(digits).toEqual(['3']);
  });

  it('ordre de la maquette : titre, bulle, fenêtre du Système, tuiles, ligne objectif · niveau', async () => {
    await openHome();
    const line = coachLine('skald', 'daily', new Date(DEFAULT_NOW), 'lea', 3);
    const order = [
      screen.getByRole('heading', { level: 1 }),
      await screen.findByText(line),
      questsWindow(),
      await screen.findByRole('link', { name: /^Lieu principal/ }),
      await screen.findByRole('link', { name: /^Rythme/ }),
      await screen.findByRole('link', { name: /^Objectif · niveau/ }),
    ];
    for (let i = 1; i < order.length; i++) {
      const previous = order[i - 1] as Element;
      const next = order[i] as Element;
      expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('entrée des cartes en cascade, une fois les lectures locales faites', () => {
  // Spec refonte §7 (« les cartes entrent en cascade ») et §10.2 (vrais états) : tant que le profil, les lieux
  // ou le voyant n'ont pas répondu, la pile n'est pas rendue ; elle entre ensuite d'un bloc, dans l'ordre de la
  // cascade, quêtes déjà à leurs vrais états. Sinon la fenêtre entrerait seule à 0/3, la bulle s'insérerait
  // devant elle (et décalerait son retard de cascade), et le voyant surgirait hors de la cascade.
  it.each(['profil', 'lieux', 'voyant'] as const)(
    '%s pas encore lu : ni bulle, ni fenêtre, ni tuile, ni voyant ; puis tout entre ensemble',
    async (pending) => {
      const db = createTestLocalDb();
      await seedHome(db, {}, DEFAULT_NOW);
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { services } = await renderApp({ db, me: makeMe() });
      // L'accueil n'est pas encore monté (la garde attend sa lecture de `meta.me`) : la lecture retenue est la
      // sienne. Si elle lui échappait, la pile paraîtrait avant `release` et le test échouerait.
      const repos = reposFor(services);
      const readProfile = repos.profile.get;
      const readPlaces = repos.places.list;
      const readSw = services.swStatus;
      const held = {
        profil: () => vi.spyOn(repos.profile, 'get').mockImplementation(heldUntil(gate, readProfile)),
        lieux: () => vi.spyOn(repos.places, 'list').mockImplementation(heldUntil(gate, readPlaces)),
        voyant: () => vi.spyOn(services, 'swStatus').mockImplementation(heldUntil(gate, readSw)),
      }[pending]();
      await screen.findByRole('heading', { level: 1, name: 'Bonjour, lea' });
      await until(() => held.mock.calls.length > 0);
      await settle();

      expect(cardStack()).toBeNull();
      expect(document.querySelector('[data-mode]')).toBeNull();
      expect(screen.queryByText('SYSTÈME')).toBeNull();
      expect(screen.queryByText("Quêtes d'éveil")).toBeNull();
      expect(screen.queryByRole('link', { name: /^Lieu principal/ })).toBeNull();
      expect(screen.queryByTestId('offline-ready')).toBeNull();

      release();
      await until(() => cardStack() !== null);
      // Même rendu : la bulle d'abord, puis la fenêtre déjà à 3/3, les tuiles, la ligne, et le voyant en dernier,
      // tous enfants de la cascade (chacun son retard, 60 ms après le précédent).
      const stack = cardStack() as Element;
      const children = [...stack.children];
      expect(children).toHaveLength(5);
      expect(children[0]?.getAttribute('data-mode')).toBe('training');
      expect(children[0]?.textContent).toContain("Aujourd'hui");
      expect(children[1]).toBe(questsWindow());
      expect(within(questsWindow()).getByText('3/3')).toBeTruthy();
      expect(QUESTS.every(isDone)).toBe(true);
      expect(children[2]?.querySelector('a[href="/places/p-1"]')).not.toBeNull();
      expect(children[3]?.getAttribute('href')).toBe('/profile');
      expect(children[4]?.querySelector('[data-testid="offline-ready"]')).not.toBeNull();
    },
  );
});

describe('bandeaux existants, mêmes conditions et mêmes textes', () => {
  const REMINDER = 'Pense à changer ton mot de passe (rappel annuel).';
  const NOTICE = "Tu as 18 ans : tu peux désormais choisir l'objectif « Perdre du gras » dans ton profil.";

  it('rappel annuel du mot de passe et message des 18 ans affichés quand ils s’appliquent', async () => {
    const db = createTestLocalDb();
    await seedHome(db, {}, DEFAULT_NOW);
    await setMeta(db, 'lastAgeBand', 'minor');
    await renderApp({ db, me: makeMe({ passwordReminderDue: true }) });
    const reminder = await screen.findByText(REMINDER);
    expect(reminder.closest('[role="status"]')).not.toBeNull();
    const notice = await screen.findByText(NOTICE);
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: "J'ai compris" })).toBeTruthy();
  });

  it('ni l’un ni l’autre quand ils ne s’appliquent pas', async () => {
    await openHome();
    await until(() => screen.queryByTestId('offline-ready') !== null);
    expect(screen.queryByText(REMINDER)).toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe('feuille de l’accueil (home.module.css)', () => {
  const css = () => readFileSync(HOME_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('couleurs prises dans les jetons : ni hexadécimal, ni rgb() en dur, hors ombres', () => {
    for (const block of parseCssBlocks(css())) {
      for (const [prop, value] of block.declarations) {
        if (prop === 'box-shadow') continue;
        expect(value, `${block.selector} { ${prop} }`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
      }
    }
  });

  it('cibles tactiles : tuiles et ligne d’au moins 44 px de haut', () => {
    const blocks = parseCssBlocks(css());
    for (const selector of ['.tile', '.row']) {
      const block = blocks.find(
        (b) =>
          b.media === null && b.selector.split(', ').includes(selector) && b.declarations.has('min-height'),
      );
      expect(block, selector).toBeTruthy();
      const minHeight = block?.declarations.get('min-height') ?? '';
      expect(Number.parseFloat(minHeight), `${selector} min-height`).toBeGreaterThanOrEqual(44);
    }
  });
});
