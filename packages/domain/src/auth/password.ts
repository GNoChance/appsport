import { PASSWORD_MAX, PASSWORD_MIN_ADMIN, PASSWORD_MIN_MEMBER, type Role } from '@appsport/contracts';
import { usernameKey } from './username';

export type PasswordRejection =
  | 'too_short'
  | 'too_long'
  | 'common'
  | 'contains_username'
  | 'contains_appsport'
  | 'single_char';

/** Longueur en points de code, après NFC. */
export function passwordLength(pw: string): number {
  return [...pw.normalize('NFC')].length;
}

export function validatePassword(
  pw: string,
  ctx: { username: string; role: Role; commonPasswords: ReadonlySet<string> },
): { ok: true } | { ok: false; reason: PasswordRejection } {
  const p = pw.normalize('NFC');
  const chars = [...p];
  const min = ctx.role === 'admin' ? PASSWORD_MIN_ADMIN : PASSWORD_MIN_MEMBER;
  if (chars.length < min) return { ok: false, reason: 'too_short' };
  if (chars.length > PASSWORD_MAX) return { ok: false, reason: 'too_long' };
  if (new Set(chars).size === 1) return { ok: false, reason: 'single_char' };
  if (ctx.commonPasswords.has(p.toLowerCase())) return { ok: false, reason: 'common' };
  const key = usernameKey(p);
  const user = usernameKey(ctx.username);
  if (user !== '' && key.includes(user)) return { ok: false, reason: 'contains_username' };
  if (key.includes('appsport')) return { ok: false, reason: 'contains_appsport' };
  return { ok: true };
}
