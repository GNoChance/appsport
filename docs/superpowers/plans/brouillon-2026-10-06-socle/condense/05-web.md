### Task 28: Coquille de l'appli web, client API et pages publiques

**Files:**
- Create: `packages/contracts/src/help-resources.ts` ; Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/package.json` (`react@19`, `react-dom@19`, `wouter@3`, `zod@4`, `dexie@4`, `@appsport/contracts`, `@appsport/domain` ; dev `vite@8`, `@vitejs/plugin-react`, `@testing-library/react`, `happy-dom`, `fake-indexeddb@6`, `@types/react`, `@types/react-dom`, `@appsport/server`), `vitest.config.ts` (projet web : `setupFiles: ['apps/web/test/setup.ts']`)
- Create: `apps/web/{index.html, vite.config.ts}`, `apps/web/src/{vite-env.d.ts, main.tsx, App.tsx, app-services.tsx, api/client.ts}`
- Create: `apps/web/src/ui/{index.ts, AppShell.tsx, Page.tsx, Button.tsx, Field.tsx, Banner.tsx, Dialog.tsx, ChoiceList.tsx, CopyButton.tsx, HealthWarning.tsx, ui.module.css, format.ts, errors.ts, use-action.ts}`
- Create: `apps/web/src/features/public/{PrivacyPage.tsx, privacy-content.ts, CreditsPage.tsx, HelpPage.tsx, NotFound.tsx, public.module.css}`, `apps/web/src/features/home/{HomePage.tsx, home.module.css}`
- Create: `apps/web/test/{setup.ts, support/fake-api.ts, support/render.tsx}`
- Test: `packages/contracts/test/help-resources.test.ts`, `apps/web/test/app/{api-client,static-rules,ui-format}.test.ts`, `apps/web/test/app/{guard,public-pages}.test.tsx`

**Interfaces:**
- Consumes : T25 (`createAppDb`, `AppDb`, `getMeta`, `setMeta`, `wipeUserData`, `createTestLocalDb`) ; T26 (`SyncTransport`, `browserTransport`, `fetchWithTimeout`, `OfflineError`, `createSyncEngine`, `SyncEngine`, `SyncState`, `SyncTrigger`, `ConnectionState`) ; contracts (`ApiErrorCode`, `ApiErrorBody`, `MeResponse`, `PRIVACY_POLICY_VERSION`, `SYNC_PROTOCOL`, `SYNC_TIMEOUT_MS`) ; domain (`createMonotonicUuidV7`).
- Produces : Interfaces partagées §6 (`help-resources.ts`, `api/client.ts`, `app-services.tsx`, `App.tsx`, `ui/*`, support `createFakeApi`, `createFakeSyncEngine`, `renderApp`, `renderWithServices`, `makeMe`). Pages : `PrivacyPage`, `CreditsPage`, `HelpPage`, `NotFound`, `HomePage` ; `OWNER_FIRST_NAME` (`import.meta.env.VITE_OWNER_FIRST_NAME ?? "l'administrateur"`). Support local :
```ts
export interface FakeRequest { method: string; path: string; query: URLSearchParams; body: unknown; headers: Headers; init: RequestInit }
export type FakeReply = { status: number; body?: unknown; headers?: Record<string, string> };
export interface FakeApi { transport: SyncTransport; calls: FakeRequest[]; on(method: string, pattern: string /* '/api/gyms/:id' */, h: ((r: FakeRequest) => FakeReply | Promise<FakeReply>) | FakeReply): FakeApi;
  setOffline(mode: false | 'reject' | 'hang'): void }   // route inconnue → 404 { error: 'not_found' }
export type FakeSyncEngine = SyncEngine & { set(p: Partial<SyncState>): void; triggers: SyncTrigger[]; pullCount: number };   // défaut online, pending 0, rejected 0
export interface RenderAppOptions { path?: string; me?: MeResponse | null; api?: FakeApi; sync?: FakeSyncEngine; db?: AppDb; now?: number }
export interface RenderAppResult extends RenderResult { services: AppServices; api: FakeApi; sync: FakeSyncEngine; db: AppDb; location(): string }
// makeMe : id 'u-1', username 'lea', member, active, birthDate '1990-01-01', adult, onboardé le '2026-10-01T10:00:00.000Z', consentements inactifs, termsVersion '1.0'
// now par défaut Date.parse('2026-10-06T12:00:00.000Z') ; routeur memoryLocation de wouter
```

**Spec:** 03 P-LOG-4, §13.1, §13.5 à §13.7, §17 n°15, P-DRT-4 ; 01 R-PWA-7, §2 (CSS Modules, wouter) ; 02 §11 ; 07 §5.11 (HELP_RESOURCES, ancien numéro TCA absent).

- [ ] **Step 1: Write the failing test**

```ts
// help-resources.test.ts
expect(HELP_RESOURCES.map((r) => r.id)).toEqual(['emergency', 'pain', 'eating_disorder', 'doping', 'pregnancy', 'distress']);
// phone : emergency '15 / 112', eating_disorder '09 69 325 900', doping '0 800 15 2000', distress '3114', pain et pregnancy null ;
// verifiedOn '2026-10-06' partout ; seul distress a hours ; l'ancien numéro TCA ['0810','037','037'].join(' ') n'apparaît dans aucun fichier de apps/, packages/, data/
// api-client.test.ts
// send('POST', …) : Content-Type application/json, X-Appsport-Protocol '1', pas d'en-tête Origin, credentials 'same-origin' ; sans corps → {} ;
// réponse hors schéma → rejet ; 409 { error: 'username_taken' } → ApiError { status: 409, code: 'username_taken' } ;
// transport muet : rien à 3999 ms, NetworkRequiredError('Nécessite le réseau') à 4000 ms ; transport en échec → NetworkRequiredError ;
// 410 account_deleted → onAccountDeleted une fois ; 410 watermark_expired → non ; 401 → onUnauthenticated
// guard.test.tsx — resolveGuard({ path, loaded, me, connection })
```

| Chemin, chargé, me, connexion | Résultat |
|---|---|
| `/privacy`, non, null, online ; `/help`, oui, null, offline ; `/invite`, oui, me, online ; `/login`, oui, me, unauthenticated | `render` |
| `/profile`, non, null, unknown | `wait` |
| `/profile`, oui, null, online ; `/profile`, oui, me, unauthenticated ou account_deleted | `redirect /login` |
| `/`, oui, non onboardé ; `/onboarding`, oui, onboardé | `redirect /onboarding` ; `redirect /` |
| `/onboarding`, oui, non onboardé ; `/profile` avec `mustChangePassword` | `render` |
| `/` avec `mustChangePassword` ; `/login`, oui, me, online | `redirect /profile` ; `redirect /` |
| `/admin/members` membre ; admin | `not_found` ; `render` |

```ts
// App : /privacy sans session → h1 'Confidentialité et règles' ; /profile sans session → location '/login' ; non onboardé sur / → '/onboarding' ;
//   lien 'Administration' (href '/admin/members') pour un admin seulement ; rappel admin passwordReminderDue → /Pense à changer ton mot de passe/
// public-pages.test.tsx : /privacy contient 'Version 1.0', 'peut techniquement lire la base', "aucune requête manuelle sur les données d'une personne sans son accord",
//   "l'adresse de ton compte Tailscale", '90 jours sans usage', '365 jours au maximum', '12 mois', '30 jours au plus', '7 jours', '24 h', '90 jours',
//   'ne remplace pas un avis médical' ; titres 'Règles pour les 16-17 ans' et 'Coach et mineurs'
// /help : liens tel: ['tel:15','tel:112','tel:0969325900','tel:0800152000','tel:3114'], 'Numéros vérifiés le 06/10/2026', un seul 'Horaires :'
// /credits : h1 'Crédits', 'Aucune illustration pour le moment.' ; route inconnue → 'Page introuvable'
// static-rules.test.ts : index.html sans script en ligne (chaque <script> a src et un corps vide), sans http(s)://, sans style=, avec lang="fr" ;
//   aucune CSS de src/ ne charge un domaine tiers ; aucun fichier de src/ ne contient /ts\.net|localhost:\d+/ (R-PWA-7)
// ui-format.test.ts (now '2026-10-06T12:00:00.000Z')
expect(formatDate('2008-03-01')).toBe('01/03/2008'); expect(formatDate('2026-10-05T23:30:00.000Z')).toBe('06/10/2026');
expect(formatDateTime('2026-10-06T12:05:00.000Z')).toBe('06/10/2026 à 14:05');
// formatAge : −30 s "à l'instant", −3 min 'il y a 3 min', −5 h 'il y a 5 h', −2 j 'il y a 2 j'
expect(errorMessage(new NetworkRequiredError())).toBe('Nécessite le réseau'); expect(errorMessage(new ApiError(409, 'username_taken', {}))).toBe('Ce pseudo est déjà pris.');
expect(errorMessage(new ApiError(409, 'last_place', {}), { last_place: 'X' })).toBe('X'); expect(errorMessage(new Error('boom'))).toBe('Une erreur inattendue est survenue.');
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- help-resources` et `pnpm --filter @appsport/web test -- app/` → modules introuvables.

- [ ] **Step 3: Implement**

- `HELP_RESOURCES`, dans l'ordre : emergency « Urgence vitale (SAMU 15, numéro européen 112) » `'15 / 112'` ; pain « Douleur : consulte un médecin ou un kinésithérapeute » ; eating_disorder « Anorexie Boulimie Info Écoute (FFAB), appel non surtaxé » `'09 69 325 900'` `https://www.ffab.fr/500-ligne-tca-nouveau-numero` ; doping « Écoute Dopage » `'0 800 15 2000'` `https://lannuaire.service-public.gouv.fr/centres-contact/R20697` ; pregnancy « Grossesse ou allaitement : demande conseil à ton médecin ou à une sage-femme » ; distress « Prévention du suicide » `'3114'` hours `'24 h/24, gratuit'` `https://3114.fr/`.
- `resolveGuard`, dans l'ordre : chemin public (`/login` avec session valide → `/`) ; `!loaded` → `wait` ; pas de `me` ou connexion `unauthenticated`/`account_deleted` → `/login` ; `mustChangePassword` → `/profile` ; onboarding non terminé → `/onboarding` (et `/onboarding` terminé → `/`) ; `/admin*` sans rôle admin → `not_found`. Écrans connectés dans `<AppShell>`, pages publiques sans.
- `main.tsx` : `createSyncEngine({ onAccountDeleted: () => navigate('/login?reason=account_deleted') })` ; `createApiClient(transport, { onUnauthenticated: () => void sync.syncNow('manual'), onAccountDeleted: () => void handleAccountDeleted(db, navigate) })` ; `sync.start()`. `vite.config.ts` : proxy `/api` et `/illustrations` vers `http://localhost:3000`, port 5173 (`APP_ORIGIN=http://localhost:5173` noté en commentaire, hors de `src/`).
- `ERROR_MESSAGES` (un par code), dont `invalid_credentials` « Pseudo ou mot de passe incorrect », `account_disabled` « Compte désactivé, contacte l'administrateur », `under_min_age` « appsport est réservé aux 16 ans et plus », `last_admin` « Il doit rester au moins un administrateur actif. », `health_consent_required` « Cette action demande ton accord santé. », `rate_limited` « Trop d'essais. Réessaie plus tard. », `internal` « Le serveur a rencontré une erreur. ».
- `HEALTH_WARNING_TEXT` : « appsport ne remplace pas un avis médical. Consultez un médecin avant de reprendre une activité si vous avez un problème de santé, et arrêtez en cas de douleur. »
- Page « Confidentialité et règles » (`Version ${PRIVACY_POLICY_VERSION}`) : contenu de 03 §13.5, sections « Qui est responsable », « Données collectées et pourquoi », « Où sont les données », « Durées de conservation », « Ce que l'administrateur voit et ne voit pas » (dont P-ADM-3 : « L'administrateur a la main sur le serveur et peut techniquement lire la base. Il s'engage à ne faire aucune requête manuelle sur les données d'une personne sans son accord. » et « L'administrateur voit l'adresse de ton compte Tailscale, une information gérée par Tailscale. »), « Tes droits et comment les exercer », « Règles pour les 16-17 ans », « Pas un avis médical », « Coach et mineurs ».
- `HomePage` : « Bonjour <pseudo> » et, si `passwordReminderDue`, `Banner` « Pense à changer ton mot de passe (rappel annuel). » Styles par CSS Modules uniquement.

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes → vert ; `pnpm lint && pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(web): coquille de l'appli, client API et pages publiques"`

---

### Task 29: Dépôts d'accès aux données, état hors ligne et voyant « Prêt hors ligne »

**Files:**
- Create: `apps/web/src/repos/{index.ts, rows.ts, me-repo.ts, profile-repo.ts, places-repo.ts, gyms-repo.ts, consent-repo.ts, admin-repo.ts, rejections-repo.ts, status-repo.ts}`, `apps/web/src/sw/{protocol.ts, sw-client.ts}`, `apps/web/src/features/status/{readiness.ts, use-readiness.ts, OfflineReadyIndicator.tsx, status.module.css}`, `apps/web/test/support/seed.ts`
- Modify: `apps/web/src/App.tsx` (`repos.me.refresh()` au montage), `apps/web/src/features/home/HomePage.tsx` (`<OfflineReadyIndicator/>`)
- Test: `apps/web/test/repos/{me-repo,profile-places-gyms,consent-repo,admin-rejections,offline-mutations}.test.ts(x)`, `apps/web/test/status/{readiness,sw-client}.test.ts`, `apps/web/test/status/offline-ready.test.tsx`, `apps/web/test/architecture.test.ts`

**Interfaces:**
- Consumes : T28 ; T25 (`AppDb`, `MirrorRow`, `getMeta`, `setMeta`, `wipeUserData`, `purgeHealthData`, `writeLocal`, `pendingCount`) ; T26 (`refreshCatalog`) ; schémas de contracts des parties comptes et profil ; domain (`firstIncompleteStep`).
- Produces : Interfaces partagées §6 (`Repos`, `createRepos`, `useRepos`, `sw/protocol.ts`, `sw/sw-client.ts`, `readiness.ts`, `useReadiness`, `OfflineReadyIndicator`, support `seedMirror`, `seedOutbox`). Dépôts (toute écriture E = `api.send` puis `await sync.pullNow()` ; aucune écriture locale avant la réponse) :
```ts
export function parseJsonColumn<T>(v: unknown, schema: z.ZodType<T>): T | null; export function isLive(row: MirrorRow): boolean;
export interface MeRepo { current(): Promise<MeResponse | null>; refresh(): Promise<MeResponse | null> /* hors ligne → cache ; ApiError → null sans effacer */;
  deviceOwner(): Promise<{ userId: string | null; username: string | null; pending: number }>; login(r: LoginRequest): Promise<MeResponse>;
  checkInvitation(code: string): Promise<InvitationCheckResponse>; acceptInvitation(r: AcceptInvitationRequest): Promise<MeResponse>;
  checkReset(code: string): Promise<ResetCheckResponse>; resetPassword(r: ResetPasswordRequest): Promise<MeResponse>; updateUsername(u: string): Promise<MeResponse>;
  changePassword(r: ChangePasswordRequest): Promise<void>; logout(mode: 'current' | 'all'): Promise<void>; exportData(): Promise<ExportV1>; deleteAccount(password: string): Promise<void> }
// login, acceptInvitation, resetPassword → adoptSession : autre meta.userId → wipeUserData({ keepOutbox: false }) ; setMeta userId et me ; syncNow('manual')
// logout et deleteAccount → wipeUserData({ keepOutbox: false }) après la réponse
export interface TrainingProfileView { goal: Goal | null; experience: Experience | null; daysPerWeek: 2 | 3 | 4 | null; sessionMinutes: 30 | 45 | 60 | 75 | 90 | null;
  sportCode: SportCode | null; sportOtherLabel: string | null; cautiousMode: boolean }
export interface ProfileRepo { get(): Promise<TrainingProfileView | null>; update(p: TrainingProfilePatch): Promise<MeResponse>; completeOnboarding(): Promise<MeResponse>;
  onboardingInput(): Promise<Parameters<typeof firstIncompleteStep>[0]> }
export interface PlaceView { id: string; kind: 'gym' | 'home'; gymId: string | null; name: string; city: string | null; isPrimary: boolean; visibleAtGym: boolean | null;
  loadSettings: LoadSettings | null; equipment: EquipmentCode[] }
export interface PlacesRepo { list(): Promise<PlaceView[]> /* principal d'abord puis nom */; get(id: string): Promise<PlaceView | null>; create(r: CreatePlaceRequest): Promise<void>;
  update(id: string, r: UpdatePlaceRequest): Promise<void>; remove(id: string, r: DeletePlaceRequest): Promise<void>; setEquipment(placeId: string, code: EquipmentCode, present: boolean): Promise<void> }
export interface GymsRepo { search(q: string): Promise<GymSummary[]>; similar(name: string, city: string): Promise<GymSummary[]>; create(r: CreateGymRequest): Promise<CreateGymResponse>;
  detail(id: string): Promise<{ detail: GymDetail; offline: boolean }> /* hors ligne : miroirs, canEdit false, history [], visibleMembers [] */;
  update(id: string, r: UpdateGymRequest): Promise<void>; setEquipment(id: string, code: EquipmentCode, present: boolean): Promise<void> }
export interface ConsentRepo { state(): Promise<ConsentState | null>; needsHealthReconsent(): Promise<boolean> /* actif et majorOf(textVersion) < majorOf(HEALTH_CONSENT_TEXT.version) */;
  grantHealth(): Promise<MeResponse>; withdrawHealth(password: string): Promise<MeResponse> /* MeResponse → meta.me, purgeHealthData, pullNow */;
  screening(): Promise<{ caution: boolean; questionnaireVersion: string; answeredAt: string } | null>; saveScreening(a: [boolean, boolean, boolean, boolean]): Promise<{ caution: boolean }>;
  limitations(): Promise<{ id: string; bodyArea: BodyArea; side: LimitationSide; severity: LimitationSeverity; note: string | null; active: boolean }[]>;
  addLimitation(i: LimitationInput): Promise<{ id: string }>; updateLimitation(id: string, p: LimitationPatch): Promise<void>; removeLimitation(id: string): Promise<void> }
export interface AdminRepo { members(): Promise<MemberSummary[]>; resetLink(id: string): Promise<ResetLinkResponse>; revokeSessions(id: string): Promise<void>;
  setStatus(id: string, s: UserStatus): Promise<void>; setRole(id: string, r: Role, password: string): Promise<void>; setBirthDate(id: string, d: string): Promise<void>;
  deleteMember(id: string, confirmUsername: string): Promise<void>; invitations(): Promise<InvitationSummary[]>; createInvitation(r: CreateInvitationRequest): Promise<CreateInvitationResponse>;
  revokeInvitation(id: string): Promise<void>; opsStatus(): Promise<OpsStatusResponse>; gyms(): Promise<GymSummary[]>; deleteGym(id: string): Promise<void> }
export interface RejectionView { id: string /* id sync_rejection ou 'local:<opId>' */; source: 'server' | 'local'; opId: string; entity: string; rowId: string; code: string; detail: unknown; at: string }
export interface RejectionsRepo { list(): Promise<RejectionView[]>; count(): Promise<number>; dismiss(id: string): Promise<void> }
export interface StatusRepo { readinessInputs(): Promise<{ catalogVersion: string | null; serverCatalogVersion: string | null; lastPullOkAt: string | null }>;
  persistGranted(): Promise<boolean | null>; pendingCount(): Promise<number>; retry(): Promise<void> /* syncNow('manual') puis refreshCatalog */ }
```

**Spec:** 01 §1 principe 4, §2 et §3 (Dexie derrière des dépôts), R-SYN-12, R-SYN-18, R-SYN-30, R-SYN-33, R-SYN-34 ; 02 §1 principe 4, R-AUTH-8 ; 03 P-AUT-6, P-CST-3, P-CST-4.

- [ ] **Step 1: Write the failing test**

```ts
// me-repo.test.ts : refresh → meta.me.username 'lea2' ; hors ligne → cache 'lea' gardé ;
//   connexion de u-B avec 2 ops de u-A : deviceOwner { userId: 'u-A', username: 'lea', pending: 2 } puis outbox vide, meta.userId 'u-B', sync.triggers contient 'manual' ;
//   reconnexion de u-A ('Lea') → outbox gardée (2) ; logout('current') → calls ['/api/auth/logout'], outbox vide, meta.me absente
// profile-places-gyms.test.ts : update({ goal: 'strength', onboardingStep: 'goal' }) → PATCH ce corps, meta.me à jour, pullCount 1 ;
//   onboardingInput → { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45, hasPrimaryPlace: true, lastValidatedStep: 'sport' } ;
//   places.list → [p-1 salle 'Basic Fit' 'Lyon' principale, p-2 maison 'Garage' equipment ['chair'], loadSettings maison], p-3 supprimé absent ;
//   gyms.detail hors ligne → { offline: true, canEdit: false, history: [], visibleMembers: [] } et matériel du miroir ; 409 gym_duplicate → ApiError body.gymId 'g-1'
// consent-repo.test.ts : withdrawHealth('pw') → POST { type: 'health', password: 'pw' }, meta.me à jour, miroirs C2 vidés, pullCount 1 ; 401 → rien de purgé ;
//   needsHealthReconsent : '0.9' → true ; '1.0', '1.4', inactif → false ; saveScreening → PUT { answers, questionnaireVersion: '1.0' }
// admin-rejections.test.ts : sync_rejection r-1 (op-1), r-2 ignoré, r-3 supprimé ; deadletter op-1, op-7 (u-1), op-8 (u-2) →
//   list [{ id: 'r-1', source: 'server', opId: 'op-1' }, { id: 'local:op-7', source: 'local', opId: 'op-7' }], count 2 ;
//   dismiss('r-1') → op patch { dismissedAt: '2026-10-06T12:00:00.000Z' }, deadletter op-1 supprimée, trigger 'mutation' ; dismiss('local:op-7') → aucune op
// offline-mutations.test.ts : profile.update, places.create, gyms.setEquipment, consent.grantHealth, admin.revokeSessions hors ligne → 'Nécessite le réseau', base inchangée, pullCount 0
// readiness.test.ts : 16 combinaisons → { ready: s && c && i && p, checks } ; pull à 24 h exactement → recentPull false, à 24 h − 1 ms → true
// sw-client.test.ts : réponse par MessageChannel au message { type: 'GET_STATUS' } ; sans contrôleur → null et postToSw false ; contrôleur muet → getSwStatus(50) null
// offline-ready.test.tsx : pull il y a 1 h → data-state 'ready', « Prêt hors ligne » ; 25 h → 'not-ready', « Pas encore prêt hors ligne », « Pas de synchronisation depuis plus de 24 h »
// architecture.test.ts : features/, ui/ et App.tsx n'importent ni dexie ni local-db/ ; aucun 'navigator.onLine' dans src/
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- repos/ status/ architecture` → `../../src/repos` introuvable.

- [ ] **Step 3: Implement**

Lectures par `db.mirror` et `getMeta`, filtrées par `isLive`, `loadSettings` par `parseJsonColumn(v, LoadSettings)`, 0/1 → booléens. `rejections.dismiss` passe par `writeLocal(db, { entity: 'sync_rejection', id, kind: 'patch', fields: { dismissedAt } }, …)`, supprime la deadletter de même `opId`, puis `syncNow('mutation')`. `computeReadiness` : `shell = sw?.shellCached === true` ; `catalog` = versions locale et serveur égales et non nulles ; `illustrations = sw !== null && sw.illustrationsMissing === 0` ; `recentPull = now − lastPullOkAt < RECENT_PULL_MS`. `useReadiness` recalcule au montage, à chaque `SyncState` et toutes les 5 s ; **[décision plan]** en mode `development` sans SW, statut factice `{ buildHash: 'dev', shellCached: true, illustrationsMissing: 0 }` (Vite dev n'a pas de SW ; Vitest tourne en mode `test`). Libellés d'échec : « Appli pas encore enregistrée sur l'appareil », « Catalogue à télécharger », « Illustrations à télécharger », « Pas de synchronisation depuis plus de 24 h ».

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(web): dépôts d'accès aux données et voyant Prêt hors ligne"`

---

### Task 30: Écrans d'accès (invitation, création du compte, connexion, réinitialisation, déconnexion)

**Files:**
- Create: `apps/web/src/features/auth/{InvitePage.tsx, CreateAccountForm.tsx, LoginPage.tsx, ResetPage.tsx, LogoutDialog.tsx, PasswordFields.tsx, install-help.ts, messages.ts, auth.module.css}`
- Modify: `apps/web/src/App.tsx` (`/login`, `/invite`, `/reset`)
- Test: `apps/web/test/auth/{invite,login,logout-reset}.test.tsx`, `apps/web/test/auth/messages.test.ts`

**Interfaces:**
- Consumes : T28 ; T29 (`useRepos().me`, `seedOutbox`) ; domain (`parseSecretCode`, `formatSecretCode`, `validateUsername`, `validatePassword`, `usernameKey`, `PasswordRejection`) ; contracts (`PRIVACY_POLICY_VERSION`, `ApiErrorCode`, `Role`).
- Produces : Interfaces partagées §6 (`PasswordFields`, `checkNewPassword`, `USERNAME_MESSAGES`, `LogoutDialog`, `CreateAccountForm`) et, localement :
```ts
export function isStandalone(win?: Window): boolean;   // matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
export type InstallPlatform = 'ios' | 'android' | 'other'; export function detectPlatform(userAgent: string): InstallPlatform;
export const PASSWORD_MESSAGES: Record<PasswordRejection, string>; export function passwordMessage(reason: PasswordRejection, role: Role): string;
export function invitationErrorMessage(code: ApiErrorCode): string; export function pendingWarning(n: number, username: string): string;
export function InvitePage(): JSX.Element; export function LoginPage(): JSX.Element; export function ResetPage(): JSX.Element;
```

**Spec:** 02 R-ARR-1, R-ARR-2, R-INV-4, R-INV-5, R-INV-8, §3.4, R-CPT-1, R-CPT-2, R-MDP-2, R-AUTH-1, R-AUTH-5, R-AUTH-8, R-AUTH-9, R-RST-1, §15 n°3 et n°5 ; 01 R-SYN-14 ; 03 §13.1, P-AUT-2, P-AUT-6, P-DRT-4.

- [ ] **Step 1: Write the failing test**

```ts
// invite.test.tsx
// accueil : 'appsport est un outil de suivi entre proches', "Ce n'est pas un service médical.", lien 'Confidentialité et règles' → '/privacy'
// installé, lien #abcd-efgh-jkmn-pqrO → check { code: 'ABCDEFGHJKMNPQR0' }, location.hash vidé ; « Date de naissance » readOnly '01/03/2008' ;
//   "Renseignée par l'administrateur. Une erreur ? Préviens-le." ; '4 mots' ; « Créer mon compte » désactivé avant la case « J'ai lu la page Confidentialité et règles » ;
//   accept { code: 'ABCDEFGHJKMNPQR0', username: 'lea', password: 'cheval agrafe batterie correcte', termsVersion: '1.0' } → location '/onboarding'
// navigateur iPhone → "Sur l'écran d'accueil" ; Android → "Installer l'application" ; code 'ABCD-EFGH-JKMN-PQRS' + « Copier », aucun formulaire ni requête ;
//   « Continuer dans ce navigateur » → "sur téléphone, tes données ne seront pas dans l'appli installée" puis le formulaire
// codes : invitation_expired « Cette invitation a expiré. », invitation_used « Cette invitation a déjà été utilisée. », invitation_revoked « Cette invitation a été révoquée. »,
//   invitation_unknown « Ce code est inconnu. », chacun suivi de « Demande un nouveau code à l'administrateur. » (role alert)
// 'ABC' → « Code incomplet » sans requête ; lien complet collé → check { code: 'ABCDEFGHJKMNPQRS' }
// 11 caractères → « 12 caractères au moins. » sans requête ; confirmation différente → « Les deux mots de passe ne correspondent pas. » ;
//   mot de passe avec le pseudo → PASSWORD_MESSAGES.contains_username ; 409 username_taken → « Ce pseudo est déjà pris. », formulaire gardé
// login.test.tsx : 401 → « Pseudo ou mot de passe incorrect » ; 403 account_disabled → « Compte désactivé, contacte l'administrateur » ;
//   autre pseudo avec 2 ops en attente → dialog '2 éléments non envoyés de lea seront effacés de cet appareil' ; Annuler → aucune requête ; Continuer → '/' et outbox vide ;
//   même pseudo en casse différente → pas de dialog, outbox gardée ; ?reason=account_deleted → 'Ce compte a été supprimé' ;
//   connexion unauthenticated → « Ta session a expiré. Reconnecte-toi. »
// logout-reset.test.tsx : LogoutDialog current avec 3 ops → pendingWarning(3, 'lea'), « Exporter mes données » (/profile/privacy), « Annuler », « Se déconnecter quand même » ;
//   confirmation → POST /api/auth/logout {}, outbox vide, meta.me absente, location '/login' ; sans op → « Se déconnecter de cet appareil ? » et « Se déconnecter » ;
//   mode all → /api/auth/logout-all ; hors ligne → alerte 'Nécessite le réseau', outbox intacte
// ResetPage #abcd-efgh-jkmn-pqrs → check { code: 'ABCDEFGHJKMNPQRS' }, « Nouveau mot de passe pour lea » ; reset { code, newPassword } → '/' ;
//   reset_invalid → « Ce lien n'est plus valable. Demande un nouveau lien à l'administrateur. »
// messages.test.ts
expect(pendingWarning(1, 'lea')).toBe('1 élément non envoyé de lea sera effacé de cet appareil');
expect(pendingWarning(2, 'lea')).toBe('2 éléments non envoyés de lea seront effacés de cet appareil');
// detectPlatform : iPhone → 'ios', Android → 'android', Windows → 'other' ; passwordMessage('too_short','admin') = '14 caractères au moins.' ;
// checkNewPassword({ password: 'a'.repeat(12), confirm: 'a'.repeat(12), username: 'lea', role: 'member' }) = PASSWORD_MESSAGES.single_char
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- auth/` → modules introuvables, routes en `NotFound`.

- [ ] **Step 3: Implement**

Textes exacts : accueil « appsport est un outil de suivi entre proches, hébergé chez ${OWNER_FIRST_NAME}. Ce n'est pas un service médical. » ; iOS « Sur iPhone : touche Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite appsport depuis l'écran d'accueil et colle le code. » ; Android « Sur Android : ouvre le menu ⋮ puis « Installer l'application ». » (autre plateforme : les deux) ; `Banner` warning « Attention : sur téléphone, tes données ne seront pas dans l'appli installée. » ; `rate_limited` (invitation) « Trop d'essais depuis cet appareil. » ; code illisible « Code incomplet : il faut 16 caractères. » ; aide de `PasswordFields` « Astuce : une phrase de 4 mots ou plus, par exemple « cheval agrafe batterie correcte », est facile à retenir et solide. Les espaces sont acceptés. » ; connexion `rate_limited` « Trop de tentatives. Réessaie dans N min. » (N arrondi au supérieur). Le fragment `#code` est lu puis effacé par `history.replaceState` ; avec un fragment, la vérification part seule (mode installé ou après « Continuer dans ce navigateur »). `CreateAccountForm` contrôle localement (`validateUsername`, `checkNewPassword`) avant tout envoi ; `password_rejected` et `username_invalid` lisent `body.reason`. `LoginPage` avertit si `pending > 0` et `usernameKey(saisi) !== usernameKey(owner.username)`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- auth/` → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(auth): écrans d'invitation, de connexion, de réinitialisation et de déconnexion"`

---

### Task 31: Onboarding en 8 écrans et choix du lieu (salle ou maison)

**Files:**
- Create: `apps/web/src/features/onboarding/{OnboardingFlow.tsx, GoalStep.tsx, SportStep.tsx, PlaceKindStep.tsx, PlaceStep.tsx, ExperienceStep.tsx, AvailabilityStep.tsx, HealthStep.tsx, ReadyStep.tsx, onboarding.module.css}`, `apps/web/src/features/places/{GymPicker.tsx, GymCreate.tsx, EquipmentChecklist.tsx, places.module.css}`, `apps/web/src/app-events.ts`
- Modify: `apps/web/src/App.tsx` (`/onboarding`, hors `AppShell`)
- Test: `apps/web/test/onboarding/{flow,steps,health-step,ready-step}.test.tsx`, `apps/web/test/places/gym-picker.test.tsx`

**Interfaces:**
- Consumes : T28 ; T29 (`useRepos`, `useReadiness`, `OfflineReadyIndicator`, `seedMirror`) ; domain (`firstIncompleteStep`) ; contracts (`ONBOARDING_STEPS`, `GOAL_LABELS`, `EXPERIENCE_LABELS`, `SPORTS`, `EQUIPMENT`, `EQUIPMENT_CATEGORIES`, `EQUIPMENT_LABELS`, `EQUIPMENT_PRESETS`, `HEALTH_CONSENT_TEXT`, `HEALTH_QUESTIONNAIRE`, `BODY_AREA_LABELS`, `LIMITATION_SIDE_LABELS`, `LIMITATION_SEVERITY_LABELS`).
- Produces : Interfaces partagées §6 (`ONBOARDING_COMPLETED_EVENT`, `StepProps`, `GoalStep`, `SportStep`, `ExperienceStep`, `AvailabilityStep`, `HealthConsentPanel`, `ScreeningQuestions`, `LimitationsEditor`, `CautiousModeToggle`, `EquipmentChecklist`, `GymPicker`) et, localement :
```ts
export function OnboardingFlow(): JSX.Element;   // « Étape n/8 » ; conteneur data-testid="onboarding-step" data-step=<OnboardingStep>
export function PlaceKindStep(p: StepProps & { value: 'gym' | 'home' | null; onChange(k: 'gym' | 'home'): void }): JSX.Element;
export function PlaceStep(p: StepProps & { kind: 'gym' | 'home' }): JSX.Element; export function HealthStep(p: StepProps): JSX.Element; export function ReadyStep(p: { onBack(): void }): JSX.Element;
export function sortEquipment(codes: Iterable<EquipmentCode>): EquipmentCode[];   // ordre de EQUIPMENT
export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string>;   // « Objets du quotidien », « Petit matériel », « Bancs et supports », « Charges libres », « Poulies et machines »
export function GymCreate(p: { isPrimary: boolean; visibleAtGym: boolean; onDone(): void; onPickExisting(gymId: string): void }): JSX.Element;
```

**Spec:** 02 R-ONB-1 à R-ONB-3, §8 E1 à E8, R-CPT-2, §10.2 R-MAT-2, R-SAL-1 à R-SAL-3, R-VIS-3, §12 E7 (R-CST-2, R-CST-7), §15 n°11 ; 04 R-EQ-3 ; 03 P-MIN-6, P-CST-1, P-CST-2, §13.2 ; 01 R-SYN-33.

- [ ] **Step 1: Write the failing test**

```ts
// flow.test.tsx : départ 'goal' et « Étape 1/8 » ; reprise à firstIncompleteStep(…) ; « Prendre du muscle » + « Suivant » → PATCH { goal: 'muscle', onboardingStep: 'goal' },
//   data-step 'sport' et « Étape 2/8 » ; « Retour » → 'goal' avec la réponse cochée ; étape 'place' sans type connu → 'place_kind' ; hors ligne → alerte, reste sur 'goal'
// steps.test.tsx
// GoalStep mineur : pas de « Perdre du gras », 4 options ; adulte : « Prendre du muscle », « Gagner en force », « Perdre du gras », « Forme et santé », « Me renforcer pour mon sport » ;
//   « Suivant » désactivé sans choix ; mode edit → « Enregistrer » et PATCH { goal: 'strength' } sans onboardingStep
// SportStep avec goal sport_support : « Non » désactivé, « Oui » coché, « Obligatoire avec l'objectif « Me renforcer pour mon sport ». » ;
//   « Autre » + 'Pétanque' → { sportCode: 'other', sportOtherLabel: 'Pétanque', onboardingStep: 'sport' }, maxLength 40, 15 libellés ; « Non » → { sportCode: null, sportOtherLabel: null, onboardingStep: 'sport' }
// PlaceKindStep : « Où t'entraîneras-tu le plus souvent ? », « À la salle », « À la maison » → { onboardingStep: 'place_kind' }
// PlaceStep maison : nom 'Maison', préréglage home_none, « Objets du quotidien » avec chair et table cochés ; « Petit matériel » coche dumbbells ;
//   Suivant → POST /api/places { kind: 'home', name: 'Maison', equipment: EQUIPMENT.filter((c) => EQUIPMENT_PRESETS.home_small.codes.includes(c)), isPrimary: true } puis { onboardingStep: 'place' }
// PlaceStep avec lieu principal existant → « Ton lieu principal : Basic Fit », aucun POST
// ExperienceStep : « Depuis combien de temps fais-tu de la musculation régulièrement (au moins une fois par semaine) ? » ; « 6 mois à 2 ans » → { experience: '6_to_24_months', onboardingStep: 'experience' }
// AvailabilityStep : 2/3/4 séances, 30/45/60/75/90 min ; 3 et 60 → { daysPerWeek: 3, sessionMinutes: 60, onboardingStep: 'availability' }
// gym-picker.test.tsx : « Basic Fit · Lyon · 2 membres visibles » ; 'bas' → GET /api/gyms?q=bas ; case « Apparaître dans « Qui va à cette salle » » cochée si defaultVisible,
//   sinon décochée avec « Désactivé par défaut pour les moins de 18 ans. » ; Valider → POST /api/places { kind: 'gym', gymId: 'g-1', isPrimary: true, visibleAtGym: false } puis onDone
// « Ma salle n'est pas dans la liste » : 'Basic-Fit' / 'Lyon' → GET /api/gyms/similar?name=Basic-Fit&city=Lyon, « Ces salles existent peut-être déjà : », « C'est ma salle », « Non, créer ma salle » ;
//   préréglages gym_large, gym_small, gym_crossfit, gym_other ; « Petite salle de quartier » coche les 12 codes, pas d'« Objets du quotidien » ;
//   Valider → POST /api/gyms { name: 'Basic-Fit', city: 'Lyon', equipment: sortEquipment(EQUIPMENT_PRESETS.gym_small.codes), isPrimary: true, visibleAtGym: true }
// 409 gym_duplicate → « Cette salle existe déjà. » + « Choisir cette salle » → POST /api/places gymId 'g-1' ; nom d'un caractère → « 2 à 60 caractères. » sans requête
// EquipmentChecklist gym → 4 groupes ; home → 5 ; cocher « Kettlebell » → onChange trié avec kettlebell
// health-step.test.tsx : sans accord : HEALTH_CONSENT_TEXT.text, case décochée, « J'accepte et je renseigne » désactivé ; « Passer » → 4 questions et
//   « Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer », aucune requête (auto-vérification, P-CST-2) ;
//   « Je préfère une progression plus prudente » → PATCH { cautiousMode: true, onboardingStep: 'health' }
// avec accord : POST /api/me/consents { type: 'health', textVersion: '1.0' } ; Oui à Q1 + « Enregistrer mes réponses » → PUT { answers: [true,false,false,false], questionnaireVersion: '1.0' } ;
//   { caution: true } → « Nous te recommandons de consulter un médecin avant de commencer. » ; limitations : « aucun diagnostic n'est nécessaire », « Aucune »,
//   « Ajouter une limitation » → POST { bodyArea: 'knee', side: 'left', severity: 'mild', note: 'entorse ancienne' }, note maxLength 200
// mineur : interrupteur coché et désactivé, « Imposé jusqu'à 18 ans » ; HEALTH_WARNING_TEXT affiché ; « Suivant » actif sans réponse
// ready-step.test.tsx : tout prêt → récapitulatif « Prendre du muscle », « 3 séances de 45 min », « Basic Fit », « Jamais » ; offline-ready 'ready' ; « Commencer » actif ;
//   clic → POST /api/me/onboarding/complete, location '/', ONBOARDING_COMPLETED_EVENT émis une fois ; pull il y a 25 h → « Commencer » désactivé, « Réessayer » → triggers 'manual' ;
//   409 onboarding_incomplete → retour au premier écran incomplet
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- onboarding/ places/gym-picker` → modules introuvables.

- [ ] **Step 3: Implement**

`OnboardingFlow` : départ `firstIncompleteStep(await repos.profile.onboardingInput())` (`place` sans type connu → `place_kind`) ; chaque écran enregistre par `repos.profile.update({ …, onboardingStep })` en mode `onboarding`. `PlaceStep` : salle → `<GymPicker isPrimary defaultVisible={me.ageBand !== 'minor'}>` ; maison → « Nom du lieu » (`maxLength` 30), préréglages `home_none`, `home_small`, `home_gym`, `EquipmentChecklist kind="home"` précochée (changer de préréglage recoche). `GymCreate` : nom et ville, puis `gyms.similar`, puis préréglage `gym_*`, puis liste précochée. `EquipmentChecklist` : un `<fieldset>` par catégorie, `household` exclu pour une salle. `HealthStep` : accord actif → `ScreeningQuestions record` et `LimitationsEditor` ; sinon `HealthConsentPanel` (« Passer » → `ScreeningQuestions record={false}`) ; toujours `CautiousModeToggle`, `HealthWarning`, « Suivant ». `ReadyStep` : « Commencer » désactivé tant que `!readiness.ready` ; succès → `window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETED_EVENT))` puis `navigate('/')`.

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(web): onboarding en 8 écrans et choix de la salle ou de la maison"`

---

### Task 32: Profil, lieux et fiche de salle

**Files:**
- Create: `apps/web/src/features/profile/{ProfilePage.tsx, profile.module.css}`, `apps/web/src/features/places/{PlacesPage.tsx, PlaceDetail.tsx, GymPage.tsx}`
- Modify: `apps/web/src/App.tsx` (`/profile`, `/profile/places`, `/profile/places/:id`, `/gyms/:id`, dans `AppShell`)
- Test: `apps/web/test/profile/profile-page.test.tsx`, `apps/web/test/places/{places-page,gym-page}.test.tsx`

**Interfaces:**
- Consumes : T28 ; T29 (`useRepos`, `useLive`, `seedMirror`) ; T30 (`LogoutDialog`, `PasswordFields`, `checkNewPassword`, `USERNAME_MESSAGES`) ; T31 (`GoalStep`, `SportStep`, `ExperienceStep`, `AvailabilityStep`, `StepProps`, `GymPicker`, `EquipmentChecklist`, `CautiousModeToggle`) ; contracts (`GOAL_LABELS`, `EXPERIENCE_LABELS`, `EQUIPMENT_LABELS`, `EQUIPMENT_PRESETS`, `GymDetail`).
- Produces :
```ts
export function ProfilePage(): JSX.Element; export function PlacesPage(): JSX.Element;
export function PlaceDetail(p: { params: { id: string } }): JSX.Element; export function GymPage(p: { params: { id: string } }): JSX.Element;
export const GYM_HISTORY_LIMIT = 10;
export function historyLine(h: GymDetail['history'][number]): string;   // « 06/10/2026 à 14:05 — Matériel ajouté : Kettlebell — modifié par lea » | « … — ancien membre »
```

**Spec:** 02 §11 (Compte, Entraînement, Lieux), §1 principe 4, R-ONB-3, R-CPT-3, R-MDP-1, R-MDP-6, R-AUTH-7, R-SAL-1 à R-SAL-4, R-SAL-6, R-LIEU-1 à R-LIEU-4, R-VIS-1 à R-VIS-4, R-CHG-3, §15 n°15 et n°17.

- [ ] **Step 1: Write the failing test**

```ts
// profile-page.test.tsx : « Pseudo » 'lea' ; « Date de naissance » readOnly '01/01/1990' ; « Enregistrer le pseudo » → PATCH /api/me { username: 'leo' } ;
//   hors ligne → alerte 'Nécessite le réseau' ; 409 username_taken → « Ce pseudo est déjà pris. »
// mot de passe : « Mot de passe actuel », « Nouveau mot de passe », « Confirmation », « Changer le mot de passe » →
//   POST /api/auth/password { currentPassword: 'ancien mot de passe ok', newPassword: 'cheval agrafe batterie correcte' } →
//   « Mot de passe changé. Tes autres appareils ont été déconnectés. » ; 401 → « Mot de passe actuel incorrect. »
// mustChangePassword admin → Banner « Ton mot de passe doit être changé avant de continuer (14 caractères au moins pour un administrateur). », seule la section mot de passe
// « Déconnecter tous mes appareils » → LogoutDialog all (POST /api/auth/logout-all) ; « Se déconnecter » → LogoutDialog current
// Entraînement : « Prendre du muscle », « Jamais », « 3 séances de 45 min » ; « Modifier l'objectif » → GoalStep edit, PATCH { goal: 'strength' } ; mode prudent → PATCH { cautiousMode: true }
// liens « Lieux » /profile/places, « Santé » /profile/health, « Confidentialité » /profile/privacy, « Réglages » /settings
// places-page.test.tsx (p-1 salle 'Basic Fit' principale visible, p-2 maison 'Garage') : 'Basic Fit' avec badge « Principal » puis 'Garage' ;
//   « Définir comme principal » p-2 → PATCH { isPrimary: true } ; renommer → PATCH { name: 'Cave' }, maxLength 30 ; « Visible à la salle » décoché p-1 → PATCH { visibleAtGym: false } ;
//   « Supprimer » p-2 → DELETE {} ; p-1 → choix « Nouveau lieu principal » 'Garage' → DELETE { newPrimaryId: 'p-2' } ;
//   un seul lieu → « Supprimer » désactivé et « Tu dois garder au moins un lieu. » (même message sur 409 last_place) ;
//   « Ajouter une salle » → GymPicker (isPrimary false, defaultVisible true pour un adulte) ; « Ajouter une maison » → POST { kind: 'home', name: 'Garage 2', equipment: […], isPrimary: false }
//   PlaceDetail maison : cocher « Haltères fixes ou réglables » → PUT /api/places/p-2/equipment/dumbbells {} ; décocher « Chaise ou banc stable » → DELETE …/chair ;
//   PlaceDetail salle : lien « Voir la salle » → /gyms/g-1, aucune case
// gym-page.test.tsx : titre 'Basic Fit', 'Lyon', 'Barre droite et disques' ; liste « Qui va à cette salle » ['lea','max'] ;
//   « Dernières modifications » : 10 éléments, le 1er 'ancien membre', le 2e 'modifié par lea' et 'Matériel ajouté : Barre droite et disques'
// canEdit : « Modifier » 'Basic Fit Part-Dieu' → PATCH { name } ; « Kettlebell » → PUT …/kettlebell ; « Banc plat » décoché → DELETE …/flat_bench
// !canEdit : ni « Modifier » ni case, « Seuls les membres qui ont cette salle parmi leurs lieux peuvent la modifier. » ; visibleMembers [] → « Personne n'est visible pour l'instant. »
// hors ligne : Banner « Hors ligne : dernière version connue. », nom et matériel du miroir, aucune case cochable
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- profile/ places/places-page places/gym-page` → modules introuvables.

- [ ] **Step 3: Implement**

Date de naissance accompagnée de « Seul l'administrateur peut la corriger. » ; « Modifier … » rend l'écran d'onboarding en `mode="edit"` ; `last_place` et `primary_required` surchargés (« Tu dois garder au moins un lieu. », « Choisis d'abord un nouveau lieu principal. ») ; libellés d'historique : `create` « Création de la salle », `update_info` « Nom ou ville modifiés », `add_equipment` « Matériel ajouté : <libellé> », `remove_equipment` « Matériel retiré : <libellé> », `update_load_settings` « Réglages de charge modifiés » ; pas d'édition des réglages de charge (brique 3, R-CHG-3).

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- profile/ places/` → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(salles): profil, lieux et fiche de salle"`

---

### Task 33: Écrans d'administration

**Files:**
- Create: `apps/web/src/features/admin/{MembersPage.tsx, InvitationsPage.tsx, AdminGymsPage.tsx, ServerHealthPage.tsx, AdminNav.tsx, share-message.ts, admin.module.css}`
- Modify: `apps/web/src/App.tsx` (`/admin/members`, `/admin/invitations`, `/admin/gyms`, `/admin/health`)
- Test: `apps/web/test/admin/{members,invitations,gyms-health}.test.tsx`

**Interfaces:**
- Consumes : T28 (dont `formatAge`, `useServices().now`) ; T29 (`useRepos().admin`, `useRepos().gyms.update`) ; contracts (`MemberSummary`, `InvitationSummary`, `OpsStatus`, `OpsStatusResponse`, `INVITATION_NOTE_MAX`).
- Produces :
```ts
export function buildInvitationShareMessage(origin: string, link: string, code: string): string;
// = `1. Installe Tailscale et accepte le partage.\n2. Ouvre ${origin} et installe l'appli.\n3. Dans l'appli, colle ce lien ou tape le code ${code} (valable 7 jours).\n${link}`
export const BACKUP_LATE_MS = 26 * 3_600_000;   // [décision plan] période de 24 h + 2 h de grâce (08 §9)
export const DISK_WARN_PCT = 80;
export function MembersPage(): JSX.Element; export function InvitationsPage(): JSX.Element; export function AdminGymsPage(): JSX.Element;
export function ServerHealthPage(): JSX.Element; export function AdminNav(): JSX.Element;   // Membres · Invitations · Salles · État du serveur
```

**Spec:** 02 §6, R-ROLE-2, R-ROLE-4, R-INV-1 à R-INV-3, R-INV-7, R-INV-9, R-RST-3, R-RST-4, R-ADM-1, R-AGE-4, R-SUP-2, R-SAL-7 ; 08 §9 ; 03 P-ADM-1.

- [ ] **Step 1: Write the failing test**

```ts
// members.test.tsx (u-1 'bastien' admin, u-2 'lea' mineure jamais connectée, onboarding en cours, santé oui)
// ligne lea : 'mineur', 'Jamais connecté', 'Onboarding en cours' ; ligne bastien : '06/10/2026'
// « Lien de réinitialisation » + « Générer » → 'ABCD-EFGH-JKMN-PQRS', « Copier », 'Ce code ne sera plus affiché.' ; « J'ai transmis le lien » → code disparu
// « Fermer les sessions » → POST …/u-2/revoke-sessions {} ; « Désactiver » → …/status { status: 'disabled' } ; « Réactiver » → { status: 'active' }
// « Promouvoir administrateur » + « Ton mot de passe » → …/role { role: 'admin', password: 'mon mot de passe admin' } ; « Rétrograder » u-1 + 409 last_admin → « Il doit rester au moins un administrateur actif. »
// « Corriger la date de naissance » → …/birth-date { birthDate: '2009-02-01' } ; 400 under_min_age → « appsport est réservé aux 16 ans et plus »
// « Supprimer définitivement » désactivé tant que « Tape le pseudo pour confirmer » ≠ 'lea' → …/delete { confirmUsername: 'lea' }
// 403 reset_self_forbidden → « Pour toi-même, utilise la commande admin:reset sur le serveur. » ; liste rechargée après chaque succès ;
// santé et coach affichés en « oui » / « non », aucune autre donnée C1 à C3 ; un membre sur /admin/members → « Page introuvable », aucune requête
// invitations.test.tsx : « Date de naissance » '2009-05-01', « Note (facultative) » 'pour Léa' (maxLength 60), « Créer l’invitation » → POST { birthDate: '2009-05-01', note: 'pour Léa' } ;
//   code affiché ; data-testid share-message = buildInvitationShareMessage(origin, link, code) ; « Partager » → navigator.share({ text: message }) ;
//   sans navigator.share → « Copier le message » ; états « En attente (expire le 13/10/2026) », « Utilisée par lea », « Révoquée », « Expirée » ;
//   « Révoquer » (pending seulement) → POST …/i-1/revoke puis rechargement ; under_min_age → message ; après « J'ai noté le code », code absent
// gyms-health.test.tsx : AdminGymsPage liste GET /api/gyms?q= ; « Modifier » 'Villeurbanne' → PATCH /api/gyms/g-1 { city } ; « Supprimer » → DELETE /api/admin/gyms/g-1 {} ;
//   409 gym_in_use → « Des membres ont encore cette salle parmi leurs lieux : elle ne peut pas être supprimée. »
// ServerHealthPage (now '2026-10-06T12:00:00.000Z', version v1.2.3, OPS de 08 §9) : « Version en service : v1.2.3 » ; « Dernier déploiement : v1.2.3 le 01/10/2026 (réussi) » ;
//   « Dernière sauvegarde : il y a 5 h (réussie) » ; « Dernier test de restauration : 04/10/2026 (réussi) » ; « / : 42 % » ; « /srv/appsport : 81 % (au-delà de 80 %) » ;
//   « Redémarrage nécessaire » ; sauvegarde à 28 h → Banner « Sauvegarde en retard (plus de 26 h) » ; backup.ok false → « (échouée) » et Banner error ;
//   opsStatus null → « Aucun état d'exploitation disponible : les scripts de l'hôte n'ont encore rien écrit. »
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- admin/` → modules introuvables.

- [ ] **Step 3: Implement**

Tableau accessible (une ligne `role="row"` nommée par le pseudo ; rôle « admin »/« membre », dernière connexion `formatDateTime` ou « Jamais connecté », « Onboarding terminé »/« Onboarding en cours », « SMART : OK »/« SMART : problème détecté »). Chaque action passe par une `Dialog` de confirmation et `useAction` ; le code ou le lien n'existe que dans l'état du composant jusqu'à la confirmation de transmission. Retard de sauvegarde si `now − backup.at > BACKUP_LATE_MS` ; disque en alerte si `usedPct > DISK_WARN_PCT`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- admin/` → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(admin): écrans membres, invitations, salles et état du serveur"`

---

### Task 34: Confidentialité, santé, export, suppression, compteurs et rejets

**Files:**
- Create: `apps/web/src/features/privacy/{PrivacySettingsPage.tsx, HealthSection.tsx, ConsentWithdrawDialog.tsx, ExportButton.tsx, DeleteAccountDialog.tsx, HealthReconsentGate.tsx, privacy.module.css}`, `apps/web/src/features/status/{PendingCounter.tsx, ConnectionStatus.tsx, RejectionsPage.tsx, SettingsPage.tsx}`, `apps/web/src/ui/download.ts`
- Modify: `apps/web/src/ui/{AppShell.tsx, index.ts}` (zone d'état : `ConnectionStatus`, `PendingCounter`, `RejectedCounter`), `apps/web/src/App.tsx` (`/profile/health`, `/profile/privacy`, `/settings`, `/rejections` ; `<HealthReconsentGate/>` hors `/onboarding`)
- Test: `apps/web/test/privacy/{withdraw,export-delete,health-section}.test.tsx`, `apps/web/test/status/{counters,rejections-settings}.test.tsx`

**Interfaces:**
- Consumes : T28 ; T29 (`useRepos`, `seedMirror`, `seedOutbox`) ; T25 (`dumpLocalDb`) ; T31 (`HealthConsentPanel`, `ScreeningQuestions`, `LimitationsEditor`, `CautiousModeToggle`) ; domain (`parisDate`) ; contracts (`HEALTH_CONSENT_TEXT`, `PRIVACY_POLICY_VERSION`).
- Produces : `data-testid` `pending-counter`, `rejected-counter`, `connection-status` (Interfaces partagées §6) et :
```ts
export function downloadJson(filename: string, data: unknown): void; export function exportFileName(nowMs: number): string;   // 'appsport-export-AAAA-MM-JJ.json' (Paris)
export function PendingCounter(): JSX.Element; export function RejectedCounter(): JSX.Element; export function ConnectionStatus(): JSX.Element;
export const CONNECTION_LABELS: Record<ConnectionState, string>; export const REJECTION_CODE_LABELS: Record<string, string>;
export function RejectionsPage(): JSX.Element; export function SettingsPage(): JSX.Element; export function PrivacySettingsPage(): JSX.Element; export function HealthSection(): JSX.Element;
export function ConsentWithdrawDialog(p: { open: boolean; onClose(): void; onWithdrawn?(): void }): JSX.Element | null;
export function ExportButton(p: { label?: string /* 'Télécharger mes données' */ }): JSX.Element;
export function DeleteAccountDialog(p: { open: boolean; onClose(): void }): JSX.Element | null; export function HealthReconsentGate(): JSX.Element | null;
```

**Spec:** 01 R-SYN-18, R-SYN-30, R-SYN-31, R-SYN-34 ; 02 §11, R-CST-4 à R-CST-6, R-EXP-1, R-SUP-1, R-SUP-4, R-SUP-5 ; 03 P-CST-1, P-CST-3, P-CST-4, P-DRT-1, P-DRT-4, P-DRT-6, §17 n°4 et n°9.

- [ ] **Step 1: Write the failing test**

```ts
// counters.test.tsx
it.each([['online', 'En ligne'], ['offline', 'Hors ligne'], ['unknown', 'Connexion…'], ['unauthenticated', 'Session expirée'],
  ['protocol_unsupported', 'Mise à jour nécessaire'], ['account_deleted', 'Compte supprimé']])('connection-status %s', /* data-state et texte exacts */);
// pending-counter : data-count '0' puis '3' après sync.set({ pending: 3 }), texte '3 en attente'
// rejected-counter : un sync_rejection non ignoré → data-count '1', lien '/rejections'
// rejections-settings.test.tsx : r-1 (validation) et deadletter op-7 (parent_rejected) → « Données invalides » et « Élément parent refusé » ;
//   « Ignorer » r-1 → op patch { dismissedAt: '2026-10-06T12:00:00.000Z' }, élément retiré, rejected-counter '1' ; aucun → « Aucun refus. »
// /settings : persistGranted true → « Stockage persistant : accordé » ; false → « Stockage persistant : refusé » et « Ton navigateur peut effacer les données de l'appli
//   si l'espace manque. Pense à télécharger tes données régulièrement. » (lien /profile/privacy) ; absent → « Stockage persistant : pas encore demandé »
// withdraw.test.tsx : « Retirer mon accord santé » → dialog avec 'indicateur de prudence', 'limitations et zones sensibles', 'Le mode prudent est conservé.',
//   « Télécharger mes données d’abord » ; « Retirer mon accord » désactivé sans mot de passe ; POST withdraw { type: 'health', password } → 200 MeResponse →
//   « Accord retiré. Tes données de santé ont été effacées. » ; dumpLocalDb sans 'TEMOIN-C2' ; 401 → « Mot de passe incorrect. », miroir intact ; hors ligne → 'Nécessite le réseau', rien purgé
// HealthReconsentGate : textVersion '0.9' → dialog « Le texte de l'accord santé a changé », HEALTH_CONSENT_TEXT.text, case décochée ;
//   « J'accepte » → POST /api/me/consents { type: 'health', textVersion: '1.0' } ; « Je refuse » → ConsentWithdrawDialog ; '1.0' ou inactif → rien
// export-delete.test.tsx : 2 ops en attente → status « 2 éléments ne sont pas encore envoyés au serveur : ils ne figureront pas dans l'export. », aucune requête ;
//   « Exporter quand même » → <a download='appsport-export-2026-10-06.json'> cliqué une fois, createObjectURL appelé ; file vide → téléchargement au premier clic
// « Supprimer mon compte » → DeleteAccountDialog avec le texte de liste et la mention P-DRT-6 ; « Supprimer définitivement » désactivé sans mot de passe ;
//   POST /api/me/delete { password } → outbox vide, meta.me absente, location '/login?reason=account_deleted', « Ce compte a été supprimé » ;
//   409 last_admin → « Tu es le dernier administrateur : nomme d'abord un autre administrateur. », rien effacé ;
//   GET /api/me → 410 account_deleted (autre appareil) → base vidée outbox comprise, redirection ; 410 watermark_expired → rien effacé
// health-section.test.tsx : sans accord → HealthConsentPanel puis ScreeningQuestions ; avec accord → « Dernière réponse le 01/10/2026 », « Genou · gauche · légère »,
//   « Supprimer » → DELETE /api/me/limitations/l-1 {}, « Modifier » → PATCH ; 403 health_consent_required → « Cette action demande ton accord santé. » ;
//   CautiousModeToggle → PATCH { cautiousMode: false }, désactivé pour un mineur
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- privacy/ status/counters status/rejections-settings` → modules et `data-testid` introuvables.

- [ ] **Step 3: Implement**

Textes exacts : `REJECTION_CODE_LABELS` `validation` « Données invalides », `forbidden` « Action non autorisée », `parent_rejected` « Élément parent refusé », `stale_revision` « Version périmée », `unknown_entity` « Type de donnée inconnu », `protocol` « Version de l'appli trop ancienne » (repli : le code) ; retrait « Seront effacés : ton indicateur de prudence (questionnaire), tes limitations et zones sensibles, et toute donnée de santé enregistrée par l'appli (douleurs, pesées, suivi nutritionnel). Le mode prudent est conservé. » ; suppression « Ton compte, ton profil, tes lieux, tes données de santé et l'historique de tes accords seront supprimés. Les salles restent : tu y apparaîtras comme « ancien membre ». Le journal de sécurité est gardé 12 mois et les sauvegardes 30 jours au plus. » et (P-DRT-6) « Si tu as utilisé le coach, appsport ne peut pas faire effacer tes échanges chez Anthropic : ils y sont effacés sous 30 jours, ou gardés jusqu'à 2 ans si ses filtres de sécurité en ont signalé un. » ; Confidentialité : « Version en vigueur : 1.0 », « Lire la page Confidentialité et règles », accord santé « Donné le <date> » ou « Non donné », accord coach « Non donné ». `RejectedCounter` lit `useLive(() => repos.rejections.count())`. `downloadJson` : `Blob` JSON indenté, `<a download>` cliqué puis retiré, `revokeObjectURL`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- privacy/ status/`, puis `pnpm --filter @appsport/web test`, `pnpm lint`, `pnpm typecheck` → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(privacy): confidentialité, accord santé, export, suppression, compteurs et rejets"`
