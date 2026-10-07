const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_UNIX_MS = 2 ** 48;

export function isUuidV7(s: string): boolean {
  return UUID_V7.test(s);
}

/** UUIDv7 (RFC 9562) : 48 bits d'horodatage, puis aléa (≥ 10 octets) avec version et variante. */
export function createUuidV7(unixMs: number, random: Uint8Array): string {
  if (!Number.isInteger(unixMs) || unixMs < 0 || unixMs >= MAX_UNIX_MS) {
    throw new RangeError('unixMs hors de [0, 2^48)');
  }
  if (random.length < 10) throw new RangeError('au moins 10 octets aléatoires requis');
  const r = (i: number) => random[i] as number;
  const bytes = new Uint8Array(16);
  let ms = unixMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = 0x70 | (r(0) & 0x0f);
  bytes[7] = r(1);
  bytes[8] = 0x80 | (r(2) & 0x3f);
  for (let i = 3; i < 10; i++) bytes[6 + i] = r(i);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Générateur strictement croissant (RFC 9562 méthode 1 : compteur sur rand_a), même si l'horloge recule. */
export function createMonotonicUuidV7(now: () => number, random: (n: number) => Uint8Array): () => string {
  let lastMs = -1;
  let seq = 0;
  return () => {
    const t = Math.floor(now());
    if (t > lastMs) {
      lastMs = t;
      const r = random(2);
      seq = (((r[0] as number) & 0x07) << 8) | (r[1] as number);
    } else {
      seq += 1;
      if (seq > 0xfff) {
        lastMs += 1;
        seq = 0;
      }
    }
    return createUuidV7(lastMs, Uint8Array.of(seq >> 8, seq & 0xff, ...random(8)));
  };
}
