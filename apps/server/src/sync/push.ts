import {
  camelToSnake,
  type EntityRule,
  MIN_PROTOCOL,
  type PushResult,
  type RejectionCode,
  SYNC_PROTOCOL,
  SyncOp,
  snakeToCamel,
} from '@appsport/contracts';
import { isUuidV7 } from '@appsport/domain';
import { sql, type Transaction } from 'kysely';
import type { SessionUser } from '../app-env';
import { writeStamp } from '../db/rev';
import type { AppliedOpTable, Database } from '../db/schema';
import type { AppDeps } from '../deps';
import { isHealthConsentActive } from '../privacy/consent-state';
import type { EntitySyncHooks, HookCtx } from './hooks';

/** Rejet d'une op : enregistré dans sync_rejection, le reste du lot continue. */
export class OpRejection extends Error {
  readonly code: RejectionCode;
  readonly reason: string;

  constructor(code: RejectionCode, reason: string) {
    super(`${code}: ${reason}`);
    this.name = 'OpRejection';
    this.code = code;
    this.reason = reason;
  }
}

/** Op d'un autre utilisateur (opId ou userId) : refusée sans rien écrire. */
class UnrecordedRejection extends Error {}

const SQLITE_CONSTRAINT = 19;

interface Batch {
  trx: Transaction<Database>;
  deps: AppDeps;
  user: SessionUser;
  consent: boolean;
  rejectedRows: Set<string>;
  written: Map<string, { entity: string; id: string }[]>;
}

interface Applied {
  result: PushResult;
  wrote?: { entity: string; id: string };
}

interface ExistingRow {
  ownerId: string;
  rev: number;
  deletedAt: string | null;
}

type Raw = Record<string, unknown>;

const asRecord = (v: unknown): Raw =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Raw) : {};
const textOf = (raw: Raw, key: string): string | null => {
  const v = raw[key];
  return typeof v === 'string' && v !== '' ? v : null;
};
const own = <T>(map: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(map, key) ? map[key] : undefined;

function isConstraintError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('errcode' in err)) return false;
  return typeof err.errcode === 'number' && (err.errcode & 0xff) === SQLITE_CONSTRAINT;
}

/**
 * Applique un lot d'ops (R-SYN-16) dans une transaction, un point de sauvegarde par op.
 * Une erreur autre qu'un rejet ou une contrainte SQLite annule tout le lot (500, le client rejoue).
 */
export async function applyPush(
  deps: AppDeps,
  user: SessionUser,
  ops: readonly unknown[],
): Promise<PushResult[]> {
  const results = await deps.db.transaction().execute(async (trx) => {
    const batch: Batch = {
      trx,
      deps,
      user,
      consent: await isHealthConsentActive(trx, user.id),
      rejectedRows: new Set(),
      written: new Map(),
    };
    const out: PushResult[] = [];
    for (const [index, raw] of ops.entries()) out.push(await applyInSavepoint(batch, asRecord(raw), index));
    for (const [entity, applied] of batch.written) {
      await own(deps.syncHooks, entity)?.afterBatch?.({ trx, deps, userId: user.id, applied });
    }
    return out;
  });
  deps.logger.info('sync push', { event: 'sync_push', count: ops.length });
  return results;
}

async function applyInSavepoint(b: Batch, raw: Raw, index: number): Promise<PushResult> {
  const savepoint = `sync_op_${index}`;
  await sql.raw(`SAVEPOINT ${savepoint}`).execute(b.trx);
  let applied: Applied;
  try {
    applied = await applyOp(b, raw);
  } catch (err) {
    if (!(err instanceof OpRejection || err instanceof UnrecordedRejection || isConstraintError(err)))
      throw err;
    await sql.raw(`ROLLBACK TO ${savepoint}`).execute(b.trx);
    await sql.raw(`RELEASE ${savepoint}`).execute(b.trx);
    return reject(b, raw, err);
  }
  await sql.raw(`RELEASE ${savepoint}`).execute(b.trx);
  if (applied.wrote) {
    const list = b.written.get(applied.wrote.entity) ?? [];
    list.push(applied.wrote);
    b.written.set(applied.wrote.entity, list);
  }
  return applied.result;
}

async function reject(b: Batch, raw: Raw, err: unknown): Promise<PushResult> {
  const rejection = err instanceof UnrecordedRejection || err instanceof OpRejection ? err : null;
  const code: RejectionCode =
    rejection instanceof OpRejection ? rejection.code : rejection ? 'forbidden' : 'validation';
  const opId = textOf(raw, 'opId');
  b.deps.logger.warn('sync op rejected', { event: 'sync_rejected', code });
  const result: PushResult = { opId: opId ?? '', status: 'rejected', code };
  if (err instanceof UnrecordedRejection) return result;

  const reason = rejection instanceof OpRejection ? rejection.reason : 'sql_constraint';
  const entity = textOf(raw, 'entity') ?? '';
  const rowId = textOf(raw, 'id') ?? '';
  b.rejectedRows.add(`${entity}:${rowId}`);
  const detail = { kind: textOf(raw, 'kind'), fieldNames: Object.keys(asRecord(raw.fields)).sort(), reason };
  const stamp = await writeStamp(b.trx, b.deps, b.user.id);
  await b.trx
    .insertInto('syncRejection')
    .values({
      id: b.deps.ids.uuidv7(),
      ownerId: b.user.id,
      opId: opId ?? '',
      entity,
      rowId,
      code,
      detailJson: JSON.stringify(detail),
      dismissedAt: null,
      deletedAt: null,
      createdAt: stamp.updatedAt,
      ...stamp,
    })
    .execute();
  if (opId) await recordAppliedOp(b, opId, entity, rowId, 'rejected', null);
  return result;
}

async function applyOp(b: Batch, raw: Raw): Promise<Applied> {
  const { trx, deps, user } = b;
  // 0. Idempotence.
  const rawOpId = textOf(raw, 'opId');
  if (rawOpId) {
    const seen = await trx
      .selectFrom('appliedOp')
      .select(['userId', 'assignedRev'])
      .where('opId', '=', rawOpId)
      .executeTakeFirst();
    if (seen) {
      if (seen.userId !== user.id) throw new UnrecordedRejection();
      const rev = seen.assignedRev ?? undefined;
      return { result: { opId: rawOpId, status: 'duplicate', ...(rev !== undefined ? { rev } : {}) } };
    }
  }
  // 1. Forme.
  const parsed = SyncOp.safeParse(raw);
  if (!parsed.success) throw new OpRejection('validation', 'schema');
  const op = parsed.data;
  const clientId = op.kind === 'create' || op.kind === 'restore_upsert';
  if (clientId && !isUuidV7(op.id)) throw new OpRejection('validation', 'id_format');
  // 2. Protocole.
  if (op.protocol < MIN_PROTOCOL || op.protocol > SYNC_PROTOCOL)
    throw new OpRejection('protocol', 'protocol');
  // 3. Table J.
  const rule = own(deps.entityRules, op.entity);
  if (rule?.syncClass !== 'J' || rule.ownerColumn !== 'owner_id') {
    throw new OpRejection('unknown_entity', 'not_journal');
  }
  // 4. Kinds permis.
  const hooks: EntitySyncHooks | undefined = own(deps.syncHooks, op.entity);
  if (hooks?.allowedKinds && !hooks.allowedKinds.includes(op.kind)) {
    throw new OpRejection('forbidden', 'kind_not_allowed');
  }
  // 5. Utilisateur de la session.
  if (op.userId !== user.id) throw new UnrecordedRejection();
  // 6. Propriétaire de la ligne existante.
  const existing = await readRow(trx, op.entity, op.id);
  if (existing && existing.ownerId !== user.id) throw new OpRejection('forbidden', 'owner_mismatch');
  // 7. Parent (à la création, et pour un patch qui change de parent).
  if (rule.parent && (clientId || (op.kind === 'patch' && snakeToCamel(rule.parent.column) in op.fields))) {
    await assertParent(b, rule.parent, op.fields);
  }
  // 8. Table C2 sans accord : op écartée, rien d'écrit.
  if (!b.consent && rule.category === 'C2' && op.kind !== 'delete') {
    await recordAppliedOp(b, op.opId, op.entity, op.id, 'applied_partial', null);
    return { result: { opId: op.opId, status: 'applied_partial', dropped: true } };
  }
  // 9. Champs écrits par le client ; C2 à null sans accord.
  const { fields, droppedFields } =
    op.kind === 'delete' ? { fields: {}, droppedFields: [] } : keepFields(rule, op.fields, b.consent);
  // 10. Écriture.
  if (op.kind === 'restore_upsert') throw new OpRejection('validation', 'not_supported');
  const hookCtx: HookCtx = { trx, deps, userId: user.id, op };
  await hooks?.beforeApply?.(hookCtx, fields);
  const outcome = await writeRow(b, op, existing, fields);
  // 11.
  if (outcome.wrote) await hooks?.afterApply?.(hookCtx);
  // 12.
  const status = droppedFields.length > 0 ? 'applied_partial' : 'applied';
  await recordAppliedOp(b, op.opId, op.entity, op.id, status, outcome.rev);
  return {
    result: {
      opId: op.opId,
      status,
      ...(outcome.rev !== null ? { rev: outcome.rev } : {}),
      ...(droppedFields.length > 0 ? { droppedFields } : {}),
    },
    ...(outcome.wrote ? { wrote: { entity: op.entity, id: op.id } } : {}),
  };
}

async function readRow(
  trx: Transaction<Database>,
  entity: string,
  id: string,
): Promise<ExistingRow | undefined> {
  const r =
    await sql<ExistingRow>`select owner_id, rev, deleted_at from ${sql.table(entity)} where id = ${id}`.execute(
      trx,
    );
  return r.rows[0];
}

async function assertParent(
  b: Batch,
  parent: NonNullable<EntityRule['parent']>,
  fields: Record<string, unknown>,
): Promise<void> {
  const parentId = fields[snakeToCamel(parent.column)];
  if (typeof parentId !== 'string' || b.rejectedRows.has(`${parent.entity}:${parentId}`)) {
    throw new OpRejection('parent_rejected', 'parent_rejected');
  }
  const row = await readRow(b.trx, parent.entity, parentId);
  if (!row || row.ownerId !== b.user.id) throw new OpRejection('parent_rejected', 'parent_rejected');
}

function isC2Value(rule: EntityRule, column: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (rule.c2Columns.includes(column)) return true;
  const values = rule.c2Values && Object.hasOwn(rule.c2Values, column) ? rule.c2Values[column] : undefined;
  return typeof value === 'string' && values !== undefined && values.includes(value);
}

function toSqlValue(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value;
}

/** Garde les colonnes `clientWritable` (clés camelCase), les autres sont ignorées en silence. */
function keepFields(
  rule: EntityRule,
  input: Record<string, unknown>,
  consent: boolean,
): { fields: Record<string, unknown>; droppedFields: string[] } {
  const fields: Record<string, unknown> = {};
  const droppedFields: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const column = camelToSnake(key);
    if (snakeToCamel(column) !== key || !rule.clientWritable.includes(column)) continue;
    if (!consent && isC2Value(rule, column, value)) {
      fields[column] = null;
      droppedFields.push(key);
    } else {
      fields[column] = toSqlValue(value);
    }
  }
  return { fields, droppedFields };
}

async function writeRow(
  b: Batch,
  op: SyncOp,
  existing: ExistingRow | undefined,
  fields: Record<string, unknown>,
): Promise<{ rev: number | null; wrote: boolean }> {
  const { trx, deps, user } = b;
  const table = sql.table(op.entity);
  if (op.kind === 'create') {
    if (existing) return { rev: existing.rev, wrote: false };
    const stamp = await writeStamp(trx, deps, user.id);
    const row: Record<string, unknown> = {
      id: op.id,
      owner_id: user.id,
      ...fields,
      rev: stamp.rev,
      created_at: stamp.updatedAt,
      updated_at: stamp.updatedAt,
      updated_by: stamp.updatedBy,
      deleted_at: null,
    };
    const columns = sql.join(Object.keys(row).map((c) => sql.ref(c)));
    await sql`insert into ${table} (${columns}) values (${sql.join(Object.values(row))})`.execute(trx);
    return { rev: stamp.rev, wrote: true };
  }
  if (!existing) {
    if (op.kind === 'patch') throw new OpRejection('validation', 'row_missing');
    return { rev: null, wrote: false };
  }
  if (existing.deletedAt !== null) return { rev: existing.rev, wrote: false };
  const stamp = await writeStamp(trx, deps, user.id);
  const set: Record<string, unknown> = {
    ...(op.kind === 'delete' ? { deleted_at: stamp.updatedAt } : fields),
    rev: stamp.rev,
    updated_at: stamp.updatedAt,
    updated_by: stamp.updatedBy,
  };
  const assignments = sql.join(Object.entries(set).map(([c, v]) => sql`${sql.ref(c)} = ${v}`));
  await sql`update ${table} set ${assignments} where id = ${op.id}`.execute(trx);
  return { rev: stamp.rev, wrote: true };
}

async function recordAppliedOp(
  b: Batch,
  opId: string,
  entity: string,
  rowId: string,
  status: AppliedOpTable['status'],
  assignedRev: number | null,
): Promise<void> {
  await b.trx
    .insertInto('appliedOp')
    .values({
      opId,
      userId: b.user.id,
      entity,
      rowId,
      status,
      assignedRev,
      appliedAt: b.deps.clock.now().toISOString(),
    })
    .execute();
}
