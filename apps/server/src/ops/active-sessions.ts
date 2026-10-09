import type { DatabaseSync } from 'node:sqlite';

export interface ActiveWorkoutSession {
  username: string;
  startedAt: string;
}

/**
 * Séances `in_progress`, non supprimées, démarrées depuis moins de `maxAgeHours`, triées par début : affichées
 * par `appsport-update` avant de demander confirmation (R-DEP-3). Le socle n'a pas la table `workout_session`
 * (brique 2) : liste vide.
 */
export function listActiveWorkoutSessions(
  sqlite: DatabaseSync,
  now: Date,
  maxAgeHours = 3,
): ActiveWorkoutSession[] {
  const table = sqlite
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'workout_session'")
    .get();
  if (!table) return [];
  const since = new Date(now.getTime() - maxAgeHours * 3_600_000).toISOString();
  const rows = sqlite
    .prepare(
      `SELECT u.username AS username, w.started_at AS startedAt
       FROM workout_session w JOIN user u ON u.id = w.owner_id
       WHERE w.status = 'in_progress' AND w.deleted_at IS NULL AND w.started_at > ?
       ORDER BY w.started_at, u.username`,
    )
    .all(since);
  return rows.map((row) => ({ username: String(row.username), startedAt: String(row.startedAt) }));
}
