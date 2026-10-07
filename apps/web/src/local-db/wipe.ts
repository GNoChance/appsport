import { camelToSnake, type EntityRule, type EntityRulesMap, entityRules } from '@appsport/contracts';
import { type AppDb, mirrorStoreNames } from './db';
import { USER_META_KEYS } from './meta';

/** Valeur de santé dans une table non C2 : colonne `c2Columns`, ou valeur `c2Values` (clé camelCase). */
export function isC2Value(rule: EntityRule, key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const column = camelToSnake(key);
  if (rule.c2Columns.includes(column)) return true;
  const values = rule.c2Values && Object.hasOwn(rule.c2Values, column) ? rule.c2Values[column] : undefined;
  return typeof value === 'string' && values !== undefined && values.includes(value);
}

/** Champs sans leurs valeurs de santé ; `stripped` dit si une clé a été retirée. */
export function stripC2Fields(
  rule: EntityRule,
  fields: Record<string, unknown>,
): { fields: Record<string, unknown>; stripped: boolean } {
  const kept = Object.fromEntries(Object.entries(fields).filter(([k, v]) => !isC2Value(rule, k, v)));
  return { fields: kept, stripped: Object.keys(kept).length !== Object.keys(fields).length };
}

/** Efface les données de l'utilisateur ; l'appareil (deviceId) et le catalogue restent. */
export async function wipeUserData(db: AppDb, opts: { keepOutbox: boolean }): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const store of mirrorStoreNames(db)) await db.mirror(store).clear();
    await db.meta.bulkDelete([...USER_META_KEYS]);
    if (!opts.keepOutbox) {
      await db.outbox.clear();
      await db.deadletter.clear();
    }
  });
}

/** Vide les miroirs seuls (pull complet après `watermark_expired`). */
export async function clearMirrors(db: AppDb): Promise<void> {
  const stores = mirrorStoreNames(db);
  await db.transaction(
    'rw',
    stores.map((s) => db.mirror(s)),
    async () => {
      for (const store of stores) await db.mirror(store).clear();
    },
  );
}

/**
 * Retrait de l'accord santé (P-CST-3 étape 4), en une transaction : miroirs C2 vidés, valeurs C2
 * mises à null ailleurs ; ops sur une table C2 supprimées, clés C2 retirées des autres (un patch
 * vidé est supprimé) ; deadletter des tables C2 supprimée.
 */
export async function purgeHealthData(
  db: AppDb,
  rules: EntityRulesMap = entityRules,
): Promise<{ rowsCleared: number; opsRemoved: number; opsStripped: number }> {
  const ruleOf = (entity: string): EntityRule | undefined =>
    Object.hasOwn(rules, entity) ? rules[entity] : undefined;
  let rowsCleared = 0;
  let opsRemoved = 0;
  let opsStripped = 0;
  await db.transaction('rw', db.tables, async () => {
    for (const store of mirrorStoreNames(db)) {
      const rule = ruleOf(store);
      if (!rule) continue;
      const table = db.mirror(store);
      if (rule.category === 'C2') {
        rowsCleared += await table.count();
        await table.clear();
        continue;
      }
      if (rule.c2Columns.length === 0 && !rule.c2Values) continue;
      for (const row of await table.toArray()) {
        const changes = Object.fromEntries(
          Object.entries(row)
            .filter(([k, v]) => isC2Value(rule, k, v))
            .map(([k]) => [k, null]),
        );
        if (Object.keys(changes).length === 0) continue;
        await table.put({ ...row, ...changes });
        rowsCleared += 1;
      }
    }

    for (const op of await db.outbox.toArray()) {
      const rule = ruleOf(op.entity);
      if (!rule) continue;
      if (rule.category === 'C2') {
        await db.outbox.delete(op.opId);
        opsRemoved += 1;
        continue;
      }
      const { fields, stripped } = stripC2Fields(rule, op.fields);
      if (!stripped) continue;
      if (op.kind === 'patch' && Object.keys(fields).length === 0) {
        await db.outbox.delete(op.opId);
        opsRemoved += 1;
      } else {
        await db.outbox.put({ ...op, fields });
        opsStripped += 1;
      }
    }

    const c2Entities = Object.keys(rules).filter((e) => ruleOf(e)?.category === 'C2');
    await db.deadletter.filter((d) => c2Entities.includes(d.entity)).delete();
  });
  return { rowsCleared, opsRemoved, opsStripped };
}
