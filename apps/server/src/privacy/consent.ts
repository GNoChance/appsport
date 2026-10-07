import {
  type EntityRule,
  type LimitationInput,
  type LimitationPatch,
  SYNC_COLUMNS,
} from '@appsport/contracts';
import { type RawBuilder, sql, type Transaction } from 'kysely';
import { logSecurityEvent } from '../auth/security-log';
import { writeStamp } from '../db/rev';
import type { Database, DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { type ConsentType, getConsentState, isHealthConsentActive } from './consent-state';

export type HealthWithdrawHook = (trx: Transaction<Database>, deps: AppDeps, userId: string) => Promise<void>;
export type HealthWithdrawHooks = Readonly<Record<string /* table SQL */, HealthWithdrawHook>>;

/** Vide au socle ; une entrée remplace la règle générique du retrait pour sa table (briques 3 et 5, 09 §8). */
export const HEALTH_WITHDRAW_HOOKS: HealthWithdrawHooks = {};

const SYNC: readonly string[] = SYNC_COLUMNS;

/** Dernier accord du type (created_at, puis rev), ou undefined. */
export async function latestGrant(
  db: DbExecutor,
  userId: string,
  type: ConsentType,
): Promise<{ textVersion: string; createdAt: string } | undefined> {
  return db
    .selectFrom('consentEvent')
    .select(['textVersion', 'createdAt'])
    .where('ownerId', '=', userId)
    .where('type', '=', type)
    .where('action', '=', 'grant')
    .orderBy('createdAt', 'desc')
    .orderBy('rev', 'desc')
    .limit(1)
    .executeTakeFirst();
}

async function insertConsentEvent(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  type: ConsentType,
  action: 'grant' | 'withdraw',
  textVersion: string,
): Promise<void> {
  const stamp = await writeStamp(trx, deps, userId);
  await trx
    .insertInto('consentEvent')
    .values({
      id: deps.ids.uuidv7(),
      ownerId: userId,
      type,
      action,
      textVersion,
      createdAt: stamp.updatedAt,
      ...stamp,
    })
    .execute();
}

/** R-CST-1 : un accord identique à l'accord actif n'écrit rien. La version est validée par l'appelant. */
export async function grantConsent(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  type: ConsentType,
  textVersion: string,
  ip: string | null,
): Promise<void> {
  const current = (await getConsentState(trx, userId))[type === 'health' ? 'health' : 'aiCoach'];
  if (current.active && current.textVersion === textVersion) return;
  await insertConsentEvent(trx, deps, userId, type, 'grant', textVersion);
  await logSecurityEvent(trx, deps, {
    type: 'consent_granted',
    actorId: userId,
    targetId: userId,
    ip,
    outcome: 'success',
    details: { consentType: type },
  });
}

type Row = { rid: number };

async function stampRows(
  trx: Transaction<Database>,
  deps: AppDeps,
  table: string,
  actorId: string | null,
  rows: Row[],
  set: (stamp: { rev: number; updatedAt: string; updatedBy: string | null }) => RawBuilder<unknown>,
): Promise<void> {
  for (const { rid } of rows) {
    const stamp = await writeStamp(trx, deps, actorId);
    await sql`update ${sql.table(table)} set ${set(stamp)}, rev = ${stamp.rev}, updated_at = ${stamp.updatedAt}, updated_by = ${stamp.updatedBy} where rowid = ${rid}`.execute(
      trx,
    );
  }
}

/**
 * Règle générique du retrait pour une table liée au propriétaire :
 * C2 → contenu à NULL et tombstone ; sinon `c2Columns` à NULL et valeurs `c2Values` effacées.
 */
async function clearTable(
  trx: Transaction<Database>,
  deps: AppDeps,
  table: string,
  rule: EntityRule,
  userId: string,
  actorId: string | null,
): Promise<void> {
  if (rule.ownerColumn === null) return;
  const owner = sql`${sql.ref(rule.ownerColumn)} = ${userId}`;
  const isNull = (cols: readonly string[]) => cols.map((c) => sql`${sql.ref(c)} = null`);

  if (rule.category === 'C2') {
    const content = rule.columns.filter((c) => c !== 'id' && !SYNC.includes(c));
    const full = content.map((c) => sql`${sql.ref(c)} is not null`);
    const rows =
      await sql<Row>`select rowid as rid from ${sql.table(table)} where ${owner} and (deleted_at is null${
        full.length > 0 ? sql` or ${sql.join(full, sql` or `)}` : sql``
      })`.execute(trx);
    await stampRows(trx, deps, table, actorId, rows.rows, (stamp) =>
      sql.join([...isNull(content), sql`deleted_at = coalesce(deleted_at, ${stamp.updatedAt})`]),
    );
    return;
  }

  const values = Object.entries(rule.c2Values ?? {});
  if (rule.c2Columns.length === 0 && values.length === 0) return;
  const concerned = [
    ...rule.c2Columns.map((c) => sql`${sql.ref(c)} is not null`),
    ...values.map(([c, listed]) => sql`${sql.ref(c)} in (${sql.join([...listed])})`),
  ];
  const rows = await sql<Row>`select rowid as rid from ${sql.table(table)} where ${owner} and (${sql.join(
    concerned,
    sql` or `,
  )})`.execute(trx);
  await stampRows(trx, deps, table, actorId, rows.rows, () =>
    sql.join([
      ...isNull(rule.c2Columns),
      ...values.map(
        ([c, listed]) =>
          sql`${sql.ref(c)} = case when ${sql.ref(c)} in (${sql.join([...listed])}) then null else ${sql.ref(c)} end`,
      ),
    ]),
  );
}

/**
 * Retrait du consentement santé (R-CST-5, P-CST-3, 09 §8) : n'agit que si l'accord est actif.
 * Efface les données C2 de l'utilisateur, garde `cautious_mode`, n'écrit aucune valeur de contenu au journal.
 */
export async function withdrawHealthConsent(
  trx: Transaction<Database>,
  deps: AppDeps,
  userId: string,
  actor: { actorId: string | null; ip: string | null },
  opts: { replay?: boolean; hooks?: HealthWithdrawHooks } = {},
): Promise<void> {
  if (!(await isHealthConsentActive(trx, userId))) return;
  const hooks = opts.hooks ?? HEALTH_WITHDRAW_HOOKS;
  for (const hook of Object.values(hooks)) await hook(trx, deps, userId);
  for (const [table, rule] of Object.entries(deps.entityRules)) {
    if (table in hooks) continue;
    await clearTable(trx, deps, table, rule, userId, actor.actorId);
  }
  const grant = await latestGrant(trx, userId, 'health');
  await insertConsentEvent(trx, deps, userId, 'health', 'withdraw', grant?.textVersion ?? '');
  await logSecurityEvent(trx, deps, {
    type: 'consent_revoked',
    actorId: actor.actorId,
    targetId: userId,
    ip: actor.ip,
    outcome: 'success',
    details: { consentType: 'health', ...(opts.replay ? { replay: true } : {}) },
  });
}

/**
 * Garde C2 (R-CST-4, P-CST-2). Les routes l'appliquent avant parseJson (ordre des erreurs) ;
 * chaque écriture C2 la relit en premier dans sa transaction, pour qu'un retrait validé entre-temps
 * ne laisse ni ressusciter un questionnaire ni écrire une limitation sans accord.
 */
export async function assertHealthConsent(db: DbExecutor, userId: string): Promise<void> {
  if (!(await isHealthConsentActive(db, userId))) throw httpError('health_consent_required');
}

/** Upsert du questionnaire sur id = owner_id ; réactive la tombstone d'un retrait antérieur. */
export async function saveHealthScreening(
  trx: Transaction<Database>,
  deps: AppDeps,
  userId: string,
  input: { caution: boolean; questionnaireVersion: string },
): Promise<void> {
  await assertHealthConsent(trx, userId);
  const stamp = await writeStamp(trx, deps, userId);
  const content = {
    caution: input.caution ? 1 : 0,
    questionnaireVersion: input.questionnaireVersion,
    answeredAt: stamp.updatedAt,
    deletedAt: null,
    ...stamp,
  };
  await trx
    .insertInto('healthScreening')
    .values({ id: userId, ownerId: userId, createdAt: stamp.updatedAt, ...content })
    .onConflict((oc) => oc.column('id').doUpdateSet(content))
    .execute();
}

export async function createLimitation(
  trx: Transaction<Database>,
  deps: AppDeps,
  userId: string,
  input: LimitationInput,
): Promise<string> {
  await assertHealthConsent(trx, userId);
  const id = deps.ids.uuidv7();
  const stamp = await writeStamp(trx, deps, userId);
  await trx
    .insertInto('limitation')
    .values({
      id,
      ownerId: userId,
      createdAt: stamp.updatedAt,
      bodyArea: input.bodyArea,
      side: input.side,
      severity: input.severity,
      note: input.note ?? null,
      active: input.active === false ? 0 : 1,
      ...stamp,
    })
    .execute();
  return id;
}

/** La route a vérifié que la limitation est vivante et à l'utilisateur. */
export async function updateLimitation(
  trx: Transaction<Database>,
  deps: AppDeps,
  userId: string,
  id: string,
  patch: LimitationPatch,
): Promise<void> {
  await assertHealthConsent(trx, userId);
  const { active, ...rest } = patch;
  const stamp = await writeStamp(trx, deps, userId);
  await trx
    .updateTable('limitation')
    .set({ ...rest, ...(active === undefined ? {} : { active: active ? 1 : 0 }), ...stamp })
    .where('id', '=', id)
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .execute();
}

/** Tombstone sans contenu (R-SYN-9, P-CST-3). */
export async function deleteLimitation(
  trx: Transaction<Database>,
  deps: AppDeps,
  userId: string,
  id: string,
): Promise<void> {
  await assertHealthConsent(trx, userId);
  const stamp = await writeStamp(trx, deps, userId);
  await trx
    .updateTable('limitation')
    .set({
      bodyArea: null,
      side: null,
      severity: null,
      note: null,
      active: null,
      deletedAt: stamp.updatedAt,
      ...stamp,
    })
    .where('id', '=', id)
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .execute();
}
