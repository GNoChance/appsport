import {
  ApiErrorBody,
  type ApiErrorCode,
  PROTOCOL_HEADER,
  SYNC_PROTOCOL,
  SYNC_TIMEOUT_MS,
} from '@appsport/contracts';
import type { z } from 'zod';
import { fetchJsonWithTimeout, type JsonReply, OfflineError, type SyncTransport } from '../sync/transport';

/** Réponse HTTP en erreur ; `code` = champ `error` du corps (`internal` s'il est illisible). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly body: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Serveur injoignable ou muet : une action de classe E (API en ligne) n'est pas possible. */
export class NetworkRequiredError extends Error {
  constructor() {
    super('Nécessite le réseau');
    this.name = 'NetworkRequiredError';
  }
}

export interface ApiClient {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  send<T = void>(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
  ): Promise<T>;
}

export interface ApiHooks {
  onUnauthenticated(): void;
  onAccountDeleted(): void;
}

function apiErrorOf(reply: JsonReply): ApiError {
  const parsed = ApiErrorBody.safeParse(reply.body);
  if (!parsed.success) return new ApiError(reply.res.status, 'internal', {});
  return new ApiError(reply.res.status, parsed.data.error, parsed.data);
}

/**
 * Client de l'API en ligne. L'échéance couvre la lecture du corps ; le client agit sur le code
 * `error`, jamais sur le seul statut (`401 invalid_credentials` n'est pas une session perdue).
 */
export function createApiClient(
  t: SyncTransport,
  hooks: ApiHooks,
  opts: { timeoutMs?: number } = {},
): ApiClient {
  const timeoutMs = opts.timeoutMs ?? SYNC_TIMEOUT_MS;

  async function request<T>(init: RequestInit, path: string, schema?: z.ZodType<T>): Promise<T> {
    let reply: JsonReply;
    try {
      reply = await fetchJsonWithTimeout(t, path, init, timeoutMs);
    } catch (error) {
      if (error instanceof OfflineError) throw new NetworkRequiredError();
      throw error;
    }
    if (!reply.res.ok) {
      const error = apiErrorOf(reply);
      if (error.code === 'unauthenticated') hooks.onUnauthenticated();
      if (error.code === 'account_deleted') hooks.onAccountDeleted();
      throw error;
    }
    return (schema ? schema.parse(reply.body) : undefined) as T;
  }

  return {
    get(path, schema) {
      return request(
        { method: 'GET', credentials: 'same-origin', headers: { [PROTOCOL_HEADER]: String(SYNC_PROTOCOL) } },
        path,
        schema,
      );
    },
    send(method, path, body, schema) {
      return request(
        {
          method,
          credentials: 'same-origin',
          headers: { [PROTOCOL_HEADER]: String(SYNC_PROTOCOL), 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        },
        path,
        schema,
      );
    },
  };
}
