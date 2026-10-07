import { EPOCH_HEADER } from '@appsport/contracts';
import type { MiddlewareHandler } from 'hono';
import type { Kysely } from 'kysely';
import type { AppEnv } from '../app-env';
import type { Database } from '../db/schema';
import { getServerMeta } from '../db/server-meta';

/** Lit l'époque à chaque requête (pas de cache) ; l'en-tête est omis si la lecture échoue. */
export function epochHeader(db: Kysely<Database>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    try {
      const meta = await getServerMeta(db);
      c.res.headers.set(EPOCH_HEADER, meta.serverEpoch);
    } catch {
      // base illisible : pas d'en-tête
    }
  };
}
