import type { DatabaseSync } from 'node:sqlite';

export interface DbStats {
  integrity: string;
  users: number;
  syncCounter: number;
  lastWriteAt: string | null;
}

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

function integrityOf(sqlite: DatabaseSync): string {
  try {
    const rows = sqlite.prepare('PRAGMA integrity_check').all();
    return rows.map((row) => String(row.integrity_check)).join('\n');
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Plus récent `updated_at` de toutes les tables qui l'ont, et `security_event.at` ; null si rien n'est écrit. */
function lastWriteAt(sqlite: DatabaseSync): string | null {
  const tables = sqlite
    .prepare(
      `SELECT m.name AS name FROM sqlite_schema m JOIN pragma_table_info(m.name) p
       WHERE m.type = 'table' AND p.name = 'updated_at' ORDER BY m.name`,
    )
    .all()
    .map((row) => `SELECT max(updated_at) AS v FROM ${quoteIdent(String(row.name))}`);
  const journal = sqlite
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'security_event'")
    .get();
  if (journal) tables.push('SELECT max(at) AS v FROM security_event');
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`SELECT max(v) AS v FROM (${tables.join(' UNION ALL ')})`).get();
  return row?.v == null ? null : String(row.v);
}

/**
 * Bilan d'une base pour le test de restauration (R-OPS-11) : intégrité (lignes de `PRAGMA integrity_check`
 * jointes par \n), comptes, compteur de synchro et dernière écriture. Intégrité KO ou illisible : rien
 * d'autre n'est lu (0, 0, null).
 */
export function dbStats(sqlite: DatabaseSync): DbStats {
  const integrity = integrityOf(sqlite);
  if (integrity !== 'ok') return { integrity, users: 0, syncCounter: 0, lastWriteAt: null };
  const users = sqlite.prepare('SELECT count(*) AS n FROM user').get();
  const meta = sqlite.prepare('SELECT sync_counter AS n FROM server_meta WHERE id = 1').get();
  return {
    integrity,
    users: Number(users?.n ?? 0),
    syncCounter: Number(meta?.n ?? 0),
    lastWriteAt: lastWriteAt(sqlite),
  };
}
