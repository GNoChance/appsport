import { defaultLoadSettings, EQUIPMENT, type EquipmentCode, type GymDetail } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GymPage } from '../../src/features/places/GymPage';
import { PlaceDetail } from '../../src/features/places/PlaceDetail';
import type { AppDb } from '../../src/local-db/db';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, checkbox, seedPrimaryGym, writes } from '../support/onboarding';
import { renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const SERVER_EQUIPMENT: EquipmentCode[] = ['dumbbells', 'flat_bench', 'barbell'];

function detail(o: Partial<GymDetail> = {}): GymDetail {
  return {
    id: 'g-1',
    name: 'Basic Fit',
    city: 'Lyon',
    loadSettings: defaultLoadSettings('gym'),
    deletedAt: null,
    equipment: SERVER_EQUIPMENT,
    canEdit: true,
    visibleMembers: ['lea', 'max'],
    history: [],
    ...o,
  };
}

/**
 * Faux serveur de la salle g-1 : le matériel suit les PUT et DELETE reçus, la fiche relue le rend.
 * `fail` : réponse d'erreur pour un appel donné (« DELETE flat_bench »…).
 */
function serveGym(api: FakeApi, o: { fail?: Record<string, number> } = {}) {
  const equipment = new Set<EquipmentCode>(SERVER_EQUIPMENT);
  const codeOf = (path: string) => path.split('/').at(-1) as EquipmentCode;
  api.on('GET', '/api/gyms/:id', () => ({
    status: 200,
    body: detail({ equipment: EQUIPMENT.filter((c) => equipment.has(c)) }),
  }));
  for (const method of ['PUT', 'DELETE'] as const) {
    api.on(method, '/api/gyms/:id/equipment/:code', (req) => {
      const code = codeOf(req.path);
      const status = o.fail?.[`${method} ${code}`];
      if (status) return { status, body: { error: 'internal' } };
      if (method === 'PUT') equipment.add(code);
      else equipment.delete(code);
      return { status: 204 };
    });
  }
  return equipment;
}

/** p-1 : salle g-1 principale et visible (miroir du matériel au même état que le serveur) ; p-2 : maison « Garage ». */
async function seedPlaces(db: AppDb) {
  await seedPrimaryGym(db);
  await seedMirror(
    db,
    'gym_equipment',
    SERVER_EQUIPMENT.map((code) => ({ id: `g-1:${code}`, gymId: 'g-1', equipmentCode: code })),
  );
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

async function renderGym(api: FakeApi) {
  const db = createTestLocalDb();
  await seedPlaces(db);
  const view = await renderWithServices(<GymPage params={{ id: 'g-1' }} />, { api, db });
  await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
  await settle();
  return view;
}

const region = (name: string) => within(screen.getByRole('region', { name }));
const draftBar = () => screen.queryByRole('region', { name: 'Changements à enregistrer' });
const gets = (api: FakeApi) => api.calls.filter((c) => c.method === 'GET' && c.path === '/api/gyms/g-1');

/** « Modifier le matériel » : l'écran Matériel de la fiche. */
async function openEditor() {
  fireEvent.click(button('Modifier le matériel'));
  await screen.findByRole('heading', { level: 1, name: 'Matériel' });
}

/** Déplie une catégorie de l'écran Matériel (la première est dépliée à l'ouverture). */
function openCategory(name: string) {
  const toggle = screen.getByRole('button', { name: new RegExp(`^${name}`) });
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
}

describe('matériel en brouillon (spec refonte §10.3)', () => {
  it('cocher puis décocher le même équipement : 0 changement, aucun appel', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    expect(draftBar()).toBeNull();
    fireEvent.click(checkbox('Kettlebell'));
    expect(checkbox('Kettlebell').checked).toBe(true);
    expect(draftBar()?.textContent).toContain('1 changement · 1 ajout');
    fireEvent.click(checkbox('Kettlebell'));
    expect(checkbox('Kettlebell').checked).toBe(false);
    expect(draftBar()).toBeNull();
    await settle();
    expect(writes(api)).toEqual([]);
  });

  it('1 ajout et 1 retrait : « 2 changements · 1 ajout, 1 retrait », « Enregistrer » envoie exactement ces deux appels', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    openCategory('Bancs et supports');
    fireEvent.click(checkbox('Banc plat'));
    expect(draftBar()?.textContent).toContain('2 changements · 1 ajout, 1 retrait');
    await settle();
    expect(writes(api)).toEqual([]);
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    // Fiche relue après l'envoi, puis retour à la fiche, qui montre le matériel du serveur.
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(writes(api)).toEqual([
      'PUT /api/gyms/g-1/equipment/kettlebell',
      'DELETE /api/gyms/g-1/equipment/flat_bench',
    ]);
    expect(gets(api).length).toBeGreaterThanOrEqual(2);
    expect(region('Matériel').getByText('Kettlebell')).toBeTruthy();
    expect(region('Matériel').queryByText('Banc plat')).toBeNull();
  });

  it('« Annuler » remet le brouillon à l’état du serveur, sans appel', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Annuler' }));
    expect(draftBar()).toBeNull();
    expect(checkbox('Kettlebell').checked).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: 'Matériel' })).toBeTruthy();
    await settle();
    expect(writes(api)).toEqual([]);
  });

  it('quitter la fiche sans enregistrer : aucun appel, l’état du serveur est réaffiché au retour', async () => {
    const api = createFakeApi();
    serveGym(api);
    const db = createTestLocalDb();
    await seedPlaces(db);
    const view = await renderApp({ path: '/gyms/g-1', db, api });
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    // Retour de l'écran Matériel : la fiche montre le matériel du serveur.
    fireEvent.click(button('Retour'));
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(region('Matériel').queryByText('Kettlebell')).toBeNull();
    // Brouillon de nouveau, puis départ de la fiche par l'onglet Salles et retour par la salle.
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    const tabs = within(screen.getByRole('navigation', { name: 'Navigation principale' }));
    fireEvent.click(tabs.getByRole('link', { name: 'Salles' }));
    await until(() => view.location() === '/places');
    fireEvent.click(await screen.findByRole('link', { name: 'Basic Fit' }));
    await until(() => view.location() === '/gyms/g-1');
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    await openEditor();
    expect(checkbox('Kettlebell').checked).toBe(false);
    expect(draftBar()).toBeNull();
    await settle();
    expect(writes(api)).toEqual([]);
  });

  it('échec réseau à l’enregistrement : le brouillon reste, l’erreur s’affiche, la fiche est relue', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    const before = gets(api).length;
    api.setOffline('reject');
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    expect((await within(draftBar() as HTMLElement).findByRole('alert')).textContent).toBe(
      'Nécessite le réseau',
    );
    await until(() => gets(api).length > before);
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Matériel' })).toBeTruthy();
    expect(checkbox('Kettlebell').checked).toBe(true);
    expect(draftBar()?.textContent).toContain('1 changement · 1 ajout');
  });

  it('réussite partielle : le reste du brouillon, l’erreur, et le compte relu sur le serveur', async () => {
    const api = createFakeApi();
    serveGym(api, { fail: { 'DELETE flat_bench': 500 } });
    await renderGym(api);
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    openCategory('Bancs et supports');
    fireEvent.click(checkbox('Banc plat'));
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    expect((await within(draftBar() as HTMLElement).findByRole('alert')).textContent).toBe(
      'Le serveur a rencontré une erreur.',
    );
    // L'ajout est passé : relu sur le serveur, il ne compte plus ; le retrait refusé reste à enregistrer.
    await until(() => draftBar()?.textContent?.includes('1 changement · 1 retrait') ?? false);
    expect(checkbox('Kettlebell').checked).toBe(true);
    expect(checkbox('Banc plat').checked).toBe(false);
    expect(writes(api)).toEqual([
      'PUT /api/gyms/g-1/equipment/kettlebell',
      'DELETE /api/gyms/g-1/equipment/flat_bench',
    ]);
  });

  it('maison : le brouillon part d’un coup sur les routes du lieu', async () => {
    const api = createFakeApi()
      .on('PUT', '/api/places/:id/equipment/:code', { status: 204 })
      .on('DELETE', '/api/places/:id/equipment/:code', { status: 204 });
    const db = createTestLocalDb();
    await seedPlaces(db);
    await renderWithServices(<PlaceDetail params={{ id: 'p-2' }} />, { api, db });
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    await openEditor();
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(checkbox('Chaise ou banc stable'));
    openCategory('Petit matériel');
    fireEvent.click(checkbox('Haltères fixes ou réglables'));
    expect(draftBar()?.textContent).toContain('2 changements · 1 ajout, 1 retrait');
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    await until(() => writes(api).length === 2);
    expect(writes(api)).toEqual([
      'PUT /api/places/p-2/equipment/dumbbells',
      'DELETE /api/places/p-2/equipment/chair',
    ]);
  });
});

describe('fiche directe et actions du lieu (spec refonte §10.3)', () => {
  it('toucher une salle dans « Mes lieux » ouvre directement sa fiche', async () => {
    const api = createFakeApi();
    serveGym(api);
    const db = createTestLocalDb();
    await seedPlaces(db);
    const view = await renderApp({ path: '/places', db, api });
    const link = await screen.findByRole('link', { name: 'Basic Fit' });
    expect(link.getAttribute('href')).toBe('/gyms/g-1');
    fireEvent.click(link);
    await until(() => view.location() === '/gyms/g-1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(view.visits()).toEqual(['/places', '/gyms/g-1']);
  });

  it('ancienne adresse du lieu de type salle : remplacée par la fiche de la salle', async () => {
    const api = createFakeApi();
    serveGym(api);
    const db = createTestLocalDb();
    await seedPlaces(db);
    const view = await renderApp({ path: '/places/p-1', db, api });
    await until(() => view.location() === '/gyms/g-1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
  });

  it('l’interrupteur « Lieu principal » est désactivé et coché sur le lieu principal', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    const primary = screen.getByRole('switch', { name: 'Lieu principal' }) as HTMLButtonElement;
    expect(primary.getAttribute('aria-checked')).toBe('true');
    expect(primary.disabled).toBe(true);
    // Les actions du lieu viennent après le matériel et l'historique, la zone sensible en dernier.
    const history = screen.getByRole('region', { name: 'Dernières modifications' });
    const danger = screen.getByRole('region', { name: 'Zone sensible' });
    expect(history.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primary.compareDocumentPosition(danger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('« Lieu principal » sur un autre lieu : actif, décoché ; l’activer envoie PATCH { isPrimary: true }', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    const db = createTestLocalDb();
    await seedPlaces(db);
    await renderWithServices(<PlaceDetail params={{ id: 'p-2' }} />, { api, db });
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    const primary = screen.getByRole('switch', { name: 'Lieu principal' }) as HTMLButtonElement;
    expect(primary.getAttribute('aria-checked')).toBe('false');
    expect(primary.disabled).toBe(false);
    expect(screen.getByText('Actuel : Basic Fit')).toBeTruthy();
    fireEvent.click(primary);
    await until(() => writes(api).length === 1);
    expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isPrimary: true });
  });

  it('la case « Qui va à cette salle » porte l’interrupteur de visibilité de l’utilisateur', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    serveGym(api);
    await renderGym(api);
    const visible = region('Qui va à cette salle').getByRole('switch', { name: 'Visible' });
    expect(visible.getAttribute('aria-checked')).toBe('true');
    const before = gets(api).length;
    fireEvent.click(visible);
    await until(() => writes(api).length === 1);
    expect(api.calls.find((c) => c.method === 'PATCH' && c.path === '/api/places/p-1')?.body).toEqual({
      visibleAtGym: false,
    });
    // Liste des membres relue après le changement.
    await until(() => gets(api).length > before);
  });
});
