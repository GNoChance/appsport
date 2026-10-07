import { SECRET_CODE_LENGTH } from '@appsport/contracts';

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Encode des octets par groupes de 5 bits (10 octets, soit 16 caractères). */
export function encodeCrockford(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD_ALPHABET[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD_ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/** Lien complet ou code saisi, vers la forme canonique, ou null. */
export function parseSecretCode(input: string): string | null {
  const tail = input.slice(input.lastIndexOf('#') + 1);
  const code = tail.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (code.length !== SECRET_CODE_LENGTH) return null;
  for (const ch of code) if (!CROCKFORD_ALPHABET.includes(ch)) return null;
  return code;
}

export function formatSecretCode(canonical: string): string {
  return canonical.match(/.{1,4}/g)?.join('-') ?? canonical;
}
