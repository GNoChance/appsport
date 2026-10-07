import {
  type EntityRule,
  type EntityRulesMap,
  EPOCH_RESEND_DAYS,
  type PushResult,
  SYNC_PROTOCOL,
  SYNC_PUSH_MAX,
  snakeToCamel,
} from '@appsport/contracts';
import Dexie from 'dexie';
import { z } from 'zod';
import { stripC2Fields } from '../local-db/c2';
import { localHealthConsentActive } from '../local-db/consent';
import { type AppDb, mirrorStoreNames, type OutboxOp } from '../local-db/db';
import { deleteMeta, getMeta, setMeta } from '../local-db/meta';
import { deadletterOf, effectiveStatus } from './push-results';
import { httpErrorOf, type JsonReply } from './transport';

const DAY_MS = 86_400_000;

const MeConsents = z.looseObject({
  consents: z.looseObject({ health: z.looseObject({ active: z.boolean() }) }),
});

/** Ce dont l'étape « époque » a besoin du cycle en cours. */
export interface EpochIo {
  db: AppDb;
  rules: EntityRulesMap;
  userId: string;
  now(): number;
  newOpId(): string;
  /** Lève si l'utilisateur a changé ou si le cycle n'est plus le courant. */
  assertCurrent(): Promise<void>;
  sendPush(ops: OutboxOp[]): Promise<PushResult[]>;
  request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<JsonReply>;
}

function depth(rules: EntityRulesMap, entity: string, guard = 0): number {
  const parent = Object.hasOwn(rules, entity) ? rules[entity]?.parent : undefined;
  return parent && guard < 16 ? 1 + depth(rules, parent.entity, guard + 1) : 0;
}

const compare = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

/**
 * a. restore_upsert des lignes J de l'utilisateur (sauf sync_rejection) modifiées depuis moins de
 * EPOCH_RESEND_DAYS, parents d'abord puis par id, par lots de SYNC_PUSH_MAX, jamais dans l'outbox ;
 * sans accord local, tables C2 exclues et valeurs C2 retirées. Un rejet va en deadletter.
 */
export async function resendJournal(io: EpochIo): Promise<void> {
  const { db, rules } = io;
  const consent = await localHealthConsentActive(db);
  const since = io.now() - EPOCH_RESEND_DAYS * DAY_MS;
  const candidates: { entity: string; id: string; fields: Record<string, unknown>; seen: number | null }[] =
    [];
  for (const entity of mirrorStoreNames(db)) {
    const rule: EntityRule | undefined = Object.hasOwn(rules, entity) ? rules[entity] : undefined;
    if (rule?.syncClass !== 'J' || entity === 'sync_rejection') continue;
    if (!consent && rule.category === 'C2') continue;
    for (const row of await db.mirror(entity).toArray()) {
      if (row.ownerId !== io.userId || typeof row.updatedAt !== 'string') continue;
      if (!(Date.parse(row.updatedAt) >= since)) continue;
      let fields: Record<string, unknown> = {};
      for (const column of rule.clientWritable) {
        const key = snakeToCamel(column);
        if (Object.hasOwn(row, key) && row[key] !== undefined) fields[key] = row[key];
      }
      if (!consent) fields = stripC2Fields(rule, fields).fields;
      fields.deletedAt = row.deletedAt ?? null;
      candidates.push({ entity, id: row.id, fields, seen: row.serverRevSeen ?? null });
    }
  }
  candidates.sort(
    (a, b) =>
      depth(rules, a.entity) - depth(rules, b.entity) || compare(a.id, b.id) || compare(a.entity, b.entity),
  );
  const clientTs = new Date(io.now()).toISOString();
  const ops: OutboxOp[] = candidates.map((c) => ({
    opId: io.newOpId(),
    userId: io.userId,
    entity: c.entity,
    id: c.id,
    kind: 'restore_upsert',
    fields: c.fields,
    clientTs,
    protocol: SYNC_PROTOCOL,
    attempts: 0,
    serverRevSeen: c.seen,
  }));
  for (let i = 0; i < ops.length; i += SYNC_PUSH_MAX) {
    await io.assertCurrent();
    const batch = ops.slice(i, i + SYNC_PUSH_MAX);
    const byId = new Map(batch.map((o) => [o.opId, o]));
    const results = await io.sendPush(batch);
    await io.assertCurrent();
    const receivedAt = new Date(io.now()).toISOString();
    // Un renvoi rejeté va en deadletter : ce n'est pas un échec du cycle.
    const dead = results.flatMap((r) => {
      const op = byId.get(r.opId);
      return op && effectiveStatus(r) === 'rejected' ? [deadletterOf(op, r.code, receivedAt)] : [];
    });
    if (dead.length > 0) await db.deadletter.bulkPut(dead);
  }
}

/** b. R-SYN-28 : renvoi d'un retrait d'accord santé perdu par une restauration. */
export async function replayWithdrawal(io: EpochIo): Promise<void> {
  const { db } = io;
  if (!db.mirrorNames.includes('consent_event')) return;
  const last = await db
    .mirror('consent_event')
    .where('[type+createdAt]')
    .between(['health', Dexie.minKey], ['health', Dexie.maxKey])
    .last();
  if (last?.action !== 'withdraw' || typeof last.createdAt !== 'string') return;
  const me = await io.request('GET', '/api/me');
  if (!me.res.ok) throw httpErrorOf(me);
  if (!MeConsents.parse(me.body).consents.health.active) return;
  const reply = await io.request('POST', '/api/me/consents/health/replay-withdraw', {
    withdrawnAt: last.createdAt,
  });
  if (reply.res.ok) return;
  const error = httpErrorOf(reply);
  if (error.code !== 'conflict') throw error;
}

/**
 * 2. Époque du cycle face à `meta.serverEpoch` : absente → enregistrée ; différente → renvoi puis
 * R-SYN-28, puis époque enregistrée et watermark retiré. Un échec laisse l'époque locale inchangée.
 */
export async function handleEpoch(io: EpochIo, epoch: string | null): Promise<void> {
  if (epoch === null) return;
  const { db } = io;
  const local = await getMeta(db, 'serverEpoch');
  if (local === epoch) return;
  if (local !== undefined) {
    // Outbox en pause jusqu'à la fin du renvoi.
    await resendJournal(io);
    await replayWithdrawal(io);
  }
  await io.assertCurrent();
  await db.transaction('rw', db.meta, async () => {
    await setMeta(db, 'serverEpoch', epoch);
    if (local !== undefined) await deleteMeta(db, 'watermark');
  });
}
