import type { MeResponse } from '@appsport/contracts';
import { describe, expect, it } from 'vitest';
import { getMeta } from '../../src/local-db/meta';
import { createRepos } from '../../src/repos';
import { createTestServices, makeMe } from '../support/render';
import { seedMirror } from '../support/seed';

const consented = (textVersion: string | null, active = true): MeResponse =>
  makeMe({
    consents: {
      health: { active, textVersion, at: '2026-10-01T10:00:00.000Z' },
      aiCoach: { active: false, textVersion: null, at: null },
    },
  });

async function setup(me: MeResponse = consented('1.0')) {
  const t = await createTestServices({ me });
  await seedMirror(t.db, 'health_screening', [
    {
      id: 'u-1',
      ownerId: 'u-1',
      caution: true,
      questionnaireVersion: '1.0',
      answeredAt: '2026-10-02T10:00:00.000Z',
    },
  ]);
  await seedMirror(t.db, 'limitation', [
    { id: 'l-1', ownerId: 'u-1', bodyArea: 'knee', side: 'left', severity: 'mild', note: null, active: true },
    {
      id: 'l-2',
      ownerId: 'u-1',
      bodyArea: null,
      side: null,
      severity: null,
      note: null,
      active: null,
      deletedAt: '2026-10-03T10:00:00.000Z',
    },
  ]);
  return { ...t, consent: createRepos(t.services).consent };
}

describe('ConsentRepo', () => {
  it('lectures : état, questionnaire et limitations actives du miroir', async () => {
    const { consent } = await setup();
    expect((await consent.state())?.health.active).toBe(true);
    expect(await consent.screening()).toEqual({
      caution: true,
      questionnaireVersion: '1.0',
      answeredAt: '2026-10-02T10:00:00.000Z',
    });
    expect(await consent.limitations()).toEqual([
      { id: 'l-1', bodyArea: 'knee', side: 'left', severity: 'mild', note: null, active: true },
    ]);
  });

  it('withdrawHealth : POST, meta.me à jour, miroirs C2 vidés, un pull', async () => {
    const { consent, api, sync, db } = await setup();
    let body: unknown;
    api.on('POST', '/api/me/consents/withdraw', (req) => {
      body = req.body;
      return { status: 200, body: consented(null, false) };
    });
    await consent.withdrawHealth('pw');
    expect(body).toEqual({ type: 'health', password: 'pw' });
    expect((await getMeta(db, 'me'))?.consents.health.active).toBe(false);
    expect(await db.mirror('health_screening').count()).toBe(0);
    expect(await db.mirror('limitation').count()).toBe(0);
    expect(sync.pullCount).toBe(1);
  });

  it('withdrawHealth : 401 → rien de purgé', async () => {
    const { consent, api, sync, db } = await setup();
    api.on('POST', '/api/me/consents/withdraw', { status: 401, body: { error: 'invalid_credentials' } });
    await expect(consent.withdrawHealth('faux')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(await db.mirror('health_screening').count()).toBe(1);
    expect(await db.mirror('limitation').count()).toBe(2);
    expect((await getMeta(db, 'me'))?.consents.health.active).toBe(true);
    expect(sync.pullCount).toBe(0);
  });

  it('needsHealthReconsent : version majeure inférieure à celle du texte, accord actif', async () => {
    for (const [me, expected] of [
      [consented('0.9'), true],
      [consented('1.0'), false],
      [consented('1.4'), false],
      [consented('0.9', false), false],
    ] as const) {
      const { consent } = await setup(me);
      expect(await consent.needsHealthReconsent()).toBe(expected);
    }
  });

  it('grantHealth : POST de la version du texte, meta.me à jour, un pull', async () => {
    const { consent, api, sync, db } = await setup(consented(null, false));
    let body: unknown;
    api.on('POST', '/api/me/consents', (req) => {
      body = req.body;
      return { status: 200, body: consented('1.0') };
    });
    await consent.grantHealth();
    expect(body).toEqual({ type: 'health', textVersion: '1.0' });
    expect((await getMeta(db, 'me'))?.consents.health.active).toBe(true);
    expect(sync.pullCount).toBe(1);
  });

  it('saveScreening : PUT { answers, questionnaireVersion }, un pull', async () => {
    const { consent, api, sync } = await setup();
    let body: unknown;
    api.on('PUT', '/api/me/health-screening', (req) => {
      body = req.body;
      return { status: 200, body: { caution: true } };
    });
    expect(await consent.saveScreening([true, false, false, false])).toEqual({ caution: true });
    expect(body).toEqual({ answers: [true, false, false, false], questionnaireVersion: '1.0' });
    expect(sync.pullCount).toBe(1);
  });

  it('limitations : POST, PATCH, DELETE puis pull', async () => {
    const { consent, api, sync } = await setup();
    api.on('POST', '/api/me/limitations', { status: 201, body: { id: 'l-9' } });
    api.on('PATCH', '/api/me/limitations/:id', { status: 204 });
    api.on('DELETE', '/api/me/limitations/:id', { status: 204 });
    expect(await consent.addLimitation({ bodyArea: 'knee', side: 'left', severity: 'mild' })).toEqual({
      id: 'l-9',
    });
    await consent.updateLimitation('l-9', { severity: 'severe' });
    await consent.removeLimitation('l-9');
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/me/limitations',
      'PATCH /api/me/limitations/l-9',
      'DELETE /api/me/limitations/l-9',
    ]);
    expect(sync.pullCount).toBe(3);
  });
});
