import { RESERVED_USERNAMES, USERNAME_MAX, USERNAME_MIN } from '@appsport/contracts';

/** Clé de comparaison : NFKC puis minuscules. */
export function usernameKey(username: string): string {
  return username.normalize('NFKC').toLowerCase();
}

export type UsernameCheck = { ok: true } | { ok: false; reason: 'length' | 'characters' | 'reserved' };

const ALLOWED = /^[\p{Script=Latin}\p{Nd}._-]+$/u;

/** Contrôle sur la forme NFC ; écriture latine seule (contre les homoglyphes), pas de trim. */
export function validateUsername(username: string): UsernameCheck {
  const n = username.normalize('NFC');
  const length = [...n].length;
  if (length < USERNAME_MIN || length > USERNAME_MAX) return { ok: false, reason: 'length' };
  if (!ALLOWED.test(n)) return { ok: false, reason: 'characters' };
  const bare = usernameKey(n).normalize('NFD').replace(/\p{M}/gu, '');
  if ((RESERVED_USERNAMES as readonly string[]).includes(bare)) return { ok: false, reason: 'reserved' };
  return { ok: true };
}
