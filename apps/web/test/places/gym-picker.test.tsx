import {
  EQUIPMENT,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  type EquipmentCode,
  PRESETS,
} from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EquipmentChecklist, sortEquipment } from '../../src/features/places/EquipmentChecklist';
import { GymPicker } from '../../src/features/places/GymPicker';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { button, checkbox, choose, radio } from '../support/onboarding';
import { renderWithServices } from '../support/render';
import { until } from '../support/wait';

const BASIC_FIT = { id: 'g-1', name: 'Basic Fit', city: 'Lyon', visibleMemberCount: 2 };
/** Salle proche renvoyée par /api/gyms/similar : id distinct de la liste de recherche. */
const SIMILAR = { id: 'g-2', name: 'Basic-Fit', city: 'Lyon', visibleMemberCount: 0 };
/** Id renvoyé par un 409 gym_duplicate : présent dans aucune liste. */
const DUPLICATE_ID = 'g-9';
const BASIC_FIT_LABEL = 'Basic Fit · Lyon · 2 membres visibles';
const VISIBLE = 'Apparaître dans « Qui va à cette salle »';
const NOT_LISTED = "Ma salle n'est pas dans la liste";

async function renderPicker(o: { defaultVisible?: boolean; api?: FakeApi } = {}) {
  const api = o.api ?? createFakeApi();
  api.on('GET', '/api/gyms', { status: 200, body: [BASIC_FIT] });
  const onDone = vi.fn();
  const rendered = await renderWithServices(
    <GymPicker isPrimary defaultVisible={o.defaultVisible ?? true} onDone={onDone} />,
    { api },
  );
  await screen.findByRole('radio', { name: BASIC_FIT_LABEL });
  return { ...rendered, onDone };
}

const gets = (api: FakeApi, path: string) =>
  api.calls.filter((c) => c.method === 'GET' && c.path === path).map((c) => c.query.toString());
const posted = (api: FakeApi, path: string) =>
  api.calls.find((c) => c.method === 'POST' && c.path === path)?.body;
/** `a` est avant `b` dans le document (ordre de lecture et de tabulation). */
const precedes = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** Ouvre la création et passe le nom et la ville. */
function startCreate(name: string, city: string) {
  fireEvent.click(button(NOT_LISTED));
  fireEvent.change(screen.getByLabelText('Nom de la salle'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Ville'), { target: { value: city } });
  fireEvent.click(button('Continuer'));
}

describe('GymPicker (R-SAL-1, R-VIS-3)', () => {
  it('liste des salles avec le nombre de membres visibles ; recherche', async () => {
    const { api } = await renderPicker();
    expect(gets(api, '/api/gyms')).toEqual(['q=']);
    fireEvent.change(screen.getByLabelText('Rechercher une salle'), { target: { value: 'bas' } });
    await until(() => gets(api, '/api/gyms').includes('q=bas'));
  });

  it('majeur : visible par défaut ; « Valider » désactivé sans salle choisie', async () => {
    await renderPicker();
    expect(checkbox(VISIBLE).checked).toBe(true);
    expect(screen.queryByText('Désactivé par défaut pour les moins de 18 ans.')).toBeNull();
    expect(button('Valider').disabled).toBe(true);
  });

  it('mineur : décochée avec la raison ; « Valider » → POST du lieu puis onDone (P-MIN-6)', async () => {
    const api = createFakeApi().on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    const { onDone } = await renderPicker({ defaultVisible: false, api });
    expect(checkbox(VISIBLE).checked).toBe(false);
    expect(screen.getByText('Désactivé par défaut pour les moins de 18 ans.')).toBeTruthy();
    choose(BASIC_FIT_LABEL);
    fireEvent.click(button('Valider'));
    await until(() => onDone.mock.calls.length === 1);
    expect(api.calls.find((c) => c.path === '/api/places')?.body).toEqual({
      kind: 'gym',
      gymId: 'g-1',
      isPrimary: true,
      visibleAtGym: false,
    });
  });
});

describe('GymCreate (R-SAL-2, R-SAL-3)', () => {
  it('nom d’un caractère : « 2 à 60 caractères. », aucune requête', async () => {
    const { api } = await renderPicker();
    const before = api.calls.length;
    startCreate('B', 'Lyon');
    expect(screen.getByText('2 à 60 caractères.')).toBeTruthy();
    expect(api.calls.length).toBe(before);
  });

  it('salles proches : « C’est ma salle » → POST du lieu de cette salle', async () => {
    const api = createFakeApi()
      .on('GET', '/api/gyms/similar', { status: 200, body: [SIMILAR] })
      .on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    const { onDone } = await renderPicker({ api });
    startCreate('Basic-Fit', 'Lyon');
    await screen.findByText('Ces salles existent peut-être déjà :');
    expect(gets(api, '/api/gyms/similar')).toEqual(['name=Basic-Fit&city=Lyon']);
    expect(screen.getByRole('button', { name: 'Non, créer ma salle' })).toBeTruthy();
    fireEvent.click(button("C'est ma salle"));
    await until(() => onDone.mock.calls.length === 1);
    expect(api.calls.find((c) => c.path === '/api/places')?.body).toEqual({
      kind: 'gym',
      gymId: SIMILAR.id,
      isPrimary: true,
      visibleAtGym: true,
    });
  });

  it('« Non, créer ma salle » mène aux préréglages', async () => {
    const api = createFakeApi().on('GET', '/api/gyms/similar', { status: 200, body: [SIMILAR] });
    await renderPicker({ api });
    startCreate('Basic-Fit', 'Lyon');
    fireEvent.click(await screen.findByRole('button', { name: 'Non, créer ma salle' }));
    await screen.findByRole('group', { name: 'Type de salle' });
  });

  it('aucune salle proche : préréglages directement ; « Petite salle de quartier » ; « Créer la salle »', async () => {
    const api = createFakeApi()
      .on('GET', '/api/gyms/similar', { status: 200, body: [] })
      .on('POST', '/api/gyms', { status: 201, body: { gymId: 'g-2', placeId: 'p-2' } });
    const { onDone } = await renderPicker({ api });
    startCreate('Basic-Fit', 'Lyon');
    const presets = within(await screen.findByRole('group', { name: 'Type de salle' }));
    expect(presets.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      PRESETS.gym_large.label,
      PRESETS.gym_small.label,
      PRESETS.gym_crossfit.label,
      PRESETS.gym_other.label,
    ]);
    expect(screen.queryByText('Ces salles existent peut-être déjà :')).toBeNull();
    expect(button('Créer la salle').disabled).toBe(true);
    choose('Petite salle de quartier');
    const checked = screen
      .getAllByRole('checkbox', { checked: true })
      .map((c) => c.closest('label')?.textContent)
      .filter((label) => label !== VISIBLE);
    expect(checked).toEqual(sortEquipment(PRESETS.gym_small.equipment).map((c) => EQUIPMENT_LABELS[c]));
    expect(checked).toHaveLength(12);
    expect(screen.queryByRole('group', { name: EQUIPMENT_CATEGORY_LABELS.household })).toBeNull();
    fireEvent.click(button('Créer la salle'));
    await until(() => onDone.mock.calls.length === 1);
    expect(api.calls.find((c) => c.method === 'POST' && c.path === '/api/gyms')?.body).toEqual({
      name: 'Basic-Fit',
      city: 'Lyon',
      equipment: sortEquipment(PRESETS.gym_small.equipment),
      isPrimary: true,
      visibleAtGym: true,
    });
  });

  it('409 gym_duplicate : « Cette salle existe déjà. » puis « Choisir cette salle »', async () => {
    const api = createFakeApi()
      .on('GET', '/api/gyms/similar', { status: 200, body: [] })
      .on('POST', '/api/gyms', { status: 409, body: { error: 'gym_duplicate', gymId: DUPLICATE_ID } })
      .on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    const { onDone } = await renderPicker({ api });
    startCreate('Basic Fit', 'Lyon');
    await screen.findByRole('group', { name: 'Type de salle' });
    choose('Autre');
    fireEvent.click(button('Créer la salle'));
    expect((await screen.findByRole('alert')).textContent).toContain('Cette salle existe déjà.');
    fireEvent.click(button('Choisir cette salle'));
    await until(() => onDone.mock.calls.length === 1);
    expect(api.calls.find((c) => c.path === '/api/places')?.body).toEqual({
      kind: 'gym',
      gymId: DUPLICATE_ID,
      isPrimary: true,
      visibleAtGym: true,
    });
  });

  it('« Revenir à la liste » quitte la création', async () => {
    await renderPicker();
    fireEvent.click(button(NOT_LISTED));
    fireEvent.click(button('Revenir à la liste'));
    expect(radio(BASIC_FIT_LABEL)).toBeTruthy();
  });
});

describe('GymPicker : recherche en échec et annonces (R-SAL-1)', () => {
  it('hors ligne : « Nécessite le réseau » et « Réessayer », qui relance la recherche', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<GymPicker isPrimary defaultVisible onDone={() => {}} />, { api });
    expect((await screen.findByRole('alert')).textContent).toContain('Nécessite le réseau');
    expect(button('Valider').disabled).toBe(true);
    api.setOffline(false);
    api.on('GET', '/api/gyms', { status: 200, body: [BASIC_FIT] });
    fireEvent.click(button('Réessayer'));
    await screen.findByRole('radio', { name: BASIC_FIT_LABEL });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(gets(api, '/api/gyms')).toEqual(['q=', 'q=']);
  });

  it('nombre de salles trouvées et « Aucune salle trouvée. » dans une zone annoncée (role status)', async () => {
    const api = createFakeApi();
    await renderPicker({ api });
    expect(screen.getByText('1 salle trouvée.').getAttribute('role')).toBe('status');
    api.on('GET', '/api/gyms', { status: 200, body: [] });
    fireEvent.change(screen.getByLabelText('Rechercher une salle'), { target: { value: 'zzz' } });
    expect((await screen.findByText('Aucune salle trouvée.')).getAttribute('role')).toBe('status');
  });
});

describe('GymCreate : visibilité et salles proches (R-VIS-3, P-MIN-6, R-SAL-3)', () => {
  it('la case de visibilité précède « C’est ma salle » et « Créer la salle »', async () => {
    const api = createFakeApi().on('GET', '/api/gyms/similar', { status: 200, body: [SIMILAR] });
    await renderPicker({ api });
    startCreate('Basic-Fit', 'Lyon');
    const mine = await screen.findByRole('button', { name: "C'est ma salle" });
    expect(precedes(checkbox(VISIBLE), mine)).toBe(true);
    fireEvent.click(button('Non, créer ma salle'));
    choose('Autre');
    expect(precedes(checkbox(VISIBLE), button('Créer la salle'))).toBe(true);
  });

  it('nom modifié pendant la recherche des salles proches : la réponse arrivée ensuite est ignorée', async () => {
    let release = () => {};
    const api = createFakeApi().on(
      'GET',
      '/api/gyms/similar',
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 200, body: [] });
        }),
    );
    await renderPicker({ api });
    startCreate('Basic-Fit', 'Lyon');
    await until(() => gets(api, '/api/gyms/similar').length === 1);
    fireEvent.change(screen.getByLabelText('Nom de la salle'), { target: { value: 'Basic-Fit Part-Dieu' } });
    release();
    await settle();
    expect(screen.queryByRole('group', { name: 'Type de salle' })).toBeNull();
    expect(button('Continuer').disabled).toBe(false);
  });

  it('majeur qui décoche la case : « Valider » → visibleAtGym: false', async () => {
    const api = createFakeApi().on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    const { onDone } = await renderPicker({ api });
    fireEvent.click(checkbox(VISIBLE));
    choose(BASIC_FIT_LABEL);
    fireEvent.click(button('Valider'));
    await until(() => onDone.mock.calls.length === 1);
    expect(posted(api, '/api/places')).toEqual({
      kind: 'gym',
      gymId: 'g-1',
      isPrimary: true,
      visibleAtGym: false,
    });
  });

  const cases = [
    { who: 'mineur, case laissée décochée', defaultVisible: false, toggle: false, sent: false },
    { who: 'mineur qui coche la case', defaultVisible: false, toggle: true, sent: true },
    { who: 'majeur qui décoche la case', defaultVisible: true, toggle: true, sent: false },
  ];

  it.each(cases)('$who : « Créer la salle » → POST /api/gyms visibleAtGym: $sent', async (c) => {
    const api = createFakeApi()
      .on('GET', '/api/gyms/similar', { status: 200, body: [] })
      .on('POST', '/api/gyms', { status: 201, body: { gymId: 'g-3', placeId: 'p-3' } });
    const { onDone } = await renderPicker({ api, defaultVisible: c.defaultVisible });
    startCreate('Basic-Fit', 'Lyon');
    await screen.findByRole('group', { name: 'Type de salle' });
    if (c.toggle) fireEvent.click(checkbox(VISIBLE));
    choose('Autre');
    fireEvent.click(button('Créer la salle'));
    await until(() => onDone.mock.calls.length === 1);
    expect(posted(api, '/api/gyms')).toMatchObject({ visibleAtGym: c.sent });
  });

  it.each(cases)(
    '$who : 409 puis « Choisir cette salle » → POST /api/places visibleAtGym: $sent',
    async (c) => {
      const api = createFakeApi()
        .on('GET', '/api/gyms/similar', { status: 200, body: [] })
        .on('POST', '/api/gyms', { status: 409, body: { error: 'gym_duplicate', gymId: DUPLICATE_ID } })
        .on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
      const { onDone } = await renderPicker({ api, defaultVisible: c.defaultVisible });
      startCreate('Basic Fit', 'Lyon');
      await screen.findByRole('group', { name: 'Type de salle' });
      if (c.toggle) fireEvent.click(checkbox(VISIBLE));
      choose('Autre');
      fireEvent.click(button('Créer la salle'));
      fireEvent.click(await screen.findByRole('button', { name: 'Choisir cette salle' }));
      await until(() => onDone.mock.calls.length === 1);
      expect(posted(api, '/api/places')).toEqual({
        kind: 'gym',
        gymId: DUPLICATE_ID,
        isPrimary: true,
        visibleAtGym: c.sent,
      });
    },
  );
});

describe('EquipmentChecklist (R-EQ-3)', () => {
  const groups = () => screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent);

  it('salle : 4 groupes, sans objets du quotidien', async () => {
    await renderWithServices(<EquipmentChecklist kind="gym" value={[]} onChange={() => {}} />);
    expect(groups()).toEqual([
      EQUIPMENT_CATEGORY_LABELS.small_equipment,
      EQUIPMENT_CATEGORY_LABELS.benches_racks,
      EQUIPMENT_CATEGORY_LABELS.free_weights,
      EQUIPMENT_CATEGORY_LABELS.machines,
    ]);
  });

  it('maison : 5 groupes ; cocher « Kettlebell » rend la liste triée', async () => {
    const onChange = vi.fn();
    await renderWithServices(
      <EquipmentChecklist kind="home" value={['table', 'barbell', 'chair']} onChange={onChange} />,
    );
    expect(groups()).toHaveLength(5);
    fireEvent.click(checkbox(EQUIPMENT_LABELS.kettlebell));
    expect(onChange).toHaveBeenCalledWith(['chair', 'table', 'kettlebell', 'barbell']);
    fireEvent.click(checkbox(EQUIPMENT_LABELS.table));
    expect(onChange).toHaveBeenLastCalledWith(['chair', 'barbell']);
  });

  it('sortEquipment : ordre de la taxonomie, sans doublon', () => {
    const codes: EquipmentCode[] = ['leg_curl', 'chair', 'dumbbells', 'chair'];
    expect(sortEquipment(codes)).toEqual(EQUIPMENT.filter((c) => codes.includes(c)));
    expect(sortEquipment(new Set<EquipmentCode>(['box', 'table']))).toEqual(['table', 'box']);
  });
});
