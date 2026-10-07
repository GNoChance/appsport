import { RESERVED_USERNAMES, USERNAME_MAX, USERNAME_MIN } from '@appsport/contracts';

/** Clé de comparaison : NFKC puis minuscules. */
export function usernameKey(username: string): string {
  return username.normalize('NFKC').toLowerCase();
}

export type UsernameCheck = { ok: true } | { ok: false; reason: 'length' | 'characters' | 'reserved' };

const ALLOWED = /^[\p{Script=Latin}0-9._-]+$/u;
const BASE_ASCII = /^[A-Za-z0-9._-]+$/;

/** Contrôle sur la forme NFC ; écriture latine seule (contre les homoglyphes), pas de trim. */
export function validateUsername(username: string): UsernameCheck {
  const n = username.normalize('NFC');
  const length = [...n].length;
  if (length < USERNAME_MIN || length > USERNAME_MAX) return { ok: false, reason: 'length' };
  // Latin seul, et lettres de base ASCII une fois les accents retirés (homoglyphes latins : ɑ, ı, ᴀ, ɨ).
  if (!ALLOWED.test(n) || !BASE_ASCII.test(n.normalize('NFD').replace(/\p{M}/gu, ''))) {
    return { ok: false, reason: 'characters' };
  }
  const bare = usernameKey(n).normalize('NFD').replace(/\p{M}/gu, '');
  if ((RESERVED_USERNAMES as readonly string[]).includes(bare)) return { ok: false, reason: 'reserved' };
  return { ok: true };
}
