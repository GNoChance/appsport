import type { EntityRule } from '@appsport/contracts';
import { sql } from 'kysely';
import { writeStamp } from '../db/rev';
import { getServerMeta } from '../db/server-meta';
import type { HookCtx } from './hooks';

export type RestoreUpsertOutcome = { outcome: 'inserted' | 'replaced' | 'kept'; rev: number };

/** Ligne déjà lue par le push (étape 6) ; `undefined` si l'id est inconnu. */
export interface RestoreTarget {
  rev: number;
  deletedAt: string | null;
}

/**
 * Renvoi d'une ligne J après une nouvelle époque (R-SYN-27). `fields` : colonnes snake_case déjà
 * filtrées, `deleted_at` compris s'il est fourni. Ligne absente → insérée ; ligne venue de la
 * sauvegarde (rev ≤ epoch_base_rev) que le client avait vue plus récente (serverRevSeen > rev) →
 * remplacée ; sinon gardée, sauf une suppression du client sur une ligne vivante, qui l'emporte.
 * La règle n'est pas relue : le push n'admet que les tables J à `owner_id`.
 */
export async function applyRestoreUpsert(
  ctx: HookCtx,
  _rule: EntityRule,
  fields: Record<string, unknown>,
  existing: RestoreTarget | undefined,
): Promise<RestoreUpsertOutcome> {
  const { trx, deps, userId, op } = ctx;
  const table = sql.table(op.entity);

  if (!existing) {
    const stamp = await writeStamp(trx, deps, userId);
    const row: Record<string, unknown> = {
      deleted_at: null,
      ...fields,
      id: op.id,
      owner_id: userId,
      rev: stamp.rev,
      created_at: stamp.updatedAt,
      updated_at: stamp.updatedAt,
      updated_by: stamp.updatedBy,
    };
    const columns = sql.join(Object.keys(row).map((c) => sql.ref(c)));
    await sql`insert into ${table} (${columns}) values (${sql.join(Object.values(row))})`.execute(trx);
    return { outcome: 'inserted', rev: stamp.rev };
  }

  const { epochBaseRev } = await getServerMeta(trx);
  const seen = op.serverRevSeen ?? null;
  let set: Record<string, unknown> | null = null;
  if (existing.rev <= epochBaseRev && seen !== null && seen > existing.rev) set = fields;
  else if (fields.deleted_at != null && existing.deletedAt === null) set = { deleted_at: fields.deleted_at };
  if (!set) return { outcome: 'kept', rev: existing.rev };

  const stamp = await writeStamp(trx, deps, userId);
  const values = { ...set, rev: stamp.rev, updated_at: stamp.updatedAt, updated_by: stamp.updatedBy };
  const assignments = sql.join(Object.entries(values).map(([c, v]) => sql`${sql.ref(c)} = ${v}`));
  await sql`update ${table} set ${assignments} where id = ${op.id}`.execute(trx);
  return { outcome: 'replaced', rev: stamp.rev };
}
