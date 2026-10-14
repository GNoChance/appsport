import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type SwController, swControllerStore, type UpdateState } from '../../src/sw/register';
import type { ConnectionState } from '../../src/sync/engine';
import { BootSplash } from '../../src/ui/BootSplash';
import { ConnectionPill } from '../../src/ui/ConnectionPill';
import { SideNav } from '../../src/ui/SideNav';
import { screenTransition } from '../../src/ui/screen-transition';
import { activeTab, TAB_ITEMS, TabBar } from '../../src/ui/TabBar';
import { createFakeSyncEngine } from '../support/fake-api';
import { newcomer } from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const DESKTOP = '(min-width: 900px)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/** Réglages du téléphone simulés : les media queries listées répondent vrai, les autres faux. */
function media(...matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  swControllerStore.set(null);
  sessionStorage.clear();
});

const mainNav = () => screen.getByRole('navigation', { name: 'Navigation principale' });
const tab = (name: string) => within(mainNav()).getByRole('link', { name });
/** En-tête de l'accueil : celui qui porte le rond de l'initiale (les pages ont aussi leur `<header>`). */
const homeHeader = async () => {
  const header = (await screen.findByRole('link', { name: 'Mon profil' })).closest('header');
  if (!header) throw new Error('en-tête de l’accueil absent');
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
  it.each([
    ['online', 'En ligne'],
    ['offline', 'Hors ligne'],
    ['unknown', 'Connexion…'],
    ['unauthenticated', 'Session expirée'],
    ['protocol_unsupported', 'Mise à jour nécessaire'],
    ['account_deleted', 'Compte supprimé'],
  ] as const)('%s → « %s »', async (state: ConnectionState, label) => {
    await renderWithServices(<ConnectionPill />, { sync: createFakeSyncEngine({ connection: state }) });
    const pill = screen.getByTestId('connection-status');
    expect(pill.getAttribute('data-state')).toBe(state);
    expect(pill.textContent).toBe(label);
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
    const avatar = within(header).getByRole('link', { name: 'Mon profil' });
    expect(avatar.getAttribute('href')).toBe('/profile');
    expect(avatar.textContent).toBe('L');
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
    expect(screen.queryByRole('link', { name: 'Mon profil' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/profile');
  });

  it("l'onglet « Administration » n'existe plus dans la barre, même pour un admin", async () => {
    media();
    await renderApp({ path: '/', me: makeMe({ role: 'admin' }) });
    await screen.findByText('Bonjour lea');
    expect(within(mainNav()).queryByRole('link', { name: 'Administration' })).toBeNull();
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

  it("changement d'écran : la transition est posée selon l'historique (onglet, avant, retour)", async () => {
    media();
    const view = await renderApp({ path: '/' });
    await screen.findByText('Bonjour lea');
    const screenEl = () => view.container.querySelector('[data-screen-transition]');
    fireEvent.click(tab('Profil'));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(screenEl()?.getAttribute('data-screen-transition')).toBe('tab');
    fireEvent.click(screen.getByRole('link', { name: 'Santé' }));
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    expect(screenEl()?.getAttribute('data-screen-transition')).toBe('forward');
    fireEvent.click(screen.getByRole('link', { name: 'Retour' }));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(screenEl()?.getAttribute('data-screen-transition')).toBe('back');
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

  it('sinon : le logo se dessine par-dessus, décoratif, sans jamais prendre le toucher, puis se retire', () => {
    media();
    const { container } = render(<BootSplash />);
    const splash = container.firstElementChild as HTMLElement | null;
    expect(splash).not.toBeNull();
    expect(splash?.getAttribute('aria-hidden')).toBe('true');
    expect(splash?.querySelector('svg')).not.toBeNull();
    expect(splash?.textContent).toBe('');
    if (!splash) return;
    fireEvent.animationEnd(splash);
    expect(container.innerHTML).toBe('');
  });

  it('une seule fois par session : un second montage ne rend rien', () => {
    media();
    const first = render(<BootSplash />);
    const splash = first.container.firstElementChild;
    if (splash) fireEvent.animationEnd(splash);
    first.unmount();
    const { container } = render(<BootSplash />);
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
