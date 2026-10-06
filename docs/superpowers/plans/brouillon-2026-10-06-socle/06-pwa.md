### Task 35: ADR du service worker, manifeste de précache, manifeste PWA et service statique

**Files:**
- Create: `docs/adr/0001-service-worker-maison.md`
- Create: `apps/web/src/sw/precache-manifest.ts`
- Create: `apps/web/vite-plugin-precache.ts`
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/scripts/make-icons.mjs`
- Create: `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`, `apps/web/public/icons/icon-maskable-512.png`, `apps/web/public/icons/apple-touch-icon-180.png` (générées par `make-icons.mjs` et versionnées)
- Create: `apps/server/src/static.ts`
- Modify: `apps/web/vite.config.ts` (ajout de `precachePlugin()`)
- Modify: `apps/web/index.html` (lien vers le manifeste, icône Apple, `theme-color`)
- Modify: `apps/web/package.json` (script `build: "vite build"` ; devDependency `esbuild`)
- Modify: `package.json` racine (script `build: "pnpm --filter @appsport/web build"`)
- Modify: `apps/server/src/routes.ts` (`mountWebApp(app, deps)` en dernière ligne)
- Modify: `apps/server/src/http/security-headers.ts` (ne pas écraser un `Content-Security-Policy` déjà posé par la route)
- Test: `apps/web/test/pwa/precache-plugin.test.ts`, `apps/web/test/pwa/manifest.test.ts`, `apps/server/test/static/static.test.ts`

**Interfaces:**
- Consumes :
  - `createTestContext(opts?: { config?: Partial<AppConfig> … }): Promise<TestContext>` (T6) ;
  - `AppDeps`, `AppConfig.publicDir`, `AppConfig.contentDir` (T6) ;
  - `httpError(code: ApiErrorCode, extra?)` (T6) ;
  - `Hono<AppEnv>`, `mountRoutes(app, deps)` (T6).
- Produces :
  ```ts
  // apps/web/src/sw/precache-manifest.ts
  export interface PrecacheManifest { buildHash: string; files: string[] } // files : chemins URL absolus ('/index.html'), triés par code unit
  export const PRECACHE_GLOBAL = '__APPSPORT_PRECACHE__';
  // apps/web/vite-plugin-precache.ts
  export function computeBuildHash(files: readonly { path: string; content: Uint8Array }[]): string; // 12 hex
  export async function listPrecacheFiles(distDir: string): Promise<{ path: string; content: Uint8Array }[]>; // sans /sw.js ni *.map
  export async function generateServiceWorker(o: { distDir: string; swCode: string }): Promise<PrecacheManifest>; // écrit distDir/sw.js
  export async function bundleServiceWorker(entry: string): Promise<string>; // esbuild : iife, es2022, minifié, write:false
  export function precachePlugin(opts?: { swEntry?: string /* 'src/sw/sw.ts' */ }): Plugin; // name 'appsport-precache', apply 'build', hook writeBundle
  // apps/server/src/static.ts
  export const ILLUSTRATION_CSP = "default-src 'none'; style-src 'unsafe-inline'";
  export const ILLUSTRATION_FILE_RE: RegExp; // /^([a-z0-9][a-z0-9_-]*)\.([0-9a-f]{8})\.(svg|png|jpg|webp)$/
  export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
  export function cacheControlFor(pathname: string): string; // '/assets/…' → IMMUTABLE_CACHE ; sinon 'no-cache'
  export function mountWebApp(app: Hono<AppEnv>, deps: AppDeps): void;
  ```

**Spec:** 01 R-PWA-1 ; 01 §2 (ligne Service worker) ; 01 §10.3 (ADR avant le SW) ; 04 §12 « Import et service » (nom `<id>.<hash8>.<ext>`, `immutable`, compression, `nosniff`, CSP dédiée) ; 03 P-LOG-4 (aucune ressource tierce) ; 02 §3.1 et R-ARR-1 (appli installable, mode `standalone`) ; Global Constraints « En-têtes HTTP ».

- [ ] **Step 1: Write the failing test**

`apps/web/test/pwa/precache-plugin.test.ts` :
```ts
// @vitest-environment node
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleServiceWorker, computeBuildHash, generateServiceWorker, precachePlugin } from '../../vite-plugin-precache';

async function fakeDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'precache-'));
  await mkdir(join(dir, 'assets')); await mkdir(join(dir, 'icons'));
  await writeFile(join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(join(dir, 'assets/index-abc123.js'), 'console.log(1)');
  await writeFile(join(dir, 'assets/index-abc123.js.map'), '{}');
  await writeFile(join(dir, 'manifest.webmanifest'), '{"name":"appsport"}');
  await writeFile(join(dir, 'icons/icon-192.png'), new Uint8Array([1, 2, 3]));
  await writeFile(join(dir, 'sw.js'), 'ancien');
  return dir;
}

describe('generateServiceWorker', () => {
  it('écrit sw.js, qui commence par le manifeste de précache sans sw.js ni .map', async () => {
    const dir = await fakeDist();
    const m = await generateServiceWorker({ distDir: dir, swCode: '/*SW*/' });
    expect(m.files).toEqual(['/assets/index-abc123.js', '/icons/icon-192.png', '/index.html', '/manifest.webmanifest']);
    expect(m.buildHash).toMatch(/^[0-9a-f]{12}$/);
    const sw = await readFile(join(dir, 'sw.js'), 'utf8');
    const [first, ...rest] = sw.split('\n');
    expect(first).toBe(`self.__APPSPORT_PRECACHE__ = ${JSON.stringify(m)};`);
    expect(rest.join('\n')).toContain('/*SW*/');
  });
  it('donne le même buildHash quand on régénère (l’ancien sw.js est ignoré)', async () => {
    const dir = await fakeDist();
    const a = await generateServiceWorker({ distDir: dir, swCode: '' });
    const b = await generateServiceWorker({ distDir: dir, swCode: '' });
    expect(b.buildHash).toBe(a.buildHash);
  });
  it('change de buildHash quand un seul octet change', async () => {
    const dir = await fakeDist();
    const a = await generateServiceWorker({ distDir: dir, swCode: '' });
    await writeFile(join(dir, 'assets/index-abc123.js'), 'console.log(2)');
    const b = await generateServiceWorker({ distDir: dir, swCode: '' });
    expect(b.buildHash).not.toBe(a.buildHash);
  });
});

describe('computeBuildHash', () => {
  it('ne dépend pas de l’ordre d’entrée', () => {
    const f1 = { path: '/a.js', content: new Uint8Array([1]) };
    const f2 = { path: '/b.js', content: new Uint8Array([2]) };
    expect(computeBuildHash([f1, f2])).toBe(computeBuildHash([f2, f1]));
  });
  it('distingue un déplacement de contenu entre deux fichiers', () => {
    const x = [{ path: '/a', content: new TextEncoder().encode('ab') }, { path: '/b', content: new TextEncoder().encode('') }];
    const y = [{ path: '/a', content: new TextEncoder().encode('a') }, { path: '/b', content: new TextEncoder().encode('b') }];
    expect(computeBuildHash(x)).not.toBe(computeBuildHash(y));
  });
});

describe('bundleServiceWorker et precachePlugin', () => {
  it('produit un script classique (iife) sans export', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'swentry-'));
    const entry = join(dir, 'sw.ts');
    await writeFile(entry, "export const marker: string = 'MARQUEUR_SW'; console.log(marker);");
    const code = await bundleServiceWorker(entry);
    expect(code).toContain('MARQUEUR_SW');
    expect(code).not.toMatch(/\bexport\b/);
  });
  it('ne s’applique qu’au build', () => {
    const p = precachePlugin();
    expect(p.name).toBe('appsport-precache');
    expect(p.apply).toBe('build');
  });
});
```

`apps/web/test/pwa/manifest.test.ts` :
```ts
// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const web = join(__dirname, '../..');
const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

describe('manifeste PWA', () => {
  it('décrit une appli installable en français', async () => {
    const m = JSON.parse(await readFile(join(web, 'public/manifest.webmanifest'), 'utf8'));
    expect(m).toMatchObject({ name: 'appsport', short_name: 'appsport', display: 'standalone', start_url: '/', scope: '/', lang: 'fr' });
    expect(m.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]));
  });
  it.each([['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon-180.png', 180]])(
    '%s est un PNG de %i px', async (file, size) => {
      const b = await readFile(join(web, 'public/icons', file));
      expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(pngSize(b)).toEqual({ w: size, h: size });
    });
  it('index.html référence le manifeste, sans script en ligne ni ressource tierce', async () => {
    const html = await readFile(join(web, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
```

`apps/server/test/static/static.test.ts` :
```ts
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '@appsport/server/testing';
import { ILLUSTRATION_CSP, IMMUTABLE_CACHE } from '../../src/static';

const GLOBAL_CSP = "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect width="1" height="1"/>'.repeat(60)}</svg>`; // > 1 Kio
const HASH8 = createHash('sha256').update(SVG).digest('hex').slice(0, 8);
let ctx: TestContext;

beforeEach(async () => {
  const publicDir = await mkdtemp(join(tmpdir(), 'public-'));
  const contentDir = await mkdtemp(join(tmpdir(), 'content-'));
  await mkdir(join(publicDir, 'assets'));
  await writeFile(join(publicDir, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(join(publicDir, 'sw.js'), 'self.x = 1;');
  await writeFile(join(publicDir, 'assets/index-abc123.js'), 'console.log(1)');
  await writeFile(join(publicDir, 'manifest.webmanifest'), '{"name":"appsport"}');
  await mkdir(join(contentDir, 'illustrations/files'), { recursive: true });
  await writeFile(join(contentDir, 'illustrations/files/squat-start.svg'), SVG);
  ctx = await createTestContext({ config: { publicDir, contentDir } });
});
afterEach(() => ctx.close());

describe('mountWebApp', () => {
  it('sert index.html en no-cache avec la CSP globale', async () => {
    for (const path of ['/', '/index.html']) {
      const r = await ctx.request(path);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(r.headers.get('cache-control')).toBe('no-cache');
      expect(r.headers.get('content-security-policy')).toBe(GLOBAL_CSP);
      expect(await r.text()).toContain('id="root"');
    }
  });
  it('sert sw.js et le manifeste en no-cache', async () => {
    const sw = await ctx.request('/sw.js');
    expect(sw.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(sw.headers.get('cache-control')).toBe('no-cache');
    const mf = await ctx.request('/manifest.webmanifest');
    expect(mf.headers.get('content-type')).toBe('application/manifest+json');
    expect(mf.headers.get('cache-control')).toBe('no-cache');
  });
  it('sert /assets/* haché en immutable', async () => {
    const r = await ctx.request('/assets/index-abc123.js');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe(IMMUTABLE_CACHE);
    expect(IMMUTABLE_CACHE).toBe('public, max-age=31536000, immutable');
  });
  it('sert une illustration en immutable, nosniff, avec sa CSP propre', async () => {
    const r = await ctx.request(`/illustrations/squat-start.${HASH8}.svg`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/svg+xml');
    expect(r.headers.get('cache-control')).toBe(IMMUTABLE_CACHE);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toBe(ILLUSTRATION_CSP);
    expect(ILLUSTRATION_CSP).toBe("default-src 'none'; style-src 'unsafe-inline'");
  });
  it('compresse une illustration si le client accepte gzip', async () => {
    const r = await ctx.request(`/illustrations/squat-start.${HASH8}.svg`, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(r.headers.get('content-encoding')).toBe('gzip');
  });
  it.each(['/illustrations/squat-start.00000000.svg', '/illustrations/absent.12345678.svg',
    '/illustrations/..%2f..%2fsecret.svg', '/illustrations/squat-start.svg'])('404 pour %s', async (p) => {
    expect((await ctx.request(p)).status).toBe(404);
  });
  it.each(['/profile/places/abc', '/invite', '/admin/members'])('repli SPA vers index.html pour %s', async (p) => {
    const r = await ctx.request(p);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-cache');
    expect(await r.text()).toContain('id="root"');
  });
  it('404 sans repli pour un fichier absent avec extension et pour une remontée de dossier', async () => {
    expect((await ctx.request('/assets/missing-zzz.js')).status).toBe(404);
    expect((await ctx.request('/..%2f..%2fpackage.json')).status).toBe(404);
  });
  it('404 JSON pour une route /api inconnue, en GET et en POST', async () => {
    const g = await ctx.request('/api/nope');
    expect(g.status).toBe(404);
    expect(await g.json()).toEqual({ error: 'not_found' });
    const p = await ctx.request('/api/nope', { method: 'POST', json: {} });
    expect(p.status).toBe(404);
    expect(await p.json()).toEqual({ error: 'not_found' });
  });
  it('laisse passer les routes API montées avant (health)', async () => {
    const r = await ctx.request('/api/health');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/json');
  });
});

it('sans index.html, une route SPA répond 404', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'public-empty-'));
  const c = await createTestContext({ config: { publicDir: empty } });
  expect((await c.request('/profile')).status).toBe(404);
  c.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- precache-plugin manifest` puis `pnpm --filter @appsport/server test -- static`.
Échecs attendus : `Failed to resolve import "../../vite-plugin-precache"`, `ENOENT … public/manifest.webmanifest`, `Failed to resolve import "../../src/static"`.

- [ ] **Step 3: Implement**

- `docs/adr/0001-service-worker-maison.md` (français) : statut « Acceptée », date 2026-10-06.
  - **Contexte** : 01 §2 et §10.3. vite-plugin-pwa est gelé, et Workbox apporterait des comportements implicites (skipWaiting, navigation preload) contraires à R-PWA-2 à R-PWA-6.
  - **Décision** : un SW maison d'environ 150 lignes (`src/sw/sw.ts`), plus un mini-plugin Vite qui produit `sw.js` et le manifeste de précache.
  - **Conséquences** : les tests unitaires et les E2E Chromium et WebKit sont à notre charge.
  - **Repli** : mode `injectManifest` de vite-plugin-pwa, en gardant `sw.ts` et en remplaçant seulement `vite-plugin-precache.ts`. Critère de bascule : un défaut de précache non corrigé en une demi-journée, ou un besoin de Background Sync.
- `precache-manifest.ts` : seulement l'interface et la constante ci-dessus. Le fichier n'importe rien, car il est utilisé à la fois côté Node et côté SW.
- `vite-plugin-precache.ts` :
  - `listPrecacheFiles` parcourt `distDir` récursivement, convertit les séparateurs Windows en `/`, préfixe chaque chemin par `/`, exclut `/sw.js` et `*.map`, et trie avec `a < b` ;
  - `generateServiceWorker` écrit `` `self.${PRECACHE_GLOBAL} = ${JSON.stringify(manifest)};\n${swCode}` `` ;
  - `precachePlugin` lit `outDir` dans `configResolved`. Dans `writeBundle`, il appelle `bundleServiceWorker(resolve(root, swEntry))` puis `generateServiceWorker`. L'algorithme de hachage est fixé :
  ```ts
  const h = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(f.path); h.update('\0'); h.update(String(f.content.byteLength)); h.update('\0'); h.update(f.content);
  }
  return h.digest('hex').slice(0, 12);
  ```
- `vite.config.ts` : `plugins: [react(), precachePlugin()]`. Le SW n'est construit qu'au build ; en dev, aucun SW.
- `manifest.webmanifest` : `name` et `short_name` « appsport », `description` « Suivi de musculation entre proches », `lang` « fr », `dir` « ltr », `start_url` « / », `scope` « / », `display` « standalone », `orientation` « portrait ». **[décision plan]** `background_color` `#ffffff`, `theme_color` `#0f766e`. Les quatre icônes : les trois entrées du test, plus l'icône Apple, référencée seulement dans `index.html`.
- `scripts/make-icons.mjs` : script Node sans dépendance (encodeur PNG avec `node:zlib`, RGBA). Il dessine un fond `#0f766e` et un haltère blanc fait de trois rectangles centrés. Pour l'icône maskable, le dessin reste dans la zone sûre de 80 %. Il écrit les quatre fichiers. On le lance une fois avec `node apps/web/scripts/make-icons.mjs`, puis on versionne les PNG.
- `index.html` (fichier de T28) : ajouter dans `<head>`, à l'identique :
  - `<link rel="manifest" href="/manifest.webmanifest">` ;
  - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">` ;
  - `<meta name="theme-color" content="#0f766e">`.
- `static.ts` : `mountWebApp(app, deps)` enregistre, dans cet ordre :
  1. `app.all('/api/*', () => { throw httpError('not_found') })` ;
  2. `app.use('/illustrations/*', compress())` (`hono/compress`), puis `app.get('/illustrations/:file', …)`. Le handler vérifie `ILLUSTRATION_FILE_RE` et lit `contentDir/illustrations/files/<id>.<ext>`. Il compare `sha256(contenu).slice(0, 8)` au `hash8` demandé et répond 404 en cas d'écart. Il pose `Content-Type` (svg `image/svg+xml`, png `image/png`, jpg `image/jpeg`, webp `image/webp`), `Cache-Control: IMMUTABLE_CACHE`, `X-Content-Type-Options: nosniff` et `Content-Security-Policy: ILLUSTRATION_CSP`. Les empreintes sont gardées en mémoire dans une `Map` par fichier ;
  3. `app.get('*', …)` pour les fichiers de `publicDir`, par lecture `fs/promises` (pas de `serveStatic`). Le chemin décodé est résolu avec `path.resolve(publicDir, '.' + pathname)` et doit rester sous `publicDir + sep`, sinon 404. `'/'` est servi comme `/index.html`. `Cache-Control` vaut `cacheControlFor(pathname)`. Types MIME : html `text/html; charset=utf-8`, js et mjs `text/javascript; charset=utf-8`, css `text/css; charset=utf-8`, webmanifest `application/manifest+json`, json `application/json`, png `image/png`, svg `image/svg+xml`, ico `image/x-icon`, woff2 `font/woff2`, txt `text/plain; charset=utf-8`, sinon `application/octet-stream`. Fichier absent : si le dernier segment n'a pas de `.`, on sert `index.html` en `no-cache` (repli SPA), ou 404 si `index.html` n'existe pas ; sinon 404 texte.
- `security-headers.ts` (fichier de T6) : poser `Content-Security-Policy` seulement si la réponse n'en a pas déjà un (`if (!c.res.headers.has('Content-Security-Policy'))`). Les autres en-têtes ne changent pas.
- `routes.ts` : `mountWebApp(app, deps)` en **dernière** instruction de `mountRoutes`.
- `apps/web/package.json` : `"build": "vite build"`, et `esbuild` en devDependency. `package.json` racine : `"build": "pnpm --filter @appsport/web build"`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- precache-plugin manifest` → `Test Files 2 passed` ; `pnpm --filter @appsport/server test -- static` → `Test Files 1 passed` ; `pnpm build` → `apps/web/dist/sw.js` existe et sa première ligne commence par `self.__APPSPORT_PRECACHE__ = {"buildHash":"` ; `pnpm lint && pnpm typecheck` → sans erreur.

- [ ] **Step 5: Commit**

`git add docs/adr apps/web apps/server/src/static.ts apps/server/src/routes.ts apps/server/src/http/security-headers.ts apps/server/test/static package.json && git commit -m "feat(pwa): manifeste de précache, manifeste PWA, service statique et ADR du service worker"`

---

### Task 36: Service worker maison (coquille, illustrations, messages, interrupteur côté SW)

**Files:**
- Create: `apps/web/src/sw/sw.ts`
- Create: `apps/web/test/support/fake-sw-scope.ts`
- Test: `apps/web/test/sw/sw-pure.test.ts`, `apps/web/test/sw/sw-handlers.test.ts`

**Interfaces:**
- Consumes :
  - `PrecacheManifest`, `PRECACHE_GLOBAL` (T35) ;
  - `PageToSw`, `SwStatus` de `apps/web/src/sw/protocol.ts` (T34), en import de type seulement ;
  - `SYNC_TIMEOUT_MS` de `@appsport/contracts` (T20), dans le test seulement.
- Produces (`apps/web/src/sw/sw.ts`) :
  ```ts
  export const SHELL_CACHE_PREFIX = 'shell-';
  export const ILLUSTRATIONS_CACHE = 'illustrations-v1';
  export const NAVIGATION_TIMEOUT_MS = 4000;                        // = SYNC_TIMEOUT_MS (littéral : contracts n'est pas embarqué dans le SW)
  export const REFERENCED_ILLUSTRATIONS_KEY = '/__sw/illustrations-referenced.json'; // clé interne dans ILLUSTRATIONS_CACHE
  export type SwRequest = { url: string; method: string; mode: string };
  export interface SwWindowClient { url: string; navigate(url: string): Promise<unknown> }
  export interface SwScope {
    origin: string; caches: CacheStorage;
    fetch(input: SwRequest | string, init?: RequestInit): Promise<Response>;
    skipWaiting(): Promise<void>; claimClients(): Promise<void>;
    unregister(): Promise<boolean>; windowClients(): Promise<readonly SwWindowClient[]>;
  }
  export interface SwHandlers {
    install(): Promise<void>; activate(): Promise<void>;
    handleFetch(request: SwRequest): Promise<Response> | null;      // null = pas de respondWith
    handleMessage(msg: PageToSw, port: MessagePort | null): Promise<void>;
    status(): Promise<SwStatus>;
    syncIllustrations(files: readonly string[]): Promise<void>;
    checkKillSwitch(): Promise<boolean>;
  }
  export function cachesToDelete(names: readonly string[], buildHash: string): string[];
  export function planIllustrationSync(referenced: readonly string[], cached: readonly string[]): { toFetch: string[]; toDelete: string[] };
  export function createSwHandlers(scope: SwScope, manifest: PrecacheManifest, opts?: { navigationTimeoutMs?: number }): SwHandlers;
  export interface SwGlobalLike { /* sous-ensemble typé de ServiceWorkerGlobalScope, sans lib WebWorker */ }
  export function installServiceWorker(g: SwGlobalLike, manifest: PrecacheManifest): void;
  ```
- Produces (support de test `apps/web/test/support/fake-sw-scope.ts`) :
  ```ts
  export function createFakeCacheStorage(): CacheStorage;            // Map d'URL absolues → Response clonée
  export interface FakeSwScope extends SwScope { setNetwork(fn: (url: string, init?: RequestInit) => Promise<Response>): void;
    fetchLog: string[] /* pathname */; skipWaitingCalls: number; claimCalls: number; unregistered: boolean; navigations: string[] }
  export function createFakeSwScope(o?: { origin?: string /* 'https://appsport.test' */; caches?: CacheStorage; clientUrls?: string[] }): FakeSwScope;
  export function staticNetwork(files: Record<string, string>): (url: string) => Promise<Response>; // pathname → 200, sinon 404
  ```

**Spec:** 01 R-PWA-1 (caches `shell-<buildHash>` et `illustrations-v1`), R-PWA-4 (purge à l'activation, IndexedDB jamais touché), R-PWA-6 (vérification non bloquante côté SW, étapes 1 à 3), R-SYN-30 (délai de 4 s), R-SYN-32 (illustrations en cache d'abord ; téléchargement des manquantes ; suppression des non référencées ; au démarrage s'il en manque), R-SYN-33 (conditions 1 et 3 via `GET_STATUS`) ; 04 §11.

- [ ] **Step 1: Write the failing test**

`apps/web/test/sw/sw-pure.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { SYNC_TIMEOUT_MS } from '@appsport/contracts';
import { ILLUSTRATIONS_CACHE, NAVIGATION_TIMEOUT_MS, SHELL_CACHE_PREFIX, cachesToDelete, planIllustrationSync } from '../../src/sw/sw';

describe('constantes', () => {
  it('nomme les caches comme la spec', () => {
    expect(SHELL_CACHE_PREFIX).toBe('shell-');
    expect(ILLUSTRATIONS_CACHE).toBe('illustrations-v1');
    expect(NAVIGATION_TIMEOUT_MS).toBe(SYNC_TIMEOUT_MS);
  });
});
describe('cachesToDelete', () => {
  it('ne garde que la coquille du build courant et ne touche pas aux illustrations', () => {
    expect(cachesToDelete(['shell-aaaaaaaaaaaa', 'shell-bbbbbbbbbbbb', 'illustrations-v1', 'autre'], 'bbbbbbbbbbbb'))
      .toEqual(['shell-aaaaaaaaaaaa']);
    expect(cachesToDelete([], 'x')).toEqual([]);
  });
});
describe('planIllustrationSync', () => {
  it.each([
    [['a.11111111.svg', 'b.22222222.svg', 'b.22222222.svg'], ['b.22222222.svg', 'c.33333333.svg'], ['a.11111111.svg'], ['c.33333333.svg']],
    [[], ['c.33333333.svg'], [], ['c.33333333.svg']],
    [['a.11111111.svg'], [], ['a.11111111.svg'], []],
    [[], [], [], []],
  ])('référencées %j, en cache %j', (ref, cached, toFetch, toDelete) => {
    expect(planIllustrationSync(ref, cached)).toEqual({ toFetch, toDelete });
  });
});
```

`apps/web/test/sw/sw-handlers.test.ts`. Le fichier utilise `fake-indexeddb/auto`. Il définit `ORIGIN = 'https://appsport.test'`, `A = { buildHash: 'aaaaaaaaaaaa', files: ['/assets/app-1.js', '/index.html'] }`, `B = { buildHash: 'bbbbbbbbbbbb', files: ['/assets/app-2.js', '/index.html'] }`, ainsi que `nav(path) = { url: ORIGIN + path, method: 'GET', mode: 'navigate' }` et `get(path, method = 'GET') = { url: ORIGIN + path, method, mode: 'cors' }`. Cas, avec leurs assertions :
```ts
it('install précache shell-<buildHash> sans skipWaiting', async () => {
  const s = createFakeSwScope(); s.setNetwork(staticNetwork({ '/index.html': 'A-index', '/assets/app-1.js': 'A-app' }));
  await createSwHandlers(s, A).install();
  const c = await s.caches.open('shell-aaaaaaaaaaaa');
  expect(await (await c.match(ORIGIN + '/index.html'))!.text()).toBe('A-index');
  expect(await (await c.match(ORIGIN + '/assets/app-1.js'))!.text()).toBe('A-app');
  expect(s.skipWaitingCalls).toBe(0);
});
it('install échoue si un fichier du manifeste répond 404', async () => {
  const s = createFakeSwScope(); s.setNetwork(staticNetwork({ '/index.html': 'A-index' }));
  await expect(createSwHandlers(s, A).install()).rejects.toThrow();
});
it('activate purge les autres shell-*, garde illustrations-v1, prend le contrôle et ne touche pas IndexedDB', async () => {
  const idb = await openFixtureIdb(); // ouvre 'appsport' et écrit { key: 'userId', value: 'u1' } dans 'meta'
  const s = createFakeSwScope();
  for (const n of ['shell-old000000000', 'shell-aaaaaaaaaaaa', 'illustrations-v1']) await s.caches.open(n);
  await createSwHandlers(s, A).activate();
  expect((await s.caches.keys()).sort()).toEqual(['illustrations-v1', 'shell-aaaaaaaaaaaa']);
  expect(s.claimCalls).toBe(1);
  expect(await readFixtureMeta(idb, 'userId')).toBe('u1');
});
it('navigation : le réseau d’abord quand il répond', async () => { /* réseau '/x' → 'net' ; handleFetch(nav('/x')) → corps 'net' */ });
it('navigation : bascule sur index.html du cache à 4 s, pas avant', async () => {
  vi.useFakeTimers();
  // installé avec A, puis réseau qui ne répond jamais : setNetwork(() => new Promise(() => {}))
  let settled = false; const p = h.handleFetch(nav('/profile'))!.then((r) => { settled = true; return r; });
  await vi.advanceTimersByTimeAsync(3999); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1); expect(await (await p).text()).toBe('A-index');
});
it('navigation : bascule sur le cache dès une erreur réseau ou un 5xx', async () => { /* reject TypeError → 'A-index' ; 502 → 'A-index' */ });
it('rechargement à froid hors ligne pendant que B attend : A sert sa propre coquille', async () => {
  const caches = createFakeCacheStorage();
  const sA = createFakeSwScope({ caches }); sA.setNetwork(staticNetwork({ '/index.html': 'A-index', '/assets/app-1.js': 'A-app' }));
  const hA = createSwHandlers(sA, A); await hA.install(); await hA.activate();
  const sB = createFakeSwScope({ caches }); sB.setNetwork(staticNetwork({ '/index.html': 'B-index', '/assets/app-2.js': 'B-app' }));
  await createSwHandlers(sB, B).install();                 // B en attente : pas d’activate
  sA.setNetwork(() => Promise.reject(new TypeError('offline')));
  expect(await (await hA.handleFetch(nav('/'))!).text()).toBe('A-index');
  expect(await (await hA.handleFetch(get('/assets/app-1.js'))!).text()).toBe('A-app');
  expect((await caches.keys()).sort()).toEqual(['illustrations-v1', 'shell-aaaaaaaaaaaa', 'shell-bbbbbbbbbbbb']);
});
it('fichier du manifeste servi depuis le cache sans appel réseau', async () => { /* après install, fetchLog vidé ; get('/assets/app-1.js') → 'A-app' ; fetchLog == [] */ });
it.each([get('/api/me'), get('/api/sync/pull'), nav('/api/me/export'), get('/x', 'POST'), { url: 'https://autre.example/x', method: 'GET', mode: 'cors' }, get('/inconnu.txt')])(
  '%j n’est pas intercepté', (req) => { expect(createSwHandlers(createFakeSwScope(), A).handleFetch(req)).toBeNull(); });
it('illustration : cache d’abord, mise en cache seulement si 200', async () => {
  // 1er get('/illustrations/sq.11111111.svg') → réseau puis cache ; 2e → fetchLog inchangé ; un 404 n’est pas mis en cache
});
it('SKIP_WAITING appelle skipWaiting une fois', async () => { await h.handleMessage({ type: 'SKIP_WAITING' }, null); expect(s.skipWaitingCalls).toBe(1); });
it('GET_STATUS répond par le port avec un SwStatus', async () => {
  const ch = new MessageChannel(); const got = new Promise((r) => { ch.port2.onmessage = (e) => r(e.data); });
  await h.handleMessage({ type: 'GET_STATUS' }, ch.port1);
  expect(await got).toEqual({ type: 'STATUS', buildHash: 'aaaaaaaaaaaa', shellCached: true, illustrationsMissing: 0 });
  ch.port1.close(); ch.port2.close();
});
it('shellCached devient faux si un fichier du manifeste manque', async () => { /* cache.delete('/assets/app-1.js') → status().shellCached === false */ });
it('SYNC_ILLUSTRATIONS télécharge les manquantes et supprime les non référencées', async () => {
  // cache illustrations-v1 contient /illustrations/c.33333333.svg ; réseau sert a et b
  await h.handleMessage({ type: 'SYNC_ILLUSTRATIONS', files: ['a.11111111.svg', 'b.22222222.svg'] }, null);
  // clés du cache (hors REFERENCED_ILLUSTRATIONS_KEY) : /illustrations/a…, /illustrations/b… ; status().illustrationsMissing === 0
});
it('une illustration en échec reste comptée manquante puis est retentée au GET_STATUS suivant', async () => {
  // b répond 500 → illustrationsMissing === 1 ; réseau réparé ; status() puis attente de la tâche de fond → fetchLog contient b deux fois ; illustrationsMissing === 0
});
it('la liste référencée survit au redémarrage du SW', async () => {
  // après SYNC avec b en échec, nouveau createSwHandlers(scopeSurLesMêmesCaches, A).status() → illustrationsMissing === 1
});
it('checkKillSwitch : swKill vrai → désenregistrement, caches shell-* et illustrations-* vidés, clients rechargés, IndexedDB intact', async () => {
  const s = createFakeSwScope({ clientUrls: [ORIGIN + '/profile'] });
  for (const n of ['shell-aaaaaaaaaaaa', 'illustrations-v1', 'autre']) await s.caches.open(n);
  s.setNetwork(async () => Response.json({ status: 'ok', version: 'v1', db: 'ok', protocol: 1, minProtocol: 1, epoch: 'e', swKill: true }));
  expect(await createSwHandlers(s, A).checkKillSwitch()).toBe(true);
  expect(s.unregistered).toBe(true);
  expect(await s.caches.keys()).toEqual(['autre']);
  expect(s.navigations).toEqual([ORIGIN + '/profile']);
  expect(await readFixtureMeta(idb, 'userId')).toBe('u1');
});
it('checkKillSwitch : swKill faux, réponse 503 avec swKill faux, ou réseau en échec → false et rien ne change', async () => { /* 3 cas */ });
it('installServiceWorker branche les événements ; une navigation lance la vérification sans la bloquer', async () => {
  // g = faux SwGlobalLike (EventTarget minimal + caches + fetch + registration + clients + location.origin)
  // événement fetch { request: nav('/'), respondWith: vi.fn(), waitUntil: vi.fn() } → respondWith appelé une fois ; waitUntil appelé ;
  // fetchLog contient '/api/health' ; 'install' → waitUntil reçoit une promesse ; message { data: { type: 'SKIP_WAITING' }, ports: [] } → skipWaitingCalls === 1
});
```
Pour `openFixtureIdb` et `readFixtureMeta`, on utilise l'API IndexedDB brute (fake-indexeddb) : base `appsport`, store `meta` en `keyPath: 'key'`.

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- sw-pure sw-handlers` → échec : `Failed to resolve import "../../src/sw/sw"`.

- [ ] **Step 3: Implement**

- `fake-sw-scope.ts` : `CacheStorage` et `Cache` simulés sur des `Map`, indexés par URL absolue. `match`, `put`, `delete` et `keys` (qui renvoie des `Request`) clonent les `Response`. `fetch` résout les chemins relatifs avec `origin`, ajoute le pathname à `fetchLog` et délègue au réseau courant. `windowClients()` renvoie des clients dont `navigate(url)` ajoute l'URL à `navigations`.
- `sw.ts` :
  - **Typage** : n'utilise que la lib DOM, pas la lib WebWorker. `SwGlobalLike` décrit `caches`, `fetch`, `skipWaiting()`, `clients.claim()`, `clients.matchAll({ type: 'window' })`, `registration.unregister()`, `location.origin`, `addEventListener(type, fn)` et la propriété `[PRECACHE_GLOBAL]?: PrecacheManifest`.
  - **Amorçage** : en bas de fichier, `const g = globalThis as unknown as SwGlobalLike & Record<string, unknown>; if (typeof g.skipWaiting === 'function' && 'registration' in g && g[PRECACHE_GLOBAL]) installServiceWorker(g, g[PRECACHE_GLOBAL] as PrecacheManifest);`. L'import du fichier dans les tests n'a donc aucun effet de bord.
  - **`install`** : pour chaque fichier, `scope.fetch(file, { cache: 'reload' })`. Une réponse non `ok` lève une erreur. Chaque réponse est mise dans `shell-<buildHash>`. Pas de `addAll` ni de `skipWaiting`.
  - **`activate`** : supprime `cachesToDelete(await caches.keys(), buildHash)`, ouvre `ILLUSTRATIONS_CACHE` pour le créer, puis appelle `claimClients()`. Aucune référence à `indexedDB` dans le fichier.
  - **`handleFetch`**, dans cet ordre :
    1. renvoie `null` pour une méthode autre que GET, une autre origine ou un pathname `/api/*` ;
    2. pour `mode === 'navigate'` : course entre `scope.fetch(request)` et un minuteur de `navigationTimeoutMs`. Un réseau `ok` est renvoyé tel quel. Un rejet, un statut ≥ 500 ou le délai écoulé renvoient `index.html` de `shell-<buildHash>` s'il existe, sinon la réponse ou l'erreur réseau ;
    3. pour `/illustrations/*` : `ILLUSTRATIONS_CACHE` d'abord, puis le réseau ; on fait `put` seulement si le statut vaut 200 ;
    4. pour un pathname présent dans `manifest.files` : le cache de la coquille d'abord, puis le réseau ;
    5. sinon `null`.
  - **`status()`** :
    - `shellCached` vaut vrai si chaque fichier du manifeste est présent ;
    - `illustrationsMissing` compte les fichiers de la liste persistée sous `REFERENCED_ILLUSTRATIONS_KEY` qui sont absents des clés `/illustrations/*`. Il vaut 0 si aucune liste n'est connue ;
    - si `illustrationsMissing > 0`, `status()` lance `syncIllustrations(liste)` en tâche de fond.
  - **`syncIllustrations(files)`** : les appels sont sérialisés par une chaîne de promesses. La fonction persiste la liste (`Response.json(files)`), calcule `planIllustrationSync(files, cachedFileNames)`, télécharge `toFetch` (4 au plus en parallèle) en ignorant les échecs, puis supprime `toDelete`.
  - **`handleMessage`** :
    - `SKIP_WAITING` → `skipWaiting()` ;
    - `GET_STATUS` → `port?.postMessage(await status())` ;
    - `SYNC_ILLUSTRATIONS` → `syncIllustrations(msg.files)`.
  - **`checkKillSwitch()`** :
    - `fetch('/api/health', { cache: 'no-store' })` limité à 4 s ;
    - le JSON est lu quel que soit le statut, y compris 503, et la fonction ne retient que `json.swKill === true`, sans Zod, pour ne pas embarquer `@appsport/contracts` dans le SW ;
    - si `swKill` est vrai, elle appelle `unregister()`, supprime les caches qui commencent par `shell-` ou `illustrations-`, puis appelle `navigate(client.url)` pour chaque client fenêtre, et renvoie `true` ;
    - toute erreur renvoie `false`.
  - **`installServiceWorker`** :
    - `install` → `waitUntil(h.install())` ;
    - `activate` → `waitUntil(h.activate())` ;
    - `fetch` → `p = h.handleFetch(e.request)`. Si `p` existe, `respondWith(p)`. Pour une navigation, on ajoute aussi `waitUntil(h.checkKillSwitch())`, sans attendre son résultat ;
    - `message` → `waitUntil(h.handleMessage(e.data, e.ports[0] ?? null))`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- sw-pure sw-handlers` → `Test Files 2 passed`. Ensuite, `pnpm build` produit un `dist/sw.js` qui ne contient ni `import ` ni `export ` (vérification avec `node -e "const s=require('fs').readFileSync('apps/web/dist/sw.js','utf8'); if(/\bexport\b|^import /m.test(s)) process.exit(1)"`). Enfin, `pnpm lint && pnpm typecheck` passent sans erreur.

- [ ] **Step 5: Commit**

`git add apps/web/src/sw/sw.ts apps/web/test/sw apps/web/test/support/fake-sw-scope.ts && git commit -m "feat(pwa): service worker maison (coquille, illustrations, messages, interrupteur d'urgence)"`

---

### Task 37: Mises à jour en mode prompt, interrupteur d'urgence côté page, stockage persistant et 426

**Files:**
- Create: `apps/web/src/sw/register.ts`, `apps/web/src/sw/kill-switch.ts`, `apps/web/src/sw/persist.ts`, `apps/web/src/sw/UpdateBanner.tsx` (+ `UpdateBanner.module.css`)
- Create: `apps/web/test/support/fake-sw-container.ts`
- Modify: `apps/web/src/main.tsx` (démarrage du SW après la sonde de santé)
- Modify: `apps/web/src/ui/AppShell.tsx` (`<UpdateBanner />` en tête)
- Modify: `apps/web/src/features/auth/CreateAccountForm.tsx` (après un 201 : `void requestPersistentStorage(db)`)
- Modify: `apps/web/src/features/onboarding/ReadyStep.tsx` (après le succès de « Commencer » : `void requestPersistentStorage(db)`)
- Test: `apps/web/test/sw/update-banner-rules.test.ts`, `apps/web/test/sw/register.test.ts`, `apps/web/test/sw/kill-switch.test.ts`, `apps/web/test/sw/persist.test.ts`, `apps/web/test/sw/UpdateBanner.test.tsx`

**Interfaces:**
- Consumes :
  - `AppDb`, `getMeta`, `setMeta`, `MetaValues` (T25) ;
  - `createTestLocalDb(name?)` (T25) ;
  - `SyncEngine`, `SyncState`, `ConnectionState`, `browserTransport`, `fetchWithTimeout` (T26) ;
  - `HealthResponse` (T6) ;
  - `PageToSw` (T34) ;
  - `useServices()`, `useMe()` (T28) ;
  - `ILLUSTRATIONS_CACHE`, `SHELL_CACHE_PREFIX` (T36), que les tests importent pour leurs assertions.
- Produces :
  ```ts
  // sw/register.ts
  export interface UpdateState { available: boolean; forced: boolean }
  export interface SwController { getState(): UpdateState; subscribe(fn: (s: UpdateState) => void): () => void;
    checkForUpdate(): Promise<void>; applyUpdate(): Promise<void>; markForced(): void }
  export interface SwWorkerLike { state: string; postMessage(m: PageToSw): void; addEventListener(t: 'statechange', fn: () => void): void }
  export interface SwRegistrationLike { waiting: SwWorkerLike | null; installing: SwWorkerLike | null; update(): Promise<unknown>;
    addEventListener(t: 'updatefound', fn: () => void): void }
  export interface SwContainerLike { readonly controller: unknown | null;
    register(url: string, o: { scope: string; updateViaCache: 'none' }): Promise<SwRegistrationLike>;
    getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]>; addEventListener(t: 'controllerchange', fn: () => void): void }
  export function registerServiceWorker(opts: { db: AppDb; sync: SyncEngine; intervalMs?: number /* 3600000 */;
    container?: SwContainerLike /* navigator.serviceWorker */; reload?: () => void; doc?: Pick<Document, 'visibilityState' | 'addEventListener'> }): SwController;
  export function shouldShowUpdateBanner(i: { available: boolean; forced: boolean; activeSessionId: string | null; onboardingInProgress: boolean }): { show: boolean; dismissible: boolean };
  export const swControllerStore: { get(): SwController | null; set(c: SwController | null): void; subscribe(fn: () => void): () => void };
  export async function bootServiceWorker(o: { db: AppDb; sync: SyncEngine; fetchHealth: () => Promise<HealthResponse | null>;
    container?: SwContainerLike; killEnv?: KillSwitchEnv }): Promise<void>;
  // sw/kill-switch.ts
  export interface KillSwitchEnv { serviceWorker?: Pick<SwContainerLike, 'getRegistrations'>; caches?: CacheStorage; reload?: () => void }
  export async function applyKillSwitchIfNeeded(health: HealthResponse, env?: KillSwitchEnv): Promise<boolean>;
  // sw/persist.ts
  export async function requestPersistentStorage(db: AppDb, storage?: Pick<StorageManager, 'persist' | 'persisted'> | undefined): Promise<boolean>;
  // sw/UpdateBanner.tsx
  export function UpdateBannerView(p: { show: boolean; dismissible: boolean; onUpdate(): void; onDismiss(): void }): JSX.Element | null;
  export function UpdateBanner(): JSX.Element | null;  // branché : swControllerStore, useMe(), meta.activeSessionId
  // test/support/fake-sw-container.ts
  export interface FakeSwContainer { container: SwContainerLike; registration: SwRegistrationLike & { updateCalls: number };
    setController(on: boolean): void; installUpdate(): SwWorkerLike & { messages: PageToSw[] }; fireControllerChange(): void; unregisterCalls: number }
  export function createFakeSwContainer(o?: { controller?: boolean; waiting?: boolean; registrations?: number }): FakeSwContainer;
  ```

**Spec:** 01 R-PWA-2 (mode prompt ; recherche au lancement, au premier plan, toutes les 60 min si l'appli est visible), R-PWA-3 (jamais pendant une séance ni pendant l'onboarding), R-PWA-4 (`SKIP_WAITING` puis rechargement), R-PWA-5 (bandeau non fermable après un 426, toujours soumis à R-PWA-3), R-PWA-6 (vérification par la page au démarrage), R-VER-2 (426 → recherche de mise à jour, outbox conservée), R-SYN-31 (`persist()` en fin d'onboarding, résultat dans `meta.persistGranted`) ; 02 R-CPT-2 (`persist()` à la création du compte). L'affichage du résultat dans Réglages relève de la partie web (T34).

- [ ] **Step 1: Write the failing test**

`apps/web/test/sw/update-banner-rules.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { shouldShowUpdateBanner } from '../../src/sw/register';

describe('shouldShowUpdateBanner', () => {
  it.each([
    // available, forced, activeSessionId, onboardingInProgress → show, dismissible
    [false, false, null, false, false, true],
    [true, false, null, false, true, true],
    [true, true, null, false, true, false],
    [true, false, 's1', false, false, true],
    [true, true, 's1', false, false, false],
    [true, true, null, true, false, false],
    [true, false, null, true, false, true],
    [false, true, null, false, false, false],
  ] as const)('available=%s forced=%s session=%s onboarding=%s', (available, forced, activeSessionId, onboardingInProgress, show, dismissible) => {
    expect(shouldShowUpdateBanner({ available, forced, activeSessionId, onboardingInProgress })).toEqual({ show, dismissible });
  });
});
```

`apps/web/test/sw/register.test.ts` (fake timers, `createFakeSwContainer`, `createTestLocalDb`, faux `SyncEngine` dont `subscribe` mémorise l'abonné et `getState()` renvoie `connection: 'online'`, faux `doc` avec `visibilityState` modifiable et `addEventListener` mémorisé) :
```ts
it('enregistre /sw.js avec scope / et updateViaCache none, puis cherche une mise à jour au lancement', async () => {
  const f = createFakeSwContainer({ controller: true });
  registerServiceWorker({ db, sync, container: f.container, doc, reload });
  await vi.advanceTimersByTimeAsync(0);
  expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  expect(f.registration.updateCalls).toBe(1);
});
it('cherche au retour au premier plan, pas quand la page passe en arrière-plan', async () => {
  doc.visibilityState = 'visible'; fireVisibility(); expect(f.registration.updateCalls).toBe(2);
  doc.visibilityState = 'hidden'; fireVisibility(); expect(f.registration.updateCalls).toBe(2);
});
it('cherche toutes les 60 min si la page est visible (défaut 3 600 000 ms)', async () => {
  doc.visibilityState = 'visible'; await vi.advanceTimersByTimeAsync(3_600_000); expect(f.registration.updateCalls).toBe(2);
  doc.visibilityState = 'hidden'; await vi.advanceTimersByTimeAsync(3_600_000); expect(f.registration.updateCalls).toBe(2);
});
it('available : vrai si un SW attend et qu’un contrôleur existe ; faux à la première installation', async () => {
  // { controller: true, waiting: true } → getState().available === true
  // { controller: false, waiting: true } → false
});
it('notifie available quand une mise à jour s’installe', async () => {
  const seen: UpdateState[] = []; c.subscribe((s) => seen.push(s));
  f.installUpdate(); await vi.advanceTimersByTimeAsync(0);
  expect(seen.at(-1)).toEqual({ available: true, forced: false });
});
it('applyUpdate envoie SKIP_WAITING puis recharge une seule fois au controllerchange', async () => {
  const w = f.installUpdate(); await c.applyUpdate();
  expect(w.messages).toEqual([{ type: 'SKIP_WAITING' }]); expect(reload).not.toHaveBeenCalled();
  f.fireControllerChange(); f.fireControllerChange(); expect(reload).toHaveBeenCalledTimes(1);
});
it('un controllerchange sans applyUpdate (première prise de contrôle) ne recharge pas', () => {
  f.fireControllerChange(); expect(reload).not.toHaveBeenCalled();
});
it('applyUpdate ne fait rien pendant une séance (meta.activeSessionId)', async () => {
  await setMeta(db, 'activeSessionId', '0192f000-0000-7000-8000-00000000f001');
  const w = f.installUpdate(); await c.applyUpdate(); expect(w.messages).toEqual([]);
});
it('un état de synchro protocol_unsupported force le bandeau et relance la recherche', async () => {
  emitSync({ connection: 'protocol_unsupported' });
  expect(c.getState().forced).toBe(true); expect(f.registration.updateCalls).toBe(2);
});
it('sans service worker dans le navigateur : contrôleur inerte', async () => {
  const c2 = registerServiceWorker({ db, sync, container: undefined, doc, reload });
  expect(c2.getState()).toEqual({ available: false, forced: false });
  await expect(c2.checkForUpdate()).resolves.toBeUndefined(); await expect(c2.applyUpdate()).resolves.toBeUndefined();
});
it('bootServiceWorker : swKill vrai → aucun enregistrement (pas de boucle)', async () => {
  await bootServiceWorker({ db, sync, container: f.container, fetchHealth: async () => ({ ...HEALTH, swKill: true }), killEnv: { serviceWorker: f.container, caches: createFakeCacheStorage(), reload } });
  expect(registerSpy).not.toHaveBeenCalled(); expect(swControllerStore.get()).toBeNull();
});
it('bootServiceWorker : sonde en échec (hors ligne) ou swKill faux → enregistrement et contrôleur publié', async () => {
  for (const h of [null, { ...HEALTH, swKill: false }]) { /* fetchHealth → h ; registerSpy appelé ; swControllerStore.get() non nul */ }
});
```
Le fichier définit `HEALTH = { status: 'ok', version: 'dev', db: 'ok', protocol: 1, minProtocol: 1, epoch: 'e', swKill: false }`. Chaque test remet `swControllerStore.set(null)` à zéro.

`apps/web/test/sw/kill-switch.test.ts` (avec `fake-indexeddb/auto` et `createFakeCacheStorage` de T36) :
```ts
it('swKill faux : rien ne change', async () => {
  expect(await applyKillSwitchIfNeeded({ ...HEALTH, swKill: false }, env)).toBe(false);
  expect(f.unregisterCalls).toBe(0); expect(reload).not.toHaveBeenCalled();
});
it('swKill vrai : désenregistre, vide shell-* et illustrations-*, recharge, IndexedDB intact', async () => {
  const db = createTestLocalDb('ks'); await setMeta(db, 'userId', 'u1');
  for (const n of ['shell-aaaaaaaaaaaa', ILLUSTRATIONS_CACHE, 'autre']) await caches.open(n);
  expect(await applyKillSwitchIfNeeded({ ...HEALTH, swKill: true }, { serviceWorker: f.container, caches, reload })).toBe(true);
  expect(f.unregisterCalls).toBe(1); expect(await caches.keys()).toEqual(['autre']); expect(reload).toHaveBeenCalledTimes(1);
  expect(await getMeta(db, 'userId')).toBe('u1');
});
it('swKill vrai mais rien à nettoyer : pas de rechargement (pas de boucle)', async () => {
  const f0 = createFakeSwContainer({ registrations: 0 });
  expect(await applyKillSwitchIfNeeded({ ...HEALTH, swKill: true }, { serviceWorker: f0.container, caches: createFakeCacheStorage(), reload })).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});
```

`apps/web/test/sw/persist.test.ts` :
```ts
it.each([
  ['API absente', undefined, false],
  ['déjà persistant', { persisted: async () => true, persist: vi.fn(async () => false) }, true],
  ['accordé', { persisted: async () => false, persist: async () => true }, true],
  ['refusé', { persisted: async () => false, persist: async () => false }, false],
  ['erreur', { persisted: async () => false, persist: async () => { throw new Error('x'); } }, false],
])('%s', async (_n, storage, expected) => {
  const db = createTestLocalDb();
  expect(await requestPersistentStorage(db, storage as never)).toBe(expected);
  expect(await getMeta(db, 'persistGranted')).toBe(expected);
});
it('déjà persistant : persist() n’est pas rappelé', async () => { /* persist spy non appelé */ });
```

`apps/web/test/sw/UpdateBanner.test.tsx` (Testing Library, `UpdateBannerView` seul) :
```ts
it('rien quand show est faux', () => { render(<UpdateBannerView show={false} dismissible onUpdate={vi.fn()} onDismiss={vi.fn()} />); expect(screen.queryByTestId('update-banner')).toBeNull(); });
it('bandeau fermable', async () => {
  const onUpdate = vi.fn(); const onDismiss = vi.fn();
  render(<UpdateBannerView show dismissible onUpdate={onUpdate} onDismiss={onDismiss} />);
  const b = screen.getByTestId('update-banner'); expect(b).toHaveAttribute('data-dismissible', 'true');
  expect(b).toHaveTextContent('Nouvelle version disponible');
  await userEvent.click(screen.getByRole('button', { name: 'Mettre à jour' })); expect(onUpdate).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Plus tard' })); expect(onDismiss).toHaveBeenCalledOnce();
});
it('bandeau forcé : non fermable, avec le motif', () => {
  render(<UpdateBannerView show dismissible={false} onUpdate={vi.fn()} onDismiss={vi.fn()} />);
  expect(screen.getByTestId('update-banner')).toHaveAttribute('data-dismissible', 'false');
  expect(screen.queryByRole('button', { name: 'Plus tard' })).toBeNull();
  expect(screen.getByTestId('update-banner')).toHaveTextContent('Mets à jour l’appli pour reprendre la synchronisation.');
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- update-banner-rules register kill-switch persist UpdateBanner` → échec : `Failed to resolve import "../../src/sw/register"` (et les modules équivalents).

- [ ] **Step 3: Implement**

- `fake-sw-container.ts` :
  - `register` enregistre ses arguments (exposés pour `registerSpy`) et renvoie la registration simulée ;
  - `installUpdate()` crée un worker `installing` et émet `updatefound`. Le worker passe ensuite à `state = 'installed'` et émet `statechange`, puis la registration le place dans `waiting`. Son `postMessage` ajoute le message à `messages` ;
  - `getRegistrations()` renvoie `registrations` (1 par défaut) objets dont `unregister` incrémente `unregisterCalls`.
- `register.ts` :
  - `shouldShowUpdateBanner` : `show = available && activeSessionId === null && !onboardingInProgress` et `dismissible = !forced` ;
  - `registerServiceWorker` :
    - si `container` est absent, renvoie un contrôleur inerte ;
    - sinon, appelle `register('/sw.js', { scope: '/', updateViaCache: 'none' })`, puis `available = !!reg.waiting && container.controller != null`, puis `checkForUpdate()` (déclencheur « lancement ») ;
    - sur `updatefound`, le worker `installing` passe à `installed` et, si un contrôleur existe, `available` devient vrai ;
    - `visibilitychange` vers `visible` déclenche `checkForUpdate()`. Un `setInterval(intervalMs)` appelle `checkForUpdate()` seulement si `doc.visibilityState === 'visible'` ;
    - `sync.subscribe` : le premier passage à `connection === 'protocol_unsupported'` appelle `markForced()` puis `checkForUpdate()` ;
    - `checkForUpdate` appelle `reg.update()` et avale les erreurs ;
    - `applyUpdate` :
      - ne fait rien si `getMeta(db, 'activeSessionId')` est renseigné ou si aucun worker n'attend ;
      - sinon, met un indicateur `reloading`, puis `waiting.postMessage({ type: 'SKIP_WAITING' })` ;
      - `controllerchange` recharge une seule fois (`reload`, par défaut `() => location.reload()`), et seulement si `reloading` est posé.
  - `swControllerStore` : un magasin en mémoire, lu par `useSyncExternalStore`.
  - `bootServiceWorker` :
    - `h = await fetchHealth()` ;
    - si `h?.swKill`, appelle `applyKillSwitchIfNeeded(h, killEnv)` et s'arrête **sans** enregistrer ;
    - sinon, appelle `swControllerStore.set(registerServiceWorker({ db, sync, container }))`.
- `kill-switch.ts` :
  - ne fait rien si `!health.swKill` ;
  - sinon, désenregistre chaque registration de `getRegistrations()`, supprime les caches dont le nom commence par `SHELL_CACHE_PREFIX` ou `illustrations-`, puis recharge **seulement** si au moins un désenregistrement ou une suppression a eu lieu, et renvoie ce booléen ;
  - ne touche jamais `indexedDB`.
  - Valeurs par défaut : `navigator.serviceWorker`, `globalThis.caches`, `location.reload`.
- `persist.ts` :
  - avec `storage` par défaut `navigator.storage`, `granted = (await storage.persisted()) || (await storage.persist())`. Une exception ou une API absente donne `false` ;
  - écrit toujours `setMeta(db, 'persistGranted', granted)`, puis renvoie `granted`.
- `UpdateBanner.tsx` :
  - **`UpdateBannerView`** : `<div role="status" data-testid="update-banner" data-dismissible=…>`. Il contient le texte « Nouvelle version disponible », complété par « Mets à jour l’appli pour reprendre la synchronisation. » s'il n'est pas fermable, le bouton « Mettre à jour » et, s'il est fermable, le bouton « Plus tard ».
  - **`UpdateBanner`** :
    - lit le contrôleur avec `useSyncExternalStore(swControllerStore…)`, puis son état avec `subscribe` ;
    - lit `me` avec `useMe()`, d'où `onboardingInProgress = me !== null && me.onboardingCompletedAt === null` ;
    - lit `activeSessionId` avec `liveQuery(() => getMeta(db, 'activeSessionId'))` de Dexie, à travers l'API `local-db/meta` et jamais par une table brute ;
    - garde un état local `dismissed`, ignoré si `forced`, et rend `null` sans contrôleur.
- `main.tsx` (fichier de T28) :
  - après la création des `services` et le rendu, ajouter `if (import.meta.env.PROD) void bootServiceWorker({ db: services.db, sync: services.sync, fetchHealth })` ;
  - `fetchHealth` vaut `() => fetchWithTimeout(browserTransport(), '/api/health', { method: 'GET' }).then((r) => r.json()).then((j) => HealthResponse.parse(j)).catch(() => null)`. Le JSON est lu même sur un 503 ;
  - le rendu n'attend pas la sonde.
- `AppShell.tsx` : `<UpdateBanner />` en premier enfant.
- `CreateAccountForm.tsx` et `ReadyStep.tsx` : `void requestPersistentStorage(useServices().db)` juste après la réponse de succès de l'API, sans bloquer la navigation. Le câblage est vérifié par l'E2E de la Task 38 (`meta.persistGranted` booléen).

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- update-banner-rules register kill-switch persist UpdateBanner` → `Test Files 5 passed` ; `pnpm --filter @appsport/web test` → aucun test existant de T28 à T34 en échec ; `pnpm lint && pnpm typecheck` → sans erreur.

- [ ] **Step 5: Commit**

`git add apps/web/src/sw apps/web/src/main.tsx apps/web/src/ui/AppShell.tsx apps/web/src/features/auth/CreateAccountForm.tsx apps/web/src/features/onboarding/ReadyStep.tsx apps/web/test && git commit -m "feat(pwa): mises à jour en mode prompt, interrupteur d'urgence et stockage persistant"`

---

### Task 38: E2E Playwright : harnais, arrivée et hors ligne (Chromium et WebKit)

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/support/server.ts` (serveur, proxy à pannes et CLI)
- Create: `apps/web/e2e/support/fixtures.ts`, `apps/web/e2e/support/pwa.ts`, `apps/web/e2e/support/flows.ts`, `apps/web/e2e/support/global-setup.ts`
- Create: `apps/web/e2e/arrival.spec.ts`, `apps/web/e2e/offline.spec.ts`
- Modify: `apps/web/package.json` (`"test:e2e": "playwright test"` ; devDependency `@playwright/test` 1.6x)
- Modify: `.github/workflows/ci.yml` (job `e2e`)

**Interfaces:**
- Consumes :
  - CLI `init` et `admin:bootstrap --birth-date` (T7, T11), avec la sortie à 3 lignes « Lien : … » et « Code : … » ;
  - `POST /api/admin/invitations` → `CreateInvitationResponse` (T11) ;
  - `SwStatus` (T34) ; `OutboxOp` et `LOCAL_DB_VERSION` (T25) ; `SYNC_PROTOCOL` (T2) ;
  - routes et `data-testid` de la partie web : `offline-ready`, `connection-status`, `pending-counter`, `rejected-counter`, `onboarding-step`, `update-banner` ;
  - libellés « Créer mon compte », « Suivant », « Commencer », « Réessayer ».
- Produces :
  ```ts
  // e2e/support/server.ts
  export type E2EFault = null | { kind: 'blackhole' } | { kind: 'status'; pathPrefix: string; status: number; body: unknown };
  export interface E2EServer { url: string; dataDir: string; publicDir: string; stop(): Promise<void>; restart(env?: Record<string, string>): Promise<void>;
    cli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }>; setFault(f: E2EFault): void }
  export async function startE2EServer(opts?: { env?: Record<string, string>; publicDir?: string; port?: number }): Promise<E2EServer>;
  export async function bootstrapAdminInvitation(s: E2EServer, birthDate?: string /* '1990-01-01' */): Promise<{ code: string; link: string }>;
  export const REPO_ROOT: string; export const DEFAULT_PUBLIC_DIR: string; // apps/web/dist
  // e2e/support/fixtures.ts
  export const test: TestType<{ serverOptions: Parameters<typeof startE2EServer>[0]; server: E2EServer }, {}>; export { expect } from '@playwright/test';
  // e2e/support/pwa.ts
  export async function emulateStandalone(context: BrowserContext): Promise<void>;
  export async function requireServiceWorker(page: Page): Promise<void>;     // test.skip si 'serviceWorker' absent (WebKit sous Windows)
  export async function waitForController(page: Page): Promise<void>;
  export async function swStatus(page: Page): Promise<SwStatus | null>;
  export async function waitForWaitingWorker(page: Page): Promise<void>;
  export async function registrationCount(page: Page): Promise<number>;
  export async function cacheNames(page: Page): Promise<string[]>;
  export async function idbGetAll<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]>;
  export async function idbPut(page: Page, store: string, value: unknown): Promise<void>;
  export async function idbVersion(page: Page): Promise<number>;
  export async function metaValue(page: Page, key: string): Promise<unknown>;
  export async function triggerForeground(page: Page): Promise<void>;
  export function fakeOutboxOp(userId: string, n?: number): OutboxOp;
  // e2e/support/flows.ts
  export const E2E_PASSWORD = 'cheval agrafe batterie correcte';
  export async function createAccountViaUi(page: Page, username: string): Promise<void>;
  export async function completeOnboardingViaUi(page: Page, o: { place: { kind: 'gym'; name: string; city: string } | { kind: 'home' } }): Promise<void>;
  export async function setupOnboardedAdmin(server: E2EServer, context: BrowserContext, username?: string /* 'camille' */): Promise<Page>;
  ```

**Spec:**
- 01 §9.1.6, scénarios 1 et 2 sans séance : la séance relève de la brique 3 ;
- 01 R-SYN-30 : 4 s, jamais `navigator.onLine` ;
- 01 R-SYN-33, et 02 §8 E8 : « Prêt hors ligne » exigé avant « Commencer » ;
- 01 R-TST-1 : E2E Chromium et WebKit bloquants ;
- 02 R-ARR-1, R-INV-4 et R-INV-5 : lien et code saisi ;
- 02 R-AUTH-6 et Global Constraints : cookie `dev-session` et contrôle `Origin` ;
- 02 R-CPT-2 et 01 R-SYN-31 : `meta.persistGranted` ;
- 02 §1.4 : hors ligne, le profil est lisible et sa modification est refusée ;
- Review Focus 5 : WebKit, origine et cookie.

- [ ] **Step 1: Write the failing test**

`apps/web/e2e/arrival.spec.ts` :
```ts
import { expect, test } from './support/fixtures';
import { bootstrapAdminInvitation } from './support/server';
import { createAccountViaUi, completeOnboardingViaUi, E2E_PASSWORD } from './support/flows';
import { emulateStandalone, metaValue, requireServiceWorker, swStatus, waitForController } from './support/pwa';

test('arrivée : admin par lien, onboarding, Prêt hors ligne ; cookie et Origin ; membre par code dans un second contexte', async ({ server, context, browser, page }, testInfo) => {
  await test.step('admin par lien en mode installé', async () => {
    await emulateStandalone(context);
    const inv = await bootstrapAdminInvitation(server);
    await page.goto(inv.link);
    await requireServiceWorker(page);
    await createAccountViaUi(page, 'camille');
    await expect(page.getByTestId('onboarding-step')).toHaveAttribute('data-step', 'goal');
    await completeOnboardingViaUi(page, { place: { kind: 'gym', name: 'Fitness Park Nation', city: 'Paris' } });
    await expect(page).toHaveURL(`${server.url}/`);
    await waitForController(page);
    expect((await swStatus(page))?.shellCached).toBe(true);
    expect(typeof (await metaValue(page, 'persistGranted'))).toBe('boolean');
  });
  await test.step('cookie dev-session sans Secure et contrôle Origin (Review Focus 5)', async () => {
    const cookies = await context.cookies(server.url);
    const s = cookies.find((c) => c.name === 'dev-session');
    expect(s).toMatchObject({ httpOnly: true, secure: false, sameSite: 'Lax', path: '/' });
    expect(cookies.find((c) => c.name === '__Host-session')).toBeUndefined();
    const ok = await page.evaluate(() => fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'camille' }) }).then((r) => r.status));
    expect(ok).toBe(200);
    const bad = await page.request.fetch(`${server.url}/api/me`, { method: 'PATCH', headers: { Origin: 'http://evil.example', 'Content-Type': 'application/json' }, data: { username: 'camille' } });
    expect(bad.status()).toBe(403);
    expect(await bad.json()).toEqual({ error: 'origin_mismatch' });
  });
  await test.step('invitation membre saisie comme code dans un second contexte', async () => {
    const created = await page.evaluate(() => fetch('/api/admin/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthDate: '1995-06-01', note: 'Léa' }) }).then((r) => r.json()));
    const ctx2 = await browser.newContext({ ...testInfo.project.use });
    await emulateStandalone(ctx2);
    const p2 = await ctx2.newPage();
    await p2.goto(`${server.url}/invite`);
    await p2.getByLabel('Lien ou code d’invitation').fill(created.code.toLowerCase().replaceAll('-', ' '));  // R-INV-5
    await p2.getByRole('button', { name: 'Suivant' }).click();
    await createAccountViaUi(p2, 'lea');
    await completeOnboardingViaUi(p2, { place: { kind: 'home' } });
    await expect(p2).toHaveURL(`${server.url}/`);
    await ctx2.close();
  });
});
```

`apps/web/e2e/offline.spec.ts` :
```ts
test('hors ligne simulé : rechargement à froid, profil lisible, modification refusée, retour du réseau', async ({ server, context }) => {
  const page = await setupOnboardedAdmin(server, context);
  await requireServiceWorker(page); await waitForController(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'offline', { timeout: 5000 });
  await page.goto(`${server.url}/profile`);
  await expect(page.getByText('camille')).toBeVisible();
  await page.getByLabel('Pseudo').fill('camille2');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Nécessite le réseau')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
});

test('serveur injoignable (requêtes sans réponse) : coquille à 4 s, « hors ligne » en 5 s au plus, sans navigator.onLine', async ({ server, context }) => {
  const page = await setupOnboardedAdmin(server, context);
  await requireServiceWorker(page); await waitForController(page);
  server.setFault({ kind: 'blackhole' });
  await page.reload();                                                   // SW : délai de 4 s puis index.html en cache
  const status = page.getByTestId('connection-status');
  await status.waitFor({ state: 'attached' });
  const t0 = Date.now();
  await expect(status).toHaveAttribute('data-state', 'offline', { timeout: 6000 });
  expect(Date.now() - t0).toBeLessThanOrEqual(5000);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(page.getByText('camille')).toBeVisible({ timeout: 1 });   // remplacé par la vue profil, voir ci-dessous
  await page.goto(`${server.url}/profile`);
  await expect(page.getByText('camille')).toBeVisible();
  server.setFault(null);
  await triggerForeground(page);
  await expect(status).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
});
```
Dans le second test, la ligne marquée « remplacé » ne doit pas être écrite. La lecture du profil se fait uniquement après `page.goto('/profile')`, comme dans le premier test.

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test:e2e -- arrival offline` → échec : `Missing script: test:e2e`, puis, une fois le script ajouté, `Cannot find module './support/fixtures'`.

- [ ] **Step 3: Implement**

- **`playwright.config.ts`** :
  - `testDir: './e2e'`, `testMatch: '*.spec.ts'`, `globalSetup: './e2e/support/global-setup.ts'` ;
  - `fullyParallel: false`, `workers: 1`, `timeout: 120_000`, `expect: { timeout: 10_000 }`, `retries: process.env.CI ? 1 : 0` ;
  - `reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]` ;
  - `use: { serviceWorkers: 'allow', locale: 'fr-FR', timezoneId: 'Europe/Paris', trace: 'retain-on-failure' }` ;
  - `projects` : `{ name: 'chromium', use: { ...devices['Pixel 7'] } }` et `{ name: 'webkit', use: { ...devices['iPhone 14'] } }`.
- **`global-setup.ts`** : `build({ configFile: <apps/web>/vite.config.ts, root: <apps/web>, logLevel: 'warn' })` (API JS de Vite) vers `apps/web/dist`, puis création de `.e2e-data/` à la racine du dépôt.
- **`server.ts`** :
  - `REPO_ROOT` est calculé depuis `import.meta.url` ;
  - `startE2EServer` :
    1. réserve deux ports libres (`net.createServer().listen(0)`) : `proxyPort` (ou `opts.port`) et `backendPort` ;
    2. crée `dataDir = <REPO_ROOT>/.e2e-data/<horodatage>-<aléa>` et y écrit le fichier vide `.appsport-volume` ;
    3. fixe l'environnement : `APP_ORIGIN=http://localhost:<proxyPort>`, `PORT=<backendPort>`, `HOST=127.0.0.1`, `APPSPORT_DATA_DIR=dataDir`, `APPSPORT_PUBLIC_DIR=opts.publicDir ?? DEFAULT_PUBLIC_DIR`, `APPSPORT_CONTENT_DIR=<REPO_ROOT>/data`, `APP_VERSION=e2e`, plus `opts.env` ;
    4. exécute `cli(['init'])` puis lance le service : `spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: <REPO_ROOT>/apps/server, env })` ;
    5. attend `GET /api/health` = 200 (sondage toutes les 100 ms, 30 s au plus).
  - **`cli(args)`** : même commande avec `args`, et collecte de stdout et stderr.
  - **Proxy `node:http`** sur `proxyPort` : il relaie méthode, chemin, en-têtes (dont `Host`, `Origin` et `Cookie`) et corps vers le backend, en flux. Selon la panne :
    - `blackhole` : il garde la requête ouverte sans répondre et mémorise la socket ;
    - `status` : il répond `status` avec `JSON.stringify(body)` en `application/json` pour tout chemin qui commence par `pathPrefix` ;
    - backend arrêté : il répond 502.
  - **`setFault(null)`** détruit les sockets retenues.
  - **`restart(env)`** fusionne `env` dans l'environnement de base. Une valeur `''` supprime la variable. Il arrête l'enfant (`kill()`, attente de `exit`), le relance et attend la santé. Le port du proxy et l'URL ne changent pas.
  - **`stop()`** arrête l'enfant et le proxy, sans effacer `dataDir`.
  - **`bootstrapAdminInvitation`** lance `cli(['admin:bootstrap', '--birth-date', birthDate ?? '1990-01-01'])` et lit les lignes `Lien : ` et `Code : `. Si le code de sortie n'est pas 0, la fonction lève une erreur avec stderr.
- **`fixtures.ts`** : `base.extend` avec `serverOptions: [{}, { option: true }]` et `server: async ({ serverOptions }, use) => { const s = await startE2EServer(serverOptions); await use(s); await s.stop(); }`.
- **`pwa.ts`** :
  - `emulateStandalone` : `context.addInitScript` remplace `window.matchMedia` pour que `(display-mode: standalone)` renvoie `matches: true`, et définit `navigator.standalone = true`.
  - `requireServiceWorker` : `test.skip(!(await page.evaluate(() => 'serviceWorker' in navigator)), 'Service worker indisponible dans ce navigateur (WebKit sous Windows) : la CI Linux fait foi')`.
  - `waitForController` : `page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 })`.
  - `swStatus` : un `MessageChannel` est posté sur `navigator.serviceWorker.controller` avec `{ type: 'GET_STATUS' }`. La fonction renvoie `null` sans contrôleur ou après 3 s.
  - `waitForWaitingWorker` : interroge `getRegistration().waiting` toutes les 500 ms pendant 30 s et appelle `triggerForeground` toutes les 5 s.
  - `registrationCount` : `(await navigator.serviceWorker.getRegistrations()).length`.
  - `cacheNames` : `caches.keys()`.
  - Accès IndexedDB brut : `indexedDB.open('appsport')` sans version, puis `getAll` ou `put`. `idbVersion` renvoie `db.version` (Dexie stocke `LOCAL_DB_VERSION * 10`). `metaValue(k)` lit `meta[k].value`.
  - `triggerForeground` : `document.dispatchEvent(new Event('visibilitychange'))`.
  - `fakeOutboxOp(userId, n = 1)` : opération figée et valide pour `SyncOp`, `{ opId: '0192f000-0000-7000-8000-0000000000a' + n, userId, entity: 'sync_rejection', id: '0192f000-0000-7000-8000-00000000000' + n, kind: 'patch', fields: { dismissedAt: '2026-10-06T10:00:00.000Z' }, clientTs: '2026-10-06T10:00:00.000Z', protocol: SYNC_PROTOCOL, attempts: 0 }`.
- **`flows.ts`** : les sélecteurs suivent les composants de T30 à T32, qui sont la source de vérité. En cas d'écart de libellé, on aligne le test sur le composant, sans modifier le composant. Les libellés attendus sont les suivants.
  - **Création du compte** : `getByLabel('Pseudo')`, `getByLabel('Mot de passe', { exact: true })`, `getByLabel('Confirmer le mot de passe')`, case `getByLabel(/J’ai lu la page Confidentialité et règles/)`, puis bouton « Créer mon compte ».
  - **Onboarding (`completeOnboardingViaUi`)** : le flux attend `onboarding-step` sur chaque `data-step`, puis clique sur « Suivant ».
    - `goal` : « Prendre du muscle ».
    - `sport` : « Non ».
    - `place_kind` : « À la salle » ou « À la maison ».
    - `place` :
      - salle : « Ma salle n’est pas dans la liste », puis « Nom » et « Ville », le préréglage « Petite salle de quartier » et la validation de la liste ;
      - maison : le préréglage par défaut.
    - `experience` : « Jamais ».
    - `availability` : « 3 » et « 45 min ».
    - `health` : aucune réponse.
    - `ready` : `expect(offline-ready).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })`, puis « Commencer ».
  - **`setupOnboardedAdmin`** : `emulateStandalone`, invitation d'amorçage, `goto(link)`, création du compte, onboarding en salle « Salle E2E » à « Paris ». La fonction renvoie la page sur `/`.
- **`apps/web/package.json`** : `"test:e2e": "playwright test"` et devDependency `@playwright/test`.
- **`ci.yml`**, job `e2e`. Il est bloquant (R-TST-1). Le build est fait par `global-setup`.
  ```yaml
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .node-version, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @appsport/web exec playwright install --with-deps chromium webkit
      - run: pnpm --filter @appsport/web test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: "apps/web/playwright-report\napps/web/test-results" }
  ```

- [ ] **Step 4: Run test to verify it passes**

Commande : `pnpm --filter @appsport/web exec playwright install chromium webkit`, puis `pnpm --filter @appsport/web test:e2e -- arrival offline`. Sortie attendue : `4 passed`, soit 2 specs × 2 projets. Sous Windows, si WebKit n'a pas de service worker, la sortie est `2 passed, 2 skipped`. La CI Linux doit afficher `4 passed`.

- [ ] **Step 5: Commit**

`git add apps/web/playwright.config.ts apps/web/e2e apps/web/package.json .github/workflows/ci.yml pnpm-lock.yaml && git commit -m "test(pwa): harnais E2E, arrivée et hors ligne sous Chromium et WebKit"`

---

### Task 39: E2E : mise à jour A → B, interrupteur d'urgence et 426

**Files:**
- Create: `apps/web/e2e/support/builds.ts`
- Create: `apps/web/e2e/update.spec.ts`, `apps/web/e2e/kill-switch.spec.ts`, `apps/web/e2e/protocol.spec.ts`
- Modify: `apps/web/e2e/support/global-setup.ts` (appel de `buildTwice()`)

**Interfaces:**
- Consumes :
  - Task 38 : `test` et `expect` (fixtures), avec `serverOptions` ; `E2EServer` (`restart`, `setFault`) ; `setupOnboardedAdmin` ; `requireServiceWorker`, `waitForController`, `swStatus`, `waitForWaitingWorker`, `registrationCount`, `cacheNames`, `idbGetAll`, `idbPut`, `idbVersion`, `metaValue`, `triggerForeground`, `fakeOutboxOp` ;
  - `LOCAL_DB_VERSION` (T25) ; `precachePlugin` (T35), utilisé par le build.
- Produces :
  ```ts
  // e2e/support/builds.ts
  export interface E2EBuild { label: 'A' | 'B'; dir: string; buildHash: string }
  export const BUILD_DIRS: { A: string; B: string };               // <REPO_ROOT>/.e2e-data/builds/{A,B}
  export async function readBuildHash(dir: string): Promise<string>; // première ligne de sw.js
  export async function buildTwice(): Promise<{ a: E2EBuild; b: E2EBuild }>; // écrit .e2e-data/builds/builds.json
  export async function loadBuilds(): Promise<{ a: E2EBuild; b: E2EBuild }>;  // lit builds.json
  ```

**Spec:**
- 01 §9.1.6, scénarios 4, 5 et 6 ;
- 01 R-PWA-2 à R-PWA-6 ;
- 01 R-VER-2 : 426, puis recherche de mise à jour, puis outbox conservée ;
- 01 R-VER-4 : aucune opération jetée pour une raison de version ;
- 01 R-VER-5 : version Dexie courante après la mise à jour ;
- Review Focus 5 : rechargement à froid hors ligne pendant que B attend, bandeau masqué pendant une séance et non fermable après un 426, anciens `shell-*` purgés, Dexie intact, interrupteur qui ne touche pas IndexedDB.

- [ ] **Step 1: Write the failing test**

`apps/web/e2e/update.spec.ts` :
```ts
import { LOCAL_DB_VERSION } from '../src/local-db/db';
import { BUILD_DIRS, loadBuilds } from './support/builds';
import { expect, test } from './support/fixtures';
import { setupOnboardedAdmin } from './support/flows';
import { cacheNames, fakeOutboxOp, idbGetAll, idbPut, idbVersion, metaValue, requireServiceWorker, swStatus, waitForController, waitForWaitingWorker } from './support/pwa';

test.use({ serverOptions: { publicDir: BUILD_DIRS.A } });

test('mise à jour A → B : bandeau masqué pendant la séance, coquille A hors ligne, puis B avec outbox et Dexie intacts', async ({ server, context }) => {
  const { a, b } = await loadBuilds();
  expect(a.buildHash).not.toBe(b.buildHash);
  const page = await setupOnboardedAdmin(server, context);
  await requireServiceWorker(page); await waitForController(page);
  await expect.poll(async () => (await swStatus(page))?.buildHash).toBe(a.buildHash);

  const userId = (await metaValue(page, 'userId')) as string;
  const op = fakeOutboxOp(userId);
  await idbPut(page, 'outbox', op);
  await idbPut(page, 'meta', { key: 'activeSessionId', value: '0192f000-0000-7000-8000-00000000f001' });
  server.setFault({ kind: 'status', pathPrefix: '/api/sync/push', status: 503, body: { error: 'internal' } }); // garde l’opération en file

  await server.restart({ APPSPORT_PUBLIC_DIR: b.dir });
  await page.reload();
  await waitForWaitingWorker(page);
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('update-banner')).toHaveCount(0);           // R-PWA-3 : séance en cours

  await context.setOffline(true);                                          // Review Focus 5
  await page.reload();
  await expect(page.getByTestId('connection-status')).toBeAttached();
  expect((await swStatus(page))?.buildHash).toBe(a.buildHash);
  await context.setOffline(false);

  await idbPut(page, 'meta', { key: 'activeSessionId', value: null });
  await page.reload();
  const banner = page.getByTestId('update-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('data-dismissible', 'true');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Mettre à jour' }).click()]);

  await expect.poll(async () => (await swStatus(page))?.buildHash, { timeout: 20_000 }).toBe(b.buildHash);
  expect((await idbGetAll<{ opId: string }>(page, 'outbox')).map((o) => o.opId)).toContain(op.opId);
  expect(await idbVersion(page)).toBe(LOCAL_DB_VERSION * 10);
  expect(await metaValue(page, 'userId')).toBe(userId);
  expect((await cacheNames(page)).filter((n) => n.startsWith('shell-'))).toEqual([`shell-${b.buildHash}`]);
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
  server.setFault(null);
});
```

`apps/web/e2e/protocol.spec.ts` :
```ts
test.use({ serverOptions: { publicDir: BUILD_DIRS.A } });

test('426 : saisie conservée, bandeau forcé non fermable, mise à jour, puis synchro de la file', async ({ server, context }) => {
  const { b } = await loadBuilds();
  const page = await setupOnboardedAdmin(server, context);
  await requireServiceWorker(page); await waitForController(page);
  const userId = (await metaValue(page, 'userId')) as string;
  const op = fakeOutboxOp(userId, 2);
  await idbPut(page, 'outbox', op);
  server.setFault({ kind: 'status', pathPrefix: '/api/sync/', status: 426, body: { error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 } });
  await server.restart({ APPSPORT_PUBLIC_DIR: b.dir });
  await triggerForeground(page);
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'protocol_unsupported');
  expect((await idbGetAll<{ opId: string }>(page, 'outbox')).map((o) => o.opId)).toContain(op.opId);   // R-VER-2
  const banner = page.getByTestId('update-banner');
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await expect(banner).toHaveAttribute('data-dismissible', 'false');
  await expect(page.getByRole('button', { name: 'Plus tard' })).toHaveCount(0);
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Mettre à jour' }).click()]);
  await expect.poll(async () => (await swStatus(page))?.buildHash, { timeout: 20_000 }).toBe(b.buildHash);
  server.setFault(null);
  await triggerForeground(page);
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
  await expect.poll(async () => (await idbGetAll(page, 'outbox')).length, { timeout: 15_000 }).toBe(0);
  await expect(page.getByTestId('pending-counter')).toHaveAttribute('data-count', '0');
  const dead = await idbGetAll(page, 'deadletter');
  await expect(page.getByTestId('rejected-counter')).toHaveAttribute('data-count', String(dead.length));  // jamais perdu en silence
});
```

`apps/web/e2e/kill-switch.spec.ts` :
```ts
test('interrupteur d’urgence : SW désenregistré, caches vidés, rechargement réseau, IndexedDB intact, sans boucle', async ({ server, context }) => {
  const page = await setupOnboardedAdmin(server, context);
  await requireServiceWorker(page); await waitForController(page);
  const userId = (await metaValue(page, 'userId')) as string;
  const op = fakeOutboxOp(userId, 3);
  await idbPut(page, 'outbox', op);
  server.setFault({ kind: 'status', pathPrefix: '/api/sync/push', status: 503, body: { error: 'internal' } });
  expect(await cacheNames(page)).toEqual(expect.arrayContaining(['illustrations-v1', expect.stringMatching(/^shell-[0-9a-f]{12}$/)]));

  let loads = 0; page.on('load', () => { loads += 1; });
  await server.restart({ SW_KILL_SWITCH: '1' });
  await page.reload();
  await expect.poll(() => registrationCount(page), { timeout: 15_000 }).toBe(0);
  await expect.poll(async () => (await cacheNames(page)).filter((n) => n.startsWith('shell-') || n.startsWith('illustrations-')), { timeout: 15_000 }).toEqual([]);
  await expect(page.getByTestId('connection-status')).toBeAttached();
  const settled = loads; await page.waitForTimeout(3000); expect(loads).toBe(settled);   // pas de boucle de rechargement
  expect((await idbGetAll<{ opId: string }>(page, 'outbox')).map((o) => o.opId)).toContain(op.opId);
  expect(await metaValue(page, 'userId')).toBe(userId);

  await server.restart({ SW_KILL_SWITCH: '' });
  await page.reload();
  await expect.poll(() => registrationCount(page), { timeout: 15_000 }).toBe(1);
  await waitForController(page);
  server.setFault(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test:e2e -- update protocol kill-switch` → échec : `Cannot find module './support/builds'`.

- [ ] **Step 3: Implement**

- **`builds.ts`** :
  - `BUILD_DIRS` = `<REPO_ROOT>/.e2e-data/builds/A` et `<REPO_ROOT>/.e2e-data/builds/B`.
  - `buildTwice`, pour chaque libellé L ∈ {A, B} :
    1. copie `apps/web/public` vers `<REPO_ROOT>/.e2e-data/builds/public-L` ;
    2. y écrit `e2e-build.txt` avec le contenu `L` : c'est la ressource qui diffère ;
    3. appelle `build({ configFile: <apps/web>/vite.config.ts, root: <apps/web>, publicDir: <copie>, build: { outDir: BUILD_DIRS[L], emptyOutDir: true }, logLevel: 'warn' })` (API JS de Vite) ;
    4. lit `readBuildHash`.

    La fonction écrit ensuite `builds.json` et lève une erreur si les deux `buildHash` sont égaux.
  - `readBuildHash` analyse la première ligne de `sw.js` (`self.__APPSPORT_PRECACHE__ = {…};`).
  - `loadBuilds` lit `builds.json`, et lève une erreur claire (« lancer la suite via playwright test : global-setup construit A et B ») si le fichier est absent.
- **`global-setup.ts`** : après le build de `dist` (T38), `await buildTwice()`.
- Les specs n'utilisent ni `page.route` ni `context.route`. Les pannes passent par le proxy (`setFault`), qui se comporte de la même façon sous Chromium et WebKit, avec ou sans service worker. **[décision plan]**

- [ ] **Step 4: Run test to verify it passes**

Commande : `pnpm --filter @appsport/web test:e2e`. Sortie attendue : `10 passed` sous Linux, soit 5 specs × 2 projets. Sous Windows, si WebKit n'a pas de SW, les specs WebKit dépendantes du SW sont `skipped`. Enfin, `pnpm lint && pnpm typecheck` passent sans erreur.

- [ ] **Step 5: Commit**

`git add apps/web/e2e && git commit -m "test(pwa): E2E mise à jour A vers B, interrupteur d'urgence et 426"`