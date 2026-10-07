import { camelToSnake, type EntityRule } from '@appsport/contracts';

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
