import type { SyncOp } from '@appsport/contracts';
import type { Transaction } from 'kysely';
import type { Database } from '../db/schema';
import type { AppDeps } from '../deps';

export interface HookCtx {
  trx: Transaction<Database>;
  deps: AppDeps;
  userId: string;
  op: SyncOp;
}

export interface BatchCtx {
  trx: Transaction<Database>;
  deps: AppDeps;
  userId: string;
  applied: readonly { entity: string; id: string }[];
}

/** Points d'extension d'une table J ; la relation parent est lue dans `EntityRule.parent`. */
export interface EntitySyncHooks {
  allowedKinds?: readonly SyncOp['kind'][];
  /** Dans le point de sauvegarde de l'op, avant l'écriture ; `fields` en snake_case, déjà filtrés. */
  beforeApply?(ctx: HookCtx, fields: Record<string, unknown>): Promise<void>;
  /** Après une écriture effective de l'op. */
  afterApply?(ctx: HookCtx): Promise<void>;
  /** Une fois par lot et par entité ayant des ops écrites. */
  afterBatch?(b: BatchCtx): Promise<void>;
}

export type SyncHooksMap = Readonly<Record<string, EntitySyncHooks>>;

/** Au socle, le client n'écrit que `dismissed_at` de ses rejets. */
export const SYNC_HOOKS: SyncHooksMap = { sync_rejection: { allowedKinds: ['patch'] } };
