import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app-env';

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/**
 * Posés après `next()` : couvre aussi les 404 et les réponses de `onError`. Une CSP déjà posée par la route
 * (illustrations, 04 §12) est gardée ; les autres en-têtes sont toujours imposés.
 */
export function securityHeaders(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (name === 'Content-Security-Policy' && c.res.headers.has(name)) continue;
      c.res.headers.set(name, value);
    }
  };
}
