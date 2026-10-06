### Task 8: Règles d'identifiants, codes secrets et Argon2id

**Files:**
- Create: `packages/contracts/src/{auth-constants.ts, api/auth.ts}` (base) ; Modify: `packages/contracts/src/index.ts`
- Create: `packages/domain/src/auth/{username.ts, password.ts, secret-code.ts}` ; Modify: `packages/domain/src/index.ts`
- Create: `apps/server/src/auth/{password-hash.ts, secret.ts, common-passwords-list.ts, common-passwords.ts}`
- Test: `packages/contracts/test/auth-constants.test.ts`, `packages/domain/test/auth/{username,password,secret-code}.test.ts`, `apps/server/test/auth/{password-hash,secret,common-passwords}.test.ts`

**Interfaces:**
- Consumes : `Role` (T2) ; `IdGen`, `Argon2Params`, `ARGON2_PARAMS`, `loadConfig` (T6) ; `seqIds`, `TEST_ARGON2`.
- Produces : Interfaces partagées §3 (`auth-constants.ts` ; `api/auth.ts` : `CivilDate`, `RoleSchema`, `UserStatusSchema`, `AgeBandSchema` ; `domain/auth/*` ; `password-hash.ts`, `secret.ts`, `common-passwords.ts`).

**Spec:** 02 R-INV-3, R-INV-5, R-RST-1, R-MDP-1 à R-MDP-4, §3.4, R-ROLE-5, 03 P-AUT-1, P-AUT-2, 02 §15 n°3 et n°6.

- [ ] **Step 1: Write the failing test**

```ts
// auth-constants.test.ts
expect([INVITATION_TTL_DAYS, BOOTSTRAP_INVITATION_TTL_HOURS, RESET_TTL_HOURS, SECRET_CODE_LENGTH, INVITATION_NOTE_MAX, USERNAME_MIN, USERNAME_MAX,
  PASSWORD_MIN_MEMBER, PASSWORD_MIN_ADMIN, PASSWORD_MAX, SESSION_IDLE_DAYS, SESSION_MAX_DAYS, ADMIN_PASSWORD_REMINDER_MONTHS]).toEqual([7, 24, 24, 16, 60, 3, 24, 12, 14, 128, 90, 365, 12]);
expect(RESERVED_USERNAMES).toEqual(['admin', 'appsport', 'systeme']); expect(CODE_CHECKS_PER_HOUR).toBe(20);
expect(LOGIN_LIMITS).toEqual({ consecutiveThreshold: 5, firstDelayMs: 60_000, maxDelayMs: 900_000, hourlyMaxFailures: 10, lockMs: 3_600_000, windowMs: 3_600_000, ipMaxFailuresPerHour: 30 });
// CivilDate : '2026-10-06' et '2024-02-29' acceptés ; '2026-02-30' et '06/10/2026' refusés
// username.test.ts
expect(validateUsername('ab')).toEqual({ ok: false, reason: 'length' }); expect(validateUsername('a'.repeat(25))).toEqual({ ok: false, reason: 'length' });
expect(validateUsername('abc')).toEqual({ ok: true }); expect(validateUsername('a'.repeat(24))).toEqual({ ok: true });
expect(validateUsername('é'.repeat(24))).toEqual({ ok: true });   // longueur après NFC
for (const u of ['Éloïse_2', 'jean-marc.b']) expect(validateUsername(u)).toEqual({ ok: true });
for (const u of ['lea b', 'lea@x', 'lea💪']) expect(validateUsername(u)).toEqual({ ok: false, reason: 'characters' });
for (const u of ['Admin', 'APPSPORT', 'Système']) expect(validateUsername(u)).toEqual({ ok: false, reason: 'reserved' });   // [décision plan] sans accents
expect(usernameKey('Éloïse')).toBe('éloïse'); expect(usernameKey('ＬＥＡ')).toBe('lea');
// password.test.ts (02 §15 n°6) — member = { username: 'lea', role: 'member', commonPasswords: new Set(['soleil123456']) }
expect(validatePassword('abcdefghijk', member)).toEqual({ ok: false, reason: 'too_short' }); expect(validatePassword('girafebleuet', member)).toEqual({ ok: true });
expect(validatePassword('girafebleuet1', admin)).toEqual({ ok: false, reason: 'too_short' }); expect(validatePassword('girafebleuet12', admin)).toEqual({ ok: true });
expect(validatePassword('ab'.repeat(64), member)).toEqual({ ok: true }); expect(validatePassword(`${'ab'.repeat(64)}c`, member)).toEqual({ ok: false, reason: 'too_long' });
expect(validatePassword('SOLEIL123456', member)).toEqual({ ok: false, reason: 'common' });
expect(validatePassword('xxÉloïse_2 et la mer', { ...member, username: 'éloïse_2' })).toEqual({ ok: false, reason: 'contains_username' });
expect(validatePassword('mon appSport adoré', member)).toEqual({ ok: false, reason: 'contains_appsport' });
expect(validatePassword('aaaaaaaaaaaa', member)).toEqual({ ok: false, reason: 'single_char' }); expect(validatePassword('💪'.repeat(12), member)).toEqual({ ok: false, reason: 'single_char' });
expect(passwordLength('💪'.repeat(11))).toBe(11); expect(validatePassword(`${'💪'.repeat(11)}a`, member)).toEqual({ ok: true });
expect(validatePassword(`${'é'.repeat(6)}abcde`, member)).toEqual({ ok: false, reason: 'too_short' });
// secret-code.test.ts (02 §15 n°3)
expect(encodeCrockford(new Uint8Array(10))).toBe('0000000000000000'); expect(encodeCrockford(new Uint8Array(10).fill(255))).toBe('ZZZZZZZZZZZZZZZZ');
expect(encodeCrockford(Uint8Array.of(8, 0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('1000000000000000');
expect(formatSecretCode('ABCDEFGHJKMNPQRS')).toBe('ABCD-EFGH-JKMN-PQRS');
for (const s of ['abcd-efgh-jkmn-pqrs', ' abcd efgh jkmn pqrs ', 'abcdefghjkmnpqrs', 'https://appsport.tail1234.ts.net/invite#abcd-efgh-jkmn-pqrs',
  'https://appsport.tail1234.ts.net/reset#ABCD-EFGH-JKMN-PQRS']) expect(parseSecretCode(s)).toBe('ABCDEFGHJKMNPQRS');
expect(parseSecretCode('O0OO-IiLl-0000-0000')).toBe('0000111100000000');
for (const s of ['ABCD-EFGH-JKMN-PQR', 'ABCD-EFGH-JKMN-PQRST', 'ABCD-EFGH-JKMN-PQRU', '']) expect(parseSecretCode(s)).toBeNull();
// password-hash.test.ts (R-MDP-4)
expect(await hashPassword('girafebleuet', ARGON2_PARAMS, seqIds())).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
expect(loadConfig({ APP_ORIGIN: 'https://appsport.test.ts.net' }).argon2).toEqual(ARGON2_PARAMS);
// verifyPassword : bon (NFC et NFD) → true ; mauvais → false ; 'pas-un-phc' → false ; deux hachés du même mot de passe diffèrent
// needsRehash : mêmes paramètres → false ; memoryKiB 2048 ou passes 2 → true ; memoryKiB 512 → false ; 'garbage' → true
// secret.test.ts (R-INV-3) : canonical /^[0-9A-HJKMNP-TV-Z]{16}$/ ; formatted = formatSecretCode(canonical) ; hash = sha256 hex ; randomBytes appelé avec 10
// common-passwords.test.ts (R-MDP-3) : 9000 < size ≤ 10000 ; contient '123456' et 'password' ; tout en minuscules ;
expect([...parseCommonPasswords('# Licence MIT\r\nPassword\r\n\r\nabc\n')]).toEqual(['password', 'abc']);
expect(COMMON_PASSWORDS_RAW.startsWith('# Source: SecLists')).toBe(true); expect(COMMON_PASSWORDS_RAW).toContain('MIT');
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- auth-constants` ; `pnpm --filter @appsport/domain test -- auth` ; `pnpm --filter @appsport/server test -- password-hash secret common-passwords` → `Failed to resolve import "../src/auth-constants"` (et équivalents).

- [ ] **Step 3: Implement**

- `validateUsername` : longueur `[...username.normalize('NFC')]` ∈ [3, 24] ; `/^[\p{L}\p{Nd}._-]+$/u` ; réservé si `usernameKey(n)` sans diacritiques (`normalize('NFD').replace(/\p{M}/gu, '')`) ∈ `RESERVED_USERNAMES` ; pas de `trim`.
- `validatePassword` sur `pw.normalize('NFC')`, contrôles dans l'ordre : `too_short`, `too_long`, `single_char`, `common` (minuscules), `contains_username` (`usernameKey(p).includes(usernameKey(username))`), `contains_appsport`.
- `parseSecretCode` : garde ce qui suit le dernier `#`, majuscules, retire blancs et `-`, `I`/`L` → `1`, `O` → `0`, exige 16 caractères de `CROCKFORD_ALPHABET`.
- `hashPassword` : `argon2` de `node:crypto` (`argon2id`, sel `ids.randomBytes(saltLength)`), entrée NFC ; PHC `$argon2id$v=19$m=<m>,t=<t>,p=<p>$<sel b64 sans =>$<haché b64 sans =>` ; `verifyPassword` par `timingSafeEqual`, toute erreur → `false` ; `needsRehash` vrai si PHC illisible, autre algorithme ou version, `m < memoryKiB`, `t < passes`, `p ≠ parallelism` ou sel trop court.
- `common-passwords-list.ts` **[décision plan, remplace le `.txt` et le loader esbuild]** : `export const COMMON_PASSWORDS_RAW = \`…\`` généré une fois depuis `SecLists/Passwords/Common-Credentials/10k-most-common.txt` (minuscules, dédoublonné, LF), commençant exactement par :
  `# Source: SecLists, Passwords/Common-Credentials/10k-most-common.txt (https://github.com/danielmiessler/SecLists)`
  `# Licence : MIT, Copyright (c) Daniel Miessler. Converti en minuscules et dédoublonné pour appsport.`
  `COMMON_PASSWORDS = parseCommonPasswords(COMMON_PASSWORDS_RAW)`.

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes → `Test Files  7 passed` ; `pnpm typecheck` et `pnpm lint` passent.

- [ ] **Step 5: Commit**

`git commit -m "feat(auth): règles de pseudo et de mot de passe, codes Crockford et Argon2id"`

---

### Task 9: Sessions, middleware et journal de sécurité

**Files:**
- Create: `apps/server/src/auth/{security-log.ts, session.ts}`
- Modify: `apps/server/src/app.ts` (`app.use('/api/*', sessionMiddleware(deps))` après `originGuard`)
- Test: `apps/server/test/auth/{session,security-log}.test.ts`

**Interfaces:**
- Consumes : T6 (`AppDeps`, `AppEnv`, `SessionUser`, `httpError`, `errorHandler`, `createLogger`, `createTestContext`) ; T4a/T5 (`DbExecutor`, `insertFixtureRow`, `FakeClock`) ; T8 (`hashSecret`, `SESSION_IDLE_DAYS`, `SESSION_MAX_DAYS`, `SESSION_TOUCH_INTERVAL_MS`).
- Produces : Interfaces partagées §3 (`security-log.ts`, `session.ts`). Convention : sans session valide, `user` et `sessionId` valent `null` ; pour une session `revoked_reason = 'account_deleted'`, `sessionId = <id>` et `user = null`, ce que `requireUser` traduit en 410.

**Spec:** 02 R-AUTH-6, R-ROLE-4, R-MDP-1, §14, §15 n°4 ; 03 P-AUT-3, P-DRT-4, P-LOG-1, P-LOG-2, §17 n°7 et n°8.

- [ ] **Step 1: Write the failing test**

`session.test.ts` monte une app de sonde (`sessionMiddleware`, `POST /probe/login/:id[?mcp=1]` → `createSession` + `setSessionCookie`, `GET /probe/user` sous `requireUser`, `GET /probe/admin` sous `requireAdmin`, et `GET /api/me`, `POST /api/auth/{password,logout,logout-all}` sous `requireUser`) :
```ts
expect(setCookie).toMatch(/^__Host-session=[A-Za-z0-9_-]{43};/);   // P-AUT-3
for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=31536000']) expect(setCookie).toContain(a);
expect(setCookie).not.toMatch(/Domain=/i);
// origine http://localhost:5173 → /^dev-session=/ sans 'Secure' ; clearSessionCookie → /^__Host-session=;.*Max-Age=0/
expect(row.tokenHash).toBe(sha256(token)); expect(Object.values(row)).not.toContain(token);   // 02 §15 n°4
expect(row.expiresAt).toBe('2027-10-06T10:00:00.000Z'); expect(row.mustChangePassword).toBe(0);
// sans cookie → 401 { error: 'unauthenticated' } ; avec cookie → { id, role: 'member', birthDate: '1990-01-01', mustChangePassword: false }
// inactivité : a actif à J+89 → 200 ; b inactif à J+90 → 401 ; a encore actif à J+178 → 200
// durée absolue : actif tous les 80 j → 200 jusqu'à J+365 − 1 ms, 401 à J+365
// last_seen_at : inchangé à +30 min ('2026-10-06T10:00:00.000Z'), réécrit à +61 min ('2026-10-06T11:01:00.000Z')
expect(await revokeSessions(db, deps, userId, 'admin', a.sessionId)).toBe(1);   // a garde 200, b → 401 { error: 'unauthenticated' }
// session account_deleted (user_id NULL) → 410 { error: 'account_deleted' } ; /api/health reste 200 (P-DRT-4)
// compte disabled → 401 ; requireAdmin : membre → 403 { error: 'forbidden' }, admin → 200 (R-ROLE-4)
// mustChangePassword (R-MDP-1) : GET /api/me, POST /api/auth/password, POST /api/auth/logout → 200 ; POST /api/auth/logout-all et /probe/user → 403 { error: 'password_change_required' }
// logger : ni le jeton ni son empreinte (03 §17 n°7)
// security-log.test.ts (P-LOG-1)
expect(row).toMatchObject({ type: 'login_succeeded', actorId: 'u1', targetId: 'u1', tailnetIp: '100.64.0.1', outcome: 'success', at: '2026-10-06T10:00:00.000Z' });
expect(JSON.parse(row.details)).toEqual({ role: 'admin' });   // sans détails → details NULL
// details { role: 'member', inviteCode: 'ABCD', tokenHash: 'x', newPassword: 'y' } → stocké { role: 'member' } ; journal contient 'security details dropped', pas 'ABCD'
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- session security-log` → `Failed to resolve import "../../src/auth/session"`.

- [ ] **Step 3: Implement**

- Jeton = `base64url` de `ids.randomBytes(32)` ; ligne `session` avec `tokenHash`, `expiresAt = now + SESSION_MAX_DAYS`, `mustChangePassword` 0/1. Cookie par `hono/cookie` : nom `config.sessionCookieName`, `httpOnly`, `secure: config.secureCookie`, `sameSite: 'Lax'`, `path: '/'`, `maxAge: SESSION_MAX_DAYS * 86400`.
- `sessionMiddleware` : session révoquée (hors `account_deleted`), `expiresAt <= now` ou `lastSeenAt + 90 j <= now`, utilisateur absent ou `disabled` → `null`/`null` ; sinon `SessionUser` avec `mustChangePassword: row.mustChangePassword === 1`, et `last_seen_at` réécrit si `now − lastSeenAt ≥ SESSION_TOUCH_INTERVAL_MS`.
- `requireUser` : `MUST_CHANGE_ALLOWED` comparé à `` `${method} ${path}` ``.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- session security-log` → `Test Files  2 passed` ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(auth): sessions par cookie __Host-session et journal de sécurité"`

---

### Task 10: Connexion, limitation, déconnexion, mot de passe et /api/me

**Files:**
- Create: `apps/server/src/auth/{limiter.ts, routes.ts, me.ts, me-routes.ts}`, `apps/server/src/privacy/consent-state.ts`, `apps/server/test/support/users.ts`
- Modify: `packages/contracts/src/api/auth.ts` (`ONBOARDING_STEPS` … `UpdateMeRequest`), `apps/server/src/routes.ts` (`/api/auth`, `/api/me`), `apps/server/test/support/index.ts`
- Test: `apps/server/test/auth/{limiter,login,password-change,me}.test.ts`, `apps/server/test/privacy/consent-state.test.ts`

**Interfaces:**
- Consumes : T8 (règles, `hashPassword`, `verifyPassword`, `needsRehash`, `COMMON_PASSWORDS`, constantes) ; T9 (`createSession`, `setSessionCookie`, `clearSessionCookie`, `revokeSession`, `revokeSessions`, `requireUser`, `logSecurityEvent`) ; T2 (`ageBandOn`, `parisDate`, `computeCautious`, `PRIVACY_POLICY_VERSION`) ; T4a (`writeStamp`) ; T6 (`parseJson`, `httpError`, `clientIp`).
- Produces : Interfaces partagées §3 (`api/auth.ts` : `ONBOARDING_STEPS`, `OnboardingStep`, `ConsentStatus`, `ConsentState`, `MeResponse`, `LoginRequest`, `ChangePasswordRequest`, `UpdateMeRequest` ; `limiter.ts` ; `consent-state.ts` ; `me.ts` ; `authRoutes`, `meRoutes` ; support `users.ts`).

**Spec:** 02 R-AUTH-1 à R-AUTH-7, R-MDP-1, R-MDP-4 à R-MDP-6, R-CPT-3, R-AGE-2, R-CST-1, R-CST-7, §15 n°7 ; 03 P-AUT-1, P-AUT-5, P-MIN-3.

- [ ] **Step 1: Write the failing test**

```ts
// limiter.test.ts (R-AUTH-2, R-AUTH-3)
// 4 échecs → allowed ; 5e → { allowed: false, retryAfterS: 60 } ; après attente, échecs suivants → 120, 240, 480, 900 (plafond)
// 10e échec dans l'heure → 3600 ; à +3 599 s → 1 ; à +3 600 s → allowed
// un succès remet le compteur consécutif à zéro mais pas la fenêtre d'une heure (4 + 4 + 2 échecs entre deux succès → 3600)
// des échecs de plus d'une heure sortent de la fenêtre
// 30 échecs d'une IP (pseudos différents) → check('lea', IP) = 3600 ; autre IP ou null → allowed ; unlock → allowed
// createIpLimiter(clock, { limit: 20, windowMs: 3_600_000 }) : 20 hits acceptés, 21e { allowed: false, retryAfterS: 3600 }, autre IP acceptée, +1 h → accepté
// login.test.ts
// succès (pseudo 'LÉA' pour 'Léa') : 200 MeResponse { username: 'Léa', role: 'member', mustChangePassword: false }, cookie __Host-session,
//   last_login_at '2026-10-06T10:00:01.000Z', rev augmenté, login_succeeded { outcome: 'success', tailnetIp: '100.64.0.1' }
// mauvais mot de passe ou pseudo inexistant → 401 { error: 'invalid_credentials' }
// 5 échecs (pseudo existant ou non) → 429 { error: 'rate_limited', retryAfterS: 60 } ; deux login_blocked ; +60 s → 200 (02 §15 n°7)
// 10e échec dans l'heure → 429 { retryAfterS: 3600 } ; +1 h → 200 ; succès intercalé → compteur remis à zéro
// 30 échecs depuis 100.64.0.9 → 429 depuis cette IP, 200 depuis 100.64.0.10 (R-AUTH-3)
// compte disabled : mauvais mot de passe → invalid_credentials ; bon → 403 { error: 'account_disabled' } sans Set-Cookie (R-AUTH-5)
// admin avec 'abcdefghijklm' (13) → mustChangePassword true ; /api/me 200 ; logout-all → { error: 'password_change_required' } (R-MDP-1)
// config argon2 { ...TEST_ARGON2, memoryKiB: 2048 } et haché TEST_ARGON2 → après connexion /^\$argon2id\$v=19\$m=2048,t=1,p=1\$/ (R-MDP-4)
// password-change.test.ts
// POST /api/auth/password { currentPassword, newPassword: 'tortue verte du jardin' } → 204 ; session courante 200, autre 401 ;
//   ancien mot de passe 401, nouveau 200 ; password_changed_at '2026-10-06T10:00:01.000Z' ; un password_changed (R-MDP-6)
// actuel faux → 401 invalid_credentials ; nouveau 'court' → 400 { error: 'password_rejected', reason: 'too_short' }
// admin mustChangePassword → après changement ('quatorze carac'), me.mustChangePassword false et PATCH /api/me → 200
// logout → 204, Set-Cookie Max-Age=0, session courante 401, autre 200 ; logout-all → 204, toutes 401, revoked_reason ['logout_all','logout_all'] (R-AUTH-7)
// me.test.ts
// birthDate '2008-10-07' : { ageBand: 'minor', cautious: true } ; à '2026-10-06T22:30:00.000Z' (7 oct. à Paris) : { ageBand: 'adult', cautious: false } (R-AGE-2)
// cautiousMode 1 → cautious true ; caution 1 sans consentement → false, puis avec consent_event health/grant → true (R-CST-7)
// passwordReminderDue : admin dont password_changed_at = '2025-10-06T09:00:00.000Z' → true ; membre → false ; '2025-10-06T11:00:00.000Z' → false (R-MDP-5)
// PATCH /api/me { username: 'Léa.B' } → 200, username_key 'léa.b', rev augmenté, un username_changed (R-CPT-3)
// pseudo pris ('ÉLOÏSE' contre 'Éloïse') → 409 { error: 'username_taken' } ; 'ab' → 400 { error: 'username_invalid', reason: 'length' }
// consent-state.test.ts (R-CST-1) : sans événement { active: false, textVersion: null, at: null } pour health et ai_coach ;
//   grant → { active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' } ; puis withdraw → isHealthConsentActive false
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- limiter login password-change me consent-state` → `Failed to resolve import "../../src/auth/limiter"`, `createUser is not exported`.

- [ ] **Step 3: Implement**

Limiteur en mémoire (`LOGIN_LIMITS`) :
```ts
// check : waits = [] ; lockedUntil > now → lockedUntil − now ; consecutive ≥ 5 → lastFailureAt + min(60_000 * 2 ** (consecutive − 5), 900_000) − now ;
//         échecs de l'IP sur 1 h ≥ 30 → plus ancien + 3_600_000 − now ; w = max(waits) > 0 ? { allowed: false, retryAfterS: ceil(w / 1000) } : { allowed: true }
// recordFailure : consecutive++, lastFailureAt = now, failures = échecs < 1 h + now ; failures ≥ 10 → lockedUntil = now + 3_600_000 ; IP : ajoute now
// recordSuccess : consecutive = 0 (failures et lockedUntil gardés) ; unlock : efface l'état du pseudo ; IpLimiter.hit ne compte que les essais acceptés
```
- `POST /login` : limiteur vérifié avant tout (`login_blocked`, `outcome 'blocked'`) ; pseudo inconnu → `verifyPassword` sur une empreinte factice (calculée une fois par `deps`) pour égaliser le temps ; échec → `recordFailure`, `login_failed` ; compte `disabled` → `login_failed` `{ reason: 'disabled' }`, `account_disabled` ; succès → ré-hachage hors transaction si `needsRehash`, puis dans une transaction `last_login_at` + `writeStamp`, `createSession(…, { mustChangePassword: role === 'admin' && passwordLength(password) < PASSWORD_MIN_ADMIN })`, `login_succeeded`.
- `POST /password` : limiteur sur la clé du pseudo de session ; haché hors transaction ; `storeNewPassword` (annule aussi les `password_reset` en attente), `revokeSessions(…, 'password_change', sessionId)`, `must_change_password = 0` sur la session courante, `password_changed`.
- `buildMe` : `cautious` via `computeCautious` (caution = `health_screening.caution` non supprimé, sinon `null`) ; `passwordReminderDue` = admin et `(passwordChangedAt ?? createdAt) + 12 mois calendaires ≤ now` ; `GET /api/me` passe `user.mustChangePassword`.
- `createUser` (support) : insertion directe, `hashPassword(password, config.argon2)`, `termsVersion = PRIVACY_POLICY_VERSION` ; `onboarded` → `onboardingStep 'ready'`, `onboardingCompletedAt = now`. `login` renvoie `nom=valeur` du `Set-Cookie` et lève si le statut n'est pas 200.

- [ ] **Step 4: Run test to verify it passes**

Même commande → `Test Files  5 passed` ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(auth): connexion limitée, déconnexion, changement de mot de passe et /api/me"`

---

### Task 11: Invitations, création de compte et amorçage

**Files:**
- Create: `apps/server/src/auth/{invitations.ts, invitation-routes.ts, bootstrap.ts}`, `packages/contracts/src/api/admin.ts` (invitations)
- Modify: `packages/contracts/src/{index.ts, api/auth.ts}`, `apps/server/src/routes.ts` (`/api/invitations`, `/api/admin/invitations`), `apps/server/src/cli.ts` (`admin:bootstrap`)
- Test: `apps/server/test/auth/{invitation,invitation-concurrency,bootstrap}.test.ts`

**Interfaces:**
- Consumes : T8 (`createSecretCode`, `hashSecret`, `parseSecretCode`, règles, `hashPassword`, constantes, `CivilDate`) ; T9 ; T10 (`authLimiters`, `buildMe`, `createUser`, `createUserAndLogin`) ; T2 (`ageOn`, `parisDate`, `MIN_AGE`, `PRIVACY_POLICY_VERSION`) ; T4a (`writeStamp`) ; T7 (`COMMANDS`, `parseFlags`, `withAppDeps`, `runCli`).
- Produces : Interfaces partagées §3 (`CodeRequest`, `InvitationCheckResponse`, `AcceptInvitationRequest`, `InvitationState`, `InvitationSummary`, `CreateInvitationRequest`, `CreateInvitationResponse`, `invitations.ts`, `invitation-routes.ts`, `bootstrap.ts`, commande `admin:bootstrap`).

**Spec:** 02 R-INV-1 à R-INV-9, R-CPT-1, R-CPT-2, R-ROLE-5, R-ARR-1, R-ARR-2, §15 n°1 à n°4 ; 03 P-MIN-1, P-MIN-2, P-AUT-2, §17 n°5 et n°7 ; Review Focus 1.

- [ ] **Step 1: Write the failing test**

```ts
// invitation.test.ts (admin 'porteur' connecté ; CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
// birthDate '2010-10-07' → 400 { error: 'under_min_age' } ; '2010-10-06' → 201 ; à '2026-10-05T22:30:00.000Z' (6 oct. à Paris) '2010-10-06' → 201 (02 §15 n°1)
// note de 61 caractères → 400, 60 → 201 ; membre → { error: 'forbidden' }
expect(r.code).toMatch(CODE_RE); expect(r.link).toBe(`https://appsport.test.ts.net/invite#${r.code}`);
expect(r.invitation).toMatchObject({ note: 'pour Léa', state: 'pending', usedByUsername: null, expiresAt: '2026-10-13T10:00:00.000Z' });
// row.codeHash = hashSecret(canonique) ; ni la ligne ni la liste ne contiennent le code canonique ; un invitation_created (R-INV-3)
// révocation → 204, seconde révocation → 409 ; accept → 'used' { usedByUsername: 'lea' } ; birth_date gardée seulement pour 'pending' ; +7 j → 'expired' (R-INV-7)
// check (R-INV-8) : code en minuscules ou lien complet → { birthDate: '2001-05-04' } ; 'AAAA-AAAA-AAAA-AAAA' et 'pas un code' → invitation_unknown ;
//   révoquée → invitation_revoked ; utilisée → invitation_used ; +7 j → 400 { error: 'invitation_expired' }
// accept (R-CPT-2) : 201 MeResponse { username: 'Éloïse_2', role: 'member', birthDate: '2001-05-04', termsVersion: '1.0', onboardingCompletedAt: null } + cookie ;
//   user { invitationId, termsAcceptedAt: '2026-10-06T10:00:00.000Z', status: 'active' } ; invitation_used { actorId: uid, targetId: uid }
// échec de validation sans consommer (R-CPT-1, 02 §15 n°2) : 'court' → { error: 'password_rejected', reason: 'too_short' } ;
//   'Admin' → { error: 'username_invalid', reason: 'reserved' } ; 'porteur' → { error: 'username_taken' } ; termsVersion '0.9' → { error: 'validation' } ;
//   l'invitation reste 'pending', puis accept valide → 201
// 19 check + 1 accept depuis 100.64.0.7 → la 21e vérification → 429 { error: 'rate_limited' } ; autre IP → 400 ; +1 h → 400
// ni le code, ni le canonique, ni l'empreinte dans les journaux et security_event (02 §15 n°4)
// invitation-concurrency.test.ts (R-INV-6, Review Focus 1)
const [a, b] = await Promise.all([accept('lea'), accept('leo')]);
expect([a.status, b.status].sort()).toEqual([201, 400]); expect(await (a.status === 400 ? a : b).json()).toEqual({ error: 'invitation_used' });
// un seul membre ; 5 accept simultanés dont un mot de passe 'court' → exactement un 201 et un membre
// bootstrap.test.ts (R-ROLE-5)
const r = await bootstrapAdminInvitation(ctx.deps, '1985-03-02'); expect(r.expiresAt).toBe('2026-10-07T10:00:00.000Z');
// accept 'treize carac' → { error: 'password_rejected', reason: 'too_short' } ; 'quatorze carac' → role 'admin'
// une seconde invitation d'amorçage révoque la première (check → invitation_revoked) ; un admin existe → rejects { code: 'conflict' }
// CLI après init : runCli(['admin:bootstrap', '--birth-date', '1985-03-02']) → 0 et exactement 3 lignes :
expect(out[0]).toBe('Invitation administrateur (valable 24 h)');
expect(out[1]).toMatch(/^Lien : https:\/\/appsport\.test\.ts\.net\/invite#[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
expect(out[2]).toBe(`Code : ${out[1]!.split('#')[1]}`);
// ligne { isAdminBootstrap: 1, createdBy: null, birthDate: '1985-03-02' }, expires_at − created_at = 24 h, seule l'empreinte stockée
// date absente, '1985-02-30' ou '2015-01-01' → code 1, rien sur stdout
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- invitation bootstrap` → `Failed to resolve import "../../src/auth/bootstrap"`, puis 404 sur `/api/admin/invitations`.

- [ ] **Step 3: Implement**

`acceptInvitation`, dans cet ordre (Review Focus 1) : (1) Zod ; (2) `termsVersion !== PRIVACY_POLICY_VERSION` → `validation { field: 'termsVersion' }` ; (3) état lu hors transaction ; (4) `validateUsername`, `validatePassword` avec le rôle visé (`admin` si `is_admin_bootstrap`) ; (5) `hashPassword` **hors transaction** ; (6) dans `deps.db.transaction()` : relire l'état, refuser un `usernameKey` pris, puis
```sql
UPDATE invitation SET used_at = :now, used_by = :uid, birth_date = NULL WHERE id = :id AND used_at IS NULL AND revoked_at IS NULL
```
`numUpdatedRows !== 1n` → `invitation_used` ; insérer le `user` (`birthDate` de l'invitation, `termsAcceptedAt`, `lastLoginAt`, `passwordChangedAt` = now, `writeStamp`), `createSession`, `invitation_used` (`details { invitationId }`). `POST /check` et `/accept` passent d'abord par `authLimiters(deps).invitationCheck.hit(ip)`. Révocation : inconnue → `not_found`, non `pending` → `conflict`, `birth_date = NULL`. `bootstrapAdminInvitation` : admin existant → `conflict { reason: 'admin_exists' }`, sinon révoque les amorçages `pending` puis `createInvitation(… { isAdminBootstrap: true, ttlMs: 24 h, createdBy: null })`.

Messages CLI (stderr, code 1) : « Date de naissance invalide : utilise --birth-date AAAA-MM-JJ. » ; « appsport est réservé aux 16 ans et plus. » ; « Un administrateur existe déjà : utilise admin:reset <pseudo>. »

- [ ] **Step 4: Run test to verify it passes**

Même commande → `Test Files  3 passed` ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(auth): invitations à usage unique, création de compte et amorçage admin"`

---

### Task 12: Réinitialisation, gestion des membres et état du serveur

**Files:**
- Create: `apps/server/src/auth/password-reset.ts`, `apps/server/src/admin/{members.ts, routes.ts, ops-status.ts}`, `packages/contracts/src/ops.ts`
- Modify: `apps/server/src/auth/routes.ts` (`/reset/check`, `/reset`), `packages/contracts/src/{index.ts, api/admin.ts, api/auth.ts}`, `apps/server/src/routes.ts` (`/api/admin`), `apps/server/src/cli.ts` (`admin:reset`)
- Test: `apps/server/test/auth/password-reset.test.ts`, `apps/server/test/admin/{members,ops-status}.test.ts`

**Interfaces:**
- Consumes : T8 à T11 (`createSecretCode`, `hashSecret`, `parseSecretCode`, `validatePassword`, `hashPassword`, `RESET_TTL_HOURS`, sessions, `logSecurityEvent`, `authLimiters`, `buildMe`, `verifyUserPassword`, `storeNewPassword`, `getConsentState`, `acceptInvitation`, support) ; T2 ; T4a ; T7.
- Produces : Interfaces partagées §3 (`ResetCheckResponse`, `ResetPasswordRequest`, `OpsCheck`, `OpsStatus`, `MemberSummary`, `ResetLinkResponse`, `SetStatusRequest`, `SetRoleRequest`, `SetBirthDateRequest`, `OpsStatusResponse`, `password-reset.ts`, `admin/members.ts` (avec `type AdminActor = { actorId: string; ip: string | null }`, non exporté), `ops-status.ts`, `adminRoutes`, commande `admin:reset`).

**Spec:** 02 R-RST-1 à R-RST-4, R-ADM-1, R-ROLE-2, R-ROLE-4, R-ROLE-5, R-AGE-4, R-AUTH-2, R-AUTH-7, §6, §15 n°8 et n°9 ; 03 P-AUT-5, P-AUT-8, P-MIN-1, P-MIN-2, §5 ; 08 §9.

- [ ] **Step 1: Write the failing test**

```ts
// password-reset.test.ts (02 §15 n°8)
expect(r.link).toBe(`https://appsport.test.ts.net/reset#${r.code}`); expect(r.expiresAt).toBe('2026-10-07T10:00:00.000Z');
// check (code en minuscules) → { username: 'lea' } ; reset → 200 MeResponse de la cible + cookie ; ancienne session → 401 ; réutilisation → { error: 'reset_invalid' } ;
//   password_reset_created et password_reset_used journalisés
// +24 h → reset_invalid ; un nouveau lien annule le précédent ; un changement de mot de passe aussi (R-RST-2)
// 10 échecs de connexion puis reset → la connexion avec le nouveau mot de passe → 200 (déblocage)
// 'lea lea lea lea' → { error: 'password_rejected', reason: 'contains_username' }, lien intact
// lien pour soi-même → 403 { error: 'reset_self_forbidden' } (R-RST-4)
// CLI : admin:reset inconnu → 1 sans sortie ; après bootstrap + acceptInvitation(ctx.deps, { username: 'porteur', password: 'quatorze carac' }) :
expect(await runCli(['admin:reset', 'PORTEUR'], env, (l) => out.push(l))).toBe(0);
expect(out[0]).toBe('Lien de réinitialisation pour porteur (valable 24 h)');
expect(out[1]).toMatch(/^Lien : https:\/\/appsport\.test\.ts\.net\/reset#[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/); expect(out[2]).toBe(`Code : ${out[1]!.split('#')[1]}`);
// members.test.ts (02 §6)
expect(list[0]).toEqual({ id: m.id, username: 'lea', role: 'member', status: 'active', isMinor: true, lastLoginAt: '2026-10-06T10:00:00.000Z',
  onboardingCompleted: true, consents: { health: true, ai_coach: false }, activeSessions: 2 });   // liste triée ['lea', 'porteur']
// membre → { error: 'forbidden' } sur /api/admin/* (R-ROLE-4)
// dernier admin actif : role member ou status disabled → { error: 'last_admin' } ; un autre admin disabled ne compte pas (409) ; un autre admin actif → 204 (R-ROLE-2, 02 §15 n°9)
// rôle : mot de passe admin faux → invalid_credentials ; bon → 204, { role: 'admin', updatedBy: admin.id }, un role_changed (P-AUT-5)
// disabled → sessions 401, connexion { error: 'account_disabled' } ; active → connexion 200 (R-ADM-1)
// birth-date '2010-10-07' → under_min_age ; '2009-01-01' → 204 et un birth_date_corrected (R-AGE-4)
// revoke-sessions → 204, session 401, un sessions_revoked (R-AUTH-7) ; membre inconnu → { error: 'not_found' }
// ops-status.test.ts (08 §9) : readOpsStatus → null si absent, JSON invalide ou { backup: { at: 'x', ok: 'oui' } } ; sinon le contenu validé
// GET /api/admin/ops-status avec config { dataDir, version: 'v1.2.3' } → { version: 'v1.2.3', opsStatus: null }
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- password-reset members ops-status` → `Failed to resolve import "../../src/admin/ops-status"`.

- [ ] **Step 3: Implement**

`consumePasswordReset` : `checkPasswordReset`, compte `disabled` → `account_disabled`, `validatePassword` et `hashPassword` hors transaction, puis dans la transaction
```sql
UPDATE password_reset SET used_at = :now WHERE id = :id AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > :now
```
(≠ 1 ligne → `reset_invalid`), `storeNewPassword`, `revokeSessions(…, 'password_reset')`, `createSession`, `password_reset_used` ; après commit `authLimiters(deps).login.unlock(usernameKey)`. `listMembers` ne lit aucune table C1 à C3 hors `consent_event` (`activeSessions` = non révoquées, `expiresAt > now`, `lastSeenAt + 90 j > now`). Journaux : `role_changed { role }`, `status_changed { status }` (et `revokeSessions(…, 'admin')` si `disabled`), `birth_date_corrected` sans détail, `sessions_revoked { count }`. CLI `admin:reset` : pseudo cherché par `usernameKey` ; absent → « Pseudo inconnu : <pseudo> » sur stderr, code 1.

- [ ] **Step 4: Run test to verify it passes**

Même commande → `Test Files  3 passed` ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(admin): liens de réinitialisation, gestion des membres et état du serveur"`

---

### Task 13: Export, suppression du compte, isolation admin et purge

**Files:**
- Create: `apps/server/src/privacy/{export.ts, delete-account.ts}`, `apps/server/src/auth/purge.ts`, `packages/contracts/src/api/export.ts`
- Modify: `packages/contracts/src/{index.ts, api/auth.ts, api/admin.ts}`, `apps/server/src/auth/me-routes.ts` (`GET /export`, `POST /delete`), `apps/server/src/admin/routes.ts` (`POST /members/:id/delete`), `apps/server/src/jobs/registry.ts` (`authPurgeJob`)
- Test: `apps/server/test/privacy/{export,delete,admin-isolation}.test.ts`, `apps/server/test/auth/purge.test.ts`

**Interfaces:**
- Consumes : T5 (`entityRules`, `rowToCamel`, `insertFixtureRow`) ; T4a (`tableKey`, `Migration`) ; T7 (`DAILY_JOBS`, `DailyJob`) ; T9 à T12 (`logSecurityEvent`, `clearSessionCookie`, `requireUser`, `requireAdmin`, `verifyUserPassword`, `assertNotLastAdmin`, support) ; T8 (constantes de conservation).
- Produces : Interfaces partagées §3 (`EXPORT_FORMAT`, `ExportV1`, `DeleteAccountRequest`, `AdminDeleteMemberRequest`, `buildExport`, `deleteAccount`, `authPurgeJob`). **[décision plan]** `tables` est indexé par le nom SQL ; lignes en camelCase, valeurs telles que stockées (0/1, JSON en texte).

**Spec:** 02 R-EXP-1, R-EXP-2, R-SUP-1 à R-SUP-6, R-REG-1, §15 n°14, n°18, n°19 ; 03 P-CAT-2, P-DRT-1, P-DRT-3 à P-DRT-5, P-ADM-1, P-ADM-2, §7, §17 n°1, n°9, n°12 ; 01 R-SYN-24.

- [ ] **Step 1: Write the failing test**

```ts
// export.test.ts (R-EXP-1, R-EXP-2, P-DRT-1)
expect(exp.format).toBe('appsport-export/1'); expect(exp.exportedAt).toBe('2026-10-06T10:00:00.000Z');
expect(exp.account).toMatchObject({ id: u.id, username: 'lea' }); expect(exp.account).not.toHaveProperty('passwordHash');
expect(Object.keys(exp.tables).sort()).toEqual(Object.entries(entityRules).filter(([t, r]) => r.exported && t !== 'user').map(([t]) => t).sort());
// pas de 'session' ; place → [id du lieu de u] ; gyms → [salle fréquentée par u] (pas celle d'un autre) ; gymHistory → [ligne écrite par u] ; pas de '$argon2id'
// data_exported { actorId: u.id, targetId: u.id, details: null } ; Content-Disposition attachment; filename="appsport-export-2026-10-06.json"
// table fixture_export ajoutée par migration + registre (exported, secret 'secret_hash') → exportée sans changer le code : [{ id: 'f1', ownerId, label: 'témoin' }]
// delete.test.ts (R-SUP-1 à R-SUP-6, P-DRT-3) : une ligne plantée dans chaque table liée (registre) + gym, gym_equipment, gym_history, invitation.used_by
// mot de passe faux → invalid_credentials ; bon → 204, Set-Cookie Max-Age=0
// aucune colonne de sqlite_schema (hors security_event) ne contient l'id ; aucune FK vers user ne le référence (02 §15 n°18)
// 2 sessions { revokedReason: 'account_deleted', userId: null } ; gym conservée ; gym_history.author_id NULL ; account_deleted { targetId: u.id, details: null }
// l'autre session de u → 410 { error: 'account_deleted' }
expect(Object.entries(entityRules).filter(([, r]) => r.onUserDelete === 'anonymize').map(([t]) => t)).toEqual(['session']);
// admin : confirmUsername 'leo' → { error: 'validation' } ; 'LÉA' pour 'Léa' → 204 (R-SUP-2) ; dernier admin : /api/me/delete et /api/admin/members/:id/delete → 409 last_admin (R-SUP-4)
// admin-isolation.test.ts (P-ADM-1, P-ADM-2, 02 §15 n°14, 03 §17 n°1) : une ligne C1–C3 de B par table liée, témoins TEMOIN_TP, TEMOIN_HS, TEMOIN_LIM et ids ;
//   chaque route enregistrée /api/admin/* (sauf /delete), appelée par l'admin, ne renvoie aucun témoin ;
//   chaque route /api/(me|places)/…:id (hors POST) appelée par l'admin avec un id de B → 404. Le test couvre d'office les routes de T18 et T19.
// purge.test.ts (03 §7) : DAILY_JOBS contient authPurgeJob ('auth-purge')
// sessions à now = '2026-10-06T10:00:00.000Z' : révoquée le 2026-09-05 → purgée ; le 2026-09-07 → gardée ; inactive depuis le 2026-06-07 → purgée ;
//   active → gardée ; account_deleted expirant à now + 1 ms → gardée ; expirant à now → purgée
// invitations : expirée → birth_date NULL ; en attente → gardée ; utilisée le 2026-09-06 ou révoquée le 2026-09-01 → purgées
// password_reset : utilisé le 2026-09-06 → purgé ; annulé le 2026-09-07 → gardé ; expiré le 2026-09-05 → purgé
// security_event at '2025-10-06T09:59:59.999Z' → purgé ; '2025-10-06T10:00:00.000Z' → gardé
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- export delete admin-isolation purge` → `Failed to resolve import "../../src/privacy/export"`.

- [ ] **Step 3: Implement**

- `buildExport` lit `deps.entityRules` : tables `exported` hors `user` dont `ownerColumn` ∈ {`owner_id`, `user_id`}, sans `secretColumns` ; `gyms` = salles d'un `place` de l'utilisateur (supprimé compris), créées par lui ou dont il a écrit l'historique.
- `deleteAccount` dans la transaction reçue : `not_found`, `assertNotLastAdmin`, sessions → `user_id = NULL`, `revoked_reason = 'account_deleted'`, `revoked_at = COALESCE(revoked_at, now)` ; `gym_history.author_id = NULL` ; `DELETE FROM user` (les FK font le reste) ; `account_deleted` sans détail ; `security_event` jamais modifié.
- `authPurgeJob` (R = 30 j) : session `account_deleted` supprimée si `expires_at <= now` ; autres sessions si `min(revoked_at, last_seen_at + 90 j, expires_at) + R <= now` ; invitations : `birth_date = NULL` si expirée sans usage ni révocation, suppression si `COALESCE(used_at, revoked_at, expires_at) + R <= now` ; `password_reset` si `COALESCE(used_at, cancelled_at, expires_at) + R <= now` ; `security_event` si `at < now − 12 mois calendaires` ; `logger.info('auth purge', { job: 'auth-purge', count })`.

- [ ] **Step 4: Run test to verify it passes**

Même commande → `Test Files  4 passed` ; `pnpm test` (dont le registre T5) et `pnpm typecheck` verts.

- [ ] **Step 5: Commit**

`git commit -m "feat(privacy): export appsport-export/1, suppression de compte, isolation admin et purge"`
