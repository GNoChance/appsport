import { defaultLoadSettings } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import {
  completeOnboarding,
  createTestContext,
  createUserAndLogin,
  insertFixtureRow,
  type TestContext,
} from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;

const call = (u: Member, path: string, method = 'GET', json?: unknown) =>
  ctx.request(path, { method, cookie: u.cookie, ...(json !== undefined ? { json } : {}) });
const post = (u: Member, json: unknown) => call(u, '/api/places', 'POST', json);
const home = (u: Member, over: Record<string, unknown> = {}) =>
  post(u, { kind: 'home', equipment: [], isPrimary: false, ...over });
const idOf = async (res: Response) => ((await res.json()) as { id: string }).id;
const row = (id: string) =>
  ctx.deps.db.selectFrom('place').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const activeHome = async (placeId: string) =>
  (
    await ctx.deps.db
      .selectFrom('homeEquipment')
      .select('equipmentCode')
      .where('placeId', '=', placeId)
      .where('deletedAt', 'is', null)
      .orderBy('equipmentCode')
      .execute()
  ).map((r) => r.equipmentCode);
const makeGym = (name = 'Basic-Fit', over: Record<string, unknown> = {}) =>
  insertFixtureRow(ctx.deps.db, 'gym', { name, nameKey: name.toLowerCase(), ...over });

async function setup(opts: { onboarded?: boolean; birthDate?: string } = {}) {
  ctx = await createTestContext();
  const u = await createUserAndLogin(ctx, opts.birthDate ? { birthDate: opts.birthDate } : {});
  if (opts.onboarded) await completeOnboarding(ctx, u);
  return u;
}

describe('POST /api/places (maison)', () => {
  it('crée une maison avec ses réglages et son matériel dédoublonné', async () => {
    const u = await setup();
    const res = await post(u, {
      kind: 'home',
      equipment: ['chair', 'table', 'dumbbells', 'dumbbells'],
      isPrimary: true,
    });
    expect(res.status).toBe(201);
    const id = await idOf(res);
    const place = await row(id);
    expect(place).toMatchObject({ kind: 'home', name: 'Maison', gymId: null, isPrimary: 1, visibleAtGym: 0 });
    expect(JSON.parse(place.loadSettings as string)).toEqual(defaultLoadSettings('home'));
    const eq = await ctx.deps.db
      .selectFrom('homeEquipment')
      .selectAll()
      .where('placeId', '=', id)
      .orderBy('id')
      .execute();
    expect(eq.map((e) => [e.id, e.ownerId, e.deletedAt])).toEqual([
      [`${id}:chair`, u.id, null],
      [`${id}:dumbbells`, u.id, null],
      [`${id}:table`, u.id, null],
    ]);
  });

  it('refuse un nom de 31 caractères et admet plusieurs maisons', async () => {
    const u = await setup();
    expect((await home(u, { name: 'x'.repeat(31) })).status).toBe(400);
    expect((await home(u)).status).toBe(201);
    expect((await home(u, { name: 'Appart' })).status).toBe(201);
  });
});

describe('matériel de la maison', () => {
  it('est idempotent et refusé sur un lieu salle', async () => {
    const u = await setup();
    const id = await idOf(await home(u, { equipment: ['chair', 'table'] }));
    for (let i = 0; i < 2; i++) {
      expect((await call(u, `/api/places/${id}/equipment/kettlebell`, 'PUT', {})).status).toBe(204);
      expect((await call(u, `/api/places/${id}/equipment/chair`, 'DELETE')).status).toBe(204);
    }
    expect(await activeHome(id)).toEqual(['kettlebell', 'table']);
    const gym = await makeGym();
    const gp = await idOf(await post(u, { kind: 'gym', gymId: gym.id as string, isPrimary: false }));
    const res = await call(u, `/api/places/${gp}/equipment/kettlebell`, 'PUT', {});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/places (salle)', () => {
  it('refuse un second lieu actif sur la même salle', async () => {
    const u = await setup();
    const gym = await makeGym();
    const body = { kind: 'gym', gymId: gym.id, isPrimary: false };
    expect((await post(u, body)).status).toBe(201);
    const res = await post(u, body);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'place_exists' });
  });

  it('renvoie 404 pour une salle inconnue ou supprimée', async () => {
    const u = await setup();
    const gym = await makeGym('Fermée', { deletedAt: '2026-10-01T00:00:00.000Z' });
    expect((await post(u, { kind: 'gym', gymId: gym.id, isPrimary: false })).status).toBe(404);
    expect((await post(u, { kind: 'gym', gymId: 'inconnue', isPrimary: false })).status).toBe(404);
  });

  it('un lieu salle supprimé libère la salle', async () => {
    const u = await setup();
    const gym = await makeGym();
    const body = { kind: 'gym', gymId: gym.id, isPrimary: false };
    const id = await idOf(await post(u, body));
    await home(u, { isPrimary: true });
    expect((await call(u, `/api/places/${id}`, 'DELETE', {})).status).toBe(204);
    expect((await post(u, body)).status).toBe(201);
  });
});

describe('PATCH /api/places/:id', () => {
  it('visibilité : mineur à 0, activable ; refusée sur une maison', async () => {
    const u = await setup({ birthDate: '2012-01-01' });
    const gym = await makeGym();
    const id = await idOf(await post(u, { kind: 'gym', gymId: gym.id, isPrimary: true }));
    expect((await row(id)).visibleAtGym).toBe(0);
    expect((await call(u, `/api/places/${id}`, 'PATCH', { visibleAtGym: true })).status).toBe(204);
    expect((await row(id)).visibleAtGym).toBe(1);
    const h = await idOf(await home(u));
    expect((await call(u, `/api/places/${h}`, 'PATCH', { visibleAtGym: true })).status).toBe(400);
  });

  it('réglages de charge et nom : maison seulement', async () => {
    const u = await setup();
    const gym = await makeGym();
    const g = await idOf(await post(u, { kind: 'gym', gymId: gym.id, isPrimary: true }));
    const h = await idOf(await home(u));
    const D = defaultLoadSettings('home');
    expect((await call(u, `/api/places/${g}`, 'PATCH', { loadSettings: D })).status).toBe(400);
    expect((await call(u, `/api/places/${g}`, 'PATCH', { name: 'Salle' })).status).toBe(400);
    const ok = { ...D, dumbbellsG: [2000, 4000] };
    expect((await call(u, `/api/places/${h}`, 'PATCH', { loadSettings: ok })).status).toBe(204);
    expect(JSON.parse((await row(h)).loadSettings as string)).toEqual(ok);
    expect((await call(u, `/api/places/${h}`, 'PATCH', { loadSettings: { ...D, barG: 4999 } })).status).toBe(
      400,
    );
    expect((await call(u, `/api/places/${h}`, 'PATCH', { name: 'Appart' })).status).toBe(204);
    expect((await row(h)).name).toBe('Appart');
  });

  it("lieu principal : premier d'office, unique, jamais retiré directement", async () => {
    const u = await setup();
    const a = await idOf(await home(u));
    const b = await idOf(await home(u));
    expect((await row(a)).isPrimary).toBe(1);
    expect((await row(b)).isPrimary).toBe(0);
    expect((await call(u, `/api/places/${b}`, 'PATCH', { isPrimary: true })).status).toBe(204);
    expect([(await row(a)).isPrimary, (await row(b)).isPrimary]).toEqual([0, 1]);
    expect((await call(u, `/api/places/${b}`, 'PATCH', { isPrimary: false })).status).toBe(400);
  });
});

describe('DELETE /api/places/:id', () => {
  it("refuse le dernier lieu après l'onboarding, l'autorise avant", async () => {
    const u = await setup({ onboarded: true });
    const only = await ctx.deps.db
      .selectFrom('place')
      .select('id')
      .where('ownerId', '=', u.id)
      .executeTakeFirstOrThrow();
    const res = await call(u, `/api/places/${only.id}`, 'DELETE', {});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_place' });
    ctx.close();
    const v = await setup();
    const id = await idOf(await home(v));
    expect((await call(v, `/api/places/${id}`, 'DELETE', {})).status).toBe(204);
  });

  it('exige un nouveau lieu principal valide puis supprime', async () => {
    const u = await setup();
    const a = await idOf(await home(u));
    const b = await idOf(await home(u));
    const noNew = await call(u, `/api/places/${a}`, 'DELETE', {});
    expect(noNew.status).toBe(409);
    expect(await noNew.json()).toEqual({ error: 'primary_required' });
    const self = await call(u, `/api/places/${a}`, 'DELETE', { newPrimaryId: a });
    expect(self.status).toBe(400);
    expect(await self.json()).toMatchObject({ error: 'validation', field: 'newPrimaryId' });
    const before = (await row(a)).rev;
    ctx.clock.set('2026-10-06T10:00:00.000Z');
    expect((await call(u, `/api/places/${a}`, 'DELETE', { newPrimaryId: b })).status).toBe(204);
    const gone = await row(a);
    expect(gone).toMatchObject({ deletedAt: '2026-10-06T10:00:00.000Z', isPrimary: 0 });
    expect(gone.rev).toBeGreaterThan(before);
    expect((await row(b)).isPrimary).toBe(1);
    expect((await call(u, `/api/places/${a}`, 'DELETE', {})).status).toBe(404);
  });

  it('un lieu non principal se supprime sans corps', async () => {
    const u = await setup();
    await home(u);
    const b = await idOf(await home(u));
    expect((await call(u, `/api/places/${b}`, 'DELETE')).status).toBe(204);
  });
});

describe("lieu d'un autre, admin compris (P-ADM-2)", () => {
  it('répond 404 not_found sans rien modifier', async () => {
    const owner = await setup();
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const other = await createUserAndLogin(ctx);
    const id = await idOf(await home(owner, { equipment: ['chair'] }));
    const before = await row(id);
    for (const who of [admin, other]) {
      const calls: [string, string, unknown?][] = [
        [`/api/places/${id}`, 'PATCH', {}],
        [`/api/places/${id}`, 'DELETE', {}],
        [`/api/places/${id}/equipment/table`, 'PUT', {}],
        [`/api/places/${id}/equipment/chair`, 'DELETE'],
      ];
      for (const [path, method, json] of calls) {
        const res = await call(who, path, method, json);
        expect(res.status, `${method} ${path}`).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      }
    }
    expect(await row(id)).toEqual(before);
    expect(await activeHome(id)).toEqual(['chair']);
  });
});
