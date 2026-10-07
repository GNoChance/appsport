// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HEALTH_CONSENT_TEXT, type SyncOp } from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import {
  createLogger,
  createSyncTestContext,
  createUserAndLogin,
  dumpDatabase,
  grantConsent,
  login,
  restoreInPlace,
  SYNC_FIXTURE_RULES,
  snapshotDb,
  type TestContext,
  type TestUser,
} from '@appsport/server/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { localHealthConsentActive } from '../../src/local-db/consent';
import type { AppDb } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { type LocalChange, pendingCount, writeLocal } from '../../src/sync/outbox';
import { inProcessTransport } from '../support/in-process-transport';
import { createFixtureLocalDb, dumpLocalDb } from '../support/local-db';

const WITNESS = 'TEMOIN-C2-7f3a';
const WITNESS_N = 987654;
const IP = '100.64.0.1';
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

type Row = Record<string, unknown>;
type Transport = ReturnType<typeof inProcessTransport>;

interface Device {
  db: AppDb;
  engine: SyncEngine;
  transport: Transport;
  /** Cookie envoyé par le transport ; modifiable par le test. */
  cookie: string;
  userId: string;
  newId(): string;
  write(change: LocalChange, opts?: { userId?: string }): Promise<SyncOp>;
}

let ctx: TestContext;
let lines: string[];
const devices: Device[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const d of devices.splice(0)) {
    d.engine.stop();
    await d.db.delete();
  }
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  ctx?.close();
});

async function setup(): Promise<void> {
  lines = [];
  ctx = await createSyncTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
}

const nowMs = () => ctx.clock.now().getTime();

async function device(user: TestUser, cookie: string): Promise<Device> {
  const db = createFixtureLocalDb();
  await setMeta(db, 'userId', user.id);
  const newId = createMonotonicUuidV7(nowMs, randomBytes);
  const d = {} as Device;
  const transport = inProcessTransport(ctx, () => d.cookie);
  const engine = createSyncEngine({
    db,
    transport,
    now: nowMs,
    newOpId: newId,
    rules: SYNC_FIXTURE_RULES,
    triggers: () => () => {},
  });
  Object.assign(d, {
    db,
    engine,
    transport,
    cookie,
    userId: user.id,
    newId,
    async write(change: LocalChange, opts: { userId?: string } = {}) {
      const op = await writeLocal(db, change, {
        userId: opts.userId ?? d.userId,
        now: () => new Date(nowMs()).toISOString(),
        newOpId: newId,
        healthConsentActive: await localHealthConsentActive(db),
        rules: SYNC_FIXTURE_RULES,
      });
      if (!op) throw new Error('op non mise en file');
      return op;
    },
  });
  devices.push(d);
  return d;
}

const serverRows = (table: string): Row[] =>
  ctx.deps.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[];

const notesOfServer = () =>
  serverRows('fixture_note').map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    deletedAt: r.deleted_at,
  }));

async function notesOf(d: Device) {
  return (await d.db.mirror('fixture_note').orderBy('id').toArray()).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    deletedAt: r.deletedAt,
  }));
}

/** Requêtes envoyées, un push suivi de ses kinds : `POST /api/sync/push:patch`. */
function sequence(t: Transport): string[] {
  return t.log.map(({ method, path, body }) => {
    const base = `${method} ${path}`;
    if (path !== '/api/sync/push') return base;
    const ops = (body as { ops: SyncOp[] }).ops;
    return `${base}:${[...new Set(ops.map((o) => o.kind))].join(',')}`;
  });
}

const pushedOps = (t: Transport): SyncOp[] =>
  t.log.filter((e) => e.path === '/api/sync/push').flatMap((e) => (e.body as { ops: SyncOp[] }).ops);

describe('scénarios de synchro ciblés (deux appareils, vrai serveur)', () => {
  it('401 puis reconnexion du même utilisateur : outbox conservée puis envoyée', async () => {
    await setup();
    const user = await createUserAndLogin(ctx);
    const a = await device(user, user.cookie);
    const out = await ctx.request('/api/auth/logout', { method: 'POST', json: {}, cookie: user.cookie });
    expect(out.status).toBeLessThan(300);

    for (const title of ['un', 'deux', 'trois']) {
      await a.write({ entity: 'fixture_note', id: a.newId(), kind: 'create', fields: { title } });
    }
    await a.engine.syncNow('manual');
    expect(a.engine.getState().connection).toBe('unauthenticated');
    expect(await pendingCount(a.db, user.id)).toBe(3);
    expect(serverRows('fixture_note')).toHaveLength(0);

    a.cookie = await login(ctx, user.username, user.password, IP);
    await a.engine.syncNow('manual');
    expect(a.engine.getState().connection).toBe('online');
    expect(await pendingCount(a.db, user.id)).toBe(0);
    expect(notesOfServer().map((n) => n.title)).toEqual(['un', 'deux', 'trois']);
  });

  it("l'outbox de A n'est jamais envoyée sous la session de B (03 §17 n°11)", async () => {
    await setup();
    const userA = await createUserAndLogin(ctx);
    const userB = await createUserAndLogin(ctx);
    const d = await device(userA, userA.cookie);
    const noteIds = [d.newId(), d.newId()];
    for (const id of noteIds) {
      await d.write({ entity: 'fixture_note', id, kind: 'create', fields: { title: 'de A' } });
    }
    // B se connecte sur l'appareil : l'utilisateur local et la session changent.
    await setMeta(d.db, 'userId', userB.id);
    d.userId = userB.id;
    d.cookie = userB.cookie;
    const opB = await d.write({
      entity: 'fixture_note',
      id: d.newId(),
      kind: 'create',
      fields: { title: 'de B' },
    });
    await d.engine.syncNow('manual');

    expect(d.engine.getState().connection).toBe('online');
    expect(d.transport.log.length).toBeGreaterThan(0);
    // Seule l'op de B part ; aucune op de A n'atteint le serveur.
    expect(pushedOps(d.transport)).toEqual([expect.objectContaining({ opId: opB.opId, userId: userB.id })]);
    expect(serverRows('fixture_note')).toMatchObject([{ id: opB.id, owner_id: userB.id, title: 'de B' }]);
    expect(serverRows('fixture_note').filter((r) => noteIds.includes(String(r.id)))).toEqual([]);
    expect(await pendingCount(d.db, userB.id)).toBe(0);
    expect(await pendingCount(d.db, userA.id)).toBe(2);
  });

  it("changement d'époque avec un appareil en retard (R-SYN-26, R-SYN-27, Review Focus 2)", async () => {
    await setup();
    const user = await createUserAndLogin(ctx);
    const a = await device(user, user.cookie);
    const b = await device(user, await login(ctx, user.username, user.password, IP));
    await a.engine.syncNow('manual');
    await b.engine.syncNow('manual');
    const e1 = a.engine.getState().serverEpoch;
    expect(e1).not.toBeNull();
    expect(b.engine.getState().serverEpoch).toBe(e1);

    const n1 = a.newId();
    await a.write({ entity: 'fixture_note', id: n1, kind: 'create', fields: { title: 'avant' } });
    await a.engine.syncNow('manual');
    await b.engine.pullNow();

    const dir = mkdtempSync(join(tmpdir(), 'appsport-epoch-'));
    tempDirs.push(dir);
    const snapshot = join(dir, 'S.sqlite');
    await snapshotDb(ctx, snapshot);

    await a.write({ entity: 'fixture_note', id: n1, kind: 'patch', fields: { title: 'apres-S' } });
    const n2 = a.newId();
    await a.write({ entity: 'fixture_note', id: n2, kind: 'create', fields: { title: 'n2' } });
    await a.engine.syncNow('manual');
    await b.engine.pullNow();
    expect((await b.db.mirror('fixture_note').get(n1))?.title).toBe('apres-S');

    const { epoch: e2 } = await restoreInPlace(ctx, snapshot);
    expect(e2).not.toBe(e1);
    expect(notesOfServer().map((n) => n.id)).toEqual([n1]);

    // B, hors ligne, garde un watermark ancien et une op en attente sur une ligne récente.
    await b.write({ entity: 'fixture_note', id: n1, kind: 'patch', fields: { body: 'B-hors-ligne' } });

    // A rejoue ses 60 jours (n1 remplacée, n2 réinsérée), puis modifie n1.
    await a.engine.syncNow('manual');
    expect(a.engine.getState().serverEpoch).toBe(e2);
    expect(notesOfServer()).toMatchObject([
      { id: n1, title: 'apres-S' },
      { id: n2, title: 'n2', deletedAt: null },
    ]);
    await a.write({ entity: 'fixture_note', id: n1, kind: 'patch', fields: { title: 'final-A' } });
    await a.engine.syncNow('manual');

    expect(await pendingCount(b.db, user.id)).toBe(1);
    b.transport.log.length = 0;
    await b.engine.syncNow('manual');
    const seq = sequence(b.transport);
    expect(seq).toEqual([
      'GET /api/health',
      'POST /api/sync/push:restore_upsert',
      'POST /api/sync/push:patch',
      'GET /api/sync/pull',
    ]);
    expect(b.engine.getState().serverEpoch).toBe(e2);
    expect(await pendingCount(b.db, user.id)).toBe(0);

    const server = notesOfServer();
    const n1Row = server.find((r) => r.id === n1);
    expect({ title: n1Row?.title, body: n1Row?.body }).toEqual({ title: 'final-A', body: 'B-hors-ligne' });
    expect(server.find((r) => r.id === n2)).toMatchObject({ title: 'n2', deletedAt: null });

    await a.engine.pullNow();
    expect(await notesOf(a)).toEqual(server);
    expect(await notesOf(b)).toEqual(server);
    expect(await a.db.deadletter.count()).toBe(0);
    expect(await b.db.deadletter.count()).toBe(0);
  });

  describe('retrait du consentement pendant que B a des ops C2 en attente (Review Focus 3)', () => {
    /** A et B partagent l'accord santé ; B, hors ligne, écrit les témoins C2 ; A retire l'accord. */
    async function withdrawWhileBOffline() {
      await setup();
      const user = await createUserAndLogin(ctx);
      await grantConsent(ctx.deps.db, ctx.deps, user.id, 'health', HEALTH_CONSENT_TEXT.version, null);
      const a = await device(user, user.cookie);
      const b = await device(user, await login(ctx, user.username, user.password, IP));
      await a.engine.syncNow('manual');
      await b.engine.syncNow('manual');
      expect(await localHealthConsentActive(b.db)).toBe(true);

      const note = b.newId();
      const item = b.newId();
      const log = b.newId();
      await b.write({ entity: 'fixture_note', id: note, kind: 'create', fields: { title: 'séance' } });
      await b.write({
        entity: 'fixture_note_item',
        id: item,
        kind: 'create',
        fields: { noteId: note, label: 'genou', painNote: WITNESS },
      });
      await b.write({ entity: 'fixture_c2_log', id: log, kind: 'create', fields: { value: WITNESS_N } });
      expect(await pendingCount(b.db, user.id)).toBe(3);

      const res = await ctx.request('/api/me/consents/withdraw', {
        method: 'POST',
        json: { type: 'health', password: user.password },
        cookie: user.cookie,
        ip: IP,
      });
      expect(res.status).toBe(200);
      await a.engine.pullNow();
      expect(await localHealthConsentActive(a.db)).toBe(false);
      return { user, a, b, note, item };
    }

    async function expectNoWitnessAnywhere(a: Device, b: Device) {
      for (const witness of [WITNESS, String(WITNESS_N)]) {
        expect(dumpDatabase(ctx.deps.sqlite)).not.toContain(witness);
        expect(lines.join('\n')).not.toContain(witness);
        expect(await dumpLocalDb(a.db)).not.toContain(witness);
        expect(await dumpLocalDb(b.db)).not.toContain(witness);
      }
      expect(serverRows('sync_rejection')).toHaveLength(0);
      expect(await b.db.deadletter.count()).toBe(0);
      expect(await b.db.mirror('fixture_c2_log').count()).toBe(0);
    }

    it('B pousse : ops C2 écartées sans rejet, copie locale supprimée, témoin absent partout', async () => {
      const { user, a, b, note, item } = await withdrawWhileBOffline();
      await b.engine.syncNow('manual');

      expect(await pendingCount(b.db, user.id)).toBe(0);
      expect(b.engine.getState().rejected).toBe(0);
      expect(await localHealthConsentActive(b.db)).toBe(false);
      expect(serverRows('fixture_c2_log')).toHaveLength(0);
      expect(serverRows('fixture_note').map((r) => r.id)).toEqual([note]);
      expect(serverRows('fixture_note_item')).toMatchObject([{ id: item, pain_note: null }]);
      expect(await b.db.mirror('fixture_note_item').get(item)).toMatchObject({ painNote: null });
      await expectNoWitnessAnywhere(a, b);
    });

    it('B tire le retrait avant de pousser : aucun témoin dans ses requêtes', async () => {
      const { user, a, b, item } = await withdrawWhileBOffline();
      await b.engine.pullNow();
      await b.engine.syncNow('manual');

      expect(await pendingCount(b.db, user.id)).toBe(0);
      expect(pushedOps(b.transport).length).toBeGreaterThan(0);
      const sent = JSON.stringify(b.transport.log);
      expect(sent).not.toContain(WITNESS);
      expect(sent).not.toContain(String(WITNESS_N));
      expect(serverRows('fixture_note_item')).toMatchObject([{ id: item, pain_note: null }]);
      await expectNoWitnessAnywhere(a, b);
    });
  });
});
