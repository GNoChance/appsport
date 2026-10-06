## Interfaces partagées (version définitive)

Noms et signatures contractuels. Une tâche qui consomme un nom l'importe tel quel ; la tâche propriétaire le crée avec exactement cette signature. Chaque fichier porte sa partie et sa tâche propriétaires `[partie Tn]` ; « mod. Tn » signale une tâche ultérieure qui le complète. Les noms utilisés par une seule tâche restent dans le bloc **Interfaces** de cette tâche.

### 0. Conventions
- Schéma Zod et type sous le même nom : `export const X = z.object(...); export type X = z.infer<typeof X>;`. Exception : quand le type vient d'un tableau `as const` (ou existe déjà dans `constants.ts`), le schéma s'appelle `XSchema` (`RoleSchema`, `UserStatusSchema`, `AgeBandSchema`, `EquipmentCodeSchema`, `SportCodeSchema`).
- Pas de réexportation croisée : un nom est exporté par un seul module ; `index.ts` de chaque paquet fait `export *` de chaque module.
- Clés JSON (réseau, Dexie, export) en camelCase ; `entityRules` et SQL en snake_case ; conversion par `case.ts`. Booléens SQL 0/1 convertis en `boolean` à la frontière API et pull (`COLUMN_CODECS`), sauf l'export (valeurs telles que stockées).
- `apps/server` exporte `"."` → `./src/main.ts` et `"./testing"` → `./test/support/index.ts`. Les tests web n'importent du serveur que `@appsport/server/testing` (qui réexporte `createLogger` et `grantConsent`, ajout de T27).
- Mot de passe de test commun : `'cheval agrafe batterie correcte'` (`createUser` par défaut, `E2E_PASSWORD`).

### 1. Fondations — contracts et domain
```ts
// packages/contracts/src/constants.ts [fondations T2]
export const MIN_AGE = 16; export const ADULT_AGE = 18; export const PARIS_TZ = 'Europe/Paris';
export const PRIVACY_POLICY_VERSION = '1.0';
export const SYNC_PROTOCOL = 1; export const MIN_PROTOCOL = 1;
export const PROTOCOL_HEADER = 'X-Appsport-Protocol'; export const EPOCH_HEADER = 'X-Appsport-Epoch';
export type Role = 'admin' | 'member'; export type UserStatus = 'active' | 'disabled'; export type AgeBand = 'minor' | 'adult';

// packages/contracts/src/case.ts [T5]
export function snakeToCamel(key: string): string; export function camelToSnake(key: string): string;
export function rowToCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T;

// packages/contracts/src/entity-rules.ts [T5]
export type DataCategory = 'C0' | 'C1' | 'C2' | 'C3'; export type SyncClass = 'J' | 'D' | 'E' | 'C' | 'H';
export type OnUserDelete = 'cascade' | 'set_null' | 'anonymize' | 'keep' | 'not_linked';
export interface EntityRule { category: DataCategory; syncClass: SyncClass; ownerColumn: 'owner_id' | 'user_id' | 'id' | null;
  columns: readonly string[]; clientWritable: readonly string[]; c2Columns: readonly string[]; secretColumns: readonly string[];
  exported: boolean; onUserDelete: OnUserDelete }
export type EntityRulesMap = Readonly<Record<string, EntityRule>>;
export const SYNC_COLUMNS: readonly ['owner_id','rev','created_at','updated_at','updated_by','deleted_at'];
export const entityRules: EntityRulesMap;
export function mirroredTables(rules?: EntityRulesMap): string[];   // syncClass J|D|E, tri alphabétique
```
Valeurs des 18 tables (category / syncClass / ownerColumn / exported / onUserDelete ; secrets ; clientWritable) :
`server_meta` C0/H/null/false/not_linked ; `schema_migrations` C0/H/null/false/not_linked ; `applied_op` C0/H/user_id/false/cascade ; `sync_rejection` C1/J/owner_id/true/cascade, clientWritable `['dismissed_at']` ; `user` C0/E/id/true/cascade, secret `['password_hash']` ; `invitation` C0/H/null/false/set_null, secret `['code_hash']` ; `password_reset` C0/H/user_id/false/cascade, secret `['code_hash']` ; `session` C1/H/user_id/false/anonymize, secret `['token_hash']` ; `consent_event` C1/E/owner_id/true/cascade ; `security_event` C0/H/null/false/keep ; `training_profile` C1/E/owner_id/true/cascade ; `health_screening` C2/E/owner_id/true/cascade ; `limitation` C2/E/owner_id/true/cascade ; `gym` C0/E/null/false/set_null ; `gym_equipment` C0/E/null/false/set_null ; `gym_history` C0/H/null/false/set_null ; `place` C1/E/owner_id/true/cascade ; `home_equipment` C1/E/owner_id/true/cascade. Toutes les autres listes sont `[]`.

```ts
// packages/contracts/src/api/errors.ts [T6]
export const ApiErrorCode = z.enum(['validation','unauthenticated','invalid_credentials','forbidden','origin_mismatch',
 'unsupported_media_type','account_disabled','password_change_required','health_consent_required','reset_self_forbidden',
 'not_found','conflict','username_taken','last_admin','gym_duplicate','gym_in_use','place_exists','last_place',
 'primary_required','onboarding_incomplete','password_rejected','username_invalid','under_min_age',
 'invitation_expired','invitation_used','invitation_revoked','invitation_unknown','reset_invalid',
 'account_deleted','watermark_expired','protocol_unsupported','rate_limited','internal']);   // 33 codes
export const ERROR_STATUS: Record<ApiErrorCode, number>;
// 400 validation, password_rejected, username_invalid, under_min_age, invitation_*, reset_invalid ; 401 unauthenticated, invalid_credentials ;
// 403 forbidden, origin_mismatch, account_disabled, password_change_required, health_consent_required, reset_self_forbidden ; 404 not_found ;
// 409 conflict, username_taken, last_admin, gym_duplicate, gym_in_use, place_exists, last_place, primary_required, onboarding_incomplete ;
// 410 account_deleted, watermark_expired ; 415 unsupported_media_type ; 426 protocol_unsupported ; 429 rate_limited ; 500 internal
export const ApiErrorBody = z.object({ error: ApiErrorCode }).passthrough();
// packages/contracts/src/api/health.ts [T6]
export const HealthResponse = z.object({ status: z.enum(['ok','error']), version: z.string(), db: z.enum(['ok','error']),
  protocol: z.number().int(), minProtocol: z.number().int(), epoch: z.string().nullable(), swKill: z.boolean() });

// packages/domain/src/ids.ts [T2]
export function createUuidV7(unixMs: number, random: Uint8Array /* ≥ 10 octets */): string;
export function createMonotonicUuidV7(now: () => number, random: (n: number) => Uint8Array): () => string; // strictement croissant même si l'horloge recule
export function isUuidV7(s: string): boolean;
// packages/domain/src/age.ts [T2]
export function parisDate(instant: Date): string;                  // 'YYYY-MM-DD' à Europe/Paris
export function ageOn(birthDate: string, today: string): number;   // années révolues ; 29/02 → 01/03 les années non bissextiles
export function ageBandOn(birthDate: string, today: string): AgeBand;
// packages/domain/src/cautious.ts [T2]
export function computeCautious(i: { ageBand: AgeBand; cautiousMode: boolean; healthConsentActive: boolean; caution: boolean | null }): boolean;
```

### 2. Fondations — serveur
```ts
// apps/server/src/deps.ts [T4a ; mod. T6, T20]
export interface Clock { now(): Date }
export interface IdGen { uuidv7(): string; randomBytes(n: number): Uint8Array }
export const systemClock: Clock; export function cryptoIds(): IdGen;                                   // T4a
export interface Argon2Params { memoryKiB: number; passes: number; parallelism: number; tagLength: number; saltLength: number } // T6
export const ARGON2_PARAMS: Argon2Params;   // { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 } (T6)
export interface AppDeps { db: Kysely<Database>; sqlite: DatabaseSync; clock: Clock; ids: IdGen; config: AppConfig; logger: Logger;
  entityRules: EntityRulesMap; syncHooks: SyncHooksMap /* T20 */ }
export function createAppDeps(o: { sqlite: DatabaseSync; db: Kysely<Database>; config: AppConfig; clock?: Clock; ids?: IdGen;
  logger?: Logger; entityRules?: EntityRulesMap; syncHooks?: SyncHooksMap /* T20, défaut SYNC_HOOKS */ }): AppDeps;   // T6
// apps/server/src/config.ts [T6]
export interface AppConfig { appOrigin: string; version: string; port: number; host: string; dataDir: string; dbPath: string;
  sentinelPath: string; publicDir: string; contentDir: string; swKillSwitch: boolean; coachModel: string;
  anthropicApiKey: string | null; argon2: Argon2Params; sessionCookieName: '__Host-session' | 'dev-session'; secureCookie: boolean }
export class ConfigError extends Error {}
export function loadConfig(env: Record<string, string | undefined>): AppConfig; // dbPath = dataDir/appsport.db ; sentinelPath = dataDir/.appsport-volume
// apps/server/src/app-env.ts [T6]
export interface SessionUser { id: string; username: string; role: Role; birthDate: string; mustChangePassword: boolean }
export type AppEnv = { Variables: { requestId: string; clientIp: string | null; user: SessionUser | null; sessionId: string | null } };
// apps/server/src/app.ts [T6 ; mod. T9]
export function createApp(deps: AppDeps): Hono<AppEnv>; // requestId → requestLog → securityHeaders → epochHeader (/api) → originGuard → sessionMiddleware (T9) → mountRoutes → onError
// apps/server/src/routes.ts [T6 ; une ligne par routeur : T10, T11, T12, T16, T17, T18, T19, T20, T23 ; mountWebApp en dernier (T35)]
export function mountRoutes(app: Hono<AppEnv>, deps: AppDeps): void;
// apps/server/src/http/*.ts [T6]
export class HttpError extends Error { readonly status: number; readonly code: ApiErrorCode; readonly extra?: Record<string, unknown>;
  constructor(status: number, code: ApiErrorCode, extra?: Record<string, unknown>) }
export function httpError(code: ApiErrorCode, extra?: Record<string, unknown>): HttpError;   // statut pris dans ERROR_STATUS
export function errorHandler(logger: Logger): ErrorHandler<AppEnv>;
export async function parseJson<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T>;   // 400 { error: 'validation', issues }
export function parseQuery<T>(c: Context<AppEnv>, schema: z.ZodType<T>): T;
export function clientIp(c: Context<AppEnv>): string | null;   // X-Forwarded-For seulement si le pair TCP est loopback ou absent
export const SECURITY_HEADERS: Readonly<Record<string, string>>; export function securityHeaders(): MiddlewareHandler<AppEnv>; // mod. T35 : ne remplace pas une CSP déjà posée
export function originGuard(config: AppConfig): MiddlewareHandler<AppEnv>;
export function requestLog(logger: Logger): MiddlewareHandler<AppEnv>;
export function epochHeader(db: Kysely<Database>): MiddlewareHandler<AppEnv>;
// apps/server/src/health/routes.ts [T6]
export function healthRoutes(deps: AppDeps): Hono<AppEnv>;   // GET /api/health → HealthResponse
// apps/server/src/logger.ts [T6]
export type LogFields = Partial<{ requestId: string; method: string; route: string; status: number; durationMs: number;
  event: string; code: string; count: number; migration: string; job: string }>;
export interface Logger { info(msg: string, f?: LogFields): void; warn(msg: string, f?: LogFields): void; error(msg: string, f?: LogFields): void }
export function createLogger(write?: (line: string) => void): Logger;   // une ligne JSON ; champs hors liste blanche ignorés
// apps/server/src/db/open.ts, sqlite-dialect.ts [T3]
export function openDatabase(path: string): { sqlite: DatabaseSync; db: Kysely<Database> };   // ':memory:' accepté ; pragmas ; CamelCasePlugin
export class NodeSqliteDialect implements Dialect { constructor(cfg: { database: DatabaseSync }) }   // 1 connexion + mutex ; savepoints
// apps/server/src/db/schema.ts [T3 squelette ; T4b ; mod. T5]
export interface Database { serverMeta: ServerMetaTable; schemaMigrations: SchemaMigrationsTable; appliedOp: AppliedOpTable;
  syncRejection: SyncRejectionTable; user: UserTable; invitation: InvitationTable; passwordReset: PasswordResetTable;
  session: SessionTable; consentEvent: ConsentEventTable; securityEvent: SecurityEventTable; trainingProfile: TrainingProfileTable;
  healthScreening: HealthScreeningTable; limitation: LimitationTable; gym: GymTable; gymEquipment: GymEquipmentTable;
  gymHistory: GymHistoryTable; place: PlaceTable; homeEquipment: HomeEquipmentTable }
export type DbExecutor = Kysely<Database> | Transaction<Database>;
export function tableKey(sqlTable: string): keyof Database;   // 'training_profile' → 'trainingProfile'
// apps/server/src/db/migrations/index.ts, migrate.ts [T4a]
export interface Migration { id: string; breaking: boolean; up(db: Kysely<any>): Promise<void> }
export const MIGRATIONS: readonly Migration[];   // [{ id: '0001_socle', breaking: false, up }]
export class MigrationError extends Error { code: 'migration_failed' | 'unknown_breaking_migration' }
export async function migrate(db: Kysely<any>, migrations: readonly Migration[], clock: Clock): Promise<{ applied: string[]; unknownNonBreaking: string[] }>;
// apps/server/src/db/server-meta.ts, rev.ts [T4a]
export interface ServerMeta { serverEpoch: string; epochBaseRev: number; syncCounter: number; tombstonePurgeRev: number;
  catalogVersion: string | null; catalogUpdatedAt: string | null }
export async function getServerMeta(db: DbExecutor): Promise<ServerMeta>;
export async function initServerMeta(db: DbExecutor, ids: IdGen): Promise<ServerMeta>;   // époque uuidv7, compteurs à 0
export async function nextRev(trx: DbExecutor): Promise<number>;   // UPDATE server_meta SET sync_counter = sync_counter + 1 RETURNING
export async function writeStamp(trx: DbExecutor, deps: { clock: Clock }, actorId: string | null): Promise<{ rev: number; updatedAt: string; updatedBy: string | null }>;
// apps/server/src/startup-guard.ts, startup.ts, jobs/* [T7]
export class StartupError extends Error { readonly code: 'no_sentinel' | 'no_database' }
export function assertStartupPreconditions(cfg: AppConfig, fs?: { existsSync(p: string): boolean }): void;
export interface StartupTask { name: string; run(deps: AppDeps): Promise<void> }
export const STARTUP_TASKS: StartupTask[];      // [] ; mod. T23 : CATALOG_STARTUP_TASK
export interface DailyJob { name: string; run(deps: AppDeps): Promise<void> }
export function startDailyJobs(deps: AppDeps, jobs: DailyJob[]): { stop(): void };   // un passage au démarrage puis toutes les 24 h
export const DAILY_JOBS: DailyJob[];             // [] ; mod. T13 authPurgeJob, T22 syncPurgeJob
// apps/server/src/main.ts [T7]
export interface RunningServer { port: number; deps: AppDeps; close(): Promise<void> }
export async function startServer(env: Record<string, string | undefined>, opts?: { startupTasks?: StartupTask[]; dailyJobs?: DailyJob[] }): Promise<RunningServer>;
export async function main(argv: string[]): Promise<number>;   // sans argument → serveur ; sinon runCli
// apps/server/src/cli.ts [T7 ; mod. T11, T12, T24, T40, T43, T44]
export interface CliContext { env: Record<string, string | undefined>; out(line: string): void; err(line: string): void }
export interface CliCommand { usage: string; run(args: string[], ctx: CliContext): Promise<number> }
export const COMMANDS: Record<string, CliCommand>;
export function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> };
export async function withAppDeps<T>(ctx: CliContext, fn: (deps: AppDeps) => Promise<T>): Promise<T>;   // garde + migrate, puis ferme la base
export async function runCli(argv: string[], env: Record<string, string | undefined>, out?: (line: string) => void, err?: (line: string) => void): Promise<number>;
```
Commandes CLI (code 0 = OK, 1 = erreur avec message français sur stderr) : `init` et `db:check` [T7] ; `admin:bootstrap --birth-date AAAA-MM-JJ` [T11] ; `admin:reset <pseudo>` [T12] ; `privacy:collect --since <ISO> [--source <fichier.db>] --out <fichier.json>` et `privacy:reapply <fichier.json>` [T24] ; `snapshot --tag daily|pre-vX.Y.Z` et `restore <fichier.db>` [T40] ; `sessions:active [--hours N]` [T43] ; `db:stats` [T44].

Support de test serveur (`apps/server/test/support`, exporté par `@appsport/server/testing`) :
```ts
// clock.ts, ids.ts [T4a]
export class FakeClock implements Clock { constructor(iso?: string /* '2026-10-06T10:00:00.000Z' */); now(): Date; set(iso: string): void; advance(ms: number): void }
export function seqIds(seed?: number): IdGen;   // UUIDv7 monotones déterministes
// factories.ts [T5]
export async function insertFixtureRow(db: Kysely<Database>, table: string, values?: Record<string, unknown> /* camelCase */): Promise<Record<string, unknown>>;
// context.ts [T6]
export const TEST_ARGON2: Argon2Params;   // { memoryKiB: 1024, passes: 1, parallelism: 1, tagLength: 32, saltLength: 16 }
export interface TestRequestInit { method?: string; json?: unknown; cookie?: string; origin?: string | null; ip?: string; headers?: Record<string, string> }
export interface TestContext { app: Hono<AppEnv>; deps: AppDeps; clock: FakeClock; request(path: string, init?: TestRequestInit): Promise<Response>; close(): void }
export async function createTestContext(opts?: { now?: string; config?: Partial<AppConfig>; extraMigrations?: Migration[];
  entityRules?: EntityRulesMap; deps?: Partial<AppDeps>; dbPath?: string /* fichier au lieu de ':memory:' ; initServerMeta si server_meta vide */ }): Promise<TestContext>;
// APP_ORIGIN 'https://appsport.test.ts.net' ; migré ; server_meta initialisé
// users.ts [comptes T10]
export async function createUser(ctx: TestContext, o?: { username?: string; password?: string; role?: Role; birthDate?: string; status?: UserStatus; onboarded?: boolean }): Promise<{ id: string; username: string; password: string }>;
// défauts : username user<N>, password 'cheval agrafe batterie correcte', birthDate '1990-01-01', role member, onboarded false
export async function login(ctx: TestContext, username: string, password: string): Promise<string /* en-tête Cookie */>;
export async function createUserAndLogin(ctx: TestContext, o?: Parameters<typeof createUser>[1]): Promise<{ id: string; username: string; password: string; cookie: string }>;
// onboarding.ts [profil T16]
export async function completeOnboarding(ctx: TestContext, user: { id: string; cookie: string }): Promise<{ placeId: string }>;
// sync-fixtures.ts [synchro T20 ; mod. T21, T24]
export const SYNC_FIXTURE_MIGRATION: Migration;   // '9001_sync_fixtures' : fixture_note (+SYNC, title, body), fixture_note_item (+SYNC, note_id, label, pain_note), fixture_c2_log (+SYNC, value)
export const SYNC_FIXTURE_RULES: EntityRulesMap;  // entityRules + ces 3 tables J (fixture_c2_log C2 ; fixture_note_item.pain_note dans c2Columns)
export const SYNC_FIXTURE_HOOKS: SyncHooksMap;    // SYNC_HOOKS + fixture_note_item.parent = { entity: 'fixture_note', column: 'note_id' }
export async function createSyncTestContext(opts?: Parameters<typeof createTestContext>[0]): Promise<TestContext>;
export const PROTOCOL_HEADERS: Record<string, string>;   // { 'X-Appsport-Protocol': String(SYNC_PROTOCOL) }
export function makeOp(o: { userId: string; entity: string; id: string; kind: SyncOp['kind']; fields?: Record<string, unknown>;
  opId?: string; serverRevSeen?: number | null; protocol?: number }): SyncOp;
export async function syncPush(ctx: TestContext, cookie: string, ops: unknown[]): Promise<{ status: number; body: any }>;
export async function syncPull(ctx: TestContext, cookie: string, q?: { since?: string; limit?: number }): Promise<{ status: number; body: any; headers: Headers }>; // T21
export function dumpDatabase(sqlite: DatabaseSync): string;   // JSON de toutes les lignes de toutes les tables (valeurs témoins)
export async function snapshotDb(ctx: TestContext, path: string): Promise<void>;                                     // T24
export async function restoreInPlace(ctx: TestContext, snapshotPath: string): Promise<{ epoch: string; baseRev: number }>; // T24
```

### 3. Comptes
```ts
// packages/contracts/src/auth-constants.ts [comptes T8]
export const INVITATION_TTL_DAYS = 7; export const BOOTSTRAP_INVITATION_TTL_HOURS = 24; export const RESET_TTL_HOURS = 24;
export const SECRET_CODE_LENGTH = 16; export const INVITATION_NOTE_MAX = 60;
export const USERNAME_MIN = 3; export const USERNAME_MAX = 24; export const RESERVED_USERNAMES = ['admin','appsport','systeme'] as const;
export const PASSWORD_MIN_MEMBER = 12; export const PASSWORD_MIN_ADMIN = 14; export const PASSWORD_MAX = 128;
export const SESSION_IDLE_DAYS = 90; export const SESSION_MAX_DAYS = 365; export const ADMIN_PASSWORD_REMINDER_MONTHS = 12;
export const LOGIN_LIMITS = { consecutiveThreshold: 5, firstDelayMs: 60_000, maxDelayMs: 900_000, hourlyMaxFailures: 10,
  lockMs: 3_600_000, windowMs: 3_600_000, ipMaxFailuresPerHour: 30 } as const;
export const CODE_CHECKS_PER_HOUR = 20; export const CLOSED_AUTH_RECORD_RETENTION_DAYS = 30;
export const SECURITY_EVENT_RETENTION_MONTHS = 12; export const SESSION_TOUCH_INTERVAL_MS = 3_600_000;
// packages/contracts/src/api/auth.ts [T8 ; mod. T10, T11, T12, T13]
export const CivilDate = z.iso.date();
export const RoleSchema = z.enum(['admin','member']); export const UserStatusSchema = z.enum(['active','disabled']); export const AgeBandSchema = z.enum(['minor','adult']);
export const ONBOARDING_STEPS = ['goal','sport','place_kind','place','experience','availability','health','ready'] as const;   // T10
export const OnboardingStep = z.enum(ONBOARDING_STEPS);
export const ConsentStatus = z.object({ active: z.boolean(), textVersion: z.string().nullable(), at: z.string().nullable() });
export const ConsentState = z.object({ health: ConsentStatus, ai_coach: ConsentStatus });
export const MeResponse = z.object({ id: z.string(), username: z.string(), role: RoleSchema, status: UserStatusSchema, birthDate: CivilDate,
  ageBand: AgeBandSchema, cautious: z.boolean(), mustChangePassword: z.boolean(), passwordReminderDue: z.boolean(),
  onboardingStep: OnboardingStep.nullable(), onboardingCompletedAt: z.string().nullable(), termsVersion: z.string().nullable(), consents: ConsentState });
export const LoginRequest = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(1024) });
export const ChangePasswordRequest = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(1).max(1024) });
export const UpdateMeRequest = z.object({ username: z.string().min(1).max(100) });
export const CodeRequest = z.object({ code: z.string().min(1).max(300) });                          // T11
export const InvitationCheckResponse = z.object({ birthDate: CivilDate });
export const AcceptInvitationRequest = z.object({ code: z.string().min(1).max(300), username: z.string().min(1).max(100), password: z.string().min(1).max(1024), termsVersion: z.string() });
export const ResetCheckResponse = z.object({ username: z.string() });                               // T12
export const ResetPasswordRequest = z.object({ code: z.string().min(1).max(300), newPassword: z.string().min(1).max(1024) });
export const DeleteAccountRequest = z.object({ password: z.string().min(1).max(1024) });            // T13
// packages/contracts/src/api/admin.ts [T11 ; mod. T12, T13]
export const InvitationState = z.enum(['pending','used','revoked','expired']);
export const InvitationSummary = z.object({ id: z.string(), note: z.string().nullable(), createdAt: z.string(), expiresAt: z.string(), state: InvitationState, usedByUsername: z.string().nullable() });
export const CreateInvitationRequest = z.object({ birthDate: CivilDate, note: z.string().max(INVITATION_NOTE_MAX).optional() });
export const CreateInvitationResponse = z.object({ invitation: InvitationSummary, code: z.string(), link: z.string() });
export const MemberSummary = z.object({ id: z.string(), username: z.string(), role: RoleSchema, status: UserStatusSchema, isMinor: z.boolean(),
  lastLoginAt: z.string().nullable(), onboardingCompleted: z.boolean(), consents: z.object({ health: z.boolean(), ai_coach: z.boolean() }), activeSessions: z.number().int() }).strict(); // T12
export const ResetLinkResponse = z.object({ code: z.string(), link: z.string(), expiresAt: z.string() });
export const SetStatusRequest = z.object({ status: UserStatusSchema });
export const SetRoleRequest = z.object({ role: RoleSchema, password: z.string().min(1).max(1024) });
export const SetBirthDateRequest = z.object({ birthDate: CivilDate });
export const OpsStatusResponse = z.object({ version: z.string(), opsStatus: OpsStatus.nullable() });
export const AdminDeleteMemberRequest = z.object({ confirmUsername: z.string().min(1).max(100) });   // T13
// packages/contracts/src/ops.ts [T12] — format de /data/ops/status.json, écrit par les scripts hôte
export const OpsCheck = z.object({ at: z.string(), ok: z.boolean(), detail: z.string().optional() });
export const OpsStatus = z.object({ backup: OpsCheck.optional(), restoreTest: OpsCheck.optional(),
  host: OpsCheck.extend({ disks: z.array(z.object({ mount: z.string(), usedPct: z.number() })), smartOk: z.boolean(), rebootRequired: z.boolean() }).optional(),
  deploy: z.object({ at: z.string(), version: z.string(), previousVersion: z.string().nullable(), ok: z.boolean() }).optional() });
// packages/contracts/src/api/export.ts [T13]
export const EXPORT_FORMAT = 'appsport-export/1';
export const ExportV1 = z.object({ format: z.literal(EXPORT_FORMAT), exportedAt: z.string(), account: z.record(z.string(), z.unknown()),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))), gyms: z.array(z.record(z.string(), z.unknown())), gymHistory: z.array(z.record(z.string(), z.unknown())) });

// packages/domain/src/auth/username.ts, password.ts, secret-code.ts [T8]
export function usernameKey(username: string): string;   // NFKC puis toLowerCase
export type UsernameCheck = { ok: true } | { ok: false; reason: 'length' | 'characters' | 'reserved' };
export function validateUsername(username: string): UsernameCheck;
export function passwordLength(pw: string): number;       // points de code après NFC
export type PasswordRejection = 'too_short' | 'too_long' | 'common' | 'contains_username' | 'contains_appsport' | 'single_char';
export function validatePassword(pw: string, ctx: { username: string; role: Role; commonPasswords: ReadonlySet<string> }): { ok: true } | { ok: false; reason: PasswordRejection };
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function encodeCrockford(bytes: Uint8Array): string;   // 10 octets → 16 caractères
export function parseSecretCode(input: string): string | null; // lien complet ou code ; casse, espaces, tirets ignorés ; I/L → 1, O → 0
export function formatSecretCode(canonical: string): string;   // 'XXXX-XXXX-XXXX-XXXX'

// apps/server/src/auth/password-hash.ts, secret.ts, common-passwords.ts [T8]
export async function hashPassword(pw: string, params: Argon2Params, ids: IdGen): Promise<string>;   // $argon2id$v=19$m=…,t=…,p=…$sel$hash
export async function verifyPassword(pw: string, phc: string): Promise<boolean>;
export function needsRehash(phc: string, params: Argon2Params): boolean;
export function createSecretCode(ids: IdGen): { canonical: string; formatted: string; hash: string };
export function hashSecret(value: string): string;   // sha256 hex (codes et jetons de session)
export const COMMON_PASSWORDS_RAW: string;   // common-passwords-list.ts : liste brute, en-tête « # Source: SecLists … » et licence MIT
export function parseCommonPasswords(raw: string): ReadonlySet<string>;
export const COMMON_PASSWORDS: ReadonlySet<string>;   // parseCommonPasswords(COMMON_PASSWORDS_RAW)
// apps/server/src/auth/security-log.ts [T9]
export type SecurityEventType = 'login_succeeded'|'login_failed'|'login_blocked'|'logout'|'logout_all'|'password_changed'
 |'password_reset_created'|'password_reset_used'|'invitation_created'|'invitation_revoked'|'invitation_used'|'role_changed'
 |'status_changed'|'sessions_revoked'|'birth_date_corrected'|'username_changed'|'consent_granted'|'consent_revoked'
 |'data_exported'|'account_deleted'|'gym_deleted';
export type SecurityDetails = { [key: string]: string | number | boolean };
export const FORBIDDEN_DETAIL_KEY: RegExp;   // /password|code|token|secret|hash|cookie/i → clé retirée, logger.warn('security details dropped', { event, count })
export interface SecurityEventInput { type: SecurityEventType; actorId: string | null; targetId: string | null; ip: string | null;
  outcome: 'success' | 'failure' | 'blocked'; details?: SecurityDetails }
export async function logSecurityEvent(trx: DbExecutor, deps: AppDeps, ev: SecurityEventInput): Promise<void>;
// consent_revoked : details { consentType: 'health' | 'ai_coach' } ; account_deleted : targetId = id du compte, aucun détail
// apps/server/src/auth/session.ts [T9]
export async function createSession(trx: DbExecutor, deps: AppDeps, userId: string, opts?: { mustChangePassword?: boolean }): Promise<{ token: string; sessionId: string }>;
export function setSessionCookie(c: Context<AppEnv>, deps: AppDeps, token: string): void;
export function clearSessionCookie(c: Context<AppEnv>, deps: AppDeps): void;
export async function revokeSession(trx: DbExecutor, deps: AppDeps, sessionId: string, reason: 'logout'): Promise<void>;
export async function revokeSessions(trx: DbExecutor, deps: AppDeps, userId: string,
  reason: 'logout' | 'logout_all' | 'password_change' | 'password_reset' | 'admin', exceptSessionId?: string): Promise<number>;
export function sessionMiddleware(deps: AppDeps): MiddlewareHandler<AppEnv>;   // ne bloque jamais ; session account_deleted → sessionId renseigné, user null
export const MUST_CHANGE_ALLOWED: readonly string[];   // ['GET /api/me', 'POST /api/auth/password', 'POST /api/auth/logout']
export const requireUser: MiddlewareHandler<AppEnv>;   // 410 account_deleted | 401 unauthenticated | 403 password_change_required
export const requireAdmin: MiddlewareHandler<AppEnv>;  // requireUser puis 403 forbidden si non admin
// apps/server/src/auth/limiter.ts [T10]
export interface LoginLimiter { check(usernameKey: string, ip: string | null): { allowed: true } | { allowed: false; retryAfterS: number };
  recordFailure(usernameKey: string, ip: string | null): void; recordSuccess(usernameKey: string): void; unlock(usernameKey: string): void }
export interface IpLimiter { hit(ip: string | null): { allowed: boolean; retryAfterS: number } }
export function createLoginLimiter(clock: Clock): LoginLimiter;
export function createIpLimiter(clock: Clock, opts: { limit: number; windowMs: number }): IpLimiter;
export interface AuthLimiters { login: LoginLimiter; invitationCheck: IpLimiter; resetCheck: IpLimiter }
export function authLimiters(deps: AppDeps): AuthLimiters;   // mémoïsé par deps (WeakMap) ; IpLimiter à CODE_CHECKS_PER_HOUR
// apps/server/src/privacy/consent-state.ts [T10]
export type ConsentType = 'health' | 'ai_coach';
export async function getConsentState(db: DbExecutor, userId: string): Promise<ConsentState>;
export async function isHealthConsentActive(db: DbExecutor, userId: string): Promise<boolean>;
// apps/server/src/auth/me.ts, routes.ts, me-routes.ts [T10 ; mod. T12 (reset), T13 (export, delete)]
export async function buildMe(db: DbExecutor, deps: AppDeps, userId: string, opts?: { mustChangePassword?: boolean }): Promise<MeResponse>;
export async function verifyUserPassword(db: DbExecutor, userId: string, password: string): Promise<boolean>;
export async function storeNewPassword(trx: DbExecutor, deps: AppDeps, userId: string, passwordHash: string): Promise<void>;
export function authRoutes(deps: AppDeps): Hono<AppEnv>;   // /api/auth
export function meRoutes(deps: AppDeps): Hono<AppEnv>;     // /api/me
// apps/server/src/auth/invitations.ts, invitation-routes.ts, bootstrap.ts [T11]
export function invitationState(row: { usedAt: string | null; revokedAt: string | null; expiresAt: string }, now: Date): InvitationState; // used > revoked > expired > pending
export async function createInvitation(trx: DbExecutor, deps: AppDeps, input: { birthDate: string; note: string | null; createdBy: string | null;
  isAdminBootstrap: boolean; ttlMs: number; ip: string | null }): Promise<CreateInvitationResponse>;
export async function listInvitations(db: DbExecutor, deps: AppDeps): Promise<InvitationSummary[]>;
export async function revokeInvitation(trx: DbExecutor, deps: AppDeps, id: string, actor: { actorId: string; ip: string | null }): Promise<void>;
export async function checkInvitation(db: DbExecutor, deps: AppDeps, rawCode: string): Promise<InvitationCheckResponse>;
export async function acceptInvitation(deps: AppDeps, input: AcceptInvitationRequest, ip: string | null): Promise<{ userId: string; token: string }>;
export function invitationLink(deps: AppDeps, formatted: string): string;   // `${appOrigin}/invite#${formatted}`
export function invitationRoutes(deps: AppDeps): Hono<AppEnv>; export function adminInvitationRoutes(deps: AppDeps): Hono<AppEnv>;
export async function bootstrapAdminInvitation(deps: AppDeps, birthDate: string): Promise<{ code: string; link: string; expiresAt: string }>; // 409 conflict { reason: 'admin_exists' }
// apps/server/src/auth/password-reset.ts [T12]
export async function createPasswordReset(trx: DbExecutor, deps: AppDeps, targetUserId: string, actor: { actorId: string | null; ip: string | null }): Promise<ResetLinkResponse>;
export async function checkPasswordReset(db: DbExecutor, deps: AppDeps, rawCode: string): Promise<ResetCheckResponse>;
export async function consumePasswordReset(deps: AppDeps, input: ResetPasswordRequest, ip: string | null): Promise<{ userId: string; token: string }>;
// apps/server/src/admin/members.ts, ops-status.ts, routes.ts [T12 ; routes mod. T13, T17]
export async function listMembers(db: DbExecutor, deps: AppDeps): Promise<MemberSummary[]>;
export async function assertNotLastAdmin(db: DbExecutor, targetId: string): Promise<void>;
type AdminActor = { actorId: string; ip: string | null };
export async function setRole(trx: DbExecutor, deps: AppDeps, actor: AdminActor, targetId: string, role: Role): Promise<void>;
export async function setStatus(trx: DbExecutor, deps: AppDeps, actor: AdminActor, targetId: string, status: UserStatus): Promise<void>;
export async function setBirthDate(trx: DbExecutor, deps: AppDeps, actor: AdminActor, targetId: string, birthDate: string): Promise<void>;
export async function revokeMemberSessions(trx: DbExecutor, deps: AppDeps, actor: AdminActor, targetId: string): Promise<number>;
export async function readOpsStatus(dataDir: string): Promise<OpsStatus | null>;
export function adminRoutes(deps: AppDeps): Hono<AppEnv>;   // /api/admin, use('*', requireAdmin)
// apps/server/src/privacy/export.ts, delete-account.ts ; apps/server/src/auth/purge.ts [T13]
export async function buildExport(db: DbExecutor, deps: AppDeps, userId: string): Promise<ExportV1>;
export async function deleteAccount(trx: Transaction<Database>, deps: AppDeps, userId: string, actor: { actorId: string | null; ip: string | null }): Promise<void>; // not_found | last_admin
export const authPurgeJob: DailyJob;   // 'auth-purge'
```

| Méthode et chemin | Accès | Réponse |
|---|---|---|
| POST `/api/auth/login` | public | 200 MeResponse + cookie |
| POST `/api/auth/logout` · `/logout-all` · `/password` | user | 204 |
| POST `/api/invitations/check` | public, 20/h/IP | InvitationCheckResponse |
| POST `/api/invitations/accept` | public | 201 MeResponse + cookie |
| POST `/api/auth/reset/check` | public, 20/h/IP | ResetCheckResponse |
| POST `/api/auth/reset` | public | 200 MeResponse + cookie |
| GET · PATCH `/api/me` | user | MeResponse |
| GET `/api/me/export` · POST `/api/me/delete` | user | ExportV1 · 204 |
| GET `/api/admin/members` | admin | MemberSummary[] |
| POST `/api/admin/members/:id/{reset-link,revoke-sessions,status,role,birth-date,delete}` | admin | ResetLinkResponse · 204 |
| GET · POST `/api/admin/invitations`, POST `/api/admin/invitations/:id/revoke` | admin | InvitationSummary[] · 201 CreateInvitationResponse · 204 |
| GET `/api/admin/ops-status` | admin | OpsStatusResponse |

Liens : `${appOrigin}/invite#XXXX-XXXX-XXXX-XXXX` et `${appOrigin}/reset#XXXX-XXXX-XXXX-XXXX`. Sortie de `admin:bootstrap` / `admin:reset <pseudo>` (3 lignes sur stdout) : `Invitation administrateur (valable 24 h)` / `Lien de réinitialisation pour <pseudo> (valable 24 h)`, puis `Lien : <lien>`, puis `Code : XXXX-XXXX-XXXX-XXXX`.

### 4. Profil, lieux, salles, consentement
```ts
// packages/contracts/src/taxonomy.ts [profil T14]
export const EQUIPMENT = ['chair','table','resistance_band','dumbbells','kettlebell','pull_up_bar','suspension_trainer','box',
  'flat_bench','adjustable_bench','squat_rack','dip_station','back_extension_bench','barbell','ez_bar','cable_station','lat_pulldown',
  'seated_row','leg_press','smith_machine','leg_extension','leg_curl','upper_body_machines'] as const;   // 23
export type EquipmentCode = typeof EQUIPMENT[number]; export const EquipmentCodeSchema: z.ZodType<EquipmentCode>;
export type EquipmentCategory = 'household'|'small_equipment'|'benches_racks'|'free_weights'|'machines';
export const EQUIPMENT_CATEGORIES: Record<EquipmentCategory, readonly EquipmentCode[]>;
export const EQUIPMENT_LABELS: Record<EquipmentCode, string>;
export const EQUIPMENT_IMPLIES: Partial<Record<EquipmentCode, readonly EquipmentCode[]>>;   // { adjustable_bench: ['flat_bench'] }
export const REFERENCE_PROFILES: Record<'home_bodyweight'|'home_small_equipment'|'gym_reference', readonly EquipmentCode[]>;
// packages/contracts/src/presets.ts [T14]
export type EquipmentPresetId = 'gym_large'|'gym_small'|'gym_crossfit'|'gym_other'|'home_none'|'home_small'|'home_gym';
export const EQUIPMENT_PRESETS: Record<EquipmentPresetId, { kind: 'gym'|'home'; label: string; codes: readonly EquipmentCode[] }>;
export const HOME_DEFAULT_PRESET: EquipmentPresetId;   // 'home_none'
// packages/contracts/src/load-settings.ts [T14]
export const LoadSettings: z.ZodType<{ barG: number; smallestPlateG: number; dumbbellsG: number[]; machineStepG: number }>;
export function defaultLoadSettings(kind: 'gym'|'home'): LoadSettings;
// packages/contracts/src/sports.ts [T14]
export const SPORT_CODES = ['running','cycling','swimming','football','rugby','basketball','handball','tennis','padel','badminton','combat_sports','climbing','skiing','dance','other'] as const;
export type SportCode = typeof SPORT_CODES[number]; export const SportCodeSchema: z.ZodType<SportCode>;
export const SPORTS: readonly { code: SportCode; label: string }[]; export const SPORTS_LIST_VERSION = 1; export const SPORT_OTHER_LABEL_MAX = 40;
// packages/contracts/src/texts.ts [T14]
export const HEALTH_CONSENT_TEXT: { version: '1.0'; text: string };
export const HEALTH_QUESTIONNAIRE: { version: '1.0'; questions: readonly [string, string, string, string] };
export function majorOf(version: string): number;   // 'MAJEUR.MINEUR' → MAJEUR ; sinon throw
// packages/contracts/src/api/profile.ts [T15 ; mod. T16]
export const GOALS = ['muscle','strength','fat_loss','fitness','sport_support'] as const; export const Goal = z.enum(GOALS);
export const EXPERIENCES = ['none','lt_6_months','6_to_24_months','gt_24_months'] as const; export const Experience = z.enum(EXPERIENCES);
export const GOAL_LABELS: Record<Goal, string>; export const EXPERIENCE_LABELS: Record<Experience, string>;
export const DAYS_PER_WEEK = [2, 3, 4] as const; export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;   // T16
export const TrainingProfilePatch = z.strictObject({ goal: Goal.optional(), experience: Experience.optional(),
  daysPerWeek: z.literal(DAYS_PER_WEEK).optional(), sessionMinutes: z.literal(SESSION_MINUTES).optional(),
  sportCode: SportCodeSchema.nullable().optional(), sportOtherLabel: z.string().trim().min(1).max(SPORT_OTHER_LABEL_MAX).nullable().optional(),
  cautiousMode: z.boolean().optional(), onboardingStep: OnboardingStep.optional() });
// packages/contracts/src/api/places.ts [T17 ; mod. T18]
export const GymEquipmentCode: z.ZodType<EquipmentCode>;   // EquipmentCodeSchema sans household
export const GymHistoryAction = z.enum(['create','update_info','add_equipment','remove_equipment','update_load_settings']);
export const GymSummary = z.object({ id: z.string(), name: z.string(), city: z.string(), visibleMemberCount: z.number().int() });
export const GymDetail = z.object({ id: z.string(), name: z.string(), city: z.string(), loadSettings: LoadSettings, deletedAt: z.string().nullable(),
  equipment: z.array(EquipmentCodeSchema), canEdit: z.boolean(), visibleMembers: z.array(z.string()),
  history: z.array(z.object({ at: z.string(), action: GymHistoryAction, authorUsername: z.string().nullable(), detail: z.unknown() })) });
export const CreateGymRequest = z.strictObject({ name: z.string().trim().min(2).max(60), city: z.string().trim().min(2).max(60),
  equipment: z.array(GymEquipmentCode), isPrimary: z.boolean(), visibleAtGym: z.boolean().optional() });
export const CreateGymResponse = z.object({ gymId: z.string(), placeId: z.string() });
export const UpdateGymRequest = z.strictObject({ name: z.string().trim().min(2).max(60).optional(), city: z.string().trim().min(2).max(60).optional(),
  loadSettings: LoadSettings.optional() }).refine((v) => Object.keys(v).length > 0);
export const HOME_PLACE_DEFAULT_NAME = 'Maison';   // T18
export const CreatePlaceRequest = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('gym'), gymId: z.string(), isPrimary: z.boolean(), visibleAtGym: z.boolean().optional() }),
  z.strictObject({ kind: z.literal('home'), name: z.string().trim().min(1).max(30).optional(), equipment: z.array(EquipmentCodeSchema), isPrimary: z.boolean() }) ]);
export const CreatePlaceResponse = z.object({ id: z.string() });
export const UpdatePlaceRequest = z.strictObject({ name: z.string().trim().min(1).max(30).optional(), isPrimary: z.literal(true).optional(),
  visibleAtGym: z.boolean().optional(), loadSettings: LoadSettings.optional() }).refine((v) => Object.keys(v).length > 0);
export const DeletePlaceRequest = z.strictObject({ newPrimaryId: z.string().optional() });
// packages/contracts/src/api/consent.ts [T19]
export const BODY_AREAS = ['shoulder','elbow','wrist_hand','neck','upper_back','lower_back','hip','knee','ankle_foot','other'] as const; export const BodyArea = z.enum(BODY_AREAS);
export const LIMITATION_SIDES = ['left','right','both','not_applicable'] as const; export const LimitationSide = z.enum(LIMITATION_SIDES);
export const LIMITATION_SEVERITIES = ['mild','severe'] as const; export const LimitationSeverity = z.enum(LIMITATION_SEVERITIES);
export const BODY_AREA_LABELS: Record<BodyArea, string>; export const LIMITATION_SIDE_LABELS: Record<LimitationSide, string>;
export const LIMITATION_SEVERITY_LABELS: Record<LimitationSeverity, string>; export const LIMITATION_NOTE_MAX = 200;
export const GrantConsentRequest = z.strictObject({ type: z.literal('health'), textVersion: z.string() });
export const WithdrawConsentRequest = z.strictObject({ type: z.literal('health'), password: z.string().min(1).max(1024) });
export const HealthScreeningRequest = z.strictObject({ answers: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]), questionnaireVersion: z.string() });
export const HealthScreeningResponse = z.object({ caution: z.boolean() });
export const LimitationInput = z.strictObject({ bodyArea: BodyArea, side: LimitationSide, severity: LimitationSeverity,
  note: z.string().trim().max(LIMITATION_NOTE_MAX).nullable().optional(), active: z.boolean().optional() });
export const LimitationPatch = LimitationInput.partial().refine((v) => Object.keys(v).length > 0);
export const CreateLimitationResponse = z.object({ id: z.string() });

// packages/domain/src/text.ts [T14]
export function normalize(text: string): string;   // minuscules, NFD sans diacritiques, ponctuation retirée, espaces réduits
// packages/domain/src/recommend-template.ts [T15]
export type TemplateContext = 'gym'|'home'|'sport'; export type TrainingLevel = 'beginner'|'intermediate';
export interface TemplateDescriptor { id: string; context: TemplateContext; level: TrainingLevel; days: { min: number; max: number }; available: boolean }
export interface RecommendInput { goal: Goal; sportCode: string | null; primaryPlaceKind: 'gym'|'home'; experience: Experience; daysPerWeek: 2|3|4 }
export type RecommendReason = 'FEW_DAYS_FULL_BODY'|'NO_TEMPLATE_AVAILABLE'|'DAYS_ADJUSTED';
export interface Recommendation { templateId: string | null; context: TemplateContext; level: TrainingLevel; daysPerWeek: number; reasons: RecommendReason[] }
export function levelFromExperience(e: Experience): TrainingLevel;
export function recommendTemplate(input: RecommendInput, templates: readonly TemplateDescriptor[]): Recommendation;
// packages/domain/src/onboarding.ts [T15]
export function availableGoals(ageBand: AgeBand): Goal[];   // minor → sans 'fat_loss'
export function firstIncompleteStep(s: { goal: Goal|null; experience: Experience|null; daysPerWeek: number|null; sessionMinutes: number|null;
  hasPrimaryPlace: boolean; lastValidatedStep: OnboardingStep|null }): OnboardingStep;

// apps/server/src/profile/routes.ts [T16]
export function profileRoutes(deps: AppDeps): Hono<AppEnv>;   // monté sur /api/me
// apps/server/src/places/place-rows.ts [T17]
export async function demotePrimaries(trx: DbExecutor, deps: AppDeps, userId: string, exceptPlaceId?: string): Promise<void>;
export async function insertGymPlace(trx: DbExecutor, deps: AppDeps, user: SessionUser, o: { gymId: string; isPrimary: boolean; visibleAtGym?: boolean }): Promise<string>;
// apps/server/src/places/gyms.ts, gym-routes.ts [T17]
export async function deleteGymAsAdmin(trx: DbExecutor, deps: AppDeps, actor: { actorId: string; ip: string | null }, gymId: string): Promise<void>;
export function gymRoutes(deps: AppDeps): Hono<AppEnv>;
// apps/server/src/places/places.ts, place-routes.ts [T18]
export function placeRoutes(deps: AppDeps): Hono<AppEnv>;
// apps/server/src/privacy/consent.ts, consent-routes.ts [T19]
export async function grantConsent(trx: DbExecutor, deps: AppDeps, userId: string, type: ConsentType, textVersion: string, ip: string | null): Promise<void>;
export async function withdrawHealthConsent(trx: Transaction<Database>, deps: AppDeps, userId: string, actor: { actorId: string | null; ip: string | null }): Promise<void>;
export function consentRoutes(deps: AppDeps): Hono<AppEnv>;   // monté sur /api/me
```

| Route | Accès | Réponse ou erreurs |
|---|---|---|
| PATCH `/api/me/training-profile` | user | 200 MeResponse |
| POST `/api/me/onboarding/complete` | user | 200 MeResponse ; 409 `{ error: 'onboarding_incomplete', step }` |
| GET `/api/gyms?q=` · `/api/gyms/similar?name=&city=` | user | GymSummary[] |
| POST `/api/gyms` | user | 201 CreateGymResponse ; 409 `{ error: 'gym_duplicate', gymId }` |
| GET `/api/gyms/:id` | user | GymDetail |
| PATCH `/api/gyms/:id`, PUT · DELETE `/api/gyms/:id/equipment/:code` | membre avec un lieu actif à cette salle, ou admin | 204 ; 403 `forbidden` |
| DELETE `/api/admin/gyms/:id` | admin | 204 ; 409 `gym_in_use` |
| POST `/api/places` | user | 201 CreatePlaceResponse ; 409 `place_exists` |
| PATCH `/api/places/:id` | user | 204 |
| DELETE `/api/places/:id` (corps DeletePlaceRequest) | user | 204 ; 409 `last_place` · `primary_required` |
| PUT · DELETE `/api/places/:id/equipment/:code` | user, maison seulement | 204 |
| POST `/api/me/consents` · `/api/me/consents/withdraw` | user | 200 MeResponse ; retrait : 401 `invalid_credentials` |
| PUT `/api/me/health-screening` | user | 200 HealthScreeningResponse |
| POST `/api/me/limitations` · PATCH · DELETE `/api/me/limitations/:id` | user | 201 CreateLimitationResponse · 204 |

Sans consentement santé actif, les quatre dernières routes renvoient 403 `health_consent_required`. Une ressource d'un autre utilisateur renvoie 404, même pour un admin.

### 5. Synchro
```ts
// packages/contracts/src/sync.ts [synchro T20 ; mod. T21]
export const SYNC_PUSH_MAX = 200; export const SYNC_PULL_LIMIT = 500; export const SYNC_TIMEOUT_MS = 4000;
export const EPOCH_RESEND_DAYS = 60; export const TOMBSTONE_TTL_DAYS = 90; export const APPLIED_OP_TTL_MONTHS = 12;
export const SYNC_RETRY_MIN_MS = 2000; export const SYNC_RETRY_MAX_MS = 300_000; export const SYNC_INTERVAL_MS = 60_000;
export const SYNC_DEBOUNCE_MS = 2000; export const COACH_FLUSH_MS = 4000;
export const UuidV7 = z.uuid({ version: 'v7' });
export const OpKind = z.enum(['create','patch','delete','restore_upsert']);
export const SyncOp = z.object({ opId: UuidV7, userId: z.string().min(1), entity: z.string().min(1), id: z.string().min(1).max(200),
  kind: OpKind, fields: z.record(z.string(), z.unknown()) /* camelCase */, clientTs: z.iso.datetime(), protocol: z.number().int().min(1),
  attempts: z.number().int().min(0), serverRevSeen: z.number().int().nullable().optional() });
export const RejectionCode = z.enum(['validation','forbidden','parent_rejected','stale_revision','unknown_entity','protocol']);
export const PushRequest = z.object({ ops: z.array(SyncOp).max(SYNC_PUSH_MAX) });
export const PushEnvelope = z.object({ ops: z.array(z.looseObject({ opId: z.string().min(1) })).max(SYNC_PUSH_MAX) });   // route : chaque op validée ensuite
export const PushResult = z.object({ opId: z.string(), status: z.enum(['applied','applied_partial','duplicate','rejected']), rev: z.number().int().optional(),
  code: RejectionCode.optional(), droppedFields: z.array(z.string()).optional(), dropped: z.boolean().optional() });
export const PushResponse = z.object({ results: z.array(PushResult) });
export const PulledRow = z.object({ entity: z.string(), rev: z.number().int(), row: z.record(z.string(), z.unknown()) /* camelCase, id et deletedAt, sans secret */ });
export const PullResponse = z.object({ rows: z.array(PulledRow), nextWatermark: z.string(), hasMore: z.boolean(), catalogVersion: z.string().nullable() });
export const PullQuery = z.object({ since: z.string().min(1).optional(), limit: z.coerce.number().int().min(1).max(SYNC_PULL_LIMIT).default(SYNC_PULL_LIMIT) });
export function encodeWatermark(epoch: string, rev: number): string;              // `${epoch}:${rev}`
export function decodeWatermark(w: string): { epoch: string; rev: number } | null;
export type ColumnCodec = 'boolean' | 'json';   // T21
export const COLUMN_CODECS: Readonly<Record<string, Readonly<Record<string, ColumnCodec>>>>;
// packages/contracts/src/catalog.ts [T23]
export const ILLUSTRATION_FILE_RE = /^([a-z0-9][a-z0-9-]*)\.([0-9a-f]{8})\.(svg|png|webp|jpg)$/;
export const IllustrationRef = z.object({ id: z.string().min(1), file: z.string().regex(ILLUSTRATION_FILE_RE) });
export const CatalogBundle = z.object({ version: z.string(), exercises: z.array(z.unknown()), illustrations: z.array(IllustrationRef),
  programTemplates: z.array(z.unknown()), adviceSheets: z.array(z.unknown()) });

// apps/server/src/sync/hooks.ts [T20]
export interface HookCtx { trx: Transaction<Database>; deps: AppDeps; userId: string; op: SyncOp }
export interface EntitySyncHooks { allowedKinds?: readonly SyncOp['kind'][]; parent?: { entity: string; column: string /* snake */ }; afterApply?(ctx: HookCtx): Promise<void> }
export type SyncHooksMap = Readonly<Record<string, EntitySyncHooks>>;
export const SYNC_HOOKS: SyncHooksMap;   // { sync_rejection: { allowedKinds: ['patch'] } }
// apps/server/src/sync/push.ts, routes.ts [T20 ; mod. T21, T22]
export class OpRejection extends Error { constructor(readonly code: RejectionCode, readonly reason: string) }
export async function applyPush(deps: AppDeps, user: SessionUser, ops: readonly unknown[]): Promise<PushResult[]>;
export function syncRoutes(deps: AppDeps): Hono<AppEnv>;   // /api/sync : POST /push (T20), GET /pull (T21), protocolGuard sur tout le routeur (T21)
// apps/server/src/sync/pull.ts, protocol-guard.ts [T21]
export async function buildPull(deps: AppDeps, user: SessionUser, since: string | null, limit: number): Promise<PullResponse>;   // throw httpError('watermark_expired')
export const protocolGuard: MiddlewareHandler<AppEnv>;   // 426 { error: 'protocol_unsupported', serverProtocol, minProtocol }
// apps/server/src/sync/epoch.ts, restore-upsert.ts, purge.ts [T22]
export async function rotateServerEpoch(db: DbExecutor, ids: IdGen): Promise<{ epoch: string; baseRev: number }>;   // baseRev = sync_counter
export type RestoreUpsertOutcome = { outcome: 'inserted' | 'replaced' | 'kept'; rev: number };
export async function applyRestoreUpsert(ctx: HookCtx, rule: EntityRule, fields: Record<string, unknown>): Promise<RestoreUpsertOutcome>;
export const syncPurgeJob: DailyJob;   // 'sync-purge'
// apps/server/src/catalog/loader.ts, routes.ts [T23]
export class CatalogLoadError extends Error {}
export async function loadCatalog(deps: AppDeps): Promise<CatalogBundle>;
export function getLoadedCatalog(deps: AppDeps): CatalogBundle | null;
export const CATALOG_STARTUP_TASK: StartupTask;   // 'catalog' ; erreur journalisée, démarrage maintenu
export function catalogRoutes(deps: AppDeps): Hono<AppEnv>;   // GET /api/catalog, ETag "<version>", 304 sur If-None-Match
// apps/server/src/privacy/reapply.ts [T24]
export const PrivacyEventList = z.object({ since: z.iso.datetime(), collectedAt: z.iso.datetime(), source: z.string(),
  events: z.array(z.object({ type: z.enum(['account_deleted','consent_revoked']), at: z.string(), targetId: z.string(), consentType: z.enum(['health','ai_coach']).optional() })) });
export async function collectPrivacyEvents(db: DbExecutor, since: string): Promise<PrivacyEventList['events']>;
export async function reapplyPrivacyEvents(deps: AppDeps, list: PrivacyEventList): Promise<{ accountsDeleted: number; consentsWithdrawn: number }>;
```
Routes : `POST /api/sync/push` (PushEnvelope → PushResponse) ; `GET /api/sync/pull?since=&limit=` (PullResponse) ; `GET /api/catalog` (CatalogBundle). `/api/sync/*` exige `X-Appsport-Protocol` ∈ [MIN_PROTOCOL, SYNC_PROTOCOL], sinon 426.

Client (`apps/web/src`) :
```ts
// local-db/db.ts [synchro T25]
export const LOCAL_DB_NAME = 'appsport'; export const LOCAL_DB_VERSION = 1;
export type OutboxOp = SyncOp;
export interface DeadletterEntry { opId: string; userId: string; entity: string; id: string; code: string; detail: unknown; receivedAt: string }
export type MirrorRow = Record<string, unknown> & { id: string; serverRevSeen: number | null; deletedAt: string | null };
export const STORE_SCHEMAS: Record<string, string>;   // meta:'key' ; outbox:'opId, userId, [entity+id]' ; deadletter:'opId, userId' ; user:'id' ;
// training_profile:'id' ; health_screening:'id' ; limitation:'id' ; consent_event:'id, [type+createdAt]' ; gym:'id, nameKey' ; gym_equipment:'id, gymId' ;
// place:'id, gymId' ; home_equipment:'id, placeId' ; sync_rejection:'id, dismissedAt' ; exercises:'id' ; illustrations:'id' ; programTemplates:'id' ; adviceSheets:'id'
export const NON_MIRROR_STORES: readonly string[];   // ['meta','outbox','deadletter','exercises','illustrations','programTemplates','adviceSheets']
export class AppDb extends Dexie { meta: Table<{ key: string; value: unknown }, string>; outbox: Table<OutboxOp, string>; deadletter: Table<DeadletterEntry, string>; mirror(entity: string): Table<MirrorRow, string> }
export function createAppDb(name?: string, opts?: { extraMirrors?: Record<string, string> }): AppDb;
export function mirrorStoreNames(db: AppDb): string[];
// local-db/meta.ts [T25]
export interface MetaValues { deviceId: string; userId: string; watermark: string; serverEpoch: string; protocol: number; catalogVersion: string;
  serverCatalogVersion: string; activeSessionId: string | null; lastPullOkAt: string; persistGranted: boolean; me: MeResponse }
export async function getMeta<K extends keyof MetaValues>(db: AppDb, k: K): Promise<MetaValues[K] | undefined>;
export async function setMeta<K extends keyof MetaValues>(db: AppDb, k: K, v: MetaValues[K]): Promise<void>;
export async function deleteMeta(db: AppDb, k: keyof MetaValues): Promise<void>;
export const USER_META_KEYS: readonly (keyof MetaValues)[];   // ['userId','watermark','serverEpoch','lastPullOkAt','activeSessionId','me']
// local-db/wipe.ts [T25]
export async function wipeUserData(db: AppDb, opts: { keepOutbox: boolean }): Promise<void>;
export async function clearMirrors(db: AppDb): Promise<void>;
export async function purgeHealthData(db: AppDb, rules?: EntityRulesMap): Promise<{ rowsCleared: number; opsRemoved: number; opsStripped: number }>;
// local-db/consent.ts [T25]
export async function localHealthConsentActive(db: AppDb): Promise<boolean>;
// sync/outbox.ts, protocol-converters.ts [T25]
export interface LocalChange { entity: string; id: string; kind: 'create' | 'patch' | 'delete'; fields: Record<string, unknown> }
export class HealthConsentRequiredError extends Error {}
export async function writeLocal(db: AppDb, change: LocalChange, ctx: { userId: string; now: () => string; newOpId: () => string; healthConsentActive: boolean; rules?: EntityRulesMap }): Promise<OutboxOp>;
export async function pendingCount(db: AppDb, userId: string): Promise<number>;
export const OUTBOX_CONVERTERS: Readonly<Record<number, (op: OutboxOp) => OutboxOp>>;   // {} en v1
export function convertOutboxOp(op: OutboxOp, target?: number): OutboxOp;
// sync/transport.ts [T26]
export interface SyncTransport { fetch(path: string, init: RequestInit): Promise<Response> }
export function browserTransport(baseUrl?: string): SyncTransport;
export class OfflineError extends Error {}
export async function fetchWithTimeout(t: SyncTransport, path: string, init: RequestInit, timeoutMs?: number /* SYNC_TIMEOUT_MS */): Promise<Response>;
// sync/engine.ts, apply-pull.ts, catalog.ts, triggers.ts [T26]
export type ConnectionState = 'unknown'|'online'|'offline'|'unauthenticated'|'protocol_unsupported'|'account_deleted';
export type SyncTrigger = 'launch'|'foreground'|'online'|'set_logged'|'interval'|'coach'|'mutation'|'manual';
export interface SyncState { connection: ConnectionState; pending: number; rejected: number; lastPullOkAt: string | null; syncing: boolean; serverEpoch: string | null }
export interface SyncEngine { syncNow(t: SyncTrigger): Promise<void>; pullNow(): Promise<void>; flushBefore(ms: number): Promise<void>;
  getState(): SyncState; subscribe(fn: (s: SyncState) => void): () => void; start(): void; stop(): void }
export function createSyncEngine(deps: { db: AppDb; transport: SyncTransport; now?: () => number; newOpId?: () => string;
  onAccountDeleted?: () => void; timeoutMs?: number; rules?: EntityRulesMap }): SyncEngine;
export function retryDelayMs(failures: number): number;
export async function applyPulledRows(db: AppDb, rows: PulledRow[]): Promise<void>;
export async function refreshCatalog(db: AppDb, t: SyncTransport): Promise<'unchanged' | 'updated'>;
export function installSyncTriggers(engine: SyncEngine, env?: { doc?: Document; win?: Window }): () => void;
// apps/web/test/support [T25, T27]
export const FIXTURE_MIRRORS: Record<string, string>;   // { fixture_note: 'id', fixture_note_item: 'id, noteId', fixture_c2_log: 'id' }
export function createTestLocalDb(name?: string): AppDb; export function createFixtureLocalDb(name?: string): AppDb;
export async function loadFrozenLocalDb(version: number, name: string): Promise<void>;
export async function dumpLocalDb(db: AppDb): Promise<string>;   // local-db.ts [T25] : JSON de toutes les tables (valeurs témoins)
export function inProcessTransport(ctx: TestContext, getCookie: () => string): SyncTransport & { log: { method: string; path: string; body: unknown }[] };
export interface LossyOptions { seed: number; dropRate: number; dupRate: number; maxDelayMs: number; reorder: boolean }
export function lossyTransport(inner: SyncTransport, opts: LossyOptions): SyncTransport & { heal(): void; stats: { dropped: number; duplicated: number; replayedLate: number } };
```
Comportements client fixés : 401 → pause, outbox conservée ; 410 `account_deleted` → `wipeUserData({ keepOutbox: false })` puis `onAccountDeleted` ; 410 `watermark_expired` → `clearMirrors` puis pull complet, outbox intacte ; 426 → `connection = 'protocol_unsupported'`, outbox conservée ; nouvel `X-Appsport-Epoch` → pause, `restore_upsert` des lignes J (sauf `sync_rejection`) dont `updatedAt` local a moins de 60 j, reprise, puis pull complet ; après chaque mutation E → `pullNow()`.

### 6. Web
```ts
// packages/contracts/src/help-resources.ts [web T28]
export type HelpResourceId = 'emergency' | 'pain' | 'eating_disorder' | 'doping' | 'pregnancy' | 'distress';
export interface HelpResource { id: HelpResourceId; label: string; phone: string | null; hours: string | null; sourceUrl: string | null; verifiedOn: string }
export const HELP_RESOURCES: readonly HelpResource[];
// apps/web/src/api/client.ts [T28]
export class ApiError extends Error { constructor(status: number, code: ApiErrorCode, body: Record<string, unknown>); status: number; code: ApiErrorCode; body: Record<string, unknown> }
export class NetworkRequiredError extends Error {}   // message 'Nécessite le réseau'
export interface ApiClient { get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  send<T = void>(method: 'POST'|'PUT'|'PATCH'|'DELETE', path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> }
export function createApiClient(t: SyncTransport, hooks: { onUnauthenticated(): void; onAccountDeleted(): void }, opts?: { timeoutMs?: number }): ApiClient;
// apps/web/src/app-services.tsx [T28]
export interface AppServices { db: AppDb; api: ApiClient; sync: SyncEngine; transport: SyncTransport; now(): number; newOpId(): string }
export function ServicesProvider(p: { services: AppServices; children: ReactNode }): JSX.Element;
export function useServices(): AppServices; export function useSyncState(): SyncState;
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined;
export function useMeState(): { loaded: boolean; me: MeResponse | null }; export function useMe(): MeResponse | null;
export async function handleAccountDeleted(db: AppDb, navigate: (to: string) => void): Promise<void>;
// apps/web/src/App.tsx [T28 ; routes ajoutées par T30 à T34]
export const PUBLIC_PATHS: readonly string[];
export type GuardResult = { kind: 'render' } | { kind: 'wait' } | { kind: 'redirect'; to: string } | { kind: 'not_found' };
export function resolveGuard(i: { path: string; loaded: boolean; me: MeResponse | null; connection: ConnectionState }): GuardResult;
// apps/web/src/ui/* [T28 ; mod. T34 (download.ts, zone d'état), T37 (UpdateBanner)]
export function AppShell(p: { children: ReactNode }): JSX.Element; export function Page(p: { title: string; back?: string; children: ReactNode }): JSX.Element;
export function Button(p: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }): JSX.Element;
export function Field(p: { label: string; hint?: string; error?: string | null; children: ReactElement }): JSX.Element;
export function Banner(p: { tone: 'info' | 'warning' | 'error'; children: ReactNode }): JSX.Element;
export function Dialog(p: { open: boolean; title: string; onClose(): void; actions: ReactNode; children: ReactNode }): JSX.Element | null;
export function ChoiceList<T extends string | number>(p: { name: string; legend: string; value: T | null; onChange(v: T): void; options: readonly { value: T; label: string; disabled?: boolean }[] }): JSX.Element;
export function CopyButton(p: { text: string; label?: string }): JSX.Element;
export const HEALTH_WARNING_TEXT: string; export function HealthWarning(): JSX.Element;
export function formatDate(isoOrDate: string): string; export function formatDateTime(iso: string): string;
export function formatAge(iso: string, nowMs: number): string; export function plural(n: number, one: string, many: string): string;
export const ERROR_MESSAGES: Record<ApiErrorCode, string>;
export function errorMessage(e: unknown, overrides?: Partial<Record<ApiErrorCode, string>>): string;
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>, overrides?: Partial<Record<ApiErrorCode, string>>):
  { run(...a: A): Promise<R | undefined>; pending: boolean; error: string | null; code: ApiErrorCode | 'network' | 'unknown' | null; reset(): void };
// apps/web/src/repos/index.ts [T29] (un fichier par dépôt ; signatures complètes dans la Task 29)
export interface Repos { me: MeRepo; profile: ProfileRepo; places: PlacesRepo; gyms: GymsRepo; consent: ConsentRepo; admin: AdminRepo; rejections: RejectionsRepo; status: StatusRepo }
export function createRepos(s: AppServices): Repos; export function useRepos(): Repos;
// apps/web/src/sw/protocol.ts, sw-client.ts [T29]
export type PageToSw = { type: 'SKIP_WAITING' } | { type: 'GET_STATUS' } | { type: 'SYNC_ILLUSTRATIONS'; files: string[] };
export interface SwStatus { type: 'STATUS'; buildHash: string; shellCached: boolean; illustrationsMissing: number }
export async function getSwStatus(timeoutMs?: number /* 1000 */): Promise<SwStatus | null>;
export function postToSw(msg: PageToSw): boolean;
// apps/web/src/features/status/readiness.ts, use-readiness.ts, OfflineReadyIndicator.tsx [T29]
export const RECENT_PULL_MS = 86_400_000;
export interface Readiness { ready: boolean; checks: { shell: boolean; catalog: boolean; illustrations: boolean; recentPull: boolean } }
export function computeReadiness(i: { sw: SwStatus | null; catalogVersion: string | null; serverCatalogVersion: string | null; lastPullOkAt: string | null; now: number }): Readiness;
export function useReadiness(): { readiness: Readiness; refresh(): Promise<void>; retry(): Promise<void> };
export function OfflineReadyIndicator(p: { readiness?: Readiness }): JSX.Element;
// apps/web/src/app-events.ts [T31]
export const ONBOARDING_COMPLETED_EVENT = 'appsport:onboarding-completed';
// apps/web/src/features/onboarding/*, places/* [T31] — consommés par T32 et T34
export interface StepProps { mode: 'onboarding' | 'edit'; onNext(): void; onBack?: () => void }
export function GoalStep(p: StepProps): JSX.Element; export function SportStep(p: StepProps): JSX.Element;
export function ExperienceStep(p: StepProps): JSX.Element; export function AvailabilityStep(p: StepProps): JSX.Element;
export function HealthConsentPanel(p: { onGranted(): void; onSkip?: () => void }): JSX.Element;
export function ScreeningQuestions(p: { record: boolean; onSaved?(caution: boolean): void }): JSX.Element;
export function LimitationsEditor(): JSX.Element;
export function CautiousModeToggle(p: { value: boolean; minor: boolean; onChange(v: boolean): void }): JSX.Element;
export function EquipmentChecklist(p: { kind: 'gym' | 'home'; value: readonly EquipmentCode[]; onChange(next: EquipmentCode[]): void; disabled?: boolean }): JSX.Element;
export function GymPicker(p: { isPrimary: boolean; defaultVisible: boolean; onDone(): void }): JSX.Element;
// apps/web/src/features/auth/* [T30] — consommés par T32
export function PasswordFields(p: { username: string; role: Role; password: string; confirm: string; onChange(v: { password: string; confirm: string }): void; label?: string }): JSX.Element;
export function checkNewPassword(i: { password: string; confirm: string; username: string; role: Role }): string | null;
export const USERNAME_MESSAGES: Record<'length' | 'characters' | 'reserved', string>;
export function LogoutDialog(p: { mode: 'current' | 'all'; open: boolean; onClose(): void }): JSX.Element | null;
export function CreateAccountForm(p: { code: string; birthDate: string; onCreated(me: MeResponse): void }): JSX.Element;   // mod. T37
// apps/web/test/support [T28, T29]
export function createFakeApi(): FakeApi; export function createFakeSyncEngine(initial?: Partial<SyncState>): FakeSyncEngine;
export async function renderApp(opts?: RenderAppOptions): Promise<RenderAppResult>;
export async function renderWithServices(ui: ReactElement, opts?: RenderAppOptions): Promise<RenderAppResult>;
export function makeMe(o?: Partial<MeResponse>): MeResponse;
export async function seedMirror(db: AppDb, entity: string, rows: Record<string, unknown>[]): Promise<void>;
export async function seedOutbox(db: AppDb, userId: string, n: number, entity?: string /* 'sync_rejection' */): Promise<OutboxOp[]>;
```
Routes wouter : publiques `/login`, `/invite`, `/reset`, `/privacy`, `/credits`, `/help` ; connecté `/`, `/onboarding`, `/profile`, `/profile/places`, `/profile/places/:id`, `/profile/health`, `/profile/privacy`, `/gyms/:id`, `/settings`, `/rejections` ; admin `/admin/members`, `/admin/invitations`, `/admin/gyms`, `/admin/health`.
`data-testid` stables : `offline-ready` (`data-state="ready|not-ready"`), `pending-counter` (`data-count`), `rejected-counter` (`data-count`), `connection-status` (`data-state=<ConnectionState>`), `update-banner` (`data-dismissible="true|false"`, T37), `onboarding-step` (`data-step=<OnboardingStep>`).
Libellés exacts : « Suivant », « Commencer », « Réessayer », « Créer mon compte », « Se connecter », « Mettre à jour », « Continuer dans ce navigateur ».

### 7. PWA
```ts
// apps/web/src/sw/precache-manifest.ts [pwa T35]
export interface PrecacheManifest { buildHash: string; files: string[] }
export const PRECACHE_GLOBAL = '__APPSPORT_PRECACHE__';
// apps/web/vite-plugin-precache.ts [T35]
export function precachePlugin(opts?: { swEntry?: string /* 'src/sw/sw.ts' */ }): Plugin;   // dist/sw.js commence par self.__APPSPORT_PRECACHE__ = {buildHash, files}
// apps/server/src/static.ts [T35]
export function mountWebApp(app: Hono<AppEnv>, deps: AppDeps): void;   // publicDir ; /illustrations/* ; repli SPA → index.html
// apps/web/src/sw/sw.ts [T36]
export const SHELL_CACHE_PREFIX = 'shell-'; export const ILLUSTRATIONS_CACHE = 'illustrations-v1';
// apps/web/src/sw/register.ts, kill-switch.ts, persist.ts [T37]
export interface UpdateState { available: boolean; forced: boolean }
export interface SwController { getState(): UpdateState; subscribe(fn: (s: UpdateState) => void): () => void; checkForUpdate(): Promise<void>; applyUpdate(): Promise<void>; markForced(): void }
export function registerServiceWorker(opts: { db: AppDb; sync: SyncEngine; intervalMs?: number /* 3600000 */; container?: SwContainerLike; reload?: () => void;
  doc?: Pick<Document, 'visibilityState' | 'addEventListener'> }): SwController;
export function shouldShowUpdateBanner(i: { available: boolean; forced: boolean; activeSessionId: string | null; onboardingInProgress: boolean }): { show: boolean; dismissible: boolean };
export async function applyKillSwitchIfNeeded(health: HealthResponse, env?: KillSwitchEnv): Promise<boolean>;
export async function requestPersistentStorage(db: AppDb, storage?: Pick<StorageManager, 'persist' | 'persisted'>): Promise<boolean>;   // écrit meta.persistGranted
// apps/web/e2e/support/server.ts [T38]
export type E2EFault = null | { kind: 'blackhole' } | { kind: 'status'; pathPrefix: string; status: number; body: unknown };
export interface E2EServer { url: string; dataDir: string; publicDir: string; stop(): Promise<void>; restart(env?: Record<string, string>): Promise<void>;
  cli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }>; setFault(f: E2EFault): void }
export async function startE2EServer(opts?: { env?: Record<string, string>; publicDir?: string; port?: number }): Promise<E2EServer>;
export async function bootstrapAdmin(s: E2EServer, birthDate?: string /* '1990-01-01' */): Promise<{ code: string; link: string }>;
// apps/web/e2e/support/fixtures.ts, pwa.ts, flows.ts [T38] — signatures dans la Task 38 ; builds.ts [T39]
```

### 8. Exploitation
```ts
// apps/server/src/ops/snapshot.ts [exploitation T40]
export const SNAPSHOT_TAG_RE = /^(daily|pre-v\d+\.\d+\.\d+)$/;
export async function takeSnapshot(deps: { sqlite: DatabaseSync; dataDir: string; clock: Clock }, tag: string): Promise<string>;   // daily-AAAAMMJJ.db (date de Paris) | pre-vX.Y.Z.db
export async function pruneSnapshots(dataDir: string, keep?: number /* 3 */): Promise<string[]>;
// apps/server/src/ops/restore.ts [T40]
export async function restoreSnapshot(o: { dataDir: string; snapshotPath: string; ids: IdGen }): Promise<{ epoch: string; baseRev: number }>;
// apps/server/src/ops/active-sessions.ts [T43] ; db-stats.ts [T44]
export function listActiveWorkoutSessions(sqlite: DatabaseSync, now: Date, maxAgeHours?: number /* 3 */): { username: string; startedAt: string }[];
export interface DbStats { integrity: string; users: number; syncCounter: number; lastWriteAt: string | null }
export function dbStats(sqlite: DatabaseSync): DbStats;
```
Scripts hôte (`infra/host`, bash `set -euo pipefail`, `source lib/common.sh` [T43]). Variables surchargeables (tests bats) : `APPSPORT_ROOT=/srv/appsport`, `APPSPORT_REPO=/opt/appsport`, `BACKUP_ROOT=/srv/backup`, `HC_ENV=/etc/appsport/healthchecks.env` (`HC_ALIVE_URL`, `HC_BACKUP_URL`, `HC_RESTORE_TEST_URL`, `HC_HOST_URL`), `DOCKER=docker`, `CURL=curl`, `RESTIC=restic`, `CRYPTSETUP=cryptsetup`, `HEALTH_URL=http://127.0.0.1:3000/api/health`, plus celles de la Task 43. Fichiers : `$APPSPORT_ROOT/deploy.env` (`APPSPORT_VERSION=vX.Y.Z`), `$APPSPORT_ROOT/deploy.log` (`date ancienne nouvelle résultat`), `$APPSPORT_ROOT/data/ops/status.json` (OpsStatus, fusion `jq`), `$APPSPORT_ROOT/secrets/{app.env,b2.env,restic.pass,docker/config.json,deploy_key}`. CLI dans le conteneur : `docker compose exec -T app node /app/server.mjs <cmd>` (service en marche), `docker compose run --rm --no-deps app node /app/server.mjs <cmd>` (service arrêté).

### Table des renommages et arbitrages

| Partie | Ancien nom | Nouveau nom (ou arbitrage) |
|---|---|---|
| fondations T6 | `DEFAULT_ARGON2_PARAMS` (config.ts) | `ARGON2_PARAMS` (deps.ts, T6) |
| comptes T8 | `ARGON2_PARAMS` (auth/password-hash.ts) | `ARGON2_PARAMS` importé de deps.ts (plus défini dans password-hash.ts) |
| comptes T8 | `auth/common-passwords.txt` + loader esbuild `.txt` | `auth/common-passwords-list.ts` (chaîne brute, en-tête MIT) ; plus de loader `.txt` en T41 |
| fondations T4a | `deps.ts` attribué à T6 | `deps.ts` créé en T4a (`Clock`, `IdGen`, `systemClock`, `cryptoIds`), complété en T6 |
| fondations T6 | `createTestContext` sans `dbPath` (ajouté par exploitation T40) | option `dbPath` dès T6 ; T40 ne modifie plus `context.ts` |
| fondations T6 / synchro T20 | littéraux `'X-Appsport-Epoch'`, `'X-Appsport-Protocol'` ; `PROTOCOL_HEADER`, `EPOCH_HEADER` dans `sync.ts` | `PROTOCOL_HEADER`, `EPOCH_HEADER` dans `constants.ts` (T2) |
| synchro T20 | `deps.ts` + `main.ts` + `cli.ts` + `context.ts` modifiés pour `syncHooks` | seuls `AppDeps` et `createAppDeps` (défaut `SYNC_HOOKS`) changent |
| comptes T11 | `export type { InvitationState }` réexporté par `auth/invitations.ts` | importé de `@appsport/contracts` seulement |
| comptes T9 | `SecurityDetails` avec `password?: never; code?: never; token?: never` (et son test `@ts-expect-error`) | `{ [key: string]: string \| number \| boolean }` ; le filtrage `FORBIDDEN_DETAIL_KEY` à l'exécution est seul testé |
| profil T15 | réexport `OnboardingStep`, `ONBOARDING_STEPS` par `api/profile.ts` et `domain/onboarding.ts` ; `Goal`, `Experience` par `domain/recommend-template.ts` | importés de `@appsport/contracts` (api/auth.ts, api/profile.ts) seulement |
| profil T16 | `sportOtherLabel: …max(40)` | `.max(SPORT_OTHER_LABEL_MAX)` |
| profil T19 | `WithdrawConsentRequest.password` `.max(128)` | `.max(1024)` (même borne que les autres saisies de mot de passe) |
| profil T19 | `privacy/health-routes.ts` | `privacy/consent-routes.ts` (évite la confusion avec `health/routes.ts`) |
| web T31 | `labels.ts` : `GOAL_LABELS`, `EXPERIENCE_LABELS`, `BODY_AREA_LABELS` | supprimés ; importés de `@appsport/contracts` (T15, T19) |
| web T31 | `SIDE_LABELS` | `LIMITATION_SIDE_LABELS` (contracts, T19) |
| web T31 | `SEVERITY_LABELS` | `LIMITATION_SEVERITY_LABELS` (contracts, T19) |
| web T29 | `purgeLocalHealthData(db, userId, rules?)` (repos/consent-repo.ts) | `purgeHealthData(db, rules?)` (local-db/wipe.ts, T25), qui renvoie `{ rowsCleared, opsRemoved, opsStripped }` et purge aussi la deadletter |
| web T29 | `dumpAll(db)` (test/support/seed.ts) | `dumpLocalDb(db)` (test/support/local-db.ts, T25, utilisé par le test de `purgeHealthData`) |
| web T29 | `sw/protocol.ts`, `sw/sw-client.ts` attribués à T34 | créés par T29 |
| web T29, T34 | `withdrawHealth` / `grantHealth` : réponse 204 puis `GET /api/me` | la route (T19) répond 200 `MeResponse`, écrite directement dans `meta.me` |
| web T29 | `GymsRepo.create(): Promise<{ gymId; placeId }>`, `updateLimitation(id, patch: Partial<LimitationInput>)`, `LimitationView`, `ScreeningView`, `DeviceOwner`, `ReadinessInputs` | `CreateGymResponse`, `LimitationPatch`, types en ligne dans les signatures |
| pwa T35 | `ILLUSTRATION_FILE_RE` dans `static.ts` (`[a-z0-9_-]`, ordre `svg|png|jpg|webp`) | `ILLUSTRATION_FILE_RE` dans `contracts/catalog.ts` (T23), `[a-z0-9-]`, utilisé par `IllustrationRef` et `static.ts` |
| pwa T38 | `bootstrapAdminInvitation(s, birthDate?)` (e2e) | `bootstrapAdmin(s, birthDate?)` (homonyme du serveur T11) |
| pwa T38 | libellés E2E « Confirmer le mot de passe », « Enregistrer » (offline), « Ma salle n’est pas dans la liste » | libellés des composants : « Confirmation » (T30), « Enregistrer le pseudo » (T32), « Ma salle n'est pas dans la liste » (T31) |
| exploitation T40 | `bootstrapAdminInvitation(server, …)` (e2e) | `bootstrapAdmin(server, …)` |
| exploitation T40 | `dumpAllText(sqlite)` (test/ops/helpers.ts) | `dumpDatabase(sqlite)` (`@appsport/server/testing`, T20) |
| exploitation T41 | `build.mjs` avec `loader: { '.txt': 'text' }` | sans loader `.txt` |
| exploitation T43 | `ActiveWorkoutSession` (interface exportée) | type de retour en ligne `{ username; startedAt }[]` |
| ossature | `session` sans colonne de changement obligé | `session.must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (IN (0,1))` [décision plan (5)], posée à la connexion d'un admin < 14 caractères |
| ossature | `AppServices { db, api, sync }` | `+ transport, now(), newOpId()` (T28) |
| ossature | `Repos` sans `status` | `+ status: StatusRepo` (T29) |
| ossature | `runCli(argv, env, out?)` | `runCli(argv, env, out?, err?)` (T7) |
| ossature | `applyPush(deps, user, ops: SyncOp[])` | `ops: readonly unknown[]` (validation op par op, T20) |
| ossature | `writeStamp(trx, deps: AppDeps, …)` | `deps: { clock: Clock }` (T4a, avant `AppDeps`) |
