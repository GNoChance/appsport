import { defaultLoadSettings, EQUIPMENT_LABELS, type GymDetail, type MeResponse } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceDetail } from '../../src/features/places/PlaceDetail';
import { PlacesPage } from '../../src/features/places/PlacesPage';
import type { AppDb } from '../../src/local-db/db';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, checkbox, choose, seedPrimaryGym } from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const KEEP_ONE = 'Tu dois garder au moins un lieu.';
const PRIMARY_NOTE = "Ton lieu principal : là où tu t'entraînes le plus souvent.";

const GYM_PLACE = {
  id: 'p-1',
  ownerId: 'u-1',
  kind: 'gym',
  gymId: 'g-1',
  name: null,
  isPrimary: true,
  visibleAtGym: true,
  loadSettings: null,
};
const HOME_PLACE = {
  id: 'p-2',
  ownerId: 'u-1',
  kind: 'home',
  gymId: null,
  name: 'Garage',
  isPrimary: false,
  visibleAtGym: null,
  loadSettings: defaultLoadSettings('home'),
};

const GYM_DETAIL: GymDetail = {
  id: 'g-1',
  name: 'Basic Fit',
  city: 'Lyon',
  loadSettings: defaultLoadSettings('gym'),
  deletedAt: null,
  equipment: ['flat_bench', 'barbell'],
  canEdit: true,
  visibleMembers: ['lea', 'max'],
  history: [
    {
      at: '2026-10-06T12:04:00.000Z',
      action: 'add_equipment',
      authorUsername: 'max',
      detail: { code: 'box' },
    },
    { at: '2026-10-05T10:00:00.000Z', action: 'update_info', authorUsername: null, detail: {} },
    { at: '2026-10-04T10:00:00.000Z', action: 'create', authorUsername: 'max', detail: {} },
    { at: '2026-10-03T10:00:00.000Z', action: 'create', authorUsername: 'max', detail: {} },
  ],
};

/**
 * p-1 : salle « Basic Fit » (Lyon), principale et visible ; p-2 : maison « Garage » (sauf `single`).
 * `garagePrimary` : « Garage » principale, alors qu'elle vient après « Basic Fit » par l'id et le nom.
 */
async function seedPlaces(db: AppDb, o: { single?: boolean; garagePrimary?: boolean } = {}) {
  await seedPrimaryGym(db);
  await seedMirror(db, 'gym_equipment', [
    { id: 'g-1:barbell', gymId: 'g-1', equipmentCode: 'barbell' },
    { id: 'g-1:flat_bench', gymId: 'g-1', equipmentCode: 'flat_bench' },
  ]);
  if (o.single) return;
  await seedMirror(db, 'place', [HOME_PLACE]);
  await seedMirror(db, 'home_equipment', [
    { id: 'p-2:chair', ownerId: 'u-1', placeId: 'p-2', equipmentCode: 'chair' },
  ]);
  if (o.garagePrimary) {
    await seedMirror(db, 'place', [
      { ...GYM_PLACE, isPrimary: false },
      { ...HOME_PLACE, isPrimary: true },
    ]);
  }
}

async function renderPlaces(
  o: { me?: MeResponse; api?: FakeApi; single?: boolean; garagePrimary?: boolean } = {},
) {
  const db = createTestLocalDb();
  await seedPlaces(db, o);
  const rendered = await renderWithServices(<PlacesPage />, { me: o.me, db, api: o.api });
  await screen.findByRole('link', { name: 'Basic Fit' });
  // Relectures de la liste déclenchées par l'amorçage du miroir : passées avant toute action.
  await settle();
  return rendered;
}

async function renderHome(o: { api?: FakeApi; garagePrimary?: boolean } = {}) {
  const db = createTestLocalDb();
  await seedPlaces(db, { garagePrimary: o.garagePrimary });
  const rendered = await renderWithServices(<PlaceDetail params={{ id: 'p-2' }} />, { db, api: o.api });
  await screen.findByRole('heading', { level: 1, name: 'Garage' });
  await settle();
  return rendered;
}

/** Carte du lieu nommé `name` dans « Mes lieux ». */
function card(name: string) {
  const item = screen.getByRole('link', { name }).closest('li');
  if (!item) throw new Error(`lieu ${name} introuvable`);
  return within(item);
}

const region = (name: string) => within(screen.getByRole('region', { name }));
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

/** Réponse retenue jusqu'à `release()` : l'action reste en cours le temps du test. */
function hold(): { promise: Promise<void>; release(): void } {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('PlacesPage : Salles › Mes lieux (maquette D01)', () => {
  it("le principal d'abord avec « Principal » ; la salle mène à sa fiche, la maison à la sienne", async () => {
    // « Garage » principale vient après « Basic Fit » par l'id, le nom et l'ordre d'écriture.
    await renderPlaces({ garagePrimary: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Salles' })).toBeTruthy();
    const places = region('Mes lieux');
    expect(places.getByText('2 lieux')).toBeTruthy();
    const names = places.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(names).toEqual(['/places/p-2', '/gyms/g-1']);
    expect(card('Garage').getByText('Principal')).toBeTruthy();
    expect(card('Basic Fit').queryByText('Principal')).toBeNull();
    expect(card('Basic Fit').getByText('Salle · Lyon')).toBeTruthy();
    expect(card('Garage').getByText('Maison · 1 équipement')).toBeTruthy();
    expect(screen.getByText(PRIMARY_NOTE)).toBeTruthy();
  });

  it('carte de la salle : son matériel, et les membres visibles relus en ligne', async () => {
    const api = createFakeApi().on('GET', '/api/gyms/:id', { status: 200, body: GYM_DETAIL });
    await renderPlaces({ api });
    expect(card('Basic Fit').getByText('équipements')).toBeTruthy();
    expect(card('Basic Fit').getByText('2')).toBeTruthy();
    expect(await card('Basic Fit').findByText('2 membres visibles')).toBeTruthy();
  });

  it('« Dernières modifications » : les 3 dernières de la salle principale, et « Voir la salle »', async () => {
    const api = createFakeApi().on('GET', '/api/gyms/:id', { status: 200, body: GYM_DETAIL });
    await renderPlaces({ api });
    const activity = within(await screen.findByRole('region', { name: 'Dernières modifications' }));
    const items = activity.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain('Matériel ajouté : Box ou step stable');
    expect(items[0]?.textContent).toContain('modifié par max');
    expect(items[1]?.textContent).toContain('modifié par un membre');
    expect(activity.getByRole('link', { name: 'Voir la salle' }).getAttribute('href')).toBe('/gyms/g-1');
  });

  it('hors ligne : ni membres ni historique, rien d’inventé', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderPlaces({ api });
    await settle();
    expect(screen.queryByText(/membres? visibles?/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Dernières modifications' })).toBeNull();
  });

  it('« Ajouter une salle » : son écran, le GymPicker (non principal, visible pour un adulte), puis la liste', async () => {
    const api = createFakeApi()
      .on('GET', '/api/gyms', {
        status: 200,
        body: [{ id: 'g-2', name: 'Fitness Park', city: 'Lyon', visibleMemberCount: 0 }],
      })
      .on('POST', '/api/places', { status: 201, body: { id: 'p-3' } });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une salle'));
    const title = screen.getByRole('heading', { level: 1, name: 'Ajouter une salle' });
    expect(document.activeElement).toBe(title);
    const gym = 'Fitness Park · Lyon · 0 membre visible';
    await screen.findByRole('radio', { name: gym });
    expect(checkbox('Apparaître dans « Qui va à cette salle »').checked).toBe(true);
    choose(gym);
    fireEvent.click(button('Valider'));
    await until(() => sent(api, 'POST', '/api/places').length === 1);
    expect(sent(api, 'POST', '/api/places')).toEqual([
      { kind: 'gym', gymId: 'g-2', isPrimary: false, visibleAtGym: true },
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Salles' });
    await until(() => document.activeElement === screen.queryByRole('button', { name: 'Ajouter une salle' }));
  });

  it('« Retour » de « Ajouter une salle » : la liste, le focus rendu au bouton', async () => {
    const api = createFakeApi().on('GET', '/api/gyms', { status: 200, body: [] });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une salle'));
    fireEvent.click(button('Retour'));
    expect(screen.getByRole('heading', { level: 1, name: 'Salles' })).toBeTruthy();
    expect(document.activeElement).toBe(button('Ajouter une salle'));
  });

  it('« Ajouter une salle » pour un mineur : case décochée par défaut', async () => {
    const api = createFakeApi().on('GET', '/api/gyms', { status: 200, body: [] });
    await renderPlaces({ api, me: makeMe({ ageBand: 'minor' }) });
    fireEvent.click(button('Ajouter une salle'));
    await screen.findByText('Aucune salle trouvée.');
    expect(checkbox('Apparaître dans « Qui va à cette salle »').checked).toBe(false);
  });

  it('« Ajouter une maison » → POST { kind: home, name, equipment, isPrimary: false }, puis la liste', async () => {
    const api = createFakeApi().on('POST', '/api/places', { status: 201, body: { id: 'p-3' } });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une maison'));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Ajouter une maison' }),
    );
    const name = screen.getByLabelText('Nom du lieu') as HTMLInputElement;
    expect(name.value).toBe('Maison');
    fill('Nom du lieu', 'Garage 2');
    choose('Petit matériel');
    fireEvent.click(checkbox(EQUIPMENT_LABELS.kettlebell));
    fireEvent.click(button('Ajouter la maison'));
    await until(() => sent(api, 'POST', '/api/places').length === 1);
    expect(sent(api, 'POST', '/api/places')).toEqual([
      {
        kind: 'home',
        name: 'Garage 2',
        equipment: ['chair', 'table', 'resistance_band', 'dumbbells', 'kettlebell', 'pull_up_bar'],
        isPrimary: false,
      },
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Salles' });
    await until(
      () => document.activeElement === screen.queryByRole('button', { name: 'Ajouter une maison' }),
    );
  });

  it('« Ajouter une maison » : nom vide, message local et aucune requête', async () => {
    const api = createFakeApi();
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une maison'));
    fill('Nom du lieu', '  ');
    fireEvent.click(button('Ajouter la maison'));
    expect(screen.getByText('Donne un nom à ce lieu.')).toBeTruthy();
    expect(sent(api, 'POST', '/api/places')).toEqual([]);
  });

  it('« Ajouter une maison » : « Retour » pendant l’envoi est ignoré, l’erreur s’affiche ensuite', async () => {
    const held = hold();
    const api = createFakeApi().on('POST', '/api/places', async () => {
      await held.promise;
      return { status: 500, body: { error: 'internal' } };
    });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une maison'));
    fireEvent.click(button('Ajouter la maison'));
    await until(() => sent(api, 'POST', '/api/places').length === 1);
    fireEvent.click(button('Retour'));
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une maison' })).toBeTruthy();
    held.release();
    expect((await screen.findByRole('alert')).textContent).toBe('Le serveur a rencontré une erreur.');
    // Plus rien en cours : « Retour » ramène à la liste.
    fireEvent.click(button('Retour'));
    expect(screen.getByRole('heading', { level: 1, name: 'Salles' })).toBeTruthy();
  });

  it('« Ajouter une salle » : « Retour » pendant « Valider » est ignoré, l’écran se ferme une fois le lieu créé', async () => {
    const held = hold();
    const api = createFakeApi()
      .on('GET', '/api/gyms', {
        status: 200,
        body: [{ id: 'g-2', name: 'Fitness Park', city: 'Lyon', visibleMemberCount: 0 }],
      })
      .on('POST', '/api/places', async () => {
        await held.promise;
        return { status: 201, body: { id: 'p-3' } };
      });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une salle'));
    const gym = 'Fitness Park · Lyon · 0 membre visible';
    await screen.findByRole('radio', { name: gym });
    choose(gym);
    fireEvent.click(button('Valider'));
    await until(() => sent(api, 'POST', '/api/places').length === 1);
    fireEvent.click(button('Retour'));
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une salle' })).toBeTruthy();
    held.release();
    await screen.findByRole('heading', { level: 1, name: 'Salles' });
  });

  it('création d’une salle : « Retour » pendant « Créer la salle » est ignoré', async () => {
    const held = hold();
    const api = createFakeApi()
      .on('GET', '/api/gyms', { status: 200, body: [] })
      .on('GET', '/api/gyms/similar', { status: 200, body: [] })
      .on('POST', '/api/gyms', async () => {
        await held.promise;
        return { status: 201, body: { gymId: 'g-2', placeId: 'p-3' } };
      });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une salle'));
    fireEvent.click(button("Ma salle n'est pas dans la liste"));
    fill('Nom de la salle', 'Fitness Park');
    fill('Ville', 'Lyon');
    fireEvent.click(button('Continuer'));
    await screen.findByRole('group', { name: 'Type de salle' });
    choose('Petite salle de quartier');
    fireEvent.click(button('Créer la salle'));
    await until(() => api.calls.some((c) => c.method === 'POST' && c.path === '/api/gyms'));
    fireEvent.click(button('Retour'));
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une salle' })).toBeTruthy();
    held.release();
    await screen.findByRole('heading', { level: 1, name: 'Salles' });
  });

  it('« Ajouter une maison » hors ligne : « Nécessite le réseau », le formulaire garde la saisie', async () => {
    const api = createFakeApi();
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une maison'));
    api.setOffline('reject');
    fill('Nom du lieu', 'Garage 2');
    fireEvent.click(button('Ajouter la maison'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(button('Ajouter la maison')).toBeTruthy();
    expect((screen.getByLabelText('Nom du lieu') as HTMLInputElement).value).toBe('Garage 2');
  });
});

describe('PlaceDetail : fiche d’une maison (maquette D05)', () => {
  it('nom, « Maison · 1 équipement », matériel par catégorie et catégories vides', async () => {
    await renderHome();
    expect(screen.getByText('Maison · 1 équipement')).toBeTruthy();
    const material = region('Matériel');
    expect(material.getByText('Chaise ou banc stable')).toBeTruthy();
    const empty = within(material.getByRole('list', { name: 'Catégories sans matériel coché' }));
    expect(empty.getAllByRole('listitem').map((li) => li.firstChild?.textContent)).toEqual([
      'Petit matériel',
      'Bancs et supports',
      'Charges libres',
      'Poulies et machines',
    ]);
    expect(button('Modifier le matériel')).toBeTruthy();
  });

  it('« Nom du lieu » : feuille de renommage, focus au champ, PATCH { name }, 30 caractères au plus', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    await renderHome({ api });
    const row = button('Nom du lieu');
    row.focus();
    fireEvent.click(row);
    const sheet = within(await screen.findByRole('dialog', { name: 'Renommer le lieu' }));
    const name = sheet.getByLabelText('Nom du lieu') as HTMLInputElement;
    expect(document.activeElement).toBe(name);
    expect(name.value).toBe('Garage');
    expect(name.maxLength).toBe(30);
    fireEvent.change(name, { target: { value: 'Cave' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    await until(() => sent(api, 'PATCH', '/api/places/p-2').length === 1);
    expect(sent(api, 'PATCH', '/api/places/p-2')).toEqual([{ name: 'Cave' }]);
    await until(() => screen.queryByRole('dialog') === null);
    await until(() => document.activeElement === row);
  });

  it('renommage : nom vide, message local et aucune requête', async () => {
    const api = createFakeApi();
    await renderHome({ api });
    fireEvent.click(button('Nom du lieu'));
    const sheet = within(await screen.findByRole('dialog', { name: 'Renommer le lieu' }));
    fireEvent.change(sheet.getByLabelText('Nom du lieu'), { target: { value: '  ' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect(sheet.getByText('Donne un nom à ce lieu.')).toBeTruthy();
    expect(sent(api, 'PATCH', '/api/places/p-2')).toEqual([]);
  });

  it('renommage hors ligne : « Nécessite le réseau », la feuille garde la saisie', async () => {
    const api = createFakeApi();
    await renderHome({ api });
    fireEvent.click(button('Nom du lieu'));
    const sheet = within(await screen.findByRole('dialog', { name: 'Renommer le lieu' }));
    api.setOffline('reject');
    fireEvent.change(sheet.getByLabelText('Nom du lieu'), { target: { value: 'Cave' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect((await sheet.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect((sheet.getByLabelText('Nom du lieu') as HTMLInputElement).value).toBe('Cave');
  });

  it('« Lieu principal » hors ligne : « Nécessite le réseau », l’interrupteur revient', async () => {
    const api = createFakeApi();
    await renderHome({ api });
    api.setOffline('reject');
    const primary = screen.getByRole('switch', { name: 'Lieu principal' });
    fireEvent.click(primary);
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    await until(() => primary.getAttribute('aria-checked') === 'false');
    expect(screen.getByText(PRIMARY_NOTE)).toBeTruthy();
  });

  it('« Supprimer ce lieu » → confirmation → DELETE {} → retour à la liste', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', { status: 204 });
    const view = await renderHome({ api });
    const danger = region('Zone sensible');
    expect(
      danger.getByText('Le lieu sera retiré de ta liste. Les séances passées y restent rattachées.'),
    ).toBeTruthy();
    fireEvent.click(danger.getByRole('button', { name: 'Supprimer ce lieu' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Supprimer Garage ?' }));
    expect(dialog.queryByRole('group', { name: 'Nouveau lieu principal' })).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await until(() => sent(api, 'DELETE', '/api/places/p-2').length === 1);
    expect(sent(api, 'DELETE', '/api/places/p-2')).toEqual([{}]);
    await until(() => view.location() === '/places');
  });

  it('supprimer le lieu principal : choix du nouveau lieu principal → DELETE { newPrimaryId } (R-LIEU-4)', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', { status: 204 });
    await renderHome({ api, garagePrimary: true });
    fireEvent.click(button('Supprimer ce lieu'));
    const dialog = within(await screen.findByRole('dialog', { name: 'Supprimer Garage ?' }));
    const choices = within(dialog.getByRole('group', { name: 'Nouveau lieu principal' }));
    expect(choices.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['Basic Fit']);
    expect((dialog.getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(true);
    choose('Basic Fit');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await until(() => sent(api, 'DELETE', '/api/places/p-2').length === 1);
    expect(sent(api, 'DELETE', '/api/places/p-2')).toEqual([{ newPrimaryId: 'p-1' }]);
  });

  it('boîte de suppression : « Annuler » rend le focus à « Supprimer ce lieu »', async () => {
    await renderHome();
    const remove = button('Supprimer ce lieu');
    remove.focus();
    fireEvent.click(remove);
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(document.activeElement).toBe(remove);
  });

  it('409 last_place : « Tu dois garder au moins un lieu. »', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', {
      status: 409,
      body: { error: 'last_place' },
    });
    await renderHome({ api });
    fireEvent.click(button('Supprimer ce lieu'));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    expect((await dialog.findByRole('alert')).textContent).toBe(KEEP_ONE);
  });

  it("409 primary_required : « Choisis d'abord un nouveau lieu principal. »", async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', {
      status: 409,
      body: { error: 'primary_required' },
    });
    await renderHome({ api, garagePrimary: true });
    fireEvent.click(button('Supprimer ce lieu'));
    const dialog = within(await screen.findByRole('dialog'));
    choose('Basic Fit');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    expect((await dialog.findByRole('alert')).textContent).toBe("Choisis d'abord un nouveau lieu principal.");
  });

  it('lieu inconnu : « Lieu introuvable. »', async () => {
    const db = createTestLocalDb();
    await seedPlaces(db);
    await renderWithServices(<PlaceDetail params={{ id: 'p-9' }} />, { db });
    expect(await screen.findByText('Lieu introuvable.')).toBeTruthy();
  });
});

describe('routes des lieux', () => {
  it('/places et /places/:id dans la coquille', async () => {
    const db = createTestLocalDb();
    await seedPlaces(db);
    await renderApp({ path: '/places', db });
    expect(await screen.findByRole('heading', { level: 1, name: 'Salles' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Garage' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Garage' })).toBeTruthy();
  });
});
