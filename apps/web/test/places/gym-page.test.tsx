import { defaultLoadSettings, EQUIPMENT_LABELS, type GymDetail } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GYM_HISTORY_LIMIT, GymPage, historyLine } from '../../src/features/places/GymPage';
import { fill } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, checkbox } from '../support/onboarding';
import { renderApp, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

type HistoryEntry = GymDetail['history'][number];

const RIGHTS_TEXT = 'Seuls les membres qui ont cette salle parmi leurs lieux peuvent la modifier.';
const NOBODY = "Personne n'est visible pour l'instant.";

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

async function renderGym(o: { detail?: GymDetail; api?: FakeApi } = {}) {
  const api = o.api ?? createFakeApi();
  api.on('GET', '/api/gyms/:id', { status: 200, body: o.detail ?? detail() });
  const rendered = await renderWithServices(<GymPage params={{ id: 'g-1' }} />, { api });
  await screen.findByRole('heading', { level: 1 });
  return rendered;
}

const section = (name: string) => within(screen.getByRole('region', { name }));
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

describe('historyLine (R-SAL-6)', () => {
  const entry = (o: Partial<HistoryEntry>): HistoryEntry => ({
    at: '2026-10-06T12:05:00.000Z',
    action: 'create',
    authorUsername: 'lea',
    detail: {},
    ...o,
  });

  it("date à l'heure de Paris, action, auteur", () => {
    expect(historyLine(entry({ action: 'add_equipment', detail: { code: 'kettlebell' } }))).toBe(
      '06/10/2026 à 14:05 — Matériel ajouté : Kettlebell — modifié par lea',
    );
  });

  it('libellés des actions', () => {
    const action = (o: Partial<HistoryEntry>) => historyLine(entry(o)).split(' — ')[1];
    expect(action({ action: 'create' })).toBe('Création de la salle');
    expect(action({ action: 'update_info', detail: { city: { from: 'Lyon', to: 'Villeurbanne' } } })).toBe(
      'Nom ou ville modifiés',
    );
    expect(action({ action: 'remove_equipment', detail: { code: 'flat_bench' } })).toBe(
      'Matériel retiré : Banc plat',
    );
    expect(action({ action: 'update_load_settings' })).toBe('Réglages de charge modifiés');
    expect(action({ action: 'add_equipment', detail: { code: 'inconnu' } })).toBe('Matériel ajouté');
  });

  it('auteur absent (compte supprimé ou invisible) : « un membre »', () => {
    expect(historyLine(entry({ authorUsername: null }))).toBe(
      '06/10/2026 à 14:05 — Création de la salle — modifié par un membre',
    );
  });

  it('au plus 10 entrées', () => {
    expect(GYM_HISTORY_LIMIT).toBe(10);
  });
});

describe('GymPage (R-SAL-4, R-SAL-6, R-VIS-1 à R-VIS-4)', () => {
  it('nom, ville, matériel, « Qui va à cette salle » et les 10 dernières modifications', async () => {
    await renderGym();
    expect(screen.getByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(screen.getByText('Lyon')).toBeTruthy();
    expect(checkbox(EQUIPMENT_LABELS.barbell).checked).toBe(true);
    const members = section('Qui va à cette salle').getAllByRole('listitem');
    expect(members.map((li) => li.textContent)).toEqual(['lea', 'max']);
    const history = section('Dernières modifications').getAllByRole('listitem');
    expect(history).toHaveLength(10);
    expect(history[0]?.textContent).toContain('un membre');
    expect(history[1]?.textContent).toContain('modifié par lea');
    expect(history[1]?.textContent).toContain('Matériel ajouté : Barre droite et disques');
  });

  it('droit de modifier : « Modifier » → PATCH { name } puis la fiche est relue', async () => {
    const api = createFakeApi().on('PATCH', '/api/gyms/:id', { status: 204 });
    await renderGym({ api });
    fireEvent.click(button('Modifier'));
    expect((screen.getByLabelText('Nom de la salle') as HTMLInputElement).value).toBe('Basic Fit');
    expect((screen.getByLabelText('Ville') as HTMLInputElement).value).toBe('Lyon');
    fill('Nom de la salle', 'Basic Fit Part-Dieu');
    fireEvent.click(button('Enregistrer'));
    await until(() => sent(api, 'PATCH', '/api/gyms/g-1').length === 1);
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([{ name: 'Basic Fit Part-Dieu' }]);
    await until(() => api.calls.filter((c) => c.method === 'GET' && c.path === '/api/gyms/g-1').length === 2);
    await until(() => screen.queryByLabelText('Nom de la salle') === null);
  });

  it('ville trop courte : message local, aucune requête', async () => {
    const api = createFakeApi();
    await renderGym({ api });
    fireEvent.click(button('Modifier'));
    fill('Ville', 'L');
    fireEvent.click(button('Enregistrer'));
    expect(screen.getByText('2 à 60 caractères.')).toBeTruthy();
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([]);
  });

  it('droit de modifier : « Kettlebell » coché → PUT ; « Banc plat » décoché → DELETE (R-SAL-5)', async () => {
    const api = createFakeApi()
      .on('PUT', '/api/gyms/:id/equipment/:code', { status: 204 })
      .on('DELETE', '/api/gyms/:id/equipment/:code', { status: 204 });
    await renderGym({ api });
    expect(screen.queryByRole('checkbox', { name: EQUIPMENT_LABELS.chair })).toBeNull();
    fireEvent.click(checkbox(EQUIPMENT_LABELS.kettlebell));
    await until(() => sent(api, 'PUT', '/api/gyms/g-1/equipment/kettlebell').length === 1);
    await until(() => !checkbox(EQUIPMENT_LABELS.flat_bench).disabled);
    fireEvent.click(checkbox(EQUIPMENT_LABELS.flat_bench));
    await until(() => sent(api, 'DELETE', '/api/gyms/g-1/equipment/flat_bench').length === 1);
  });

  it('sans droit : ni « Modifier » ni case, la raison, la liste des membres visibles (R-VIS-2)', async () => {
    await renderGym({ detail: detail({ canEdit: false }) });
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(RIGHTS_TEXT)).toBeTruthy();
    expect(screen.getByText(EQUIPMENT_LABELS.barbell)).toBeTruthy();
    const members = section('Qui va à cette salle').getAllByRole('listitem');
    expect(members.map((li) => li.textContent)).toEqual(['lea', 'max']);
  });

  it("personne de visible : « Personne n'est visible pour l'instant. » (R-VIS-4)", async () => {
    await renderGym({ detail: detail({ visibleMembers: [] }) });
    expect(section('Qui va à cette salle').getByText(NOBODY)).toBeTruthy();
  });

  it('hors ligne : dernière version connue du miroir, aucune case, « Liste disponible en ligne »', async () => {
    const db = createTestLocalDb();
    await seedMirror(db, 'gym', [
      {
        id: 'g-1',
        name: 'Basic Fit',
        nameKey: 'basic fit',
        city: 'Lyon',
        cityKey: 'lyon',
        loadSettings: defaultLoadSettings('gym'),
      },
    ]);
    await seedMirror(db, 'gym_equipment', [{ id: 'g-1:barbell', gymId: 'g-1', equipmentCode: 'barbell' }]);
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<GymPage params={{ id: 'g-1' }} />, { api, db });
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
    expect(screen.getByText('Hors ligne : dernière version connue.')).toBeTruthy();
    expect(screen.getByText(EQUIPMENT_LABELS.barbell)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByText(RIGHTS_TEXT)).toBeNull();
    expect(section('Qui va à cette salle').getByText('Liste disponible en ligne')).toBeTruthy();
    expect(screen.queryByText(NOBODY)).toBeNull();
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

  it('/gyms/:id dans la coquille', async () => {
    const api = createFakeApi().on('GET', '/api/gyms/:id', { status: 200, body: detail() });
    await renderApp({ path: '/gyms/g-1', api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Fit' })).toBeTruthy();
  });
});
