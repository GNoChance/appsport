import type { HealthResponse } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncEngine } from '../../src/sync/engine';
import { fill } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, seedProfile } from '../support/onboarding';
import { renderApp } from '../support/render';
import { until } from '../support/wait';

const HEALTH: HealthResponse = {
  status: 'ok',
  version: 'test',
  db: 'ok',
  protocol: 1,
  minProtocol: 1,
  epoch: 'e1',
  swKill: false,
};

/** Faux serveur où un cycle de synchro réussit de bout en bout : aucune reprise ne reste programmée. */
function syncingApi(): FakeApi {
  return createFakeApi()
    .on('GET', '/api/health', { status: 200, body: HEALTH })
    .on('GET', '/api/sync/pull', {
      status: 200,
      body: { rows: [], nextWatermark: 'e1:1', hasMore: false, catalogVersion: null },
    });
}

let engine: SyncEngine | null = null;

afterEach(() => {
  engine?.stop();
  engine = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * Mon profil avec le moteur réel (comme `bootApp`), sur téléphone : barre d'onglets. `beforeStart` : juste avant
 * le démarrage du moteur, une fois l'écran affiché.
 */
async function openProfile(api: FakeApi, beforeStart: () => void = () => {}): Promise<SyncEngine> {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const db = createTestLocalDb();
  await seedProfile(db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
  const view = await renderApp({ path: '/profile/edit', db, api, realSync: true });
  engine = view.engine;
  await until(() => screen.queryByRole('heading', { level: 1, name: 'Mon profil' }) !== null);
  beforeStart();
  engine.start();
  return view.engine;
}

const pill = () => screen.queryByTestId('connection-status')?.textContent ?? null;
const goHome = () =>
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole('link', {
      name: 'Accueil',
    }),
  );
/** Pseudo derrière sa ligne dans Mon profil : la ligne ouvre le formulaire. */
const savePseudo = (value: string) => {
  if (!screen.queryByRole('textbox', { name: 'Pseudo' })) fireEvent.click(button('Modifier le pseudo'));
  fill('Pseudo', value);
  fireEvent.click(button('Enregistrer le pseudo'));
};

describe('pastille et écrans « Nécessite le réseau » : une seule source (spec refonte §5, R-SYN-30)', () => {
  it('dernier cycle réussi, outbox vide, réseau perdu : refus de classe E sur Profil, puis « Hors ligne » sur l’accueil', async () => {
    const api = syncingApi();
    const sync = await openProfile(api);
    await until(() => sync.getState().connection === 'online' && !sync.getState().syncing);
    // Plus aucun cycle ne partirait de lui-même : ni reprise (cycle réussi), ni intervalle (outbox vide).
    api.setOffline('reject');
    savePseudo('leo');
    await until(() => screen.queryByRole('alert')?.textContent === 'Nécessite le réseau');
    goHome();
    await until(() => pill() !== null);
    expect(pill()).toBe('Hors ligne');
    expect(screen.queryByText('En ligne')).toBeNull();
  });

  it('moteur hors ligne, le serveur répond à une requête de classe E : un cycle part aussitôt, « En ligne »', async () => {
    const api = syncingApi();
    api.setOffline('reject');
    // Horloge simulée dès le démarrage du moteur : la reprise programmée (+2 s) ne peut pas remettre
    // « En ligne » à la place du crochet.
    const sync = await openProfile(api, () =>
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }),
    );
    await until(() => sync.getState().connection === 'offline' && !sync.getState().syncing);
    api.setOffline(false);
    // Une réponse en erreur prouve aussi que le serveur est joignable ; elle ne lance aucun pull d'elle-même.
    api.on('PATCH', '/api/me', { status: 409, body: { error: 'username_taken' } });
    savePseudo('max');
    await until(() => screen.queryByRole('alert')?.textContent === 'Ce pseudo est déjà pris.');
    goHome();
    await until(() => pill() === 'En ligne');
    expect(api.calls.filter((c) => c.path === '/api/health')).toHaveLength(2);
  });
});
