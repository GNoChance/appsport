import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app-env';
import type { AppConfig } from '../config';
import { httpError } from './errors';

const ORIGIN_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/** CSRF : Origin exacte sur les écritures, JSON obligatoire. Les en-têtes d'identité du proxy ne sont jamais lus. */
export function originGuard(config: AppConfig): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const method = c.req.method;
    if (ORIGIN_METHODS.has(method) && c.req.header('Origin') !== config.appOrigin) {
      throw httpError('origin_mismatch');
    }
    if (JSON_METHODS.has(method)) {
      const mediaType = (c.req.header('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase();
      if (mediaType !== 'application/json') throw httpError('unsupported_media_type');
    }
    await next();
  };
}
