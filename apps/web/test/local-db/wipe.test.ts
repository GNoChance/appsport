import { makeOp, SYNC_FIXTURE_RULES } from '@appsport/server/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localHealthConsentActive } from '../../src/local-db/consent';
import { type AppDb, type DeadletterEntry, mirrorStoreNames } from '../../src/local-db/db';
import { getMeta, setMeta, USER_META_KEYS } from '../../src/local-db/meta';
import { clearMirrors, purgeHealthData, wipeUserData } from '../../src/local-db/wipe';
import { createFixtureLocalDb, createTestLocalDb, dumpLocalDb } from '../support/local-db';

const W = 'TEMOIN_SANTE_7f3a';
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  ownerId: 'u1',
  serverRevSeen: 1,
  deletedAt: null,
  ...extra,
});
const dead = (opId: string, entity: string, detail: unknown): DeadletterEntry => ({
  opId,
  userId: 'u1',
  entity,
  id: 'x',
  code: 'validation',
  detail,
  receivedAt: '2026-10-06T10:00:00.000Z',
});

let db: AppDb;
afterEach(async () => {
  await db.delete();
});

async function mirrorCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of mirrorStoreNames(db)) out[s] = await db.mirror(s).count();
  return out;
}

describe('wipeUserData et clearMirrors', () => {
  beforeEach(async () => {
    db = createTestLocalDb();
    await db.mirror('training_profile').put(row('u1', { goal: 'muscle', cautiousMode: false }));
    await db.mirror('gym').put(row('g1', { name: 'Salle', nameKey: 'salle' }));
    await db.mirror('sync_rejection').put(row('r1', { dismissedAt: null }));
    await setMeta(db, 'deviceId', 'dev1');
    await setMeta(db, 'catalogVersion', 'cat1');
    await setMeta(db, 'userId', 'u1');
    await setMeta(db, 'watermark', 'e1:4');
    await setMeta(db, 'serverEpoch', 'e1');
    await setMeta(db, 'lastPullOkAt', '2026-10-06T10:00:00.000Z');
    await setMeta(db, 'activeSessionId', null);
    await db.outbox.put(makeOp({ userId: 'u1', entity: 'sync_rejection', id: 'r1', kind: 'patch' }));
    await db.deadletter.put(dead('0199b9a0-0000-7000-8000-000000000009', 'sync_rejection', {}));
    await db.table('exercises').put({ id: 'squat' });
  });

  it('keepOutbox true : miroirs et clés utilisateur vidés ; outbox, deadletter, appareil et catalogue gardés', async () => {
    await wipeUserData(db, { keepOutbox: true });
    expect(Object.values(await mirrorCounts()).every((n) => n === 0)).toBe(true);
    for (const k of USER_META_KEYS) expect(await getMeta(db, k), k).toBeUndefined();
    expect(await db.outbox.count()).toBe(1);
    expect(await db.deadletter.count()).toBe(1);
    expect(await getMeta(db, 'deviceId')).toBe('dev1');
    expect(await getMeta(db, 'catalogVersion')).toBe('cat1');
    expect(await db.table('exercises').count()).toBe(1);
  });

  it('keepOutbox false : outbox et deadletter vidés aussi', async () => {
    await wipeUserData(db, { keepOutbox: false });
    expect(Object.values(await mirrorCounts()).every((n) => n === 0)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.deadletter.count()).toBe(0);
    expect(await getMeta(db, 'deviceId')).toBe('dev1');
    expect(await db.table('exercises').count()).toBe(1);
  });

  it('clearMirrors ne vide que les miroirs', async () => {
    await clearMirrors(db);
    expect(Object.values(await mirrorCounts()).every((n) => n === 0)).toBe(true);
    expect(await getMeta(db, 'watermark')).toBe('e1:4');
    expect(await db.outbox.count()).toBe(1);
    expect(await db.deadletter.count()).toBe(1);
  });
});

describe('localHealthConsentActive', () => {
  beforeEach(() => {
    db = createTestLocalDb();
  });
  const event = (id: string, type: string, action: string, createdAt: string) =>
    row(id, { type, action, textVersion: '1.0', createdAt });

  it('aucun → false ; grant → true ; grant puis withdraw → false', async () => {
    expect(await localHealthConsentActive(db)).toBe(false);
    await db.mirror('consent_event').put(event('e1', 'health', 'grant', '2026-10-01T10:00:00.000Z'));
    await db.mirror('consent_event').put(event('e0', 'ai_coach', 'withdraw', '2026-10-03T10:00:00.000Z'));
    expect(await localHealthConsentActive(db)).toBe(true);
    await db.mirror('consent_event').put(event('e2', 'health', 'withdraw', '2026-10-02T10:00:00.000Z'));
    expect(await localHealthConsentActive(db)).toBe(false);
  });
});

describe('purgeHealthData', () => {
  beforeEach(() => {
    db = createFixtureLocalDb();
  });

  it('efface les données de santé des miroirs, de l’outbox et de la deadletter', async () => {
    await db.mirror('health_screening').put(row('u1', { caution: true, questionnaireVersion: '1' }));
    await db.mirror('limitation').put(row('l1', { bodyArea: 'knee', note: W, active: true }));
    await db.mirror('fixture_c2_log').put(row('c1', { value: W }));
    await db.mirror('fixture_note').put(row('n1', { title: 't' }));
    await db
      .mirror('fixture_note_item')
      .bulkPut([
        row('i1', { noteId: 'n1', label: 'x', painNote: W, reason: 'pain' }),
        row('i2', { noteId: 'n1', label: 'y', painNote: null, reason: 'fatigue' }),
      ]);
    await db.outbox.bulkPut([
      makeOp({ userId: 'u1', entity: 'fixture_c2_log', id: 'c1', kind: 'create', fields: { value: W } }),
      makeOp({
        userId: 'u1',
        entity: 'fixture_note_item',
        id: 'i1',
        kind: 'patch',
        fields: { painNote: W, label: 'x' },
      }),
      makeOp({ userId: 'u1', entity: 'fixture_note_item', id: 'i1', kind: 'patch', fields: { painNote: W } }),
    ]);
    await db.deadletter.bulkPut([
      dead('0199b9a0-0000-7000-8000-000000000011', 'fixture_c2_log', { value: W }),
      dead('0199b9a0-0000-7000-8000-000000000012', 'fixture_note', { reason: 'title' }),
    ]);

    expect(await purgeHealthData(db, SYNC_FIXTURE_RULES)).toEqual({
      rowsCleared: 4,
      opsRemoved: 2,
      opsStripped: 1,
    });

    expect(await dumpLocalDb(db)).not.toContain(W);
    expect((await db.outbox.toArray()).map((o) => o.fields)).toEqual([{ label: 'x' }]);
    expect(await db.mirror('health_screening').count()).toBe(0);
    expect(await db.mirror('limitation').count()).toBe(0);
    expect(await db.mirror('fixture_c2_log').count()).toBe(0);
    expect(await db.mirror('fixture_note_item').get('i1')).toMatchObject({
      painNote: null,
      reason: null,
      label: 'x',
    });
    expect(await db.mirror('fixture_note_item').get('i2')).toMatchObject({ reason: 'fatigue' });
    expect(await db.mirror('fixture_note').get('n1')).toMatchObject({ title: 't' });
    expect((await db.deadletter.toArray()).map((d) => d.entity)).toEqual(['fixture_note']);
  });

  it('sans règle : registre du socle', async () => {
    db.close();
    await db.delete();
    db = createTestLocalDb();
    await db.mirror('limitation').put(row('l1', { note: W }));
    await db.mirror('place').put(row('p1', { name: 'Maison' }));
    expect(await purgeHealthData(db)).toEqual({ rowsCleared: 1, opsRemoved: 0, opsStripped: 0 });
    expect(await db.mirror('place').count()).toBe(1);
  });
});
