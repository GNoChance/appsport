import type { DatabaseSync } from 'node:sqlite';

/** Instantané de sqlite_schema : tables puis index, par nom, chacun suivi de ';\n'. */
export function dumpSchema(sqlite: DatabaseSync): string {
  const rows = sqlite
    .prepare(
      "SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY (type = 'index'), name",
    )
    .all() as { sql: string }[];
  return rows.map((r) => `${r.sql};\n`).join('');
}
