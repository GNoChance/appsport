import { camelToSnake, type EntityRulesMap, entityRules, SYNC_PROTOCOL, SyncOp } from '@appsport/contracts';
import type { AppDb, MirrorRow, OutboxOp } from '../local-db/db';
import { stripC2Fields } from '../local-db/wipe';

export interface LocalChange {
  entity: string;
  id: string;
  kind: 'create' | 'patch' | 'delete';
  fields: Record<string, unknown>;
}

export class HealthConsentRequiredError extends Error {
  constructor() {
    super('health_consent_required');
    this.name = 'HealthConsentRequiredError';
  }
}

/**
 * Écriture locale d'une table J : ligne miroir et op d'outbox dans une seule transaction
 * (R-SYN-11 à R-SYN-14). Sans accord santé, une table C2 est refusée et les valeurs C2 retirées.
 */
export async function writeLocal(
  db: AppDb,
  change: LocalChange,
  ctx: {
    userId: string;
    now: () => string;
    newOpId: () => string;
    healthConsentActive: boolean;
    rules?: EntityRulesMap;
  },
): Promise<OutboxOp> {
  const rules = ctx.rules ?? entityRules;
  const rule = Object.hasOwn(rules, change.entity) ? rules[change.entity] : undefined;
  if (rule?.syncClass !== 'J') throw new Error('entity_not_journal');
  for (const key of Object.keys(change.fields)) {
    if (!rule.clientWritable.includes(camelToSnake(key))) throw new Error(`field_not_writable:${key}`);
  }
  if (!ctx.healthConsentActive && rule.category === 'C2') throw new HealthConsentRequiredError();
  const fields = ctx.healthConsentActive ? { ...change.fields } : stripC2Fields(rule, change.fields).fields;

  const now = ctx.now();
  const op = SyncOp.parse({
    opId: ctx.newOpId(),
    userId: ctx.userId,
    entity: change.entity,
    id: change.id,
    kind: change.kind,
    fields,
    clientTs: now,
    protocol: SYNC_PROTOCOL,
    attempts: 0,
  });

  const mirror = db.mirror(change.entity);
  await db.transaction('rw', db.outbox, mirror, async () => {
    if (change.kind === 'create') {
      const row: MirrorRow = {
        ...fields,
        id: change.id,
        ownerId: ctx.userId,
        serverRevSeen: null,
        deletedAt: null,
        updatedAt: now,
      };
      await mirror.put(row);
    } else {
      const existing = await mirror.get(change.id);
      if (!existing) throw new Error('row_missing');
      const update =
        change.kind === 'patch' ? { ...fields, updatedAt: now } : { deletedAt: now, updatedAt: now };
      await mirror.put({ ...existing, ...update });
    }
    await db.outbox.add(op);
  });
  return op;
}

/** Ops en attente de l'utilisateur. */
export async function pendingCount(db: AppDb, userId: string): Promise<number> {
  return db.outbox.where('userId').equals(userId).count();
}
