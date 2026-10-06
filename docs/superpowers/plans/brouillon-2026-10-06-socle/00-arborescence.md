## Arborescence du socle (propriétaire entre crochets, numéro de la tâche qui crée le fichier)

Un fichier modifié par une tâche ultérieure est signalé « (mod. Tn) ». Il n'y a pas d'autre fichier partagé.

```
appsport/
├─ package.json                      [fondations T1] scripts lint/typecheck/test/test:e2e/test:infra/build ; packageManager pnpm@10 ; engines node >=24.7 (mod. T35 : script build, mod. T41 : build:server, mod. T43 : test:infra)
├─ pnpm-workspace.yaml               [T1] packages/*, apps/*
├─ tsconfig.base.json                [T1] options TS communes (bundler, strict…)
├─ biome.json                        [T1] format 2 espaces, LF, quotes simples
├─ vitest.config.ts                  [T1] projects : packages/contracts, packages/domain, apps/server (env node), apps/web (env happy-dom)
├─ .node-version                     [T1] 24
├─ .gitattributes / .gitignore       existants (mod. T1 : + .e2e-data/, apps/*/dist/, test-results/, playwright-report/)
├─ .github/
│  ├─ workflows/ci.yml               [T1] jobs lint, typecheck, typecheck-ts6 (continue-on-error), test (mod. T38 : job e2e ; mod. T41 : job image ; mod. T43 : job infra)
│  ├─ workflows/release.yml          [exploitation T42] tag vX.Y.Z → GHCR, seulement si la CI du commit est verte
│  └─ dependabot.yml                 [T42] npm, docker (infra/Dockerfile), github-actions
├─ packages/contracts/               Zod, constantes et registre ; aucune logique
│  ├─ package.json, tsconfig.json    [T1]
│  └─ src/
│     ├─ index.ts                    [T1] réexporte tout (mod. par chaque tâche qui ajoute un module)
│     ├─ constants.ts                [T2] MIN_AGE, ADULT_AGE, PARIS_TZ, PRIVACY_POLICY_VERSION, SYNC_PROTOCOL, MIN_PROTOCOL
│     ├─ case.ts                     [T5] snakeToCamel / camelToSnake (clés)
│     ├─ entity-rules.ts             [T5] EntityRule, entityRules (18 tables), mirroredTables()
│     ├─ api/errors.ts               [T6] ApiErrorCode, ERROR_STATUS, ApiErrorBody
│     ├─ api/health.ts               [T6] HealthResponse
│     ├─ auth-constants.ts           [comptes T8] TTL, longueurs, pseudos réservés, durées de session
│     ├─ api/auth.ts                 [T8 types de base ; T10 MeResponse/Login… ; T11 invitations ; T12 reset] schémas des routes publiques et /api/me
│     ├─ api/admin.ts                [T11 invitations admin ; T12 membres] schémas /api/admin/*
│     ├─ api/export.ts               [T13] ExportV1 (appsport-export/1)
│     ├─ ops.ts                      [T12] OpsStatus (format de /data/ops/status.json)
│     ├─ taxonomy.ts                 [profil T14] EQUIPMENT (23), EQUIPMENT_CATEGORIES, EQUIPMENT_IMPLIES, REFERENCE_PROFILES, libellés FR
│     ├─ presets.ts                  [T14] EQUIPMENT_PRESETS (7 préréglages)
│     ├─ load-settings.ts            [T14] LoadSettings (Zod, bornes), defaultLoadSettings()
│     ├─ sports.ts                   [T14] SPORTS (15 codes + libellés), SPORTS_LIST_VERSION
│     ├─ texts.ts                    [T14] HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE (versionnés)
│     ├─ api/profile.ts              [T16] Goal, Experience, TrainingProfilePatch, OnboardingStep (réexporté)
│     ├─ api/places.ts               [T17 salles ; T18 lieux] schémas /api/gyms, /api/places
│     ├─ api/consent.ts              [T19] schémas /api/me/consents, health-screening, limitations
│     ├─ sync.ts                     [synchro T20] SyncOp, PushRequest/Response, PullResponse, PulledRow, watermark, constantes
│     ├─ catalog.ts                  [T23] CatalogBundle, IllustrationRef
│     └─ help-resources.ts           [web T28] HELP_RESOURCES (6 entrées)
│  └─ test/                          tests par module (*.test.ts)
├─ packages/domain/                  TS pur, sans E/S
│  └─ src/
│     ├─ index.ts                    [T1]
│     ├─ ids.ts                      [fondations T2] createUuidV7, createMonotonicUuidV7, isUuidV7
│     ├─ age.ts                      [T2] ageOn, ageBandOn, parisDate
│     ├─ cautious.ts                 [T2] computeCautious
│     ├─ auth/username.ts            [comptes T8] usernameKey, validateUsername
│     ├─ auth/password.ts            [T8] validatePassword
│     ├─ auth/secret-code.ts         [T8] parseSecretCode, formatSecretCode, encodeCrockford
│     ├─ text.ts                     [profil T14] normalize (minuscules, sans accents ni ponctuation)
│     ├─ onboarding.ts               [T15] ONBOARDING_STEPS, firstIncompleteStep
│     └─ recommend-template.ts       [T15] recommendTemplate, levelFromExperience
│  └─ test/ (fixtures/templates.ts [T15] : les 6 modèles factices)
├─ apps/server/
│  ├─ package.json                   [T1] exports "." et "./testing" → test/support/index.ts (mod. T41 : script build)
│  ├─ build.mjs                      [exploitation T41] esbuild → dist/server.mjs (un fichier, loader .txt)
│  ├─ src/
│  │  ├─ main.ts                     [T7] main(argv) : sans argument → serve ; sinon runCli
│  │  ├─ cli.ts                      [T7] runCli ; commandes init, db:check (mod. T11 admin:bootstrap, T12 admin:reset, T24 privacy:*, T40 snapshot/restore)
│  │  ├─ config.ts                   [T6] loadConfig(env) → AppConfig
│  │  ├─ deps.ts                     [T6] Clock, IdGen, AppDeps, systemClock, cryptoIds (mod. T20 : syncHooks)
│  │  ├─ app-env.ts                  [T6] AppEnv, SessionUser
│  │  ├─ app.ts                      [T6] createApp(deps)
│  │  ├─ routes.ts                   [T6] mountRoutes(app, deps) (mod. une ligne par tâche qui ajoute un routeur)
│  │  ├─ logger.ts                   [T6] Logger, createLogger (liste blanche de champs)
│  │  ├─ http/errors.ts              [T6] HttpError, errorHandler
│  │  ├─ http/validate.ts            [T6] parseJson(c, schema), parseQuery
│  │  ├─ http/security-headers.ts    [T6]
│  │  ├─ http/origin-guard.ts        [T6]
│  │  ├─ http/request-log.ts         [T6]
│  │  ├─ http/client-ip.ts           [T6] clientIp(c)
│  │  ├─ http/epoch-header.ts        [T6]
│  │  ├─ health/routes.ts            [T6] GET /api/health
│  │  ├─ startup-guard.ts            [T7] assertStartupPreconditions
│  │  ├─ startup.ts                  [T7] STARTUP_TASKS (mod. T23 : loadCatalog)
│  │  ├─ jobs/scheduler.ts           [T7] DailyJob, startDailyJobs
│  │  ├─ jobs/registry.ts            [T7] DAILY_JOBS (mod. T13 authPurgeJob, T22 syncPurgeJob)
│  │  ├─ db/sqlite-dialect.ts        [T3] NodeSqliteDialect (mutex, savepoints)
│  │  ├─ db/open.ts                  [T3] openDatabase
│  │  ├─ db/schema.ts                [T4] Database, tables Kysely, DbExecutor
│  │  ├─ db/migrate.ts               [T4] migrate, MigrationError
│  │  ├─ db/migrations/index.ts      [T4] Migration, MIGRATIONS
│  │  ├─ db/migrations/0001_socle.ts [T4] DDL des 18 tables
│  │  ├─ db/server-meta.ts           [T4] getServerMeta, initServerMeta
│  │  ├─ db/rev.ts                   [T4] nextRev, writeStamp
│  │  ├─ auth/password-hash.ts       [comptes T8] Argon2 PHC
│  │  ├─ auth/secret.ts              [T8] createSecretCode, hashSecret
│  │  ├─ auth/common-passwords.txt   [T8] ~10 000 mots de passe courants (SecLists, MIT)
│  │  ├─ auth/common-passwords.ts    [T8] COMMON_PASSWORDS (Set)
│  │  ├─ auth/security-log.ts        [T9] logSecurityEvent, SecurityEventType
│  │  ├─ auth/session.ts             [T9] sessions, sessionMiddleware, requireUser, requireAdmin
│  │  ├─ auth/limiter.ts             [T10] createLoginLimiter, createIpLimiter
│  │  ├─ auth/routes.ts              [T10] /api/auth/* (login, logout, logout-all, password) (mod. T12 : reset)
│  │  ├─ auth/me.ts                  [T10] buildMe, verifyUserPassword
│  │  ├─ auth/me-routes.ts           [T10] GET/PATCH /api/me (mod. T13 : export, delete)
│  │  ├─ auth/invitations.ts         [T11] createInvitation, acceptInvitation, invitationState
│  │  ├─ auth/invitation-routes.ts   [T11] /api/invitations/*, /api/admin/invitations*
│  │  ├─ auth/bootstrap.ts           [T11] bootstrapAdminInvitation
│  │  ├─ auth/password-reset.ts      [T12] createPasswordReset, consumePasswordReset
│  │  ├─ auth/purge.ts               [T13] authPurgeJob
│  │  ├─ admin/members.ts            [T12] listMembers, setRole, setStatus, setBirthDate, revokeSessions
│  │  ├─ admin/routes.ts             [T12] /api/admin/members*, /api/admin/ops-status (mod. T17 : DELETE /api/admin/gyms/:id)
│  │  ├─ admin/ops-status.ts         [T12] readOpsStatus
│  │  ├─ privacy/consent-state.ts    [T10] getConsentState, isHealthConsentActive
│  │  ├─ privacy/export.ts           [T13] buildExport
│  │  ├─ privacy/delete-account.ts   [T13] deleteAccount
│  │  ├─ privacy/consent.ts          [profil T19] grantConsent, withdrawHealthConsent
│  │  ├─ privacy/health-routes.ts    [T19] consents, health-screening, limitations
│  │  ├─ privacy/reapply.ts          [synchro T24] collectPrivacyEvents, reapplyPrivacyEvents
│  │  ├─ profile/routes.ts           [T16] PATCH /api/me/training-profile, POST /api/me/onboarding/complete
│  │  ├─ places/gyms.ts              [T17] logique salles (droits, doublons, historique, équipement)
│  │  ├─ places/gym-routes.ts        [T17] /api/gyms*
│  │  ├─ places/places.ts            [T18] logique lieux
│  │  ├─ places/place-routes.ts      [T18] /api/places*
│  │  ├─ sync/hooks.ts               [synchro T20] EntitySyncHooks, SYNC_HOOKS
│  │  ├─ sync/push.ts                [T20] applyPush
│  │  ├─ sync/pull.ts                [T21] buildPull
│  │  ├─ sync/protocol-guard.ts      [T21] 426
│  │  ├─ sync/routes.ts              [T20 push ; mod. T21 pull]
│  │  ├─ sync/epoch.ts               [T22] rotateServerEpoch
│  │  ├─ sync/restore-upsert.ts      [T22]
│  │  ├─ sync/purge.ts               [T22] syncPurgeJob
│  │  ├─ catalog/loader.ts           [T23] loadCatalog, CATALOG_STARTUP_TASK
│  │  ├─ catalog/routes.ts           [T23] GET /api/catalog
│  │  ├─ static.ts                   [pwa T35] mountWebApp : PWA, /illustrations, en-têtes de cache, repli SPA
│  │  └─ ops/snapshot.ts, ops/restore.ts [exploitation T40]
│  └─ test/
│     ├─ support/index.ts            [T6] réexporte tout le dossier support
│     ├─ support/context.ts          [T6] createTestContext, TestContext
│     ├─ support/clock.ts, ids.ts    [T6] FakeClock, seqIds
│     ├─ support/factories.ts        [T5] insertFixtureRow (une fabrique par table du registre)
│     ├─ support/users.ts            [comptes T10] createUser, login, createUserAndLogin
│     ├─ support/sync-fixtures.ts    [synchro T20] tables de test J (fixture_note, fixture_note_item, fixture_c2_log)
│     ├─ __snapshots__/schema.sql    [T4] instantané de sqlite_schema
│     └─ <module>/*.test.ts
├─ apps/web/
│  ├─ package.json                   [T1] (mod. T28 : deps React ; T35 : build ; T38 : test:e2e)
│  ├─ index.html                     [web T28] sans script en ligne ; lien vers manifest (mod. T35)
│  ├─ vite.config.ts                 [T28] proxy /api et /illustrations → serveur dev (mod. T35 : plugin precache)
│  ├─ vite-plugin-precache.ts        [pwa T35] build sw.js + manifeste de précache + buildHash
│  ├─ playwright.config.ts           [T38] projets chromium (Pixel 7) et webkit (iPhone 14)
│  ├─ public/manifest.webmanifest, public/icons/* [T35]
│  ├─ src/
│  │  ├─ main.tsx                    [T28] monte <App/> (mod. T37 : enregistrement du SW et interrupteur d'urgence)
│  │  ├─ App.tsx                     [T28] routeur wouter et garde de session
│  │  ├─ app-services.tsx            [T28] AppServices, ServicesProvider, useServices
│  │  ├─ api/client.ts               [T28] ApiClient, ApiError, NetworkRequiredError
│  │  ├─ ui/                         [T28] AppShell, Button, Field, Banner, Page… (CSS Modules) (mod. T37 : <UpdateBanner/>)
│  │  ├─ local-db/db.ts              [synchro T25] AppDb, createAppDb, LOCAL_DB_NAME, LOCAL_DB_VERSION, STORE_SCHEMAS
│  │  ├─ local-db/meta.ts            [T25] MetaValues, getMeta, setMeta
│  │  ├─ local-db/wipe.ts            [T25] wipeUserData
│  │  ├─ sync/outbox.ts              [T25] writeLocal, pendingCount
│  │  ├─ sync/protocol-converters.ts [T25] OUTBOX_CONVERTERS (vide en v1)
│  │  ├─ sync/transport.ts           [T26] fetchWithTimeout, SyncTransport
│  │  ├─ sync/apply-pull.ts          [T26] applyPulledRows (rebase R-SYN-22)
│  │  ├─ sync/engine.ts              [T26] createSyncEngine, SyncEngine, SyncState
│  │  ├─ sync/triggers.ts            [T26] installSyncTriggers
│  │  ├─ sync/catalog.ts             [T26] refreshCatalog
│  │  ├─ repos/*.ts                  [web T29] MeRepo, ProfileRepo, PlacesRepo, GymsRepo, ConsentRepo, AdminRepo, RejectionsRepo
│  │  ├─ sw/protocol.ts              [T34] PageToSw, SwStatus (protocole page ↔ SW)
│  │  ├─ sw/sw-client.ts             [T34] getSwStatus, postToSw
│  │  ├─ sw/sw.ts                    [pwa T36] le service worker
│  │  ├─ sw/register.ts              [T37] registerServiceWorker, SwController, shouldShowUpdateBanner
│  │  ├─ sw/kill-switch.ts           [T37] applyKillSwitchIfNeeded
│  │  ├─ sw/persist.ts               [T37] requestPersistentStorage
│  │  ├─ sw/UpdateBanner.tsx         [T37]
│  │  └─ features/
│  │     ├─ public/                  [T28] PrivacyPage, CreditsPage, HelpPage, NotFound
│  │     ├─ auth/                    [T30] InvitePage, CreateAccountForm, LoginPage, ResetPage, LogoutDialog
│  │     ├─ onboarding/              [T31] OnboardingFlow + 8 écrans (GoalStep … ReadyStep)
│  │     ├─ places/                  [T32] PlacesPage, PlaceDetail, GymPicker, GymCreate, EquipmentChecklist, GymPage
│  │     ├─ profile/                 [T32] ProfilePage (compte, entraînement)
│  │     ├─ admin/                   [T33] MembersPage, InvitationsPage, AdminGymsPage, ServerHealthPage
│  │     ├─ privacy/                 [T34] HealthSection, ConsentWithdrawDialog, ExportButton, DeleteAccountDialog, PrivacySettingsPage
│  │     └─ status/                  [T34] readiness.ts, OfflineReadyIndicator, PendingCounter, RejectionsPage, ConnectionStatus
│  ├─ test/support/                  [T25] local-db.ts (createTestLocalDb) ; [T28] render.tsx, fake-api.ts ; [T27] in-process-transport.ts, lossy-transport.ts
│  ├─ test/fixtures/local-db/v1/     [T25] base Dexie figée (outbox + miroir) pour R-VER-5
│  └─ e2e/
│     ├─ support/server.ts           [pwa T38] startE2EServer, bootstrapAdminInvitation
│     ├─ support/builds.ts           [T39] buildTwice (builds A et B)
│     ├─ arrival.spec.ts             [T38] invitation → onboarding → Prêt hors ligne
│     ├─ offline.spec.ts             [T38] rechargement à froid hors ligne, « Nécessite le réseau », retour réseau
│     ├─ update.spec.ts              [T39] mise à jour A → B, bandeau, outbox intacte
│     ├─ kill-switch.spec.ts         [T39]
│     ├─ protocol.spec.ts            [T39] 426 → bandeau forcé → mise à jour → synchro
│     └─ epoch.spec.ts               [exploitation T40] restauration → nouvelle époque → renvoi, aucune perte
├─ data/                             [synchro T23] programs/.gitkeep, exercises/.gitkeep, illustrations/manifest.json (= []), LICENSE
├─ infra/
│  ├─ Dockerfile                     [exploitation T41] multi-étapes (pnpm build → node:24-slim)
│  ├─ compose.yaml                   [T41] service app unique
│  ├─ test/image-contract.sh         [T41] contrat d'image (CI)
│  ├─ host/lib/common.sh             [T43] fonctions communes et commandes surchargeables (tests)
│  ├─ host/appsport-unlock           [T43]
│  ├─ host/appsport-update           [T43] déploiement et --rollback
│  ├─ host/appsport-backup           [T44]
│  ├─ host/appsport-restore-test     [T44]
│  ├─ host/appsport-alive            [T44]
│  ├─ host/appsport-check            [T44]
│  ├─ host/test/*.bats               [T43, T44]
│  ├─ systemd/                       [T44] appsport-{alive,backup,check,restore-test}.{service,timer}, docker.service.d/appsport.conf
│  ├─ docker/daemon.json             [T44]
│  ├─ apt/52appsport-unattended      [T44] Automatic-Reboot "false"
│  ├─ tailscale-policy.hujson        [T44]
│  └─ RUNBOOK-reconstruction.md      [T45]
└─ docs/
   ├─ adr/0001-service-worker-maison.md [pwa T35]
   ├─ fiche-de-traitement.md         [exploitation T45]
   ├─ incidents.md                   [T45] (modèle vide)
   └─ exploitation/P1-installation.md … P9-admin-indisponible.md, installer-appsport.md [T45]
```