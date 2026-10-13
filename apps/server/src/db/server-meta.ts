import type { Clock, IdGen } from '../deps';
import type { DbExecutor } from './schema';

export interface ServerMeta {
  serverEpoch: string;
  epochStartedAt: string;
  epochBaseRev: number;
  syncCounter: number;
  tombstonePurgeRev: number;
  catalogVersion: string | null;
  catalogUpdatedAt: string | null;
}

export async function getServerMeta(db: DbExecutor): Promise<ServerMeta> {
  const row = await db
    .selectFrom('serverMeta')
    .select([
      'serverEpoch',
      'epochStartedAt',
      'epochBaseRev',
      'syncCounter',
      'tombstonePurgeRev',
      'catalogVersion',
      'catalogUpdatedAt',
    ])
    .where('id', '=', 1)
    .executeTakeFirst();
  if (!row) throw new Error("server_meta absent : la base n'est pas initialisée.");
  return row;
}

/** Pose la ligne unique de server_meta : nouvelle époque (UUIDv7), compteurs à zéro. */
export async function initServerMeta(
  db: DbExecutor,
  deps: { ids: IdGen; clock: Clock },
): Promise<ServerMeta> {
  await db
    .insertInto('serverMeta')
    .values({
      id: 1,
      serverEpoch: deps.ids.uuidv7(),
      epochStartedAt: deps.clock.now().toISOString(),
      epochBaseRev: 0,
      syncCounter: 0,
      tombstonePurgeRev: 0,
      catalogVersion: null,
      catalogUpdatedAt: null,
    })
    .execute();
  return getServerMeta(db);
}
