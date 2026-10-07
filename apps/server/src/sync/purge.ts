import { APPLIED_OP_TTL_MONTHS, TOMBSTONE_TTL_DAYS } from '@appsport/contracts';
import { sql, type Transaction } from 'kysely';
import { subtractMonths } from '../auth/purge';
import type { Database } from '../db/schema';
import type { AppDeps } from '../deps';
import type { DailyJob } from '../jobs/scheduler';

const DAY_MS = 86_400_000;
const MIRRORED = new Set(['J', 'D', 'E']);
/** Lignes partagées : leurs tombstones restent (R-SYN-26). */
const NEVER_PURGED = new Set(['gym', 'place']);

interface IncomingFk {
  child: string;
  from: string;
  to: string;
}

/** Clés étrangères entrantes de chaque table, lues dans le schéma (toutes les tables). */
async function incomingForeignKeys(trx: Transaction<Database>): Promise<Map<string, IncomingFk[]>> {
  const tables = await sql<{ name: string }>`select name from sqlite_schema
    where type = 'table' and name not like 'sqlite_%' order by name`.execute(trx);
  const incoming = new Map<string, IncomingFk[]>();
  for (const { name } of tables.rows) {
    const fks = await sql<{ table: string; from: string; to: string | null }>`
      select "table", "from", "to" from pragma_foreign_key_list(${name})`.execute(trx);
    for (const fk of fks.rows) {
      const list = incoming.get(fk.table) ?? [];
      list.push({ child: name, from: fk.from, to: fk.to ?? 'id' });
      incoming.set(fk.table, list);
    }
  }
  return incoming;
}

/** Enfants avant parents (tri topologique) ; un cycle éventuel garde l'ordre alphabétique. */
function childrenFirst(tables: string[], incoming: Map<string, IncomingFk[]>): string[] {
  const pending = new Set(tables);
  const order: string[] = [];
  while (pending.size > 0) {
    const ready = [...pending].filter(
      (t) => !(incoming.get(t) ?? []).some((fk) => fk.child !== t && pending.has(fk.child)),
    );
    const next = ready.length > 0 ? ready : [...pending];
    for (const t of next) {
      pending.delete(t);
      order.push(t);
    }
  }
  return order;
}

/**
 * Purge quotidienne de la synchro (R-SYN-26, 03 §7), en une transaction : tombstones J/D/E de plus
 * de 90 j (hors salles et lieux), enfants avant parents, jamais un parent encore référencé ;
 * `tombstone_purge_rev` monte au plus grand rev supprimé ; `applied_op` de plus de 12 mois.
 */
export const syncPurgeJob: DailyJob = {
  name: 'sync-purge',
  async run(deps: AppDeps) {
    const now = deps.clock.now();
    const tombstonesBefore = new Date(now.getTime() - TOMBSTONE_TTL_DAYS * DAY_MS).toISOString();
    const opsBefore = subtractMonths(now, APPLIED_OP_TTL_MONTHS).toISOString();

    const count = await deps.db.transaction().execute(async (trx) => {
      const targets = Object.entries(deps.entityRules)
        .filter(
          ([entity, r]) =>
            MIRRORED.has(r.syncClass) && r.columns.includes('deleted_at') && !NEVER_PURGED.has(entity),
        )
        .map(([entity]) => entity)
        .sort();
      const incoming = await incomingForeignKeys(trx);
      let total = 0;
      let maxRev = 0;
      for (const table of childrenFirst(targets, incoming)) {
        const referenced = (incoming.get(table) ?? []).map(
          (fk) => sql`not exists (select 1 from ${sql.table(fk.child)} as c
            where ${sql.ref(`c.${fk.from}`)} = ${sql.ref(`${table}.${fk.to}`)})`,
        );
        const conditions = [
          sql`deleted_at is not null`,
          sql`deleted_at < ${tombstonesBefore}`,
          ...referenced,
        ];
        const deleted = await sql<{ rev: number }>`delete from ${sql.table(table)}
          where ${sql.join(conditions, sql` and `)} returning rev`.execute(trx);
        total += deleted.rows.length;
        for (const { rev } of deleted.rows) maxRev = Math.max(maxRev, rev);
      }
      if (maxRev > 0) {
        await trx
          .updateTable('serverMeta')
          .set({ tombstonePurgeRev: sql<number>`max(tombstone_purge_rev, ${maxRev})` })
          .where('id', '=', 1)
          .execute();
      }
      const ops = await trx.deleteFrom('appliedOp').where('appliedAt', '<', opsBefore).executeTakeFirst();
      return total + Number(ops.numDeletedRows);
    });
    deps.logger.info('sync purge', { job: 'sync-purge', count });
  },
};
