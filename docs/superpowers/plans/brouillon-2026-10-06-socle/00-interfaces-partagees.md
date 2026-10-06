## Shared Interfaces

Ces noms et signatures sont contractuels. Une tâche qui consomme un nom l'importe tel quel. Une tâche qui le produit le crée avec exactement cette signature. Le propriétaire est indiqué par `[partie Tn]`.

### 0. Conventions de code partagées
- Chaque schéma Zod est exporté avec son type sous le même nom : `export const X = z.object(...); export type X = z.infer<typeof X>;`.
- Les clés JSON du réseau, de Dexie et de l'export sont en camelCase. `entityRules` et le SQL sont en snake_case. La conversion passe par `case.ts`.
- Les booléens SQL (0/1) sont convertis en `boolean` à la frontière API et pull.
- Le code serveur importe les tests via `@appsport/server/testing`.

### 1. contracts : base [fondations]
```ts
// packages/contracts/src/constants.ts [T2]
export const MIN_AGE = 16; export const ADULT_AGE = 18;
export const PARIS_TZ = 'Europe/Paris';
export const PRIVACY_POLICY_VERSION = '1.0';      // version de la page « Confidentialité et règles » (MAJEUR.MINEUR)
export const SYNC_PROTOCOL = 1; export const MIN_PROTOCOL = 1;
export type Role = 'admin' | 'member'; export type UserStatus = 'active' | 'disabled'; export type AgeBand = 'minor' | 'adult';

// packages/contracts/src/case.ts [T5]
export function snakeToCamel(key: string): string; export function camelToSnake(key: string): string;
export function rowToCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T;

// packages/contracts/src/entity-rules.ts [T5]
export type DataCategory = 'C0' | 'C1' | 'C2' | 'C3';
export type SyncClass = 'J' | 'D' | 'E' | 'C' | 'H';
export type OnUserDelete = 'cascade' | 'set_null' | 'anonymize' | 'keep' | 'not_linked';
export interface EntityRule {
  category: DataCategory; syncClass: SyncClass;
  ownerColumn: 'owner_id' | 'user_id' | 'id' | null;   // 'id' pour user
  columns: readonly string[];          // toutes les colonnes SQL, snake_case
  clientWritable: readonly string[];   // colonnes poussables par l'outbox (J seulement ; [] sinon)
  c2Columns: readonly string[]; secretColumns: readonly string[];
  exported: boolean; onUserDelete: OnUserDelete;
}
export type EntityRulesMap = Readonly<Record<string, EntityRule>>;
export const SYNC_COLUMNS: readonly ['owner_id','rev','created_at','updated_at','updated_by','deleted_at'];
export const entityRules: EntityRulesMap;
export function mirroredTables(rules?: EntityRulesMap): string[];   // syncClass J|D|E, tri alphabétique
```
Valeurs fixées pour les 18 tables (category / syncClass / ownerColumn / exported / onUserDelete, secrets et clientWritable) :
- `server_meta` C0/H/null/false/not_linked
- `schema_migrations` C0/H/null/false/not_linked
- `applied_op` C0/H/user_id/false/cascade
- `sync_rejection` C1/J/owner_id/true/cascade, clientWritable `['dismissed_at']`
- `user` C0/E/id/true/cascade, secret `['password_hash']`
- `invitation` C0/H/null/false/set_null, secret `['code_hash']`
- `password_reset` C0/H/user_id/false/cascade, secret `['code_hash']`
- `session` C1/H/user_id/false/anonymize, secret `['token_hash']`
- `consent_event` C1/E/owner_id/true/cascade
- `security_event` C0/H/null/false/keep
- `training_profile` C1/E/owner_id/true/cascade
- `health_screening` C2/E/owner_id/true/cascade
- `limitation` C2/E/owner_id/true/cascade
- `gym` C0/E/null/false/set_null
- `gym_equipment` C0/E/null/false/set_null
- `gym_history` C0/H/null/false/set_null
- `place` C1/E/owner_id/true/cascade
- `home_equipment` C1/E/owner_id/true/cascade

```ts
// packages/contracts/src/api/errors.ts [T6]
export const ApiErrorCode = z.enum(['validation','unauthenticated','invalid_credentials','forbidden','origin_mismatch',
 'unsupported_media_type','account_disabled','password_change_required','health_consent_required','reset_self_forbidden',
 'not_found','conflict','username_taken','last_admin','gym_duplicate','gym_in_use','place_exists','last_place',
 'primary_required','onboarding_incomplete','password_rejected','username_invalid','under_min_age',
 'invitation_expired','invitation_used','invitation_revoked','invitation_unknown','reset_invalid',
 'account_deleted','watermark_expired','protocol_unsupported','rate_limited','internal']);
export const ERROR_STATUS: Record<ApiErrorCode, number>;
// 400 : validation, password_rejected, username_invalid, under_min_age, invitation_*, reset_invalid
// 401 : unauthenticated, invalid_credentials
// 403 : forbidden, origin_mismatch, account_disabled, password_change_required, health_consent_required, reset_self_forbidden
// 404 : not_found
// 409 : conflict, username_taken, last_admin, gym_duplicate, gym_in_use, place_exists, last_place, primary_required, onboarding_incomplete
// 410 : account_deleted, watermark_expired ; 415 : unsupported_media_type ; 426 : protocol_unsupported ; 429 : rate_limited ; 500 : internal
export const ApiErrorBody = z.object({ error: ApiErrorCode }).passthrough();

// packages/contracts/src/api/health.ts [T6]
export const HealthResponse = z.object({ status: z.enum(['ok','error']), version: z.string(), db: z.enum(['ok','error']),
  protocol: z.number().int(), minProtocol: z.number().int(), epoch: z.string().nullable(), swKill: z.boolean() });
```

### 2. domain : base [fondations T2]
```ts
// packages/domain/src/ids.ts
export function createUuidV7(unixMs: number, random: Uint8Array /* ≥10 octets */): string;
export function createMonotonicUuidV7(now: () => number, random: (n: number) => Uint8Array): () => string; // strictement croissant même si l'horloge recule
export function isUuidV7(s: string): boolean;
// packages/domain/src/age.ts
export function parisDate(instant: Date): string;                 // 'YYYY-MM-DD' à Europe/Paris
export function ageOn(birthDate: string, today: string): number;  // années révolues ; né un 29/02 → anniversaire le 01/03 les années non bissextiles
export function ageBandOn(birthDate: string, today: string): AgeBand; // < 18 → 'minor'
// packages/domain/src/cautious.ts
export function computeCautious(i: { ageBand: AgeBand; cautiousMode: boolean; healthConsentActive: boolean; caution: boolean | null }): boolean;
```

### 3. Serveur : cœur [fondations]
```ts
// apps/server/src/deps.ts [T6]
export interface Clock { now(): Date }
export interface IdGen { uuidv7(): string; randomBytes(n: number): Uint8Array }
export const systemClock: Clock; export function cryptoIds(): IdGen;
export interface Argon2Params { memoryKiB: number; passes: number; parallelism: number; tagLength: number; saltLength: number }
export interface AppDeps { db: Kysely<Database>; sqlite: DatabaseSync; clock: Clock; ids: IdGen; config: AppConfig; logger: Logger;
  entityRules: EntityRulesMap; syncHooks: SyncHooksMap /* ajouté par synchro T20, défaut SYNC_HOOKS */ }
// apps/server/src/config.ts [T6]
export interface AppConfig { appOrigin: string; version: string; port: number; host: string; dataDir: string; dbPath: string;
  sentinelPath: string; publicDir: string; contentDir: string; swKillSwitch: boolean; coachModel: string;
  anthropicApiKey: string | null; argon2: Argon2Params; sessionCookieName: '__Host-session' | 'dev-session'; secureCookie: boolean }
export function loadConfig(env: Record<string, string | undefined>): AppConfig; // Zod ; dbPath = dataDir/appsport.db ; sentinelPath = dataDir/.appsport-volume
// apps/server/src/app-env.ts [T6]
export interface SessionUser { id: string; username: string; role: Role; birthDate: string; mustChangePassword: boolean }
export type AppEnv = { Variables: { requestId: string; clientIp: string | null; user: SessionUser | null; sessionId: string | null } };
// apps/server/src/app.ts [T6]
export function createApp(deps: AppDeps): Hono<AppEnv>; // ordre : requestId → request-log → security-headers → epoch-header (/api) → origin-guard → session (comptes T9) → mountRoutes → onError
// apps/server/src/routes.ts [T6]
export function mountRoutes(app: Hono<AppEnv>, deps: AppDeps): void; // chaque partie ajoute app.route('/api/…', xxxRoutes(deps)) ; static (pwa) monté en dernier
// apps/server/src/http/errors.ts [T6]
export class HttpError extends Error { constructor(status: number, code: ApiErrorCode, extra?: Record<string, unknown>) }
export function httpError(code: ApiErrorCode, extra?: Record<string, unknown>): HttpError; // statut pris dans ERROR_STATUS
// apps/server/src/http/validate.ts [T6]
export async function parseJson<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T>;  // 400 {error:'validation', issues}
export function parseQuery<T>(c: Context<AppEnv>, schema: z.ZodType<T>): T;
// apps/server/src/http/client-ip.ts [T6]
export function clientIp(c: Context<AppEnv>): string | null; // X-Forwarded-For seulement si le pair TCP est loopback ou absent (tests)
// apps/server/src/logger.ts [T6]
export type LogFields = Partial<{ requestId: string; method: string; route: string; status: number; durationMs: number;
  event: string; code: string; count: number; migration: string; job: string }>;
export interface Logger { info(msg: string, f?: LogFields): void; warn(msg: string, f?: LogFields): void; error(msg: string, f?: LogFields): void }
export function createLogger(write?: (line: string) => void): Logger; // JSON par ligne ; champs hors liste blanche ignorés
// apps/server/src/db/open.ts [T3]
export function openDatabase(path: string): { sqlite: DatabaseSync; db: Kysely<Database> }; // ':memory:' accepté ; pragmas appliqués ; CamelCasePlugin
// apps/server/src/db/sqlite-dialect.ts [T3]
export class NodeSqliteDialect implements Dialect { constructor(cfg: { database: DatabaseSync }) } // 1 connexion + mutex ; savepoints
// apps/server/src/db/schema.ts [T4]
export interface Database { serverMeta: ServerMetaTable; schemaMigrations: SchemaMigrationsTable; appliedOp: AppliedOpTable;
  syncRejection: SyncRejectionTable; user: UserTable; invitation: InvitationTable; passwordReset: PasswordResetTable;
  session: SessionTable; consentEvent: ConsentEventTable; securityEvent: SecurityEventTable; trainingProfile: TrainingProfileTable;
  healthScreening: HealthScreeningTable; limitation: LimitationTable; gym: GymTable; gymEquipment: GymEquipmentTable;
  gymHistory: GymHistoryTable; place: PlaceTable; homeEquipment: HomeEquipmentTable }
export type DbExecutor = Kysely<Database> | Transaction<Database>;
export function tableKey(sqlTable: string): keyof Database;   // 'training_profile' → 'trainingProfile'
// apps/server/src/db/migrations/index.ts [T4]
export interface Migration { id: string; breaking: boolean; up(db: Kysely<any>): Promise<void> }
export const MIGRATIONS: readonly Migration[]; // [{ id: '0001_socle', breaking: false }]
// apps/server/src/db/migrate.ts [T4]
export class MigrationError extends Error { code: 'migration_failed' | 'unknown_breaking_migration' }
export async function migrate(db: Kysely<any>, migrations: readonly Migration[], clock: Clock):
  Promise<{ applied: string[]; unknownNonBreaking: string[] }>;
// apps/server/src/db/server-meta.ts [T4]
export interface ServerMeta { serverEpoch: string; epochBaseRev: number; syncCounter: number; tombstonePurgeRev: number;
  catalogVersion: string | null; catalogUpdatedAt: string | null }
export async function getServerMeta(db: DbExecutor): Promise<ServerMeta>;
export async function initServerMeta(db: DbExecutor, ids: IdGen): Promise<ServerMeta>; // epoch uuidv7, compteurs à 0
// apps/server/src/db/rev.ts [T4]
export async function nextRev(trx: DbExecutor): Promise<number>; // UPDATE server_meta SET sync_counter = sync_counter+1 RETURNING
export async function writeStamp(trx: DbExecutor, deps: AppDeps, actorId: string | null):
  Promise<{ rev: number; updatedAt: string; updatedBy: string | null }>;
// apps/server/src/startup.ts / startup-guard.ts / jobs [T7]
export interface StartupTask { name: string; run(deps: AppDeps): Promise<void> }
export const STARTUP_TASKS: StartupTask[];   // exécutées après migrate, avant listen
export function assertStartupPreconditions(cfg: AppConfig, fs?: { existsSync(p: string): boolean }): void; // throw StartupError('no_sentinel'|'no_database')
export interface DailyJob { name: string; run(deps: AppDeps): Promise<void> }
export const DAILY_JOBS: DailyJob[];
export function startDailyJobs(deps: AppDeps, jobs: DailyJob[]): { stop(): void }; // 1 passage au démarrage puis toutes les 24 h
// apps/server/src/main.ts / cli.ts [T7]
export async function main(argv: string[]): Promise<number>;
export async function runCli(argv: string[], env: Record<string,string|undefined>, out?: (line: string) => void): Promise<number>;
// Commandes du socle : init | db:check | admin:bootstrap --birth-date AAAA-MM-JJ | admin:reset <pseudo>
//  | privacy:collect --since <ISO> [--source <fichier.db>] --out <fichier.json> | privacy:reapply <fichier.json>
//  | snapshot --tag daily|pre-vX.Y.Z | restore <fichier.db>.  Code de sortie 0 = OK, 1 = erreur (message FR sur stderr).
```
Support de test `[fondations T5/T6]` (`apps/server/test/support`, exporté par `@appsport/server/testing`) :
```ts
export class FakeClock implements Clock { constructor(iso?: string /* '2026-10-06T10:00:00.000Z' */); now(): Date; set(iso: string): void; advance(ms: number): void }
export function seqIds(seed?: number): IdGen;                     // UUIDv7 monotones déterministes
export const TEST_ARGON2: Argon2Params;                           // { memoryKiB: 1024, passes: 1, parallelism: 1, tagLength: 32, saltLength: 16 }
export interface TestRequestInit { method?: string; json?: unknown; cookie?: string; origin?: string | null; ip?: string; headers?: Record<string,string> }
export interface TestContext { app: Hono<AppEnv>; deps: AppDeps; clock: FakeClock; request(path: string, init?: TestRequestInit): Promise<Response>; close(): void }
export async function createTestContext(opts?: { now?: string; config?: Partial<AppConfig>; extraMigrations?: Migration[];
  entityRules?: EntityRulesMap; deps?: Partial<AppDeps> }): Promise<TestContext>;   // :memory:, migré, server_meta initialisé, APP_ORIGIN 'https://appsport.test.ts.net'
export async function insertFixtureRow(db: Kysely<Database>, table: string, values?: Record<string, unknown>): Promise<Record<string, unknown>>;
```

### 4. Comptes [comptes]
```ts
// packages/contracts/src/auth-constants.ts [T8]
export const INVITATION_TTL_DAYS = 7; export const BOOTSTRAP_INVITATION_TTL_HOURS = 24; export const RESET_TTL_HOURS = 24;
export const SECRET_CODE_LENGTH = 16; export const INVITATION_NOTE_MAX = 60;
export const USERNAME_MIN = 3; export const USERNAME_MAX = 24; export const RESERVED_USERNAMES = ['admin','appsport','systeme'] as const;
export const PASSWORD_MIN_MEMBER = 12; export const PASSWORD_MIN_ADMIN = 14; export const PASSWORD_MAX = 128;
export const SESSION_IDLE_DAYS = 90; export const SESSION_MAX_DAYS = 365; export const ADMIN_PASSWORD_REMINDER_MONTHS = 12;
// packages/domain/src/auth/* [T8]
export function usernameKey(username: string): string;   // NFKC puis toLowerCase
export type UsernameCheck = { ok: true } | { ok: false; reason: 'length' | 'characters' | 'reserved' };
export function validateUsername(username: string): UsernameCheck;
export type PasswordRejection = 'too_short' | 'too_long' | 'common' | 'contains_username' | 'contains_appsport' | 'single_char';
export function validatePassword(pw: string, ctx: { username: string; role: Role; commonPasswords: ReadonlySet<string> }):
  { ok: true } | { ok: false; reason: PasswordRejection };
export function encodeCrockford(bytes: Uint8Array): string;   // 10 octets → 16 caractères
export function parseSecretCode(input: string): string | null; // lien complet ou code ; casse, espaces, tirets ignorés ; I/L→1, O→0 ; → 16 car. canoniques
export function formatSecretCode(canonical: string): string;   // 'XXXX-XXXX-XXXX-XXXX'
// apps/server/src/auth/password-hash.ts / secret.ts [T8]
export const ARGON2_PARAMS: Argon2Params; // { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 }
export async function hashPassword(pw: string, params: Argon2Params, ids: IdGen): Promise<string>; // $argon2id$v=19$m=…,t=…,p=…$salt$hash
export async function verifyPassword(pw: string, phc: string): Promise<boolean>;
export function needsRehash(phc: string, params: Argon2Params): boolean;
export function createSecretCode(ids: IdGen): { canonical: string; formatted: string; hash: string };
export function hashSecret(canonical: string): string; // sha256 hex
export const COMMON_PASSWORDS: ReadonlySet<string>;   // minuscules
// apps/server/src/auth/security-log.ts [T9]
export type SecurityEventType = 'login_succeeded'|'login_failed'|'login_blocked'|'logout'|'logout_all'|'password_changed'
 |'password_reset_created'|'password_reset_used'|'invitation_created'|'invitation_revoked'|'invitation_used'|'role_changed'
 |'status_changed'|'sessions_revoked'|'birth_date_corrected'|'username_changed'|'consent_granted'|'consent_revoked'
 |'data_exported'|'account_deleted'|'gym_deleted';
export interface SecurityEventInput { type: SecurityEventType; actorId: string | null; targetId: string | null; ip: string | null;
  outcome: 'success' | 'failure' | 'blocked'; details?: Record<string, string | number | boolean> }
export async function logSecurityEvent(trx: DbExecutor, deps: AppDeps, ev: SecurityEventInput): Promise<void>;
// consent_revoked : details { consentType: 'health' | 'ai_coach' } ; account_deleted : targetId = id du compte, aucun détail
// apps/server/src/auth/session.ts [T9]
export async function createSession(trx: DbExecutor, deps: AppDeps, userId: string): Promise<{ token: string; sessionId: string }>;
export function setSessionCookie(c: Context<AppEnv>, deps: AppDeps, token: string): void; export function clearSessionCookie(c: Context<AppEnv>, deps: AppDeps): void;
export async function revokeSessions(trx: DbExecutor, deps: AppDeps, userId: string, reason: 'logout'|'logout_all'|'password_change'|'password_reset'|'admin', exceptSessionId?: string): Promise<number>;
export function sessionMiddleware(deps: AppDeps): MiddlewareHandler<AppEnv>; // renseigne user/sessionId ; ne bloque jamais
export const requireUser: MiddlewareHandler<AppEnv>;  // 410 account_deleted | 401 unauthenticated | 403 password_change_required (sauf GET /api/me, POST /api/auth/password, POST /api/auth/logout)
export const requireAdmin: MiddlewareHandler<AppEnv>; // requireUser + rôle admin, sinon 403 forbidden
// apps/server/src/auth/limiter.ts [T10]
export interface LoginLimiter { check(usernameKey: string, ip: string | null): { allowed: true } | { allowed: false; retryAfterS: number };
  recordFailure(usernameKey: string, ip: string | null): void; recordSuccess(usernameKey: string): void; unlock(usernameKey: string): void }
export function createLoginLimiter(clock: Clock): LoginLimiter;
export function createIpLimiter(clock: Clock, opts: { limit: number; windowMs: number }): { hit(ip: string | null): { allowed: boolean; retryAfterS: number } };
// apps/server/src/privacy/consent-state.ts [T10]
export type ConsentType = 'health' | 'ai_coach';
export async function getConsentState(db: DbExecutor, userId: string): Promise<ConsentState>;
export async function isHealthConsentActive(db: DbExecutor, userId: string): Promise<boolean>;
// apps/server/src/auth/me.ts [T10]
export async function buildMe(db: DbExecutor, deps: AppDeps, userId: string): Promise<MeResponse>;
export async function verifyUserPassword(db: DbExecutor, userId: string, password: string): Promise<boolean>;
// apps/server/src/auth/invitations.ts / bootstrap.ts [T11]
export type InvitationState = 'pending' | 'used' | 'revoked' | 'expired';
export async function bootstrapAdminInvitation(deps: AppDeps, birthDate: string): Promise<{ code: string; link: string; expiresAt: string }>; // refus si un admin existe
// apps/server/src/privacy/delete-account.ts / export.ts [T13]
export async function deleteAccount(trx: Transaction<Database>, deps: AppDeps, userId: string, actor: { actorId: string | null; ip: string | null }): Promise<void>; // throw httpError('last_admin')
export async function buildExport(db: DbExecutor, deps: AppDeps, userId: string): Promise<ExportV1>;
// apps/server/test/support/users.ts [T10]
export async function createUser(ctx: TestContext, o?: { username?: string; password?: string; role?: Role; birthDate?: string; status?: UserStatus; onboarded?: boolean }): Promise<{ id: string; username: string; password: string }>;
// défauts : username user<N>, password 'cheval agrafe batterie correcte', birthDate '1990-01-01', role member, onboarded false
export async function login(ctx: TestContext, username: string, password: string): Promise<string /* en-tête Cookie */>;
export async function createUserAndLogin(ctx: TestContext, o?: Parameters<typeof createUser>[1]): Promise<{ id: string; username: string; password: string; cookie: string }>;
```
Contrats API des comptes, dans `packages/contracts/src/api/auth.ts` et `api/admin.ts` :
```ts
export const ONBOARDING_STEPS = ['goal','sport','place_kind','place','experience','availability','health','ready'] as const; // [T10]
export type OnboardingStep = typeof ONBOARDING_STEPS[number];
export const ConsentState = z.object({ health: ConsentStatus, ai_coach: ConsentStatus }); // ConsentStatus = { active: boolean; textVersion: string|null; at: string|null }
export const MeResponse = z.object({ id, username, role, status, birthDate, ageBand, cautious: z.boolean(), mustChangePassword: z.boolean(),
  passwordReminderDue: z.boolean(), onboardingStep: OnboardingStep.nullable(), onboardingCompletedAt: z.string().nullable(),
  termsVersion: z.string().nullable(), consents: ConsentState });
LoginRequest {username, password} ; ChangePasswordRequest {currentPassword, newPassword} ; UpdateMeRequest {username}
CodeRequest {code} ; InvitationCheckResponse {birthDate} ; AcceptInvitationRequest {code, username, password, termsVersion}
ResetCheckResponse {username} ; ResetPasswordRequest {code, newPassword} ; DeleteAccountRequest {password}
// admin
MemberSummary {id, username, role, status, isMinor, lastLoginAt: string|null, onboardingCompleted: boolean, consents: {health: boolean; ai_coach: boolean}, activeSessions: number}
InvitationSummary {id, note: string|null, createdAt, expiresAt, state: InvitationState, usedByUsername: string|null}
CreateInvitationRequest {birthDate, note?} ; CreateInvitationResponse {invitation: InvitationSummary, code, link}
ResetLinkResponse {code, link, expiresAt} ; SetStatusRequest {status} ; SetRoleRequest {role, password} ; SetBirthDateRequest {birthDate}
AdminDeleteMemberRequest {confirmUsername} ; OpsStatusResponse {version, opsStatus: OpsStatus | null}
// packages/contracts/src/ops.ts [T12] — format de /data/ops/status.json, écrit par les scripts hôte
OpsStatus = { backup?: OpsCheck; restoreTest?: OpsCheck; host?: OpsCheck & { disks: {mount: string; usedPct: number}[]; smartOk: boolean; rebootRequired: boolean };
  deploy?: { at: string; version: string; previousVersion: string | null; ok: boolean } } ; OpsCheck = { at: string; ok: boolean; detail?: string }
// packages/contracts/src/api/export.ts [T13]
ExportV1 = { format: 'appsport-export/1'; exportedAt: string; account: Record<string, unknown> /* user sans password_hash */;
  tables: Record<string /* table SQL */, Record<string, unknown>[]>; gyms: Record<string, unknown>[]; gymHistory: Record<string, unknown>[] }
```
Routes des comptes. Le corps des requêtes et des réponses suit les schémas ci-dessus.

| Méthode et chemin | Accès | Réponse |
|---|---|---|
| POST `/api/auth/login` | public | 200 MeResponse et cookie |
| POST `/api/auth/logout` | user | 204, cookie effacé |
| POST `/api/auth/logout-all` | user | 204, toutes les sessions fermées, y compris la courante |
| POST `/api/auth/password` | user | 204, les autres sessions sont fermées |
| POST `/api/invitations/check` | public, 20/h/IP | `{birthDate}` |
| POST `/api/invitations/accept` | public | 201 MeResponse et cookie |
| POST `/api/auth/reset/check` | public, 20/h/IP | `{username}` |
| POST `/api/auth/reset` | public | 200 MeResponse et cookie |
| GET `/api/me` | user | MeResponse |
| PATCH `/api/me` | user | MeResponse |
| GET `/api/me/export` | user | ExportV1 |
| POST `/api/me/delete` | user | 204 |
| GET `/api/admin/members` | admin | MemberSummary[] |
| POST `/api/admin/members/:id/reset-link` | admin | ResetLinkResponse |
| POST `/api/admin/members/:id/revoke-sessions` | admin | 204 |
| POST `/api/admin/members/:id/status` | admin | 204 |
| POST `/api/admin/members/:id/role` | admin | 204 |
| POST `/api/admin/members/:id/birth-date` | admin | 204 |
| POST `/api/admin/members/:id/delete` | admin | 204 |
| GET `/api/admin/invitations` | admin | InvitationSummary[] |
| POST `/api/admin/invitations` | admin | 201 CreateInvitationResponse |
| POST `/api/admin/invitations/:id/revoke` | admin | 204 |
| GET `/api/admin/ops-status` | admin | OpsStatusResponse |

Les liens ont la forme `${appOrigin}/invite#XXXX-XXXX-XXXX-XXXX` et `${appOrigin}/reset#XXXX-XXXX-XXXX-XXXX`.

Sortie exacte de `admin:bootstrap` et de `admin:reset` (3 lignes sur stdout) :
```
Invitation administrateur (valable 24 h)    |  Lien de réinitialisation pour <pseudo> (valable 24 h)
Lien : https://…/invite#XXXX-XXXX-XXXX-XXXX |  Lien : https://…/reset#XXXX-XXXX-XXXX-XXXX
Code : XXXX-XXXX-XXXX-XXXX                  |  Code : XXXX-XXXX-XXXX-XXXX
```

### 5. Profil, lieux, salles, consentement [profil]
```ts
// packages/contracts/src/taxonomy.ts [T14]
export const EQUIPMENT: readonly [ 'chair','table','resistance_band','dumbbells','kettlebell','pull_up_bar','suspension_trainer','box',
 'flat_bench','adjustable_bench','squat_rack','dip_station','back_extension_bench','barbell','ez_bar','cable_station','lat_pulldown',
 'seated_row','leg_press','smith_machine','leg_extension','leg_curl','upper_body_machines' ];   // 23
export type EquipmentCode = typeof EQUIPMENT[number]; export const EquipmentCodeSchema: z.ZodType<EquipmentCode>;
export const EQUIPMENT_CATEGORIES: Record<'household'|'small_equipment'|'benches_racks'|'free_weights'|'machines', readonly EquipmentCode[]>;
export const EQUIPMENT_LABELS: Record<EquipmentCode, string>;  // libellés FR de 04 §3.2
export const EQUIPMENT_IMPLIES: Partial<Record<EquipmentCode, readonly EquipmentCode[]>>; // { adjustable_bench: ['flat_bench'] }
export const REFERENCE_PROFILES: Record<'home_bodyweight'|'home_small_equipment'|'gym_reference', readonly EquipmentCode[]>;
// packages/contracts/src/presets.ts [T14]
export type EquipmentPresetId = 'gym_large'|'gym_small'|'gym_crossfit'|'gym_other'|'home_none'|'home_small'|'home_gym';
export const EQUIPMENT_PRESETS: Record<EquipmentPresetId, { kind: 'gym'|'home'; label: string; codes: readonly EquipmentCode[] }>;
// gym_large = tout sauf household ; gym_small = dumbbells, barbell, ez_bar, flat_bench, adjustable_bench, squat_rack, cable_station,
//   lat_pulldown, seated_row, leg_press, pull_up_bar, dip_station ; gym_crossfit = barbell, squat_rack, dumbbells, kettlebell, flat_bench,
//   pull_up_bar, suspension_trainer, box, resistance_band ; gym_other = [] ; home_none = home_bodyweight ; home_small = home_small_equipment ;
//   home_gym = chair, table, pull_up_bar, resistance_band, dumbbells, kettlebell, barbell, squat_rack, flat_bench. Défaut maison : home_none.
// packages/contracts/src/load-settings.ts [T14]
export const LoadSettings = z.object({ barG: int 5000..25000, smallestPlateG: int 250..5000,
  dumbbellsG: int 500..80000 [] croissant, sans doublon, ≤ 60, machineStepG: int 500..10000 });
export function defaultLoadSettings(kind: 'gym'|'home'): LoadSettings; // gym : 20000/1250/[2000..40000 pas 2000]/5000 ; home : dumbbellsG []
// packages/contracts/src/sports.ts [T14]
export const SPORTS: readonly { code: SportCode; label: string }[]; export const SPORTS_LIST_VERSION = 1;
export type SportCode = 'running'|'cycling'|'swimming'|'football'|'rugby'|'basketball'|'handball'|'tennis'|'padel'|'badminton'|'combat_sports'|'climbing'|'skiing'|'dance'|'other';
// packages/contracts/src/texts.ts [T14]
export const HEALTH_CONSENT_TEXT: { version: '1.0'; text: string };      // texte v1 de 03 §3
export const HEALTH_QUESTIONNAIRE: { version: '1.0'; questions: readonly [string, string, string, string] };
export function majorOf(version: string): number;
// packages/domain [T14/T15]
export function normalize(text: string): string;  // minuscules, NFD sans diacritiques, ponctuation retirée, espaces réduits
export type Goal = 'muscle'|'strength'|'fat_loss'|'fitness'|'sport_support';
export type Experience = 'none'|'lt_6_months'|'6_to_24_months'|'gt_24_months';
export type TemplateContext = 'gym'|'home'|'sport'; export type TrainingLevel = 'beginner'|'intermediate';
export interface TemplateDescriptor { id: string; context: TemplateContext; level: TrainingLevel; days: { min: number; max: number }; available: boolean }
export interface RecommendInput { goal: Goal; sportCode: string | null; primaryPlaceKind: 'gym'|'home'; experience: Experience; daysPerWeek: 2|3|4 }
export type RecommendReason = 'FEW_DAYS_FULL_BODY'|'NO_TEMPLATE_AVAILABLE'|'DAYS_ADJUSTED';
export interface Recommendation { templateId: string | null; context: TemplateContext; level: TrainingLevel; daysPerWeek: number; reasons: RecommendReason[] }
export function levelFromExperience(e: Experience): TrainingLevel;
export function recommendTemplate(input: RecommendInput, templates: readonly TemplateDescriptor[]): Recommendation; // ordre : R-REC-1, 2, 3, 4, 5
export function firstIncompleteStep(s: { goal: Goal|null; experience: Experience|null; daysPerWeek: number|null; sessionMinutes: number|null;
  hasPrimaryPlace: boolean; lastValidatedStep: OnboardingStep|null }): OnboardingStep;
// apps/server/src/privacy/consent.ts [T19]
export async function grantConsent(trx: DbExecutor, deps: AppDeps, userId: string, type: ConsentType, textVersion: string, ip: string | null): Promise<void>;
export async function withdrawHealthConsent(trx: Transaction<Database>, deps: AppDeps, userId: string, actor: { actorId: string | null; ip: string | null }): Promise<void>;
// retrait générique : tables C2 → contenu à NULL, deleted_at, nouveau rev ; c2Columns des autres tables → NULL et nouveau rev ;
// consent_event withdraw ; security_event consent_revoked. N'agit que si le consentement est actif (idempotent).
```
Contrats `api/profile.ts` [T16], `api/places.ts` [T17/T18] et `api/consent.ts` [T19] :
```ts
TrainingProfilePatch { goal?, experience?, daysPerWeek? (2|3|4), sessionMinutes? (30|45|60|75|90), sportCode?: SportCode|null,
  sportOtherLabel?: string|null (≤40), cautiousMode?: boolean, onboardingStep?: OnboardingStep }
GymSummary { id, name, city, visibleMemberCount }
GymDetail { id, name, city, loadSettings, deletedAt: string|null, equipment: EquipmentCode[], canEdit: boolean, visibleMembers: string[],
  history: { at: string; action: 'create'|'update_info'|'add_equipment'|'remove_equipment'|'update_load_settings'; authorUsername: string|null; detail: unknown }[] }
CreateGymRequest { name (2..60), city (2..60), equipment: EquipmentCode[], isPrimary: boolean, visibleAtGym?: boolean } → 201 { gymId, placeId }
UpdateGymRequest { name?, city?, loadSettings? }
CreatePlaceRequest = { kind: 'gym'; gymId; isPrimary: boolean; visibleAtGym?: boolean } | { kind: 'home'; name?: string (≤30, défaut 'Maison'); equipment: EquipmentCode[]; isPrimary: boolean }
UpdatePlaceRequest { name?, isPrimary?: true, visibleAtGym?, loadSettings? } ; DeletePlaceRequest { newPrimaryId?: string }
GrantConsentRequest { type: 'health'; textVersion } ; WithdrawConsentRequest { type: 'health'; password }
HealthScreeningRequest { answers: [boolean, boolean, boolean, boolean]; questionnaireVersion } → { caution: boolean }
LimitationInput { bodyArea, side, severity, note?: string (≤200), active?: boolean }
```

| Route | Accès | Effet ou erreurs |
|---|---|---|
| PATCH `/api/me/training-profile` | user | 200 MeResponse |
| POST `/api/me/onboarding/complete` | user | 200 MeResponse ; 409 `onboarding_incomplete` |
| GET `/api/gyms?q=` | user | GymSummary[] |
| GET `/api/gyms/similar?name=&city=` | user | GymSummary[] |
| POST `/api/gyms` | user | 409 `gym_duplicate` `{gymId}` |
| GET `/api/gyms/:id` | user | GymDetail |
| PATCH `/api/gyms/:id` | membre avec un lieu actif à cette salle, ou admin | 403 `forbidden` |
| PUT `/api/gyms/:id/equipment/:code` | même droit | 204, idempotent |
| DELETE `/api/gyms/:id/equipment/:code` | même droit | 204, idempotent |
| DELETE `/api/admin/gyms/:id` | admin | 409 `gym_in_use` |
| POST `/api/places` | user | 409 `place_exists` |
| PATCH `/api/places/:id` | user | — |
| DELETE `/api/places/:id` | user | 409 `last_place` ou `primary_required` |
| PUT `/api/places/:id/equipment/:code` | user, maison seulement | — |
| DELETE `/api/places/:id/equipment/:code` | user, maison seulement | — |
| POST `/api/me/consents` | user | — |
| POST `/api/me/consents/withdraw` | user | — |
| PUT `/api/me/health-screening` | user | 403 `health_consent_required` |
| POST `/api/me/limitations` | user | 201 `{id}` ; 403 `health_consent_required` |
| PATCH `/api/me/limitations/:id` | user | 403 `health_consent_required` |
| DELETE `/api/me/limitations/:id` | user | 403 `health_consent_required` |

Toutes les routes de ce tableau renvoient 404 quand la ressource appartient à un autre utilisateur.

### 6. Synchro [synchro]
```ts
// packages/contracts/src/sync.ts [T20]
export const SYNC_PUSH_MAX = 200; export const SYNC_PULL_LIMIT = 500; export const SYNC_TIMEOUT_MS = 4000;
export const EPOCH_RESEND_DAYS = 60; export const TOMBSTONE_TTL_DAYS = 90; export const APPLIED_OP_TTL_MONTHS = 12;
export const OpKind = z.enum(['create','patch','delete','restore_upsert']);
export const SyncOp = z.object({ opId: uuidv7, userId: z.string(), entity: z.string(), id: z.string(), kind: OpKind,
  fields: z.record(z.string(), z.unknown()) /* camelCase */, clientTs: z.string(), protocol: z.number().int(),
  attempts: z.number().int().min(0), serverRevSeen: z.number().int().nullable().optional() /* restore_upsert */ });
export const RejectionCode = z.enum(['validation','forbidden','parent_rejected','stale_revision','unknown_entity','protocol']);
export const PushRequest = z.object({ ops: z.array(SyncOp).max(SYNC_PUSH_MAX) });
export const PushResult = z.object({ opId, status: z.enum(['applied','applied_partial','duplicate','rejected']), rev: z.number().int().optional(),
  code: RejectionCode.optional(), droppedFields: z.array(z.string()).optional(), dropped: z.boolean().optional() /* ligne C2 entière écartée */ });
export const PushResponse = z.object({ results: z.array(PushResult) });
export const PulledRow = z.object({ entity: z.string(), rev: z.number().int(), row: z.record(z.string(), z.unknown()) /* camelCase, id et deletedAt inclus, sans secret */ });
export const PullResponse = z.object({ rows: z.array(PulledRow), nextWatermark: z.string(), hasMore: z.boolean(), catalogVersion: z.string().nullable() });
export function encodeWatermark(epoch: string, rev: number): string; export function decodeWatermark(w: string): { epoch: string; rev: number } | null;
// packages/contracts/src/catalog.ts [T23]
export const IllustrationRef = z.object({ id: z.string(), file: z.string() /* <id>.<hash8>.<ext>, servi à /illustrations/<file> */ });
export const CatalogBundle = z.object({ version: z.string(), exercises: z.array(z.unknown()), illustrations: z.array(IllustrationRef),
  programTemplates: z.array(z.unknown()), adviceSheets: z.array(z.unknown()) });
// apps/server/src/sync/hooks.ts [T20]
export interface HookCtx { trx: Transaction<Database>; deps: AppDeps; userId: string; op: SyncOp }
export interface EntitySyncHooks { allowedKinds?: readonly SyncOp['kind'][]; parent?: { entity: string; column: string /* snake */ };
  afterApply?(ctx: HookCtx): Promise<void> }
export type SyncHooksMap = Readonly<Record<string, EntitySyncHooks>>;
export const SYNC_HOOKS: SyncHooksMap; // { sync_rejection: { allowedKinds: ['patch'] } }
// apps/server/src/sync/push.ts / pull.ts / epoch.ts [T20/T21/T22]
export async function applyPush(deps: AppDeps, user: SessionUser, ops: SyncOp[]): Promise<PushResult[]>;
export async function buildPull(deps: AppDeps, user: SessionUser, since: string | null, limit: number): Promise<PullResponse>; // throw httpError('watermark_expired')
export async function rotateServerEpoch(db: DbExecutor, ids: IdGen): Promise<{ epoch: string; baseRev: number }>; // baseRev = sync_counter
// apps/server/src/sync/purge.ts [T22] export const syncPurgeJob: DailyJob; // tombstones > 90 j (sauf gym et place) → tombstone_purge_rev ; applied_op > 12 mois
// apps/server/src/catalog/loader.ts [T23] export async function loadCatalog(deps: AppDeps): Promise<CatalogBundle>; export const CATALOG_STARTUP_TASK: StartupTask;
// apps/server/src/privacy/reapply.ts [T24]
export const PrivacyEventList = z.object({ since: z.string(), collectedAt: z.string(), source: z.string(),
  events: z.array(z.object({ type: z.enum(['account_deleted','consent_revoked']), at: z.string(), targetId: z.string(), consentType: z.enum(['health','ai_coach']).optional() })) });
export async function collectPrivacyEvents(db: DbExecutor, since: string): Promise<PrivacyEventList['events']>;
export async function reapplyPrivacyEvents(deps: AppDeps, list: PrivacyEventList): Promise<{ accountsDeleted: number; consentsWithdrawn: number }>;
// apps/server/test/support/sync-fixtures.ts [T20]
export const SYNC_FIXTURE_MIGRATION: Migration;   // tables J : fixture_note (+SYNC, title, body), fixture_note_item (+SYNC, note_id, label, pain_note C2), fixture_c2_log (+SYNC, value)
export const SYNC_FIXTURE_RULES: EntityRulesMap;  // entityRules + ces 3 tables (fixture_c2_log : C2 ; fixture_note_item.pain_note dans c2Columns)
export const SYNC_FIXTURE_HOOKS: SyncHooksMap;    // fixture_note_item.parent = { entity: 'fixture_note', column: 'note_id' }
export async function createSyncTestContext(): Promise<TestContext>;
```
Routes :
- `POST /api/sync/push` (PushRequest → PushResponse) ;
- `GET /api/sync/pull?since=&limit=` (PullResponse) ;
- `GET /api/catalog` (CatalogBundle, `ETag: "<version>"`, 304 sur `If-None-Match`).

Toutes les routes `/api/sync/*` exigent `X-Appsport-Protocol` ∈ [MIN_PROTOCOL, SYNC_PROTOCOL], sinon 426.

Côté client, dans `apps/web/src/local-db` et `sync` :
```ts
// local-db/db.ts [T25]
export const LOCAL_DB_NAME = 'appsport'; export const LOCAL_DB_VERSION = 1;
export type OutboxOp = SyncOp; export interface DeadletterEntry { opId: string; userId: string; entity: string; id: string; code: string; detail: unknown; receivedAt: string }
export type MirrorRow = Record<string, unknown> & { id: string; serverRevSeen: number | null; deletedAt: string | null };
export const STORE_SCHEMAS: Record<string, string>; // meta:'key' ; outbox:'opId, userId, [entity+id]' ; deadletter:'opId, userId' ;
//  user:'id' ; training_profile:'id' ; health_screening:'id' ; limitation:'id' ; consent_event:'id, [type+createdAt]' ; gym:'id, nameKey' ;
//  gym_equipment:'id, gymId' ; place:'id, gymId' ; home_equipment:'id, placeId' ; sync_rejection:'id, dismissedAt' ;
//  exercises:'id' ; illustrations:'id' ; programTemplates:'id' ; adviceSheets:'id'
export class AppDb extends Dexie { meta: Table<{ key: string; value: unknown }, string>; outbox: Table<OutboxOp, string>; deadletter: Table<DeadletterEntry, string>; mirror(entity: string): Table<MirrorRow, string> }
export function createAppDb(name?: string, opts?: { extraMirrors?: Record<string, string> }): AppDb;
// local-db/meta.ts [T25]
export interface MetaValues { deviceId: string; userId: string; watermark: string; serverEpoch: string; protocol: number; catalogVersion: string;
  serverCatalogVersion: string; activeSessionId: string | null; lastPullOkAt: string; persistGranted: boolean; me: MeResponse }
export async function getMeta<K extends keyof MetaValues>(db: AppDb, k: K): Promise<MetaValues[K] | undefined>;
export async function setMeta<K extends keyof MetaValues>(db: AppDb, k: K, v: MetaValues[K]): Promise<void>;
// local-db/wipe.ts [T25] export async function wipeUserData(db: AppDb, opts: { keepOutbox: boolean }): Promise<void>; // miroirs + meta utilisateur (+ outbox et deadletter si !keepOutbox)
// sync/outbox.ts [T25]
export interface LocalChange { entity: string; id: string; kind: 'create' | 'patch' | 'delete'; fields: Record<string, unknown> }
export async function writeLocal(db: AppDb, change: LocalChange, ctx: { userId: string; now: () => string; newOpId: () => string; healthConsentActive: boolean; rules?: EntityRulesMap }): Promise<OutboxOp>;
export async function pendingCount(db: AppDb, userId: string): Promise<number>;
// sync/transport.ts [T26]
export interface SyncTransport { fetch(path: string, init: RequestInit): Promise<Response> }
export function browserTransport(baseUrl?: string): SyncTransport;
export async function fetchWithTimeout(t: SyncTransport, path: string, init: RequestInit, timeoutMs?: number /* 4000 */): Promise<Response>; // throw OfflineError
export class OfflineError extends Error {}
// sync/engine.ts [T26]
export type ConnectionState = 'unknown'|'online'|'offline'|'unauthenticated'|'protocol_unsupported'|'account_deleted';
export type SyncTrigger = 'launch'|'foreground'|'online'|'set_logged'|'interval'|'coach'|'mutation'|'manual';
export interface SyncState { connection: ConnectionState; pending: number; rejected: number; lastPullOkAt: string | null; syncing: boolean; serverEpoch: string | null }
export interface SyncEngine { syncNow(t: SyncTrigger): Promise<void>; pullNow(): Promise<void>; flushBefore(ms: number): Promise<void>;
  getState(): SyncState; subscribe(fn: (s: SyncState) => void): () => void; start(): void; stop(): void }
export function createSyncEngine(deps: { db: AppDb; transport: SyncTransport; now?: () => number; newOpId?: () => string;
  onAccountDeleted?: () => void; timeoutMs?: number; rules?: EntityRulesMap }): SyncEngine;
// sync/apply-pull.ts [T26] export async function applyPulledRows(db: AppDb, rows: PulledRow[]): Promise<void>;
// sync/catalog.ts [T26] export async function refreshCatalog(db: AppDb, t: SyncTransport): Promise<'unchanged' | 'updated'>; // envoie ensuite SYNC_ILLUSTRATIONS si un SW contrôle la page
// test/support [T25/T27] : createTestLocalDb(name?) ; inProcessTransport(ctx: TestContext, getCookie: () => string) ;
//  lossyTransport(inner, { seed: number; dropRate: number; dupRate: number; maxDelayMs: number; reorder: boolean })
```
Comportements fixés côté client :
- **401** : pause, outbox conservée.
- **410 `account_deleted`** : `wipeUserData({ keepOutbox: false })` puis `onAccountDeleted`.
- **410 `watermark_expired`** : vidage des miroirs sans toucher à l'outbox, puis pull complet.
- **426** : `connection = 'protocol_unsupported'`, saisie maintenue, outbox conservée.
- **Nouvel en-tête `X-Appsport-Epoch`** : pause, `restore_upsert` des lignes J (sauf `sync_rejection`) dont `updatedAt` local date de moins de 60 j, reprise, puis pull complet.
- **Après chaque mutation E** : `pullNow()`.

### 7. Web [web]
```ts
// app-services.tsx [T28]
export interface AppServices { db: AppDb; api: ApiClient; sync: SyncEngine }
export function ServicesProvider(p: { services: AppServices; children: ReactNode }): JSX.Element; export function useServices(): AppServices;
export function useSyncState(): SyncState; export function useMe(): MeResponse | null;
// api/client.ts [T28]
export class ApiError extends Error { status: number; code: ApiErrorCode; body: Record<string, unknown> }
export class NetworkRequiredError extends Error {}   // message « Nécessite le réseau »
export interface ApiClient { get<T>(path: string, schema: z.ZodType<T>): Promise<T>; send<T>(method: 'POST'|'PUT'|'PATCH'|'DELETE', path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> }
export function createApiClient(t: SyncTransport, hooks: { onUnauthenticated(): void; onAccountDeleted(): void }): ApiClient; // délai 4 s → NetworkRequiredError
// repos [T29] : un objet par fichier, créé par createRepos(services)
export interface Repos { me: MeRepo; profile: ProfileRepo; places: PlacesRepo; gyms: GymsRepo; consent: ConsentRepo; admin: AdminRepo; rejections: RejectionsRepo }
export function createRepos(s: AppServices): Repos; export function useRepos(): Repos;
// sw/protocol.ts [T34] — implémenté côté SW par pwa T36
export type PageToSw = { type: 'SKIP_WAITING' } | { type: 'GET_STATUS' } | { type: 'SYNC_ILLUSTRATIONS'; files: string[] };
export interface SwStatus { type: 'STATUS'; buildHash: string; shellCached: boolean; illustrationsMissing: number }
// sw/sw-client.ts [T34] export async function getSwStatus(timeoutMs?: number): Promise<SwStatus | null>; // null si aucun SW actif ; réponse par MessageChannel
// features/status/readiness.ts [T34]
export interface Readiness { ready: boolean; checks: { shell: boolean; catalog: boolean; illustrations: boolean; recentPull: boolean } }
export function computeReadiness(i: { sw: SwStatus | null; catalogVersion: string | null; serverCatalogVersion: string | null; lastPullOkAt: string | null; now: number }): Readiness;
```
Routes wouter et `data-testid` stables, utilisés par les E2E de pwa et d'exploitation :
- **Publiques** : `/login`, `/invite`, `/reset`, `/privacy`, `/credits`, `/help`.
- **Connecté** : `/`, `/onboarding`, `/profile`, `/profile/places`, `/profile/places/:id`, `/profile/health`, `/profile/privacy`, `/gyms/:id`, `/settings`, `/rejections`.
- **Admin** : `/admin/members`, `/admin/invitations`, `/admin/gyms`, `/admin/health`.
- **Testids** :
  - `offline-ready` avec `data-state="ready|not-ready"` ;
  - `pending-counter` avec `data-count` ;
  - `rejected-counter` avec `data-count` ;
  - `connection-status` avec `data-state=<ConnectionState>` ;
  - `update-banner`, créé par pwa T37, avec `data-dismissible="true|false"` ;
  - `onboarding-step` avec `data-step=<OnboardingStep>`.
- **Libellés exacts des boutons** : « Suivant », « Commencer », « Réessayer », « Créer mon compte », « Se connecter », « Mettre à jour », « Continuer dans ce navigateur ».

### 8. PWA [pwa]
```ts
// vite-plugin-precache.ts [T35]
export function precachePlugin(opts?: { swEntry?: string /* 'src/sw/sw.ts' */ }): Plugin;
// produit dist/sw.js, qui commence par self.__APPSPORT_PRECACHE__ = { buildHash, files } ; buildHash = 12 hex de sha256(chemins + contenus triés)
// apps/server/src/static.ts [T35]
export function mountWebApp(app: Hono<AppEnv>, deps: AppDeps): void; // publicDir ; /illustrations/* depuis contentDir/illustrations/files ; repli SPA → index.html
export const SHELL_CACHE_PREFIX = 'shell-'; export const ILLUSTRATIONS_CACHE = 'illustrations-v1'; // (dans sw/sw.ts [T36])
// sw/register.ts [T37]
export interface UpdateState { available: boolean; forced: boolean }
export interface SwController { getState(): UpdateState; subscribe(fn: (s: UpdateState) => void): () => void; checkForUpdate(): Promise<void>; applyUpdate(): Promise<void>; markForced(): void }
export function registerServiceWorker(opts: { db: AppDb; sync: SyncEngine; intervalMs?: number /* 3600000 */ }): SwController;
export function shouldShowUpdateBanner(i: { available: boolean; forced: boolean; activeSessionId: string | null; onboardingInProgress: boolean }): { show: boolean; dismissible: boolean };
// sw/kill-switch.ts [T37] export async function applyKillSwitchIfNeeded(health: HealthResponse): Promise<boolean>;
// sw/persist.ts [T37] export async function requestPersistentStorage(db: AppDb): Promise<boolean>; // écrit meta.persistGranted
// e2e/support/server.ts [T38]
export interface E2EServer { url: string; dataDir: string; publicDir: string; stop(): Promise<void>; restart(env?: Record<string, string>): Promise<void>;
  cli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> }
export async function startE2EServer(opts?: { env?: Record<string, string>; publicDir?: string; port?: number }): Promise<E2EServer>;
// tsx apps/server/src/main.ts ; dataDir temporaire sous .e2e-data/ avec sentinelle ; init exécuté ; APP_ORIGIN = http://localhost:<port>
export async function bootstrapAdminInvitation(s: E2EServer, birthDate?: string): Promise<{ code: string; link: string }>; // analyse « Code : »
```

### 9. Exploitation [exploitation]
```ts
// apps/server/src/ops/snapshot.ts [T40]
export async function takeSnapshot(deps: { sqlite: DatabaseSync; dataDir: string; clock: Clock }, tag: string): Promise<string>; // 'daily' → daily-AAAAMMJJ.db (date de Paris) ; 'pre-vX.Y.Z' → pre-vX.Y.Z.db
export async function pruneSnapshots(dataDir: string, keep?: number /* 3 */): Promise<string[]>; // par préfixe daily- / pre-
// apps/server/src/ops/restore.ts [T40]
export async function restoreSnapshot(o: { dataDir: string; snapshotPath: string; ids: IdGen }): Promise<{ epoch: string; baseRev: number }>;
// integrity_check → copie vers appsport.db.restoring → suppression de -wal/-shm → renommage → rotateServerEpoch
```
Interface des scripts hôte (`infra/host`, bash avec `set -euo pipefail`, `source lib/common.sh`). Variables surchargeables pour les tests bats :
- `APPSPORT_ROOT=/srv/appsport`, `APPSPORT_REPO=/opt/appsport`, `BACKUP_ROOT=/srv/backup` ;
- `HC_ENV=/etc/appsport/healthchecks.env`, qui contient `HC_ALIVE_URL`, `HC_BACKUP_URL`, `HC_RESTORE_TEST_URL` et `HC_HOST_URL` ;
- `DOCKER=docker`, `CURL=curl`, `RESTIC=restic`, `CRYPTSETUP=cryptsetup`, `HEALTH_URL=http://127.0.0.1:3000/api/health`.

Fichiers manipulés :
- `$APPSPORT_ROOT/deploy.env` (`APPSPORT_VERSION=vX.Y.Z`) ;
- `$APPSPORT_ROOT/deploy.log` (une ligne par déploiement : `date ancienne nouvelle résultat`) ;
- `$APPSPORT_ROOT/data/ops/status.json` (OpsStatus, fusion par `jq`) ;
- `$APPSPORT_ROOT/secrets/{app.env,b2.env,restic.pass,docker/config.json,deploy_key}`.

Commande CLI dans le conteneur : `docker compose exec -T app node /app/server.mjs <cmd>` quand le service tourne, `docker compose run --rm --no-deps app node /app/server.mjs <cmd>` quand il est arrêté.