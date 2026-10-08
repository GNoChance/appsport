import { defaultLoadSettings, EQUIPMENT_LABELS, type MeResponse } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceDetail } from '../../src/features/places/PlaceDetail';
import { PlacesPage } from '../../src/features/places/PlacesPage';
import type { AppDb } from '../../src/local-db/db';
import { fill } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, checkbox, choose, seedPrimaryGym } from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const VISIBLE = 'Visible à la salle';
const KEEP_ONE = 'Tu dois garder au moins un lieu.';
const MINOR_HINT = 'Désactivé par défaut pour les moins de 18 ans.';

/** p-1 : salle « Basic Fit » (Lyon), principale et visible ; p-2 : maison « Garage » (sauf `single`). */
async function seedPlaces(db: AppDb, o: { single?: boolean } = {}) {
  await seedPrimaryGym(db);
  await seedMirror(db, 'gym_equipment', [
    { id: 'g-1:barbell', gymId: 'g-1', equipmentCode: 'barbell' },
    { id: 'g-1:flat_bench', gymId: 'g-1', equipmentCode: 'flat_bench' },
  ]);
  if (o.single) return;
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
  await seedMirror(db, 'home_equipment', [
    { id: 'p-2:chair', ownerId: 'u-1', placeId: 'p-2', equipmentCode: 'chair' },
  ]);
}

async function renderPlaces(o: { me?: MeResponse; api?: FakeApi; single?: boolean } = {}) {
  const db = createTestLocalDb();
  await seedPlaces(db, o);
  const rendered = await renderWithServices(<PlacesPage />, { me: o.me, db, api: o.api });
  await screen.findByRole('link', { name: 'Basic Fit' });
  return rendered;
}

async function renderDetail(id: string, o: { api?: FakeApi } = {}) {
  const db = createTestLocalDb();
  await seedPlaces(db);
  return renderWithServices(<PlaceDetail params={{ id }} />, { db, api: o.api });
}

/** Élément de liste du lieu nommé `name`. */
function place(name: string) {
  const item = screen.getByRole('link', { name }).closest('li');
  if (!item) throw new Error(`lieu ${name} introuvable`);
  return within(item);
}

const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

describe('PlacesPage (02 §11 Lieux, R-LIEU-1 à R-LIEU-4)', () => {
  it("le principal d'abord avec le badge « Principal », puis les autres", async () => {
    await renderPlaces();
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('a')?.textContent);
    expect(names).toEqual(['Basic Fit', 'Garage']);
    expect(place('Basic Fit').getByText('Principal')).toBeTruthy();
    expect(place('Garage').queryByText('Principal')).toBeNull();
    expect(place('Basic Fit').getByText('Salle · Lyon')).toBeTruthy();
    expect(place('Garage').getByText('Maison')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Garage' }).getAttribute('href')).toBe('/profile/places/p-2');
  });

  it('« Définir comme principal » → PATCH { isPrimary: true } ; absent sur le principal', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    await renderPlaces({ api });
    expect(place('Basic Fit').queryByRole('button', { name: 'Définir comme principal' })).toBeNull();
    fireEvent.click(place('Garage').getByRole('button', { name: 'Définir comme principal' }));
    await until(() => sent(api, 'PATCH', '/api/places/p-2').length === 1);
    expect(sent(api, 'PATCH', '/api/places/p-2')).toEqual([{ isPrimary: true }]);
  });

  it("renommer une maison → PATCH { name }, 30 caractères au plus ; pas de renommage d'une salle", async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    await renderPlaces({ api });
    expect(place('Basic Fit').queryByRole('button', { name: 'Renommer' })).toBeNull();
    fireEvent.click(place('Garage').getByRole('button', { name: 'Renommer' }));
    const name = place('Garage').getByLabelText('Nom du lieu') as HTMLInputElement;
    expect(name.value).toBe('Garage');
    expect(name.maxLength).toBe(30);
    fireEvent.change(name, { target: { value: 'Cave' } });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Enregistrer' }));
    await until(() => sent(api, 'PATCH', '/api/places/p-2').length === 1);
    expect(sent(api, 'PATCH', '/api/places/p-2')).toEqual([{ name: 'Cave' }]);
    await until(() => place('Garage').queryByLabelText('Nom du lieu') === null);
  });

  it('nom vide : message local, aucune requête', async () => {
    const api = createFakeApi();
    await renderPlaces({ api });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Renommer' }));
    fireEvent.change(place('Garage').getByLabelText('Nom du lieu'), { target: { value: '  ' } });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Enregistrer' }));
    expect(place('Garage').getByText('Donne un nom à ce lieu.')).toBeTruthy();
    expect(sent(api, 'PATCH', '/api/places/p-2')).toEqual([]);
  });

  it('« Visible à la salle » décoché → PATCH { visibleAtGym: false } (R-VIS-3) ; pas de case pour une maison', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    await renderPlaces({ api });
    expect(place('Garage').queryByRole('checkbox')).toBeNull();
    const visible = place('Basic Fit').getByRole('checkbox', { name: VISIBLE }) as HTMLInputElement;
    expect(visible.checked).toBe(true);
    expect(screen.queryByText(MINOR_HINT)).toBeNull();
    fireEvent.click(visible);
    await until(() => sent(api, 'PATCH', '/api/places/p-1').length === 1);
    expect(sent(api, 'PATCH', '/api/places/p-1')).toEqual([{ visibleAtGym: false }]);
    // Envoi réussi, miroir pas encore relu : la case garde le choix.
    await until(() => !visible.disabled);
    expect(visible.checked).toBe(false);
  });

  it('« Visible à la salle » hors ligne : « Nécessite le réseau », la case revient', async () => {
    const api = createFakeApi();
    await renderPlaces({ api });
    api.setOffline('reject');
    const visible = place('Basic Fit').getByRole('checkbox', { name: VISIBLE }) as HTMLInputElement;
    fireEvent.click(visible);
    expect((await place('Basic Fit').findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(visible.checked).toBe(true);
  });

  it('mineur : la case reste au choix, avec la raison du défaut (P-MIN-6)', async () => {
    await renderPlaces({ me: makeMe({ ageBand: 'minor' }) });
    const visible = place('Basic Fit').getByRole('checkbox', { name: VISIBLE }) as HTMLInputElement;
    expect(visible.disabled).toBe(false);
    expect(place('Basic Fit').getByText(MINOR_HINT)).toBeTruthy();
  });

  it('hors ligne : « Nécessite le réseau »', async () => {
    const api = createFakeApi();
    await renderPlaces({ api });
    api.setOffline('reject');
    fireEvent.click(place('Garage').getByRole('button', { name: 'Définir comme principal' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
  });

  it('« Supprimer » une maison → confirmation → DELETE {}', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', { status: 204 });
    await renderPlaces({ api });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Supprimer' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Supprimer Garage ?' }));
    expect(dialog.queryByRole('group', { name: 'Nouveau lieu principal' })).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await until(() => sent(api, 'DELETE', '/api/places/p-2').length === 1);
    expect(sent(api, 'DELETE', '/api/places/p-2')).toEqual([{}]);
    await until(() => screen.queryByRole('dialog') === null);
  });

  it('« Supprimer » le principal : choix du nouveau lieu principal → DELETE { newPrimaryId } (R-LIEU-4)', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', { status: 204 });
    await renderPlaces({ api });
    fireEvent.click(place('Basic Fit').getByRole('button', { name: 'Supprimer' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Supprimer Basic Fit ?' }));
    const choices = within(dialog.getByRole('group', { name: 'Nouveau lieu principal' }));
    expect(choices.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['Garage']);
    expect((dialog.getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(true);
    choose('Garage');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await until(() => sent(api, 'DELETE', '/api/places/p-1').length === 1);
    expect(sent(api, 'DELETE', '/api/places/p-1')).toEqual([{ newPrimaryId: 'p-2' }]);
  });

  it('un seul lieu : « Supprimer » désactivé, « Tu dois garder au moins un lieu. »', async () => {
    await renderPlaces({ single: true });
    const remove = place('Basic Fit').getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    const reason = place('Basic Fit').getByText(KEEP_ONE);
    expect(remove.getAttribute('aria-describedby')?.split(' ')).toContain(reason.id);
  });

  it('409 last_place : même message', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', {
      status: 409,
      body: { error: 'last_place' },
    });
    await renderPlaces({ api });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Supprimer' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    expect((await dialog.findByRole('alert')).textContent).toBe(KEEP_ONE);
  });

  it("409 primary_required : « Choisis d'abord un nouveau lieu principal. »", async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', {
      status: 409,
      body: { error: 'primary_required' },
    });
    await renderPlaces({ api });
    fireEvent.click(place('Basic Fit').getByRole('button', { name: 'Supprimer' }));
    const dialog = within(await screen.findByRole('dialog'));
    choose('Garage');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    expect((await dialog.findByRole('alert')).textContent).toBe("Choisis d'abord un nouveau lieu principal.");
  });

  it('« Ajouter une salle » → GymPicker (non principal, visible par défaut pour un adulte)', async () => {
    const api = createFakeApi()
      .on('GET', '/api/gyms', {
        status: 200,
        body: [{ id: 'g-2', name: 'Fitness Park', city: 'Lyon', visibleMemberCount: 0 }],
      })
      .on('POST', '/api/places', { status: 201, body: { id: 'p-3' } });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une salle'));
    const gym = 'Fitness Park · Lyon · 0 membre visible';
    await screen.findByRole('radio', { name: gym });
    expect(checkbox('Apparaître dans « Qui va à cette salle »').checked).toBe(true);
    choose(gym);
    fireEvent.click(button('Valider'));
    await until(() => sent(api, 'POST', '/api/places').length === 1);
    expect(sent(api, 'POST', '/api/places')).toEqual([
      { kind: 'gym', gymId: 'g-2', isPrimary: false, visibleAtGym: true },
    ]);
    await until(() => screen.queryByRole('button', { name: 'Valider' }) === null);
  });

  it('« Ajouter une salle » pour un mineur : case décochée par défaut', async () => {
    const api = createFakeApi().on('GET', '/api/gyms', { status: 200, body: [] });
    await renderPlaces({ api, me: makeMe({ ageBand: 'minor' }) });
    fireEvent.click(button('Ajouter une salle'));
    await screen.findByText('Aucune salle trouvée.');
    expect(checkbox('Apparaître dans « Qui va à cette salle »').checked).toBe(false);
  });

  it('« Ajouter une maison » → POST { kind: home, name, equipment, isPrimary: false }', async () => {
    const api = createFakeApi().on('POST', '/api/places', { status: 201, body: { id: 'p-3' } });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une maison'));
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
    await until(() => screen.queryByRole('button', { name: 'Ajouter la maison' }) === null);
  });
});

describe('PlaceDetail', () => {
  it('maison : cocher → PUT …/equipment/<code> {} ; décocher → DELETE (R-LIEU-3)', async () => {
    const api = createFakeApi()
      .on('PUT', '/api/places/:id/equipment/:code', { status: 204 })
      .on('DELETE', '/api/places/:id/equipment/:code', { status: 204 });
    await renderDetail('p-2', { api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Garage' })).toBeTruthy();
    expect(checkbox(EQUIPMENT_LABELS.chair).checked).toBe(true);
    fireEvent.click(checkbox(EQUIPMENT_LABELS.dumbbells));
    await until(() => sent(api, 'PUT', '/api/places/p-2/equipment/dumbbells').length === 1);
    expect(sent(api, 'PUT', '/api/places/p-2/equipment/dumbbells')).toEqual([{}]);
    await until(() => !checkbox(EQUIPMENT_LABELS.chair).disabled);
    fireEvent.click(checkbox(EQUIPMENT_LABELS.chair));
    await until(() => sent(api, 'DELETE', '/api/places/p-2/equipment/chair').length === 1);
  });

  it('maison hors ligne : « Nécessite le réseau », la case revient', async () => {
    const api = createFakeApi();
    await renderDetail('p-2', { api });
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    api.setOffline('reject');
    fireEvent.click(checkbox(EQUIPMENT_LABELS.dumbbells));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(checkbox(EQUIPMENT_LABELS.dumbbells).checked).toBe(false);
  });

  it('salle : matériel en lecture, lien « Voir la salle », aucune case', async () => {
    await renderDetail('p-1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(screen.getByText(EQUIPMENT_LABELS.barbell)).toBeTruthy();
    expect(screen.getByText(EQUIPMENT_LABELS.flat_bench)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir la salle' }).getAttribute('href')).toBe('/gyms/g-1');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('lieu inconnu : « Lieu introuvable. »', async () => {
    await renderDetail('p-9');
    expect(await screen.findByText('Lieu introuvable.')).toBeTruthy();
  });
});

describe('routes des lieux', () => {
  it('/profile/places et /profile/places/:id dans la coquille', async () => {
    const db = createTestLocalDb();
    await seedPlaces(db);
    await renderApp({ path: '/profile/places', db });
    expect(await screen.findByRole('heading', { level: 1, name: 'Lieux' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Garage' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Garage' })).toBeTruthy();
  });
});
