### Task 35: ADR du service worker, manifeste de précache, manifeste PWA et service statique

**Files:**
- Create: `docs/adr/0001-service-worker-maison.md`, `apps/web/src/sw/precache-manifest.ts`, `apps/web/vite-plugin-precache.ts`, `apps/web/public/manifest.webmanifest`, `apps/web/scripts/make-icons.mjs`, `apps/web/public/icons/{icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon-180.png}` (générées puis versionnées), `apps/server/src/static.ts`
- Modify: `apps/web/vite.config.ts` (`precachePlugin()`), `apps/web/index.html` (manifeste, icône Apple, `theme-color`), `apps/web/package.json` (`build: "vite build"`, dev `esbuild`), `package.json` racine (`build: "pnpm --filter @appsport/web build"`), `apps/server/src/routes.ts` (`mountWebApp(app, deps)` en dernier), `apps/server/src/http/security-headers.ts` (ne remplace pas une CSP déjà posée)
- Test: `apps/web/test/pwa/{precache-plugin,manifest}.test.ts`, `apps/server/test/static/static.test.ts`

**Interfaces:**
- Consumes : T6 (`createTestContext`, `AppConfig.publicDir`, `AppConfig.contentDir`, `httpError`, `mountRoutes`) ; T23 (`ILLUSTRATION_FILE_RE`).
- Produces : Interfaces partagées §7 (`PrecacheManifest`, `PRECACHE_GLOBAL`, `precachePlugin`, `mountWebApp`) et :
```ts
// apps/web/vite-plugin-precache.ts
export function computeBuildHash(files: readonly { path: string; content: Uint8Array }[]): string;   // 12 hex
export async function listPrecacheFiles(distDir: string): Promise<{ path: string; content: Uint8Array }[]>;   // sans /sw.js ni *.map, triés
export async function generateServiceWorker(o: { distDir: string; swCode: string }): Promise<PrecacheManifest>;   // écrit distDir/sw.js
export async function bundleServiceWorker(entry: string): Promise<string>;   // esbuild iife, es2022, minifié, write:false
// apps/server/src/static.ts
export const ILLUSTRATION_CSP = "default-src 'none'; style-src 'unsafe-inline'";
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
export function cacheControlFor(pathname: string): string;   // '/assets/…' → IMMUTABLE_CACHE ; sinon 'no-cache'
```

**Spec:** 01 R-PWA-1, §2 (service worker), §10.3 (ADR avant le SW) ; 04 §12 « Import et service » ; 03 P-LOG-4 ; 02 §3.1, R-ARR-1 ; Global Constraints « En-têtes HTTP » et « PWA ».

- [ ] **Step 1: Write the failing test**

```ts
// precache-plugin.test.ts (// @vitest-environment node) — dist factice : index.html, assets/index-abc123.js(+.map), manifest.webmanifest, icons/icon-192.png, ancien sw.js
expect(m.files).toEqual(['/assets/index-abc123.js', '/icons/icon-192.png', '/index.html', '/manifest.webmanifest']); expect(m.buildHash).toMatch(/^[0-9a-f]{12}$/);
expect(sw.split('\n')[0]).toBe(`self.__APPSPORT_PRECACHE__ = ${JSON.stringify(m)};`);   // suivi du code du SW
// régénération → même buildHash ; un octet changé → buildHash différent ; computeBuildHash indépendant de l'ordre ;
// [('/a','ab'),('/b','')] ≠ [('/a','a'),('/b','b')] ; bundleServiceWorker → contient 'MARQUEUR_SW', sans /\bexport\b/ ; precachePlugin() { name: 'appsport-precache', apply: 'build' }
// manifest.test.ts
expect(m).toMatchObject({ name: 'appsport', short_name: 'appsport', display: 'standalone', start_url: '/', scope: '/', lang: 'fr' });
// icônes : /icons/icon-192.png 192x192 any, /icons/icon-512.png 512x512 any, /icons/icon-maskable-512.png 512x512 maskable ; les 4 PNG ont la bonne taille (IHDR)
// index.html contient '<link rel="manifest" href="/manifest.webmanifest">' et '<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">', aucun script en ligne ni http(s)://
// static.test.ts (publicDir et contentDir temporaires, illustration contentDir/illustrations/files/squat-start.svg > 1 Kio, HASH8 = sha256(contenu)[0..8])
// '/' et '/index.html' : 200, 'text/html; charset=utf-8', 'no-cache', CSP globale de T6
// '/sw.js' : 'text/javascript; charset=utf-8', 'no-cache' ; '/manifest.webmanifest' : 'application/manifest+json', 'no-cache'
// '/assets/index-abc123.js' : IMMUTABLE_CACHE
// `/illustrations/squat-start.${HASH8}.svg` : 'image/svg+xml', IMMUTABLE_CACHE, nosniff, CSP ILLUSTRATION_CSP ; gzip si Accept-Encoding: gzip
// 404 : '/illustrations/squat-start.00000000.svg', '/illustrations/absent.12345678.svg', '/illustrations/..%2f..%2fsecret.svg', '/illustrations/squat-start.svg',
//   '/assets/missing-zzz.js', '/..%2f..%2fpackage.json'
// repli SPA (200, no-cache, index.html) : '/profile/places/abc', '/invite', '/admin/members' ; /api/nope en GET et POST → 404 { error: 'not_found' } ; /api/health → 200 JSON
// publicDir sans index.html : '/profile' → 404
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- precache-plugin manifest` et `pnpm --filter @appsport/server test -- static` → `Failed to resolve import "../../vite-plugin-precache"`, `ENOENT … manifest.webmanifest`, `Failed to resolve import "../../src/static"`.

- [ ] **Step 3: Implement**

- ADR (« Acceptée », 2026-10-06) : vite-plugin-pwa gelé et Workbox implicite (skipWaiting, navigation preload) contraires à R-PWA-2 à R-PWA-6 → SW maison (~150 lignes) + mini-plugin Vite ; repli : `injectManifest` de vite-plugin-pwa en gardant `sw.ts`, si un défaut de précache n'est pas corrigé en une demi-journée ou si Background Sync devient nécessaire.
- Hachage du build :
```ts
const h = createHash('sha256');
for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
  h.update(f.path); h.update('\0'); h.update(String(f.content.byteLength)); h.update('\0'); h.update(f.content); }
return h.digest('hex').slice(0, 12);
```
- `manifest.webmanifest` : `description` « Suivi de musculation entre proches », `dir` « ltr », `orientation` « portrait », **[décision plan]** `background_color` `#ffffff`, `theme_color` `#0f766e` ; `make-icons.mjs` (Node seul, PNG par `node:zlib`) : fond `#0f766e`, haltère blanc de trois rectangles, zone sûre de 80 % pour l'icône maskable. `index.html` : `<meta name="theme-color" content="#0f766e">`.
- `mountWebApp`, dans l'ordre : `app.all('/api/*')` → `not_found` ; `/illustrations/:file` (compression, `ILLUSTRATION_FILE_RE`, lecture de `contentDir/illustrations/files/<id>.<ext>`, empreinte comparée au `hash8` demandé, empreintes en mémoire) ; puis `publicDir` lu par `fs/promises` (chemin résolu restant sous `publicDir`, `'/'` → `index.html`, `cacheControlFor`, types MIME usuels ; fichier absent sans extension → `index.html` en `no-cache`, sinon 404).

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes → `Test Files 2 passed` et `1 passed` ; `pnpm build` → la première ligne de `apps/web/dist/sw.js` commence par `self.__APPSPORT_PRECACHE__ = {"buildHash":"` ; `pnpm lint && pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(pwa): manifeste de précache, manifeste PWA, service statique et ADR du service worker"`

---

### Task 36: Service worker maison (coquille, illustrations, messages, interrupteur côté SW)

**Files:**
- Create: `apps/web/src/sw/sw.ts`, `apps/web/test/support/fake-sw-scope.ts`
- Test: `apps/web/test/sw/{sw-pure,sw-handlers}.test.ts`

**Interfaces:**
- Consumes : T35 (`PrecacheManifest`, `PRECACHE_GLOBAL`) ; T29 (`PageToSw`, `SwStatus`, import de type) ; `SYNC_TIMEOUT_MS` (test seulement).
- Produces : Interfaces partagées §7 (`SHELL_CACHE_PREFIX`, `ILLUSTRATIONS_CACHE`) et :
```ts
export const NAVIGATION_TIMEOUT_MS = 4000;   // littéral : contracts n'est pas embarqué dans le SW
export const REFERENCED_ILLUSTRATIONS_KEY = '/__sw/illustrations-referenced.json';
export type SwRequest = { url: string; method: string; mode: string };
export interface SwWindowClient { url: string; navigate(url: string): Promise<unknown> }
export interface SwScope { origin: string; caches: CacheStorage; fetch(input: SwRequest | string, init?: RequestInit): Promise<Response>;
  skipWaiting(): Promise<void>; claimClients(): Promise<void>; unregister(): Promise<boolean>; windowClients(): Promise<readonly SwWindowClient[]> }
export interface SwHandlers { install(): Promise<void>; activate(): Promise<void>; handleFetch(r: SwRequest): Promise<Response> | null /* null = pas de respondWith */;
  handleMessage(msg: PageToSw, port: MessagePort | null): Promise<void>; status(): Promise<SwStatus>; syncIllustrations(files: readonly string[]): Promise<void>; checkKillSwitch(): Promise<boolean> }
export function cachesToDelete(names: readonly string[], buildHash: string): string[];
export function planIllustrationSync(referenced: readonly string[], cached: readonly string[]): { toFetch: string[]; toDelete: string[] };
export function createSwHandlers(scope: SwScope, manifest: PrecacheManifest, opts?: { navigationTimeoutMs?: number }): SwHandlers;
export interface SwGlobalLike { /* caches, fetch, skipWaiting, clients.claim/matchAll, registration.unregister, location.origin, addEventListener, [PRECACHE_GLOBAL] */ }
export function installServiceWorker(g: SwGlobalLike, manifest: PrecacheManifest): void;
// test/support/fake-sw-scope.ts
export function createFakeCacheStorage(): CacheStorage;
export interface FakeSwScope extends SwScope { setNetwork(fn: (url: string, init?: RequestInit) => Promise<Response>): void; fetchLog: string[];
  skipWaitingCalls: number; claimCalls: number; unregistered: boolean; navigations: string[] }
export function createFakeSwScope(o?: { origin?: string /* 'https://appsport.test' */; caches?: CacheStorage; clientUrls?: string[] }): FakeSwScope;
export function staticNetwork(files: Record<string, string>): (url: string) => Promise<Response>;   // pathname → 200, sinon 404
```

**Spec:** 01 R-PWA-1, R-PWA-4, R-PWA-6 (étapes 1 à 3 côté SW), R-SYN-30, R-SYN-32, R-SYN-33 (conditions 1 et 3) ; 04 §11 ; Review Focus 5.

- [ ] **Step 1: Write the failing test**

```ts
// sw-pure.test.ts
expect([SHELL_CACHE_PREFIX, ILLUSTRATIONS_CACHE, NAVIGATION_TIMEOUT_MS]).toEqual(['shell-', 'illustrations-v1', SYNC_TIMEOUT_MS]);
expect(cachesToDelete(['shell-aaaaaaaaaaaa', 'shell-bbbbbbbbbbbb', 'illustrations-v1', 'autre'], 'bbbbbbbbbbbb')).toEqual(['shell-aaaaaaaaaaaa']);
// planIllustrationSync : (['a','b','b'], ['b','c']) → { toFetch: ['a'], toDelete: ['c'] } ; ([], ['c']) → { [], ['c'] } ; (['a'], []) → { ['a'], [] } ; ([], []) → vides
// sw-handlers.test.ts (fake-indexeddb ; A = { buildHash: 'aaaaaaaaaaaa', files: ['/assets/app-1.js', '/index.html'] }, B idem 'bbbbbbbbbbbb', '/assets/app-2.js')
// install : shell-aaaaaaaaaaaa contient 'A-index' et 'A-app', skipWaitingCalls 0 ; un fichier en 404 → install rejette
// activate : caches ['illustrations-v1','shell-aaaaaaaaaaaa'] (shell-old000000000 purgé), claimCalls 1, meta.userId 'u1' de la base 'appsport' intact
// navigation : réseau d'abord ; réseau muet → rien à 3999 ms, 'A-index' du cache à 4000 ms ; TypeError ou 502 → 'A-index'
// Review Focus 5 : caches partagés, A installé et activé, B installé sans activate, réseau coupé → hA sert 'A-index' et 'A-app' ;
//   caches ['illustrations-v1','shell-aaaaaaaaaaaa','shell-bbbbbbbbbbbb']
// fichier du manifeste servi du cache sans réseau ; non interceptés : /api/me, /api/sync/pull, navigation /api/me/export, POST, autre origine, '/inconnu.txt'
// illustration : cache d'abord, mise en cache seulement si 200
// SKIP_WAITING → skipWaitingCalls 1 ; GET_STATUS par MessageChannel → { type: 'STATUS', buildHash: 'aaaaaaaaaaaa', shellCached: true, illustrationsMissing: 0 } ;
//   fichier du manifeste retiré → shellCached false
// SYNC_ILLUSTRATIONS ['a.11111111.svg','b.22222222.svg'] avec c en cache → cache = a et b, illustrationsMissing 0 ;
//   b en 500 → 1 manquante, retentée en tâche de fond au GET_STATUS suivant (b demandé deux fois) → 0 ; liste référencée persistée après redémarrage du SW
// checkKillSwitch : health swKill true → unregistered, caches ['autre'], navigations [ORIGIN + '/profile'], IndexedDB intact ;
//   swKill false, 503 avec swKill false, réseau en échec → false, rien ne change
// installServiceWorker : fetch de navigation → respondWith une fois et waitUntil (vérification '/api/health' non bloquante) ; install → waitUntil ; message SKIP_WAITING → skipWaitingCalls 1
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- sw-pure sw-handlers` → `Failed to resolve import "../../src/sw/sw"`.

- [ ] **Step 3: Implement**

Lib DOM seulement (pas WebWorker). Amorçage sans effet de bord à l'import : `if (typeof g.skipWaiting === 'function' && 'registration' in g && g[PRECACHE_GLOBAL]) installServiceWorker(g, g[PRECACHE_GLOBAL])`. `install` : `fetch(file, { cache: 'reload' })` par fichier, non `ok` → erreur, pas de `skipWaiting`. `activate` : `cachesToDelete`, ouverture d'`ILLUSTRATIONS_CACHE`, `claimClients()` ; aucune référence à `indexedDB` dans le fichier. `handleFetch` dans l'ordre : non GET, autre origine ou `/api/*` → `null` ; navigation → course réseau / délai, repli `index.html` du shell sur rejet, ≥ 500 ou délai ; `/illustrations/*` → cache d'abord ; fichier du manifeste → shell d'abord ; sinon `null`. `syncIllustrations` sérialisé, liste persistée sous `REFERENCED_ILLUSTRATIONS_KEY`, 4 téléchargements en parallèle au plus, échecs ignorés. `checkKillSwitch` : `/api/health` (`no-store`, 4 s), JSON lu quel que soit le statut, seul `json.swKill === true` compte (pas de Zod dans le SW) ; si vrai : `unregister`, suppression des caches `shell-*` et `illustrations-*`, `navigate(client.url)` pour chaque fenêtre.

- [ ] **Step 4: Run test to verify it passes**

Même commande → `Test Files 2 passed` ; `pnpm build` puis `node -e "const s=require('fs').readFileSync('apps/web/dist/sw.js','utf8'); if(/\bexport\b|^import /m.test(s)) process.exit(1)"` → code 0 ; `pnpm lint && pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(pwa): service worker maison (coquille, illustrations, messages, interrupteur d'urgence)"`

---

### Task 37: Mises à jour en mode prompt, interrupteur d'urgence côté page, stockage persistant et 426

**Files:**
- Create: `apps/web/src/sw/{register.ts, kill-switch.ts, persist.ts, UpdateBanner.tsx, UpdateBanner.module.css}`, `apps/web/test/support/fake-sw-container.ts`
- Modify: `apps/web/src/main.tsx` (`bootServiceWorker` en production, sans bloquer le rendu), `apps/web/src/ui/AppShell.tsx` (`<UpdateBanner />` en premier), `apps/web/src/features/auth/CreateAccountForm.tsx` et `apps/web/src/features/onboarding/ReadyStep.tsx` (`void requestPersistentStorage(db)` après le succès)
- Test: `apps/web/test/sw/{update-banner-rules,register,kill-switch,persist}.test.ts`, `apps/web/test/sw/UpdateBanner.test.tsx`

**Interfaces:**
- Consumes : T25 (`AppDb`, `getMeta`, `setMeta`, `createTestLocalDb`) ; T26 (`SyncEngine`, `browserTransport`, `fetchWithTimeout`) ; T6 (`HealthResponse`) ; T29 (`PageToSw`) ; T28 (`useServices`, `useMe`) ; T36 (`SHELL_CACHE_PREFIX`, `ILLUSTRATIONS_CACHE`, `createFakeCacheStorage`).
- Produces : Interfaces partagées §7 (`UpdateState`, `SwController`, `registerServiceWorker`, `shouldShowUpdateBanner`, `applyKillSwitchIfNeeded`, `requestPersistentStorage`) et :
```ts
export interface SwWorkerLike { state: string; postMessage(m: PageToSw): void; addEventListener(t: 'statechange', fn: () => void): void }
export interface SwRegistrationLike { waiting: SwWorkerLike | null; installing: SwWorkerLike | null; update(): Promise<unknown>; addEventListener(t: 'updatefound', fn: () => void): void }
export interface SwContainerLike { readonly controller: unknown | null; register(url: string, o: { scope: string; updateViaCache: 'none' }): Promise<SwRegistrationLike>;
  getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]>; addEventListener(t: 'controllerchange', fn: () => void): void }
export const swControllerStore: { get(): SwController | null; set(c: SwController | null): void; subscribe(fn: () => void): () => void };
export async function bootServiceWorker(o: { db: AppDb; sync: SyncEngine; fetchHealth: () => Promise<HealthResponse | null>; container?: SwContainerLike; killEnv?: KillSwitchEnv }): Promise<void>;
export interface KillSwitchEnv { serviceWorker?: Pick<SwContainerLike, 'getRegistrations'>; caches?: CacheStorage; reload?: () => void }
export function UpdateBannerView(p: { show: boolean; dismissible: boolean; onUpdate(): void; onDismiss(): void }): JSX.Element | null;
export function UpdateBanner(): JSX.Element | null;
// test/support/fake-sw-container.ts
export interface FakeSwContainer { container: SwContainerLike; registration: SwRegistrationLike & { updateCalls: number }; setController(on: boolean): void;
  installUpdate(): SwWorkerLike & { messages: PageToSw[] }; fireControllerChange(): void; unregisterCalls: number }
export function createFakeSwContainer(o?: { controller?: boolean; waiting?: boolean; registrations?: number /* 1 */ }): FakeSwContainer;
```

**Spec:** 01 R-PWA-2 à R-PWA-6, R-VER-2, R-SYN-31 ; 02 R-CPT-2 ; Review Focus 5.

- [ ] **Step 1: Write the failing test**

| `available`, `forced`, `activeSessionId`, onboarding | `shouldShowUpdateBanner` → `{ show, dismissible }` |
|---|---|
| false, false, null, false ; false, true, null, false | `{ false, true }` ; `{ false, false }` |
| true, false, null, false ; true, true, null, false | `{ true, true }` ; `{ true, false }` |
| true, false, 's1', false ; true, true, 's1', false | `{ false, true }` ; `{ false, false }` |
| true, false, null, true ; true, true, null, true | `{ false, true }` ; `{ false, false }` |

```ts
// register.test.ts (fake timers, createFakeSwContainer, faux SyncEngine, faux doc)
expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' }); expect(f.registration.updateCalls).toBe(1);   // lancement
// premier plan (visible) → 2 ; passage en arrière-plan → inchangé ; +3 600 000 ms visible → +1, masqué → inchangé (R-PWA-2)
// available : SW en attente avec contrôleur → true ; première installation (sans contrôleur) → false ; installUpdate() → { available: true, forced: false }
// applyUpdate → worker.messages [{ type: 'SKIP_WAITING' }], reload seulement au controllerchange, une seule fois même si l'événement se répète ;
//   controllerchange sans applyUpdate → pas de reload ; meta.activeSessionId posé → applyUpdate n'envoie rien (R-PWA-3)
// SyncState protocol_unsupported → forced true et nouvelle recherche (R-PWA-5, R-VER-2) ; sans service worker → contrôleur inerte { available: false, forced: false }
// bootServiceWorker : swKill vrai → aucun enregistrement, swControllerStore.get() null ; sonde null ou swKill faux → enregistrement, contrôleur publié
// kill-switch.test.ts : swKill faux → false, rien ; swKill vrai → unregisterCalls 1, caches ['autre'] (shell-* et illustrations-v1 supprimés), reload une fois, meta.userId 'u1' intact ;
//   swKill vrai sans rien à nettoyer → false, pas de reload (pas de boucle)
// persist.test.ts : API absente → false ; déjà persistant → true sans appeler persist() ; accordé → true ; refusé → false ; erreur → false ; meta.persistGranted = résultat
// UpdateBanner.test.tsx : show false → rien ; fermable → data-dismissible 'true', 'Nouvelle version disponible', « Mettre à jour » et « Plus tard » ;
//   forcé → data-dismissible 'false', pas de « Plus tard », 'Mets à jour l’appli pour reprendre la synchronisation.'
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- update-banner-rules register kill-switch persist UpdateBanner` → `Failed to resolve import "../../src/sw/register"`.

- [ ] **Step 3: Implement**

`shouldShowUpdateBanner` : `show = available && activeSessionId === null && !onboardingInProgress`, `dismissible = !forced`. `applyUpdate` pose un indicateur `reloading` avant `SKIP_WAITING` ; `controllerchange` ne recharge que s'il est posé. `bootServiceWorker` : `h?.swKill` → `applyKillSwitchIfNeeded` et arrêt **sans** enregistrer. `applyKillSwitchIfNeeded` ne recharge que si un désenregistrement ou une suppression a eu lieu, et ne touche jamais `indexedDB`. `requestPersistentStorage` : `persisted() || persist()`, erreur → `false`, résultat toujours écrit dans `meta.persistGranted`. `UpdateBanner` : `onboardingInProgress = me !== null && me.onboardingCompletedAt === null` ; `activeSessionId` lu par `liveQuery(() => getMeta(db, 'activeSessionId'))` ; état local `dismissed` ignoré si `forced`. `main.tsx` : `if (import.meta.env.PROD) void bootServiceWorker({ …, fetchHealth })`, la sonde lisant le JSON même sur un 503.

- [ ] **Step 4: Run test to verify it passes**

Même commande → `Test Files 5 passed` ; `pnpm --filter @appsport/web test` (T28 à T34 toujours verts) ; `pnpm lint && pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(pwa): mises à jour en mode prompt, interrupteur d'urgence et stockage persistant"`

---

### Task 38: E2E Playwright : harnais, arrivée et hors ligne (Chromium et WebKit)

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/support/{server.ts, fixtures.ts, pwa.ts, flows.ts, global-setup.ts}`, `apps/web/e2e/{arrival,offline}.spec.ts`
- Modify: `apps/web/package.json` (`test:e2e: "playwright test"`, dev `@playwright/test` 1.6x), `.github/workflows/ci.yml` (job `e2e`)

**Interfaces:**
- Consumes : CLI `init` et `admin:bootstrap` (T7, T11) ; `POST /api/admin/invitations` (T11) ; `SwStatus` (T29) ; `OutboxOp`, `LOCAL_DB_VERSION` (T25) ; `SYNC_PROTOCOL` (T2) ; `data-testid` et libellés des Interfaces partagées §6.
- Produces : Interfaces partagées §7 (`E2EFault`, `E2EServer`, `startE2EServer`, `bootstrapAdmin`) et :
```ts
export const REPO_ROOT: string; export const DEFAULT_PUBLIC_DIR: string;   // apps/web/dist
export const test: TestType<{ serverOptions: Parameters<typeof startE2EServer>[0]; server: E2EServer }, {}>; export { expect } from '@playwright/test';
// pwa.ts
export async function emulateStandalone(context: BrowserContext): Promise<void>; export async function requireServiceWorker(page: Page): Promise<void>;
export async function waitForController(page: Page): Promise<void>; export async function swStatus(page: Page): Promise<SwStatus | null>;
export async function waitForWaitingWorker(page: Page): Promise<void>; export async function registrationCount(page: Page): Promise<number>;
export async function cacheNames(page: Page): Promise<string[]>; export async function idbGetAll<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]>;
export async function idbPut(page: Page, store: string, value: unknown): Promise<void>; export async function idbVersion(page: Page): Promise<number>;
export async function metaValue(page: Page, key: string): Promise<unknown>; export async function triggerForeground(page: Page): Promise<void>;
export function fakeOutboxOp(userId: string, n?: number): OutboxOp;   // patch sync_rejection { dismissedAt: '2026-10-06T10:00:00.000Z' } valide pour SyncOp
// flows.ts
export const E2E_PASSWORD = 'cheval agrafe batterie correcte';
export async function createAccountViaUi(page: Page, username: string): Promise<void>;
export async function completeOnboardingViaUi(page: Page, o: { place: { kind: 'gym'; name: string; city: string } | { kind: 'home' } }): Promise<void>;
export async function setupOnboardedAdmin(server: E2EServer, context: BrowserContext, username?: string /* 'camille' */): Promise<Page>;
```

**Spec:** 01 §9.1.6 scénarios 1 et 2 (sans séance, brique 3), R-SYN-30, R-SYN-31, R-SYN-33, R-TST-1 ; 02 §1 principe 4, §8 E8, R-ARR-1, R-INV-4, R-INV-5, R-AUTH-6, R-CPT-2 ; Review Focus 5.

- [ ] **Step 1: Write the failing test**

```ts
// arrival.spec.ts
// étape 1 (mode installé) : bootstrapAdmin(server) → page.goto(link) → requireServiceWorker → createAccountViaUi('camille') → data-step 'goal' →
//   completeOnboardingViaUi({ place: { kind: 'gym', name: 'Fitness Park Nation', city: 'Paris' } }) → URL `${server.url}/` ;
//   waitForController ; swStatus.shellCached true ; typeof metaValue('persistGranted') === 'boolean'
// étape 2 (Review Focus 5) : cookie 'dev-session' { httpOnly: true, secure: false, sameSite: 'Lax', path: '/' }, aucun '__Host-session' ;
//   PATCH /api/me depuis la page → 200 ; même requête avec Origin 'http://evil.example' → 403 { error: 'origin_mismatch' }
// étape 3 : invitation membre créée par l'admin ; second contexte installé, /invite, code saisi en minuscules avec espaces (R-INV-5), « Suivant »,
//   createAccountViaUi('lea'), onboarding maison → URL `${server.url}/`
// offline.spec.ts
// context.setOffline(true) + reload → connection-status 'offline' en 5 s ; /profile lisible ('camille') ; « Enregistrer le pseudo » → 'Nécessite le réseau' ;
//   setOffline(false) → 'online' en 15 s
// setFault({ kind: 'blackhole' }) + reload (coquille servie par le SW à 4 s) → 'offline' en 5 s au plus après l'attachement de connection-status,
//   alors que navigator.onLine === true ; /profile lisible ; setFault(null) + triggerForeground → 'online'
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test:e2e -- arrival offline` → `Missing script: test:e2e`, puis `Cannot find module './support/fixtures'`.

- [ ] **Step 3: Implement**

- `playwright.config.ts` : `testDir: './e2e'`, `globalSetup`, `workers: 1`, `fullyParallel: false`, `timeout: 120_000`, `expect.timeout: 10_000`, `retries: CI ? 1 : 0`, `use: { serviceWorkers: 'allow', locale: 'fr-FR', timezoneId: 'Europe/Paris', trace: 'retain-on-failure' }`, projets `chromium` (Pixel 7) et `webkit` (iPhone 14).
- `global-setup.ts` : build Vite (API JS) vers `apps/web/dist`, création de `.e2e-data/`.
- `startE2EServer` : deux ports libres (proxy, backend) ; `dataDir = <REPO_ROOT>/.e2e-data/<horodatage>-<aléa>` avec `.appsport-volume` ; env `APP_ORIGIN=http://localhost:<proxyPort>`, `PORT=<backendPort>`, `HOST=127.0.0.1`, `APPSPORT_DATA_DIR`, `APPSPORT_PUBLIC_DIR` (`opts.publicDir ?? DEFAULT_PUBLIC_DIR`), `APPSPORT_CONTENT_DIR=<REPO_ROOT>/data`, `APP_VERSION=e2e` ; `cli(['init'])` puis `node --import tsx src/main.ts` (cwd `apps/server`) ; santé attendue 30 s au plus. Proxy `node:http` qui relaie tout (`Host`, `Origin`, `Cookie`) : `blackhole` garde la requête ouverte, `status` répond le JSON donné pour un préfixe, backend arrêté → 502 ; `setFault(null)` détruit les sockets retenues ; `restart(env)` fusionne `env` (`''` supprime) sans changer l'URL ; `stop()` garde `dataDir`.
- `bootstrapAdmin` lit les lignes `Lien : ` et `Code : ` ; code de sortie non nul → erreur avec stderr.
- `requireServiceWorker` : `test.skip` si `'serviceWorker' in navigator` est faux (« Service worker indisponible dans ce navigateur (WebKit sous Windows) : la CI Linux fait foi »). `emulateStandalone` : `matchMedia('(display-mode: standalone)')` vrai et `navigator.standalone = true`. `idbVersion` lit `db.version` (Dexie stocke `LOCAL_DB_VERSION * 10`).
- `flows.ts` suit les libellés des composants de T30 à T32, qui font foi (« Pseudo », « Mot de passe », « Confirmation », case « J'ai lu la page Confidentialité et règles », « Créer mon compte » ; onboarding : « Prendre du muscle », « Non », « À la salle » ou « À la maison », salle créée par « Ma salle n'est pas dans la liste » et « Petite salle de quartier », « Jamais », « 3 » et « 45 min », santé sans réponse, `offline-ready` à `ready` en 30 s puis « Commencer »).
- Job CI `e2e` (bloquant, R-TST-1) : `ubuntu-latest`, 30 min, `pnpm install --frozen-lockfile`, `pnpm --filter @appsport/web exec playwright install --with-deps chromium webkit`, `pnpm --filter @appsport/web test:e2e`, rapport `playwright-report` et `test-results` publiés en cas d'échec.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web exec playwright install chromium webkit` puis `pnpm --filter @appsport/web test:e2e -- arrival offline` → `4 passed` (CI Linux) ; sous Windows sans SW WebKit : `2 passed, 2 skipped`.

- [ ] **Step 5: Commit**

`git commit -m "test(pwa): harnais E2E, arrivée et hors ligne sous Chromium et WebKit"`

---

### Task 39: E2E : mise à jour A → B, interrupteur d'urgence et 426

**Files:**
- Create: `apps/web/e2e/support/builds.ts`, `apps/web/e2e/{update,kill-switch,protocol}.spec.ts`
- Modify: `apps/web/e2e/support/global-setup.ts` (`await buildTwice()`)

**Interfaces:**
- Consumes : Task 38 (fixtures, `E2EServer.restart`/`setFault`, `setupOnboardedAdmin`, aides de `pwa.ts`) ; T25 (`LOCAL_DB_VERSION`) ; T35 (`precachePlugin`).
- Produces :
```ts
export interface E2EBuild { label: 'A' | 'B'; dir: string; buildHash: string }
export const BUILD_DIRS: { A: string; B: string };   // <REPO_ROOT>/.e2e-data/builds/{A,B}
export async function readBuildHash(dir: string): Promise<string>;   // première ligne de sw.js
export async function buildTwice(): Promise<{ a: E2EBuild; b: E2EBuild }>;   // écrit .e2e-data/builds/builds.json ; lève si les buildHash sont égaux
export async function loadBuilds(): Promise<{ a: E2EBuild; b: E2EBuild }>;   // builds.json absent → « lancer la suite via playwright test : global-setup construit A et B »
```

**Spec:** 01 §9.1.6 scénarios 4 à 6, R-PWA-2 à R-PWA-6, R-VER-2, R-VER-4, R-VER-5 ; Review Focus 5.

- [ ] **Step 1: Write the failing test**

```ts
// update.spec.ts (serverOptions.publicDir = BUILD_DIRS.A)
// a.buildHash ≠ b.buildHash ; admin onboardé, swStatus.buildHash = a ; outbox += fakeOutboxOp(userId) ; meta.activeSessionId posé ;
//   setFault({ kind: 'status', pathPrefix: '/api/sync/push', status: 503, body: { error: 'internal' } }) (garde l'op en file)
// restart({ APPSPORT_PUBLIC_DIR: b.dir }) + reload + waitForWaitingWorker → update-banner absent pendant la séance (R-PWA-3)
// Review Focus 5 : setOffline(true) + reload → la page s'affiche et swStatus.buildHash = a (coquille A pendant que B attend) ; setOffline(false)
// activeSessionId null + reload → update-banner visible, data-dismissible 'true' ; « Mettre à jour » → rechargement
// swStatus.buildHash = b en 20 s ; l'op est toujours dans l'outbox (R-VER-4) ; idbVersion = LOCAL_DB_VERSION * 10 (R-VER-5) ; meta.userId inchangé ;
//   caches shell-* = [`shell-${b.buildHash}`] ; plus de bandeau
// protocol.spec.ts : op en file ; setFault 426 { error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 } sur '/api/sync/' ; restart vers B ; triggerForeground →
//   connection-status 'protocol_unsupported', op toujours en file (R-VER-2) ; bandeau visible en 30 s, data-dismissible 'false', pas de « Plus tard » ;
//   « Mettre à jour » → buildHash b ; setFault(null) → 'online', outbox vide en 15 s, pending-counter '0', rejected-counter = taille de la deadletter
// kill-switch.spec.ts : op en file (push en 503) ; caches contiennent illustrations-v1 et shell-<12 hex> ; restart({ SW_KILL_SWITCH: '1' }) + reload →
//   registrationCount 0, aucun cache shell-* ni illustrations-* en 15 s, page affichée, aucun rechargement supplémentaire sur 3 s (pas de boucle) ;
//   op et meta.userId intacts (IndexedDB jamais touché) ; restart({ SW_KILL_SWITCH: '' }) + reload → registrationCount 1 et contrôleur
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test:e2e -- update protocol kill-switch` → `Cannot find module './support/builds'`.

- [ ] **Step 3: Implement**

`buildTwice`, pour A puis B : copie de `apps/web/public` vers `.e2e-data/builds/public-<L>`, fichier `e2e-build.txt` contenant `<L>` (la ressource qui diffère), build Vite (API JS) avec ce `publicDir` vers `BUILD_DIRS[L]`, `readBuildHash`. **[décision plan]** Aucune spec n'utilise `page.route` ni `context.route` : les pannes passent par le proxy (`setFault`), identique sous Chromium et WebKit, avec ou sans SW.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test:e2e` → `10 passed` sous Linux (5 specs × 2 projets ; specs WebKit dépendantes du SW `skipped` sous Windows) ; `pnpm lint && pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "test(pwa): E2E mise à jour A vers B, interrupteur d'urgence et 426"`
