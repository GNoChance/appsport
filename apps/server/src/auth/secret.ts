import { createHash } from 'node:crypto';
import { encodeCrockford, formatSecretCode } from '@appsport/domain';
import type { IdGen } from '../deps';

/** sha256 hexadécimal (codes secrets et jetons de session). */
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createSecretCode(ids: IdGen): { canonical: string; formatted: string; hash: string } {
  const canonical = encodeCrockford(ids.randomBytes(10));
  return { canonical, formatted: formatSecretCode(canonical), hash: hashSecret(canonical) };
}
