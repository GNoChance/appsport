import { createMonotonicUuidV7 } from '@appsport/domain';
import type { IdGen } from '../../src/deps';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UUIDv7 monotones et déterministes : horloge fixe (+1 ms par appel), aléa seedé. Un générateur par base. */
export function seqIds(seed = 1): IdGen {
  const rand = mulberry32(seed);
  const bytes = (n: number): Uint8Array => Uint8Array.from({ length: n }, () => Math.floor(rand() * 256));
  let ms = new Date('2026-10-06T10:00:00.000Z').getTime();
  return { uuidv7: createMonotonicUuidV7(() => ms++, bytes), randomBytes: bytes };
}
