import { defaultLoadSettings, type GymDetail } from '@rune/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from 'wouter';
import { App } from '../../src/App';
import { ServicesProvider } from '../../src/app-services';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { choose, seedPrimaryGym } from '../support/onboarding';
import { createTestServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const GYM_DETAIL: GymDetail = {
  id: 'g-1',
  name: 'Basic Fit',
  city: 'Lyon',
  loadSettings: defaultLoadSettings('gym'),
  deletedAt: null,
  equipment: [],
  canEdit: true,
  visibleMembers: ['lea'],
  history: [],
};

/**
 * L'appli entière sur l'historique du navigateur (celui de jsdom), comme en production : le retour arrière
 * (`history.back()`) et l'état posé par la navigation y sont réels. p-1 : salle « Basic Fit », principale ;
 * p-2 : maison « Garage ».
 */
async function renderInBrowser(api: FakeApi) {
  const db = createTestLocalDb();
  await seedPrimaryGym(db);
  await seedMirror(db, 'place', [
    {
      id: 'p-2',
      ownerId: 'u-1',
      kind: 'home',
      gymId: null,
      name: 'Garage',
      isPrimary: false,
      visibleAtGym: null,
      loadSettings: defaultLoadSettings('home'),
    },
  ]);
  window.history.replaceState(null, '', '/places');
  const { services } = await createTestServices({ db, api, path: '/places' });
  render(
    <Router>
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>
    </Router>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Salles' });
  await settle();
}

function serve(): FakeApi {
  return createFakeApi()
    .on('GET', '/api/gyms/:id', { status: 200, body: GYM_DETAIL })
    .on('DELETE', '/api/places/:id', { status: 204 });
}

/** « Supprimer ce lieu » (focus posé dessus, comme au clavier), puis la boîte de confirmation. */
async function openDelete(title: string) {
  const remove = screen.getByRole('button', { name: 'Supprimer ce lieu' });
  remove.focus();
  fireEvent.click(remove);
  return within(await screen.findByRole('dialog', { name: title }));
}

/** Retour arrière du navigateur, attendu jusqu'à son `popstate`. */
async function goBack() {
  const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  window.history.back();
  await popped;
  await settle();
}

/** Revenu aux Salles après la suppression : focus sur « Mes lieux », et le retour arrière reste aux Salles. */
async function expectBackOnPlaces() {
  await screen.findByRole('heading', { level: 1, name: 'Salles' });
  const heading = screen.getByRole('heading', { level: 2, name: 'Mes lieux' });
  await until(() => document.activeElement === heading);
  expect(window.location.pathname).toBe('/places');
  // L'adresse du lieu supprimé a été remplacée : le retour arrière ne la rouvre pas.
  await goBack();
  expect(window.location.pathname).toBe('/places');
  expect(screen.queryByText('Lieu introuvable.')).toBeNull();
  expect(screen.getByRole('heading', { level: 1, name: 'Salles' })).toBeTruthy();
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('suppression d’un lieu depuis sa fiche : retour aux Salles', () => {
  it('maison : le focus va à « Mes lieux », le retour arrière ne rouvre pas le lieu supprimé', async () => {
    const api = serve();
    await renderInBrowser(api);
    fireEvent.click(screen.getByRole('link', { name: 'Garage' }));
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    expect(window.location.pathname).toBe('/places/p-2');
    const dialog = await openDelete('Supprimer Garage ?');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await expectBackOnPlaces();
  });

  it('salle : le focus va à « Mes lieux », le retour arrière ne rouvre pas sa fiche', async () => {
    const api = serve();
    await renderInBrowser(api);
    fireEvent.click(screen.getByRole('link', { name: 'Basic Fit' }));
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(window.location.pathname).toBe('/gyms/g-1');
    await screen.findByRole('region', { name: 'Zone sensible' });
    const dialog = await openDelete('Supprimer Basic Fit ?');
    choose('Garage');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await expectBackOnPlaces();
  });
});
