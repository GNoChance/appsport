import { type ApiErrorCode, ERROR_STATUS } from '@appsport/contracts';
import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../app-env';
import type { Logger } from '../logger';

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly extra?: Record<string, unknown>;

  constructor(status: number, code: ApiErrorCode, extra?: Record<string, unknown>) {
    super(code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (extra) this.extra = extra;
  }
}

export function httpError(code: ApiErrorCode, extra?: Record<string, unknown>): HttpError {
  return new HttpError(ERROR_STATUS[code], code, extra);
}

/** Les erreurs inattendues ne laissent ni message ni pile : seul le nom de l'erreur est journalisé. */
export function errorHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.code, ...err.extra }, err.status as ContentfulStatusCode);
    }
    logger.error('unhandled_error', { requestId: c.get('requestId'), code: 'internal', event: err.name });
    return c.json({ error: 'internal' }, 500);
  };
}
