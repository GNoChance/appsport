import { defaultLoadSettings } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { insertGymPlace } from '../../src/places/place-rows';
import { deleteAccount } from '../../src/privacy/delete-account';
import {
  createTestContext,
  createUser,
  createUserAndLogin,
  insertFixtureRow,
  type TestContext,
} from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
const D = defaultLoadSettings('gym');
const NAME = 'Basic-Fit Part-Dieu';

const call = (cookie: string, path: string, method = 'GET', json?: unknown) =>
  ctx.request(path, {
    method,
    cookie,
    ...(json !== undefined || method === 'PUT' ? { json: json ?? {} } : {}),
  });

const createGym = (u: Member, over: Record<string, unknown> = {}) =>
  call(u.cookie, '/api/gyms', 'POST', {
    name: NAME,
    city: 'Lyon',
    equipment: ['barbell', 'squat_rack'],
    isPrimary: true,
    ...over,
  });

async function setup(): Promise<{ a: Member; b: Member; admin: Member; gymId: string }> {
  ctx = await createTestContext();
  const a = await createUserAndLogin(ctx);
  const b = await createUserAndLogin(ctx);
  const admin = await createUserAndLogin(ctx, { role: 'admin' });
  const res = await createGym(a);
  expect(res.status).toBe(201);
  const { gymId } = (await res.json()) as { gymId: string };
  return { a, b, admin, gymId };
}

const gymRow = (id: string) =>
  ctx.deps.db.selectFrom('gym').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const detail = async (u: Member, id: string) => {
  const res = await call(u.cookie, `/api/gyms/${id}`);
  expect(res.status).toBe(200);
  return (await res.json()) as {
    name: string;
    city: string;
    deletedAt: string | null;
    equipment: string[];
    canEdit: boolean;
    visibleMembers: string[];
    history: { action: string; authorUsername: string | null; detail: unknown }[];
  };
};
const activeEquipment = async (gymId: string) =>
  (
    await ctx.deps.db
      .selectFrom('gymEquipment')
      .select('equipmentCode')
      .where('gymId', '=', gymId)
      .where('deletedAt', 'is', null)
      .orderBy('equipmentCode')
      .execute()
  ).map((r) => r.equipmentCode);
const equipRow = (gymId: string, code: string) =>
  ctx.deps.db
    .selectFrom('gymEquipment')
    .selectAll()
    .where('id', '=', `${gymId}:${code}`)
    .executeTakeFirstOrThrow();
const give = async (u: { id: string }, gymId: string, over: Record<string, unknown> = {}) =>
  insertFixtureRow(ctx.deps.db, 'place', {
    ownerId: u.id,
    kind: 'gym',
    gymId,
    name: null,
    loadSettings: null,
    visibleAtGym: 1,
    ...over,
  });
const sessionUser = (u: { id: string; username: string }) => ({
  id: u.id,
  username: u.username,
  role: 'member' as const,
  birthDate: '1990-01-01',
  mustChangePassword: false,
});

describe('POST /api/gyms', () => {
  it('crée la salle, son matériel, son historique et le lieu', async () => {
    ctx = await createTestContext();
    const a = await createUserAndLogin(ctx);
    const res = await createGym(a);
    expect(res.status).toBe(201);
    const { gymId, placeId } = (await res.json()) as { gymId: string; placeId: string };
    const gym = await gymRow(gymId);
    expect(gym).toMatchObject({
      name: NAME,
      nameKey: 'basic fit part dieu',
      city: 'Lyon',
      cityKey: 'lyon',
      createdBy: a.id,
      updatedBy: a.id,
      deletedAt: null,
    });
    expect(JSON.parse(gym.loadSettings)).toEqual(defaultLoadSettings('gym'));
    const equipment = await ctx.deps.db
      .selectFrom('gymEquipment')
      .selectAll()
      .where('gymId', '=', gymId)
      .orderBy('id')
      .execute();
    expect(equipment.map((e) => [e.id, e.equipmentCode, e.addedBy, e.deletedAt])).toEqual([
      [`${gymId}:barbell`, 'barbell', a.id, null],
      [`${gymId}:squat_rack`, 'squat_rack', a.id, null],
    ]);
    const places = await ctx.deps.db.selectFrom('place').selectAll().where('gymId', '=', gymId).execute();
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      id: placeId,
      kind: 'gym',
      ownerId: a.id,
      isPrimary: 1,
      visibleAtGym: 1,
      loadSettings: null,
      name: null,
    });
    const history = await ctx.deps.db
      .selectFrom('gymHistory')
      .selectAll()
      .where('gymId', '=', gymId)
      .execute();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ action: 'create', authorId: a.id });
  });

  it('refuse un doublon de nom et de ville normalisés (409 gym_duplicate)', async () => {
    const { b, gymId } = await setup();
    const res = await createGym(b, { name: 'BASIC FIT  part-dieu', city: ' lyon ' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'gym_duplicate', gymId });
  });

  it('refuse le matériel du quotidien, un code inconnu, un nom ou une ville hors bornes (R-EQ-3)', async () => {
    const { b } = await setup();
    expect((await createGym(b, { name: 'Autre', equipment: ['chair'] })).status).toBe(400);
    expect((await createGym(b, { name: 'Autre', equipment: ['cardio'] })).status).toBe(400);
    expect((await createGym(b, { name: 'X' })).status).toBe(400);
    expect((await createGym(b, { name: 'Autre', city: 'v'.repeat(61) })).status).toBe(400);
  });

  it('mineur : lieu invisible par défaut, visible sur demande (P-MIN-6)', async () => {
    ctx = await createTestContext();
    const minor = await createUserAndLogin(ctx, { birthDate: '2012-01-01' });
    const other = await createUserAndLogin(ctx, { birthDate: '2012-01-01' });
    const first = (await (await createGym(minor)).json()) as { placeId: string };
    const second = (await (await createGym(other, { name: 'Keep Cool', visibleAtGym: true })).json()) as {
      placeId: string;
    };
    const visible = (id: string) =>
      ctx.deps.db.selectFrom('place').select('visibleAtGym').where('id', '=', id).executeTakeFirstOrThrow();
    expect((await visible(first.placeId)).visibleAtGym).toBe(0);
    expect((await visible(second.placeId)).visibleAtGym).toBe(1);
  });

  it('exige une session', async () => {
    ctx = await createTestContext();
    const res = await ctx.request('/api/gyms', { method: 'POST', json: { name: NAME } });
    expect(res.status).toBe(401);
  });
});

describe('recherche (R-SAL-1)', () => {
  it('liste, filtre par q et propose des salles proches', async () => {
    const { a, gymId } = await setup();
    const ids = async (path: string) =>
      ((await (await call(a.cookie, path)).json()) as { id: string }[]).map((g) => g.id);
    expect(await ids('/api/gyms')).toEqual([gymId]);
    expect(await ids('/api/gyms?q=PART')).toEqual([gymId]);
    expect(await ids('/api/gyms?q=marseille')).toEqual([]);
    expect(await ids('/api/gyms/similar?name=basic fit&city=Villeurbanne')).toEqual([gymId]);
    expect(await ids('/api/gyms/similar?name=Fitness Park&city=LYON')).toEqual([gymId]);
    expect(await ids('/api/gyms/similar?name=Keep Cool&city=Paris')).toEqual([]);
    expect(await ids('/api/gyms/similar?name=b&city=')).toEqual([]);
  });

  it('rend le décompte de membres visibles', async () => {
    const { a, gymId } = await setup();
    const list = await (await call(a.cookie, '/api/gyms')).json();
    expect(list).toEqual([{ id: gymId, name: NAME, city: 'Lyon', visibleMemberCount: 1 }]);
  });
});

describe('droits (R-SAL-4)', () => {
  it("refuse un membre sans lieu actif à la salle, accepte l'admin et le membre", async () => {
    const { a, b, admin, gymId } = await setup();
    const body = { city: 'Lyon 3' };
    expect((await call(b.cookie, `/api/gyms/${gymId}`, 'PATCH', body)).status).toBe(403);
    expect((await call(b.cookie, `/api/gyms/${gymId}/equipment/kettlebell`, 'PUT')).status).toBe(403);
    expect((await call(b.cookie, `/api/gyms/${gymId}/equipment/barbell`, 'DELETE')).status).toBe(403);
    expect((await detail(b, gymId)).canEdit).toBe(false);
    expect((await detail(a, gymId)).canEdit).toBe(true);
    expect((await call(admin.cookie, `/api/gyms/${gymId}`, 'PATCH', body)).status).toBe(204);
    expect((await call(admin.cookie, `/api/gyms/${gymId}/equipment/kettlebell`, 'PUT')).status).toBe(204);
    await give(b, gymId);
    expect((await detail(b, gymId)).canEdit).toBe(true);
    expect((await call(b.cookie, `/api/gyms/${gymId}`, 'PATCH', { city: 'Lyon 4' })).status).toBe(204);
  });

  it('un lieu supprimé ne donne plus le droit', async () => {
    const { b, gymId } = await setup();
    await give(b, gymId, { deletedAt: '2026-10-06T10:00:00.000Z' });
    expect((await call(b.cookie, `/api/gyms/${gymId}`, 'PATCH', { city: 'Lyon 4' })).status).toBe(403);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const { a } = await setup();
    expect((await call(a.cookie, '/api/gyms/inconnue')).status).toBe(404);
    expect((await call(a.cookie, '/api/gyms/inconnue', 'PATCH', { city: 'Lyon 4' })).status).toBe(404);
    expect((await call(a.cookie, '/api/gyms/inconnue/equipment/barbell', 'PUT')).status).toBe(404);
    expect((await call(a.cookie, '/api/gyms/inconnue/equipment/barbell', 'DELETE')).status).toBe(404);
  });
});

describe('matériel (R-SAL-5)', () => {
  it('ajoute, retire et réactive de façon idempotente, avec historique', async () => {
    const { a, gymId } = await setup();
    const put = () => call(a.cookie, `/api/gyms/${gymId}/equipment/dumbbells`, 'PUT');
    const del = () => call(a.cookie, `/api/gyms/${gymId}/equipment/dumbbells`, 'DELETE');
    expect((await put()).status).toBe(204);
    const rev1 = (await equipRow(gymId, 'dumbbells')).rev;
    expect((await put()).status).toBe(204);
    expect((await equipRow(gymId, 'dumbbells')).rev).toBe(rev1);

    expect((await del()).status).toBe(204);
    const removed = await equipRow(gymId, 'dumbbells');
    expect(removed.deletedAt).not.toBeNull();
    expect(removed.rev).toBeGreaterThan(rev1);
    expect((await del()).status).toBe(204);
    expect((await equipRow(gymId, 'dumbbells')).rev).toBe(removed.rev);

    expect((await put()).status).toBe(204);
    const back = await equipRow(gymId, 'dumbbells');
    expect(back.deletedAt).toBeNull();
    expect(back.rev).toBeGreaterThan(removed.rev);

    const d = await detail(a, gymId);
    // Ordre de EQUIPMENT.
    expect(d.equipment).toEqual(['dumbbells', 'squat_rack', 'barbell']);
    // Horloge figée : toutes les lignes ont le même `at`, l'ordre vient de `id DESC` (UUIDv7 monotones), plus récent d'abord.
    expect(d.history.map((h) => h.action)).toEqual([
      'add_equipment',
      'remove_equipment',
      'add_equipment',
      'create',
    ]);
    expect(d.history[0]?.detail).toEqual({ code: 'dumbbells' });
  });

  it('refuse un code inconnu ou du quotidien (400)', async () => {
    const { a, gymId } = await setup();
    expect((await call(a.cookie, `/api/gyms/${gymId}/equipment/table`, 'PUT')).status).toBe(400);
    expect((await call(a.cookie, `/api/gyms/${gymId}/equipment/cardio`, 'PUT')).status).toBe(400);
  });

  it("deux PUT simultanés conservent l'union", async () => {
    const { a, b, gymId } = await setup();
    await give(b, gymId);
    const [r1, r2] = await Promise.all([
      call(a.cookie, `/api/gyms/${gymId}/equipment/leg_press`, 'PUT'),
      call(b.cookie, `/api/gyms/${gymId}/equipment/lat_pulldown`, 'PUT'),
    ]);
    expect([r1.status, r2.status]).toEqual([204, 204]);
    const codes = await activeEquipment(gymId);
    expect(codes).toEqual(expect.arrayContaining(['lat_pulldown', 'leg_press']));
  });
});

describe('PATCH /api/gyms/:id (R-SAL-6, R-CHG-3)', () => {
  it('renomme et recalcule la clé', async () => {
    const { a, gymId } = await setup();
    const before = await gymRow(gymId);
    expect((await call(a.cookie, `/api/gyms/${gymId}`, 'PATCH', { name: 'Basic Fit Gerland' })).status).toBe(
      204,
    );
    const after = await gymRow(gymId);
    expect(after).toMatchObject({ name: 'Basic Fit Gerland', nameKey: 'basic fit gerland', updatedBy: a.id });
    expect(after.rev).toBeGreaterThan(before.rev);
    const d = await detail(a, gymId);
    expect(d.history[0]).toMatchObject({
      action: 'update_info',
      detail: { name: { from: NAME, to: 'Basic Fit Gerland' } },
    });
  });

  it("refuse le nom d'une autre salle (409) et un corps vide (400)", async () => {
    const { a, b, gymId } = await setup();
    expect((await createGym(b, { name: 'Keep Cool', city: 'Lyon' })).status).toBe(201);
    const res = await call(a.cookie, `/api/gyms/${gymId}`, 'PATCH', { name: 'KEEP-COOL' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'gym_duplicate' });
    expect((await call(a.cookie, `/api/gyms/${gymId}`, 'PATCH', {})).status).toBe(400);
  });

  it("une modification sans effet n'écrit rien", async () => {
    const { a, gymId } = await setup();
    const before = await gymRow(gymId);
    expect(
      (await call(a.cookie, `/api/gyms/${gymId}`, 'PATCH', { city: 'Lyon', loadSettings: D })).status,
    ).toBe(204);
    expect((await gymRow(gymId)).rev).toBe(before.rev);
    expect((await detail(a, gymId)).history).toHaveLength(1);
  });

  it('valide et journalise les réglages de charge', async () => {
    const { a, gymId } = await setup();
    const patch = (loadSettings: unknown) => call(a.cookie, `/api/gyms/${gymId}`, 'PATCH', { loadSettings });
    expect((await patch({ ...D, barG: 30000 })).status).toBe(400);
    expect((await patch({ barG: 15000 })).status).toBe(400);
    const to = { ...D, barG: 15000 };
    expect((await patch(to)).status).toBe(204);
    expect(JSON.parse((await gymRow(gymId)).loadSettings)).toEqual(to);
    const d = await detail(a, gymId);
    expect(d.history[0]).toMatchObject({ action: 'update_load_settings', detail: { from: D, to } });
  });

  it("garde les 10 dernières lignes ; l'auteur d'un compte supprimé devient null", async () => {
    const { a, b, gymId } = await setup();
    await give(b, gymId);
    for (let i = 0; i < 12; i++) {
      // i pair : b, « Lyon 10 » ; i impair : a, « Lyon 11 ».
      const author = i % 2 === 0 ? b : a;
      const city = i % 2 === 0 ? 'Lyon 10' : 'Lyon 11';
      expect((await call(author.cookie, `/api/gyms/${gymId}`, 'PATCH', { city })).status).toBe(204);
      ctx.clock.advance(1000);
    }
    await ctx.deps.db
      .transaction()
      .execute((trx) => deleteAccount(trx, ctx.deps, b.id, { actorId: null, ip: null }));
    const h = (await detail(a, gymId)).history;
    expect(h).toHaveLength(10);
    // Ordre attendu `at DESC` (horloge avancée d'une seconde par PATCH) : le dernier PATCH (i = 11, par a) en premier.
    expect(h[0]).toMatchObject({
      action: 'update_info',
      authorUsername: a.username,
      detail: { city: { from: 'Lyon 10', to: 'Lyon 11' } },
    });
    expect(h[1]?.authorUsername).toBeNull();
  });
});

describe('visibilité (R-VIS-1 à R-VIS-5)', () => {
  it('ne compte que les lieux visibles de comptes actifs ; un mineur est visible sur demande', async () => {
    ctx = await createTestContext();
    const lea = await createUserAndLogin(ctx, { username: 'lea' });
    const gymId = ((await (await createGym(lea)).json()) as { gymId: string }).gymId;
    const minorHidden = await createUser(ctx, { birthDate: '2012-01-01' });
    const minorShown = await createUser(ctx, { birthDate: '2012-01-01', username: 'tom' });
    const hidden = await createUser(ctx);
    const disabled = await createUser(ctx, { status: 'disabled' });
    const removed = await createUser(ctx);
    // Un mineur sans choix a visibleAtGym 0 (défaut de la colonne) ; avec 1, il est listé.
    await give(minorHidden, gymId, { visibleAtGym: 0 });
    await give(minorShown, gymId, { visibleAtGym: 1 });
    await give(hidden, gymId, { visibleAtGym: 0 });
    await give(disabled, gymId);
    await give(removed, gymId);
    await ctx.deps.db
      .transaction()
      .execute((trx) => deleteAccount(trx, ctx.deps, removed.id, { actorId: null, ip: null }));
    const d = await detail(lea, gymId);
    expect(d.visibleMembers).toEqual(['lea', 'tom']);
    const list = (await (await call(lea.cookie, '/api/gyms')).json()) as { visibleMemberCount: number }[];
    expect(list[0]?.visibleMemberCount).toBe(2);
  });

  it("l'auteur d'une modification n'est nommé que s'il est admin ou visible à la salle", async () => {
    const { a, b, admin, gymId } = await setup();
    const c = await createUserAndLogin(ctx);
    await give(b, gymId, { visibleAtGym: 0 });
    await give(c, gymId, { visibleAtGym: 1 });
    expect((await call(b.cookie, `/api/gyms/${gymId}/equipment/leg_press`, 'PUT')).status).toBe(204);
    expect((await call(c.cookie, `/api/gyms/${gymId}/equipment/leg_curl`, 'PUT')).status).toBe(204);
    expect((await call(admin.cookie, `/api/gyms/${gymId}/equipment/seated_row`, 'PUT')).status).toBe(204);
    const h = (await detail(a, gymId)).history;
    expect(h.map((x) => x.authorUsername)).toEqual([admin.username, c.username, null, a.username]);
  });
});

describe('insertGymPlace', () => {
  it("rend principal d'office le premier lieu, rétrograde l'ancien principal et refuse un doublon", async () => {
    const { a, b, gymId } = await setup();
    const secondId = (
      (await (await createGym(a, { name: 'Keep Cool', isPrimary: false })).json()) as { gymId: string }
    ).gymId;
    const primaries = async (userId: string) =>
      (
        await ctx.deps.db
          .selectFrom('place')
          .select('gymId')
          .where('ownerId', '=', userId)
          .where('deletedAt', 'is', null)
          .where('isPrimary', '=', 1)
          .execute()
      ).map((p) => p.gymId);
    expect(await primaries(a.id)).toEqual([gymId]);

    await expect(
      ctx.deps.db
        .transaction()
        .execute((trx) => insertGymPlace(trx, ctx.deps, sessionUser(a), { gymId, isPrimary: true })),
    ).rejects.toMatchObject({ code: 'place_exists' });

    const bUser = sessionUser(b);
    await ctx.deps.db
      .transaction()
      .execute((trx) => insertGymPlace(trx, ctx.deps, bUser, { gymId, isPrimary: false }));
    expect(await primaries(b.id)).toEqual([gymId]);
    await ctx.deps.db
      .transaction()
      .execute((trx) => insertGymPlace(trx, ctx.deps, bUser, { gymId: secondId, isPrimary: true }));
    expect(await primaries(b.id)).toEqual([secondId]);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const { a } = await setup();
    await expect(
      ctx.deps.db
        .transaction()
        .execute((trx) => insertGymPlace(trx, ctx.deps, sessionUser(a), { gymId: 'x', isPrimary: false })),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('DELETE /api/admin/gyms/:id (R-SAL-7)', () => {
  it('refuse un membre, refuse une salle utilisée, supprime sinon', async () => {
    const { a, b, admin, gymId } = await setup();
    expect((await call(b.cookie, `/api/admin/gyms/${gymId}`, 'DELETE')).status).toBe(403);
    const used = await call(admin.cookie, `/api/admin/gyms/${gymId}`, 'DELETE');
    expect(used.status).toBe(409);
    expect(await used.json()).toEqual({ error: 'gym_in_use' });

    await ctx.deps.db
      .updateTable('place')
      .set({ deletedAt: '2026-10-06T10:00:00.000Z' })
      .where('gymId', '=', gymId)
      .execute();
    const before = await gymRow(gymId);
    expect((await call(admin.cookie, `/api/admin/gyms/${gymId}`, 'DELETE')).status).toBe(204);
    const after = await gymRow(gymId);
    expect(after.deletedAt).toBe('2026-10-06T10:00:00.000Z');
    expect(after.rev).toBeGreaterThan(before.rev);
    const event = await ctx.deps.db
      .selectFrom('securityEvent')
      .selectAll()
      .where('type', '=', 'gym_deleted')
      .executeTakeFirstOrThrow();
    expect(event).toMatchObject({ actorId: admin.id, targetId: gymId, outcome: 'success' });

    expect(await (await call(a.cookie, '/api/gyms')).json()).toEqual([]);
    expect((await detail(a, gymId)).deletedAt).toBe('2026-10-06T10:00:00.000Z');
    expect((await call(admin.cookie, `/api/gyms/${gymId}`, 'PATCH', { city: 'Lyon 3' })).status).toBe(404);
    expect((await call(admin.cookie, `/api/gyms/${gymId}/equipment/kettlebell`, 'PUT')).status).toBe(404);
    expect((await call(admin.cookie, `/api/gyms/${gymId}/equipment/barbell`, 'DELETE')).status).toBe(404);
    expect((await call(admin.cookie, `/api/admin/gyms/${gymId}`, 'DELETE')).status).toBe(404);
    await expect(
      ctx.deps.db
        .transaction()
        .execute((trx) => insertGymPlace(trx, ctx.deps, sessionUser(a), { gymId, isPrimary: false })),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('une salle supprimée est réactivée par un POST sur sa clé', async () => {
    const { a, b, admin, gymId } = await setup();
    await call(a.cookie, `/api/gyms/${gymId}/equipment/dumbbells`, 'PUT');
    const to = { ...D, barG: 15000 };
    await call(a.cookie, `/api/gyms/${gymId}`, 'PATCH', { loadSettings: to });
    await ctx.deps.db
      .updateTable('place')
      .set({ deletedAt: '2026-10-06T10:00:00.000Z' })
      .where('gymId', '=', gymId)
      .execute();
    expect((await call(admin.cookie, `/api/admin/gyms/${gymId}`, 'DELETE')).status).toBe(204);
    const g = await gymRow(gymId);

    const res = await createGym(b, {
      name: g.name.toUpperCase(),
      city: g.city,
      equipment: ['leg_press'],
      isPrimary: true,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { gymId: string; placeId: string };
    expect(body.gymId).toBe(gymId);
    const after = await gymRow(gymId);
    expect(after).toMatchObject({ name: g.name.toUpperCase(), deletedAt: null });
    expect(after.rev).toBeGreaterThan(g.rev);
    // Réglages gardés [décision plan].
    expect(JSON.parse(after.loadSettings)).toEqual(to);
    expect(await activeEquipment(gymId)).toEqual(['leg_press']);
    expect((await equipRow(gymId, 'barbell')).deletedAt).not.toBeNull();
    const place = await ctx.deps.db
      .selectFrom('place')
      .select(['ownerId', 'gymId'])
      .where('id', '=', body.placeId)
      .executeTakeFirstOrThrow();
    expect(place).toEqual({ ownerId: b.id, gymId });
    expect((await detail(b, gymId)).history[0]?.action).toBe('create');
  });
});

describe('historique : horodatage à la minute', () => {
  it('`at` est tronqué à la minute dans la réponse (pas de corrélation exacte avec les lignes synchronisées)', async () => {
    ctx = await createTestContext({ now: '2026-10-06T10:17:42.123Z' });
    const a = await createUserAndLogin(ctx);
    const res = await createGym(a);
    const { gymId } = (await res.json()) as { gymId: string };
    const d = (await (await call(a.cookie, `/api/gyms/${gymId}`)).json()) as { history: { at: string }[] };
    expect(d.history.map((h) => h.at)).toEqual(['2026-10-06T10:17:00.000Z']);
    const stored = await ctx.deps.db
      .selectFrom('gymHistory')
      .select('at')
      .where('gymId', '=', gymId)
      .execute();
    expect(stored.map((h) => h.at)).toEqual(['2026-10-06T10:17:42.123Z']);
  });
});
