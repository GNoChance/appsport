import { IllustrationRef } from '@appsport/contracts';
import { z } from 'zod';
import type { AppDb } from '../local-db/db';
import { getMeta, setMeta } from '../local-db/meta';
import { postToSw } from '../sw/sw-client';
import { fetchJsonWithTimeout, type SyncTransport } from './transport';

/** Budget du catalogue, corps compris : plus long que celui des appels de synchro. */
export const CATALOG_TIMEOUT_MS = 30_000;

const Item = z.looseObject({ id: z.string() });
const LocalCatalog = z.object({
  version: z.string(),
  exercises: z.array(Item),
  illustrations: z.array(IllustrationRef),
  programTemplates: z.array(Item),
  adviceSheets: z.array(Item),
});

/**
 * Catalogue (classe C) par ETag : 304 → inchangé ; 200 → les quatre magasins remplacés en une
 * transaction, versions locales alignées, puis le SW est prié de mettre les illustrations en cache.
 */
export async function refreshCatalog(db: AppDb, t: SyncTransport): Promise<'unchanged' | 'updated'> {
  const current = await getMeta(db, 'catalogVersion');
  const headers: Record<string, string> = current === undefined ? {} : { 'If-None-Match': `"${current}"` };
  const { res, body } = await fetchJsonWithTimeout(
    t,
    '/api/catalog',
    { method: 'GET', headers },
    CATALOG_TIMEOUT_MS,
  );
  if (res.status === 304) return 'unchanged';
  if (res.status !== 200) throw new Error(`catalog_http_${res.status}`);
  const bundle = LocalCatalog.parse(body);

  await db.transaction(
    'rw',
    ['exercises', 'illustrations', 'programTemplates', 'adviceSheets', 'meta'],
    async () => {
      for (const store of ['exercises', 'illustrations', 'programTemplates', 'adviceSheets'] as const) {
        await db.table(store).clear();
        await db.table(store).bulkPut(bundle[store]);
      }
      await setMeta(db, 'catalogVersion', bundle.version);
      await setMeta(db, 'serverCatalogVersion', bundle.version);
    },
  );
  postToSw({ type: 'SYNC_ILLUSTRATIONS', files: bundle.illustrations.map((i) => i.file) });
  return 'updated';
}
