import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMeta } from '../../src/local-db/meta';
import { type SwController, swControllerStore, type UpdateState } from '../../src/sw/register';
import { UpdateBanner, UpdateBannerView } from '../../src/sw/UpdateBanner';
import { settle } from '../support/auth';
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

const banner = () => screen.queryByTestId('update-banner');
const button = (name: string) => screen.queryByRole('button', { name });

afterEach(() => {
  swControllerStore.set(null);
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

  it('SW en attente pendant une séance (activeSessionId "s1") → rien, puis bandeau à la fin de la séance', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    const { db } = await renderWithServices(<UpdateBanner />, {});
    await act(() => setMeta(db, 'activeSessionId', 's1'));
    await settle();
    expect(banner()).toBeNull();
    await act(() => setMeta(db, 'activeSessionId', null));
    await screen.findByTestId('update-banner');
  });

  it('SW en attente pendant l’onboarding → rien, même forcé', async () => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    await renderWithServices(<UpdateBanner />, { me: makeMe({ onboardingCompletedAt: null }) });
    await settle();
    expect(banner()).toBeNull();
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

  it.each([
    ['onboarding', '/onboarding', makeMe({ onboardingCompletedAt: null })],
    ['page publique', '/privacy', null],
  ])('PublicShell (%s) : aucun bandeau', async (_, path, me) => {
    swControllerStore.set(fakeController({ available: true, forced: true }));
    await renderApp({ path, me });
    // Le cadre est rendu (en-tête) : l'absence du bandeau n'est pas celle d'une page encore vide.
    await screen.findAllByRole('banner');
    await settle();
    expect(banner()).toBeNull();
  });
});
