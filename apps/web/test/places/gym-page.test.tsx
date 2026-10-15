import { defaultLoadSettings, type GymDetail, type MeResponse } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { actionText } from '../../src/features/places/GymHistory';
import { GymPage } from '../../src/features/places/GymPage';
import type { AppDb } from '../../src/local-db/db';
import { useRepos } from '../../src/repos';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, choose, seedPrimaryGym } from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

type HistoryEntry = GymDetail['history'][number];

const RIGHTS_TEXT = 'Seuls les membres qui ont cette salle parmi leurs lieux peuvent la modifier.';
const NOBODY = "Personne n'est visible pour l'instant.";
const EDIT_INFO = 'Modifier le nom ou la ville';
const EDIT_EQUIPMENT = 'Modifier le matériel';

/** 12 entrées, de la plus récente à la plus ancienne (le serveur en rend au plus 10 ; l'écran borne aussi). */
const HISTORY: HistoryEntry[] = [
  { at: '2026-10-06T12:05:00.000Z', action: 'update_info', authorUsername: null, detail: {} },
  {
    at: '2026-10-06T12:04:00.000Z',
    action: 'add_equipment',
    authorUsername: 'lea',
    detail: { code: 'barbell' },
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    at: `2026-10-05T10:${String(50 - i).padStart(2, '0')}:00.000Z`,
    action: 'remove_equipment' as const,
    authorUsername: 'max',
    detail: { code: 'kettlebell' },
  })),
];

function detail(o: Partial<GymDetail> = {}): GymDetail {
  return {
    id: 'g-1',
    name: 'Basic Fit',
    city: 'Lyon',
    loadSettings: defaultLoadSettings('gym'),
    deletedAt: null,
    equipment: ['dumbbells', 'flat_bench', 'barbell'],
    canEdit: true,
    visibleMembers: ['lea', 'max'],
    history: HISTORY,
    ...o,
  };
}

async function renderGym(o: { detail?: GymDetail; api?: FakeApi; db?: AppDb; me?: MeResponse } = {}) {
  const api = o.api ?? createFakeApi();
  api.on('GET', '/api/gyms/:id', { status: 200, body: o.detail ?? detail() });
  const rendered = await renderWithServices(<GymPage params={{ id: 'g-1' }} />, {
    api,
    db: o.db,
    me: o.me,
  });
  await screen.findByRole('heading', { level: 1 });
  await settle();
  return rendered;
}

/** Miroirs de la salle g-1 « Basic Fit » (Lyon) avec la barre. */
async function seedGymMirror(db: AppDb, o: { deletedAt?: string } = {}) {
  await seedMirror(db, 'gym', [
    {
      id: 'g-1',
      name: 'Basic Fit',
      nameKey: 'basic fit',
      city: 'Lyon',
      cityKey: 'lyon',
      loadSettings: defaultLoadSettings('gym'),
      ...o,
    },
  ]);
  await seedMirror(db, 'gym_equipment', [{ id: 'g-1:barbell', gymId: 'g-1', equipmentCode: 'barbell' }]);
}

/** g-1 parmi les lieux de l'utilisateur (p-1, principal et visible) ; `garage` : une maison p-2 en plus. */
async function dbWithPlace(o: { garage?: boolean } = {}) {
  const db = createTestLocalDb();
  await seedPrimaryGym(db);
  if (o.garage) {
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
  }
  return db;
}

const region = (name: string) => within(screen.getByRole('region', { name }));
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);
const gets = (api: FakeApi) => api.calls.filter((c) => c.method === 'GET' && c.path === '/api/gyms/g-1');

describe('actionText (R-SAL-6)', () => {
  const entry = (o: Partial<HistoryEntry>): HistoryEntry => ({
    at: '2026-10-06T12:05:00.000Z',
    action: 'create',
    authorUsername: 'lea',
    detail: {},
    ...o,
  });

  it('libellés des actions, matériel en libellé court', () => {
    expect(actionText(entry({ action: 'create' }))).toBe('Création de la salle');
    expect(
      actionText(entry({ action: 'update_info', detail: { city: { from: 'Lyon', to: 'Villeurbanne' } } })),
    ).toBe('Nom ou ville modifiés');
    expect(actionText(entry({ action: 'remove_equipment', detail: { code: 'flat_bench' } }))).toBe(
      'Matériel retiré : Banc plat',
    );
    expect(actionText(entry({ action: 'add_equipment', detail: { code: 'resistance_band' } }))).toBe(
      'Matériel ajouté : Élastiques',
    );
    expect(actionText(entry({ action: 'update_load_settings' }))).toBe('Réglages de charge modifiés');
    expect(actionText(entry({ action: 'add_equipment', detail: { code: 'inconnu' } }))).toBe(
      'Matériel ajouté',
    );
  });
});

describe('GymPage : fiche de la salle (maquette D02, R-SAL-4, R-SAL-6, R-VIS-1 à R-VIS-4)', () => {
  it('nom, ville, matériel par catégorie, « Qui va à cette salle » et les 10 dernières modifications', async () => {
    await renderGym();
    expect(screen.getByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(screen.getByText('Salle · Lyon')).toBeTruthy();
    expect(screen.getByText('Partagée avec le cercle')).toBeTruthy();
    const material = region('Matériel');
    expect(material.getByText('Barre droite et disques')).toBeTruthy();
    expect(material.getByRole('list', { name: 'Petit matériel' })).toBeTruthy();
    // Utilisateur « lea » visible : il se reconnaît dans la liste.
    expect(region('Qui va à cette salle').getByText('max et toi')).toBeTruthy();
    const history = region('Dernières modifications').getAllByRole('listitem');
    expect(history).toHaveLength(10);
    expect(history[0]?.textContent).toContain('Nom ou ville modifiés');
    expect(history[0]?.textContent).toContain('modifié par un membre');
    expect(history[0]?.textContent).toContain('06/10/2026 à 14:05');
    expect(history[1]?.textContent).toContain('modifié par lea');
    expect(history[1]?.textContent).toContain('Matériel ajouté : Barre droite et disques');
    expect(history[1]?.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-06T12:04:00.000Z');
  });

  it('membres visibles sans l’utilisateur : leurs pseudos seulement', async () => {
    await renderGym({ detail: detail({ visibleMembers: ['max', 'nora', 'sam'] }) });
    expect(region('Qui va à cette salle').getByText('max, nora et sam')).toBeTruthy();
  });

  it('droit de modifier : « Modifier le nom ou la ville » → feuille → PATCH { name } puis la fiche est relue', async () => {
    const api = createFakeApi().on('PATCH', '/api/gyms/:id', { status: 204 });
    await renderGym({ api });
    fireEvent.click(button(EDIT_INFO));
    const sheet = within(await screen.findByRole('dialog', { name: 'Modifier la salle' }));
    expect((sheet.getByLabelText('Nom de la salle') as HTMLInputElement).value).toBe('Basic Fit');
    expect((sheet.getByLabelText('Ville') as HTMLInputElement).value).toBe('Lyon');
    fireEvent.change(sheet.getByLabelText('Nom de la salle'), { target: { value: 'Basic Fit Part-Dieu' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    await until(() => sent(api, 'PATCH', '/api/gyms/g-1').length === 1);
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([{ name: 'Basic Fit Part-Dieu' }]);
    await until(() => gets(api).length === 2);
    await until(() => screen.queryByRole('dialog') === null);
  });

  it('ville trop courte : message local, aucune requête', async () => {
    const api = createFakeApi();
    await renderGym({ api });
    fireEvent.click(button(EDIT_INFO));
    const sheet = within(await screen.findByRole('dialog'));
    fireEvent.change(sheet.getByLabelText('Ville'), { target: { value: 'L' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect(sheet.getByText('2 à 60 caractères.')).toBeTruthy();
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([]);
  });

  it('« Enregistrer » hors ligne : « Nécessite le réseau », la feuille reste ouverte avec la saisie', async () => {
    const api = createFakeApi();
    await renderGym({ api });
    fireEvent.click(button(EDIT_INFO));
    const sheet = within(await screen.findByRole('dialog'));
    api.setOffline('reject');
    fireEvent.change(sheet.getByLabelText('Nom de la salle'), { target: { value: 'Basic Fit Part-Dieu' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect((await sheet.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect((sheet.getByLabelText('Nom de la salle') as HTMLInputElement).value).toBe('Basic Fit Part-Dieu');
    expect(gets(api)).toHaveLength(1);
  });

  it('409 gym_duplicate : « Cette salle existe déjà. », la feuille reste ouverte', async () => {
    const api = createFakeApi().on('PATCH', '/api/gyms/:id', {
      status: 409,
      body: { error: 'gym_duplicate', gymId: 'g-2' },
    });
    await renderGym({ api });
    fireEvent.click(button(EDIT_INFO));
    const sheet = within(await screen.findByRole('dialog'));
    fireEvent.change(sheet.getByLabelText('Nom de la salle'), { target: { value: 'Fitness Park' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect((await sheet.findByRole('alert')).textContent).toBe('Cette salle existe déjà.');
    expect((sheet.getByLabelText('Nom de la salle') as HTMLInputElement).value).toBe('Fitness Park');
  });

  it('feuille de la salle : seuls les champs changés depuis l’ouverture partent (R-SAL-5)', async () => {
    const api = createFakeApi().on('PATCH', '/api/gyms/:id', { status: 204 });
    await renderGym({ api });
    fireEvent.click(button(EDIT_INFO));
    const sheet = within(await screen.findByRole('dialog'));
    fireEvent.change(sheet.getByLabelText('Ville'), { target: { value: 'Villeurbanne' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    await until(() => sent(api, 'PATCH', '/api/gyms/g-1').length === 1);
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([{ city: 'Villeurbanne' }]);
  });

  it('feuille de la salle : le focus va au nom, puis revient au bouton après « Annuler » ou « Enregistrer »', async () => {
    const api = createFakeApi().on('PATCH', '/api/gyms/:id', { status: 204 });
    await renderGym({ api });
    const edit = button(EDIT_INFO);
    edit.focus();
    fireEvent.click(edit);
    const sheet = within(await screen.findByRole('dialog'));
    expect(document.activeElement).toBe(sheet.getByLabelText('Nom de la salle'));
    fireEvent.click(sheet.getByRole('button', { name: 'Annuler' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(document.activeElement).toBe(edit);
    fireEvent.click(edit);
    const again = within(await screen.findByRole('dialog'));
    fireEvent.change(again.getByLabelText('Ville'), { target: { value: 'Villeurbanne' } });
    fireEvent.click(again.getByRole('button', { name: 'Enregistrer' }));
    await until(() => screen.queryByRole('dialog') === null);
    await until(() => document.activeElement === screen.queryByRole('button', { name: EDIT_INFO }));
  });

  it('« Modifier le matériel » : l’écran Matériel, le focus sur son titre ; « Retour » le rend au bouton', async () => {
    await renderGym();
    fireEvent.click(button(EDIT_EQUIPMENT));
    const title = await screen.findByRole('heading', { level: 1, name: 'Matériel' });
    expect(document.activeElement).toBe(title);
    expect(screen.getByText('Basic Fit')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toBe(
      'Fiche partagée avec le cercle : chaque changement apparaît dans son historique.',
    );
    // Salle : pas d'objets du quotidien (R-EQ-3).
    expect(screen.queryByRole('button', { name: /^Objets du quotidien/ })).toBeNull();
    fireEvent.click(button('Retour'));
    await screen.findByRole('heading', { level: 1, name: 'Basic Fit' });
    expect(document.activeElement).toBe(button(EDIT_EQUIPMENT));
  });

  it('écran Matériel : une catégorie se déplie et se replie, son compte coché sur le total', async () => {
    await renderGym();
    fireEvent.click(button(EDIT_EQUIPMENT));
    await screen.findByRole('heading', { level: 1, name: 'Matériel' });
    const small = screen.getByRole('button', { name: /^Petit matériel/ });
    expect(small.getAttribute('aria-expanded')).toBe('true');
    expect(small.textContent).toContain('1 sur 6');
    const benches = screen.getByRole('button', { name: /^Bancs et supports/ });
    expect(benches.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('checkbox', { name: 'Banc plat' })).toBeNull();
    fireEvent.click(benches);
    expect(benches.getAttribute('aria-expanded')).toBe('true');
    expect((screen.getByRole('checkbox', { name: 'Banc plat' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(benches);
    expect(screen.queryByRole('checkbox', { name: 'Banc plat' })).toBeNull();
  });

  it('sans droit : ni modification du nom ni du matériel, la raison, la liste des membres visibles (R-VIS-2)', async () => {
    await renderGym({ detail: detail({ canEdit: false }) });
    expect(screen.queryByRole('button', { name: EDIT_INFO })).toBeNull();
    expect(screen.queryByRole('button', { name: EDIT_EQUIPMENT })).toBeNull();
    expect(screen.getByText(RIGHTS_TEXT)).toBeTruthy();
    expect(region('Matériel').getByText('Barre droite et disques')).toBeTruthy();
    expect(region('Qui va à cette salle').getByText('max et toi')).toBeTruthy();
  });

  it("personne de visible : « Personne n'est visible pour l'instant. » (R-VIS-4)", async () => {
    await renderGym({ detail: detail({ visibleMembers: [] }) });
    expect(region('Qui va à cette salle').getByText(NOBODY)).toBeTruthy();
  });

  it('hors ligne : dernière version connue du miroir, rien à modifier, « Liste disponible en ligne »', async () => {
    const db = createTestLocalDb();
    await seedGymMirror(db);
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<GymPage params={{ id: 'g-1' }} />, { api, db });
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(screen.getByText('Hors ligne : dernière version connue.')).toBeTruthy();
    expect(region('Matériel').getByText('Barre droite et disques')).toBeTruthy();
    expect(screen.queryByRole('button', { name: EDIT_EQUIPMENT })).toBeNull();
    expect(screen.queryByRole('button', { name: EDIT_INFO })).toBeNull();
    expect(screen.queryByText(RIGHTS_TEXT)).toBeNull();
    expect(region('Qui va à cette salle').getByText('Liste disponible en ligne')).toBeTruthy();
    expect(screen.queryByText(NOBODY)).toBeNull();
    expect(region('Dernières modifications').getByText('Historique disponible en ligne')).toBeTruthy();
    expect(screen.queryByText('Aucune modification.')).toBeNull();
  });

  it("hors ligne avec un droit de modifier : rien à modifier (l'écran ne s'en remet pas au dépôt)", async () => {
    /** Dépôt qui rendrait une fiche hors ligne marquée modifiable. */
    function OfflineEditable() {
      const repos = useRepos();
      repos.gyms.detail = async () => ({ detail: detail({ canEdit: true }), offline: true });
      return <GymPage params={{ id: 'g-1' }} />;
    }
    await renderWithServices(<OfflineEditable />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(screen.getByText('Hors ligne : dernière version connue.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: EDIT_EQUIPMENT })).toBeNull();
    expect(screen.queryByRole('button', { name: EDIT_INFO })).toBeNull();
    expect(region('Dernières modifications').getByText('Historique disponible en ligne')).toBeTruthy();
    expect(screen.queryByText('Aucune modification.')).toBeNull();
  });

  it('hors ligne, salle absente du miroir : « Nécessite le réseau » et « Réessayer »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<GymPage params={{ id: 'g-1' }} />, { api });
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    api.setOffline(false);
    api.on('GET', '/api/gyms/:id', { status: 200, body: detail() });
    fireEvent.click(button('Réessayer'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
  });

  it('hors ligne, salle supprimée dans le miroir : traitée comme absente (R-SAL-7)', async () => {
    const db = createTestLocalDb();
    await seedGymMirror(db, { deletedAt: '2026-10-01T10:00:00.000Z' });
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<GymPage params={{ id: 'g-1' }} />, { api, db });
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(screen.queryByRole('heading', { level: 1, name: 'Basic Fit' })).toBeNull();
    expect(screen.queryByText('Hors ligne : dernière version connue.')).toBeNull();
  });

  it('salle inconnue (404) : « Salle introuvable. », sans « Réessayer » ni bandeau hors ligne', async () => {
    const api = createFakeApi();
    await renderWithServices(<GymPage params={{ id: 'g-9' }} />, { api });
    expect((await screen.findByRole('alert')).textContent).toBe('Salle introuvable.');
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    expect(screen.queryByText('Hors ligne : dernière version connue.')).toBeNull();
  });

  it('salle supprimée : « Cette salle a été supprimée. », sans la raison des droits ni « Qui va à cette salle » (R-SAL-7)', async () => {
    await renderGym({
      detail: detail({ deletedAt: '2026-10-01T10:00:00.000Z', canEdit: false, visibleMembers: [] }),
    });
    expect(screen.getByText('Cette salle a été supprimée.')).toBeTruthy();
    expect(screen.queryByText(RIGHTS_TEXT)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Qui va à cette salle' })).toBeNull();
    expect(screen.queryByText(NOBODY)).toBeNull();
    expect(screen.queryByRole('button', { name: EDIT_INFO })).toBeNull();
    expect(screen.queryByRole('button', { name: EDIT_EQUIPMENT })).toBeNull();
    expect(region('Matériel').getByText('Barre droite et disques')).toBeTruthy();
  });

  it('salle hors de mes lieux : ni interrupteurs ni zone sensible', async () => {
    await renderGym();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Zone sensible' })).toBeNull();
  });

  it('/gyms/:id dans la coquille', async () => {
    const api = createFakeApi().on('GET', '/api/gyms/:id', { status: 200, body: detail() });
    await renderApp({ path: '/gyms/g-1', api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
  });
});

describe('GymPage : le lieu de l’utilisateur à cette salle (spec refonte §10.3, R-VIS-3, R-LIEU-1, R-LIEU-4)', () => {
  it('« Visible » hors ligne : « Nécessite le réseau », l’interrupteur revient', async () => {
    const api = createFakeApi();
    await renderGym({ api, db: await dbWithPlace() });
    api.setOffline('reject');
    const visible = region('Qui va à cette salle').getByRole('switch', { name: 'Visible' });
    fireEvent.click(visible);
    expect((await region('Qui va à cette salle').findByRole('alert')).textContent).toBe(
      'Nécessite le réseau',
    );
    await until(() => visible.getAttribute('aria-checked') === 'true');
  });

  it('« Visible » : le choix s’affiche jusqu’à la relecture du miroir, qui fait foi', async () => {
    const api = createFakeApi().on('PATCH', '/api/places/:id', { status: 204 });
    const db = await dbWithPlace();
    await renderGym({ api, db });
    const visible = region('Qui va à cette salle').getByRole('switch', { name: 'Visible' });
    fireEvent.click(visible);
    await until(() => sent(api, 'PATCH', '/api/places/p-1').length === 1);
    await until(() => !(visible as HTMLButtonElement).disabled);
    expect(visible.getAttribute('aria-checked')).toBe('false');
    // Miroir relu (un autre appareil a remis la visibilité) : il fait foi.
    await seedPrimaryGym(db);
    await until(() => visible.getAttribute('aria-checked') === 'true');
  });

  it('mineur : « Visible » reste au choix, avec la raison du défaut (P-MIN-6)', async () => {
    await renderGym({ db: await dbWithPlace(), me: makeMe({ ageBand: 'minor' }) });
    const visible = region('Qui va à cette salle').getByRole('switch', {
      name: 'Visible',
    }) as HTMLButtonElement;
    expect(visible.disabled).toBe(false);
    const hint = screen.getByText('Désactivé par défaut pour les moins de 18 ans.');
    expect(visible.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id);
  });

  it('un seul lieu : « Supprimer ce lieu » désactivé, « Tu dois garder au moins un lieu. »', async () => {
    await renderGym({ db: await dbWithPlace() });
    const remove = region('Zone sensible').getByRole('button', {
      name: 'Supprimer ce lieu',
    }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    const reason = screen.getByText('Tu dois garder au moins un lieu.');
    expect(remove.getAttribute('aria-describedby')?.split(' ')).toContain(reason.id);
  });

  it('supprimer la salle principale : choix du nouveau lieu principal → DELETE { newPrimaryId } → la liste', async () => {
    const api = createFakeApi().on('DELETE', '/api/places/:id', { status: 204 });
    const view = await renderGym({ api, db: await dbWithPlace({ garage: true }) });
    fireEvent.click(button('Supprimer ce lieu'));
    const dialog = within(await screen.findByRole('dialog', { name: 'Supprimer Basic Fit ?' }));
    choose('Garage');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
    await until(() => sent(api, 'DELETE', '/api/places/p-1').length === 1);
    expect(sent(api, 'DELETE', '/api/places/p-1')).toEqual([{ newPrimaryId: 'p-2' }]);
    await until(() => view.location() === '/places');
  });
});
