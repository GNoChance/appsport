import { isIP } from 'node:net';
import type { Context } from 'hono';
import type { AppEnv } from '../app-env';

function peerAddress(c: Context<AppEnv>): string | null {
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  const raw = env?.incoming?.socket?.remoteAddress;
  if (!raw) return null;
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

function isTrustedProxyPeer(ip: string): boolean {
  if (ip === '::1') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Adresse du client. `tailscale serve` joint le conteneur par docker-proxy : le pair TCP est alors
 * loopback ou le pont Docker, et seul X-Forwarded-For porte l'adresse réelle. Tout autre pair est pris tel quel.
 */
export function clientIp(c: Context<AppEnv>): string | null {
  const peer = peerAddress(c);
  if (peer === null || isTrustedProxyPeer(peer)) {
    const first = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
    if (first) return first;
  }
  return peer;
}

/** Adresse du client si elle est syntaxiquement valide (IPv4 ou IPv6), sinon null : jamais une clé de limiteur arbitraire. */
export function validClientIp(c: Context<AppEnv>): string | null {
  const ip = c.get('clientIp');
  return ip !== null && isIP(ip) !== 0 ? ip : null;
}
