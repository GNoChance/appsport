// @vitest-environment node
import type { PulledRow, PushResult, SyncOp } from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import { makeOp, SYNC_FIXTURE_RULES } from '@appsport/server/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb, MirrorRow } from '../../src/local-db/db';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { createFakeSyncServer, type FakeSyncServer } from '../support/fake-sync-server';
import { createFixtureLocalDb } from '../support/local-db';
import { until } from '../support/wait';

const DAY = 86_400_000;
const NOW_MS = Date.parse('2026-10-06T12:00:00.000Z');
const ago = (days: number) => new Date(NOW_MS - days * DAY).toISOString();
const newId = createMonotonicUuidV7(
  () => NOW_MS,
  (n) => crypto.getRandomValues(new Uint8Array(n)),
);

let db: AppDb;
let server: FakeSyncServer;
let engine: SyncEngine;
let ids: { n10: string; t5: string; i10: string; n70: string; rej: string };
let patch: SyncOp;

const mirrorRow = (id: string, updatedAt: string, extra: Record<string, unknown> = {}): MirrorRow => ({
  id,
  ownerId: 'u1',
  serverRevSeen: 3,
  deletedAt: null,
  updatedAt,
  ...extra,
});

function makeEngine(extra: Partial<Parameters<typeof createSyncEngine>[0]> = {}): SyncEngine {
  engine = createSyncEngine({
    db,
    transport: server,
    now: () => NOW_MS,
    newOpId: newId,
    rules: SYNC_FIXTURE_RULES,
    triggers: () => () => {},
    ...extra,
  });
  return engine;
}

const consentEvent = (action: 'grant' | 'withdraw', createdAt: string) =>
  mirrorRow(newId(), createdAt, {
    type: 'health',
    action,
    textVersion: 'v1',
    createdAt,
    rev: 2,
    serverRevSeen: 2,
  });

/** Lignes renvoyées par le serveur après restore_upsert : celles reçues. */
const pulled = (entity: string, id: string): PulledRow => ({
  entity,
  rev: 200,
  row: { id, ownerId: 'u1', deletedAt: null, rev: 200, updatedAt: ago(0) },
});

const kinds = () => server.sent.map((batch) => [...new Set(batch.map((o) => o.kind))]);
const restoreBatches = () => server.sent.filter((b) => b.every((o) => o.kind === 'restore_upsert'));
const idle = () => until(() => !engine.getState().syncing);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  db = createFixtureLocalDb();
  server = createFakeSyncServer('E2');
  await setMeta(db, 'userId', 'u1');
  await setMeta(db, 'serverEpoch', 'E1');
  await setMeta(db, 'watermark', 'E1:50');
  ids = { n10: newId(), t5: newId(), i10: newId(), n70: newId(), rej: newId() };
  await db
    .mirror('fixture_note')
    .bulkPut([
      mirrorRow(ids.n10, ago(10), { title: 'dix', serverRevSeen: 5 }),
      mirrorRow(ids.n70, ago(70), { title: 'soixante-dix' }),
      mirrorRow(ids.t5, ago(5), { title: 'tombe', deletedAt: ago(5) }),
    ]);
  await db
    .mirror('fixture_note_item')
    .put(mirrorRow(ids.i10, ago(10), { noteId: ids.n10, label: 'item', painNote: 'genou', reason: 'pain' }));
  await db.mirror('sync_rejection').put(
    mirrorRow(ids.rej, ago(1), {
      opId: newId(),
      entity: 'fixture_note',
      code: 'validation',
      dismissedAt: null,
    }),
  );
  await db.mirror('consent_event').put(consentEvent('grant', ago(30)));
  patch = makeOp({
    userId: 'u1',
    entity: 'fixture_note',
    id: ids.n10,
    kind: 'patch',
    fields: { title: 'p' },
  });
  await db.outbox.add(patch);
  server.rows = [
    pulled('fixture_note', ids.n10),
    pulled('fixture_note', ids.t5),
    pulled('fixture_note_item', ids.i10),
  ];
});
afterEach(async () => {
  engine?.stop();
  vi.useRealTimers();
  await db.delete();
});

describe('nouvelle époque (Review Focus 2)', () => {
  it('restore_upsert parents d’abord, puis l’outbox, puis pull complet', async () => {
    await makeEngine().syncNow('manual');

    expect(server.paths()).toEqual([
      'GET /api/health',
      'POST /api/sync/push',
      'POST /api/sync/push',
      'GET /api/sync/pull',
    ]);
    const [restore, outbox] = server.sent;
    expect(restore?.map((o) => o.id)).toEqual([ids.n10, ids.t5, ids.i10]);
    expect(restore?.every((o) => o.kind === 'restore_upsert' && o.userId === 'u1')).toBe(true);
    expect(restore?.[0]).toMatchObject({ serverRevSeen: 5, fields: { title: 'dix', deletedAt: null } });
    expect(restore?.[0]?.fields).toEqual({ title: 'dix', deletedAt: null });
    expect(restore?.[1]?.fields.deletedAt).toBe(ago(5));
    expect(restore?.[2]?.fields).toEqual({
      noteId: ids.n10,
      label: 'item',
      painNote: 'genou',
      reason: 'pain',
      deletedAt: null,
    });
    expect(outbox?.map((o) => o.kind)).toEqual(['patch']);
    expect(server.log.at(-1)?.query.has('since')).toBe(false);

    expect(await getMeta(db, 'serverEpoch')).toBe('E2');
    expect(await db.mirror('fixture_note').get(ids.n70)).toBeUndefined();
    expect(await db.mirror('sync_rejection').get(ids.rej)).toBeUndefined();
    expect(await db.mirror('fixture_note').get(ids.n10)).toBeDefined();
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getState().serverEpoch).toBe('E2');
  });

  it('health E1 puis 410 watermark_expired portant E2 → miroirs intacts, un seul cycle immédiat de plus', async () => {
    server.epoch = 'E1';
    let mirrorAtFullPull = -1;
    server.on('GET /api/sync/pull', async (req) => {
      if (req.query.has('since')) {
        server.epoch = 'E2';
        return server.json(410, { error: 'watermark_expired' });
      }
      mirrorAtFullPull = await db.mirror('fixture_note').count();
      return server.json(200, {
        rows: server.rows,
        nextWatermark: 'E2:300',
        hasMore: false,
        catalogVersion: null,
      });
    });
    await makeEngine().syncNow('manual');

    expect(server.paths()).toEqual([
      'GET /api/health',
      'POST /api/sync/push',
      'GET /api/sync/pull',
      'GET /api/health',
      'POST /api/sync/push',
      'GET /api/sync/pull',
    ]);
    expect(kinds()).toEqual([['patch'], ['restore_upsert']]);
    expect(mirrorAtFullPull).toBe(3);
    expect(await getMeta(db, 'serverEpoch')).toBe('E2');
    expect(await getMeta(db, 'watermark')).toBe('E2:300');
  });

  it('époque qui change encore pendant le cycle immédiat → pas de troisième cycle', async () => {
    server.epoch = 'E1';
    let n = 0;
    server.on('GET /api/sync/pull', () => {
      n += 1;
      server.epoch = `E${n + 1}`;
      return server.json(200, { rows: [], nextWatermark: 'x:1', hasMore: false, catalogVersion: null });
    });
    await makeEngine().syncNow('manual');
    expect(server.paths().filter((p) => p === 'GET /api/health')).toHaveLength(2);
  });

  for (const fault of ['500', 'offline'] as const) {
    it(`renvoi en ${fault} → époque locale E1, outbox intacte, reprise à +2 s, tout rejoué ensuite`, async () => {
      let failed = false;
      server.on('POST /api/sync/push', (req) => {
        const ops = req.body.ops as SyncOp[];
        server.sent.push(ops);
        if (!failed) {
          failed = true;
          if (fault === 'offline') throw new TypeError('Failed to fetch');
          return server.json(500, { error: 'internal' });
        }
        return server.json(200, { results: ops.map((o) => ({ opId: o.opId, status: 'applied', rev: 300 })) });
      });
      makeEngine().start();
      await idle();
      expect(await getMeta(db, 'serverEpoch')).toBe('E1');
      expect(await getMeta(db, 'watermark')).toBe('E1:50');
      expect(await db.outbox.count()).toBe(1);
      expect(server.paths()).toEqual(['GET /api/health', 'POST /api/sync/push']);

      await vi.advanceTimersByTimeAsync(1999);
      expect(server.log).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      await until(() => server.log.length > 2);
      await idle();
      expect(restoreBatches()).toHaveLength(2);
      expect(restoreBatches()[1]?.map((o) => o.id)).toEqual([ids.n10, ids.t5, ids.i10]);
      expect(kinds().at(-1)).toEqual(['patch']);
      expect(await getMeta(db, 'serverEpoch')).toBe('E2');
      expect(await db.outbox.count()).toBe(0);
    });
  }

  it('renvoi rejected → deadletter, pas un échec ; époque E2 enregistrée', async () => {
    server.on('POST /api/sync/push', (req) => {
      const ops = req.body.ops as SyncOp[];
      server.sent.push(ops);
      const results: PushResult[] = ops.map((o) =>
        o.id === ids.i10 && o.kind === 'restore_upsert'
          ? { opId: o.opId, status: 'rejected', code: 'parent_rejected' }
          : { opId: o.opId, status: 'applied', rev: 300 },
      );
      return server.json(200, { results });
    });
    await makeEngine().syncNow('manual');
    const rejectedOp = server.sent[0]?.find((o) => o.id === ids.i10);
    expect(await db.deadletter.toArray()).toEqual([
      {
        opId: rejectedOp?.opId,
        userId: 'u1',
        entity: 'fixture_note_item',
        id: ids.i10,
        code: 'parent_rejected',
        detail: {
          kind: 'restore_upsert',
          fieldNames: ['deletedAt', 'label', 'noteId', 'painNote', 'reason'],
        },
        receivedAt: ago(0),
      },
    ]);
    expect(await getMeta(db, 'serverEpoch')).toBe('E2');
    expect(engine.getState().connection).toBe('online');
  });

  it('sans consentement local : tables C2 exclues, champs C2 retirés', async () => {
    await db.mirror('consent_event').put(consentEvent('withdraw', ago(2)));
    await db.mirror('fixture_c2_log').put(mirrorRow(newId(), ago(1), { value: 4 }));
    server.healthConsentActive = false;
    await makeEngine().syncNow('manual');
    const restore = restoreBatches()[0] ?? [];
    expect(restore.map((o) => o.entity)).not.toContain('fixture_c2_log');
    expect(restore.find((o) => o.id === ids.i10)?.fields).toEqual({
      noteId: ids.n10,
      label: 'item',
      deletedAt: null,
    });
  });

  it('R-SYN-28 : dernier événement withdraw, /api/me health actif → un seul replay-withdraw avant le pull', async () => {
    const W = ago(3);
    await db.mirror('consent_event').put(consentEvent('withdraw', W));
    await makeEngine().syncNow('manual');
    const paths = server.paths();
    const replays = server.log.filter((r) => r.path === '/api/me/consents/health/replay-withdraw');
    expect(replays).toHaveLength(1);
    expect(replays[0]?.body).toEqual({ withdrawnAt: W });
    expect(replays[0]?.method).toBe('POST');
    const replayAt = paths.indexOf('POST /api/me/consents/health/replay-withdraw');
    expect(paths.indexOf('GET /api/me')).toBeLessThan(replayAt);
    expect(replayAt).toBeLessThan(paths.indexOf('GET /api/sync/pull'));
    expect(await getMeta(db, 'serverEpoch')).toBe('E2');
  });

  it('R-SYN-28 : 409 conflict → époque E2 enregistrée', async () => {
    await db.mirror('consent_event').put(consentEvent('withdraw', ago(3)));
    server.on('POST /api/me/consents/health/replay-withdraw', () => server.json(409, { error: 'conflict' }));
    await makeEngine().syncNow('manual');
    expect(await getMeta(db, 'serverEpoch')).toBe('E2');
    expect(server.paths()).toContain('GET /api/sync/pull');
  });

  it('R-SYN-28 : échec du renvoi du retrait → époque inchangée, reprise', async () => {
    await db.mirror('consent_event').put(consentEvent('withdraw', ago(3)));
    server.on('POST /api/me/consents/health/replay-withdraw', () => server.json(500, { error: 'internal' }));
    await makeEngine().syncNow('manual');
    expect(await getMeta(db, 'serverEpoch')).toBe('E1');
    expect(server.paths()).not.toContain('GET /api/sync/pull');
  });

  it('R-SYN-28 : /api/me health inactif → pas de renvoi', async () => {
    await db.mirror('consent_event').put(consentEvent('withdraw', ago(3)));
    server.healthConsentActive = false;
    await makeEngine().syncNow('manual');
    expect(server.paths()).toContain('GET /api/me');
    expect(server.paths()).not.toContain('POST /api/me/consents/health/replay-withdraw');
  });

  it('R-SYN-28 : dernier événement grant → ni /api/me ni renvoi', async () => {
    await db
      .mirror('consent_event')
      .bulkPut([consentEvent('withdraw', ago(20)), consentEvent('grant', ago(3))]);
    await makeEngine().syncNow('manual');
    expect(server.paths()).not.toContain('GET /api/me');
    expect(server.paths()).not.toContain('POST /api/me/consents/health/replay-withdraw');
  });

  it('première prise de contact → époque enregistrée sans restore_upsert', async () => {
    await db.meta.delete('serverEpoch');
    await makeEngine().syncNow('manual');
    expect(kinds()).toEqual([['patch']]);
    expect(await getMeta(db, 'serverEpoch')).toBe('E2');
  });
});
