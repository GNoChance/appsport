import { defaultLoadSettings, EQUIPMENT, type GymDetail, LoadSettingsSchema } from '@appsport/contracts';
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkRequiredError } from '../../src/api/client';
import type { MirrorRow } from '../../src/local-db/db';
import { getMeta } from '../../src/local-db/meta';
import { createRepos } from '../../src/repos';
import { isLive, parseJsonColumn } from '../../src/repos/rows';
import { createTestServices, makeMe } from '../support/render';
import { seedMirror } from '../support/seed';

const GYM_LS = defaultLoadSettings('gym');
const HOME_LS = { ...defaultLoadSettings('home'), dumbbellsG: [2000, 4000] };
const DELETED = '2026-10-01T10:00:00.000Z';

async function setup() {
  const t = await createTestServices({
    me: makeMe({ onboardingStep: 'sport', onboardingCompletedAt: null }),
  });
  const { db } = t;
  await seedMirror(db, 'training_profile', [
    {
      id: 'u-1',
      ownerId: 'u-1',
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      sportCode: null,
      sportOtherLabel: null,
      cautiousMode: false,
    },
  ]);
  await seedMirror(db, 'gym', [
    {
      id: 'g-1',
      name: 'Basic Fit',
      nameKey: 'basic fit',
      city: 'Lyon',
      cityKey: 'lyon',
      loadSettings: GYM_LS,
    },
  ]);
  await seedMirror(db, 'gym_equipment', [
    { id: 'g-1:barbell', gymId: 'g-1', equipmentCode: 'barbell' },
    { id: 'g-1:squat_rack', gymId: 'g-1', equipmentCode: 'squat_rack' },
    { id: 'g-1:leg_press', gymId: 'g-1', equipmentCode: 'leg_press', deletedAt: DELETED },
  ]);
  await seedMirror(db, 'place', [
    {
      id: 'p-2',
      ownerId: 'u-1',
      kind: 'home',
      gymId: null,
      name: 'Garage',
      isPrimary: false,
      visibleAtGym: null,
      loadSettings: HOME_LS,
    },
    {
      id: 'p-1',
      ownerId: 'u-1',
      kind: 'gym',
      gymId: 'g-1',
      name: null,
      isPrimary: true,
      visibleAtGym: true,
      loadSettings: null,
    },
    {
      id: 'p-3',
      ownerId: 'u-1',
      kind: 'home',
      gymId: null,
      name: 'Ancien',
      isPrimary: false,
      visibleAtGym: null,
      loadSettings: null,
      deletedAt: DELETED,
    },
  ]);
  await seedMirror(db, 'home_equipment', [
    { id: 'p-2:chair', ownerId: 'u-1', placeId: 'p-2', equipmentCode: 'chair' },
  ]);
  return { ...t, repos: createRepos(t.services) };
}

const gymCodes = EQUIPMENT.filter((c) => c === 'barbell' || c === 'squat_rack');

describe('rows', () => {
  it('parseJsonColumn valide un objet ; invalide ou texte → null', () => {
    expect(parseJsonColumn(GYM_LS, LoadSettingsSchema)).toEqual(GYM_LS);
    expect(parseJsonColumn({ barG: 1 }, LoadSettingsSchema)).toBeNull();
    expect(parseJsonColumn(JSON.stringify(GYM_LS), LoadSettingsSchema)).toBeNull();
    expect(parseJsonColumn(null, LoadSettingsSchema)).toBeNull();
  });

  it('isLive : ligne non supprimée', () => {
    const row: MirrorRow = { id: 'x', serverRevSeen: 1, deletedAt: null };
    expect(isLive(row)).toBe(true);
    expect(isLive({ ...row, deletedAt: DELETED })).toBe(false);
  });
});

describe('ProfileRepo', () => {
  it('get : profil décodé du miroir', async () => {
    const { repos } = await setup();
    expect(await repos.profile.get()).toEqual({
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      sportCode: null,
      sportOtherLabel: null,
      cautiousMode: false,
    });
  });

  it('update : PATCH de ce corps, meta.me à jour, un pull', async () => {
    const { repos, api, sync, db } = await setup();
    let body: unknown;
    api.on('PATCH', '/api/me/training-profile', (req) => {
      body = req.body;
      return { status: 200, body: makeMe({ onboardingStep: 'goal', onboardingCompletedAt: null }) };
    });
    await repos.profile.update({ goal: 'strength', onboardingStep: 'goal' });
    expect(body).toEqual({ goal: 'strength', onboardingStep: 'goal' });
    expect((await getMeta(db, 'me'))?.onboardingStep).toBe('goal');
    expect(sync.pullCount).toBe(1);
  });

  it('onboardingInput : profil, lieu principal et dernière étape validée', async () => {
    const { repos } = await setup();
    expect(await repos.profile.onboardingInput()).toEqual({
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      hasPrimaryPlace: true,
      lastValidatedStep: 'sport',
    });
  });

  it('completeOnboarding : meta.me à jour, un pull', async () => {
    const { repos, api, sync, db } = await setup();
    api.on('POST', '/api/me/onboarding/complete', { status: 200, body: makeMe() });
    await repos.profile.completeOnboarding();
    expect((await getMeta(db, 'me'))?.onboardingCompletedAt).not.toBeNull();
    expect(sync.pullCount).toBe(1);
  });
});

describe('PlacesRepo', () => {
  it('list : principal d’abord, nom et matériel résolus, supprimé absent', async () => {
    const { repos } = await setup();
    expect(await repos.places.list()).toEqual([
      {
        id: 'p-1',
        kind: 'gym',
        gymId: 'g-1',
        name: 'Basic Fit',
        city: 'Lyon',
        isPrimary: true,
        visibleAtGym: true,
        loadSettings: GYM_LS,
        equipment: gymCodes,
      },
      {
        id: 'p-2',
        kind: 'home',
        gymId: null,
        name: 'Garage',
        city: null,
        isPrimary: false,
        visibleAtGym: null,
        loadSettings: HOME_LS,
        equipment: ['chair'],
      },
    ]);
    expect(await repos.places.get('p-3')).toBeNull();
    expect((await repos.places.get('p-2'))?.name).toBe('Garage');
  });

  it("list : le principal d'abord, même quand son id et son nom viennent après", async () => {
    const { repos, db } = await setup();
    const p1 = await db.mirror('place').get('p-1');
    const p2 = await db.mirror('place').get('p-2');
    await seedMirror(db, 'place', [
      { ...p1, isPrimary: false },
      { ...p2, isPrimary: true },
    ]);
    expect((await repos.places.list()).map((p) => [p.id, p.name, p.isPrimary])).toEqual([
      ['p-2', 'Garage', true],
      ['p-1', 'Basic Fit', false],
    ]);
  });

  it('create, update, remove et matériel : API puis pull', async () => {
    const { repos, api, sync } = await setup();
    api.on('POST', '/api/places', { status: 201, body: { id: 'p-9' } });
    api.on('PATCH', '/api/places/:id', { status: 204 });
    api.on('DELETE', '/api/places/:id', { status: 204 });
    api.on('DELETE', '/api/places/:id/equipment/:code', { status: 204 });
    await repos.places.create({ kind: 'home', equipment: [], isPrimary: false });
    await repos.places.update('p-2', { name: 'Cave' });
    await repos.places.remove('p-2', {});
    await repos.places.setEquipment('p-2', 'chair', false);
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/places',
      'PATCH /api/places/p-2',
      'DELETE /api/places/p-2',
      'DELETE /api/places/p-2/equipment/chair',
    ]);
    expect(sync.pullCount).toBe(4);
  });
});

describe('GymsRepo', () => {
  it('detail en ligne : réponse du serveur', async () => {
    const { repos, api } = await setup();
    const detail: GymDetail = {
      id: 'g-1',
      name: 'Basic Fit',
      city: 'Lyon',
      loadSettings: GYM_LS,
      deletedAt: null,
      equipment: ['barbell'],
      canEdit: true,
      visibleMembers: ['max'],
      history: [],
    };
    api.on('GET', '/api/gyms/:id', { status: 200, body: detail });
    expect(await repos.gyms.detail('g-1')).toEqual({ detail, offline: false });
  });

  it('detail hors ligne : miroirs, sans droit, historique ni membres', async () => {
    const { repos, api } = await setup();
    api.setOffline('reject');
    expect(await repos.gyms.detail('g-1')).toEqual({
      offline: true,
      detail: {
        id: 'g-1',
        name: 'Basic Fit',
        city: 'Lyon',
        loadSettings: GYM_LS,
        deletedAt: null,
        equipment: gymCodes,
        canEdit: false,
        visibleMembers: [],
        history: [],
      },
    });
  });

  it('detail hors ligne, salle supprimée dans le miroir : erreur réseau relancée (R-SAL-7)', async () => {
    const { repos, api, db } = await setup();
    const gym = await db.mirror('gym').get('g-1');
    await seedMirror(db, 'gym', [{ ...gym, deletedAt: DELETED }]);
    api.setOffline('reject');
    await expect(repos.gyms.detail('g-1')).rejects.toBeInstanceOf(NetworkRequiredError);
  });

  it('create : 409 gym_duplicate → ApiError avec gymId, aucun pull', async () => {
    const { repos, api, sync } = await setup();
    api.on('POST', '/api/gyms', { status: 409, body: { error: 'gym_duplicate', gymId: 'g-1' } });
    const error = await repos.gyms
      .create({ name: 'Basic Fit', city: 'Lyon', equipment: [], isPrimary: true })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).body.gymId).toBe('g-1');
    expect(sync.pullCount).toBe(0);
  });

  it('search, similar, setEquipment', async () => {
    const { repos, api, sync } = await setup();
    const summary = { id: 'g-1', name: 'Basic Fit', city: 'Lyon', visibleMemberCount: 2 };
    api.on('GET', '/api/gyms', { status: 200, body: [summary] });
    api.on('GET', '/api/gyms/similar', { status: 200, body: [summary] });
    api.on('PUT', '/api/gyms/:id/equipment/:code', { status: 204 });
    expect(await repos.gyms.search('basic fit')).toEqual([summary]);
    expect(await repos.gyms.similar('Basic', 'Lyon')).toEqual([summary]);
    await repos.gyms.setEquipment('g-1', 'barbell', true);
    expect(api.calls[0]?.query.get('q')).toBe('basic fit');
    expect(api.calls[1]?.query.get('name')).toBe('Basic');
    expect(api.calls[1]?.query.get('city')).toBe('Lyon');
    expect(api.calls[2]?.path).toBe('/api/gyms/g-1/equipment/barbell');
    expect(sync.pullCount).toBe(1);
  });
});
