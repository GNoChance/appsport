// @vitest-environment node
import { createMonotonicUuidV7 } from '@appsport/domain';
import {
  createSyncTestContext,
  createUserAndLogin,
  login,
  SYNC_FIXTURE_RULES,
  type TestContext,
} from '@appsport/server/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppDb, MirrorRow } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { type LocalChange, pendingCount, writeLocal } from '../../src/sync/outbox';
import { inProcessTransport } from '../support/in-process-transport';
import { createFixtureLocalDb } from '../support/local-db';
import { type LossyOptions, lossyTransport, seededBytes } from '../support/lossy-transport';

type Row = Record<string, unknown>;

interface Device {
  db: AppDb;
  engine: SyncEngine;
  lossy: ReturnType<typeof lossyTransport>;
}

interface Real {
  ctx: TestContext;
  userId: string;
  devices: [Device, Device];
  newRowId(): string;
  newOpIds: [() => string, () => string];
  createdItems: string[];
}

type Model = Record<string, never>;

const live = async (d: Device, entity: string): Promise<MirrorRow[]> =>
  (await d.db.mirror(entity).orderBy('id').toArray()).filter((r) => r.deletedAt == null);

async function write(r: Real, dev: 0 | 1, change: LocalChange): Promise<void> {
  await writeLocal(r.devices[dev].db, change, {
    userId: r.userId,
    now: () => r.ctx.clock.now().toISOString(),
    newOpId: r.newOpIds[dev],
    healthConsentActive: false,
    rules: SYNC_FIXTURE_RULES,
  });
}

abstract class Cmd implements fc.AsyncCommand<Model, Real> {
  constructor(readonly dev: 0 | 1) {}
  check(): boolean {
    return true;
  }
  abstract run(m: Model, r: Real): Promise<void>;
  abstract toString(): string;
}

class CreateNote extends Cmd {
  constructor(
    dev: 0 | 1,
    readonly title: string,
  ) {
    super(dev);
  }
  async run(_m: Model, r: Real) {
    await write(r, this.dev, {
      entity: 'fixture_note',
      id: r.newRowId(),
      kind: 'create',
      fields: { title: this.title },
    });
  }
  toString() {
    return `createNote(${this.dev}, ${JSON.stringify(this.title)})`;
  }
}

class PatchNote extends Cmd {
  constructor(
    dev: 0 | 1,
    readonly pick: number,
    readonly fields: { title?: string; body?: string | null },
  ) {
    super(dev);
  }
  async run(_m: Model, r: Real) {
    const notes = await live(r.devices[this.dev], 'fixture_note');
    const note = notes[this.pick % Math.max(1, notes.length)];
    if (!note) return;
    await write(r, this.dev, { entity: 'fixture_note', id: note.id, kind: 'patch', fields: this.fields });
  }
  toString() {
    return `patchNote(${this.dev}, #${this.pick}, ${JSON.stringify(this.fields)})`;
  }
}

class DeleteNote extends Cmd {
  constructor(
    dev: 0 | 1,
    readonly pick: number,
  ) {
    super(dev);
  }
  async run(_m: Model, r: Real) {
    const notes = await live(r.devices[this.dev], 'fixture_note');
    const note = notes[this.pick % Math.max(1, notes.length)];
    if (!note) return;
    await write(r, this.dev, { entity: 'fixture_note', id: note.id, kind: 'delete', fields: {} });
  }
  toString() {
    return `deleteNote(${this.dev}, #${this.pick})`;
  }
}

class CreateItem extends Cmd {
  constructor(
    dev: 0 | 1,
    readonly pick: number,
    readonly label: string,
  ) {
    super(dev);
  }
  async run(_m: Model, r: Real) {
    const notes = await live(r.devices[this.dev], 'fixture_note');
    const note = notes[this.pick % Math.max(1, notes.length)];
    if (!note) return;
    const id = r.newRowId();
    await write(r, this.dev, {
      entity: 'fixture_note_item',
      id,
      kind: 'create',
      fields: { noteId: note.id, label: this.label },
    });
    r.createdItems.push(id);
  }
  toString() {
    return `createItem(${this.dev}, #${this.pick}, ${JSON.stringify(this.label)})`;
  }
}

class Sync extends Cmd {
  async run(_m: Model, r: Real) {
    await r.devices[this.dev].engine.syncNow('manual');
  }
  toString() {
    return `sync(${this.dev})`;
  }
}

const devArb = fc.constantFrom<0 | 1>(0, 1);
const text = fc.string({ minLength: 1, maxLength: 20 });
const commandArbs = [
  fc
    .tuple(devArb, fc.oneof({ arbitrary: fc.constant(''), weight: 1 }, { arbitrary: text, weight: 5 }))
    .map(([d, title]) => new CreateNote(d, title) as Cmd),
  fc
    .tuple(
      devArb,
      fc.nat(),
      fc.record(
        { title: text, body: fc.option(fc.string({ maxLength: 20 }), { nil: null }) },
        { requiredKeys: [] },
      ),
    )
    .map(([d, pick, fields]) => new PatchNote(d, pick, fields) as Cmd),
  fc.tuple(devArb, fc.nat()).map(([d, pick]) => new DeleteNote(d, pick) as Cmd),
  fc.tuple(devArb, fc.nat(), text).map(([d, pick, label]) => new CreateItem(d, pick, label) as Cmd),
  devArb.map((d) => new Sync(d) as Cmd),
];

const serverRows = (ctx: TestContext, table: string): Row[] =>
  ctx.deps.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[];

/** Vue comparée : colonnes serveur (snake) ou miroir (camel) ramenées aux mêmes clés. */
function view(rows: Row[], keys: Record<string, string>): Row[] {
  return rows.map((row) => Object.fromEntries(Object.entries(keys).map(([out, key]) => [out, row[key]])));
}

const NOTE_SERVER = { id: 'id', title: 'title', body: 'body', deletedAt: 'deleted_at' };
const NOTE_MIRROR = { id: 'id', title: 'title', body: 'body', deletedAt: 'deletedAt' };
const ITEM_SERVER = { id: 'id', noteId: 'note_id', label: 'label', deletedAt: 'deleted_at' };
const ITEM_MIRROR = { id: 'id', noteId: 'noteId', label: 'label', deletedAt: 'deletedAt' };
const REJ_SERVER = { id: 'id', opId: 'op_id', entity: 'entity', rowId: 'row_id', code: 'code' };
const REJ_MIRROR = { id: 'id', opId: 'opId', entity: 'entity', rowId: 'rowId', code: 'code' };

const mirrorRows = async (d: Device, entity: string): Promise<Row[]> =>
  d.db.mirror(entity).orderBy('id').toArray();

/**
 * Un essai entièrement déterminé par `netSeed` (tiré par fast-check, donc dans le contre-exemple) :
 * réseau dégradé de chaque appareil et octets aléatoires des générateurs UUIDv7.
 */
async function setupReal(opts: LossyOptions, netSeed: number): Promise<Real> {
  const base = (opts.seed + netSeed) >>> 0;
  const ctx = await createSyncTestContext();
  const user = await createUserAndLogin(ctx);
  const cookies = [user.cookie, await login(ctx, user.username, user.password, '100.64.0.2')];
  const now = () => ctx.clock.now().getTime();
  const newOpIds: [() => string, () => string] = [
    createMonotonicUuidV7(now, seededBytes(base + 10)),
    createMonotonicUuidV7(now, seededBytes(base + 11)),
  ];
  const devices = await Promise.all(
    ([0, 1] as const).map(async (i): Promise<Device> => {
      const db = createFixtureLocalDb();
      await setMeta(db, 'userId', user.id);
      const lossy = lossyTransport(
        inProcessTransport(ctx, () => cookies[i] ?? ''),
        { ...opts, seed: base + i },
      );
      const engine = createSyncEngine({
        db,
        transport: lossy,
        now,
        newOpId: newOpIds[i],
        rules: SYNC_FIXTURE_RULES,
        triggers: () => () => {},
      });
      return { db, engine, lossy };
    }),
  );
  return {
    ctx,
    userId: user.id,
    devices: devices as [Device, Device],
    newRowId: createMonotonicUuidV7(now, seededBytes(base + 12)),
    newOpIds,
    createdItems: [],
  };
}

async function settle(r: Real): Promise<void> {
  for (const d of r.devices) d.lossy.heal();
  for (let round = 0; round < 10; round++) {
    for (const d of r.devices) await d.engine.syncNow('manual');
    const pending = await Promise.all(r.devices.map((d) => pendingCount(d.db, r.userId)));
    if (pending.every((n) => n === 0)) break;
  }
  for (const d of r.devices) await d.engine.pullNow();
}

async function expectConverged(r: Real): Promise<void> {
  const { ctx } = r;
  const notes = view(serverRows(ctx, 'fixture_note'), NOTE_SERVER);
  const items = view(serverRows(ctx, 'fixture_note_item'), ITEM_SERVER);
  const rejections = view(serverRows(ctx, 'sync_rejection'), REJ_SERVER);
  const rejectedOpIds = new Set(rejections.map((x) => x.opId));
  const deadItems = new Set<string>();

  for (const d of r.devices) {
    expect(await pendingCount(d.db, r.userId)).toBe(0);
    expect(view(await mirrorRows(d, 'fixture_note'), NOTE_MIRROR)).toEqual(notes);
    expect(view(await mirrorRows(d, 'fixture_note_item'), ITEM_MIRROR)).toEqual(items);
    expect(view(await mirrorRows(d, 'sync_rejection'), REJ_MIRROR)).toEqual(rejections);
    for (const dead of await d.db.deadletter.toArray()) {
      expect(rejectedOpIds.has(dead.opId)).toBe(true);
      if (dead.entity === 'fixture_note_item') deadItems.add(dead.id);
    }
  }
  // Aucune perte ni doublon : chaque élément créé et non rejeté est au serveur, une seule fois.
  const expectedItems = r.createdItems.filter((id) => !deadItems.has(id)).sort();
  expect(items.map((i) => i.id)).toEqual(expectedItems);
}

async function teardown(r: Real): Promise<void> {
  for (const d of r.devices) {
    d.engine.stop();
    await d.db.delete();
  }
  r.ctx.close();
}

describe('convergence de deux appareils sur le vrai serveur', () => {
  it.each<LossyOptions>([
    { seed: 20261006, dropRate: 0.3, dupRate: 0.2, maxDelayMs: 3, reorder: false },
    { seed: 7, dropRate: 0.2, dupRate: 0.4, maxDelayMs: 3, reorder: true },
  ])(
    'deux appareils convergent malgré pertes, doublons, retards et réordonnancements (%o)',
    async (opts) => {
      // Non-vacuité : cumul sur tous les essais, chaque compteur doit être positif.
      const totals = {
        serverNotes: 0,
        rejections: 0,
        deadletters: 0,
        droppedRequests: 0,
        droppedResponses: 0,
        pushResponsesDroppedAfterApply: 0,
        duplicated: 0,
        replayedLate: 0,
      };
      await fc.assert(
        fc.asyncProperty(
          fc.commands(commandArbs, { maxCommands: 60, size: 'large' }),
          fc.integer({ min: 0, max: 0x7fffffff }),
          async (cmds, netSeed) => {
            const real = await setupReal(opts, netSeed);
            try {
              await fc.asyncModelRun(() => ({ model: {}, real }), cmds);
              for (const { lossy } of real.devices) {
                totals.droppedRequests += lossy.stats.droppedRequests;
                totals.droppedResponses += lossy.stats.droppedResponses;
                totals.pushResponsesDroppedAfterApply +=
                  lossy.stats.droppedResponsesByPath['/api/sync/push'] ?? 0;
                totals.duplicated += lossy.stats.duplicated;
                totals.replayedLate += lossy.stats.replayedLate;
              }
              await settle(real);
              await expectConverged(real);
              totals.serverNotes += serverRows(real.ctx, 'fixture_note').length;
              totals.rejections += serverRows(real.ctx, 'sync_rejection').length;
              for (const d of real.devices) totals.deadletters += await d.db.deadletter.count();
            } finally {
              await teardown(real);
            }
          },
        ),
        // Un échec affiche son contre-exemple (même en cours de réduction) avant le délai du test.
        { numRuns: 25, seed: opts.seed, interruptAfterTimeLimit: 90_000, markInterruptAsFailure: true },
      );
      for (const [name, total] of Object.entries(totals)) {
        if (name === 'replayedLate' && !opts.reorder) continue;
        expect({ name, positive: total > 0 }).toEqual({ name, positive: true });
      }
    },
    120_000,
  );
});
