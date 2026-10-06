### Task 8: Règles d'identifiants, codes secrets et Argon2id

**Files:**
- Create: `packages/contracts/src/auth-constants.ts`
- Create: `packages/contracts/src/api/auth.ts` (types de base ; complété par T10, T11, T12, T13)
- Modify: `packages/contracts/src/index.ts` (réexporte `./auth-constants` et `./api/auth`)
- Create: `packages/domain/src/auth/username.ts`, `packages/domain/src/auth/password.ts`, `packages/domain/src/auth/secret-code.ts`
- Modify: `packages/domain/src/index.ts` (réexporte les trois modules)
- Create: `apps/server/src/auth/password-hash.ts`, `apps/server/src/auth/secret.ts`, `apps/server/src/auth/common-passwords.txt`, `apps/server/src/auth/common-passwords.ts`
- Test: `packages/contracts/test/auth-constants.test.ts`, `packages/domain/test/auth/username.test.ts`, `packages/domain/test/auth/password.test.ts`, `packages/domain/test/auth/secret-code.test.ts`, `apps/server/test/auth/password-hash.test.ts`, `apps/server/test/auth/secret.test.ts`, `apps/server/test/auth/common-passwords.test.ts`

**Interfaces:**
- Consumes : `Role` (`packages/contracts/src/constants.ts`, T2) ; `IdGen`, `Argon2Params` (`apps/server/src/deps.ts`, T6) ; `loadConfig` (`apps/server/src/config.ts`, T6) ; `seqIds`, `TEST_ARGON2` (`@appsport/server/testing`, T6).
- Produces :
```ts
// packages/contracts/src/auth-constants.ts
export const INVITATION_TTL_DAYS = 7; export const BOOTSTRAP_INVITATION_TTL_HOURS = 24; export const RESET_TTL_HOURS = 24;
export const SECRET_CODE_LENGTH = 16; export const INVITATION_NOTE_MAX = 60;
export const USERNAME_MIN = 3; export const USERNAME_MAX = 24; export const RESERVED_USERNAMES = ['admin', 'appsport', 'systeme'] as const;
export const PASSWORD_MIN_MEMBER = 12; export const PASSWORD_MIN_ADMIN = 14; export const PASSWORD_MAX = 128;
export const SESSION_IDLE_DAYS = 90; export const SESSION_MAX_DAYS = 365; export const ADMIN_PASSWORD_REMINDER_MONTHS = 12;
// [décision plan] valeurs de 02 R-AUTH-2/3, R-INV-8 et 03 §7, nommées pour T10 à T13
export const LOGIN_LIMITS = { consecutiveThreshold: 5, firstDelayMs: 60_000, maxDelayMs: 900_000,
  hourlyMaxFailures: 10, lockMs: 3_600_000, windowMs: 3_600_000, ipMaxFailuresPerHour: 30 } as const;
export const CODE_CHECKS_PER_HOUR = 20;
export const CLOSED_AUTH_RECORD_RETENTION_DAYS = 30;   // sessions fermées, invitations et liens terminés
export const SECURITY_EVENT_RETENTION_MONTHS = 12;
export const SESSION_TOUCH_INTERVAL_MS = 3_600_000;    // last_seen_at réécrit au plus une fois par heure
// packages/contracts/src/api/auth.ts (base)
export const CivilDate = z.iso.date(); export type CivilDate = z.infer<typeof CivilDate>;     // 'YYYY-MM-DD' valide (pas de 30 février)
export const RoleSchema = z.enum(['admin', 'member']);
export const UserStatusSchema = z.enum(['active', 'disabled']);
export const AgeBandSchema = z.enum(['minor', 'adult']);
// packages/domain/src/auth/username.ts
export function usernameKey(username: string): string;            // username.normalize('NFKC').toLowerCase()
export type UsernameCheck = { ok: true } | { ok: false; reason: 'length' | 'characters' | 'reserved' };
export function validateUsername(username: string): UsernameCheck;
// packages/domain/src/auth/password.ts
export function passwordLength(pw: string): number;               // points de code de pw.normalize('NFC')
export type PasswordRejection = 'too_short' | 'too_long' | 'common' | 'contains_username' | 'contains_appsport' | 'single_char';
export function validatePassword(pw: string, ctx: { username: string; role: Role; commonPasswords: ReadonlySet<string> }):
  { ok: true } | { ok: false; reason: PasswordRejection };
// packages/domain/src/auth/secret-code.ts
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function encodeCrockford(bytes: Uint8Array): string;       // 10 octets → 16 caractères, bits de poids fort d'abord
export function parseSecretCode(input: string): string | null;
export function formatSecretCode(canonical: string): string;      // 'XXXX-XXXX-XXXX-XXXX'
// apps/server/src/auth/password-hash.ts
export const ARGON2_PARAMS: Argon2Params; // { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 }
export async function hashPassword(pw: string, params: Argon2Params, ids: IdGen): Promise<string>;
export async function verifyPassword(pw: string, phc: string): Promise<boolean>;
export function needsRehash(phc: string, params: Argon2Params): boolean;
// apps/server/src/auth/secret.ts
export function createSecretCode(ids: IdGen): { canonical: string; formatted: string; hash: string };
export function hashSecret(value: string): string;                // sha256 hex (codes et jetons de session)
// apps/server/src/auth/common-passwords.ts
export function parseCommonPasswords(raw: string): ReadonlySet<string>;
export const COMMON_PASSWORDS: ReadonlySet<string>;
```

**Spec:** 02 R-INV-3, R-INV-5, R-RST-1, R-MDP-1, R-MDP-2, R-MDP-3, R-MDP-4, §3.4 (pseudo), R-ROLE-5 (TTL 24 h), 03 P-AUT-1, P-AUT-2, 02 §15 n°3 et n°6.

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/auth-constants.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import * as C from '../src/auth-constants';
import { CivilDate } from '../src/api/auth';

describe('auth-constants', () => {
  it('reprend les valeurs de la spec 02', () => {
    expect([C.INVITATION_TTL_DAYS, C.BOOTSTRAP_INVITATION_TTL_HOURS, C.RESET_TTL_HOURS, C.SECRET_CODE_LENGTH,
      C.INVITATION_NOTE_MAX, C.USERNAME_MIN, C.USERNAME_MAX, C.PASSWORD_MIN_MEMBER, C.PASSWORD_MIN_ADMIN,
      C.PASSWORD_MAX, C.SESSION_IDLE_DAYS, C.SESSION_MAX_DAYS, C.ADMIN_PASSWORD_REMINDER_MONTHS])
      .toEqual([7, 24, 24, 16, 60, 3, 24, 12, 14, 128, 90, 365, 12]);
    expect(C.RESERVED_USERNAMES).toEqual(['admin', 'appsport', 'systeme']);
    expect(C.LOGIN_LIMITS).toEqual({ consecutiveThreshold: 5, firstDelayMs: 60_000, maxDelayMs: 900_000,
      hourlyMaxFailures: 10, lockMs: 3_600_000, windowMs: 3_600_000, ipMaxFailuresPerHour: 30 });
    expect(C.CODE_CHECKS_PER_HOUR).toBe(20);
  });
  it('CivilDate accepte une date civile valide seulement', () => {
    expect(CivilDate.safeParse('2026-10-06').success).toBe(true);
    expect(CivilDate.safeParse('2024-02-29').success).toBe(true);
    expect(CivilDate.safeParse('2026-02-30').success).toBe(false);
    expect(CivilDate.safeParse('06/10/2026').success).toBe(false);
  });
});
```
`packages/domain/test/auth/username.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { usernameKey, validateUsername } from '../../src/auth/username';

describe('validateUsername', () => {
  it('refuse 2 et 25 caractères, accepte 3 et 24', () => {
    expect(validateUsername('ab')).toEqual({ ok: false, reason: 'length' });
    expect(validateUsername('a'.repeat(25))).toEqual({ ok: false, reason: 'length' });
    expect(validateUsername('abc')).toEqual({ ok: true });
    expect(validateUsername('a'.repeat(24))).toEqual({ ok: true });
  });
  it('compte la longueur en points de code après NFC', () => {
    expect(validateUsername('é'.repeat(24))).toEqual({ ok: true }); // 48 points de code en NFD, 24 en NFC
  });
  it('accepte lettres accentuées, chiffres, point, tiret bas, tiret', () => {
    expect(validateUsername('Éloïse_2')).toEqual({ ok: true });
    expect(validateUsername('jean-marc.b')).toEqual({ ok: true });
  });
  it('refuse espace, @ et emoji', () => {
    for (const u of ['lea b', 'lea@x', 'lea💪']) expect(validateUsername(u)).toEqual({ ok: false, reason: 'characters' });
  });
  it('réserve admin, appsport, systeme sans tenir compte de la casse ni des accents', () => {
    for (const u of ['Admin', 'APPSPORT', 'Système']) expect(validateUsername(u)).toEqual({ ok: false, reason: 'reserved' });
  });
});
describe('usernameKey', () => {
  it('NFKC puis minuscules', () => {
    expect(usernameKey('ÉLOÏSE')).toBe(usernameKey('éloïse'));
    expect(usernameKey('Éloïse')).toBe('éloïse');
    expect(usernameKey('ＬＥＡ')).toBe('lea');
  });
});
```
`packages/domain/test/auth/password.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { passwordLength, validatePassword } from '../../src/auth/password';

const commonPasswords = new Set(['soleil123456']);
const member = { username: 'lea', role: 'member' as const, commonPasswords };
const admin = { ...member, role: 'admin' as const };

describe('validatePassword (02 §15 n°6)', () => {
  it('11 caractères refusé, 12 minuscules hors liste accepté', () => {
    expect(validatePassword('abcdefghijk', member)).toEqual({ ok: false, reason: 'too_short' });
    expect(validatePassword('girafebleuet', member)).toEqual({ ok: true });
  });
  it('admin : 13 refusé, 14 accepté', () => {
    expect(validatePassword('girafebleuet1', admin)).toEqual({ ok: false, reason: 'too_short' });
    expect(validatePassword('girafebleuet12', admin)).toEqual({ ok: true });
  });
  it('plus de 128 points de code refusé', () => {
    expect(validatePassword('ab'.repeat(64), member)).toEqual({ ok: true });
    expect(validatePassword(`${'ab'.repeat(64)}c`, member)).toEqual({ ok: false, reason: 'too_long' });
  });
  it('liste courante, insensible à la casse', () => {
    expect(validatePassword('SOLEIL123456', member)).toEqual({ ok: false, reason: 'common' });
  });
  it('contient le pseudo ou « appsport »', () => {
    expect(validatePassword('xxÉloïse_2 et la mer', { ...member, username: 'éloïse_2' })).toEqual({ ok: false, reason: 'contains_username' });
    expect(validatePassword('mon appSport adoré', member)).toEqual({ ok: false, reason: 'contains_appsport' });
  });
  it('un seul caractère répété', () => {
    expect(validatePassword('aaaaaaaaaaaa', member)).toEqual({ ok: false, reason: 'single_char' });
    expect(validatePassword('💪'.repeat(12), member)).toEqual({ ok: false, reason: 'single_char' });
  });
  it('longueur en points de code après NFC', () => {
    expect(passwordLength('💪'.repeat(11))).toBe(11);
    expect(validatePassword('💪'.repeat(11), member)).toEqual({ ok: false, reason: 'too_short' });
    expect(validatePassword(`${'💪'.repeat(11)}a`, member)).toEqual({ ok: true });
    expect(validatePassword(`${'é'.repeat(6)}abcde`, member)).toEqual({ ok: false, reason: 'too_short' });
  });
});
```
`packages/domain/test/auth/secret-code.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { encodeCrockford, formatSecretCode, parseSecretCode } from '../../src/auth/secret-code';

describe('codes secrets Crockford (02 §15 n°3)', () => {
  it('encodeCrockford : 10 octets → 16 caractères', () => {
    expect(encodeCrockford(new Uint8Array(10))).toBe('0000000000000000');
    expect(encodeCrockford(new Uint8Array(10).fill(255))).toBe('ZZZZZZZZZZZZZZZZ');
    expect(encodeCrockford(Uint8Array.of(8, 0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('1000000000000000');
  });
  it('formatSecretCode groupe par 4', () => {
    expect(formatSecretCode('ABCDEFGHJKMNPQRS')).toBe('ABCD-EFGH-JKMN-PQRS');
  });
  it('parseSecretCode tolère casse, espaces, tirets, O→0, I/L→1 et le lien complet', () => {
    const c = 'ABCDEFGHJKMNPQRS';
    expect(parseSecretCode('abcd-efgh-jkmn-pqrs')).toBe(c);
    expect(parseSecretCode(' abcd efgh jkmn pqrs ')).toBe(c);
    expect(parseSecretCode('abcdefghjkmnpqrs')).toBe(c);
    expect(parseSecretCode('O0OO-IiLl-0000-0000')).toBe('0000111100000000');
    expect(parseSecretCode('https://appsport.tail1234.ts.net/invite#abcd-efgh-jkmn-pqrs')).toBe(c);
    expect(parseSecretCode('https://appsport.tail1234.ts.net/reset#ABCD-EFGH-JKMN-PQRS')).toBe(c);
  });
  it('renvoie null pour 15 ou 17 caractères ou un caractère hors alphabet', () => {
    expect(parseSecretCode('ABCD-EFGH-JKMN-PQR')).toBeNull();
    expect(parseSecretCode('ABCD-EFGH-JKMN-PQRST')).toBeNull();
    expect(parseSecretCode('ABCD-EFGH-JKMN-PQRU')).toBeNull();
    expect(parseSecretCode('')).toBeNull();
  });
});
```
`apps/server/test/auth/password-hash.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { seqIds, TEST_ARGON2 } from '@appsport/server/testing';
import { ARGON2_PARAMS, hashPassword, needsRehash, verifyPassword } from '../../src/auth/password-hash';
import { loadConfig } from '../../src/config';

describe('password-hash (R-MDP-4)', () => {
  it('produit un PHC argon2id aux paramètres de production', async () => {
    const phc = await hashPassword('girafebleuet', ARGON2_PARAMS, seqIds());
    expect(phc).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  });
  it('ARGON2_PARAMS est le défaut de loadConfig', () => {
    expect(loadConfig({ APP_ORIGIN: 'https://appsport.test.ts.net' }).argon2).toEqual(ARGON2_PARAMS);
  });
  it('verifyPassword : bon, mauvais, PHC invalide, comparaison après NFC', async () => {
    const ids = seqIds();
    const phc = await hashPassword('café au lait du matin', TEST_ARGON2, ids);
    expect(await verifyPassword('café au lait du matin', phc)).toBe(true);
    expect(await verifyPassword('café au lait du matin', phc)).toBe(true);
    expect(await verifyPassword('café au lait du soir', phc)).toBe(false);
    expect(await verifyPassword('café au lait du matin', 'pas-un-phc')).toBe(false);
    expect(await hashPassword('café au lait du matin', TEST_ARGON2, ids)).not.toBe(phc);
  });
  it('needsRehash vrai quand les paramètres sont durcis', async () => {
    const phc = await hashPassword('girafebleuet', TEST_ARGON2, seqIds());
    expect(needsRehash(phc, TEST_ARGON2)).toBe(false);
    expect(needsRehash(phc, { ...TEST_ARGON2, memoryKiB: 2048 })).toBe(true);
    expect(needsRehash(phc, { ...TEST_ARGON2, passes: 2 })).toBe(true);
    expect(needsRehash(phc, { ...TEST_ARGON2, memoryKiB: 512 })).toBe(false);
    expect(needsRehash('garbage', TEST_ARGON2)).toBe(true);
  });
});
```
`apps/server/test/auth/secret.test.ts` :
```ts
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { formatSecretCode } from '@appsport/domain';
import { seqIds } from '@appsport/server/testing';
import { createSecretCode, hashSecret } from '../../src/auth/secret';

describe('createSecretCode (R-INV-3)', () => {
  it('16 caractères Crockford, format affiché, empreinte sha256 hex du canonique', () => {
    const s = createSecretCode(seqIds());
    expect(s.canonical).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
    expect(s.formatted).toBe(formatSecretCode(s.canonical));
    expect(s.hash).toBe(createHash('sha256').update(s.canonical).digest('hex'));
    expect(hashSecret(s.canonical)).toBe(s.hash);
  });
  it('tire exactement 10 octets de IdGen.randomBytes', () => {
    const ids = { uuidv7: () => 'x', randomBytes: vi.fn((n: number) => new Uint8Array(n)) };
    expect(createSecretCode(ids).canonical).toBe('0000000000000000');
    expect(ids.randomBytes).toHaveBeenCalledWith(10);
  });
});
```
`apps/server/test/auth/common-passwords.test.ts` :
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS, parseCommonPasswords } from '../../src/auth/common-passwords';

describe('COMMON_PASSWORDS (R-MDP-3)', () => {
  it('liste SecLists 10k en minuscules', () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThan(9000);
    expect(COMMON_PASSWORDS.size).toBeLessThanOrEqual(10000);
    expect(COMMON_PASSWORDS.has('123456')).toBe(true);
    expect(COMMON_PASSWORDS.has('password')).toBe(true);
    expect([...COMMON_PASSWORDS].every((p) => p === p.toLowerCase())).toBe(true);
  });
  it('parseCommonPasswords ignore les lignes « # », les lignes vides et CRLF', () => {
    expect([...parseCommonPasswords('# Licence MIT\r\nPassword\r\n\r\nabc\n')]).toEqual(['password', 'abc']);
  });
  it('le fichier commence par la mention de licence', () => {
    const raw = readFileSync(new URL('../../src/auth/common-passwords.txt', import.meta.url), 'utf8');
    expect(raw.startsWith('# Source: SecLists')).toBe(true);
    expect(raw).toContain('MIT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- auth-constants` ; `pnpm --filter @appsport/domain test -- auth` ; `pnpm --filter @appsport/server test -- password-hash secret common-passwords`
Échec attendu : `Failed to resolve import "../src/auth-constants"` (et équivalents pour chaque module).

- [ ] **Step 3: Implement**

- `auth-constants.ts`, `api/auth.ts` : valeurs et schémas ci-dessus, exportés tels quels.
- `username.ts` : `n = username.normalize('NFC')` ; longueur `[...n].length` hors de [3, 24] → `length` ; `n` ne correspond pas à `/^[\p{L}\p{Nd}._-]+$/u` → `characters` ; `usernameKey(n)` sans diacritiques (`normalize('NFD').replace(/\p{M}/gu, '')`) ∈ `RESERVED_USERNAMES` → `reserved` **[décision plan : « Système » est aussi réservé]**. Pas de `trim`.
- `password.ts` : `p = pw.normalize('NFC')`, ordre des contrôles : `too_short` (min 14 si `role === 'admin'`, sinon 12), `too_long` (> 128), `single_char` (`new Set([...p]).size === 1`), `common` (`commonPasswords.has(p.toLowerCase())`), `contains_username` (`usernameKey(p).includes(usernameKey(username))`), `contains_appsport` (`usernameKey(p).includes('appsport')`).
- `secret-code.ts` : `parseSecretCode` garde ce qui suit le dernier `#` s'il y en a un, passe en majuscules, retire espaces blancs et `-`, remplace `I`/`L` par `1` et `O` par `0`, exige exactement 16 caractères de `CROCKFORD_ALPHABET`, sinon `null`. `encodeCrockford` lève une `Error` si `bytes.length * 8` n'est pas multiple de 5.
- `password-hash.ts` : `argon2` de `node:crypto` (algorithme `'argon2id'`, `memory` en Kio, `nonce` = `ids.randomBytes(params.saltLength)`), entrée `pw.normalize('NFC')`. Format PHC : `$argon2id$v=19$m=<m>,t=<t>,p=<p>$<sel base64 sans =>$<empreinte base64 sans =>`. `verifyPassword` analyse le PHC (toute erreur → `false`), recalcule avec le même sel et la même longueur d'empreinte, compare par `timingSafeEqual`. `needsRehash` : `true` si le PHC est illisible, si l'algorithme n'est pas `argon2id` ou la version pas 19, ou si `m < memoryKiB`, `t < passes`, `p !== parallelism`, ou si le sel est plus court que `saltLength`.
- `secret.ts` : `createSecretCode` = `encodeCrockford(ids.randomBytes(10))` puis `formatSecretCode` et `hashSecret` ; `hashSecret` = `createHash('sha256').update(value, 'utf8').digest('hex')`.
- `common-passwords.txt` : télécharger `https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10k-most-common.txt`, passer en minuscules, retirer les doublons et les lignes vides, en LF. En tête, exactement deux lignes :
  `# Source: SecLists, Passwords/Common-Credentials/10k-most-common.txt (https://github.com/danielmiessler/SecLists)`
  `# Licence : MIT, Copyright (c) Daniel Miessler. Converti en minuscules et dédoublonné pour appsport.`
- `common-passwords.ts` : `parseCommonPasswords` découpe sur `/\r?\n/`, ignore les lignes qui commencent par `# ` et les lignes vides, met en minuscules. `COMMON_PASSWORDS = parseCommonPasswords(readFileSync(new URL('./common-passwords.txt', import.meta.url), 'utf8'))` **[décision plan : lecture au chargement ; le bundle T41 copie le fichier à côté de `server.mjs`, voir interface_gaps]**.

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes que l'étape 2, puis `pnpm typecheck` et `pnpm lint`. Attendu : tous les tests verts (`Test Files  7 passed`), aucune erreur de type ni de lint.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/auth-constants.ts packages/contracts/src/api/auth.ts packages/contracts/src/index.ts packages/contracts/test/auth-constants.test.ts packages/domain/src/auth packages/domain/src/index.ts packages/domain/test/auth apps/server/src/auth apps/server/test/auth
git commit -m "feat(auth): règles de pseudo et de mot de passe, codes Crockford et Argon2id"
```

### Task 9: Sessions, middleware et journal de sécurité

**Files:**
- Create: `apps/server/src/auth/security-log.ts`
- Create: `apps/server/src/auth/session.ts`
- Modify: `apps/server/src/app.ts` (monte `sessionMiddleware(deps)` sur `/api/*`, après `origin-guard`, avant `mountRoutes`)
- Test: `apps/server/test/auth/session.test.ts`, `apps/server/test/auth/security-log.test.ts`

**Interfaces:**
- Consumes : `AppDeps`, `Clock`, `IdGen` (deps.ts T6) ; `AppEnv`, `SessionUser` (app-env.ts T6) ; `httpError`, `errorHandler` (http/errors.ts T6) ; `DbExecutor`, `Database` (db/schema.ts T4) ; colonne `session.must_change_password` (T4, voir interface_gaps) ; `createLogger` (logger.ts T6) ; `createTestContext`, `insertFixtureRow`, `FakeClock` (testing T5/T6) ; `hashSecret` (T8) ; `SESSION_IDLE_DAYS`, `SESSION_MAX_DAYS`, `SESSION_TOUCH_INTERVAL_MS` (T8).
- Produces :
```ts
// apps/server/src/auth/security-log.ts
export type SecurityEventType = 'login_succeeded'|'login_failed'|'login_blocked'|'logout'|'logout_all'|'password_changed'
 |'password_reset_created'|'password_reset_used'|'invitation_created'|'invitation_revoked'|'invitation_used'|'role_changed'
 |'status_changed'|'sessions_revoked'|'birth_date_corrected'|'username_changed'|'consent_granted'|'consent_revoked'
 |'data_exported'|'account_deleted'|'gym_deleted';
export type SecurityDetails = { [key: string]: string | number | boolean } & { password?: never; code?: never; token?: never };
export const FORBIDDEN_DETAIL_KEY: RegExp; // /password|code|token|secret|hash|cookie/i
export interface SecurityEventInput { type: SecurityEventType; actorId: string | null; targetId: string | null; ip: string | null;
  outcome: 'success' | 'failure' | 'blocked'; details?: SecurityDetails }
export async function logSecurityEvent(trx: DbExecutor, deps: AppDeps, ev: SecurityEventInput): Promise<void>;
// apps/server/src/auth/session.ts
export async function createSession(trx: DbExecutor, deps: AppDeps, userId: string, opts?: { mustChangePassword?: boolean }): Promise<{ token: string; sessionId: string }>;
export function setSessionCookie(c: Context<AppEnv>, deps: AppDeps, token: string): void;
export function clearSessionCookie(c: Context<AppEnv>, deps: AppDeps): void;
export async function revokeSession(trx: DbExecutor, deps: AppDeps, sessionId: string, reason: 'logout'): Promise<void>;
export async function revokeSessions(trx: DbExecutor, deps: AppDeps, userId: string,
  reason: 'logout' | 'logout_all' | 'password_change' | 'password_reset' | 'admin', exceptSessionId?: string): Promise<number>;
export function sessionMiddleware(deps: AppDeps): MiddlewareHandler<AppEnv>;
export const MUST_CHANGE_ALLOWED: readonly string[]; // ['GET /api/me', 'POST /api/auth/password', 'POST /api/auth/logout']
export const requireUser: MiddlewareHandler<AppEnv>;
export const requireAdmin: MiddlewareHandler<AppEnv>;
```
Convention fixée : `sessionMiddleware` met `user` et `sessionId` à `null` sans session valide ; pour une session dont `revoked_reason = 'account_deleted'`, il met `sessionId = <id>` et `user = null`. `requireUser` lit ce couple pour répondre `410`.

**Spec:** 02 R-AUTH-6, R-ROLE-4, R-MDP-1 (accès limité), §14 (journal), §15 n°4 ; 03 P-AUT-3, P-DRT-4, P-LOG-1, P-LOG-2, §17 n°7 et n°8.

- [ ] **Step 1: Write the failing test**

`apps/server/test/auth/session.test.ts` :
```ts
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, insertFixtureRow, type TestContext } from '@appsport/server/testing';
import type { AppEnv } from '../../src/app-env';
import { errorHandler } from '../../src/http/errors';
import { createLogger } from '../../src/logger';
import { clearSessionCookie, createSession, requireAdmin, requireUser, revokeSessions, sessionMiddleware, setSessionCookie } from '../../src/auth/session';

const DAY = 86_400_000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function probe(ctx: TestContext) {
  const app = new Hono<AppEnv>();
  app.use('*', sessionMiddleware(ctx.deps));
  app.post('/probe/login/:id', async (c) => {
    const s = await createSession(ctx.deps.db, ctx.deps, c.req.param('id'), { mustChangePassword: c.req.query('mcp') === '1' });
    setSessionCookie(c, ctx.deps, s.token);
    return c.json(s);
  });
  app.post('/probe/clear', (c) => { clearSessionCookie(c, ctx.deps); return c.body(null, 204); });
  app.get('/probe/user', requireUser, (c) => c.json(c.get('user')));
  app.get('/probe/admin', requireAdmin, (c) => c.json({ ok: true }));
  app.get('/api/me', requireUser, (c) => c.json({ ok: true }));
  app.post('/api/auth/password', requireUser, (c) => c.json({ ok: true }));
  app.post('/api/auth/logout', requireUser, (c) => c.json({ ok: true }));
  app.post('/api/auth/logout-all', requireUser, (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

describe('sessions', () => {
  let ctx: TestContext; let app: Hono<AppEnv>;
  beforeEach(async () => { ctx = await createTestContext(); app = probe(ctx); });

  async function loginAs(role: 'admin' | 'member' = 'member', mcp = false) {
    const user = await insertFixtureRow(ctx.deps.db, 'user', { role, birthDate: '1990-01-01' });
    const res = await app.request(`/probe/login/${String(user.id)}${mcp ? '?mcp=1' : ''}`, { method: 'POST' });
    const { token, sessionId } = (await res.json()) as { token: string; sessionId: string };
    return { userId: String(user.id), token, sessionId, cookie: `${ctx.deps.config.sessionCookieName}=${token}`, setCookie: res.headers.get('set-cookie') ?? '' };
  }
  const get = (path: string, cookie?: string) => app.request(path, { headers: cookie ? { cookie } : {} });

  it('cookie __Host-session HttpOnly, Secure, SameSite=Lax, Path=/, sans Domain (P-AUT-3)', async () => {
    const s = await loginAs();
    expect(s.setCookie).toMatch(/^__Host-session=[A-Za-z0-9_-]{43};/);
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=31536000']) expect(s.setCookie).toContain(attr);
    expect(s.setCookie).not.toMatch(/Domain=/i);
  });
  it('dev-session sans Secure sur http://localhost', async () => {
    ctx = await createTestContext({ config: { appOrigin: 'http://localhost:5173', sessionCookieName: 'dev-session', secureCookie: false } });
    app = probe(ctx);
    const s = await loginAs();
    expect(s.setCookie).toMatch(/^dev-session=/);
    expect(s.setCookie).not.toContain('Secure');
  });
  it('clearSessionCookie pose Max-Age=0', async () => {
    const res = await app.request('/probe/clear', { method: 'POST' });
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=;.*Max-Age=0/);
  });
  it('seule l'empreinte sha256 du jeton est stockée (02 §15 n°4)', async () => {
    const s = await loginAs();
    const row = await ctx.deps.db.selectFrom('session').selectAll().where('id', '=', s.sessionId).executeTakeFirstOrThrow();
    expect(row.tokenHash).toBe(sha256(s.token));
    expect(Object.values(row)).not.toContain(s.token);
    expect(row.expiresAt).toBe('2027-10-06T10:00:00.000Z');
    expect(row.mustChangePassword).toBe(0);
  });
  it('requireUser : 401 sans cookie, SessionUser avec cookie', async () => {
    expect(await (await get('/probe/user')).json()).toEqual({ error: 'unauthenticated' });
    const s = await loginAs();
    const res = await get('/probe/user', s.cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: s.userId, role: 'member', birthDate: '1990-01-01', mustChangePassword: false });
  });
  it('expire après 90 j sans activité ; l'activité repousse l'échéance', async () => {
    const a = await loginAs(); const b = await loginAs();
    ctx.clock.advance(89 * DAY);
    expect((await get('/probe/user', a.cookie)).status).toBe(200);
    ctx.clock.advance(1 * DAY);
    expect((await get('/probe/user', b.cookie)).status).toBe(401);
    ctx.clock.advance(88 * DAY);
    expect((await get('/probe/user', a.cookie)).status).toBe(200);
  });
  it('expire au plus tard 365 j après la connexion', async () => {
    const a = await loginAs();
    for (let d = 80; d <= 320; d += 80) { ctx.clock.advance(80 * DAY); expect((await get('/probe/user', a.cookie)).status).toBe(200); }
    ctx.clock.advance(45 * DAY - 1);
    expect((await get('/probe/user', a.cookie)).status).toBe(200);
    ctx.clock.advance(1);
    expect((await get('/probe/user', a.cookie)).status).toBe(401);
  });
  it('last_seen_at réécrit au plus une fois par heure', async () => {
    const a = await loginAs();
    const seen = async () => (await ctx.deps.db.selectFrom('session').select('lastSeenAt').where('id', '=', a.sessionId).executeTakeFirstOrThrow()).lastSeenAt;
    ctx.clock.advance(30 * 60_000); await get('/probe/user', a.cookie);
    expect(await seen()).toBe('2026-10-06T10:00:00.000Z');
    ctx.clock.advance(31 * 60_000); await get('/probe/user', a.cookie);
    expect(await seen()).toBe('2026-10-06T11:01:00.000Z');
  });
  it('session révoquée → 401 unauthenticated ; exceptSessionId garde la courante', async () => {
    const a = await loginAs();
    const res2 = await app.request(`/probe/login/${a.userId}`, { method: 'POST' });
    const b = (await res2.json()) as { token: string };
    expect(await revokeSessions(ctx.deps.db, ctx.deps, a.userId, 'admin', a.sessionId)).toBe(1);
    expect((await get('/probe/user', a.cookie)).status).toBe(200);
    const res = await get('/probe/user', `__Host-session=${b.token}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });
  it('session account_deleted → 410 {error:"account_deleted"} ; les routes publiques ne sont pas bloquées (P-DRT-4)', async () => {
    const a = await loginAs();
    await ctx.deps.db.updateTable('session').set({ userId: null, revokedAt: '2026-10-06T10:00:00.000Z', revokedReason: 'account_deleted' }).where('id', '=', a.sessionId).execute();
    const res = await get('/probe/user', a.cookie);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'account_deleted' });
    expect((await ctx.request('/api/health', { cookie: a.cookie })).status).toBe(200);
  });
  it('compte désactivé → 401', async () => {
    const a = await loginAs();
    await ctx.deps.db.updateTable('user').set({ status: 'disabled' }).where('id', '=', a.userId).execute();
    expect((await get('/probe/user', a.cookie)).status).toBe(401);
  });
  it('requireAdmin refuse un membre (403 forbidden) (R-ROLE-4)', async () => {
    const m = await loginAs('member'); const ad = await loginAs('admin');
    const res = await get('/probe/admin', m.cookie);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect((await get('/probe/admin', ad.cookie)).status).toBe(200);
  });
  it('mustChangePassword limite aux routes autorisées (R-MDP-1)', async () => {
    const s = await loginAs('admin', true);
    expect((await get('/api/me', s.cookie)).status).toBe(200);
    expect((await app.request('/api/auth/password', { method: 'POST', headers: { cookie: s.cookie } })).status).toBe(200);
    expect((await app.request('/api/auth/logout', { method: 'POST', headers: { cookie: s.cookie } })).status).toBe(200);
    const blocked = await app.request('/api/auth/logout-all', { method: 'POST', headers: { cookie: s.cookie } });
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'password_change_required' });
    expect((await get('/probe/user', s.cookie)).status).toBe(403);
  });
  it('aucun jeton ni empreinte dans la sortie du logger (03 §17 n°7)', async () => {
    const lines: string[] = [];
    ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
    app = probe(ctx);
    const s = await loginAs();
    await get('/probe/user', s.cookie);
    await ctx.request('/api/health', { cookie: s.cookie });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(s.token);
    expect(lines.join('\n')).not.toContain(sha256(s.token));
  });
});
```
`apps/server/test/auth/security-log.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { createTestContext } from '@appsport/server/testing';
import { createLogger } from '../../src/logger';
import { logSecurityEvent, type SecurityDetails } from '../../src/auth/security-log';

describe('logSecurityEvent (P-LOG-1)', () => {
  it('écrit une ligne security_event horodatée', async () => {
    const ctx = await createTestContext();
    await logSecurityEvent(ctx.deps.db, ctx.deps, { type: 'login_succeeded', actorId: 'u1', targetId: 'u1', ip: '100.64.0.1', outcome: 'success', details: { role: 'admin' } });
    const row = await ctx.deps.db.selectFrom('securityEvent').selectAll().executeTakeFirstOrThrow();
    expect(row).toMatchObject({ type: 'login_succeeded', actorId: 'u1', targetId: 'u1', tailnetIp: '100.64.0.1', outcome: 'success', at: '2026-10-06T10:00:00.000Z' });
    expect(JSON.parse(row.details ?? 'null')).toEqual({ role: 'admin' });
  });
  it('sans détails → details NULL', async () => {
    const ctx = await createTestContext();
    await logSecurityEvent(ctx.deps.db, ctx.deps, { type: 'logout', actorId: null, targetId: null, ip: null, outcome: 'success' });
    expect((await ctx.deps.db.selectFrom('securityEvent').select('details').executeTakeFirstOrThrow()).details).toBeNull();
  });
  it('refuse password/code/token à la compilation', () => {
    // @ts-expect-error clé interdite dans les détails
    const d: SecurityDetails = { password: 'x' };
    expect(d).toBeDefined();
  });
  it('filtre à l'exécution toute clé interdite et le signale', async () => {
    const lines: string[] = [];
    const ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
    await logSecurityEvent(ctx.deps.db, ctx.deps, { type: 'invitation_created', actorId: 'a', targetId: null, ip: null, outcome: 'success',
      details: { role: 'member', inviteCode: 'ABCD', tokenHash: 'x', newPassword: 'y' } as SecurityDetails });
    const row = await ctx.deps.db.selectFrom('securityEvent').select('details').executeTakeFirstOrThrow();
    expect(JSON.parse(row.details ?? 'null')).toEqual({ role: 'member' });
    expect(lines.some((l) => l.includes('security details dropped'))).toBe(true);
    expect(lines.join('\n')).not.toContain('ABCD');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- session security-log`
Échec attendu : `Failed to resolve import "../../src/auth/session"`.

- [ ] **Step 3: Implement**

- `security-log.ts` : insère `{ id: deps.ids.uuidv7(), at: deps.clock.now().toISOString(), type, actorId, targetId, tailnetIp: ip, outcome, details }` ; `details` = `JSON.stringify` des seules clés qui ne correspondent pas à `FORBIDDEN_DETAIL_KEY`, `NULL` si absent ou vide après filtrage ; s'il a retiré des clés : `deps.logger.warn('security details dropped', { event: ev.type, count: n })` (jamais le nom ni la valeur des clés).
- `session.ts` :
  - `createSession` : jeton = `Buffer.from(deps.ids.randomBytes(32)).toString('base64url')` (43 caractères) ; ligne `{ id: uuidv7, tokenHash: hashSecret(token), userId, createdAt: now, lastSeenAt: now, expiresAt: now + SESSION_MAX_DAYS j, revokedAt: null, revokedReason: null, mustChangePassword: opts?.mustChangePassword ? 1 : 0 }`.
  - `setSessionCookie` : `setCookie` de `hono/cookie`, nom `deps.config.sessionCookieName`, `{ httpOnly: true, secure: deps.config.secureCookie, sameSite: 'Lax', path: '/', maxAge: SESSION_MAX_DAYS * 86400 }`, sans `domain`. `clearSessionCookie` : même nom, même chemin, `maxAge: 0`.
  - `revokeSession` / `revokeSessions` : `revoked_at = now`, `revoked_reason = reason`, seulement sur les sessions non révoquées ; `revokeSessions` renvoie le nombre de lignes modifiées.
  - `sessionMiddleware` : lit le cookie ; empreinte ; ligne trouvée avec `revokedReason === 'account_deleted'` → `sessionId = id`, `user = null` ; ligne révoquée, `expiresAt <= now` ou `lastSeenAt + 90 j <= now` → `null`/`null` ; sinon charge l'utilisateur (`id, username, role, birthDate, status`) ; absent ou `status = 'disabled'` → `null`/`null` ; sinon `user = { id, username, role, birthDate, mustChangePassword: row.mustChangePassword === 1 }` et réécrit `last_seen_at` si `now - lastSeenAt >= SESSION_TOUCH_INTERVAL_MS`. Ne lève jamais d'erreur HTTP et n'écrit jamais le jeton dans le logger.
  - `requireUser` : `user === null && sessionId !== null` → `httpError('account_deleted')` ; `user === null` → `httpError('unauthenticated')` ; `user.mustChangePassword` et `` `${c.req.method} ${c.req.path}` `` absent de `MUST_CHANGE_ALLOWED` → `httpError('password_change_required')`. `requireAdmin` applique la même logique puis `role !== 'admin'` → `httpError('forbidden')`.
- `app.ts` : `app.use('/api/*', sessionMiddleware(deps))` à la place prévue par l'ordre de `createApp`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- session security-log` puis `pnpm --filter @appsport/server typecheck` (vérifie le `@ts-expect-error`). Attendu : `Test Files  2 passed`, aucune erreur de type.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/auth/session.ts apps/server/src/auth/security-log.ts apps/server/src/app.ts apps/server/test/auth/session.test.ts apps/server/test/auth/security-log.test.ts
git commit -m "feat(auth): sessions par cookie __Host-session et journal de sécurité"
```

### Task 10: Connexion, limitation, déconnexion, mot de passe et /api/me

**Files:**
- Create: `apps/server/src/auth/limiter.ts`, `apps/server/src/auth/routes.ts`, `apps/server/src/auth/me.ts`, `apps/server/src/auth/me-routes.ts`
- Create: `apps/server/src/privacy/consent-state.ts`
- Modify: `packages/contracts/src/api/auth.ts` (ajoute `ONBOARDING_STEPS`, `OnboardingStep`, `ConsentStatus`, `ConsentState`, `MeResponse`, `LoginRequest`, `ChangePasswordRequest`, `UpdateMeRequest`)
- Modify: `apps/server/src/routes.ts` (`app.route('/api/auth', authRoutes(deps))`, `app.route('/api/me', meRoutes(deps))`)
- Create: `apps/server/test/support/users.ts` ; Modify: `apps/server/test/support/index.ts` (réexporte `users`)
- Test: `apps/server/test/auth/limiter.test.ts`, `apps/server/test/auth/login.test.ts`, `apps/server/test/auth/password-change.test.ts`, `apps/server/test/auth/me.test.ts`, `apps/server/test/privacy/consent-state.test.ts`

**Interfaces:**
- Consumes : T8 (`usernameKey`, `validateUsername`, `validatePassword`, `passwordLength`, `hashPassword`, `verifyPassword`, `needsRehash`, `COMMON_PASSWORDS`, `LOGIN_LIMITS`, `PASSWORD_MIN_ADMIN`, `ADMIN_PASSWORD_REMINDER_MONTHS`, `RoleSchema`, `UserStatusSchema`, `AgeBandSchema`, `CivilDate`) ; T9 (`createSession`, `setSessionCookie`, `clearSessionCookie`, `revokeSession`, `revokeSessions`, `requireUser`, `logSecurityEvent`) ; `ageBandOn`, `parisDate`, `computeCautious` (domain T2) ; `writeStamp` (db/rev.ts T4) ; `parseJson`, `httpError`, `clientIp` (T6) ; `PRIVACY_POLICY_VERSION` (T2) ; `FakeClock`, `TEST_ARGON2`, `createTestContext` (T6).
- Produces :
```ts
// packages/contracts/src/api/auth.ts (ajouts)
export const ONBOARDING_STEPS = ['goal','sport','place_kind','place','experience','availability','health','ready'] as const;
export const OnboardingStep = z.enum(ONBOARDING_STEPS); export type OnboardingStep = z.infer<typeof OnboardingStep>;
export const ConsentStatus = z.object({ active: z.boolean(), textVersion: z.string().nullable(), at: z.string().nullable() });
export const ConsentState = z.object({ health: ConsentStatus, ai_coach: ConsentStatus });
export const MeResponse = z.object({ id: z.string(), username: z.string(), role: RoleSchema, status: UserStatusSchema, birthDate: CivilDate,
  ageBand: AgeBandSchema, cautious: z.boolean(), mustChangePassword: z.boolean(), passwordReminderDue: z.boolean(),
  onboardingStep: OnboardingStep.nullable(), onboardingCompletedAt: z.string().nullable(), termsVersion: z.string().nullable(), consents: ConsentState });
export const LoginRequest = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(1024) });
export const ChangePasswordRequest = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(1).max(1024) });
export const UpdateMeRequest = z.object({ username: z.string().min(1).max(100) });
// (chaque schéma avec son type homonyme)
// apps/server/src/auth/limiter.ts
export interface LoginLimiter { check(usernameKey: string, ip: string | null): { allowed: true } | { allowed: false; retryAfterS: number };
  recordFailure(usernameKey: string, ip: string | null): void; recordSuccess(usernameKey: string): void; unlock(usernameKey: string): void }
export interface IpLimiter { hit(ip: string | null): { allowed: boolean; retryAfterS: number } }
export function createLoginLimiter(clock: Clock): LoginLimiter;
export function createIpLimiter(clock: Clock, opts: { limit: number; windowMs: number }): IpLimiter;
export interface AuthLimiters { login: LoginLimiter; invitationCheck: IpLimiter; resetCheck: IpLimiter }
export function authLimiters(deps: AppDeps): AuthLimiters;   // mémoïsé par objet deps (WeakMap) ; IpLimiter à 20/h
// apps/server/src/privacy/consent-state.ts
export type ConsentType = 'health' | 'ai_coach';
export async function getConsentState(db: DbExecutor, userId: string): Promise<ConsentState>;
export async function isHealthConsentActive(db: DbExecutor, userId: string): Promise<boolean>;
// apps/server/src/auth/me.ts
export async function buildMe(db: DbExecutor, deps: AppDeps, userId: string, opts?: { mustChangePassword?: boolean }): Promise<MeResponse>;
export async function verifyUserPassword(db: DbExecutor, userId: string, password: string): Promise<boolean>;
export async function storeNewPassword(trx: DbExecutor, deps: AppDeps, userId: string, passwordHash: string): Promise<void>;
// apps/server/src/auth/routes.ts / me-routes.ts
export function authRoutes(deps: AppDeps): Hono<AppEnv>;  // /login, /logout, /logout-all, /password (T12 ajoute /reset/check, /reset)
export function meRoutes(deps: AppDeps): Hono<AppEnv>;    // GET /, PATCH / (T13 ajoute /export, /delete)
// apps/server/test/support/users.ts
export async function createUser(ctx: TestContext, o?: { username?: string; password?: string; role?: Role; birthDate?: string; status?: UserStatus; onboarded?: boolean }): Promise<{ id: string; username: string; password: string }>;
export async function login(ctx: TestContext, username: string, password: string): Promise<string>;
export async function createUserAndLogin(ctx: TestContext, o?: Parameters<typeof createUser>[1]): Promise<{ id: string; username: string; password: string; cookie: string }>;
```

**Spec:** 02 R-AUTH-1 à R-AUTH-7, R-MDP-1, R-MDP-4 (ré-hachage), R-MDP-5, R-MDP-6, R-CPT-3, R-AGE-2, R-CST-1 (état courant), R-CST-7, §15 n°7 ; 03 P-AUT-1, P-AUT-5, P-MIN-3.

- [ ] **Step 1: Write the failing test**

`apps/server/test/auth/limiter.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { FakeClock } from '@appsport/server/testing';
import { createIpLimiter, createLoginLimiter } from '../../src/auth/limiter';

const IP = '100.64.0.1';
describe('createLoginLimiter (R-AUTH-2, R-AUTH-3)', () => {
  it('5e échec : 1 min, puis 2, 4, 8, plafond 15 ; 10e dans l'heure : 1 h', () => {
    const clock = new FakeClock(); const l = createLoginLimiter(clock);
    const fail = () => l.recordFailure('lea', IP);
    for (let i = 0; i < 4; i++) fail();
    expect(l.check('lea', IP)).toEqual({ allowed: true });
    fail();
    expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 60 });
    clock.advance(60_000); expect(l.check('lea', IP)).toEqual({ allowed: true });
    fail(); expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 120 });
    clock.advance(120_000); fail(); expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 240 });
    clock.advance(240_000); fail(); expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 480 });
    clock.advance(480_000); fail(); expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 900 });
    clock.advance(900_000); fail(); // 10e échec, 30 min après le 1er
    expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 3600 });
    clock.advance(3_599_000); expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 1 });
    clock.advance(1_000); expect(l.check('lea', IP)).toEqual({ allowed: true });
  });
  it('un succès remet le compteur consécutif à zéro, pas la fenêtre d'une heure', () => {
    const clock = new FakeClock(); const l = createLoginLimiter(clock);
    for (let i = 0; i < 4; i++) l.recordFailure('lea', null);
    l.recordSuccess('lea');
    for (let i = 0; i < 4; i++) l.recordFailure('lea', null);
    expect(l.check('lea', null)).toEqual({ allowed: true });
    l.recordSuccess('lea');
    l.recordFailure('lea', null); l.recordFailure('lea', null); // 10 échecs dans l'heure
    expect(l.check('lea', null)).toEqual({ allowed: false, retryAfterS: 3600 });
  });
  it('les échecs de plus d'une heure sortent de la fenêtre', () => {
    const clock = new FakeClock(); const l = createLoginLimiter(clock);
    for (let i = 0; i < 4; i++) l.recordFailure('lea', null);
    l.recordSuccess('lea'); clock.advance(3_600_000);
    for (let i = 0; i < 4; i++) l.recordFailure('lea', null);
    l.recordSuccess('lea'); l.recordFailure('lea', null); l.recordFailure('lea', null);
    expect(l.check('lea', null)).toEqual({ allowed: true });
  });
  it('30 échecs par heure et par IP, tous pseudos confondus', () => {
    const clock = new FakeClock(); const l = createLoginLimiter(clock);
    for (let i = 0; i < 30; i++) l.recordFailure(`inconnu${i}`, IP);
    expect(l.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(l.check('lea', '100.64.0.2')).toEqual({ allowed: true });
    expect(l.check('lea', null)).toEqual({ allowed: true });
  });
  it('unlock débloque immédiatement', () => {
    const clock = new FakeClock(); const l = createLoginLimiter(clock);
    for (let i = 0; i < 10; i++) l.recordFailure('lea', null);
    l.unlock('lea');
    expect(l.check('lea', null)).toEqual({ allowed: true });
  });
});
describe('createIpLimiter', () => {
  it('20 essais par heure, le 21e est refusé ; un refus ne compte pas', () => {
    const clock = new FakeClock(); const l = createIpLimiter(clock, { limit: 20, windowMs: 3_600_000 });
    for (let i = 0; i < 20; i++) expect(l.hit(IP).allowed).toBe(true);
    expect(l.hit(IP)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(l.hit('100.64.0.2').allowed).toBe(true);
    clock.advance(3_600_000);
    expect(l.hit(IP).allowed).toBe(true);
  });
});
```
`apps/server/test/auth/login.test.ts` :
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { MeResponse } from '@appsport/contracts';
import { createTestContext, createUser, TEST_ARGON2, type TestContext } from '@appsport/server/testing';
import { hashPassword } from '../../src/auth/password-hash';

describe('POST /api/auth/login', () => {
  let ctx: TestContext;
  beforeEach(async () => { ctx = await createTestContext(); });
  const login = (username: string, password: string, ip = '100.64.0.1') =>
    ctx.request('/api/auth/login', { method: 'POST', json: { username, password }, ip });

  it('succès : 200 MeResponse, cookie, last_login_at, rev, login_succeeded (R-AUTH-1)', async () => {
    const u = await createUser(ctx, { username: 'Léa' });
    const before = await ctx.deps.db.selectFrom('user').select('rev').where('id', '=', u.id).executeTakeFirstOrThrow();
    ctx.clock.advance(1000);
    const res = await login('LÉA', u.password);
    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json())).toMatchObject({ id: u.id, username: 'Léa', role: 'member', mustChangePassword: false });
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=/);
    const row = await ctx.deps.db.selectFrom('user').selectAll().where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(row.lastLoginAt).toBe('2026-10-06T10:00:01.000Z');
    expect(row.rev).toBeGreaterThan(before.rev);
    const ev = await ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'login_succeeded').executeTakeFirstOrThrow();
    expect(ev).toMatchObject({ targetId: u.id, outcome: 'success', tailnetIp: '100.64.0.1' });
  });
  it('échec : toujours 401 invalid_credentials, pseudo inexistant compris', async () => {
    await createUser(ctx, { username: 'lea' });
    for (const r of [await login('lea', 'mauvais mot de passe'), await login('personne', 'mauvais mot de passe')]) {
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'invalid_credentials' });
    }
  });
  it('5e échec : 429 pendant 1 min, même pour un pseudo inexistant (02 §15 n°7)', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    for (const name of ['lea', 'fantome']) {
      for (let i = 0; i < 5; i++) expect((await login(name, 'faux faux faux')).status).toBe(401);
      const r = await login(name, u.password);
      expect(r.status).toBe(429);
      expect(await r.json()).toEqual({ error: 'rate_limited', retryAfterS: 60 });
    }
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'login_blocked').execute()).toHaveLength(2);
    ctx.clock.advance(60_000);
    expect((await login('lea', u.password)).status).toBe(200);
  });
  it('10e échec dans l'heure : refus 1 h, puis connexion possible', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    for (let i = 1; i <= 10; i++) {
      expect((await login('lea', 'faux faux faux')).status).toBe(401);
      if (i >= 5 && i < 10) ctx.clock.advance(Math.min(60_000 * 2 ** (i - 5), 900_000));
    }
    const blocked = await login('lea', u.password);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'rate_limited', retryAfterS: 3600 });
    ctx.clock.advance(3_600_000);
    expect((await login('lea', u.password)).status).toBe(200);
  });
  it('un succès remet le compteur consécutif à zéro', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    for (let i = 0; i < 4; i++) await login('lea', 'faux faux faux');
    expect((await login('lea', u.password)).status).toBe(200);
    for (let i = 0; i < 4; i++) await login('lea', 'faux faux faux');
    expect((await login('lea', u.password)).status).toBe(200);
  });
  it('31e tentative après 30 échecs de la même IP → 429 ; une autre IP passe (R-AUTH-3)', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    for (let i = 0; i < 30; i++) expect((await login(`inconnu${i}`, 'faux', '100.64.0.9')).status).toBe(401);
    expect((await login('lea', u.password, '100.64.0.9')).status).toBe(429);
    expect((await login('lea', u.password, '100.64.0.10')).status).toBe(200);
  });
  it('compte désactivé : 403 account_disabled seulement avec le bon mot de passe (R-AUTH-5)', async () => {
    const u = await createUser(ctx, { username: 'lea', status: 'disabled' });
    expect(await (await login('lea', 'faux faux faux')).json()).toEqual({ error: 'invalid_credentials' });
    const r = await login('lea', u.password);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'account_disabled' });
    expect(r.headers.get('set-cookie')).toBeNull();
  });
  it('admin avec 13 caractères : mustChangePassword, accès limité (R-MDP-1)', async () => {
    const u = await createUser(ctx, { username: 'chef', role: 'admin', password: 'abcdefghijklm' });
    const res = await login('chef', u.password);
    expect((await res.json()).mustChangePassword).toBe(true);
    const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
    expect((await ctx.request('/api/me', { cookie })).status).toBe(200);
    const r = await ctx.request('/api/auth/logout-all', { method: 'POST', json: {}, cookie });
    expect(await r.json()).toEqual({ error: 'password_change_required' });
  });
  it('ré-hache à la connexion si les paramètres ont été durcis (R-MDP-4)', async () => {
    ctx = await createTestContext({ config: { argon2: { ...TEST_ARGON2, memoryKiB: 2048 } } });
    const u = await createUser(ctx, { username: 'lea' });
    const weak = await hashPassword(u.password, TEST_ARGON2, ctx.deps.ids);
    await ctx.deps.db.updateTable('user').set({ passwordHash: weak }).where('id', '=', u.id).execute();
    expect((await login('lea', u.password)).status).toBe(200);
    const row = await ctx.deps.db.selectFrom('user').select(['passwordHash', 'passwordChangedAt']).where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=2048,t=1,p=1\$/);
    expect((await login('lea', u.password)).status).toBe(200);
  });
});
```
`apps/server/test/auth/password-change.test.ts` :
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, createUser, login, type TestContext } from '@appsport/server/testing';

describe('mot de passe et déconnexion', () => {
  let ctx: TestContext;
  beforeEach(async () => { ctx = await createTestContext(); });
  const post = (path: string, cookie: string, json: unknown = {}) => ctx.request(path, { method: 'POST', json, cookie });

  it('POST /api/auth/password exige l'actuel et ferme les autres sessions (R-MDP-6)', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    const a = await login(ctx, 'lea', u.password); const b = await login(ctx, 'lea', u.password);
    ctx.clock.advance(1000);
    expect((await post('/api/auth/password', a, { currentPassword: u.password, newPassword: 'tortue verte du jardin' })).status).toBe(204);
    expect((await ctx.request('/api/me', { cookie: a })).status).toBe(200);
    expect((await ctx.request('/api/me', { cookie: b })).status).toBe(401);
    expect((await ctx.request('/api/auth/login', { method: 'POST', json: { username: 'lea', password: u.password } })).status).toBe(401);
    expect((await ctx.request('/api/auth/login', { method: 'POST', json: { username: 'lea', password: 'tortue verte du jardin' } })).status).toBe(200);
    const row = await ctx.deps.db.selectFrom('user').select('passwordChangedAt').where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(row.passwordChangedAt).toBe('2026-10-06T10:00:01.000Z');
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'password_changed').execute()).toHaveLength(1);
  });
  it('mot de passe actuel faux → 401 invalid_credentials, rien ne change', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    const a = await login(ctx, 'lea', u.password);
    const r = await post('/api/auth/password', a, { currentPassword: 'faux faux faux', newPassword: 'tortue verte du jardin' });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'invalid_credentials' });
    expect((await ctx.request('/api/me', { cookie: a })).status).toBe(200);
  });
  it('nouveau mot de passe refusé → 400 password_rejected avec la raison', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    const a = await login(ctx, 'lea', u.password);
    const r = await post('/api/auth/password', a, { currentPassword: u.password, newPassword: 'court' });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'password_rejected', reason: 'too_short' });
  });
  it('admin mustChangePassword : le changement lève la restriction', async () => {
    const u = await createUser(ctx, { username: 'chef', role: 'admin', password: 'abcdefghijklm' });
    const a = await login(ctx, 'chef', u.password);
    expect((await post('/api/auth/password', a, { currentPassword: u.password, newPassword: 'quatorze carac' })).status).toBe(204);
    const me = await (await ctx.request('/api/me', { cookie: a })).json();
    expect(me.mustChangePassword).toBe(false);
    expect((await ctx.request('/api/me', { method: 'PATCH', json: { username: 'chef2' }, cookie: a })).status).toBe(200);
  });
  it('logout ferme la session courante et efface le cookie', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    const a = await login(ctx, 'lea', u.password); const b = await login(ctx, 'lea', u.password);
    const r = await post('/api/auth/logout', a);
    expect(r.status).toBe(204);
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await ctx.request('/api/me', { cookie: a })).status).toBe(401);
    expect((await ctx.request('/api/me', { cookie: b })).status).toBe(200);
  });
  it('logout-all ferme toutes les sessions, y compris la courante (R-AUTH-7)', async () => {
    const u = await createUser(ctx, { username: 'lea' });
    const a = await login(ctx, 'lea', u.password); const b = await login(ctx, 'lea', u.password);
    expect((await post('/api/auth/logout-all', a)).status).toBe(204);
    for (const c of [a, b]) expect((await ctx.request('/api/me', { cookie: c })).status).toBe(401);
    const reasons = await ctx.deps.db.selectFrom('session').select('revokedReason').where('userId', '=', u.id).execute();
    expect(reasons.map((r) => r.revokedReason)).toEqual(['logout_all', 'logout_all']);
  });
});
```
`apps/server/test/auth/me.test.ts` :
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { MeResponse } from '@appsport/contracts';
import { createTestContext, createUser, createUserAndLogin, insertFixtureRow, login, type TestContext } from '@appsport/server/testing';

describe('/api/me', () => {
  let ctx: TestContext;
  beforeEach(async () => { ctx = await createTestContext(); });
  const me = async (cookie: string) => MeResponse.parse(await (await ctx.request('/api/me', { cookie })).json());

  it('ageBand et cautious calculés à la date de Paris (R-AGE-2, R-CST-7)', async () => {
    const u = await createUserAndLogin(ctx, { birthDate: '2008-10-07' });
    expect(await me(u.cookie)).toMatchObject({ birthDate: '2008-10-07', ageBand: 'minor', cautious: true });
    ctx.clock.set('2026-10-06T22:30:00.000Z'); // 7 octobre 00:30 à Paris
    expect(await me(u.cookie)).toMatchObject({ ageBand: 'adult', cautious: false });
  });
  it('cautious vrai avec cautious_mode, ou avec caution sous consentement santé actif', async () => {
    const u = await createUserAndLogin(ctx);
    await insertFixtureRow(ctx.deps.db, 'training_profile', { id: u.id, ownerId: u.id, cautiousMode: 1 });
    expect((await me(u.cookie)).cautious).toBe(true);
    const v = await createUserAndLogin(ctx);
    await insertFixtureRow(ctx.deps.db, 'health_screening', { id: v.id, ownerId: v.id, caution: 1 });
    expect((await me(v.cookie)).cautious).toBe(false);
    await insertFixtureRow(ctx.deps.db, 'consent_event', { ownerId: v.id, type: 'health', action: 'grant', textVersion: '1.0' });
    expect((await me(v.cookie)).cautious).toBe(true);
  });
  it('passwordReminderDue : admin dont le mot de passe a 12 mois ou plus (R-MDP-5)', async () => {
    const a = await createUser(ctx, { role: 'admin', username: 'chef' });
    const m = await createUser(ctx, { username: 'lea' });
    await ctx.deps.db.updateTable('user').set({ passwordChangedAt: '2025-10-06T09:00:00.000Z' }).execute();
    expect((await me(await login(ctx, 'chef', a.password))).passwordReminderDue).toBe(true);
    expect((await me(await login(ctx, 'lea', m.password))).passwordReminderDue).toBe(false);
    await ctx.deps.db.updateTable('user').set({ passwordChangedAt: '2025-10-06T11:00:00.000Z' }).where('id', '=', a.id).execute();
    expect((await me(await login(ctx, 'chef', a.password))).passwordReminderDue).toBe(false);
  });
  it('PATCH /api/me change le pseudo, incrémente rev et journalise (R-CPT-3)', async () => {
    const u = await createUserAndLogin(ctx, { username: 'lea' });
    const before = await ctx.deps.db.selectFrom('user').select('rev').where('id', '=', u.id).executeTakeFirstOrThrow();
    const r = await ctx.request('/api/me', { method: 'PATCH', json: { username: 'Léa.B' }, cookie: u.cookie });
    expect(r.status).toBe(200);
    expect(MeResponse.parse(await r.json()).username).toBe('Léa.B');
    const row = await ctx.deps.db.selectFrom('user').select(['usernameKey', 'rev']).where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(row.usernameKey).toBe('léa.b');
    expect(row.rev).toBeGreaterThan(before.rev);
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'username_changed').execute()).toHaveLength(1);
  });
  it('PATCH /api/me : pseudo pris → 409 username_taken ; invalide → 400 username_invalid', async () => {
    await createUser(ctx, { username: 'Éloïse' });
    const u = await createUserAndLogin(ctx, { username: 'lea' });
    const taken = await ctx.request('/api/me', { method: 'PATCH', json: { username: 'ÉLOÏSE' }, cookie: u.cookie });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'username_taken' });
    const bad = await ctx.request('/api/me', { method: 'PATCH', json: { username: 'ab' }, cookie: u.cookie });
    expect(await bad.json()).toEqual({ error: 'username_invalid', reason: 'length' });
  });
});
```
`apps/server/test/privacy/consent-state.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { createTestContext, createUser, insertFixtureRow } from '@appsport/server/testing';
import { getConsentState, isHealthConsentActive } from '../../src/privacy/consent-state';

describe('getConsentState (R-CST-1)', () => {
  it('inactif sans événement ; dernier événement par type ; égalité d'instant départagée par rev', async () => {
    const ctx = await createTestContext(); const u = await createUser(ctx);
    const off = { active: false, textVersion: null, at: null };
    expect(await getConsentState(ctx.deps.db, u.id)).toEqual({ health: off, ai_coach: off });
    await insertFixtureRow(ctx.deps.db, 'consent_event', { ownerId: u.id, type: 'health', action: 'grant', textVersion: '1.0' });
    expect((await getConsentState(ctx.deps.db, u.id)).health).toEqual({ active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' });
    expect(await isHealthConsentActive(ctx.deps.db, u.id)).toBe(true);
    await insertFixtureRow(ctx.deps.db, 'consent_event', { ownerId: u.id, type: 'health', action: 'withdraw', textVersion: '1.0' });
    expect(await isHealthConsentActive(ctx.deps.db, u.id)).toBe(false);
    expect((await getConsentState(ctx.deps.db, u.id)).ai_coach).toEqual(off);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- limiter login password-change me consent-state`
Échec attendu : `Failed to resolve import "../../src/auth/limiter"` et `createUser is not exported by @appsport/server/testing`.

- [ ] **Step 3: Implement**

- `limiter.ts` : état en mémoire `Map<usernameKey, { consecutive: number; lastFailureAt: number; failures: number[]; lockedUntil: number }>` et `Map<ip, number[]>`, constantes `LOGIN_LIMITS`. Algorithme :
```ts
// check(key, ip) : now = clock.now().getTime()
// waits = [];
// s.lockedUntil > now                         → waits.push(s.lockedUntil - now)
// s.consecutive >= 5                          → d = min(60_000 * 2 ** (s.consecutive - 5), 900_000); waits.push(s.lastFailureAt + d - now)
// ip && ipFailures(ip, now).length >= 30      → waits.push(oldest + 3_600_000 - now)
// w = max(waits) ; w > 0 ? { allowed: false, retryAfterS: Math.ceil(w / 1000) } : { allowed: true }
// recordFailure : consecutive++, lastFailureAt = now, failures = [...failures dans la dernière heure, now] ;
//                 failures.length >= 10 → lockedUntil = now + 3_600_000 ; ip → ajoute now à sa liste (fenêtre 1 h)
// recordSuccess : consecutive = 0 (failures et lockedUntil gardés) ; unlock : supprime l'état du pseudo
```
  `createIpLimiter.hit` compte seulement les essais acceptés dans la fenêtre. `authLimiters(deps)` crée une fois par `deps` `{ login: createLoginLimiter(deps.clock), invitationCheck: createIpLimiter(deps.clock, { limit: CODE_CHECKS_PER_HOUR, windowMs: 3_600_000 }), resetCheck: idem }`.
- `consent-state.ts` : dernier `consent_event` par type, `ORDER BY created_at DESC, rev DESC` ; `active = action === 'grant'`, `at = createdAt`.
- `me.ts` :
  - `buildMe` : `today = parisDate(deps.clock.now())` ; `ageBand = ageBandOn(birthDate, today)` ; `cautious = computeCautious({ ageBand, cautiousMode: profil?.cautiousMode === 1, healthConsentActive, caution: écran non supprimé ? caution === 1 : null })` ; `passwordReminderDue = role === 'admin'` et `passwordChangedAt ?? createdAt` + `ADMIN_PASSWORD_REMINDER_MONTHS` mois calendaires (`setUTCMonth`) ≤ maintenant ; `mustChangePassword = opts?.mustChangePassword ?? false`.
  - `verifyUserPassword` : `verifyPassword` sur `password_hash`, `false` si l'utilisateur n'existe pas.
  - `storeNewPassword` : `password_hash`, `password_changed_at = now`, `writeStamp(trx, deps, userId)` ; annule les liens en attente (`password_reset.cancelled_at = now` où `used_at IS NULL AND cancelled_at IS NULL`).
- `routes.ts` (`authRoutes`) :
  - `POST /login` : `key = usernameKey(username)` ; `authLimiters(deps).login.check(key, ip)` refusé → `login_blocked` (`outcome 'blocked'`, `targetId` si le pseudo existe), `httpError('rate_limited', { retryAfterS })`. Puis vérification. Pour un pseudo inconnu, appeler `verifyPassword` sur une empreinte factice calculée une fois par `deps` avec `deps.config.argon2`, pour égaliser le temps. Échec : `recordFailure`, `login_failed`, `invalid_credentials`. Compte `disabled` : `login_failed` avec `details { reason: 'disabled' }`, `account_disabled`, aucune session. Succès : `recordSuccess`. Le mot de passe est ré-haché avant la transaction si `needsRehash(hash, deps.config.argon2)`. Dans la transaction : mise à jour de `last_login_at` (et de `password_hash` si ré-haché) avec `writeStamp`, `createSession(…, { mustChangePassword: role === 'admin' && passwordLength(password) < PASSWORD_MIN_ADMIN })` et `login_succeeded`. Enfin `setSessionCookie`, puis 200 `buildMe(…, { mustChangePassword })`.
  - `POST /logout` (`requireUser`) : `revokeSession(…, 'logout')`, `logout`, `clearSessionCookie`, 204.
  - `POST /logout-all` (`requireUser`) : `revokeSessions(…, 'logout_all')`, `logout_all`, `clearSessionCookie`, 204.
  - `POST /password` (`requireUser`) : le limiteur de connexion s'applique à la clé du pseudo de session. Un mot de passe actuel faux donne `recordFailure` puis `invalid_credentials`. `validatePassword` refusé → `httpError('password_rejected', { reason })`. Le haché est calculé hors transaction. Dans la transaction : `storeNewPassword`, `revokeSessions(…, 'password_change', sessionId courant)`, `must_change_password = 0` sur la session courante et `password_changed`. Réponse 204.
- `me-routes.ts` (`meRoutes`, toutes les routes sous `requireUser`) : `GET /` → `buildMe` ; `PATCH /` → `validateUsername` (refus : `username_invalid` avec `reason`), unicité de `usernameKey` hors soi (`username_taken`, aussi en cas de violation UNIQUE), mise à jour de `username` (NFC) et `username_key`, `writeStamp`, `username_changed` sans détail, puis 200 `buildMe`.
- `test/support/users.ts` : `createUser` insère directement, sans règle de mot de passe, avec `hashPassword(password, ctx.deps.config.argon2, ctx.deps.ids)` et `writeStamp`. Valeurs : `termsVersion = PRIVACY_POLICY_VERSION`, `termsAcceptedAt = passwordChangedAt = now`. `onboarded` → `onboardingStep 'ready'` et `onboardingCompletedAt = now`. Défauts : `user<N>` avec un compteur par contexte, `'cheval agrafe batterie correcte'`, `'1990-01-01'`, `member`, `active`. `login` envoie `POST /api/auth/login`, lève une erreur si le statut n'est pas 200 et renvoie `nom=valeur` tiré de `Set-Cookie`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- limiter login password-change me consent-state` puis `pnpm typecheck`. Attendu : `Test Files  5 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/auth.ts apps/server/src/auth apps/server/src/privacy/consent-state.ts apps/server/src/routes.ts apps/server/test/support apps/server/test/auth apps/server/test/privacy/consent-state.test.ts
git commit -m "feat(auth): connexion limitée, déconnexion, changement de mot de passe et /api/me"
```

### Task 11: Invitations, création de compte et amorçage

**Files:**
- Create: `apps/server/src/auth/invitations.ts`, `apps/server/src/auth/invitation-routes.ts`, `apps/server/src/auth/bootstrap.ts`
- Create: `packages/contracts/src/api/admin.ts` (partie invitations) ; Modify: `packages/contracts/src/index.ts` (réexporte `./api/admin`)
- Modify: `packages/contracts/src/api/auth.ts` (ajoute `CodeRequest`, `InvitationCheckResponse`, `AcceptInvitationRequest`)
- Modify: `apps/server/src/routes.ts` (`app.route('/api/invitations', invitationRoutes(deps))`, `app.route('/api/admin/invitations', adminInvitationRoutes(deps))`)
- Modify: `apps/server/src/cli.ts` (commande `admin:bootstrap`)
- Test: `apps/server/test/auth/invitation.test.ts`, `apps/server/test/auth/invitation-concurrency.test.ts`, `apps/server/test/auth/bootstrap.test.ts`

**Interfaces:**
- Consumes : T8 (`createSecretCode`, `hashSecret`, `parseSecretCode`, `validateUsername`, `validatePassword`, `usernameKey`, `hashPassword`, `COMMON_PASSWORDS`, `INVITATION_TTL_DAYS`, `BOOTSTRAP_INVITATION_TTL_HOURS`, `INVITATION_NOTE_MAX`, `CivilDate`) ; T9 (`createSession`, `setSessionCookie`, `requireAdmin`, `logSecurityEvent`) ; T10 (`authLimiters`, `buildMe`, `createUserAndLogin`, `createUser`) ; `ageOn`, `parisDate` (domain T2) ; `MIN_AGE`, `PRIVACY_POLICY_VERSION` (T2) ; `writeStamp` (T4) ; `runCli` et la table des commandes (T7, voir interface_gaps) ; `openDatabase` (T3).
- Produces :
```ts
// packages/contracts/src/api/auth.ts (ajouts)
export const CodeRequest = z.object({ code: z.string().min(1).max(300) });
export const InvitationCheckResponse = z.object({ birthDate: CivilDate });
export const AcceptInvitationRequest = z.object({ code: z.string().min(1).max(300), username: z.string().min(1).max(100),
  password: z.string().min(1).max(1024), termsVersion: z.string() });
// packages/contracts/src/api/admin.ts
export const InvitationState = z.enum(['pending', 'used', 'revoked', 'expired']); export type InvitationState = z.infer<typeof InvitationState>;
export const InvitationSummary = z.object({ id: z.string(), note: z.string().nullable(), createdAt: z.string(), expiresAt: z.string(),
  state: InvitationState, usedByUsername: z.string().nullable() });
export const CreateInvitationRequest = z.object({ birthDate: CivilDate, note: z.string().max(INVITATION_NOTE_MAX).optional() });
export const CreateInvitationResponse = z.object({ invitation: InvitationSummary, code: z.string(), link: z.string() });
// apps/server/src/auth/invitations.ts
export type { InvitationState } from '@appsport/contracts';
export function invitationState(row: { usedAt: string | null; revokedAt: string | null; expiresAt: string }, now: Date): InvitationState; // used > revoked > expired > pending
export async function createInvitation(trx: DbExecutor, deps: AppDeps, input: { birthDate: string; note: string | null; createdBy: string | null;
  isAdminBootstrap: boolean; ttlMs: number; ip: string | null }): Promise<CreateInvitationResponse>;   // throw httpError('under_min_age')
export async function listInvitations(db: DbExecutor, deps: AppDeps): Promise<InvitationSummary[]>;  // created_at décroissant
export async function revokeInvitation(trx: DbExecutor, deps: AppDeps, id: string, actor: { actorId: string; ip: string | null }): Promise<void>; // not_found | conflict
export async function checkInvitation(db: DbExecutor, deps: AppDeps, rawCode: string): Promise<InvitationCheckResponse>; // invitation_unknown|expired|used|revoked
export async function acceptInvitation(deps: AppDeps, input: AcceptInvitationRequest, ip: string | null): Promise<{ userId: string; token: string }>;
export function invitationLink(deps: AppDeps, formatted: string): string;   // `${appOrigin}/invite#${formatted}`
// apps/server/src/auth/invitation-routes.ts
export function invitationRoutes(deps: AppDeps): Hono<AppEnv>;       // POST /check, POST /accept (publiques)
export function adminInvitationRoutes(deps: AppDeps): Hono<AppEnv>;  // GET /, POST /, POST /:id/revoke (requireAdmin)
// apps/server/src/auth/bootstrap.ts
export async function bootstrapAdminInvitation(deps: AppDeps, birthDate: string): Promise<{ code: string; link: string; expiresAt: string }>; // throw httpError('conflict', { reason: 'admin_exists' })
```

**Spec:** 02 R-INV-1 à R-INV-9 (R-INV-9 : texte côté client), R-CPT-1, R-CPT-2, R-ROLE-5, R-ARR-1 et R-ARR-2 (côté serveur : le code n'apparaît que dans le corps), §15 n°1, n°2, n°3, n°4 ; 03 P-MIN-1, P-MIN-2, P-AUT-2, §17 n°5 et n°7 ; Review Focus 1 (accept simultanés).

- [ ] **Step 1: Write the failing test**

`apps/server/test/auth/invitation.test.ts` :
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateInvitationResponse, InvitationSummary, MeResponse } from '@appsport/contracts';
import { parseSecretCode } from '@appsport/domain';
import { createLogger } from '../../src/logger';
import { createTestContext, createUserAndLogin, type TestContext } from '@appsport/server/testing';
import { hashSecret } from '../../src/auth/secret';

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
describe('invitations', () => {
  let ctx: TestContext; let admin: { id: string; cookie: string };
  beforeEach(async () => { ctx = await createTestContext(); admin = await createUserAndLogin(ctx, { role: 'admin', username: 'porteur' }); });
  const invite = (body: unknown, cookie = admin.cookie) => ctx.request('/api/admin/invitations', { method: 'POST', json: body, cookie });
  const created = async (birthDate = '1990-01-01', note?: string) => CreateInvitationResponse.parse(await (await invite({ birthDate, note })).json());
  const check = (code: string, ip = '100.64.0.1') => ctx.request('/api/invitations/check', { method: 'POST', json: { code }, ip });
  const accept = (code: string, username: string, password = 'girafe bleue du matin', termsVersion = '1.0') =>
    ctx.request('/api/invitations/accept', { method: 'POST', json: { code, username, password, termsVersion } });
  const list = async () => InvitationSummary.array().parse(await (await ctx.request('/api/admin/invitations', { cookie: admin.cookie })).json());

  it('15 ans et 364 jours → 400 under_min_age ; le jour des 16 ans → 201 (02 §15 n°1)', async () => {
    const r = await invite({ birthDate: '2010-10-07' });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'under_min_age' });
    expect((await invite({ birthDate: '2010-10-06' })).status).toBe(201);
  });
  it('âge calculé à la date de Paris', async () => {
    ctx.clock.set('2026-10-05T22:30:00.000Z');
    expect((await invite({ birthDate: '2010-10-06' })).status).toBe(201);
  });
  it('note de 61 caractères refusée, 60 acceptée ; membre → 403', async () => {
    expect((await invite({ birthDate: '1990-01-01', note: 'x'.repeat(61) })).status).toBe(400);
    expect((await invite({ birthDate: '1990-01-01', note: 'x'.repeat(60) })).status).toBe(201);
    const m = await createUserAndLogin(ctx);
    expect(await (await invite({ birthDate: '1990-01-01' }, m.cookie)).json()).toEqual({ error: 'forbidden' });
  });
  it('code affiché une seule fois, seule l'empreinte est stockée (R-INV-3)', async () => {
    const r = await created('1990-01-01', 'pour Léa');
    expect(r.code).toMatch(CODE_RE);
    expect(r.link).toBe(`https://appsport.test.ts.net/invite#${r.code}`);
    expect(r.invitation).toMatchObject({ note: 'pour Léa', state: 'pending', usedByUsername: null, expiresAt: '2026-10-13T10:00:00.000Z' });
    const row = await ctx.deps.db.selectFrom('invitation').selectAll().executeTakeFirstOrThrow();
    const canonical = parseSecretCode(r.code)!;
    expect(row.codeHash).toBe(hashSecret(canonical));
    expect(JSON.stringify(row)).not.toContain(canonical);
    expect(JSON.stringify(await list())).not.toContain(canonical);
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'invitation_created').execute()).toHaveLength(1);
  });
  it('états pending, revoked, expired, used ; birth_date effacée hors attente (R-INV-7)', async () => {
    const a = await created(); const b = await created(); const c = await created();
    expect((await ctx.request(`/api/admin/invitations/${b.invitation.id}/revoke`, { method: 'POST', json: {}, cookie: admin.cookie })).status).toBe(204);
    expect((await ctx.request(`/api/admin/invitations/${b.invitation.id}/revoke`, { method: 'POST', json: {}, cookie: admin.cookie })).status).toBe(409);
    expect((await accept(c.code, 'lea')).status).toBe(201);
    const states = Object.fromEntries((await list()).map((i) => [i.id, i]));
    expect(states[a.invitation.id]!.state).toBe('pending');
    expect(states[b.invitation.id]!.state).toBe('revoked');
    expect(states[c.invitation.id]).toMatchObject({ state: 'used', usedByUsername: 'lea' });
    const rows = await ctx.deps.db.selectFrom('invitation').select(['id', 'birthDate']).execute();
    expect(Object.fromEntries(rows.map((r) => [r.id, r.birthDate]))).toEqual({ [a.invitation.id]: '1990-01-01', [b.invitation.id]: null, [c.invitation.id]: null });
    ctx.clock.advance(7 * 86_400_000);
    expect(Object.fromEntries((await list()).map((i) => [i.id, i.state]))[a.invitation.id]).toBe('expired');
  });
  it('check : date de naissance ; codes expiré, utilisé, révoqué, inconnu (R-INV-8)', async () => {
    const a = await created('2001-05-04');
    expect(await (await check(a.code.toLowerCase())).json()).toEqual({ birthDate: '2001-05-04' });
    expect(await (await check(`https://appsport.test.ts.net/invite#${a.code}`)).json()).toEqual({ birthDate: '2001-05-04' });
    expect(await (await check('AAAA-AAAA-AAAA-AAAA')).json()).toEqual({ error: 'invitation_unknown' });
    expect(await (await check('pas un code')).json()).toEqual({ error: 'invitation_unknown' });
    const b = await created();
    await ctx.request(`/api/admin/invitations/${b.invitation.id}/revoke`, { method: 'POST', json: {}, cookie: admin.cookie });
    expect(await (await check(b.code)).json()).toEqual({ error: 'invitation_revoked' });
    await accept(a.code, 'lea');
    expect(await (await check(a.code)).json()).toEqual({ error: 'invitation_used' });
    const c = await created(); ctx.clock.advance(7 * 86_400_000);
    const r = await check(c.code);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invitation_expired' });
  });
  it('accept : crée le compte membre, copie la date, enregistre terms_version, ouvre la session, journalise (R-CPT-2)', async () => {
    const inv = await created('2001-05-04');
    const r = await accept(inv.code, 'Éloïse_2');
    expect(r.status).toBe(201);
    const me = MeResponse.parse(await r.json());
    expect(me).toMatchObject({ username: 'Éloïse_2', role: 'member', birthDate: '2001-05-04', termsVersion: '1.0', onboardingCompletedAt: null });
    const cookie = r.headers.get('set-cookie')!.split(';')[0]!;
    expect((await ctx.request('/api/me', { cookie })).status).toBe(200);
    const user = await ctx.deps.db.selectFrom('user').selectAll().where('id', '=', me.id).executeTakeFirstOrThrow();
    expect(user).toMatchObject({ invitationId: inv.invitation.id, termsAcceptedAt: '2026-10-06T10:00:00.000Z', status: 'active' });
    const ev = await ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'invitation_used').executeTakeFirstOrThrow();
    expect(ev).toMatchObject({ actorId: me.id, targetId: me.id, outcome: 'success' });
  });
  it('un échec de validation ne consomme pas l'invitation (R-CPT-1, 02 §15 n°2)', async () => {
    const inv = await created();
    expect(await (await accept(inv.code, 'lea', 'court')).json()).toEqual({ error: 'password_rejected', reason: 'too_short' });
    expect(await (await accept(inv.code, 'Admin')).json()).toEqual({ error: 'username_invalid', reason: 'reserved' });
    expect(await (await accept(inv.code, 'porteur')).json()).toEqual({ error: 'username_taken' });
    expect(await (await accept(inv.code, 'lea', 'girafe bleue du matin', '0.9')).json()).toMatchObject({ error: 'validation' });
    expect((await list()).find((i) => i.id === inv.invitation.id)!.state).toBe('pending');
    expect(await ctx.deps.db.selectFrom('user').select('id').execute()).toHaveLength(1);
    expect((await accept(inv.code, 'lea')).status).toBe(201);
  });
  it('21e vérification par heure et par IP → 429 ; accept compte aussi (R-INV-8)', async () => {
    for (let i = 0; i < 19; i++) expect((await check('AAAA-AAAA-AAAA-AAAA', '100.64.0.7')).status).toBe(400);
    expect((await ctx.request('/api/invitations/accept', { method: 'POST', json: { code: 'AAAA-AAAA-AAAA-AAAA', username: 'lea', password: 'girafe bleue du matin', termsVersion: '1.0' }, ip: '100.64.0.7' })).status).toBe(400);
    const r = await check('AAAA-AAAA-AAAA-AAAA', '100.64.0.7');
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ error: 'rate_limited' });
    expect((await check('AAAA-AAAA-AAAA-AAAA', '100.64.0.8')).status).toBe(400);
    ctx.clock.advance(3_600_000);
    expect((await check('AAAA-AAAA-AAAA-AAAA', '100.64.0.7')).status).toBe(400);
  });
  it('ni le code ni son empreinte n'apparaissent dans les journaux (02 §15 n°4)', async () => {
    const lines: string[] = [];
    ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
    admin = await createUserAndLogin(ctx, { role: 'admin' });
    const inv = await created();
    await check(inv.code); await accept(inv.code, 'lea');
    const canonical = parseSecretCode(inv.code)!;
    const all = lines.join('\n') + JSON.stringify(await ctx.deps.db.selectFrom('securityEvent').selectAll().execute());
    for (const s of [inv.code, canonical, hashSecret(canonical)]) expect(all).not.toContain(s);
  });
});
```
`apps/server/test/auth/invitation-concurrency.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { CreateInvitationResponse } from '@appsport/contracts';
import { createTestContext, createUserAndLogin } from '@appsport/server/testing';

describe('accept simultanés (R-INV-6, Review Focus 1)', () => {
  it('deux accept du même code → un seul compte, l'autre reçoit invitation_used', async () => {
    const ctx = await createTestContext();
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const inv = CreateInvitationResponse.parse(await (await ctx.request('/api/admin/invitations', { method: 'POST', json: { birthDate: '1990-01-01' }, cookie: admin.cookie })).json());
    const accept = (username: string, password = 'girafe bleue du matin') =>
      ctx.request('/api/invitations/accept', { method: 'POST', json: { code: inv.code, username, password, termsVersion: '1.0' } });
    const [a, b] = await Promise.all([accept('lea'), accept('leo')]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(await (a.status === 400 ? a : b).json()).toEqual({ error: 'invitation_used' });
    expect(await ctx.deps.db.selectFrom('user').select('id').where('role', '=', 'member').execute()).toHaveLength(1);
  });
  it('cinq accept simultanés dont un mot de passe refusé → exactement un compte', async () => {
    const ctx = await createTestContext();
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const inv = CreateInvitationResponse.parse(await (await ctx.request('/api/admin/invitations', { method: 'POST', json: { birthDate: '1990-01-01' }, cookie: admin.cookie })).json());
    const res = await Promise.all(['court', 'girafe bleue 1', 'girafe bleue 2', 'girafe bleue 3', 'girafe bleue 4'].map((p, i) =>
      ctx.request('/api/invitations/accept', { method: 'POST', json: { code: inv.code, username: `membre${i}`, password: p, termsVersion: '1.0' } })));
    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await ctx.deps.db.selectFrom('user').select('id').where('role', '=', 'member').execute()).toHaveLength(1);
  });
});
```
`apps/server/test/auth/bootstrap.test.ts` :
```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseSecretCode } from '@appsport/domain';
import { createTestContext, createUser } from '@appsport/server/testing';
import { bootstrapAdminInvitation } from '../../src/auth/bootstrap';
import { hashSecret } from '../../src/auth/secret';
import { runCli } from '../../src/cli';
import { openDatabase } from '../../src/db/open';

const CODE = '[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}';
describe('amorçage admin (R-ROLE-5)', () => {
  let dir = '';
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('bootstrapAdminInvitation : invitation admin de 24 h qui crée un admin', async () => {
    const ctx = await createTestContext();
    const r = await bootstrapAdminInvitation(ctx.deps, '1985-03-02');
    expect(r.expiresAt).toBe('2026-10-07T10:00:00.000Z');
    expect(r.link).toBe(`https://appsport.test.ts.net/invite#${r.code}`);
    const res = await ctx.request('/api/invitations/accept', { method: 'POST', json: { code: r.code, username: 'porteur', password: 'treize carac', termsVersion: '1.0' } });
    expect(await res.json()).toEqual({ error: 'password_rejected', reason: 'too_short' });
    const ok = await ctx.request('/api/invitations/accept', { method: 'POST', json: { code: r.code, username: 'porteur', password: 'quatorze carac', termsVersion: '1.0' } });
    expect((await ok.json()).role).toBe('admin');
  });
  it('refusé s'il existe déjà un admin ; une nouvelle invitation d'amorçage révoque la précédente', async () => {
    const ctx = await createTestContext();
    const first = await bootstrapAdminInvitation(ctx.deps, '1985-03-02');
    await bootstrapAdminInvitation(ctx.deps, '1985-03-02');
    expect(await (await ctx.request('/api/invitations/check', { method: 'POST', json: { code: first.code } })).json()).toEqual({ error: 'invitation_revoked' });
    await createUser(ctx, { role: 'admin' });
    await expect(bootstrapAdminInvitation(ctx.deps, '1985-03-02')).rejects.toMatchObject({ code: 'conflict' });
  });
  it('admin:bootstrap affiche exactement 3 lignes et stocke seulement l'empreinte', async () => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-cli-'));
    writeFileSync(join(dir, '.appsport-volume'), '');
    const env = { APP_ORIGIN: 'https://appsport.test.ts.net', APPSPORT_DATA_DIR: dir };
    expect(await runCli(['init'], env, () => {})).toBe(0);
    const out: string[] = [];
    expect(await runCli(['admin:bootstrap', '--birth-date', '1985-03-02'], env, (l) => out.push(l))).toBe(0);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('Invitation administrateur (valable 24 h)');
    expect(out[1]).toMatch(new RegExp(`^Lien : https://appsport\\.test\\.ts\\.net/invite#${CODE}$`));
    expect(out[2]).toBe(`Code : ${out[1]!.split('#')[1]}`);
    const { sqlite, db } = openDatabase(join(dir, 'appsport.db'));
    const row = await db.selectFrom('invitation').selectAll().executeTakeFirstOrThrow();
    expect(row.codeHash).toBe(hashSecret(parseSecretCode(out[2]!.slice(7))!));
    expect(row).toMatchObject({ isAdminBootstrap: 1, createdBy: null, birthDate: '1985-03-02' });
    expect(Date.parse(row.expiresAt) - Date.parse(row.createdAt)).toBe(24 * 3_600_000);
    sqlite.close();
  });
  it('admin:bootstrap : date absente, invalide ou sous 16 ans → code 1', async () => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-cli-'));
    writeFileSync(join(dir, '.appsport-volume'), '');
    const env = { APP_ORIGIN: 'https://appsport.test.ts.net', APPSPORT_DATA_DIR: dir };
    await runCli(['init'], env, () => {});
    for (const args of [[], ['--birth-date', '1985-02-30'], ['--birth-date', '2015-01-01']]) {
      const out: string[] = [];
      expect(await runCli(['admin:bootstrap', ...args], env, (l) => out.push(l))).toBe(1);
      expect(out).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- invitation bootstrap`
Échec attendu : `Failed to resolve import "../../src/auth/bootstrap"`, puis des 404 sur `/api/admin/invitations`.

- [ ] **Step 3: Implement**

- `createInvitation` : `ageOn(birthDate, parisDate(now)) < MIN_AGE` → `httpError('under_min_age')`. Sinon `createSecretCode(deps.ids)` et insertion de `{ id: uuidv7, codeHash, note, birthDate, isAdminBootstrap, createdBy, createdAt: now, expiresAt: now + ttlMs, usedAt: null, usedBy: null, revokedAt: null }`, puis `invitation_created` (`details { bootstrap: true }` pour l'amorçage). Renvoie `{ invitation, code: formatted, link: invitationLink(deps, formatted) }`.
- `checkInvitation` : `parseSecretCode` ; `null` ou empreinte inconnue → `invitation_unknown`. Sinon l'état `used`, `revoked` ou `expired` donne le code correspondant, et `pending` renvoie `{ birthDate }`.
- `acceptInvitation`, dans cet ordre. (1) Validation Zod faite par la route. (2) `termsVersion !== PRIVACY_POLICY_VERSION` → `httpError('validation', { field: 'termsVersion' })`. (3) Lecture de l'invitation hors transaction : un état autre que `pending` donne son code. (4) `validateUsername` → `username_invalid { reason }` ; `validatePassword` avec le rôle visé (`admin` si `is_admin_bootstrap`) → `password_rejected { reason }`. (5) `hashPassword`, **hors transaction**. (6) Dans `deps.db.transaction()` : relire l'état (`invitation_used` ou autre code), refuser un `usernameKey` déjà pris (`username_taken`), puis `UPDATE invitation SET used_at = now, used_by = :uid, birth_date = NULL WHERE id = :id AND used_at IS NULL AND revoked_at IS NULL`. Si `numUpdatedRows !== 1n` → `httpError('invitation_used')`. Insérer ensuite le `user` : `role`, `status 'active'`, `birthDate` de l'invitation, `termsVersion`, `termsAcceptedAt`, `lastLoginAt` et `passwordChangedAt` = now, `onboardingStep null`, `invitationId`, et `writeStamp(trx, deps, uid)`. Puis `createSession` et `invitation_used` (`actorId = targetId = uid`, `details { invitationId }`). Un échec avant le commit annule tout.
- Routes `invitationRoutes` : `POST /check` et `POST /accept` appellent d'abord `authLimiters(deps).invitationCheck.hit(ip)`, avec un refus en `httpError('rate_limited', { retryAfterS })`. `accept` répond 201 avec `buildMe` et pose le cookie. `adminInvitationRoutes` passe par `use('*', requireAdmin)` : `GET /` renvoie la liste, `POST /` répond 201 (`ttlMs = INVITATION_TTL_DAYS j`, `note ?? null`), et `POST /:id/revoke` répond 204. Pour la révocation, un id inconnu donne `not_found` et un état non `pending` donne `conflict`. Elle met `revoked_at = now` et `birth_date = NULL`, puis écrit `invitation_revoked`.
- `bootstrapAdminInvitation` : un `user` de rôle `admin` existe → `httpError('conflict', { reason: 'admin_exists' })`. Sinon, révocation des invitations d'amorçage encore `pending`, puis `createInvitation(… { createdBy: null, isAdminBootstrap: true, ttlMs: BOOTSTRAP_INVITATION_TTL_HOURS h, note: null, ip: null })` dans une transaction.
- `cli.ts` : la commande `admin:bootstrap --birth-date AAAA-MM-JJ` vérifie la date avec `CivilDate`. Une date absente ou invalide donne sur stderr « Date de naissance invalide : utilise --birth-date AAAA-MM-JJ. » et le code 1. `under_min_age` donne « appsport est réservé aux 16 ans et plus. » et le code 1. `admin_exists` donne « Un administrateur existe déjà : utilise admin:reset <pseudo>. » et le code 1. En cas de succès, la commande écrit les 3 lignes exactes sur `out` et renvoie 0.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- invitation bootstrap` puis `pnpm typecheck`. Attendu : `Test Files  3 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api packages/contracts/src/index.ts apps/server/src/auth apps/server/src/routes.ts apps/server/src/cli.ts apps/server/test/auth
git commit -m "feat(auth): invitations à usage unique, création de compte et amorçage admin"
```

### Task 12: Réinitialisation, gestion des membres et état du serveur

**Files:**
- Create: `apps/server/src/auth/password-reset.ts`
- Modify: `apps/server/src/auth/routes.ts` (ajoute `POST /reset/check`, `POST /reset`)
- Create: `apps/server/src/admin/members.ts`, `apps/server/src/admin/routes.ts`, `apps/server/src/admin/ops-status.ts`
- Create: `packages/contracts/src/ops.ts` ; Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/api/admin.ts` (membres), `packages/contracts/src/api/auth.ts` (reset)
- Modify: `apps/server/src/routes.ts` (`app.route('/api/admin', adminRoutes(deps))`)
- Modify: `apps/server/src/cli.ts` (commande `admin:reset <pseudo>`)
- Test: `apps/server/test/auth/password-reset.test.ts`, `apps/server/test/admin/members.test.ts`, `apps/server/test/admin/ops-status.test.ts`

**Interfaces:**
- Consumes : T8 à T11 (`createSecretCode`, `hashSecret`, `parseSecretCode`, `validatePassword`, `hashPassword`, `COMMON_PASSWORDS`, `RESET_TTL_HOURS`, `createSession`, `setSessionCookie`, `revokeSessions`, `requireAdmin`, `logSecurityEvent`, `authLimiters`, `buildMe`, `verifyUserPassword`, `storeNewPassword`, `getConsentState`, `createUser`, `createUserAndLogin`, `login`) ; `ageOn`, `ageBandOn`, `parisDate` (T2) ; `writeStamp` (T4) ; `runCli` (T7).
- Produces :
```ts
// packages/contracts/src/api/auth.ts (ajouts)
export const ResetCheckResponse = z.object({ username: z.string() });
export const ResetPasswordRequest = z.object({ code: z.string().min(1).max(300), newPassword: z.string().min(1).max(1024) });
// packages/contracts/src/ops.ts
export const OpsCheck = z.object({ at: z.string(), ok: z.boolean(), detail: z.string().optional() });
export const OpsStatus = z.object({ backup: OpsCheck.optional(), restoreTest: OpsCheck.optional(),
  host: OpsCheck.extend({ disks: z.array(z.object({ mount: z.string(), usedPct: z.number() })), smartOk: z.boolean(), rebootRequired: z.boolean() }).optional(),
  deploy: z.object({ at: z.string(), version: z.string(), previousVersion: z.string().nullable(), ok: z.boolean() }).optional() });
// packages/contracts/src/api/admin.ts (ajouts)
export const MemberSummary = z.object({ id: z.string(), username: z.string(), role: RoleSchema, status: UserStatusSchema, isMinor: z.boolean(),
  lastLoginAt: z.string().nullable(), onboardingCompleted: z.boolean(), consents: z.object({ health: z.boolean(), ai_coach: z.boolean() }), activeSessions: z.number().int() }).strict();
export const ResetLinkResponse = z.object({ code: z.string(), link: z.string(), expiresAt: z.string() });
export const SetStatusRequest = z.object({ status: UserStatusSchema });
export const SetRoleRequest = z.object({ role: RoleSchema, password: z.string().min(1).max(1024) });
export const SetBirthDateRequest = z.object({ birthDate: CivilDate });
export const OpsStatusResponse = z.object({ version: z.string(), opsStatus: OpsStatus.nullable() });
// apps/server/src/auth/password-reset.ts
export async function createPasswordReset(trx: DbExecutor, deps: AppDeps, targetUserId: string, actor: { actorId: string | null; ip: string | null }): Promise<ResetLinkResponse>;
export async function checkPasswordReset(db: DbExecutor, deps: AppDeps, rawCode: string): Promise<ResetCheckResponse>;  // throw httpError('reset_invalid')
export async function consumePasswordReset(deps: AppDeps, input: ResetPasswordRequest, ip: string | null): Promise<{ userId: string; token: string }>;
// apps/server/src/admin/members.ts
export async function listMembers(db: DbExecutor, deps: AppDeps): Promise<MemberSummary[]>;   // tri par username_key
export async function assertNotLastAdmin(db: DbExecutor, targetId: string): Promise<void>;     // throw httpError('last_admin') si la cible est le seul admin actif
export async function setRole(trx: DbExecutor, deps: AppDeps, actor: { actorId: string; ip: string | null }, targetId: string, role: Role): Promise<void>;
export async function setStatus(trx: DbExecutor, deps: AppDeps, actor: { actorId: string; ip: string | null }, targetId: string, status: UserStatus): Promise<void>;
export async function setBirthDate(trx: DbExecutor, deps: AppDeps, actor: { actorId: string; ip: string | null }, targetId: string, birthDate: string): Promise<void>;
export async function revokeMemberSessions(trx: DbExecutor, deps: AppDeps, actor: { actorId: string; ip: string | null }, targetId: string): Promise<number>;
// apps/server/src/admin/ops-status.ts
export async function readOpsStatus(dataDir: string): Promise<OpsStatus | null>;   // <dataDir>/ops/status.json ; null si absent ou invalide
// apps/server/src/admin/routes.ts
export function adminRoutes(deps: AppDeps): Hono<AppEnv>;  // use('*', requireAdmin) ; /members*, /ops-status (T13 : /members/:id/delete ; T17 : DELETE /gyms/:id)
```

**Spec:** 02 R-RST-1 à R-RST-4, R-ADM-1, R-ROLE-2, R-ROLE-4, R-ROLE-5 (`admin:reset`), R-AGE-4, R-AUTH-2 (déblocage), R-AUTH-7 (fermeture par l'admin), §6, §15 n°8, n°9 ; 03 P-AUT-5, P-AUT-8, P-MIN-1, P-MIN-2, §5 ; 08 §9.

- [ ] **Step 1: Write the failing test**

`apps/server/test/auth/password-reset.test.ts` :
```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { MeResponse, ResetLinkResponse } from '@appsport/contracts';
import { createTestContext, createUser, createUserAndLogin, login, type TestContext } from '@appsport/server/testing';
import { runCli } from '../../src/cli';

describe('réinitialisation (02 §15 n°8)', () => {
  let ctx: TestContext; let admin: { id: string; cookie: string };
  beforeEach(async () => { ctx = await createTestContext(); admin = await createUserAndLogin(ctx, { role: 'admin', username: 'porteur' }); });
  const link = async (id: string) => ResetLinkResponse.parse(await (await ctx.request(`/api/admin/members/${id}/reset-link`, { method: 'POST', json: {}, cookie: admin.cookie })).json());
  const check = (code: string) => ctx.request('/api/auth/reset/check', { method: 'POST', json: { code } });
  const reset = (code: string, newPassword = 'tortue verte du jardin') => ctx.request('/api/auth/reset', { method: 'POST', json: { code, newPassword } });

  it('lien à usage unique, valable 24 h ; l'usage ferme toutes les sessions et connecte', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    const old = await login(ctx, 'lea', m.password);
    const r = await link(m.id);
    expect(r.link).toBe(`https://appsport.test.ts.net/reset#${r.code}`);
    expect(r.expiresAt).toBe('2026-10-07T10:00:00.000Z');
    expect(await (await check(r.code.toLowerCase())).json()).toEqual({ username: 'lea' });
    const res = await reset(r.code);
    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json()).id).toBe(m.id);
    expect((await ctx.request('/api/me', { cookie: res.headers.get('set-cookie')!.split(';')[0]! })).status).toBe(200);
    expect((await ctx.request('/api/me', { cookie: old })).status).toBe(401);
    expect(await (await reset(r.code)).json()).toEqual({ error: 'reset_invalid' });
    const types = (await ctx.deps.db.selectFrom('securityEvent').select('type').execute()).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['password_reset_created', 'password_reset_used']));
  });
  it('expiré après 24 h', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    const r = await link(m.id);
    ctx.clock.advance(24 * 3_600_000);
    expect(await (await check(r.code)).json()).toEqual({ error: 'reset_invalid' });
  });
  it('un nouveau lien annule le précédent ; un changement de mot de passe aussi (R-RST-2)', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    const l1 = await link(m.id); const l2 = await link(m.id);
    expect(await (await check(l1.code)).json()).toEqual({ error: 'reset_invalid' });
    expect((await check(l2.code)).status).toBe(200);
    const c = await login(ctx, 'lea', m.password);
    await ctx.request('/api/auth/password', { method: 'POST', json: { currentPassword: m.password, newPassword: 'tortue verte du jardin' }, cookie: c });
    expect(await (await check(l2.code)).json()).toEqual({ error: 'reset_invalid' });
  });
  it('l'usage débloque le limiteur de connexion', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    for (let i = 1; i <= 10; i++) {
      await ctx.request('/api/auth/login', { method: 'POST', json: { username: 'lea', password: 'faux faux faux' } });
      if (i >= 5 && i < 10) ctx.clock.advance(Math.min(60_000 * 2 ** (i - 5), 900_000));
    }
    const r = await link(m.id);
    expect((await reset(r.code)).status).toBe(200);
    expect((await ctx.request('/api/auth/login', { method: 'POST', json: { username: 'lea', password: 'tortue verte du jardin' } })).status).toBe(200);
  });
  it('mot de passe refusé : 400 password_rejected, lien intact', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    const r = await link(m.id);
    expect(await (await reset(r.code, 'lea lea lea lea')).json()).toEqual({ error: 'password_rejected', reason: 'contains_username' });
    expect((await check(r.code)).status).toBe(200);
  });
  it('un admin ne peut pas générer de lien pour lui-même (R-RST-4)', async () => {
    const r = await ctx.request(`/api/admin/members/${admin.id}/reset-link`, { method: 'POST', json: {}, cookie: admin.cookie });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'reset_self_forbidden' });
  });
  it('admin:reset <pseudo> affiche 3 lignes ; pseudo inconnu → 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'appsport-cli-'));
    try {
      writeFileSync(join(dir, '.appsport-volume'), '');
      const env = { APP_ORIGIN: 'https://appsport.test.ts.net', APPSPORT_DATA_DIR: dir };
      await runCli(['init'], env, () => {});
      const boot: string[] = [];
      await runCli(['admin:bootstrap', '--birth-date', '1985-03-02'], env, (l) => boot.push(l));
      // compte créé via le serveur de test pointé sur ce fichier : voir Step 3 (helper acceptInvitation direct)
      const out: string[] = [];
      expect(await runCli(['admin:reset', 'inconnu'], env, (l) => out.push(l))).toBe(1);
      expect(out).toEqual([]);
    } finally { try { rmSync(dir, { recursive: true, force: true }); } catch {} }
  });
});
```
Le cas nominal de `admin:reset` va dans un second test du même fichier. Après `init` et `admin:bootstrap`, il ouvre la base par `openDatabase`, construit les `AppDeps` avec `createTestContext({ deps: { db, sqlite } })` puis appelle `acceptInvitation(ctx.deps, { code, username: 'porteur', password: 'quatorze carac', termsVersion: '1.0' }, null)`. Il vérifie ensuite :
```ts
expect(await runCli(['admin:reset', 'PORTEUR'], env, (l) => out.push(l))).toBe(0);
expect(out).toHaveLength(3);
expect(out[0]).toBe('Lien de réinitialisation pour porteur (valable 24 h)');
expect(out[1]).toMatch(/^Lien : https:\/\/appsport\.test\.ts\.net\/reset#[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
expect(out[2]).toBe(`Code : ${out[1]!.split('#')[1]}`);
```
`apps/server/test/admin/members.test.ts` :
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { MemberSummary } from '@appsport/contracts';
import { createTestContext, createUser, createUserAndLogin, insertFixtureRow, login, type TestContext } from '@appsport/server/testing';

describe('gestion des membres', () => {
  let ctx: TestContext; let admin: { id: string; password: string; cookie: string };
  beforeEach(async () => { ctx = await createTestContext(); admin = await createUserAndLogin(ctx, { role: 'admin', username: 'porteur' }); });
  const post = (path: string, json: unknown = {}, cookie = admin.cookie) => ctx.request(path, { method: 'POST', json, cookie });

  it('liste : champs C0 seulement, mineur, onboarding, consentements, sessions actives (02 §6)', async () => {
    const m = await createUser(ctx, { username: 'lea', birthDate: '2009-01-01', onboarded: true });
    await login(ctx, 'lea', m.password); await login(ctx, 'lea', m.password);
    await insertFixtureRow(ctx.deps.db, 'consent_event', { ownerId: m.id, type: 'health', action: 'grant', textVersion: '1.0' });
    const res = await ctx.request('/api/admin/members', { cookie: admin.cookie });
    const list = MemberSummary.array().parse(await res.json());
    expect(list.map((x) => x.username)).toEqual(['lea', 'porteur']);
    expect(list[0]).toEqual({ id: m.id, username: 'lea', role: 'member', status: 'active', isMinor: true, lastLoginAt: '2026-10-06T10:00:00.000Z',
      onboardingCompleted: true, consents: { health: true, ai_coach: false }, activeSessions: 2 });
  });
  it('membre → 403 forbidden sur /api/admin/* (R-ROLE-4)', async () => {
    const m = await createUserAndLogin(ctx);
    expect(await (await ctx.request('/api/admin/members', { cookie: m.cookie })).json()).toEqual({ error: 'forbidden' });
  });
  it('impossible de rétrograder ou désactiver le dernier admin actif (R-ROLE-2, 02 §15 n°9)', async () => {
    expect(await (await post(`/api/admin/members/${admin.id}/role`, { role: 'member', password: admin.password })).json()).toEqual({ error: 'last_admin' });
    expect(await (await post(`/api/admin/members/${admin.id}/status`, { status: 'disabled' })).json()).toEqual({ error: 'last_admin' });
    await createUser(ctx, { role: 'admin', status: 'disabled' });
    expect((await post(`/api/admin/members/${admin.id}/status`, { status: 'disabled' })).status).toBe(409);
    await createUser(ctx, { role: 'admin' });
    expect((await post(`/api/admin/members/${admin.id}/role`, { role: 'member', password: admin.password })).status).toBe(204);
  });
  it('changement de rôle : exige le mot de passe de l'admin, journalisé (P-AUT-5)', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    expect(await (await post(`/api/admin/members/${m.id}/role`, { role: 'admin', password: 'faux faux faux' })).json()).toEqual({ error: 'invalid_credentials' });
    expect((await post(`/api/admin/members/${m.id}/role`, { role: 'admin', password: admin.password })).status).toBe(204);
    const row = await ctx.deps.db.selectFrom('user').select(['role', 'updatedBy']).where('id', '=', m.id).executeTakeFirstOrThrow();
    expect(row).toEqual({ role: 'admin', updatedBy: admin.id });
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'role_changed').execute()).toHaveLength(1);
  });
  it('désactivation : sessions fermées, connexion refusée, réversible (R-ADM-1)', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    const c = await login(ctx, 'lea', m.password);
    expect((await post(`/api/admin/members/${m.id}/status`, { status: 'disabled' })).status).toBe(204);
    expect((await ctx.request('/api/me', { cookie: c })).status).toBe(401);
    expect(await (await ctx.request('/api/auth/login', { method: 'POST', json: { username: 'lea', password: m.password } })).json()).toEqual({ error: 'account_disabled' });
    expect((await post(`/api/admin/members/${m.id}/status`, { status: 'active' })).status).toBe(204);
    expect((await ctx.request('/api/auth/login', { method: 'POST', json: { username: 'lea', password: m.password } })).status).toBe(200);
  });
  it('correction de date de naissance : refusée sous 16 ans, journalisée sinon (R-AGE-4)', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    expect(await (await post(`/api/admin/members/${m.id}/birth-date`, { birthDate: '2010-10-07' })).json()).toEqual({ error: 'under_min_age' });
    expect((await post(`/api/admin/members/${m.id}/birth-date`, { birthDate: '2009-01-01' })).status).toBe(204);
    expect((await ctx.deps.db.selectFrom('user').select('birthDate').where('id', '=', m.id).executeTakeFirstOrThrow()).birthDate).toBe('2009-01-01');
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'birth_date_corrected').execute()).toHaveLength(1);
  });
  it('fermeture des sessions d'un membre (R-AUTH-7)', async () => {
    const m = await createUser(ctx, { username: 'lea' });
    const c = await login(ctx, 'lea', m.password);
    expect((await post(`/api/admin/members/${m.id}/revoke-sessions`)).status).toBe(204);
    expect((await ctx.request('/api/me', { cookie: c })).status).toBe(401);
    expect(await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'sessions_revoked').execute()).toHaveLength(1);
  });
  it('membre inconnu → 404 not_found', async () => {
    expect(await (await post('/api/admin/members/01890000-0000-7000-8000-000000000000/status', { status: 'disabled' })).json()).toEqual({ error: 'not_found' });
  });
});
```
`apps/server/test/admin/ops-status.test.ts` :
```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestContext, createUserAndLogin } from '@appsport/server/testing';
import { readOpsStatus } from '../../src/admin/ops-status';

describe('état du serveur (08 §9)', () => {
  it('readOpsStatus : null si absent ou invalide, sinon le contenu validé', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'appsport-ops-'));
    expect(await readOpsStatus(dir)).toBeNull();
    mkdirSync(join(dir, 'ops'));
    writeFileSync(join(dir, 'ops', 'status.json'), '{ pas du json');
    expect(await readOpsStatus(dir)).toBeNull();
    writeFileSync(join(dir, 'ops', 'status.json'), JSON.stringify({ backup: { at: 'x', ok: 'oui' } }));
    expect(await readOpsStatus(dir)).toBeNull();
    const status = { backup: { at: '2026-10-06T03:31:00Z', ok: true }, deploy: { at: '2026-10-01T20:00:00Z', version: 'v1.0.0', previousVersion: null, ok: true } };
    writeFileSync(join(dir, 'ops', 'status.json'), JSON.stringify(status));
    expect(await readOpsStatus(dir)).toEqual(status);
  });
  it('GET /api/admin/ops-status : version et opsStatus', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'appsport-ops-'));
    const ctx = await createTestContext({ config: { dataDir: dir, version: 'v1.2.3' } });
    const a = await createUserAndLogin(ctx, { role: 'admin' });
    expect(await (await ctx.request('/api/admin/ops-status', { cookie: a.cookie })).json()).toEqual({ version: 'v1.2.3', opsStatus: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- password-reset members ops-status`
Échec attendu : `Failed to resolve import "../../src/admin/ops-status"` et des 404 sur `/api/admin/members`.

- [ ] **Step 3: Implement**

- `createPasswordReset` : cible inconnue → `not_found`. Les liens en attente de la cible sont annulés (`cancelled_at = now`). Insertion de `{ id, userId, codeHash, createdBy: actor.actorId, createdAt: now, expiresAt: now + RESET_TTL_HOURS h }`, puis `password_reset_created` (`targetId` = cible). Renvoie `{ code: formatted, link: \`${appOrigin}/reset#${formatted}\`, expiresAt }`.
- `checkPasswordReset` : code illisible, inconnu, utilisé, annulé ou expiré (`expiresAt <= now`) → `reset_invalid` ; sinon `{ username }`.
- `consumePasswordReset` : `checkPasswordReset` charge l'utilisateur. Compte `disabled` → `account_disabled`. Puis `validatePassword` avec le rôle de la cible (`password_rejected { reason }`) et `hashPassword` **hors transaction**. Dans la transaction : `UPDATE password_reset SET used_at = now WHERE id = :id AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now`. Une ligne modifiée ≠ 1 → `reset_invalid`. Ensuite `storeNewPassword`, `revokeSessions(…, 'password_reset')`, `createSession` et `password_reset_used`. Après le commit : `authLimiters(deps).login.unlock(usernameKey)`.
- Routes reset dans `authRoutes` : `POST /reset/check` et `POST /reset` passent d'abord par `authLimiters(deps).resetCheck.hit(ip)` (`rate_limited`). `/reset` répond 200 avec `buildMe` et pose le cookie.
- `members.ts` :
  - `listMembers` : `isMinor = ageBandOn(birthDate, parisDate(now)) === 'minor'` ; `onboardingCompleted = onboardingCompletedAt !== null` ; `consents.*` repris de `getConsentState(…).*.active` ; `activeSessions` = sessions non révoquées, `expiresAt > now`, `lastSeenAt + 90 j > now`. Aucune lecture de `training_profile`, `place` ni d'une autre table C1 à C3.
  - `assertNotLastAdmin` : la cible est `admin` et `active`, et aucun autre utilisateur n'est `admin` et `active` → `last_admin`.
  - `setRole` : `assertNotLastAdmin` seulement en cas de rétrogradation, puis mise à jour avec `writeStamp(trx, deps, actorId)` et `role_changed` (`details { role }`).
  - `setStatus` : `assertNotLastAdmin` seulement pour `disabled`. Mise à jour avec `writeStamp`. Pour `disabled`, appel de `revokeSessions(…, 'admin')`. Journal `status_changed` (`details { status }`).
  - `setBirthDate` : `ageOn(birthDate, parisDate(now)) < MIN_AGE` → `under_min_age` sans journal ; sinon mise à jour avec `writeStamp` et `birth_date_corrected` sans détail.
  - `revokeMemberSessions` : `revokeSessions(…, 'admin')` et `sessions_revoked` (`details { count }`).
  - Toutes ces fonctions répondent `not_found` pour une cible inconnue.
- `admin/routes.ts` (`use('*', requireAdmin)`) :
  - `GET /members` ;
  - `POST /members/:id/reset-link` : `:id` = soi → `reset_self_forbidden` ;
  - `POST /members/:id/revoke-sessions` ;
  - `POST /members/:id/status` ;
  - `POST /members/:id/role` : `verifyUserPassword(admin, password)` faux → `invalid_credentials` ;
  - `POST /members/:id/birth-date` ;
  - `GET /ops-status` → `{ version: deps.config.version, opsStatus: await readOpsStatus(deps.config.dataDir) }`.
  - Les mutations répondent 204 et s'exécutent chacune dans une transaction.
- `readOpsStatus` : `readFile(join(dataDir, 'ops', 'status.json'), 'utf8')`, `JSON.parse`, `OpsStatus.safeParse`. Toute erreur → `null`.
- `cli.ts`, commande `admin:reset <pseudo>`. L'utilisateur est cherché par `usernameKey`. S'il est absent : « Pseudo inconnu : <pseudo> » sur stderr et code 1. Sinon `createPasswordReset(…, { actorId: null, ip: null })` dans une transaction, puis 3 lignes sur `out` : `Lien de réinitialisation pour <username stocké> (valable 24 h)`, `Lien : <link>` et `Code : <code>`. Code de sortie 0.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- password-reset members ops-status` puis `pnpm typecheck`. Attendu : `Test Files  3 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src apps/server/src/auth apps/server/src/admin apps/server/src/routes.ts apps/server/src/cli.ts apps/server/test/auth/password-reset.test.ts apps/server/test/admin
git commit -m "feat(admin): liens de réinitialisation, gestion des membres et état du serveur"
```

### Task 13: Export, suppression du compte, isolation admin et purge

**Files:**
- Create: `apps/server/src/privacy/export.ts`, `apps/server/src/privacy/delete-account.ts`, `apps/server/src/auth/purge.ts`
- Create: `packages/contracts/src/api/export.ts` ; Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/api/auth.ts` (`DeleteAccountRequest`), `packages/contracts/src/api/admin.ts` (`AdminDeleteMemberRequest`)
- Modify: `apps/server/src/auth/me-routes.ts` (`GET /export`, `POST /delete`)
- Modify: `apps/server/src/admin/routes.ts` (`POST /members/:id/delete`)
- Modify: `apps/server/src/jobs/registry.ts` (ajoute `authPurgeJob` à `DAILY_JOBS`)
- Test: `apps/server/test/privacy/export.test.ts`, `apps/server/test/privacy/delete.test.ts`, `apps/server/test/privacy/admin-isolation.test.ts`, `apps/server/test/auth/purge.test.ts`

**Interfaces:**
- Consumes : `entityRules`, `EntityRulesMap`, `rowToCamel` (T5) ; `tableKey`, `Migration` (T4) ; `DAILY_JOBS`, `DailyJob` (T7) ; T9 à T12 (`logSecurityEvent`, `clearSessionCookie`, `requireUser`, `requireAdmin`, `verifyUserPassword`, `assertNotLastAdmin`, `createUser`, `createUserAndLogin`, `login`) ; `insertFixtureRow` (T5) ; `CLOSED_AUTH_RECORD_RETENTION_DAYS`, `SECURITY_EVENT_RETENTION_MONTHS`, `SESSION_IDLE_DAYS` (T8).
- Produces :
```ts
// packages/contracts/src/api/export.ts
export const EXPORT_FORMAT = 'appsport-export/1';
export const ExportV1 = z.object({ format: z.literal(EXPORT_FORMAT), exportedAt: z.string(), account: z.record(z.string(), z.unknown()),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))), gyms: z.array(z.record(z.string(), z.unknown())),
  gymHistory: z.array(z.record(z.string(), z.unknown())) });
// packages/contracts/src/api/auth.ts / admin.ts (ajouts)
export const DeleteAccountRequest = z.object({ password: z.string().min(1).max(1024) });
export const AdminDeleteMemberRequest = z.object({ confirmUsername: z.string().min(1).max(100) });
// apps/server/src/privacy/export.ts
export async function buildExport(db: DbExecutor, deps: AppDeps, userId: string): Promise<ExportV1>;   // lit deps.entityRules
// apps/server/src/privacy/delete-account.ts
export async function deleteAccount(trx: Transaction<Database>, deps: AppDeps, userId: string, actor: { actorId: string | null; ip: string | null }): Promise<void>; // not_found | last_admin
// apps/server/src/auth/purge.ts
export const authPurgeJob: DailyJob;   // name 'auth-purge'
```
Valeurs d'export fixées **[décision plan]** : `tables` est indexé par le nom SQL de la table. Les lignes ont des clés camelCase et des valeurs telles que stockées : 0/1, et JSON en texte.

**Spec:** 02 R-EXP-1, R-EXP-2, R-SUP-1 à R-SUP-6, R-REG-1, §15 n°14, n°18, n°19 ; 03 P-CAT-2, P-DRT-1, P-DRT-3, P-DRT-4, P-DRT-5, P-ADM-1, P-ADM-2, §7 (conservation), §17 n°1, n°9, n°12 ; 01 R-SYN-24.

- [ ] **Step 1: Write the failing test**

`apps/server/test/privacy/export.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { entityRules, ExportV1 } from '@appsport/contracts';
import { createTestContext, createUser, createUserAndLogin, insertFixtureRow } from '@appsport/server/testing';
import type { Migration } from '../../src/db/migrations';
import { buildExport } from '../../src/privacy/export';

describe('export appsport-export/1 (R-EXP-1, R-EXP-2, P-DRT-1)', () => {
  it('parcourt les tables exportées du registre, sans secret ni session, avec salles et historique de l'utilisateur', async () => {
    const ctx = await createTestContext();
    const u = await createUserAndLogin(ctx, { username: 'lea' });
    const other = await createUser(ctx, { username: 'leo' });
    await insertFixtureRow(ctx.deps.db, 'consent_event', { ownerId: u.id, type: 'health', action: 'grant', textVersion: '1.0' });
    await insertFixtureRow(ctx.deps.db, 'training_profile', { id: u.id, ownerId: u.id });
    const gym = await insertFixtureRow(ctx.deps.db, 'gym', { createdBy: other.id });
    const lonely = await insertFixtureRow(ctx.deps.db, 'gym', {});
    const place = await insertFixtureRow(ctx.deps.db, 'place', { ownerId: u.id, kind: 'gym', gymId: gym.id });
    await insertFixtureRow(ctx.deps.db, 'place', { ownerId: other.id, kind: 'gym', gymId: lonely.id });
    const mine = await insertFixtureRow(ctx.deps.db, 'gym_history', { gymId: gym.id, authorId: u.id });
    await insertFixtureRow(ctx.deps.db, 'gym_history', { gymId: gym.id, authorId: other.id });
    const res = await ctx.request('/api/me/export', { cookie: u.cookie });
    expect(res.status).toBe(200);
    const exp = ExportV1.parse(await res.json());
    expect(exp.format).toBe('appsport-export/1');
    expect(exp.exportedAt).toBe('2026-10-06T10:00:00.000Z');
    expect(exp.account).toMatchObject({ id: u.id, username: 'lea' });
    expect(exp.account).not.toHaveProperty('passwordHash');
    const expected = Object.entries(entityRules).filter(([t, r]) => r.exported && t !== 'user').map(([t]) => t).sort();
    expect(Object.keys(exp.tables).sort()).toEqual(expected);
    expect(exp.tables).not.toHaveProperty('session');
    expect(exp.tables.place!.map((r) => r.id)).toEqual([place.id]);
    expect(exp.tables.consent_event).toHaveLength(1);
    expect(exp.gyms.map((g) => g.id)).toEqual([gym.id]);
    expect(exp.gymHistory.map((h) => h.id)).toEqual([mine.id]);
    expect(JSON.stringify(exp)).not.toContain('$argon2id');
    const ev = await ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'data_exported').executeTakeFirstOrThrow();
    expect(ev).toMatchObject({ actorId: u.id, targetId: u.id, details: null });
  });
  it('une table ajoutée au registre avec exported: true est exportée sans changer le code', async () => {
    const fixture: Migration = { id: '9001_fixture_export', breaking: false, async up(db) {
      await db.schema.createTable('fixture_export').addColumn('id', 'text', (c) => c.primaryKey()).addColumn('owner_id', 'text', (c) => c.notNull())
        .addColumn('secret_hash', 'text').addColumn('label', 'text').modifyEnd(sql`STRICT`).execute(); } };
    const rules = { ...entityRules, fixture_export: { category: 'C1', syncClass: 'H', ownerColumn: 'owner_id', columns: ['id', 'owner_id', 'secret_hash', 'label'],
      clientWritable: [], c2Columns: [], secretColumns: ['secret_hash'], exported: true, onUserDelete: 'cascade' } } as const;
    const ctx = await createTestContext({ extraMigrations: [fixture], entityRules: rules });
    const u = await createUser(ctx);
    ctx.deps.sqlite.prepare("INSERT INTO fixture_export VALUES ('f1', ?, 'h', 'témoin')").run(u.id);
    const exp = await buildExport(ctx.deps.db, ctx.deps, u.id);
    expect(exp.tables.fixture_export).toEqual([{ id: 'f1', ownerId: u.id, label: 'témoin' }]);
  });
});
```
(importer `sql` depuis `kysely`.)

`apps/server/test/privacy/delete.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { entityRules } from '@appsport/contracts';
import { createTestContext, createUser, createUserAndLogin, insertFixtureRow, login, type TestContext } from '@appsport/server/testing';

async function plantEverything(ctx: TestContext, userId: string) {
  for (const [table, rule] of Object.entries(entityRules)) {
    if (table === 'user' || (rule.ownerColumn !== 'owner_id' && rule.ownerColumn !== 'user_id')) continue;
    const col = rule.ownerColumn === 'owner_id' ? 'ownerId' : 'userId';
    await insertFixtureRow(ctx.deps.db, table, table === 'training_profile' || table === 'health_screening' ? { id: userId, [col]: userId } : { [col]: userId });
  }
  const gym = await insertFixtureRow(ctx.deps.db, 'gym', { createdBy: userId, updatedBy: userId });
  await insertFixtureRow(ctx.deps.db, 'gym_equipment', { gymId: gym.id, addedBy: userId });
  await insertFixtureRow(ctx.deps.db, 'gym_history', { gymId: gym.id, authorId: userId });
  await insertFixtureRow(ctx.deps.db, 'invitation', { usedBy: userId });
}
function countReferences(ctx: TestContext, userId: string): string[] {
  const hits: string[] = [];
  const tables = ctx.deps.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const { name } of tables) {
    if (name === 'security_event') continue;
    for (const { name: col } of ctx.deps.sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]) {
      const n = (ctx.deps.sqlite.prepare(`SELECT count(*) AS n FROM "${name}" WHERE "${col}" = ?`).get(userId) as { n: number }).n;
      if (n > 0) hits.push(`${name}.${col}`);
    }
  }
  return hits;
}

describe('suppression du compte (R-SUP-1 à R-SUP-6, P-DRT-3)', () => {
  it('par l'utilisateur : une transaction, plus aucune référence hors security_event (02 §15 n°18)', async () => {
    const ctx = await createTestContext();
    await createUser(ctx, { role: 'admin' });
    const u = await createUserAndLogin(ctx, { username: 'lea' });
    const other = await login(ctx, 'lea', u.password);
    await plantEverything(ctx, u.id);
    expect(await (await ctx.request('/api/me/delete', { method: 'POST', json: { password: 'faux faux faux' }, cookie: u.cookie })).json()).toEqual({ error: 'invalid_credentials' });
    const res = await ctx.request('/api/me/delete', { method: 'POST', json: { password: u.password }, cookie: u.cookie });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(countReferences(ctx, u.id)).toEqual([]);
    const fks = ctx.deps.sqlite.prepare("SELECT m.name AS t, p.\"from\" AS c FROM sqlite_schema m, pragma_foreign_key_list(m.name) p WHERE m.type = 'table' AND p.\"table\" = 'user'").all() as { t: string; c: string }[];
    expect(fks.length).toBeGreaterThan(0);
    for (const { t, c } of fks) expect(ctx.deps.sqlite.prepare(`SELECT count(*) AS n FROM "${t}" WHERE "${c}" = ?`).get(u.id)).toEqual({ n: 0 });
    const sessions = await ctx.deps.db.selectFrom('session').select(['userId', 'revokedReason']).execute();
    expect(sessions.filter((s) => s.revokedReason === 'account_deleted')).toHaveLength(2);
    expect(sessions.every((s) => s.revokedReason !== 'account_deleted' || s.userId === null)).toBe(true);
    expect(await ctx.deps.db.selectFrom('gym').select('id').execute()).toHaveLength(1);
    expect((await ctx.deps.db.selectFrom('gymHistory').select('authorId').executeTakeFirstOrThrow()).authorId).toBeNull();
    const ev = await ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'account_deleted').executeTakeFirstOrThrow();
    expect(ev).toMatchObject({ targetId: u.id, details: null });
    const r = await ctx.request('/api/me', { cookie: other });
    expect(r.status).toBe(410);
    expect(await r.json()).toEqual({ error: 'account_deleted' });
  });
  it('seul « session » est anonymisée ; toute autre table liée est en cascade (R-REG-1)', () => {
    expect(Object.entries(entityRules).filter(([, r]) => r.onUserDelete === 'anonymize').map(([t]) => t)).toEqual(['session']);
  });
  it('par un admin avec confirmation du pseudo (R-SUP-2)', async () => {
    const ctx = await createTestContext();
    const a = await createUserAndLogin(ctx, { role: 'admin' });
    const m = await createUser(ctx, { username: 'Léa' });
    const post = (json: unknown) => ctx.request(`/api/admin/members/${m.id}/delete`, { method: 'POST', json, cookie: a.cookie });
    expect(await (await post({ confirmUsername: 'leo' })).json()).toMatchObject({ error: 'validation' });
    expect((await post({ confirmUsername: 'LÉA' })).status).toBe(204);
    expect(await ctx.deps.db.selectFrom('user').select('id').where('id', '=', m.id).execute()).toEqual([]);
  });
  it('le dernier admin ne peut pas se supprimer (R-SUP-4, P-DRT-5)', async () => {
    const ctx = await createTestContext();
    const a = await createUserAndLogin(ctx, { role: 'admin' });
    const r = await ctx.request('/api/me/delete', { method: 'POST', json: { password: a.password }, cookie: a.cookie });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'last_admin' });
    expect((await ctx.request(`/api/admin/members/${a.id}/delete`, { method: 'POST', json: { confirmUsername: a.username }, cookie: a.cookie })).status).toBe(409);
  });
});
```
`apps/server/test/privacy/admin-isolation.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { entityRules } from '@appsport/contracts';
import { createTestContext, createUser, createUserAndLogin, insertFixtureRow } from '@appsport/server/testing';

describe('isolation admin (P-ADM-1, P-ADM-2, 02 §15 n°14, 03 §17 n°1)', () => {
  it('aucune route /api/admin/* ne renvoie une ligne C1 à C3 d'un autre ; /api/me/*/:id et /api/places/:id d'un autre → 404', async () => {
    const ctx = await createTestContext();
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const b = await createUser(ctx, { username: 'lea' });
    const witnesses: string[] = []; const rowIds: string[] = [];
    const special: Record<string, Record<string, unknown>> = {
      training_profile: { id: b.id, sportOtherLabel: 'TEMOIN_TP' }, health_screening: { id: b.id, questionnaireVersion: 'TEMOIN_HS' }, limitation: { note: 'TEMOIN_LIM' } };
    for (const [table, rule] of Object.entries(entityRules)) {
      if (!['C1', 'C2', 'C3'].includes(rule.category) || (rule.ownerColumn !== 'owner_id' && rule.ownerColumn !== 'user_id')) continue;
      const owner = rule.ownerColumn === 'owner_id' ? { ownerId: b.id } : { userId: b.id };
      const row = await insertFixtureRow(ctx.deps.db, table, { ...owner, ...special[table] });
      if (row.id !== b.id) { witnesses.push(String(row.id)); rowIds.push(String(row.id)); }
      for (const v of Object.values(special[table] ?? {})) if (typeof v === 'string' && v.startsWith('TEMOIN')) witnesses.push(v);
    }
    expect(witnesses.length).toBeGreaterThanOrEqual(6);
    const routes = ctx.app.routes.filter((r) => r.method !== 'ALL' && !r.path.includes('*'));
    const adminRoutes = routes.filter((r) => r.path.startsWith('/api/admin/') && !r.path.endsWith('/delete'));
    expect(adminRoutes.map((r) => r.path)).toContain('/api/admin/members');
    for (const r of adminRoutes) {
      const path = r.path.replace(':id', b.id).replace(/:[a-zA-Z]+/g, 'dumbbells');
      const res = await ctx.request(path, { method: r.method, cookie: admin.cookie, ...(r.method === 'GET' ? {} : { json: {} }) });
      const body = await res.text();
      for (const w of witnesses) expect(body, `${r.method} ${r.path}`).not.toContain(w);
    }
    const ownedRoutes = routes.filter((r) => /^\/api\/(me|places)\/.*:id/.test(r.path) && r.method !== 'POST');
    for (const r of ownedRoutes) for (const id of rowIds) {
      const path = r.path.replace(':id', id).replace(/:[a-zA-Z]+/g, 'dumbbells');
      const res = await ctx.request(path, { method: r.method, cookie: admin.cookie, ...(r.method === 'GET' || r.method === 'DELETE' ? {} : { json: {} }) });
      expect(res.status, `${r.method} ${path}`).toBe(404);
    }
  });
});
```
Ce test a vocation à grossir : il couvre d'office les routes `/api/me/*/:id` et `/api/places/:id` que les tâches suivantes ajoutent (T18, T19).

`apps/server/test/auth/purge.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { createTestContext, createUser, insertFixtureRow } from '@appsport/server/testing';
import { authPurgeJob } from '../../src/auth/purge';
import { DAILY_JOBS } from '../../src/jobs/registry';

const DAY = 86_400_000;
describe('authPurgeJob (03 §7)', () => {
  it('est enregistré dans DAILY_JOBS', () => {
    expect(DAILY_JOBS).toContain(authPurgeJob);
    expect(authPurgeJob.name).toBe('auth-purge');
  });
  it('sessions fermées purgées 30 j après fermeture ou expiration ; account_deleted gardées jusqu'à l'expiration absolue', async () => {
    const ctx = await createTestContext({ now: '2026-10-06T10:00:00.000Z' });
    const u = await createUser(ctx);
    const ids = {
      revokedOld: (await insertFixtureRow(ctx.deps.db, 'session', { userId: u.id, revokedAt: '2026-09-05T10:00:00.000Z', revokedReason: 'logout' })).id,
      revokedRecent: (await insertFixtureRow(ctx.deps.db, 'session', { userId: u.id, revokedAt: '2026-09-07T10:00:00.000Z', revokedReason: 'logout' })).id,
      idleOld: (await insertFixtureRow(ctx.deps.db, 'session', { userId: u.id, lastSeenAt: '2026-06-07T10:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z' })).id,
      active: (await insertFixtureRow(ctx.deps.db, 'session', { userId: u.id, lastSeenAt: '2026-10-01T10:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z' })).id,
      deletedLive: (await insertFixtureRow(ctx.deps.db, 'session', { userId: null, revokedAt: '2026-01-01T00:00:00.000Z', revokedReason: 'account_deleted', expiresAt: '2026-10-06T10:00:00.001Z' })).id,
      deletedExpired: (await insertFixtureRow(ctx.deps.db, 'session', { userId: null, revokedAt: '2026-01-01T00:00:00.000Z', revokedReason: 'account_deleted', expiresAt: '2026-10-06T10:00:00.000Z' })).id,
    };
    await authPurgeJob.run(ctx.deps);
    const left = (await ctx.deps.db.selectFrom('session').select('id').execute()).map((s) => s.id).sort();
    expect(left).toEqual([ids.revokedRecent, ids.active, ids.deletedLive].map(String).sort());
  });
  it('invitations : birth_date effacée à l'expiration, ligne purgée 30 j après la fin', async () => {
    const ctx = await createTestContext();
    const expired = await insertFixtureRow(ctx.deps.db, 'invitation', { birthDate: '1990-01-01', expiresAt: '2026-10-06T09:00:00.000Z' });
    const pending = await insertFixtureRow(ctx.deps.db, 'invitation', { birthDate: '1990-01-01', expiresAt: '2026-10-08T00:00:00.000Z' });
    const usedOld = await insertFixtureRow(ctx.deps.db, 'invitation', { birthDate: null, usedAt: '2026-09-06T10:00:00.000Z', expiresAt: '2026-09-10T00:00:00.000Z' });
    const revokedOld = await insertFixtureRow(ctx.deps.db, 'invitation', { birthDate: null, revokedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-10-20T00:00:00.000Z' });
    await authPurgeJob.run(ctx.deps);
    const rows = Object.fromEntries((await ctx.deps.db.selectFrom('invitation').select(['id', 'birthDate']).execute()).map((r) => [r.id, r.birthDate]));
    expect(rows).toEqual({ [String(expired.id)]: null, [String(pending.id)]: '1990-01-01' });
    expect(rows).not.toHaveProperty(String(usedOld.id));
    expect(rows).not.toHaveProperty(String(revokedOld.id));
  });
  it('liens de réinitialisation purgés 30 j après usage, annulation ou expiration', async () => {
    const ctx = await createTestContext(); const u = await createUser(ctx);
    await insertFixtureRow(ctx.deps.db, 'password_reset', { userId: u.id, usedAt: '2026-09-06T10:00:00.000Z', expiresAt: '2026-09-07T00:00:00.000Z' });
    const keep = await insertFixtureRow(ctx.deps.db, 'password_reset', { userId: u.id, cancelledAt: '2026-09-07T00:00:00.000Z', expiresAt: '2026-09-07T12:00:00.000Z' });
    await insertFixtureRow(ctx.deps.db, 'password_reset', { userId: u.id, expiresAt: '2026-09-05T00:00:00.000Z' });
    await authPurgeJob.run(ctx.deps);
    expect((await ctx.deps.db.selectFrom('passwordReset').select('id').execute()).map((r) => r.id)).toEqual([keep.id]);
  });
  it('security_event au-delà de 12 mois supprimé', async () => {
    const ctx = await createTestContext();
    await insertFixtureRow(ctx.deps.db, 'security_event', { at: '2025-10-06T09:59:59.999Z' });
    const keep = await insertFixtureRow(ctx.deps.db, 'security_event', { at: '2025-10-06T10:00:00.000Z' });
    await authPurgeJob.run(ctx.deps);
    expect((await ctx.deps.db.selectFrom('securityEvent').select('id').execute()).map((r) => r.id)).toEqual([keep.id]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- export delete admin-isolation purge`
Échec attendu : `Failed to resolve import "../../src/privacy/export"` et `../../src/auth/purge`.

- [ ] **Step 3: Implement**

- `buildExport` :
  - `account` : ligne `user` sans les `secretColumns` de `deps.entityRules.user`.
  - `tables` : pour chaque table de `deps.entityRules` dont `exported` est vrai, sauf `user`, avec `ownerColumn` ∈ {`owner_id`, `user_id`}. On sélectionne par `ownerColumn = userId` (Kysely : `selectFrom(tableKey(table))`, colonne `snakeToCamel(ownerColumn)`), puis on retire les `secretColumns` (comparées en camelCase). Un résultat vide vaut `[]`.
  - `gyms` : salles dont l'id figure dans `place.gym_id` de l'utilisateur, lieux supprimés compris, ou dont `created_by = userId`, ou dont une ligne `gym_history` a `author_id = userId`.
  - `gymHistory` : lignes `gym_history` où `author_id = userId`.
  - `data_exported` (`actorId = targetId = userId`, sans détail).
  - Route `GET /api/me/export` : 200 JSON, `Content-Disposition: attachment; filename="appsport-export-<AAAA-MM-JJ de Paris>.json"`.
- `deleteAccount`, dans la transaction reçue, dans cet ordre :
  1. utilisateur absent → `not_found` ;
  2. `assertNotLastAdmin(trx, userId)` ;
  3. sur toutes les sessions où `user_id = userId` : `user_id = NULL`, `revoked_reason = 'account_deleted'`, `revoked_at = COALESCE(revoked_at, now)` ;
  4. `UPDATE gym_history SET author_id = NULL WHERE author_id = userId` ;
  5. `DELETE FROM user WHERE id = userId`. Les clés étrangères `ON DELETE CASCADE` et `SET NULL` du schéma T4 traitent les tables `cascade` et `set_null` ;
  6. `account_deleted` (`targetId = userId`, `actorId = actor.actorId`, sans détail).
  Aucune ligne `security_event` n'est modifiée.
- Routes :
  - `POST /api/me/delete` (`DeleteAccountRequest`) : `verifyUserPassword` faux → `invalid_credentials`. Sinon transaction avec `deleteAccount(…, { actorId: user.id, ip })`, `clearSessionCookie` et 204.
  - `POST /api/admin/members/:id/delete` (`AdminDeleteMemberRequest`) : `usernameKey(confirmUsername) !== usernameKey(cible.username)` → `httpError('validation', { field: 'confirmUsername' })`. Sinon `deleteAccount(…, { actorId: admin.id, ip })` et 204.
- `authPurgeJob.run(deps)` : `now = deps.clock.now()`, `R = CLOSED_AUTH_RECORD_RETENTION_DAYS` j.
  - Sessions `account_deleted` : suppression si `expires_at <= now`.
  - Autres sessions : fin = la plus petite valeur entre `revoked_at`, `last_seen_at + 90 j` et `expires_at`. Suppression si `fin + R <= now`.
  - Invitations : `birth_date = NULL` si `used_at`, `revoked_at` et `expires_at` vérifient `expires_at <= now` avec `used_at IS NULL AND revoked_at IS NULL`. Suppression si `COALESCE(used_at, revoked_at, expires_at) + R <= now`.
  - `password_reset` : suppression si `COALESCE(used_at, cancelled_at, expires_at) + R <= now`.
  - `security_event` : suppression si `at < now − 12 mois calendaires` (`setUTCMonth`).
  - Sélection en SQL puis calcul en TS si besoin. Journal final : `deps.logger.info('auth purge', { job: 'auth-purge', count })`.
- `jobs/registry.ts` : `DAILY_JOBS.push(authPurgeJob)`, ou ajout de `authPurgeJob` dans le littéral du tableau.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- export delete admin-isolation purge`, puis `pnpm test` (toute la suite, y compris le test de registre T5) et `pnpm typecheck`. Attendu : `Test Files  4 passed` pour la commande ciblée, suite complète verte.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src apps/server/src/privacy apps/server/src/auth/purge.ts apps/server/src/auth/me-routes.ts apps/server/src/admin/routes.ts apps/server/src/jobs/registry.ts apps/server/test/privacy apps/server/test/auth/purge.test.ts
git commit -m "feat(privacy): export appsport-export/1, suppression de compte, isolation admin et purge"
```
