import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultLoadSettings, type GymDetail } from '@rune/contracts';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { App } from '../../src/App';
import { ServicesProvider } from '../../src/app-services';
import { type SwController, swControllerStore, type UpdateState } from '../../src/sw/register';
import type { ConnectionState } from '../../src/sync/engine';
import { BOOT_SPLASH_MAX_MS, BootSplash } from '../../src/ui/BootSplash';
import { ConnectionPill } from '../../src/ui/ConnectionPill';
import { SideNav } from '../../src/ui/SideNav';
import { screenTransition } from '../../src/ui/screen-transition';
import { activeTab, TAB_ITEMS, TabBar } from '../../src/ui/TabBar';
import ui from '../../src/ui/ui.module.css';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';
import { createFakeApi, createFakeSyncEngine } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { newcomer, seedPrimaryGym } from '../support/onboarding';
import { createTestServices, makeMe, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const DESKTOP = '(min-width: 900px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Feuille de la coquille, lue à plat (jetons, media queries d'un niveau). */
const shellCss = () =>
  parseCssBlocks(readFileSync(resolve(import.meta.dirname, '../../src/ui/shell.module.css'), 'utf8'));

/** Durée et délai d'une déclaration `animation` (dans cet ordre), en millisecondes. */
function animationTimes(animation: string | undefined): number[] {
  return [...(animation ?? '').matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)].map(
    ([, n, unit]) => Number(n) * (unit === 's' ? 1000 : 1),
  );
}

/** Réglages du téléphone simulés : les media queries listées répondent vrai, les autres faux. */
function media(...matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Comme `media`, mais le réglage change en cours de route : `set` prévient les écouteurs, comme le téléphone. */
function liveMedia(...matching: string[]) {
  const on = new Set(matching);
  const listeners = new Map<string, Set<() => void>>();
  const of = (query: string) => {
    const known = listeners.get(query);
    if (known) return known;
    const created = new Set<() => void>();
    listeners.set(query, created);
    return created;
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on.has(query),
    media: query,
    addEventListener: (_: string, fn: () => void) => of(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => of(query).delete(fn),
  }));
  return {
    set(query: string, value: boolean) {
      if (value) on.add(query);
      else on.delete(query);
      act(() => {
        for (const fn of of(query)) fn();
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  swControllerStore.set(null);
  sessionStorage.clear();
  window.scrollTo(0, 0);
});

/** Page défilée par la personne : position posée, puis l'événement `scroll` que le navigateur enverrait. */
function scrollPage(y: number) {
  act(() => {
    window.scrollTo(0, y);
    window.dispatchEvent(new Event('scroll'));
  });
}

/**
 * Espionne `Element.prototype.animate` et rend l'entrée jouée en dernier sur `<main>` : images clés et options
 * (spec refonte §7 : avant depuis la droite, retour depuis la gauche, onglet en fondu ; fondu seul sous
 * mouvement réduit).
 */
function spyEntrances() {
  const animate = vi.spyOn(Element.prototype, 'animate');
  return () => {
    const main = screen.getByRole('main');
    const i = animate.mock.contexts.lastIndexOf(main);
    const call = animate.mock.calls[i];
    return call ? { keyframes: call[0], options: call[1] } : null;
  };
}

/** Salle g-1 « Basic Fit » rendue par GET /api/gyms/:id (fiche minimale). */
const GYM_DETAIL: GymDetail = {
  id: 'g-1',
  name: 'Basic Fit',
  city: 'Lyon',
  loadSettings: defaultLoadSettings('gym'),
  deletedAt: null,
  equipment: [],
  canEdit: false,
  visibleMembers: [],
  history: [],
};

/**
 * L'appli entière, la main sur l'historique en mémoire : `go(to)` change d'adresse comme le bouton retour du
 * navigateur (ou du téléphone), sans lien ; `location()` est l'adresse affichée.
 */
async function renderAppWithHistory(opts: Parameters<typeof createTestServices>[0]) {
  const { services, memory } = await createTestServices(opts);
  const view = render(
    <Router hook={memory.hook} searchHook={memory.searchHook}>
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>
    </Router>,
  );
  return {
    ...view,
    location: () => memory.history.at(-1) ?? '',
    go: (to: string) => act(() => memory.navigate(to)),
  };
}

const mainNav = () => screen.getByRole('navigation', { name: 'Navigation principale' });
const tab = (name: string) => within(mainNav()).getByRole('link', { name });
/**
 * En-tête de l'accueil : celui de la pastille (les pages ont aussi leur `<header>`), une fois le rond de
 * l'initiale affiché (le compte est lu). Le rond est trouvé par sa destination : son nom est vérifié à part.
 */
const homeHeader = async () => {
  const header = (await screen.findByTestId('connection-status')).closest('header');
  if (!header) throw new Error('en-tête de l’accueil absent');
  await until(() => header.querySelector('a[href="/profile"]') !== null);
  return header;
};
const current = () =>
  within(mainNav())
    .queryAllByRole('link')
    .filter((a) => a.getAttribute('aria-current') === 'page')
    .map((a) => a.textContent);

describe('TAB_ITEMS', () => {
  it('Accueil, Progression, Salles, Profil, dans cet ordre', () => {
    expect(TAB_ITEMS).toEqual([
      { href: '/', label: 'Accueil' },
      { href: '/progression', label: 'Progression' },
      { href: '/places', label: 'Salles' },
      { href: '/profile', label: 'Profil' },
    ]);
  });
});

describe('activeTab : onglet actif selon le préfixe de l’adresse', () => {
  it.each([
    ['/', '/'],
    ['/progression', '/progression'],
    ['/places', '/places'],
    ['/places/p-1', '/places'],
    ['/places/', '/places'],
    ['/gyms/g-1', '/places'],
    ['/profile', '/profile'],
    ['/profile/health', '/profile'],
    ['/profile/privacy', '/profile'],
    ['/settings', '/profile'],
    ['/rejections', '/profile'],
    ['/admin/members', '/profile'],
    ['/Places/P-1', '/places'],
    ['/placesx', null],
    ['/profiles', null],
    ['/inconnu', null],
  ] as const)('%s → %s', (path, expected) => {
    expect(activeTab(path)).toBe(expected);
  });
});

describe('TabBar', () => {
  it('nav « Navigation principale », les 4 onglets en liens', async () => {
    await renderWithServices(<TabBar />, { path: '/' });
    const links = within(mainNav()).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Accueil', '/'],
      ['Progression', '/progression'],
      ['Salles', '/places'],
      ['Profil', '/profile'],
    ]);
  });

  it('sur /places/… l’onglet « Salles » porte aria-current="page", lui seul', async () => {
    await renderWithServices(<TabBar />, { path: '/places/p-1' });
    expect(current()).toEqual(['Salles']);
  });

  it('sur /profile/health c’est « Profil »', async () => {
    await renderWithServices(<TabBar />, { path: '/profile/health' });
    expect(current()).toEqual(['Profil']);
  });

  it('« Accueil » seulement sur / exactement', async () => {
    const first = await renderWithServices(<TabBar />, { path: '/' });
    expect(current()).toEqual(['Accueil']);
    first.unmount();
    await renderWithServices(<TabBar />, { path: '/inconnu' });
    expect(current()).toEqual([]);
  });

  it('suit la navigation : la pastille passe sur l’onglet touché', async () => {
    const view = await renderWithServices(<TabBar />, { path: '/' });
    const pill = view.container.querySelector('[data-tab-pill]');
    expect(pill?.getAttribute('data-index')).toBe('0');
    fireEvent.click(tab('Salles'));
    expect(view.location()).toBe('/places');
    expect(current()).toEqual(['Salles']);
    expect(pill?.getAttribute('data-index')).toBe('2');
  });

  it('sans onglet actif, la pastille est cachée', async () => {
    const view = await renderWithServices(<TabBar />, { path: '/inconnu' });
    expect(view.container.querySelector('[data-tab-pill]')?.hasAttribute('hidden')).toBe(true);
  });

  it('clavier : chaque onglet est un vrai lien, dans l’ordre, jamais retiré de la tabulation', async () => {
    await renderWithServices(<TabBar />, { path: '/places' });
    const links = within(mainNav()).getAllByRole('link');
    expect(links.map((a) => a.tagName)).toEqual(['A', 'A', 'A', 'A']);
    for (const a of links) {
      expect(a.hasAttribute('href')).toBe(true);
      expect(a.getAttribute('tabindex')).toBeNull();
    }
    const profile = tab('Profil');
    profile.focus();
    expect(document.activeElement).toBe(profile);
  });

  it('icônes décoratives : le nom de chaque onglet est son libellé', async () => {
    const view = await renderWithServices(<TabBar />, { path: '/' });
    for (const svg of view.container.querySelectorAll('svg'))
      expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

// scroll-padding-bottom (shell.module.css) suffit à la tabulation et à Chromium ; WebKit l'ignore pour focus()
// (retour au bouton d'origine, champ en erreur) et laisse le contrôle sous la barre (e2e/shell.spec.ts).
describe('TabBar : un contrôle qui prend le focus sous la barre défile au-dessus (WCAG 2.2, 2.4.11)', () => {
  afterEach(() => vi.restoreAllMocks());

  /** La barre, un bouton de la page et un bouton d'une feuille du bas ; leurs `scrollIntoView` espionnés. */
  async function setup() {
    await renderWithServices(
      <>
        <button type="button">Enregistrer</button>
        <div role="dialog" aria-label="Supprimer ?">
          <button type="button">Annuler</button>
        </div>
        <TabBar />
      </>,
      { path: '/' },
    );
    const scroll = vi.fn();
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    const cancel = screen.getByRole('button', { name: 'Annuler' });
    for (const el of [save, cancel, tab('Salles')]) el.scrollIntoView = scroll;
    /** Ce que touche le centre du contrôle : la barre, le contrôle lui-même, la feuille par-dessus… */
    const pointHits = (el: Element | null) => vi.spyOn(document, 'elementFromPoint').mockReturnValue(el);
    return { save, cancel, scroll, pointHits };
  }

  it('la barre recouvre le centre du contrôle : il défile au plus près, juste au-dessus d’elle', async () => {
    const { save, scroll, pointHits } = await setup();
    pointHits(tab('Salles'));
    act(() => save.focus());
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
  });

  it('contrôle visible (son centre le touche) ou hors de la fenêtre : rien ne défile', async () => {
    const { save, scroll, pointHits } = await setup();
    pointHits(save);
    act(() => save.focus());
    act(() => save.blur());
    pointHits(null);
    act(() => save.focus());
    expect(scroll).not.toHaveBeenCalled();
  });

  it('feuille du bas posée par-dessus la barre, ou onglet de la barre elle-même : rien ne défile', async () => {
    const { cancel, scroll, pointHits } = await setup();
    pointHits(cancel);
    act(() => cancel.focus());
    pointHits(tab('Salles'));
    act(() => tab('Salles').focus());
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe('SideNav (≥ 900 px)', () => {
  it('mêmes entrées, même onglet actif', async () => {
    await renderWithServices(<SideNav />, { path: '/gyms/g-1' });
    expect(
      within(mainNav())
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/', '/progression', '/places', '/profile']);
    expect(current()).toEqual(['Salles']);
  });
});

describe('ConnectionPill', () => {
  // Point vert seulement en ligne : jamais un point vert à côté de « Hors ligne ».
  it.each([
    ['online', 'En ligne', 'online'],
    ['offline', 'Hors ligne', 'muted'],
    ['unknown', 'Connexion…', 'muted'],
    ['unauthenticated', 'Session expirée', 'warning'],
    ['protocol_unsupported', 'Mise à jour nécessaire', 'warning'],
    ['account_deleted', 'Compte supprimé', 'warning'],
  ] as const)('%s → « %s », point %s', async (state: ConnectionState, label, tone) => {
    await renderWithServices(<ConnectionPill />, { sync: createFakeSyncEngine({ connection: state }) });
    const pill = screen.getByTestId('connection-status');
    expect(pill.getAttribute('data-state')).toBe(state);
    expect(pill.textContent).toBe(label);
    expect(pill.querySelector('[aria-hidden="true"]')?.getAttribute('data-tone')).toBe(tone);
  });

  it('couleur du point : vert (succès) en ligne, avertissement quand il faut agir, gris sinon', () => {
    const css = shellCss();
    expect(declarationsOf(css, '.pillDot')?.get('background')).toBe('var(--text-muted)');
    expect(declarationsOf(css, '.pillDot[data-tone="online"]')?.get('background')).toBe('var(--success)');
    expect(declarationsOf(css, '.pillDot[data-tone="warning"]')?.get('background')).toBe(
      'var(--warning-text)',
    );
    expect(declarationsOf(css, '.pillDot[data-tone="muted"]')).toBeNull();
  });

  it('hors ligne : « Hors ligne », jamais « En ligne », et suit le moteur sans rechargement', async () => {
    const { sync } = await renderWithServices(<ConnectionPill />, {
      sync: createFakeSyncEngine({ connection: 'offline' }),
    });
    expect(screen.getByTestId('connection-status').textContent).toBe('Hors ligne');
    expect(screen.queryByText('En ligne')).toBeNull();
    act(() => sync.set({ connection: 'online' }));
    expect(screen.getByTestId('connection-status').textContent).toBe('En ligne');
    act(() => sync.set({ connection: 'offline' }));
    expect(screen.getByTestId('connection-status').textContent).toBe('Hors ligne');
  });

  it('annoncée poliment (role="status"), le point est décoratif', async () => {
    await renderWithServices(<ConnectionPill />);
    const pill = screen.getByRole('status');
    expect(pill.textContent).toBe('En ligne');
    expect(pill.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('coquille', () => {
  it('en-tête de l’accueil : logo et RUNE vers l’accueil, pastille, rond de l’initiale vers /profile', async () => {
    media();
    await renderApp({ path: '/' });
    const header = await homeHeader();
    expect(within(header).getByRole('link', { name: 'Rune' }).getAttribute('href')).toBe('/');
    expect(within(header).getByTestId('connection-status').textContent).toBe('En ligne');
    const avatar = within(header).getByRole('link', { name: 'Profil' });
    expect(avatar.getAttribute('href')).toBe('/profile');
    expect(avatar.textContent).toBe('L');
  });

  it('un nom, une destination (WCAG 3.2.4) : le rond et l’onglet « Profil » mènent au Profil, pas de « Mon profil »', async () => {
    media();
    await renderApp({ path: '/' });
    const header = await homeHeader();
    // « Mon profil » est la ligne du hub qui mène à /profile/edit : le rond de l'accueil ne porte pas ce nom.
    expect(within(header).queryByRole('link', { name: 'Mon profil' })).toBeNull();
    const links = screen.getAllByRole('link', { name: 'Profil' });
    expect(links).toHaveLength(2);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/profile', '/profile']);
  });

  it("l'en-tête n'affiche plus « 0 en attente » ni les compteurs", async () => {
    media();
    await renderApp({ path: '/' });
    const header = await homeHeader();
    await screen.findByText('Bonjour lea');
    expect(header.textContent).not.toContain('en attente');
    expect(screen.queryByTestId('pending-counter')).toBeNull();
    expect(screen.queryByTestId('rejected-counter')).toBeNull();
  });

  it('connexion « offline » : la pastille dit « Hors ligne », jamais « En ligne »', async () => {
    media();
    await renderApp({ path: '/', sync: createFakeSyncEngine({ connection: 'offline' }) });
    const header = await homeHeader();
    expect(within(header).getByTestId('connection-status').textContent).toBe('Hors ligne');
    expect(screen.queryByText('En ligne')).toBeNull();
  });

  it('pages internes : pas d’en-tête de l’accueil, un Retour de 44 × 44 et le titre', async () => {
    media();
    await renderApp({ path: '/profile/health' });
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    // Ni pastille ni rond de l'initiale : seul l'onglet Profil porte ce nom.
    expect(screen.queryByTestId('connection-status')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Profil' }).filter((a) => !mainNav().contains(a))).toEqual([]);
    const back = screen.getByRole('link', { name: 'Retour' });
    expect(back.getAttribute('href')).toBe('/profile');
    // La taille d'une cible ne se lit que dans la feuille : la classe posée, puis sa règle.
    expect(ui.backButton).toBeTruthy();
    expect(back.classList.contains(ui.backButton as string)).toBe(true);
    const rule = declarationsOf(
      parseCssBlocks(readFileSync(resolve(import.meta.dirname, '../../src/ui/ui.module.css'), 'utf8')),
      '.backButton',
    );
    expect(rule?.get('width')).toBe('44px');
    expect(rule?.get('height')).toBe('44px');
  });

  // L'admin passe par Profil : ni onglet « Administration », ni aucun lien /admin, quel que soit son libellé.
  it.each([
    ['téléphone, barre d’onglets', [], 'tab-bar'],
    ['≥ 900 px, navigation latérale', [DESKTOP], 'side-nav'],
  ] as const)('admin, %s : les 4 onglets de TAB_ITEMS, aucun lien vers /admin', async (_, queries, nav) => {
    media(...queries);
    const view = await renderApp({ path: '/', me: makeMe({ role: 'admin' }) });
    await screen.findByText('Bonjour lea');
    expect(screen.getByTestId(nav)).toBeTruthy();
    const hrefs = within(mainNav())
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(TAB_ITEMS.map((t) => t.href));
    const toAdmin = (href: string | null) => href?.toLowerCase().startsWith('/admin') ?? false;
    expect(hrefs.filter(toAdmin)).toEqual([]);
    expect([...view.container.querySelectorAll('a')].filter((a) => toAdmin(a.getAttribute('href')))).toEqual(
      [],
    );
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });

  it('les pages /admin restent servies à un admin', async () => {
    media();
    await renderApp({ path: '/admin/members', me: makeMe({ role: 'admin' }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Membres' })).toBeTruthy();
    expect(current()).toEqual(['Profil']);
  });

  it('téléphone : barre d’onglets ; ≥ 900 px : navigation latérale, jamais les deux', async () => {
    media();
    const phone = await renderApp({ path: '/' });
    await screen.findByText('Bonjour lea');
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(1);
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
    expect(screen.queryByTestId('side-nav')).toBeNull();
    phone.unmount();
    media(DESKTOP);
    await renderApp({ path: '/' });
    await screen.findByText('Bonjour lea');
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(1);
    expect(screen.getByTestId('side-nav')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('≥ 900 px, accueil : la marque une seule fois (navigation latérale), l’en-tête garde pastille et initiale à droite', async () => {
    media(DESKTOP);
    await renderApp({ path: '/' });
    const header = await homeHeader();
    expect(screen.getAllByRole('link', { name: 'Rune' })).toHaveLength(1);
    expect(within(screen.getByTestId('side-nav')).getByRole('link', { name: 'Rune' })).toBeTruthy();
    expect(within(header).queryByRole('link', { name: 'Rune' })).toBeNull();
    expect(within(header).getByTestId('connection-status').textContent).toBe('En ligne');
    expect(within(header).getByRole('link', { name: 'Profil' }).getAttribute('href')).toBe('/profile');
    // Seuls à droite de l'en-tête, sans la marque pour les y pousser.
    expect(declarationsOf(shellCss(), '.headerEnd')?.get('margin-inline-start')).toBe('auto');
  });

  it('onboarding : ni barre d’onglets ni pastille', async () => {
    media();
    await renderApp({ path: '/onboarding', me: newcomer() });
    await screen.findByTestId('onboarding-step');
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    expect(screen.queryByTestId('connection-status')).toBeNull();
  });

  it('/progression : page provisoire, titre « Progression », onglet actif', async () => {
    media();
    await renderApp({ path: '/progression' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Progression' })).toBeTruthy();
    expect(current()).toEqual(['Progression']);
  });

  it('/places : la liste des lieux, onglet « Salles »', async () => {
    media();
    await renderApp({ path: '/places' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Lieux' })).toBeTruthy();
    expect(current()).toEqual(['Salles']);
  });

  it('/profile/places redirige vers /places', async () => {
    media();
    const view = await renderApp({ path: '/profile/places' });
    await until(() => view.location() === '/places');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lieux' })).toBeTruthy();
  });

  it('/profile/places/p-2 redirige vers /places/p-2, sans boucle', async () => {
    media();
    const view = await renderApp({ path: '/profile/places/p-2' });
    await until(() => view.location() === '/places/p-2');
    await screen.findByRole('heading', { level: 1 });
    expect(view.visits()).toEqual(['/profile/places/p-2', '/places/p-2']);
  });

  it('bandeau de mise à jour sous l’en-tête, avant le contenu', async () => {
    media();
    swControllerStore.set(fakeController({ available: true, forced: false }));
    await renderApp({ path: '/' });
    const banner = await screen.findByTestId('update-banner');
    const header = await homeHeader();
    const main = screen.getByRole('main');
    expect(header.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("changement d'écran : onglet en fondu, avant depuis la droite, retour depuis la gauche", async () => {
    media();
    const entrance = spyEntrances();
    const view = await renderApp({ path: '/' });
    await screen.findByText('Bonjour lea');
    const screenEl = () => view.container.querySelector('[data-screen-transition]');
    fireEvent.click(tab('Profil'));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(screenEl()?.getAttribute('data-screen-transition')).toBe('tab');
    expect(entrance()).toEqual({ keyframes: { opacity: [0, 1] }, options: { duration: 300, easing: EASE } });
    fireEvent.click(screen.getByRole('link', { name: 'Santé' }));
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    expect(screenEl()?.getAttribute('data-screen-transition')).toBe('forward');
    expect(entrance()).toEqual({
      keyframes: { opacity: [0, 1], transform: ['translateX(48px)', 'none'] },
      options: { duration: 380, easing: EASE },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Retour' }));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(screenEl()?.getAttribute('data-screen-transition')).toBe('back');
    expect(entrance()).toEqual({
      keyframes: { opacity: [0, 1], transform: ['translateX(-48px)', 'none'] },
      options: { duration: 380, easing: EASE },
    });
  });

  it('mouvement réduit : chaque changement d’écran est un fondu simple de 200 ms, sans balayage', async () => {
    media(REDUCED);
    const entrance = spyEntrances();
    await renderApp({ path: '/' });
    await screen.findByText('Bonjour lea');
    const fade = { keyframes: { opacity: [0, 1] }, options: { duration: 200, easing: EASE } };
    fireEvent.click(tab('Profil'));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(entrance()).toEqual(fade);
    fireEvent.click(screen.getByRole('link', { name: 'Santé' }));
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    expect(entrance()).toEqual(fade);
    fireEvent.click(screen.getByRole('link', { name: 'Retour' }));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(entrance()).toEqual(fade);
  });

  it('mouvement réduit : la pastille de la barre change d’onglet sans glisser', () => {
    expect(declarationsOf(shellCss(), '.tabPill', REDUCED)?.get('transition')).toBe('none');
  });

  it("changement d'écran : onglet et écran suivant repartent du haut, le retour retrouve la position quittée", async () => {
    media();
    await renderApp({ path: '/' });
    await screen.findByText('Bonjour lea');
    scrollPage(900);
    fireEvent.click(tab('Profil'));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(window.scrollY).toBe(0);
    scrollPage(420);
    fireEvent.click(screen.getByRole('link', { name: 'Santé' }));
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    expect(window.scrollY).toBe(0);
    scrollPage(150);
    fireEvent.click(screen.getByRole('link', { name: 'Retour' }));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(window.scrollY).toBe(420);
    // Revenu en haut par l'onglet, puis de nouveau en avant et en arrière : la position retrouvée est la
    // dernière quittée, pas une ancienne.
    fireEvent.click(tab('Accueil'));
    await screen.findByText('Bonjour lea');
    expect(window.scrollY).toBe(0);
    fireEvent.click(tab('Profil'));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    fireEvent.click(screen.getByRole('link', { name: 'Santé' }));
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    fireEvent.click(screen.getByRole('link', { name: 'Retour' }));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(window.scrollY).toBe(0);
  });

  it('Retour vers un écran qui n’est ni le parent ni le précédent : entrée par la gauche, pile suivie', async () => {
    media();
    const db = createTestLocalDb();
    await seedPrimaryGym(db);
    const api = createFakeApi();
    api.on('GET', '/api/gyms/:id', { status: 200, body: GYM_DETAIL });
    const view = await renderAppWithHistory({ path: '/places', db, api });
    const transition = () =>
      view.container.querySelector('[data-screen-transition]')?.getAttribute('data-screen-transition');
    fireEvent.click(await screen.findByRole('link', { name: 'Basic Fit' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Voir la salle' }));
    expect(view.location()).toBe('/gyms/g-1');
    expect(transition()).toBe('forward');
    // Retour du navigateur vers le lieu : l'écran d'avant dans la pile.
    view.go('/places/p-1');
    expect(transition()).toBe('back');
    fireEvent.click(await screen.findByRole('link', { name: 'Voir la salle' }));
    expect(transition()).toBe('forward');
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    // Retour de la salle vers la liste des lieux : ni son parent d'adresse, ni l'écran juste avant.
    fireEvent.click(screen.getByRole('link', { name: 'Retour' }));
    expect(view.location()).toBe('/places');
    expect(transition()).toBe('back');
    await screen.findByRole('heading', { level: 1, name: 'Lieux' });
    // Pile repartie de la liste : le lieu est de nouveau un écran suivant.
    fireEvent.click(await screen.findByRole('link', { name: 'Basic Fit' }));
    expect(transition()).toBe('forward');
  });
});

describe('screenTransition', () => {
  it.each([
    ['/', '/', [], 'none'],
    ['/', '/profile', ['/'], 'tab'],
    ['/places/p-1', '/profile', ['/places', '/places/p-1'], 'tab'],
    ['/profile', '/profile/health', ['/profile'], 'forward'],
    ['/places', '/places/p-1', ['/places'], 'forward'],
    ['/profile/health', '/profile', ['/profile', '/profile/health'], 'back'],
    // Retour du navigateur vers une page sœur visitée juste avant.
    ['/profile/privacy', '/profile/health', ['/profile/health', '/profile/privacy'], 'back'],
    ['/places/p-1', '/places', [], 'back'],
    ['/places/p-1', '/gyms/g-1', ['/places/p-1'], 'forward'],
    // Retour vers un écran déjà dans la pile, plus loin que le précédent.
    ['/gyms/g-1', '/places', ['/places', '/places/p-1', '/gyms/g-1'], 'back'],
    ['/admin/gyms', '/settings', ['/profile', '/settings', '/admin', '/admin/gyms'], 'back'],
    // Racine de l'onglet depuis un écran plus profond, sans historique (lien direct, rechargement).
    ['/settings', '/profile', ['/settings'], 'back'],
    ['/gyms/g-1', '/places', ['/gyms/g-1'], 'back'],
    // Un écran jamais visité, hors de l'adresse courante, reste un écran suivant.
    ['/gyms/g-1', '/places/p-1', ['/gyms/g-1'], 'forward'],
  ] as const)('%s → %s', (from, to, history, expected) => {
    expect(screenTransition(from, to, history)).toBe(expected);
  });
});

describe('BootSplash', () => {
  it('sous mouvement réduit, ne rend rien', () => {
    media(REDUCED);
    const { container } = render(<BootSplash />);
    expect(container.innerHTML).toBe('');
  });

  it('sinon : le logo se dessine par-dessus, décoratif et muet, puis se retire à la fin du voile seulement', () => {
    media();
    const { container } = render(<BootSplash />);
    const splash = container.firstElementChild as HTMLElement;
    expect(splash).not.toBeNull();
    expect(splash.getAttribute('aria-hidden')).toBe('true');
    expect(splash.getAttribute('data-testid')).toBe('boot-splash');
    expect(splash.querySelector('svg')).not.toBeNull();
    expect(splash.textContent).toBe('');
    // Le dessin du cadre finit avant l'effacement : son `animationend` remonte, le voile reste.
    const frame = splash.querySelector('path');
    if (!frame) throw new Error('cadre du logo absent');
    fireEvent.animationEnd(frame);
    expect(container.firstElementChild).toBe(splash);
    fireEvent.animationEnd(splash);
    expect(container.innerHTML).toBe('');
  });

  it('filet de sécurité : retiré au bout de 2 s même si la fin de son animation n’arrive jamais', () => {
    vi.useFakeTimers();
    try {
      media();
      const { container } = render(<BootSplash />);
      expect(container.firstElementChild).not.toBeNull();
      act(() => vi.advanceTimersByTime(BOOT_SPLASH_MAX_MS - 1));
      expect(container.firstElementChild).not.toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(container.innerHTML).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('voile : ne prend jamais le toucher, dessin en 1,2 s au plus, effacé avant le filet de sécurité', () => {
    expect(BOOT_SPLASH_MAX_MS).toBe(2000);
    const css = shellCss();
    const splash = declarationsOf(css, '.splash');
    expect(splash?.get('pointer-events')).toBe('none');
    expect(splash?.get('animation')).toMatch(/^splash-out\s.*\bforwards$/);
    const [outDuration = 0, outDelay = 0] = animationTimes(splash?.get('animation'));
    expect(outDuration).toBeGreaterThan(0);
    expect(outDelay + outDuration).toBeLessThan(BOOT_SPLASH_MAX_MS);
    const draw = declarationsOf(css, '.splashMark g > path:first-child')?.get('animation');
    expect(draw).toMatch(/^splash-draw\s/);
    const [drawDuration = 0, drawDelay = 0] = animationTimes(draw);
    expect(drawDelay + drawDuration).toBeLessThanOrEqual(1200);
    expect(outDelay).toBeGreaterThanOrEqual(drawDelay + drawDuration);
  });

  it('une seule fois par session : un second montage ne rend rien', () => {
    media();
    const first = render(<BootSplash />);
    const splash = first.container.firstElementChild;
    expect(splash).not.toBeNull();
    if (splash) fireEvent.animationEnd(splash);
    first.unmount();
    const { container } = render(<BootSplash />);
    expect(container.innerHTML).toBe('');
  });

  it('mouvement réduit coupé en cours de session : rien ne se joue par-dessus l’écran', () => {
    const phone = liveMedia(REDUCED);
    const { container } = render(<BootSplash />);
    expect(container.innerHTML).toBe('');
    phone.set(REDUCED, false);
    expect(container.innerHTML).toBe('');
  });

  it('premier montage sous mouvement réduit : la session est marquée, un montage plus tard sans lui ne rend rien', () => {
    media(REDUCED);
    render(<BootSplash />).unmount();
    media();
    const { container } = render(<BootSplash />);
    expect(container.innerHTML).toBe('');
  });

  it('mouvement réduit demandé pendant le dessin : retiré, et ne revient pas quand il est coupé', () => {
    const phone = liveMedia();
    const { container } = render(<BootSplash />);
    expect(container.firstElementChild).not.toBeNull();
    phone.set(REDUCED, true);
    expect(container.innerHTML).toBe('');
    phone.set(REDUCED, false);
    expect(container.innerHTML).toBe('');
  });
});

/** Contrôleur factice d'une version en attente (comme dans UpdateBanner.test.tsx). */
function fakeController(initial: Omit<UpdateState, 'dismissed'>): SwController {
  const state: UpdateState = { ...initial, dismissed: false };
  return {
    getState: () => state,
    subscribe: () => () => {},
    checkForUpdate: async () => {},
    applyUpdate: async () => {},
    markForced() {},
    dismiss() {},
  };
}
