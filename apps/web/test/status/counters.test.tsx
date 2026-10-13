import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CONNECTION_LABELS, ConnectionStatus } from '../../src/features/status/ConnectionStatus';
import type { SyncEngine } from '../../src/sync/engine';
import { createFakeApi, createFakeSyncEngine } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { newcomer } from '../support/onboarding';
import { renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const rejection = (id: string, opId: string) => ({
  id,
  ownerId: 'u-1',
  opId,
  entity: 'place',
  rowId: 'p-1',
  code: 'validation',
  detailJson: null,
  dismissedAt: null,
  createdAt: '2026-10-06T10:00:00.000Z',
});

const count = (testId: string) => screen.queryByTestId(testId)?.getAttribute('data-count') ?? null;

let engine: SyncEngine | null = null;
afterEach(() => {
  engine?.stop();
  engine = null;
});

describe('connection-status (R-SYN-30 : état du moteur, jamais navigator.onLine)', () => {
  it.each([
    ['online', 'En ligne'],
    ['offline', 'Hors ligne'],
    ['unknown', 'Connexion…'],
    ['unauthenticated', 'Session expirée'],
    ['protocol_unsupported', 'Mise à jour nécessaire'],
    ['account_deleted', 'Compte supprimé'],
  ] as const)('connection-status %s', async (state, label) => {
    await renderWithServices(<ConnectionStatus />, { sync: createFakeSyncEngine({ connection: state }) });
    const status = screen.getByTestId('connection-status');
    expect(status.getAttribute('data-state')).toBe(state);
    expect(status.textContent).toBe(label);
    expect(CONNECTION_LABELS[state]).toBe(label);
  });

  it("suit l'état du moteur sans rechargement", async () => {
    const { sync } = await renderWithServices(<ConnectionStatus />);
    expect(screen.getByTestId('connection-status').textContent).toBe('En ligne');
    act(() => sync.set({ connection: 'offline' }));
    expect(screen.getByTestId('connection-status').getAttribute('data-state')).toBe('offline');
    expect(screen.getByTestId('connection-status').textContent).toBe('Hors ligne');
  });
});

describe("zone d'état de la coquille (R-SYN-34)", () => {
  it("chaque écran connecté porte l'état de connexion et les deux compteurs dans l'en-tête", async () => {
    await renderApp({ path: '/profile' });
    const header = await screen.findByRole('banner');
    expect(within(header).getByTestId('connection-status')).toBeTruthy();
    expect(within(header).getByTestId('pending-counter')).toBeTruthy();
    expect(within(header).getByTestId('rejected-counter')).toBeTruthy();
  });

  it("l'onboarding n'a pas de zone d'état", async () => {
    await renderApp({ path: '/onboarding', me: newcomer() });
    await screen.findByTestId('onboarding-step');
    expect(screen.queryByTestId('pending-counter')).toBeNull();
    expect(screen.queryByTestId('connection-status')).toBeNull();
  });

  it("pending-counter : data-count '0' puis '3' après sync.set({ pending: 3 }), « 3 en attente »", async () => {
    const { sync } = await renderApp({ path: '/' });
    await until(() => count('pending-counter') === '0');
    expect(screen.getByTestId('pending-counter').textContent).toBe('0 en attente');
    act(() => sync.set({ pending: 3 }));
    expect(count('pending-counter')).toBe('3');
    expect(screen.getByTestId('pending-counter').textContent).toBe('3 en attente');
  });

  it("rejected-counter : un sync_rejection non ignoré, compté par le moteur → '1 refusé', lien /rejections", async () => {
    const db = createTestLocalDb();
    await seedMirror(db, 'sync_rejection', [rejection('r-1', 'op-1')]);
    const api = createFakeApi();
    api.setOffline('reject');
    const view = await renderApp({ path: '/', db, api, realSync: true });
    engine = view.engine;
    view.engine.start();
    await until(() => count('rejected-counter') === '1');
    const counter = screen.getByTestId('rejected-counter');
    expect(counter.textContent).toBe('1 refusé');
    const link = within(counter).getByRole('link', { name: '1 refusé' });
    expect(link.getAttribute('href')).toBe('/rejections');
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Éléments refusés' })).toBeTruthy();
    expect(view.location()).toBe('/rejections');
  });

  it("rejected-counter : deux refus → '2 refusés'", async () => {
    const { sync } = await renderApp({ path: '/' });
    act(() => sync.set({ rejected: 2 }));
    await until(() => count('rejected-counter') === '2');
    expect(screen.getByTestId('rejected-counter').textContent).toBe('2 refusés');
  });

  it("rejected-counter : aucun refus → data-count '0', ni texte ni lien", async () => {
    await renderApp({ path: '/' });
    await until(() => count('rejected-counter') === '0');
    const counter = screen.getByTestId('rejected-counter');
    expect(counter.textContent).toBe('');
    expect(within(counter).queryByRole('link')).toBeNull();
  });
});
