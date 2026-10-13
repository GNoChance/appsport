/** 'training_profile' → 'trainingProfile'. */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** 'usernameKey' → 'username_key'. */
export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convertit les clés d'une ligne SQL (snake_case) en camelCase. */
export function rowToCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [snakeToCamel(k), v])) as T;
}
