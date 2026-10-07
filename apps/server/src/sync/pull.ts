import {
  COLUMN_CODECS,
  type ColumnCodec,
  decodeWatermark,
  type EntityRule,
  encodeWatermark,
  type PulledRow,
  type PullResponse,
  snakeToCamel,
} from '@appsport/contracts';
import { type RawBuilder, sql, type Transaction } from 'kysely';
import type { SessionUser } from '../app-env';
import type { Database } from '../db/schema';
import { getServerMeta } from '../db/server-meta';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';

type Raw = Record<string, unknown>;

interface Source {
  entity: string;
  rule: EntityRule;
  columns: readonly string[];
  scope: RawBuilder<unknown>;
}

const MIRRORED = new Set(['J', 'D', 'E']);

/** Tables du périmètre de l'utilisateur (R-SYN-21) : ses lignes J/D/E, et les tables C0 partagées. */
function sourcesFor(deps: AppDeps, userId: string): Source[] {
  const sources: Source[] = [];
  for (const [entity, rule] of Object.entries(deps.entityRules)) {
    if (!MIRRORED.has(rule.syncClass)) continue;
    let scope: RawBuilder<unknown>;
    if (rule.ownerColumn !== null) scope = sql`${sql.ref(rule.ownerColumn)} = ${userId}`;
    else if (rule.category === 'C0') scope = sql`1 = 1`;
    else continue;
    const columns = rule.columns.filter((c) => !rule.secretColumns.includes(c));
    sources.push({ entity, rule, columns, scope });
  }
  return sources;
}

function decode(codec: ColumnCodec | undefined, value: unknown): unknown {
  if (value === null || value === undefined || codec === undefined) return value ?? null;
  return codec === 'boolean' ? value === 1 : JSON.parse(String(value));
}

/** Ligne SQL → ligne de pull : camelCase, sans secret, codecs appliqués, `deletedAt` toujours présent. */
function toPulled(source: Source, raw: Raw): PulledRow {
  const codecs = COLUMN_CODECS[source.entity] ?? {};
  const row: Raw = { deletedAt: null };
  for (const column of source.columns) {
    const key = snakeToCamel(column);
    row[key] = decode(codecs[column], raw[key]);
  }
  return { entity: source.entity, rev: Number(row.rev), row };
}

async function selectRows(
  trx: Transaction<Database>,
  source: Source,
  revFilter: RawBuilder<unknown>,
  limit?: number,
): Promise<PulledRow[]> {
  const columns = sql.join(source.columns.map((c) => sql.ref(c)));
  const tail = limit === undefined ? sql`` : sql`limit ${limit}`;
  const result = await sql<Raw>`select ${columns} from ${sql.table(source.entity)}
    where ${source.scope} and ${revFilter} order by rev ${tail}`.execute(trx);
  return result.rows.map((r) => toPulled(source, r));
}

async function hasRowsAfter(trx: Transaction<Database>, sources: Source[], rev: number): Promise<boolean> {
  for (const s of sources) {
    const more =
      await sql`select 1 from ${sql.table(s.entity)} where ${s.scope} and rev > ${rev} limit 1`.execute(trx);
    if (more.rows.length > 0) return true;
  }
  return false;
}

const byRev = (a: PulledRow, b: PulledRow) =>
  a.rev - b.rev || a.entity.localeCompare(b.entity) || String(a.row.id).localeCompare(String(b.row.id));

/**
 * Page de pull (R-SYN-20, R-SYN-21, R-SYN-23) lue dans une seule transaction : lignes de rev > since,
 * triées, `limit` au plus, sans jamais couper un groupe de même rev.
 */
export async function buildPull(
  deps: AppDeps,
  user: SessionUser,
  since: string | null,
  limit: number,
): Promise<PullResponse> {
  let sinceWatermark: { epoch: string; rev: number } | null = null;
  if (since !== null) {
    sinceWatermark = decodeWatermark(since);
    if (!sinceWatermark) throw httpError('validation');
  }
  return deps.db.transaction().execute(async (trx) => {
    const meta = await getServerMeta(trx);
    if (
      sinceWatermark &&
      (sinceWatermark.epoch !== meta.serverEpoch || sinceWatermark.rev < meta.tombstonePurgeRev)
    ) {
      throw httpError('watermark_expired');
    }
    const sinceRev = sinceWatermark?.rev ?? 0;
    const sources = sourcesFor(deps, user.id);

    const candidates: PulledRow[] = [];
    for (const s of sources)
      candidates.push(...(await selectRows(trx, s, sql`rev > ${sinceRev}`, limit + 1)));
    candidates.sort(byRev);
    let rows = candidates.slice(0, limit);
    const last = rows.at(-1);
    let hasMore = false;
    if (last && candidates.length > limit) {
      // Le groupe du dernier rev gardé est relu en entier dans chaque table.
      const group: PulledRow[] = [];
      for (const s of sources) group.push(...(await selectRows(trx, s, sql`rev = ${last.rev}`)));
      rows = [...rows.filter((r) => r.rev !== last.rev), ...group.sort(byRev)];
      hasMore = await hasRowsAfter(trx, sources, last.rev);
    }
    const nextRev = hasMore && last ? last.rev : Math.max(sinceRev, meta.syncCounter);
    return {
      rows,
      nextWatermark: encodeWatermark(meta.serverEpoch, nextRev),
      hasMore,
      catalogVersion: meta.catalogVersion,
    };
  });
}
