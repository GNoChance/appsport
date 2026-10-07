import { COMMON_PASSWORDS_RAW } from './common-passwords-list';

/** Une entrée par ligne ; lignes vides et commentaires (#) ignorés ; minuscules. */
export function parseCommonPasswords(raw: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    if (line === '' || line.startsWith('#')) continue;
    out.add(line.toLowerCase());
  }
  return out;
}

export const COMMON_PASSWORDS: ReadonlySet<string> = parseCommonPasswords(COMMON_PASSWORDS_RAW);
