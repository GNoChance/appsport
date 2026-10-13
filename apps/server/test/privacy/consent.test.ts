import { afterEach, describe, expect, it } from 'vitest';
import { HttpError } from '../../src/http/errors';
import {
  deleteLimitation,
  saveHealthScreening,
  updateLimitation,
  createLimitation as writeLimitation,
} from '../../src/privacy/consent';
import {
  createTestContext,
  createUser,
  createUserAndLogin,
  insertFixtureRow,
  login,
  type TestContext,
} from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;

const call = (u: { cookie: string }, path: string, method = 'GET', json?: unknown) =>
  ctx.request(path, { method, cookie: u.cookie, ...(json !== undefined ? { json } : {}) });
const grant = (u: Member, json: unknown = { type: 'health', textVersion: '1.0' }) =>
  call(u, '/api/me/consents', 'POST', json);
const screening = (u: Member, answers: unknown, questionnaireVersion = '1.0') =>
  call(u, '/api/me/health-screening', 'PUT', { answers, questionnaireVersion });
const createLimitation = (u: Member, json: unknown) => call(u, '/api/me/limitations', 'POST', json);
const consentEvents = (userId: string) =>
  ctx.deps.db.selectFrom('consentEvent').selectAll().where('ownerId', '=', userId).execute();
const securityEvents = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).execute();
const limitation = (id: string) =>
  ctx.deps.db.selectFrom('limitation').selectAll().where('id', '=', id).executeTakeFirst();
const KNEE = { bodyArea: 'knee', side: 'left', severity: 'mild', note: 'gêne en descente' };

async function setup() {
  ctx = await createTestContext();
  return createUserAndLogin(ctx);
}

describe('POST /api/me/consents (R-CST-1)', () => {
  it('enregistre le consentement santé et le journalise', async () => {
    const u = await setup();
    const res = await grant(u);
    expect(res.status).toBe(200);
    const me = (await res.json()) as { consents: { health: unknown } };
    expect(me.consents.health).toEqual({ active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' });
    const events = await consentEvents(u.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'health', action: 'grant', textVersion: '1.0', updatedBy: u.id });
    const logged = await securityEvents('consent_granted');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ actorId: u.id, targetId: u.id, outcome: 'success' });
    expect(JSON.parse(logged[0]?.details ?? 'null')).toEqual({ consentType: 'health' });
  });

  it('refuse une autre version du texte ou un autre type', async () => {
    const u = await setup();
    expect((await grant(u, { type: 'health', textVersion: '0.9' })).status).toBe(400);
    expect((await grant(u, { type: 'ai_coach', textVersion: '1.0' })).status).toBe(400);
    expect(await consentEvents(u.id)).toHaveLength(0);
  });

  it('un accord identique répété ne crée qu’un seul événement', async () => {
    const u = await setup();
    expect((await grant(u)).status).toBe(200);
    ctx.clock.advance(1000);
    expect((await grant(u)).status).toBe(200);
    expect(await consentEvents(u.id)).toHaveLength(1);
    expect(await securityEvents('consent_granted')).toHaveLength(1);
  });
});

describe('garde C2 sans consentement (R-CST-4, P-CST-2)', () => {
  it('refuse le questionnaire et la création de limitation, même avec un corps vide', async () => {
    const u = await setup();
    for (const json of [{}, { answers: [false, false, false, false], questionnaireVersion: '1.0' }]) {
      const res = await call(u, '/api/me/health-screening', 'PUT', json);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'health_consent_required' });
    }
    for (const json of [{}, KNEE]) {
      const res = await createLimitation(u, json);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'health_consent_required' });
    }
    expect(await ctx.deps.db.selectFrom('healthScreening').selectAll().execute()).toHaveLength(0);
    expect(await ctx.deps.db.selectFrom('limitation').selectAll().execute()).toHaveLength(0);
  });

  it('refuse la modification et la suppression d’une limitation existante', async () => {
    const u = await setup();
    const row = await insertFixtureRow(ctx.deps.db, 'limitation', { ownerId: u.id });
    const id = row.id as string;
    const patch = await call(u, `/api/me/limitations/${id}`, 'PATCH', { severity: 'severe' });
    expect(patch.status).toBe(403);
    expect(await patch.json()).toEqual({ error: 'health_consent_required' });
    const del = await call(u, `/api/me/limitations/${id}`, 'DELETE', {});
    expect(del.status).toBe(403);
    expect(await limitation(id)).toEqual(row);
  });
});

describe('PUT /api/me/health-screening (02 §12 E7)', () => {
  it('calcule caution sans stocker les réponses', async () => {
    const u = await setup();
    await grant(u);
    const none = await screening(u, [false, false, false, false]);
    expect(none.status).toBe(200);
    expect(await none.json()).toEqual({ caution: false });
    const one = await screening(u, [false, false, true, false]);
    expect(await one.json()).toEqual({ caution: true });
    const rows = await ctx.deps.db.selectFrom('healthScreening').selectAll().execute();
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual([
      'answeredAt',
      'caution',
      'createdAt',
      'deletedAt',
      'id',
      'ownerId',
      'questionnaireVersion',
      'rev',
      'updatedAt',
      'updatedBy',
    ]);
    expect(row).toMatchObject({
      id: u.id,
      ownerId: u.id,
      caution: 1,
      questionnaireVersion: '1.0',
      answeredAt: '2026-10-06T10:00:00.000Z',
      deletedAt: null,
    });
    const me = (await (await call(u, '/api/me')).json()) as { cautious: boolean };
    expect(me.cautious).toBe(true);
  });

  it('refuse une autre version du questionnaire ou trois réponses', async () => {
    const u = await setup();
    await grant(u);
    expect((await screening(u, [false, false, false, false], '0.1')).status).toBe(400);
    expect((await screening(u, [false, false, false])).status).toBe(400);
    expect(await ctx.deps.db.selectFrom('healthScreening').selectAll().execute()).toHaveLength(0);
  });
});

describe('/api/me/limitations', () => {
  it('crée, modifie puis supprime une limitation (tombstone sans contenu)', async () => {
    const u = await setup();
    await grant(u);
    const created = await createLimitation(u, KNEE);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(await limitation(id)).toMatchObject({
      ownerId: u.id,
      bodyArea: 'knee',
      side: 'left',
      severity: 'mild',
      note: 'gêne en descente',
      active: 1,
      updatedBy: u.id,
      deletedAt: null,
    });

    const before = (await limitation(id))?.rev as number;
    const patched = await call(u, `/api/me/limitations/${id}`, 'PATCH', {
      severity: 'severe',
      active: false,
    });
    expect(patched.status).toBe(204);
    const afterPatch = await limitation(id);
    expect(afterPatch).toMatchObject({ severity: 'severe', active: 0, note: 'gêne en descente' });
    expect(afterPatch?.rev).toBeGreaterThan(before);

    const deleted = await call(u, `/api/me/limitations/${id}`, 'DELETE');
    expect(deleted.status).toBe(204);
    expect(await limitation(id)).toMatchObject({
      bodyArea: null,
      side: null,
      severity: null,
      note: null,
      active: null,
      deletedAt: '2026-10-06T10:00:00.000Z',
    });
    expect((await call(u, `/api/me/limitations/${id}`, 'PATCH', { severity: 'mild' })).status).toBe(404);
    expect((await call(u, `/api/me/limitations/${id}`, 'DELETE')).status).toBe(404);
  });

  it('refuse une note de 201 caractères ou une zone inconnue', async () => {
    const u = await setup();
    await grant(u);
    expect((await createLimitation(u, { ...KNEE, note: 'x'.repeat(201) })).status).toBe(400);
    expect((await createLimitation(u, { ...KNEE, bodyArea: 'tail' })).status).toBe(400);
    const { id } = (await (await createLimitation(u, KNEE)).json()) as { id: string };
    expect((await call(u, `/api/me/limitations/${id}`, 'PATCH', { note: 'x'.repeat(201) })).status).toBe(400);
    expect((await call(u, `/api/me/limitations/${id}`, 'PATCH', {})).status).toBe(400);
  });

  it("répond 404 à l'admin pour la limitation d'un membre, avec ou sans accord", async () => {
    ctx = await createTestContext();
    const owner = await createUser(ctx, { username: 'brigitte' });
    const admin = await createUser(ctx, { username: 'porteur', role: 'admin', password: 'quatorze carac' });
    const cookie = await login(ctx, 'porteur', admin.password);
    const row = await insertFixtureRow(ctx.deps.db, 'limitation', { ownerId: owner.id });
    const path = `/api/me/limitations/${row.id as string}`;
    for (const withConsent of [false, true]) {
      if (withConsent)
        await call({ cookie }, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' });
      for (const method of ['PATCH', 'DELETE']) {
        const res = await call({ cookie }, path, method, {});
        expect(res.status, `${method} accord=${withConsent}`).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      }
    }
    expect(await limitation(row.id as string)).toEqual(row);
  });
});

describe('garde C2 dans la transaction d’écriture (course avec un retrait)', () => {
  it('chaque écriture C2 relit l’accord et refuse après un retrait', async () => {
    const u = await setup();
    await grant(u);
    await screening(u, [true, false, false, false]);
    const { id } = (await (await createLimitation(u, KNEE)).json()) as { id: string };
    const withdrawn = await call(u, '/api/me/consents/withdraw', 'POST', {
      type: 'health',
      password: u.password,
    });
    expect(withdrawn.status).toBe(200);
    const { db } = ctx.deps;
    const dump = async () => ({
      screening: await db.selectFrom('healthScreening').selectAll().execute(),
      limitations: await db.selectFrom('limitation').selectAll().execute(),
    });
    const before = await dump();
    const writes: [string, (trx: Parameters<typeof deleteLimitation>[0]) => Promise<unknown>][] = [
      [
        'questionnaire',
        (trx) => saveHealthScreening(trx, ctx.deps, u.id, { caution: true, questionnaireVersion: '1.0' }),
      ],
      [
        'création',
        (trx) => writeLimitation(trx, ctx.deps, u.id, { bodyArea: 'hip', side: 'both', severity: 'mild' }),
      ],
      ['modification', (trx) => updateLimitation(trx, ctx.deps, u.id, id, { severity: 'severe' })],
      ['suppression', (trx) => deleteLimitation(trx, ctx.deps, u.id, id)],
    ];
    for (const [label, write] of writes) {
      const error = await db
        .transaction()
        .execute(write)
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(error, label).toBeInstanceOf(HttpError);
      expect((error as HttpError).status, label).toBe(403);
      expect((error as HttpError).code, label).toBe('health_consent_required');
    }
    expect(await dump()).toEqual(before);
  });
});
