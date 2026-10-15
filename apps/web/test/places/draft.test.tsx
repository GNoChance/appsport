import { defaultLoadSettings, EQUIPMENT, type EquipmentCode, type GymDetail } from '@rune/contracts';
import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeSummary } from '../../src/features/places/EquipmentDraft';
import { GymPage } from '../../src/features/places/GymPage';
import { PlaceDetail } from '../../src/features/places/PlaceDetail';
import { useSubScreen } from '../../src/features/places/SubScreen';
import type { AppDb } from '../../src/local-db/db';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, checkbox, seedPrimaryGym, writes } from '../support/onboarding';
import { renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const SERVER_EQUIPMENT: EquipmentCode[] = ['dumbbells', 'flat_bench', 'barbell'];
/** Nom de l'interrupteur de visibilité : « Visible » à l'écran, la suite pour les lecteurs d'écran (maquette D02). */
const VISIBLE = 'Visible dans « Qui va à cette salle »';

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

/**
 * Faux serveur du matériel de la maison p-2 : chaque appel accepté est écrit dans le miroir, comme le pull qui
 * le suit. `fail` : réponse d'erreur pour un appel donné (« DELETE chair »…).
 */
function serveHome(api: FakeApi, db: AppDb, o: { fail?: Record<string, number> } = {}) {
  for (const method of ['PUT', 'DELETE'] as const) {
    api.on(method, '/api/places/:id/equipment/:code', async (req) => {
      const code = req.path.split('/').at(-1) as EquipmentCode;
      const status = o.fail?.[`${method} ${code}`];
      if (status) return { status, body: { error: 'internal' } };
      await seedMirror(db, 'home_equipment', [
        {
          id: `p-2:${code}`,
          ownerId: 'u-1',
          placeId: 'p-2',
          equipmentCode: code,
          deletedAt: method === 'DELETE' ? '2026-10-06T12:00:00.000Z' : null,
        },
      ]);
      return { status: 204 };
    });
  }
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
/** Texte exact du résumé de la barre (« 1 changement · 1 ajout »), sans ses boutons ni son erreur. */
const summary = () => draftBar()?.querySelector('p')?.textContent ?? null;
const gets = (api: FakeApi) => api.calls.filter((c) => c.method === 'GET' && c.path === '/api/gyms/g-1');
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

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

describe('changeSummary (maquette D03)', () => {
  it('le nombre de changements, puis ajouts et retraits ; la partie nulle est tue', () => {
    expect(changeSummary({ added: ['kettlebell'], removed: [] })).toEqual({
      total: '1 changement',
      detail: '1 ajout',
    });
    expect(changeSummary({ added: [], removed: ['flat_bench'] })).toEqual({
      total: '1 changement',
      detail: '1 retrait',
    });
    expect(changeSummary({ added: ['kettlebell', 'box'], removed: ['flat_bench'] })).toEqual({
      total: '3 changements',
      detail: '2 ajouts, 1 retrait',
    });
    expect(changeSummary({ added: [], removed: ['flat_bench', 'barbell'] })).toEqual({
      total: '2 changements',
      detail: '2 retraits',
    });
  });
});

describe('matériel en brouillon (spec refonte §10.3)', () => {
  it('cocher puis décocher le même équipement : 0 changement, aucun appel', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    expect(draftBar()).toBeNull();
    fireEvent.click(checkbox('Kettlebell'));
    expect(checkbox('Kettlebell').checked).toBe(true);
    expect(summary()).toBe('1 changement · 1 ajout');
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
    expect(summary()).toBe('2 changements · 1 ajout, 1 retrait');
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
    const server = serveGym(api);
    const db = createTestLocalDb();
    await seedPlaces(db);
    const view = await renderApp({ path: '/gyms/g-1', db, api });
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    expect(checkbox('Kettlebell').checked).toBe(true);
    // Retour de l'écran Matériel : la fiche montre le matériel du serveur, le brouillon est abandonné.
    fireEvent.click(button('Retour'));
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(region('Matériel').queryByText('Kettlebell')).toBeNull();
    await openEditor();
    expect(checkbox('Kettlebell').checked).toBe(false);
    expect(draftBar()).toBeNull();
    // Brouillon de nouveau, puis départ de la fiche par l'onglet Salles.
    fireEvent.click(checkbox('Kettlebell'));
    expect(checkbox('Kettlebell').checked).toBe(true);
    expect(summary()).toBe('1 changement · 1 ajout');
    const tabs = within(screen.getByRole('navigation', { name: 'Navigation principale' }));
    fireEvent.click(tabs.getByRole('link', { name: 'Salles' }));
    await until(() => view.location() === '/places');
    // Pendant l'absence, un autre membre ajoute la box sur le serveur : le retour la relit.
    server.add('box');
    fireEvent.click(await screen.findByRole('link', { name: 'Basic Fit' }));
    await until(() => view.location() === '/gyms/g-1');
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(region('Matériel').getByText('Box ou step stable')).toBeTruthy();
    expect(region('Matériel').queryByText('Kettlebell')).toBeNull();
    await openEditor();
    expect(checkbox('Box ou step stable').checked).toBe(true);
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
    expect(summary()).toBe('1 changement · 1 ajout');
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
    await until(() => summary() === '1 changement · 1 retrait');
    expect(checkbox('Kettlebell').checked).toBe(true);
    expect(checkbox('Banc plat').checked).toBe(false);
    expect(writes(api)).toEqual([
      'PUT /api/gyms/g-1/equipment/kettlebell',
      'DELETE /api/gyms/g-1/equipment/flat_bench',
    ]);
  });

  it('maison : le brouillon part d’un coup sur les routes du lieu, puis la fiche montre le matériel relu', async () => {
    const api = createFakeApi();
    const db = createTestLocalDb();
    await seedPlaces(db);
    serveHome(api, db);
    await renderWithServices(<PlaceDetail params={{ id: 'p-2' }} />, { api, db });
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    await openEditor();
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(checkbox('Chaise ou banc stable'));
    openCategory('Petit matériel');
    fireEvent.click(checkbox('Haltères fixes ou réglables'));
    expect(summary()).toBe('2 changements · 1 ajout, 1 retrait');
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    expect(writes(api)).toEqual([
      'PUT /api/places/p-2/equipment/dumbbells',
      'DELETE /api/places/p-2/equipment/chair',
    ]);
    await until(() => region('Matériel').queryByText('Haltères fixes ou réglables') !== null);
    expect(region('Matériel').queryByText('Chaise ou banc stable')).toBeNull();
  });

  it('maison, échec d’un appel : le brouillon reste, l’erreur s’affiche, le miroir est relu', async () => {
    const api = createFakeApi();
    const db = createTestLocalDb();
    await seedPlaces(db);
    serveHome(api, db, { fail: { 'DELETE chair': 500 } });
    const { sync } = await renderWithServices(<PlaceDetail params={{ id: 'p-2' }} />, { api, db });
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    await openEditor();
    fireEvent.click(checkbox('Chaise ou banc stable'));
    openCategory('Petit matériel');
    fireEvent.click(checkbox('Haltères fixes ou réglables'));
    const pulls = sync.pullCount;
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    expect((await within(draftBar() as HTMLElement).findByRole('alert')).textContent).toBe(
      'Le serveur a rencontré une erreur.',
    );
    // Le PUT a été suivi de son pull ; après l'échec du DELETE, l'écran relit encore l'état du serveur.
    expect(sync.pullCount).toBe(pulls + 2);
    await until(() => draftBar()?.textContent?.includes('1 changement · 1 retrait') ?? false);
    expect(screen.getByRole('heading', { level: 1, name: 'Matériel' })).toBeTruthy();
    expect(checkbox('Chaise ou banc stable').checked).toBe(false);
    expect(checkbox('Haltères fixes ou réglables').checked).toBe(true);
  });

  it('« Retour » pendant l’enregistrement : ignoré ; l’envoi finit, son erreur s’affiche, le brouillon reste', async () => {
    const api = createFakeApi();
    serveGym(api);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.on('PUT', '/api/gyms/:id/equipment/:code', async () => {
      await held;
      return { status: 500, body: { error: 'internal' } };
    });
    await renderGym(api);
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Enregistrer' }));
    await until(() => writes(api).length === 1);
    fireEvent.click(button('Retour'));
    expect(screen.getByRole('heading', { level: 1, name: 'Matériel' })).toBeTruthy();
    release();
    expect((await within(draftBar() as HTMLElement).findByRole('alert')).textContent).toBe(
      'Le serveur a rencontré une erreur.',
    );
    expect(checkbox('Kettlebell').checked).toBe(true);
    // Plus rien en cours : « Retour » quitte de nouveau l'écran, sans rien envoyer de plus.
    fireEvent.click(button('Retour'));
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(writes(api)).toEqual(['PUT /api/gyms/g-1/equipment/kettlebell']);
  });

  // Spec refonte §7 : « un choix fait un petit ressort », pas l'affichage d'une case déjà cochée.
  it('la coche ne fait son ressort que sur un choix : ni à l’ouverture, ni au dépliage d’une catégorie', async () => {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    const popping = () => document.querySelectorAll('[data-pop]').length;
    expect(checkbox('Haltères fixes ou réglables').checked).toBe(true);
    expect(popping()).toBe(0);
    openCategory('Bancs et supports');
    expect(checkbox('Banc plat').checked).toBe(true);
    expect(popping()).toBe(0);
    fireEvent.click(checkbox('Kettlebell'));
    const chip = checkbox('Kettlebell').closest('label') as HTMLElement;
    expect(chip.hasAttribute('data-pop')).toBe(true);
    expect(popping()).toBe(1);
    // Fin du ressort : l'attribut s'en va, la pastille ne rejouera rien en se réaffichant.
    fireEvent.animationEnd(chip.querySelector('[aria-hidden="true"]') as Element);
    expect(chip.hasAttribute('data-pop')).toBe(false);
    // Décocher ne fait pas de ressort.
    fireEvent.click(checkbox('Banc plat'));
    expect(popping()).toBe(0);
    // Catégorie repliée pendant un ressort : il s'arrête là, la déplier ne le rejoue pas.
    fireEvent.click(checkbox('Kettlebell'));
    fireEvent.click(checkbox('Kettlebell'));
    expect(popping()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /^Petit matériel/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Petit matériel/ }));
    expect(popping()).toBe(0);
  });
});

// WCAG 2.2, 2.4.11 : la barre collée en bas (z-index 10, opaque) ne doit pas cacher le contrôle qui a le focus.
describe('barre des changements : le focus ne finit pas dessous (WCAG 2.2, 2.4.11)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('tant qu’elle est là, la racine garde sa hauteur mesurée, qui suit ses changements de taille', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(110);
    const resized: Array<() => void> = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {
          disconnect();
        }
      },
    );
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    const reserved = () => document.documentElement.style.getPropertyValue('--draft-bar-height');
    expect(reserved()).toBe('');
    fireEvent.click(checkbox('Kettlebell'));
    expect(reserved()).toBe('110px');
    // Une erreur ou un texte agrandi fait grandir la barre : la place gardée suit.
    height.mockReturnValue(172);
    act(() => {
      for (const callback of resized) callback();
    });
    expect(reserved()).toBe('172px');
    fireEvent.click(within(draftBar() as HTMLElement).getByRole('button', { name: 'Annuler' }));
    expect(reserved()).toBe('');
    expect(disconnect).toHaveBeenCalled();
  });

  /** Écran Matériel avec un changement en attente ; ce que touche le centre d'un contrôle est simulé. */
  async function withBar() {
    const api = createFakeApi();
    serveGym(api);
    await renderGym(api);
    await openEditor();
    fireEvent.click(checkbox('Kettlebell'));
    const bar = draftBar() as HTMLElement;
    const scroll = vi.fn();
    const chip = checkbox('Haltères fixes ou réglables');
    const cancel = within(bar).getByRole('button', { name: 'Annuler' }) as HTMLButtonElement;
    for (const el of [chip, cancel]) el.scrollIntoView = scroll;
    const pointHits = (el: Element | null) => vi.spyOn(document, 'elementFromPoint').mockReturnValue(el);
    return { chip, cancel, scroll, pointHits };
  }

  // scroll-padding-bottom suffit à la tabulation et à Chromium ; WebKit l'ignore pour focus().
  it('la barre recouvre le centre du contrôle qui prend le focus : il défile au plus près, au-dessus d’elle', async () => {
    const { chip, cancel, scroll, pointHits } = await withBar();
    pointHits(cancel);
    act(() => chip.focus());
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
  });

  it('contrôle visible, hors de la fenêtre, ou dans la barre elle-même : rien ne défile', async () => {
    const { chip, cancel, scroll, pointHits } = await withBar();
    pointHits(chip);
    act(() => chip.focus());
    act(() => chip.blur());
    pointHits(null);
    act(() => chip.focus());
    act(() => chip.blur());
    pointHits(cancel);
    act(() => cancel.focus());
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe('écrans ouverts sur place (useSubScreen)', () => {
  // Filet : une action finie après le départ de son écran (puis la réouverture d'un autre) ne le ferme pas.
  it('une fermeture en retard, venue d’un écran déjà quitté, ne ferme pas celui rouvert depuis', () => {
    const { result } = renderHook(() => useSubScreen<'equipment'>());
    act(() => result.current.open('equipment', 'modifier'));
    const late = result.current.close;
    act(() => result.current.close());
    expect(result.current.mode).toBeNull();
    act(() => result.current.open('equipment', 'modifier'));
    act(() => late());
    expect(result.current.mode).toBe('equipment');
    act(() => result.current.close());
    expect(result.current.mode).toBeNull();
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
    // Sur ce lieu-ci (« Garage »), jamais sur le lieu principal actuel.
    expect(sent(api, 'PATCH', '/api/places/p-2')).toEqual([{ isPrimary: true }]);
    expect(sent(api, 'PATCH', '/api/places/p-1')).toEqual([]);
  });

  it('la case « Qui va à cette salle » porte l’interrupteur de visibilité de l’utilisateur', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    serveGym(api);
    await renderGym(api);
    const visible = region('Qui va à cette salle').getByRole('switch', { name: VISIBLE });
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
