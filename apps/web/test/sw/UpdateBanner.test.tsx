import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { liveQuery } from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../../src/local-db/db';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { type SwController, swControllerStore, type UpdateState } from '../../src/sw/register';
import { UpdateBanner, UpdateBannerView } from '../../src/sw/UpdateBanner';
import { settle } from '../support/auth';
import { createTestLocalDb } from '../support/local-db';
import { makeMe, renderApp, renderWithServices } from '../support/render';

const TITLE = 'Nouvelle version disponible';
const FORCED = "Mets à jour l'appli pour reprendre la synchronisation.";

/**
 * Contrôleur factice : état posé par le test, applyUpdate compté. Comme le vrai, « Plus tard » (`dismiss`)
 * est gardé par le contrôleur et ignoré une fois forcé.
 */
function fakeController(
  initial: Omit<UpdateState, 'dismissed'>,
): SwController & { set(s: Partial<UpdateState>): void } {
  let state: UpdateState = { ...initial, dismissed: false };
  const listeners = new Set<(s: UpdateState) => void>();
  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    checkForUpdate: async () => {},
    applyUpdate: vi.fn(async () => {}),
    markForced() {
      this.set({ forced: true, dismissed: false });
    },
    dismiss() {
      if (!state.forced) this.set({ dismissed: true });
    },
    set(patch) {
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state);
    },
  };
}

const BANNER = '[data-testid="update-banner"]';
const banner = () => screen.queryByTestId('update-banner');
const button = (name: string) => screen.queryByRole('button', { name });

const watchers: MutationObserver[] = [];

/**
 * Compte les apparitions du bandeau dans le document à partir de maintenant (avant le rendu) : un
 * bandeau affiché un instant puis retiré compte (son ajout ou son retrait est observé).
 */
function watchBanner(): { seen(): number } {
  let seen = 0;
  const hit = (n: Node) => n instanceof Element && (n.matches(BANNER) || n.querySelector(BANNER) !== null);
  const count = (records: MutationRecord[]) => {
    for (const r of records) for (const n of [...r.addedNodes, ...r.removedNodes]) if (hit(n)) seen++;
  };
  const observer = new MutationObserver(count);
  observer.observe(document.body, { childList: true, subtree: true });
  watchers.push(observer);
  return {
    seen() {
      count(observer.takeRecords());
      return seen;
    },
  };
}

/** Premier résultat d'une lecture observée (liveQuery), comme celles de `useLive` et `useMe`. */
function firstLive(query: () => Promise<unknown>): Promise<void> {
  return new Promise<void>((resolve) => {
    const subscription = liveQuery(query).subscribe({
      next: () => {
        resolve();
        queueMicrotask(() => subscription.unsubscribe());
      },
    });
  });
}

/**
 * Attend que les lectures observées du bandeau (séance en cours, utilisateur) aient répondu : les
 * mêmes lectures, ouvertes après les siennes, ont répondu, puis React a rendu. Une absence constatée
 * ensuite est une décision du bandeau, pas une base encore muette.
 */
async function liveReadsDone(db: AppDb): Promise<void> {
  await act(async () => {
    await Promise.all([firstLive(() => getMeta(db, 'activeSessionId')), firstLive(() => getMeta(db, 'me'))]);
  });
  await settle();
}

afterEach(() => {
  swControllerStore.set(null);
  for (const observer of watchers.splice(0)) observer.disconnect();
});

describe('UpdateBannerView', () => {
  const noop = () => {};

  it('show faux → rien', () => {
    const { container } = render(
      <UpdateBannerView show={false} dismissible onUpdate={noop} onDismiss={noop} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('fermable → data-dismissible "true", « Mettre à jour » et « Plus tard »', () => {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateBannerView show dismissible onUpdate={onUpdate} onDismiss={onDismiss} />);
    expect(banner()?.getAttribute('data-dismissible')).toBe('true');
    expect(banner()?.textContent).toContain(TITLE);
    expect(banner()?.textContent).not.toContain(FORCED);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('forcé → data-dismissible "false", pas de « Plus tard », consigne de mise à jour', () => {
    render(<UpdateBannerView show dismissible={false} onUpdate={noop} onDismiss={noop} />);
    expect(banner()?.getAttribute('data-dismissible')).toBe('false');
    expect(banner()?.textContent).toContain(TITLE);
    expect(banner()?.textContent).toContain(FORCED);
    expect(button('Mettre à jour')).not.toBeNull();
    expect(button('Plus tard')).toBeNull();
  });
});

describe('UpdateBanner (R-PWA-2, R-PWA-3, R-PWA-5)', () => {
  it('aucun contrôleur publié → rien', async () => {
    await renderWithServices(<UpdateBanner />);
    await settle();
    expect(banner()).toBeNull();
  });

  it('SW en attente, hors séance et hors onboarding → bandeau ; « Mettre à jour » → applyUpdate', async () => {
    const controller = fakeController({ available: true, forced: false });
    swControllerStore.set(controller);
    await renderWithServices(<UpdateBanner />);
    await screen.findByTestId('update-banner');
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    expect(controller.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('contrôleur publié après le rendu, puis version trouvée → bandeau', async () => {
    await renderWithServices(<UpdateBanner />);
    await settle();
    const controller = fakeController({ available: false, forced: false });
    act(() => swControllerStore.set(controller));
    await settle();
    expect(banner()).toBeNull();
    act(() => controller.set({ available: true }));
    await screen.findByTestId('update-banner');
  });

  it('SW en attente : une séance qui commence (activeSessionId "s1") masque le bandeau, même forcé ; il revient à la fin', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const { db } = await renderWithServices(<UpdateBanner />);
    await screen.findByTestId('update-banner');
    await act(() => setMeta(db, 'activeSessionId', 's1'));
    await waitFor(() => expect(banner()).toBeNull());
    await act(() => setMeta(db, 'activeSessionId', null));
    await screen.findByTestId('update-banner');
  });

  it('SW en attente, séance déjà en cours au montage (activeSessionId "s1") → aucun bandeau, pas même un instant', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const db = createTestLocalDb();
    await setMeta(db, 'activeSessionId', 's1');
    const watch = watchBanner();
    await renderWithServices(<UpdateBanner />, { db });
    await liveReadsDone(db);
    expect(watch.seen()).toBe(0);
    // Contrôle positif : la même base, séance finie, affiche le bandeau.
    await act(() => setMeta(db, 'activeSessionId', null));
    await screen.findByTestId('update-banner');
  });

  it('SW en attente : un membre en onboarding ne voit pas le bandeau, même forcé', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const { db } = await renderWithServices(<UpdateBanner />);
    await screen.findByTestId('update-banner');
    await act(() => setMeta(db, 'me', makeMe({ onboardingCompletedAt: null })));
    await waitFor(() => expect(banner()).toBeNull());
  });

  it('SW en attente, onboarding en cours au montage → aucun bandeau, pas même un instant, même forcé', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const watch = watchBanner();
    const { db } = await renderWithServices(<UpdateBanner />, {
      me: makeMe({ onboardingCompletedAt: null }),
    });
    await liveReadsDone(db);
    expect(watch.seen()).toBe(0);
    // Contrôle positif : onboarding fini, le bandeau paraît.
    await act(() => setMeta(db, 'me', makeMe()));
    await screen.findByTestId('update-banner');
  });

  it('« Plus tard » masque le bandeau ; un 426 ensuite le rend non fermable', async () => {
    const controller = fakeController({ available: true, forced: false });
    swControllerStore.set(controller);
    await renderWithServices(<UpdateBanner />);
    await screen.findByTestId('update-banner');
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(banner()).toBeNull();
    act(() => controller.markForced());
    expect(banner()?.getAttribute('data-dismissible')).toBe('false');
    expect(button('Plus tard')).toBeNull();
    expect(banner()?.textContent).toContain(FORCED);
  });

  it('« Plus tard » tient au contrôleur : un bandeau remonté reste masqué', async () => {
    const controller = fakeController({ available: true, forced: false });
    swControllerStore.set(controller);
    const first = await renderWithServices(<UpdateBanner />);
    await screen.findByTestId('update-banner');
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(controller.getState().dismissed).toBe(true);
    first.unmount();
    await renderWithServices(<UpdateBanner />);
    await settle();
    expect(banner()).toBeNull();
  });
});

describe('cadres (AppShell, PublicShell)', () => {
  it('« Plus tard » sur /, passage par /help (PublicShell) puis retour : toujours masqué ; un 426 le rend', async () => {
    const controller = fakeController({ available: true, forced: false });
    swControllerStore.set(controller);
    await renderApp({ path: '/' });
    await screen.findByTestId('update-banner');
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(banner()).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Aide' }));
    await screen.findByRole('heading', { level: 1, name: 'Aide' });
    fireEvent.click(screen.getByRole('link', { name: 'appsport' }));
    await screen.findByRole('navigation', { name: 'Navigation principale' });
    await settle();
    expect(banner()).toBeNull();
    act(() => controller.markForced());
    const shown = await screen.findByTestId('update-banner');
    expect(shown.getAttribute('data-dismissible')).toBe('false');
  });

  it('AppShell : le bandeau en premier', async () => {
    swControllerStore.set(fakeController({ available: true, forced: false }));
    await renderApp({ path: '/' });
    const shown = await screen.findByTestId('update-banner');
    expect(shown.parentElement?.firstElementChild).toBe(shown);
    expect(shown.parentElement?.querySelector('header')).not.toBeNull();
  });

  // Membre onboardé, hors séance, version en attente : seul le cadre décide. (Un membre en onboarding
  // ne prouverait rien sur PublicShell : la règle masquerait le bandeau de toute façon.)
  it('PublicShell (page publique, membre onboardé) : aucun bandeau ; puis AppShell : bandeau', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const watch = watchBanner();
    const { db } = await renderApp({ path: '/privacy' });
    // Le cadre est rendu (en-tête) : l'absence du bandeau n'est pas celle d'une page encore vide.
    await screen.findAllByRole('banner');
    await liveReadsDone(db);
    expect(watch.seen()).toBe(0);
    // Contrôle positif : même membre, même contrôleur, cadre connecté.
    fireEvent.click(screen.getByRole('link', { name: 'appsport' }));
    await screen.findByTestId('update-banner');
  });

  it('PublicShell (page publique, sans session) : aucun bandeau', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const watch = watchBanner();
    const { db } = await renderApp({ path: '/privacy', me: null });
    await screen.findAllByRole('banner');
    await liveReadsDone(db);
    expect(watch.seen()).toBe(0);
  });
});
