import { HEALTH_CONSENT_TEXT } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../src/logger';
import { grantConsent } from '../../src/privacy/consent';
import {
  createSyncTestContext,
  createUserAndLogin,
  dumpDatabase,
  makeOp,
  seqIds,
  syncPush,
  type TestContext,
} from '../support';

// Review Focus 3 (serveur) : une donnée C2 poussée sans accord santé n'est écrite nulle part.
const WITNESS = 'TEMOIN-C2-7f3a';
const WITNESS_N = 987654;

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
type Row = Record<string, unknown>;

const rowIds = seqIds(8000);
const newId = () => rowIds.uuidv7();

let ctx: TestContext;
let lines: string[];
afterEach(() => ctx?.close());

async function setup(): Promise<Member> {
  lines = [];
  ctx = await createSyncTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
  return createUserAndLogin(ctx);
}

const rowOf = (table: string, id: string) =>
  ctx.deps.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined;
const rowsOf = (table: string) => ctx.deps.sqlite.prepare(`SELECT * FROM ${table}`).all() as Row[];

/** Une note parente puis un élément portant `fields`. */
async function pushItem(u: Member, fields: Row) {
  const parent = makeOp({
    userId: u.id,
    entity: 'fixture_note',
    id: newId(),
    kind: 'create',
    fields: { title: 'n' },
  });
  const item = makeOp({
    userId: u.id,
    entity: 'fixture_note_item',
    id: newId(),
    kind: 'create',
    fields: { noteId: parent.id, label: 'l', ...fields },
  });
  const res = await syncPush(ctx, u.cookie, [parent, item]);
  expect(res.status).toBe(200);
  return { item, result: res.body.results[1] as Row };
}

function expectNoWitness() {
  const dump = dumpDatabase(ctx.deps.sqlite);
  const journal = lines.join('\n');
  for (const witness of [WITNESS, String(WITNESS_N)]) {
    expect(dump).not.toContain(witness);
    expect(journal).not.toContain(witness);
  }
}

describe('push et données de santé (C2)', () => {
  it('sans accord : la colonne C2 est mise à null et signalée', async () => {
    const a = await setup();
    const { item, result } = await pushItem(a, { painNote: WITNESS });
    expect(result).toEqual({
      opId: item.opId,
      status: 'applied_partial',
      rev: expect.any(Number),
      droppedFields: ['painNote'],
    });
    expect(result.rev as number).toBeGreaterThan(0);
    expect(rowOf('fixture_note_item', item.id)).toMatchObject({ pain_note: null, label: 'l' });
    expect(ctx.deps.sqlite.prepare('SELECT status FROM applied_op WHERE op_id = ?').get(item.opId)).toEqual({
      status: 'applied_partial',
    });
    expect(rowsOf('sync_rejection')).toHaveLength(0);
    expectNoWitness();
  });

  it('sans accord : une valeur C2 de c2Values est écartée, une valeur C1 gardée', async () => {
    const a = await setup();
    const pain = await pushItem(a, { reason: 'pain' });
    expect(pain.result).toMatchObject({ status: 'applied_partial', droppedFields: ['reason'] });
    expect(rowOf('fixture_note_item', pain.item.id)).toMatchObject({ reason: null });

    const fatigue = await pushItem(a, { reason: 'fatigue' });
    expect(fatigue.result.status).toBe('applied');
    expect(fatigue.result.droppedFields).toBeUndefined();
    expect(rowOf('fixture_note_item', fatigue.item.id)).toMatchObject({ reason: 'fatigue' });
  });

  it('sans accord : une op sur une table C2 est écartée entièrement', async () => {
    const a = await setup();
    const op = makeOp({
      userId: a.id,
      entity: 'fixture_c2_log',
      id: newId(),
      kind: 'create',
      fields: { value: WITNESS_N },
    });
    const res = await syncPush(ctx, a.cookie, [op]);
    expect(res.body.results).toEqual([{ opId: op.opId, status: 'applied_partial', dropped: true }]);
    expect(rowsOf('fixture_c2_log')).toHaveLength(0);
    expect(ctx.deps.sqlite.prepare('SELECT * FROM applied_op WHERE op_id = ?').get(op.opId)).toMatchObject({
      status: 'applied_partial',
      assigned_rev: null,
    });
    expect(rowsOf('sync_rejection')).toHaveLength(0);
    expectNoWitness();
  });

  it('avec accord : la donnée C2 est écrite', async () => {
    const a = await setup();
    await grantConsent(ctx.deps.db, ctx.deps, a.id, 'health', HEALTH_CONSENT_TEXT.version, null);
    const { item, result } = await pushItem(a, { painNote: WITNESS, reason: 'pain' });
    expect(result).toEqual({ opId: item.opId, status: 'applied', rev: expect.any(Number) });
    expect(rowOf('fixture_note_item', item.id)).toMatchObject({ pain_note: WITNESS, reason: 'pain' });

    const log = makeOp({
      userId: a.id,
      entity: 'fixture_c2_log',
      id: newId(),
      kind: 'create',
      fields: { value: WITNESS_N },
    });
    const res = await syncPush(ctx, a.cookie, [log]);
    expect(res.body.results[0].status).toBe('applied');
    expect(rowOf('fixture_c2_log', log.id)).toMatchObject({ value: WITNESS_N });
    expect(lines.join('\n')).not.toContain(WITNESS);
  });
});
