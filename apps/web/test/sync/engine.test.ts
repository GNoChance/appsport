// @vitest-environment node
import { PROTOCOL_HEADER, type PushResult, type SyncOp } from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import { makeOp, SYNC_FIXTURE_RULES } from '@appsport/server/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AppDb, mirrorStoreNames } from '../../src/local-db/db';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createSyncEngine, retryDelayMs, type SyncEngine, type SyncState } from '../../src/sync/engine';
import { type LocalChange, writeLocal } from '../../src/sync/outbox';
import { createFakeSyncServer, type FakeSyncServer } from '../support/fake-sync-server';
import { createFixtureLocalDb, dumpLocalDb } from '../support/local-db';
import { until } from '../support/wait';

const NOW_MS = Date.parse('2026-10-06T12:00:00.000Z');
const NOW_ISO = new Date(NOW_MS).toISOString();
const WITNESS = 'TEMOIN-C2-7f3a';
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const newId = createMonotonicUuidV7(() => NOW_MS, randomBytes);

let db: AppDb;
let server: FakeSyncServer;
let engine: SyncEngine;

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

async function write(change: LocalChange): Promise<SyncOp> {
  const op = await writeLocal(db, change, {
    userId: 'u1',
    now: () => NOW_ISO,
    newOpId: newId,
    healthConsentActive: true,
    rules: SYNC_FIXTURE_RULES,
  });
  if (!op) throw new Error('op non mise en file');
  return op;
}

async function createNote(title = 't'): Promise<{ id: string; op: SyncOp }> {
  const id = newId();
  const op = await write({ entity: 'fixture_note', id, kind: 'create', fields: { title } });
  return { id, op };
}

/** Ligne déjà acceptée par le serveur. */
async function acceptedNote(rev = 5, extra: Record<string, unknown> = {}): Promise<string> {
  const id = newId();
  await db.mirror('fixture_note').put({
    id,
    ownerId: 'u1',
    title: 'vu',
    serverRevSeen: rev,
    deletedAt: null,
    updatedAt: NOW_ISO,
    ...extra,
  });
  return id;
}

const pushWith = (fn: (ops: SyncOp[]) => PushResult[]) => {
  server.on('POST /api/sync/push', (req) => {
    const ops = req.body.ops as SyncOp[];
    server.sent.push(ops);
    return server.json(200, { results: fn(ops) });
  });
};

const count = (path: string) => server.paths().filter((p) => p === path).length;
const idle = () => until(() => !engine.getState().syncing);
const pullSince = () =>
  server.log.filter((r) => r.path === '/api/sync/pull').map((r) => r.query.get('since'));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  db = createFixtureLocalDb();
  server = createFakeSyncServer('E1');
  await setMeta(db, 'userId', 'u1');
  await setMeta(db, 'serverEpoch', 'E1');
  // Pull incrémental par défaut ; les tests du pull complet retirent le watermark.
  await setMeta(db, 'watermark', 'E1:1');
});
afterEach(async () => {
  engine?.stop();
  vi.useRealTimers();
  await db.delete();
});

describe('push', () => {
  it('450 ops : trois lots de 200, 200, 50 triés par opId, puis le pull', async () => {
    const ops = Array.from({ length: 450 }, () =>
      makeOp({ userId: 'u1', entity: 'fixture_note', id: newId(), kind: 'create', fields: { title: 'x' } }),
    );
    await db.outbox.bulkAdd([...ops].reverse());
    await makeEngine().syncNow('manual');

    expect(server.paths()).toEqual([
      'GET /api/health',
      'POST /api/sync/push',
      'POST /api/sync/push',
      'POST /api/sync/push',
      'GET /api/sync/pull',
    ]);
    expect(server.sent.map((o) => o.length)).toEqual([200, 200, 50]);
    const sentIds = server.sent.flat().map((o) => o.opId);
    expect(sentIds).toEqual(ops.map((o) => o.opId).sort());
    expect(server.sent.flat().every((o) => o.attempts === 1)).toBe(true);
    const pushes = server.log.filter((r) => r.path === '/api/sync/push');
    expect(pushes.every((r) => r.headers.get(PROTOCOL_HEADER) === '1')).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getState()).toMatchObject({ connection: 'online', pending: 0, syncing: false });
  });

  it('ops d’un autre userId jamais envoyées (P-AUT-6)', async () => {
    const other = makeOp({ userId: 'u9', entity: 'fixture_note', id: newId(), kind: 'create' });
    await db.outbox.add(other);
    await createNote();
    await makeEngine().syncNow('manual');
    expect(server.sent.flat().map((o) => o.userId)).toEqual(['u1']);
    expect(await db.outbox.get(other.opId)).toBeDefined();
  });

  it('meta.userId changé après le 1er lot → aucun autre lot', async () => {
    const ops = Array.from({ length: 250 }, () =>
      makeOp({ userId: 'u1', entity: 'fixture_note', id: newId(), kind: 'create' }),
    );
    await db.outbox.bulkAdd(ops);
    server.on('POST /api/sync/push', async (req) => {
      server.sent.push(req.body.ops);
      await setMeta(db, 'userId', 'u2');
      return server.json(200, { results: [] });
    });
    await makeEngine().syncNow('manual');
    expect(server.paths()).toEqual(['GET /api/health', 'POST /api/sync/push']);
  });

  it('op retirée seulement après accusé, serverRevSeen = rev ; op sans résultat gardée', async () => {
    const a = await createNote('a');
    const b = await createNote('b');
    pushWith((ops) => [{ opId: ops[0]?.opId ?? '', status: 'applied', rev: 42 }]);
    await makeEngine().syncNow('manual');
    expect(await db.outbox.get(a.op.opId)).toBeUndefined();
    expect((await db.mirror('fixture_note').get(a.id))?.serverRevSeen).toBe(42);
    expect(await db.outbox.get(b.op.opId)).toMatchObject({ attempts: 1 });
    expect(engine.getState().pending).toBe(1);
  });

  it('duplicate sans rev → serverRevSeen inchangé, op retirée', async () => {
    const id = await acceptedNote(5);
    const op = await write({ entity: 'fixture_note', id, kind: 'patch', fields: { title: 'p' } });
    pushWith(() => [{ opId: op.opId, status: 'duplicate', originalStatus: 'applied' }]);
    server.rows = [];
    await makeEngine().syncNow('manual');
    expect(await db.outbox.count()).toBe(0);
    expect((await db.mirror('fixture_note').get(id))?.serverRevSeen).toBe(5);
  });

  it('rejected → deadletter, retirée ; create rejeté → ligne locale absente', async () => {
    const { id, op } = await createNote();
    pushWith(() => [{ opId: op.opId, status: 'rejected', code: 'validation' }]);
    await makeEngine().syncNow('manual');
    expect(await db.deadletter.toArray()).toEqual([
      {
        opId: op.opId,
        userId: 'u1',
        entity: 'fixture_note',
        id,
        code: 'validation',
        detail: { kind: 'create', fieldNames: ['title'] },
        receivedAt: NOW_ISO,
      },
    ]);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.mirror('fixture_note').get(id)).toBeUndefined();
    expect(engine.getState().rejected).toBe(1);
  });

  it('duplicate d’un rejet → deadletter avec le code d’origine', async () => {
    const { id, op } = await createNote();
    pushWith(() => [{ opId: op.opId, status: 'duplicate', originalStatus: 'rejected', code: 'forbidden' }]);
    await makeEngine().syncNow('manual');
    expect(await db.deadletter.get(op.opId)).toMatchObject({ code: 'forbidden', id });
    expect(await db.mirror('fixture_note').get(id)).toBeUndefined();
  });

  it('create rejeté avec une autre op en attente → copie gardée', async () => {
    const { id, op } = await createNote();
    await write({ entity: 'fixture_note', id, kind: 'patch', fields: { title: 'z' } });
    pushWith((ops) =>
      ops.filter((o) => o.opId === op.opId).map((o) => ({ opId: o.opId, status: 'rejected' })),
    );
    await makeEngine().syncNow('manual');
    expect(await db.mirror('fixture_note').get(id)).toBeDefined();
  });

  it('patch rejeté d’une ligne acceptée → pull suivant sans since', async () => {
    await setMeta(db, 'watermark', 'E1:10');
    const id = await acceptedNote(5);
    const op = await write({ entity: 'fixture_note', id, kind: 'patch', fields: { title: 'p' } });
    pushWith(() => [{ opId: op.opId, status: 'rejected', code: 'stale_revision' }]);
    server.rows = [
      {
        entity: 'fixture_note',
        rev: 7,
        row: { id, ownerId: 'u1', title: 'serveur', deletedAt: null, rev: 7, updatedAt: NOW_ISO },
      },
    ];
    await makeEngine().syncNow('manual');
    expect(pullSince()).toEqual([null]);
    expect(await db.mirror('fixture_note').get(id)).toMatchObject({ title: 'serveur', serverRevSeen: 7 });
  });

  it('applied_partial : dropped → copie supprimée ; droppedFields → champ local null ; témoin effacé', async () => {
    const note = await createNote();
    const itemId = newId();
    const item = await write({
      entity: 'fixture_note_item',
      id: itemId,
      kind: 'create',
      fields: { noteId: note.id, label: 'l', painNote: WITNESS },
    });
    const logId = newId();
    const log = await write({ entity: 'fixture_c2_log', id: logId, kind: 'create', fields: { value: 3 } });
    pushWith(() => [
      { opId: note.op.opId, status: 'applied', rev: 11 },
      { opId: item.opId, status: 'applied_partial', rev: 12, droppedFields: ['painNote'] },
      { opId: log.opId, status: 'applied_partial', dropped: true },
    ]);
    await makeEngine().syncNow('manual');
    expect(await db.mirror('fixture_note_item').get(itemId)).toMatchObject({
      painNote: null,
      serverRevSeen: 12,
    });
    expect(await db.mirror('fixture_c2_log').get(logId)).toBeUndefined();
    expect(await dumpLocalDb(db)).not.toContain(WITNESS);
  });

  it('duplicate d’une op C2 écartée → copie supprimée', async () => {
    const logId = newId();
    const log = await write({ entity: 'fixture_c2_log', id: logId, kind: 'create', fields: { value: 3 } });
    pushWith(() => [
      { opId: log.opId, status: 'duplicate', originalStatus: 'applied_partial', dropped: true },
    ]);
    await makeEngine().syncNow('manual');
    expect(await db.mirror('fixture_c2_log').get(logId)).toBeUndefined();
  });
});

describe('erreurs', () => {
  it('401 unauthenticated → unauthenticated, outbox intacte, aucune reprise', async () => {
    await createNote();
    server.on('GET /api/health', () => server.json(401, { error: 'unauthenticated' }));
    makeEngine().start();
    await idle();
    expect(engine.getState().connection).toBe('unauthenticated');
    await vi.advanceTimersByTimeAsync(600_000);
    expect(count('GET /api/health')).toBe(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it('403 password_change_required → connection inchangée, aucune reprise', async () => {
    await createNote();
    server.on('POST /api/sync/push', () => server.json(403, { error: 'password_change_required' }));
    makeEngine().start();
    await idle();
    expect(engine.getState().connection).toBe('online');
    await vi.advanceTimersByTimeAsync(600_000);
    expect(count('GET /api/health')).toBe(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it('400 validation au push → reprise à +2 s', async () => {
    await createNote();
    server.on('POST /api/sync/push', () => server.json(400, { error: 'validation' }));
    makeEngine().start();
    await idle();
    await vi.advanceTimersByTimeAsync(1999);
    expect(count('GET /api/health')).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => count('GET /api/health') === 2);
  });

  it('410 account_deleted → tout effacé, onAccountDeleted une fois, puis reprise avec un autre compte', async () => {
    await createNote();
    await db.deadletter.add({
      opId: newId(),
      userId: 'u1',
      entity: 'fixture_note',
      id: 'x',
      code: 'validation',
      detail: null,
      receivedAt: NOW_ISO,
    });
    server.on('GET /api/health', () => server.json(410, { error: 'account_deleted' }));
    const onAccountDeleted = vi.fn();
    makeEngine({ onAccountDeleted });
    await engine.syncNow('manual');

    expect(await db.outbox.count()).toBe(0);
    expect(await db.deadletter.count()).toBe(0);
    for (const s of mirrorStoreNames(db)) expect(await db.mirror(s).count()).toBe(0);
    expect(await getMeta(db, 'userId')).toBeUndefined();
    expect(onAccountDeleted).toHaveBeenCalledTimes(1);
    expect(engine.getState().connection).toBe('account_deleted');

    await engine.syncNow('manual');
    expect(server.log).toHaveLength(1);

    server.on('GET /api/health', undefined);
    const seen: SyncState['connection'][] = [];
    engine.subscribe((s) => seen.push(s.connection));
    await setMeta(db, 'userId', 'u2');
    await engine.syncNow('manual');
    expect(server.paths()[1]).toBe('GET /api/health');
    expect(seen).toContain('unknown');
    expect(engine.getState().connection).toBe('online');
    expect(onAccountDeleted).toHaveBeenCalledTimes(1);
  });

  it('410 watermark_expired → miroirs vidés, outbox gardée, second pull sans since', async () => {
    await setMeta(db, 'watermark', 'E1:10');
    const stale = await acceptedNote(5);
    await db.outbox.add(makeOp({ userId: 'u1', entity: 'fixture_note', id: newId(), kind: 'create' }));
    server.on('GET /api/sync/pull', (req) =>
      req.query.has('since')
        ? server.json(410, { error: 'watermark_expired' })
        : server.json(200, { rows: [], nextWatermark: 'E1:99', hasMore: false, catalogVersion: null }),
    );
    await makeEngine().pullNow();
    expect(pullSince()).toEqual(['E1:10', null]);
    expect(await db.mirror('fixture_note').get(stale)).toBeUndefined();
    expect(await db.outbox.count()).toBe(1);
    expect(await getMeta(db, 'watermark')).toBe('E1:99');
  });

  it('410 { error: gone } → rien d’effacé', async () => {
    await setMeta(db, 'watermark', 'E1:10');
    const kept = await acceptedNote(5);
    await createNote();
    server.on('GET /api/sync/pull', () => server.json(410, { error: 'gone' }));
    await makeEngine().syncNow('manual');
    expect(await db.mirror('fixture_note').get(kept)).toBeDefined();
    expect(await getMeta(db, 'watermark')).toBe('E1:10');
    expect(await getMeta(db, 'userId')).toBe('u1');
  });

  it('426 → protocol_unsupported, outbox intacte', async () => {
    await createNote();
    const upgrade = () =>
      server.json(426, { error: 'protocol_unsupported', serverProtocol: 2, minProtocol: 2 });
    server.on('POST /api/sync/push', upgrade);
    server.on('GET /api/sync/pull', upgrade);
    await makeEngine().syncNow('manual');
    expect(engine.getState().connection).toBe('protocol_unsupported');
    expect(await db.outbox.count()).toBe(1);
  });

  it('délai 4 s → offline, syncNow ne rejette pas ; reprises à +2 s puis +4 s', async () => {
    server.fault = 'hang';
    makeEngine().start();
    expect(engine.getState().syncing).toBe(true);
    await until(() => count('GET /api/health') === 1);
    await vi.advanceTimersByTimeAsync(4000);
    await idle();
    expect(engine.getState().connection).toBe('offline');

    await vi.advanceTimersByTimeAsync(1999);
    expect(count('GET /api/health')).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => count('GET /api/health') === 2);
    await vi.advanceTimersByTimeAsync(4000);
    await idle();
    await vi.advanceTimersByTimeAsync(3999);
    expect(count('GET /api/health')).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => count('GET /api/health') === 3);
  });

  it('TypeError → offline, syncNow résout', async () => {
    server.fault = 'offline';
    await expect(makeEngine().syncNow('manual')).resolves.toBeUndefined();
    expect(engine.getState().connection).toBe('offline');
  });

  it('retryDelayMs : 2 s doublé, 5 min au plus', () => {
    expect([1, 2, 3, 8, 9, 20].map(retryDelayMs)).toEqual([2000, 4000, 8000, 256000, 300000, 300000]);
  });
});

describe('pull', () => {
  it('watermark, lastPullOkAt, serverCatalogVersion ; hasMore enchaîne', async () => {
    await setMeta(db, 'watermark', 'E1:10');
    server.on('GET /api/sync/pull', (req) =>
      req.query.get('since') === 'E1:10'
        ? server.json(200, { rows: [], nextWatermark: 'E1:20', hasMore: true, catalogVersion: 'cat-2' })
        : server.json(200, { rows: [], nextWatermark: 'E1:30', hasMore: false, catalogVersion: 'cat-2' }),
    );
    await makeEngine().syncNow('manual');
    expect(pullSince()).toEqual(['E1:10', 'E1:20']);
    expect(await getMeta(db, 'watermark')).toBe('E1:30');
    expect(await getMeta(db, 'lastPullOkAt')).toBe(NOW_ISO);
    expect(await getMeta(db, 'serverCatalogVersion')).toBe('cat-2');
    expect(engine.getState().lastPullOkAt).toBe(NOW_ISO);
  });

  it('consent_event health/withdraw tiré → purgeHealthData', async () => {
    await setMeta(db, 'watermark', 'E1:10');
    const event = (id: string, action: string, createdAt: string) => ({
      id,
      ownerId: 'u1',
      type: 'health',
      action,
      textVersion: 'v1',
      createdAt,
      updatedAt: createdAt,
      rev: 3,
      deletedAt: null,
      serverRevSeen: 3,
    });
    await db.mirror('consent_event').put(event('g1', 'grant', '2026-10-01T10:00:00.000Z'));
    await db
      .mirror('fixture_c2_log')
      .put({ id: 'c1', ownerId: 'u1', value: 4, serverRevSeen: 2, deletedAt: null });
    server.rows = [
      { entity: 'consent_event', rev: 30, row: event('w1', 'withdraw', '2026-10-06T09:00:00.000Z') },
    ];
    await makeEngine().syncNow('manual');
    expect(await db.mirror('fixture_c2_log').count()).toBe(0);
  });

  it('pull complet : ligne non reçue sans op → supprimée, avec op → gardée', async () => {
    await db.meta.delete('watermark');
    const orphan = await acceptedNote(5);
    const pendingId = await acceptedNote(6);
    await db.outbox.add(makeOp({ userId: 'u1', entity: 'fixture_note', id: pendingId, kind: 'patch' }));
    const received = newId();
    server.rows = [
      {
        entity: 'fixture_note',
        rev: 8,
        row: { id: received, ownerId: 'u1', title: 'r', deletedAt: null, rev: 8, updatedAt: NOW_ISO },
      },
    ];
    await makeEngine().pullNow();
    expect(pullSince()).toEqual([null]);
    expect(await db.mirror('fixture_note').get(orphan)).toBeUndefined();
    expect(await db.mirror('fixture_note').get(pendingId)).toBeDefined();
    expect(await db.mirror('fixture_note').get(received)).toBeDefined();
    expect(await getMeta(db, 'watermark')).toBe('E1:100');
  });

  it('pull complet coupé en page 2 → watermark toujours absent, rien supprimé', async () => {
    await db.meta.delete('watermark');
    const orphan = await acceptedNote(5);
    server.on('GET /api/sync/pull', (req) => {
      if (req.query.has('since')) throw new TypeError('Failed to fetch');
      return server.json(200, { rows: [], nextWatermark: 'E1:20', hasMore: true, catalogVersion: null });
    });
    await makeEngine().pullNow();
    expect(pullSince()).toEqual([null, 'E1:20']);
    expect(await getMeta(db, 'watermark')).toBeUndefined();
    expect(await db.mirror('fixture_note').get(orphan)).toBeDefined();
    expect(engine.getState().connection).toBe('offline');
  });
});

describe('file unique et déclencheurs', () => {
  it('start() → déclencheurs installés une fois puis cycle launch ; stop() → retirés, aucune reprise', async () => {
    const uninstall = vi.fn();
    const triggers = vi.fn(() => uninstall);
    server.fault = 'offline';
    makeEngine({ triggers });
    engine.start();
    engine.start();
    expect(triggers).toHaveBeenCalledTimes(1);
    expect(triggers).toHaveBeenCalledWith(engine);
    await idle();
    expect(server.paths()).toEqual(['GET /api/health']);
    engine.stop();
    expect(uninstall).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(server.log).toHaveLength(1);
    await engine.syncNow('manual');
    expect(server.log).toHaveLength(1);
  });

  it('rien sans meta.userId', async () => {
    await db.meta.delete('userId');
    await makeEngine().syncNow('manual');
    expect(server.log).toHaveLength(0);
  });

  it('trois syncNow(set_logged) en 1 s → un cycle, à +2000 ms', async () => {
    makeEngine();
    void engine.syncNow('set_logged');
    await vi.advanceTimersByTimeAsync(500);
    void engine.syncNow('set_logged');
    await vi.advanceTimersByTimeAsync(500);
    const last = engine.syncNow('set_logged');
    await vi.advanceTimersByTimeAsync(1999);
    expect(server.log).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await last;
    expect(count('GET /api/health')).toBe(1);
  });

  it('flushBefore(4000) rend la main en 4 s au plus', async () => {
    server.on('GET /api/health', () => new Promise<Response>(() => {}));
    makeEngine({ timeoutMs: 60_000 });
    let done = false;
    const p = engine.flushBefore(4000).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it('deux syncNow et un pullNow pendant un cycle → un seul cycle ensuite, jamais deux en vol', async () => {
    const gates: (() => void)[] = [];
    server.on('GET /api/health', async () => {
      await new Promise<void>((r) => gates.push(r));
      server.on('GET /api/health', undefined);
      return server.json(200, { epoch: 'E1' });
    });
    makeEngine();
    const p1 = engine.syncNow('manual');
    const p2 = engine.syncNow('manual');
    const p3 = engine.syncNow('mutation');
    const p4 = engine.pullNow();
    await until(() => gates.length === 1);
    gates[0]?.();
    await Promise.all([p1, p2, p3, p4]);
    expect(count('GET /api/health')).toBe(2);
    expect(server.maxInFlight).toBe(1);
  });

  it('rejet écarté sur un autre appareil : sa deadletter locale ne compte plus', async () => {
    const a = await createNote('a');
    makeEngine();
    pushWith(() => [{ opId: a.op.opId, status: 'rejected', code: 'validation' }]);
    server.rows = [
      {
        entity: 'sync_rejection',
        rev: 9,
        row: { id: newId(), ownerId: 'u1', opId: a.op.opId, dismissedAt: NOW_ISO, deletedAt: null, rev: 9 },
      },
    ];
    await engine.syncNow('manual');
    expect(await db.deadletter.count()).toBe(1);
    expect(engine.getState().rejected).toBe(0);
  });

  it('pending et rejected à jour, subscribe notifié', async () => {
    const a = await createNote('a');
    await createNote('b');
    const states: SyncState[] = [];
    makeEngine();
    const unsubscribe = engine.subscribe((s) => states.push(s));
    pushWith(() => [{ opId: a.op.opId, status: 'rejected', code: 'validation' }]);
    server.rows = [
      {
        entity: 'sync_rejection',
        rev: 9,
        row: { id: newId(), ownerId: 'u1', opId: a.op.opId, dismissedAt: null, deletedAt: null, rev: 9 },
      },
      {
        entity: 'sync_rejection',
        rev: 9,
        row: { id: newId(), ownerId: 'u1', opId: newId(), dismissedAt: null, deletedAt: null, rev: 9 },
      },
      {
        entity: 'sync_rejection',
        rev: 9,
        row: { id: newId(), ownerId: 'u1', opId: newId(), dismissedAt: NOW_ISO, deletedAt: null, rev: 9 },
      },
    ];
    await engine.syncNow('manual');
    expect(engine.getState()).toMatchObject({ pending: 1, rejected: 2, serverEpoch: 'E1', syncing: false });
    expect(states.at(-1)).toEqual(engine.getState());
    expect(states.some((s) => s.syncing)).toBe(true);
    unsubscribe();
    const n = states.length;
    await engine.syncNow('manual');
    expect(states).toHaveLength(n);
  });
});

/** Laisse passer `n` tours de la vraie boucle (fenêtre de recouvrement des cycles). */
const turns = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setImmediate(r));
};
const stalledBody = () =>
  new Response(new ReadableStream<Uint8Array>({ start() {} }), {
    status: 200,
    headers: { 'X-Appsport-Epoch': server.epoch },
  });

describe('reprises et file (revue)', () => {
  it('health OK puis push 500 → reprises à +2 s puis +4 s (failures remis à zéro seulement en fin de cycle)', async () => {
    await createNote();
    server.on('POST /api/sync/push', () => server.json(500, { error: 'internal' }));
    makeEngine().start();
    await idle();
    await vi.advanceTimersByTimeAsync(1999);
    expect(count('GET /api/health')).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => count('GET /api/health') === 2);
    await idle();
    await vi.advanceTimersByTimeAsync(3999);
    expect(count('GET /api/health')).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => count('GET /api/health') === 3);
    await idle();
  });

  it('cycle réussi → failures remis à zéro : échec suivant repris à +2 s', async () => {
    let fail = true;
    server.on('POST /api/sync/push', (req) => {
      server.sent.push(req.body.ops);
      if (fail) return server.json(500, { error: 'internal' });
      return server.json(200, { results: [] });
    });
    await createNote();
    makeEngine().start();
    await idle();
    await vi.advanceTimersByTimeAsync(2000);
    await until(() => count('GET /api/health') === 2);
    await idle();
    fail = false;
    await vi.advanceTimersByTimeAsync(4000);
    await until(() => count('GET /api/health') === 3);
    await idle();
    fail = true;
    await engine.syncNow('manual');
    await vi.advanceTimersByTimeAsync(1999);
    expect(count('GET /api/health')).toBe(4);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => count('GET /api/health') === 5);
    await idle();
  });

  it('await syncNow puis syncNow pendant qu’un autre appelant a programmé un cycle → jamais deux en vol', async () => {
    server.on('GET /api/health', async () => {
      await turns(20);
      return server.json(200, { epoch: 'E1' });
    });
    makeEngine();
    const a = (async () => {
      await engine.syncNow('manual');
      await engine.syncNow('manual');
    })();
    await until(() => count('GET /api/health') === 1);
    const b = engine.syncNow('mutation');
    await Promise.all([a, b]);
    expect(server.maxInFlight).toBe(1);
    // 1er cycle, celui de b (lancé dès la fin du 1er), puis le second appel de a, venu après ce lancement.
    expect(count('GET /api/health')).toBe(3);
  });

  it('corps de pull bloqué → cycle terminé hors ligne à l’échéance, syncNow suivant exécuté', async () => {
    server.on('GET /api/sync/pull', () => stalledBody());
    makeEngine();
    const p = engine.syncNow('manual');
    await until(() => count('GET /api/sync/pull') === 1);
    await vi.advanceTimersByTimeAsync(4000);
    await p;
    expect(engine.getState().connection).toBe('offline');
    server.on('GET /api/sync/pull', undefined);
    await engine.syncNow('manual');
    expect(count('GET /api/sync/pull')).toBe(2);
    expect(engine.getState().connection).toBe('online');
  });

  it('corps de health bloqué → offline, la file n’est pas gelée', async () => {
    server.on('GET /api/health', () => stalledBody());
    makeEngine();
    const p = engine.syncNow('manual');
    await until(() => count('GET /api/health') === 1);
    await vi.advanceTimersByTimeAsync(4000);
    await p;
    expect(engine.getState()).toMatchObject({ connection: 'offline', syncing: false });
  });

  it('stop() pendant un cycle en vol puis start() aussitôt → l’ancien cycle n’agit plus', async () => {
    await createNote();
    const gates: (() => void)[] = [];
    server.on('GET /api/health', async () => {
      await new Promise<void>((r) => gates.push(r));
      return server.json(200, { epoch: 'E1' });
    });
    makeEngine();
    engine.start();
    await until(() => gates.length === 1);
    engine.stop();
    engine.start();
    gates[0]?.();
    await until(() => gates.length === 2);
    gates[1]?.();
    await idle();
    expect(server.paths()).toEqual([
      'GET /api/health',
      'GET /api/health',
      'POST /api/sync/push',
      'GET /api/sync/pull',
    ]);
    expect(server.maxInFlight).toBe(1);
  });

  it('stop() pendant un cycle en vol → plus aucune requête', async () => {
    await createNote();
    const gates: (() => void)[] = [];
    server.on('GET /api/health', async () => {
      await new Promise<void>((r) => gates.push(r));
      return server.json(200, { epoch: 'E1' });
    });
    makeEngine().start();
    await until(() => gates.length === 1);
    engine.stop();
    gates[0]?.();
    await idle();
    expect(server.paths()).toEqual(['GET /api/health']);
    expect(await db.outbox.count()).toBe(1);
  });
});

describe('utilisateur changé pendant une requête (revue)', () => {
  it('410 account_deleted → rien effacé, onAccountDeleted non appelé', async () => {
    await createNote();
    server.on('GET /api/health', async () => {
      await setMeta(db, 'userId', 'u2');
      return server.json(410, { error: 'account_deleted' });
    });
    const onAccountDeleted = vi.fn();
    await makeEngine({ onAccountDeleted }).syncNow('manual');
    expect(onAccountDeleted).not.toHaveBeenCalled();
    expect(await getMeta(db, 'userId')).toBe('u2');
    expect(await db.outbox.count()).toBe(1);
    expect(engine.getState().connection).not.toBe('account_deleted');
  });

  it('401 unauthenticated → connection inchangée', async () => {
    server.on('GET /api/health', async () => {
      await setMeta(db, 'userId', 'u2');
      return server.json(401, { error: 'unauthenticated' });
    });
    await makeEngine().syncNow('manual');
    expect(engine.getState().connection).not.toBe('unauthenticated');
  });

  it('résultats de push non appliqués', async () => {
    const { id, op } = await createNote();
    server.on('POST /api/sync/push', async (req) => {
      await setMeta(db, 'userId', 'u2');
      const ops = req.body.ops as SyncOp[];
      return server.json(200, { results: ops.map((o) => ({ opId: o.opId, status: 'applied', rev: 50 })) });
    });
    await makeEngine().syncNow('manual');
    expect(await db.outbox.get(op.opId)).toBeDefined();
    expect((await db.mirror('fixture_note').get(id))?.serverRevSeen).toBeNull();
  });
});

describe('rejet d’une op sur une ligne absente (revue)', () => {
  it('pas de pull complet : watermark gardé', async () => {
    const op = makeOp({
      userId: 'u1',
      entity: 'fixture_note',
      id: newId(),
      kind: 'patch',
      fields: { title: 'x' },
    });
    await db.outbox.add(op);
    pushWith(() => [{ opId: op.opId, status: 'rejected', code: 'validation' }]);
    await makeEngine().syncNow('manual');
    expect(pullSince()).toEqual(['E1:1']);
    expect(await db.deadletter.get(op.opId)).toBeDefined();
  });
});
