import { defaultLoadSettings, EQUIPMENT_LABELS, type MeResponse } from '@appsport/contracts';
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

const VISIBLE = 'Visible à la salle';
const KEEP_ONE = 'Tu dois garder au moins un lieu.';
const MINOR_HINT = 'Désactivé par défaut pour les moins de 18 ans.';

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
    // « Garage » principale vient après « Basic Fit » par l'id, le nom et l'ordre d'écriture.
    await renderPlaces({ garagePrimary: true });
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('a')?.textContent);
    expect(names).toEqual(['Garage', 'Basic Fit']);
    expect(place('Garage').getByText('Principal')).toBeTruthy();
    expect(place('Basic Fit').queryByText('Principal')).toBeNull();
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

  it('renommer hors ligne : « Nécessite le réseau », le formulaire garde la saisie', async () => {
    const api = createFakeApi();
    await renderPlaces({ api });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Renommer' }));
    api.setOffline('reject');
    fireEvent.change(place('Garage').getByLabelText('Nom du lieu'), { target: { value: 'Cave' } });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Enregistrer' }));
    expect((await place('Garage').findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect((place('Garage').getByLabelText('Nom du lieu') as HTMLInputElement).value).toBe('Cave');
  });

  it('« Renommer » : le focus va au champ, puis revient à « Renommer » après « Annuler » ou « Enregistrer »', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    await renderPlaces({ api });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Renommer' }));
    expect(document.activeElement).toBe(place('Garage').getByLabelText('Nom du lieu'));
    fireEvent.click(place('Garage').getByRole('button', { name: 'Annuler' }));
    expect(document.activeElement).toBe(place('Garage').getByRole('button', { name: 'Renommer' }));
    fireEvent.click(place('Garage').getByRole('button', { name: 'Renommer' }));
    fireEvent.change(place('Garage').getByLabelText('Nom du lieu'), { target: { value: 'Cave' } });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Enregistrer' }));
    await until(() => document.activeElement === place('Garage').queryByRole('button', { name: 'Renommer' }));
  });

  it('renommage : « Enregistrer » et « Annuler » décrits par le nom du lieu', async () => {
    await renderPlaces();
    fireEvent.click(place('Garage').getByRole('button', { name: 'Renommer' }));
    const nameId = screen.getByRole('link', { name: 'Garage' }).id;
    for (const name of ['Enregistrer', 'Annuler']) {
      const described = place('Garage').getByRole('button', { name }).getAttribute('aria-describedby');
      expect(described?.split(' ')).toContain(nameId);
    }
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
    const { db } = await renderPlaces({ api });
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
    // Miroir relu (un autre appareil a remis la visibilité) : il fait foi.
    await seedMirror(db, 'place', [{ ...GYM_PLACE, visibleAtGym: true }]);
    await until(() => visible.checked);
  });

  it("« Visible à la salle » : décrite par le nom du lieu et par l'aide « Coché : … »", async () => {
    await renderPlaces();
    const visible = place('Basic Fit').getByRole('checkbox', { name: VISIBLE });
    const described = visible.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(described).toContain(screen.getByRole('link', { name: 'Basic Fit' }).id);
    const hint = place('Basic Fit').getByText('Coché : ton pseudo apparaît dans « Qui va à cette salle ».');
    expect(described).toContain(hint.id);
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

  it('suppression : le focus va au lieu restant ; « Annuler » le rend à « Supprimer »', async () => {
    const api = createFakeApi();
    const { db } = await renderPlaces({ api });
    // Le pull qui suit la suppression retire le lieu du miroir.
    api.on('DELETE', '/api/places/:id', async () => {
      await seedMirror(db, 'place', [{ ...HOME_PLACE, deletedAt: '2026-10-06T12:00:00.000Z' }]);
      return { status: 204 };
    });
    fireEvent.click(place('Garage').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(document.activeElement).toBe(place('Garage').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(place('Garage').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await until(() => screen.queryByRole('link', { name: 'Garage' }) === null);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Basic Fit' }));
  });

  it('boîte de suppression : une relecture de la liste ou un envoi ne reprend pas le focus', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', {
      status: 409,
      body: { error: 'primary_required' },
    });
    const { db } = await renderPlaces({ api });
    fireEvent.click(place('Basic Fit').getByRole('button', { name: 'Supprimer' }));
    const dialog = within(await screen.findByRole('dialog'));
    const garage = dialog.getByRole('radio', { name: 'Garage' });
    fireEvent.click(garage);
    garage.focus();
    // Pull en arrière-plan : la liste des lieux est relue et rendue de nouveau.
    await seedMirror(db, 'home_equipment', [
      { id: 'p-2:table', ownerId: 'u-1', placeId: 'p-2', equipmentCode: 'table' },
    ]);
    await settle();
    expect(document.activeElement).toBe(garage);
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await dialog.findByRole('alert');
    expect(document.activeElement).toBe(garage);
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
    await until(() => document.activeElement === screen.queryByRole('button', { name: 'Ajouter une salle' }));
  });

  it('« Ajouter une salle » : le focus va au titre du formulaire, puis revient au bouton après « Annuler »', async () => {
    const api = createFakeApi().on('GET', '/api/gyms', { status: 200, body: [] });
    await renderPlaces({ api });
    fireEvent.click(button('Ajouter une salle'));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Ajouter une salle' }));
    fireEvent.click(button('Annuler'));
    expect(document.activeElement).toBe(button('Ajouter une salle'));
  });

  it('« Ajouter une maison » : le focus va au titre du formulaire, puis revient au bouton après « Annuler »', async () => {
    await renderPlaces();
    fireEvent.click(button('Ajouter une maison'));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Ajouter une maison' }),
    );
    fireEvent.click(button('Annuler'));
    expect(document.activeElement).toBe(button('Ajouter une maison'));
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
    await until(
      () => document.activeElement === screen.queryByRole('button', { name: 'Ajouter une maison' }),
    );
  });
});

describe('PlaceDetail', () => {
  it('maison : cocher → PUT …/equipment/<code> {} ; décocher → DELETE (R-LIEU-3)', async () => {
    const api = createFakeApi()
      .on('PUT', '/api/places/:id/equipment/:code', { status: 204 })
      .on('DELETE', '/api/places/:id/equipment/:code', { status: 204 });
    const { db } = await renderDetail('p-2', { api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Garage' })).toBeTruthy();
    expect(checkbox(EQUIPMENT_LABELS.chair).checked).toBe(true);
    fireEvent.click(checkbox(EQUIPMENT_LABELS.dumbbells));
    await until(() => sent(api, 'PUT', '/api/places/p-2/equipment/dumbbells').length === 1);
    expect(sent(api, 'PUT', '/api/places/p-2/equipment/dumbbells')).toEqual([{}]);
    await until(() => !checkbox(EQUIPMENT_LABELS.chair).disabled);
    // Envoi réussi, miroir pas encore relu : la case garde le choix.
    expect(checkbox(EQUIPMENT_LABELS.dumbbells).checked).toBe(true);
    // Miroir relu sans haltères (retirés depuis un autre appareil) : il fait foi.
    await seedMirror(db, 'home_equipment', [
      { id: 'p-2:chair', ownerId: 'u-1', placeId: 'p-2', equipmentCode: 'chair' },
    ]);
    await until(() => !checkbox(EQUIPMENT_LABELS.dumbbells).checked);
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
