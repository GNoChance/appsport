import { MIN_PROTOCOL, PROTOCOL_HEADER, SYNC_PROTOCOL } from '@appsport/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app-env';
import { httpError } from '../http/errors';

/** R-VER-1, R-VER-2 : `X-Appsport-Protocol` entier dans [MIN_PROTOCOL, SYNC_PROTOCOL], sinon 426. */
export const protocolGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = c.req.header(PROTOCOL_HEADER) ?? '';
  const version = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!(version >= MIN_PROTOCOL && version <= SYNC_PROTOCOL)) {
    throw httpError('protocol_unsupported', { serverProtocol: SYNC_PROTOCOL, minProtocol: MIN_PROTOCOL });
  }
  await next();
};
