import { type EntityRule, EXPORT_FORMAT, type ExportV1, rowToCamel } from '@appsport/contracts';
import { type RawBuilder, sql } from 'kysely';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';

type Row = Record<string, unknown>;

/** Colonnes exportables : celles du registre, hors colonnes secrètes. */
const publicColumns = (rule: EntityRule): string[] =>
  rule.columns.filter((c) => !rule.secretColumns.includes(c));

async function select(
  db: DbExecutor,
  table: string,
  rule: EntityRule,
  where: RawBuilder<unknown>,
): Promise<Row[]> {
  const columns = sql.join(publicColumns(rule).map((c) => sql.ref(c)));
  const result =
    await sql<Row>`select ${columns} from ${sql.table(table)} where ${where} order by rowid`.execute(db);
  return result.rows.map((r) => rowToCamel(r));
}

/**
 * Export `appsport-export/1` (R-EXP-1) : le compte, puis chaque table `exported` du registre dont la
 * colonne propriétaire est `owner_id` ou `user_id`, sans colonne secrète ; les sessions n'en font
 * pas partie (R-EXP-2). Les salles sont celles d'un lieu de l'utilisateur (supprimé compris), créées
 * par lui ou dont il a écrit l'historique.
 */
export async function buildExport(db: DbExecutor, deps: AppDeps, userId: string): Promise<ExportV1> {
  const rules = deps.entityRules;
  const userRule = rules.user;
  const gymRule = rules.gym;
  const historyRule = rules.gym_history;
  if (!userRule || !gymRule || !historyRule) throw new Error('Registre entityRules incomplet.');

  const [account] = await select(db, 'user', userRule, sql`id = ${userId}`);
  if (!account) throw httpError('not_found');

  const tables: Record<string, Row[]> = {};
  for (const [table, rule] of Object.entries(rules)) {
    if (!rule.exported || table === 'user') continue;
    if (rule.ownerColumn !== 'owner_id' && rule.ownerColumn !== 'user_id') continue;
    tables[table] = await select(db, table, rule, sql`${sql.ref(rule.ownerColumn)} = ${userId}`);
  }

  const gyms = await select(
    db,
    'gym',
    gymRule,
    sql`id in (select gym_id from place where owner_id = ${userId} and gym_id is not null)
      or created_by = ${userId}
      or id in (select gym_id from gym_history where author_id = ${userId})`,
  );
  const gymHistory = await select(db, 'gym_history', historyRule, sql`author_id = ${userId}`);

  return {
    format: EXPORT_FORMAT,
    exportedAt: deps.clock.now().toISOString(),
    account,
    tables,
    gyms,
    gymHistory,
  };
}
