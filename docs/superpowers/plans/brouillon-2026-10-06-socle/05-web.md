### Task 28: Coquille de l'appli web, client API et pages publiques

**Files:**
- Create: `packages/contracts/src/help-resources.ts`
- Modify: `packages/contracts/src/index.ts` (réexport de `help-resources`)
- Test: `packages/contracts/test/help-resources.test.ts`
- Modify: `apps/web/package.json`. Dépendances : `react@19`, `react-dom@19`, `wouter@3`, `zod@4`, `dexie@4`, `@appsport/contracts`, `@appsport/domain` (workspace). Dev : `vite@8`, `@vitejs/plugin-react`, `@testing-library/react`, `happy-dom`, `fake-indexeddb@6`, `@types/react`, `@types/react-dom`, `@appsport/server` (workspace, pour `@appsport/server/testing`).
- Modify: `vitest.config.ts`. Le projet `apps/web` reçoit `setupFiles: ['apps/web/test/setup.ts']`.
- Create: `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/src/vite-env.d.ts`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/app-services.tsx`, `apps/web/src/api/client.ts`
- Create: `apps/web/src/ui/{index.ts, AppShell.tsx, Page.tsx, Button.tsx, Field.tsx, Banner.tsx, Dialog.tsx, ChoiceList.tsx, CopyButton.tsx, HealthWarning.tsx, ui.module.css, format.ts, errors.ts, use-action.ts}`
- Create: `apps/web/src/features/public/{PrivacyPage.tsx, privacy-content.ts, CreditsPage.tsx, HelpPage.tsx, NotFound.tsx, public.module.css}`, `apps/web/src/features/home/{HomePage.tsx, home.module.css}`
- Create: `apps/web/test/setup.ts`, `apps/web/test/support/fake-api.ts`, `apps/web/test/support/render.tsx`
- Test: `apps/web/test/app/api-client.test.ts`, `apps/web/test/app/guard.test.tsx`, `apps/web/test/app/public-pages.test.tsx`, `apps/web/test/app/static-rules.test.ts`, `apps/web/test/app/ui-format.test.ts`

**Interfaces:**
- Consumes :
  - synchro T25 : `createAppDb`, `AppDb`, `getMeta`, `setMeta`, `MetaValues`, `wipeUserData` ; `createTestLocalDb(name?)` (`apps/web/test/support/local-db.ts`) ;
  - synchro T26 : `SyncTransport`, `browserTransport(baseUrl?)`, `fetchWithTimeout(t, path, init, timeoutMs?)`, `OfflineError`, `createSyncEngine`, `SyncEngine`, `SyncState`, `SyncTrigger`, `ConnectionState` ;
  - contracts : `ApiErrorCode`, `ApiErrorBody`, `MeResponse`, `PRIVACY_POLICY_VERSION`, `SYNC_PROTOCOL`, `SYNC_TIMEOUT_MS` ;
  - domain : `createMonotonicUuidV7`.
- Produces :
```ts
// packages/contracts/src/help-resources.ts
export type HelpResourceId = 'emergency' | 'pain' | 'eating_disorder' | 'doping' | 'pregnancy' | 'distress';
export interface HelpResource { id: HelpResourceId; label: string; phone: string | null /* plusieurs numéros séparés par ' / ' */;
  hours: string | null; sourceUrl: string | null; verifiedOn: string /* 'YYYY-MM-DD' */ }
export const HELP_RESOURCES: readonly HelpResource[];
// apps/web/src/api/client.ts
export class ApiError extends Error { constructor(status: number, code: ApiErrorCode, body: Record<string, unknown>); status: number; code: ApiErrorCode; body: Record<string, unknown> }
export class NetworkRequiredError extends Error {}   // message 'Nécessite le réseau'
export interface ApiClient { get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  send<T = void>(method: 'POST'|'PUT'|'PATCH'|'DELETE', path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> }
export function createApiClient(t: SyncTransport, hooks: { onUnauthenticated(): void; onAccountDeleted(): void }, opts?: { timeoutMs?: number }): ApiClient;
// apps/web/src/app-services.tsx
export interface AppServices { db: AppDb; api: ApiClient; sync: SyncEngine; transport: SyncTransport; now(): number; newOpId(): string }
export function ServicesProvider(p: { services: AppServices; children: ReactNode }): JSX.Element;
export function useServices(): AppServices;
export function useSyncState(): SyncState;
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined; // liveQuery de Dexie, seul pont réactif autorisé hors repos/
export function useMeState(): { loaded: boolean; me: MeResponse | null };
export function useMe(): MeResponse | null;
export async function handleAccountDeleted(db: AppDb, navigate: (to: string) => void): Promise<void>; // wipeUserData({keepOutbox:false}) puis navigate('/login?reason=account_deleted')
// apps/web/src/App.tsx
export const PUBLIC_PATHS: readonly string[]; // ['/login','/invite','/reset','/privacy','/credits','/help']
export type GuardResult = { kind: 'render' } | { kind: 'wait' } | { kind: 'redirect'; to: string } | { kind: 'not_found' };
export function resolveGuard(i: { path: string; loaded: boolean; me: MeResponse | null; connection: ConnectionState }): GuardResult;
export function App(): JSX.Element;
// apps/web/src/ui (réexporté par ui/index.ts)
export function AppShell(p: { children: ReactNode }): JSX.Element;   // en-tête (zone d'état) + navigation Accueil, Profil, Administration (admin seulement)
export function Page(p: { title: string; back?: string; children: ReactNode }): JSX.Element;
export function Button(p: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }): JSX.Element;
export function Field(p: { label: string; hint?: string; error?: string | null; children: ReactElement }): JSX.Element; // relie label et contrôle par useId
export function Banner(p: { tone: 'info' | 'warning' | 'error'; children: ReactNode }): JSX.Element; // role="alert" si error, sinon role="status"
export function Dialog(p: { open: boolean; title: string; onClose(): void; actions: ReactNode; children: ReactNode }): JSX.Element | null; // role="dialog" aria-modal
export function ChoiceList<T extends string | number>(p: { name: string; legend: string; value: T | null; onChange(v: T): void;
  options: readonly { value: T; label: string; disabled?: boolean }[] }): JSX.Element; // groupe de boutons radio
export function CopyButton(p: { text: string; label?: string /* 'Copier' */ }): JSX.Element;  // affiche 'Copié' 2 s
export const HEALTH_WARNING_TEXT: string;
export function HealthWarning(): JSX.Element;
export function formatDate(isoOrDate: string): string;          // '2008-03-01' → '01/03/2008' ; ISO → date de Paris
export function formatDateTime(iso: string): string;            // '06/10/2026 à 14:05' (Paris)
export function formatAge(iso: string, nowMs: number): string;  // « à l'instant » | « il y a N min » | « il y a N h » | « il y a N j »
export function plural(n: number, one: string, many: string): string;
export const ERROR_MESSAGES: Record<ApiErrorCode, string>;
export function errorMessage(e: unknown, overrides?: Partial<Record<ApiErrorCode, string>>): string;
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>, overrides?: Partial<Record<ApiErrorCode, string>>):
  { run(...a: A): Promise<R | undefined>; pending: boolean; error: string | null; code: ApiErrorCode | 'network' | 'unknown' | null; reset(): void };
// apps/web/src/features/public, home
export function PrivacyPage(): JSX.Element; export function CreditsPage(): JSX.Element; export function HelpPage(): JSX.Element;
export function NotFound(): JSX.Element; export function HomePage(): JSX.Element;
export const OWNER_FIRST_NAME: string; // privacy-content.ts : import.meta.env.VITE_OWNER_FIRST_NAME ?? "l'administrateur"
// apps/web/test/support/fake-api.ts
export interface FakeRequest { method: string; path: string; query: URLSearchParams; body: unknown; headers: Headers; init: RequestInit }
export type FakeReply = { status: number; body?: unknown; headers?: Record<string, string> };
export type FakeHandler = (req: FakeRequest) => FakeReply | Promise<FakeReply>;
export interface FakeApi { transport: SyncTransport; calls: FakeRequest[]; on(method: string, pattern: string /* '/api/gyms/:id' */, h: FakeHandler | FakeReply): FakeApi;
  setOffline(mode: false | 'reject' | 'hang'): void }  // route inconnue → 404 {error:'not_found'} ; 'reject' → TypeError immédiate ; 'hang' → attend l'abort du signal
export function createFakeApi(): FakeApi;
export type FakeSyncEngine = SyncEngine & { set(p: Partial<SyncState>): void; triggers: SyncTrigger[]; pullCount: number };
export function createFakeSyncEngine(initial?: Partial<SyncState>): FakeSyncEngine; // défaut : connection 'online', pending 0, rejected 0
// apps/web/test/support/render.tsx
export interface RenderAppOptions { path?: string; me?: MeResponse | null; api?: FakeApi; sync?: FakeSyncEngine; db?: AppDb; now?: number }
export interface RenderAppResult extends RenderResult { services: AppServices; api: FakeApi; sync: FakeSyncEngine; db: AppDb; location(): string }
export async function renderApp(opts?: RenderAppOptions): Promise<RenderAppResult>;                       // <App/> sous memoryLocation de wouter
export async function renderWithServices(ui: ReactElement, opts?: RenderAppOptions): Promise<RenderAppResult>;
export function makeMe(o?: Partial<MeResponse>): MeResponse; // défauts : id 'u-1', username 'lea', member, active, birthDate '1990-01-01', adult, onboardé le '2026-10-01T10:00:00.000Z', consentements inactifs, termsVersion '1.0'
```

**Spec:** 03 P-LOG-4, 03 §13.1, §13.5, §13.6, §13.7, 03 §17 n°15, 03 P-DRT-4 (client), 01 R-PWA-7, 01 §2 (CSS Modules, wouter), 02 §11 (structure), 07 §5.11 (HELP_RESOURCES), 06 §… (numéro 0810 absent)

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/help-resources.test.ts` :
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP_RESOURCES } from '../src/help-resources';

describe('HELP_RESOURCES', () => {
  it('contient les 6 ressources et les numéros vérifiés', () => {
    expect(HELP_RESOURCES.map((r) => r.id)).toEqual(['emergency', 'pain', 'eating_disorder', 'doping', 'pregnancy', 'distress']);
    const phone = (id: string) => HELP_RESOURCES.find((r) => r.id === id)?.phone;
    expect(phone('emergency')).toBe('15 / 112');
    expect(phone('eating_disorder')).toBe('09 69 325 900');
    expect(phone('doping')).toBe('0 800 15 2000');
    expect(phone('distress')).toBe('3114');
    expect(phone('pain')).toBeNull();
    expect(phone('pregnancy')).toBeNull();
    for (const r of HELP_RESOURCES) expect(r.verifiedOn).toBe('2026-10-06');
    expect(HELP_RESOURCES.filter((r) => r.hours !== null).map((r) => r.id)).toEqual(['distress']);
  });
  it("l'ancien numéro TCA n'apparaît nulle part dans le code", () => {
    const old = ['0810', '037', '037'].join(' ');
    const root = join(__dirname, '../../..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      if (['node_modules', 'dist', '.git'].includes(n)) return [];
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
    const files = ['apps', 'packages', 'data'].flatMap((d) => walk(join(root, d)));
    expect(files.filter((f) => readFileSync(f, 'utf8').includes(old))).toEqual([]);
  });
});
```

`apps/web/test/app/api-client.test.ts` :
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, NetworkRequiredError, createApiClient } from '../../src/api/client';
import { createFakeApi } from '../support/fake-api';

const hooks = () => ({ onUnauthenticated: vi.fn(), onAccountDeleted: vi.fn() });
afterEach(() => vi.useRealTimers());

describe('ApiClient', () => {
  it('envoie JSON, X-Appsport-Protocol et le cookie, sans forger Origin', async () => {
    const api = createFakeApi().on('POST', '/api/me/consents', { status: 204 });
    const client = createApiClient(api.transport, hooks());
    await expect(client.send('POST', '/api/me/consents', { type: 'health', textVersion: '1.0' })).resolves.toBeUndefined();
    const call = api.calls[0]!;
    expect(call.path).toBe('/api/me/consents');
    expect(call.headers.get('Content-Type')).toBe('application/json');
    expect(call.headers.get('X-Appsport-Protocol')).toBe('1');
    expect(call.headers.has('Origin')).toBe(false);
    expect(call.init.credentials).toBe('same-origin');
    expect(call.body).toEqual({ type: 'health', textVersion: '1.0' });
  });
  it('envoie {} quand il n’y a rien à transmettre', async () => {
    const api = createFakeApi().on('POST', '/api/auth/logout', { status: 204 });
    await createApiClient(api.transport, hooks()).send('POST', '/api/auth/logout');
    expect(api.calls[0]!.body).toEqual({});
  });
  it('valide la réponse avec le schéma', async () => {
    const api = createFakeApi().on('GET', '/api/x', { status: 200, body: { n: 'pas un nombre' } });
    await expect(createApiClient(api.transport, hooks()).get('/api/x', z.object({ n: z.number() }))).rejects.toThrow();
  });
  it('lève ApiError avec le code renvoyé', async () => {
    const api = createFakeApi().on('PATCH', '/api/me', { status: 409, body: { error: 'username_taken' } });
    const err = await createApiClient(api.transport, hooks()).send('PATCH', '/api/me', { username: 'max' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('username_taken');
  });
  it('lève NetworkRequiredError après 4 s sans réponse', async () => {
    vi.useFakeTimers();
    const api = createFakeApi(); api.setOffline('hang');
    const p = createApiClient(api.transport, hooks()).get('/api/me', z.unknown());
    const settled = vi.fn(); p.catch(settled);
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).rejects.toBeInstanceOf(NetworkRequiredError);
    await expect(p).rejects.toThrow('Nécessite le réseau');
  });
  it('lève NetworkRequiredError si le transport échoue', async () => {
    const api = createFakeApi(); api.setOffline('reject');
    await expect(createApiClient(api.transport, hooks()).get('/api/me', z.unknown())).rejects.toBeInstanceOf(NetworkRequiredError);
  });
  it('appelle onAccountDeleted sur 410 account_deleted, pas sur 410 watermark_expired', async () => {
    const h = hooks();
    const api = createFakeApi()
      .on('GET', '/api/a', { status: 410, body: { error: 'account_deleted' } })
      .on('GET', '/api/b', { status: 410, body: { error: 'watermark_expired' } });
    const client = createApiClient(api.transport, h);
    await client.get('/api/b', z.unknown()).catch(() => {});
    expect(h.onAccountDeleted).not.toHaveBeenCalled();
    await client.get('/api/a', z.unknown()).catch(() => {});
    expect(h.onAccountDeleted).toHaveBeenCalledTimes(1);
  });
  it('appelle onUnauthenticated sur 401', async () => {
    const h = hooks();
    const api = createFakeApi().on('GET', '/api/me', { status: 401, body: { error: 'unauthenticated' } });
    await createApiClient(api.transport, h).get('/api/me', z.unknown()).catch(() => {});
    expect(h.onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
```

`apps/web/test/app/guard.test.tsx` :
```ts
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { resolveGuard } from '../../src/App';
import { makeMe, renderApp } from '../support/render';

const me = makeMe();
const notOnboarded = makeMe({ onboardingCompletedAt: null, onboardingStep: null });
describe('resolveGuard', () => {
  it.each([
    ['/privacy', false, null, 'online', { kind: 'render' }],
    ['/help', true, null, 'offline', { kind: 'render' }],
    ['/profile', false, null, 'unknown', { kind: 'wait' }],
    ['/profile', true, null, 'online', { kind: 'redirect', to: '/login' }],
    ['/profile', true, me, 'unauthenticated', { kind: 'redirect', to: '/login' }],
    ['/profile', true, me, 'account_deleted', { kind: 'redirect', to: '/login' }],
    ['/', true, notOnboarded, 'online', { kind: 'redirect', to: '/onboarding' }],
    ['/onboarding', true, notOnboarded, 'online', { kind: 'render' }],
    ['/onboarding', true, me, 'online', { kind: 'redirect', to: '/' }],
    ['/', true, makeMe({ mustChangePassword: true }), 'online', { kind: 'redirect', to: '/profile' }],
    ['/profile', true, makeMe({ mustChangePassword: true }), 'online', { kind: 'render' }],
    ['/admin/members', true, me, 'online', { kind: 'not_found' }],
    ['/admin/members', true, makeMe({ role: 'admin' }), 'online', { kind: 'render' }],
    ['/login', true, me, 'online', { kind: 'redirect', to: '/' }],
    ['/login', true, me, 'unauthenticated', { kind: 'render' }],
    ['/invite', true, me, 'online', { kind: 'render' }],
  ] as const)('%s chargé=%s → %j', (path, loaded, m, connection, expected) => {
    expect(resolveGuard({ path, loaded, me: m, connection })).toEqual(expected);
  });
});
describe('App', () => {
  it('sert les pages publiques sans session', async () => {
    await renderApp({ path: '/privacy', me: null });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confidentialité et règles');
  });
  it('renvoie une route protégée vers /login sans session', async () => {
    const r = await renderApp({ path: '/profile', me: null });
    expect(r.location()).toBe('/login');
  });
  it("renvoie vers /onboarding tant que l'onboarding n'est pas terminé", async () => {
    const r = await renderApp({ path: '/', me: notOnboarded });
    expect(r.location()).toBe('/onboarding');
  });
  it('affiche le menu Administration au seul admin', async () => {
    await renderApp({ path: '/', me });
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });
  it('affiche le menu Administration à un admin', async () => {
    await renderApp({ path: '/', me: makeMe({ role: 'admin' }) });
    expect(screen.getByRole('link', { name: 'Administration' }).getAttribute('href')).toBe('/admin/members');
  });
  it("affiche le rappel annuel de mot de passe d'un admin", async () => {
    await renderApp({ path: '/', me: makeMe({ role: 'admin', passwordReminderDue: true }) });
    expect(screen.getByText(/Pense à changer ton mot de passe/)).toBeTruthy();
  });
});
```

`apps/web/test/app/public-pages.test.tsx` :
```ts
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../support/render';

describe('Confidentialité et règles', () => {
  it('affiche la version, P-ADM-3, les durées, les 16-17 ans et la mention médicale', async () => {
    await renderApp({ path: '/privacy', me: null });
    const text = document.body.textContent ?? '';
    expect(text).toContain('Version 1.0');
    expect(text).toContain('peut techniquement lire la base');
    expect(text).toContain("aucune requête manuelle sur les données d'une personne sans son accord");
    expect(text).toContain("l'adresse de ton compte Tailscale");
    for (const d of ['90 jours sans usage', '365 jours au maximum', '12 mois', '30 jours au plus', '7 jours', '24 h', 'TOMBSTONE'.length ? '90 jours' : ''])
      expect(text).toContain(d);
    expect(screen.getByRole('heading', { name: 'Règles pour les 16-17 ans' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Coach et mineurs' })).toBeTruthy();
    expect(text).toContain('ne remplace pas un avis médical');
  });
});
describe('Aide', () => {
  it('liste HELP_RESOURCES avec des liens tel: et la date de vérification', async () => {
    await renderApp({ path: '/help', me: null });
    const hrefs = [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['tel:15', 'tel:112', 'tel:0969325900', 'tel:0800152000', 'tel:3114']);
    const text = document.body.textContent ?? '';
    for (const n of ['15', '112', '3114', '09 69 325 900', '0 800 15 2000']) expect(text).toContain(n);
    expect(text).toContain('Numéros vérifiés le 06/10/2026');
    expect(text.match(/Horaires :/g)?.length).toBe(1);   // hours null non affiché
  });
});
describe('Crédits et page introuvable', () => {
  it('affiche les crédits sans session', async () => {
    await renderApp({ path: '/credits', me: null });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Crédits');
    expect(document.body.textContent).toContain('Aucune illustration pour le moment.');
  });
  it('affiche « Page introuvable » sur une route inconnue', async () => {
    await renderApp({ path: '/nimporte-quoi', me: null });
    expect(screen.getByText('Page introuvable')).toBeTruthy();
  });
});
```
(Retirer l'élément `'TOMBSTONE'.length ? …` : la liste exacte attendue est `['90 jours sans usage', '365 jours au maximum', '12 mois', '30 jours au plus', '7 jours', '24 h', '90 jours']`.)

`apps/web/test/app/static-rules.test.ts` :
```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const web = join(__dirname, '../..');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
describe('règles statiques', () => {
  it("index.html n'a aucun script en ligne ni ressource tierce", () => {
    const html = readFileSync(join(web, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) { expect(attrs).toMatch(/\bsrc=/); expect(body!.trim()).toBe(''); }
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).toContain('lang="fr"');
  });
  it("les CSS ne chargent rien d'un domaine tiers", () => {
    for (const f of walk(join(web, 'src')).filter((f) => f.endsWith('.css')))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/(@import|url\()\s*['"]?https?:/);
  });
  it("aucune origine n'est codée en dur dans le client (R-PWA-7)", () => {
    for (const f of walk(join(web, 'src'))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/ts\.net|localhost:\d+/);
  });
});
```

`apps/web/test/app/ui-format.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkRequiredError } from '../../src/api/client';
import { ERROR_MESSAGES, errorMessage, formatAge, formatDate, formatDateTime } from '../../src/ui';

const now = Date.parse('2026-10-06T12:00:00.000Z');
describe('format', () => {
  it('formate dates et âges', () => {
    expect(formatDate('2008-03-01')).toBe('01/03/2008');
    expect(formatDate('2026-10-05T23:30:00.000Z')).toBe('06/10/2026');
    expect(formatDateTime('2026-10-06T12:05:00.000Z')).toBe('06/10/2026 à 14:05');
    expect(formatAge('2026-10-06T11:59:30.000Z', now)).toBe("à l'instant");
    expect(formatAge('2026-10-06T11:57:00.000Z', now)).toBe('il y a 3 min');
    expect(formatAge('2026-10-06T07:00:00.000Z', now)).toBe('il y a 5 h');
    expect(formatAge('2026-10-04T12:00:00.000Z', now)).toBe('il y a 2 j');
  });
  it('traduit les erreurs', () => {
    expect(errorMessage(new NetworkRequiredError())).toBe('Nécessite le réseau');
    expect(errorMessage(new ApiError(409, 'username_taken', {}))).toBe('Ce pseudo est déjà pris.');
    expect(errorMessage(new ApiError(409, 'last_place', {}), { last_place: 'X' })).toBe('X');
    expect(errorMessage(new Error('boom'))).toBe('Une erreur inattendue est survenue.');
    for (const m of Object.values(ERROR_MESSAGES)) expect(m.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- help-resources` puis `pnpm --filter @appsport/web test -- app/` : échec attendu, car les modules `../src/help-resources`, `../../src/api/client`, `../../src/App`, `../support/render` et `index.html` sont introuvables.

- [ ] **Step 3: Implement**

- `help-resources.ts` contient, dans cet ordre :
  - `emergency` : « Urgence vitale (SAMU 15, numéro européen 112) », `'15 / 112'`, hours null, sourceUrl null ;
  - `pain` : « Douleur : consulte un médecin ou un kinésithérapeute », phone null ;
  - `eating_disorder` : « Anorexie Boulimie Info Écoute (FFAB), appel non surtaxé », `'09 69 325 900'`, hours null, `https://www.ffab.fr/500-ligne-tca-nouveau-numero` ;
  - `doping` : « Écoute Dopage », `'0 800 15 2000'`, hours null, `https://lannuaire.service-public.gouv.fr/centres-contact/R20697` ;
  - `pregnancy` : « Grossesse ou allaitement : demande conseil à ton médecin ou à une sage-femme », phone null ;
  - `distress` : « Prévention du suicide », `'3114'`, hours `'24 h/24, gratuit'`, `https://3114.fr/`.
  Toutes les entrées ont `verifiedOn` = `'2026-10-06'`.
- `api/client.ts` :
  - chaque appel passe par `fetchWithTimeout(t, path, init, opts.timeoutMs ?? SYNC_TIMEOUT_MS)`, avec les en-têtes `Content-Type: application/json` et `X-Appsport-Protocol: String(SYNC_PROTOCOL)`, et `credentials: 'same-origin'`. Les quatre méthodes d'écriture envoient `JSON.stringify(body ?? {})` ;
  - `OfflineError`, `TypeError` et `AbortError` deviennent `NetworkRequiredError('Nécessite le réseau')` ;
  - 204 → `undefined`. Si `!ok`, le corps est lu avec `ApiErrorBody.safeParse` (`internal` par défaut), puis : 401 → `hooks.onUnauthenticated()` ; 410 avec `error === 'account_deleted'` → `hooks.onAccountDeleted()` ; enfin `throw new ApiError(status, code, body)`. Sinon, la réponse est validée par `schema.parse(json)` quand un schéma est fourni.
- `app-services.tsx` :
  - `useLive` s'abonne à `liveQuery(query)` de Dexie (désabonnement au démontage) ;
  - `useMeState` = `useLive(() => getMeta(db, 'me'))`, avec `loaded` faux tant que la première lecture n'a pas répondu ;
  - `useSyncState` s'appuie sur `sync.subscribe` et `sync.getState`.
- `App.tsx` : `resolveGuard` applique les règles dans cet ordre.
  1. Chemin public : `/login` avec une session valide (`me` non nul, `connection` ∉ {`unauthenticated`,`account_deleted`}) → redirection vers `/`. Tout autre chemin public → `render`.
  2. `!loaded` → `wait`.
  3. Pas de `me`, ou `connection` ∈ {`unauthenticated`, `account_deleted`} → `/login`.
  4. `mustChangePassword` → `/profile`, sauf si on y est déjà.
  5. `onboardingCompletedAt === null` → `/onboarding`, sauf si on y est déjà. Onboarding terminé et chemin `/onboarding` → `/`.
  6. Chemin commençant par `/admin` sans rôle admin → `not_found`.
  7. Sinon → `render`.

  `App` utilise `Switch` de wouter. Les routes de cette tâche sont `/privacy`, `/credits`, `/help`, `/` (HomePage) et le repli `NotFound`. Les écrans connectés sont enveloppés dans `<AppShell>`, les pages publiques non. Les tâches 29 à 34 ajoutent chacune leurs `<Route>`.
- `main.tsx` :
  - crée `db = createAppDb()`, `transport = browserTransport()` et `sync = createSyncEngine({ db, transport, onAccountDeleted: () => navigate('/login?reason=account_deleted') })` ;
  - crée `api = createApiClient(transport, { onUnauthenticated: () => void sync.syncNow('manual'), onAccountDeleted: () => void handleAccountDeleted(db, navigate) })` ;
  - fixe `now = Date.now` et `newOpId = createMonotonicUuidV7(Date.now, (n) => crypto.getRandomValues(new Uint8Array(n)))` ;
  - appelle `sync.start()`, puis rend `<StrictMode><ServicesProvider><Router><App/></Router></ServicesProvider></StrictMode>`. `navigate` vient de `wouter/use-browser-location`.
- `index.html` : `<html lang="fr">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<title>appsport</title>`, `<div id="root"></div>` et `<script type="module" src="/src/main.tsx"></script>` uniquement.
- `vite.config.ts` : `plugins: [react()]`, `server: { port: 5173, proxy: { '/api': 'http://localhost:3000', '/illustrations': 'http://localhost:3000' } }`, `build.outDir: 'dist'`. En développement, le serveur tourne avec `APP_ORIGIN=http://localhost:5173`. Cette valeur est écrite en commentaire dans `vite.config.ts`, pas dans `src/`.
- `ui/errors.ts` : un message français par code. Exemples : `invalid_credentials` « Pseudo ou mot de passe incorrect », `account_disabled` « Compte désactivé, contacte l'administrateur », `username_taken` « Ce pseudo est déjà pris. », `under_min_age` « appsport est réservé aux 16 ans et plus », `last_admin` « Il doit rester au moins un administrateur actif. », `health_consent_required` « Cette action demande ton accord santé. », `rate_limited` « Trop d'essais. Réessaie plus tard. », `internal` « Le serveur a rencontré une erreur. ». Hors `ApiError` et `NetworkRequiredError` : « Une erreur inattendue est survenue. ».
- `HEALTH_WARNING_TEXT` = « appsport ne remplace pas un avis médical. Consultez un médecin avant de reprendre une activité si vous avez un problème de santé, et arrêtez en cas de douleur. »
- `privacy-content.ts` : sections titrées, dans l'ordre :
  1. « Qui est responsable » (`OWNER_FIRST_NAME`, contact « par message direct à l'administrateur ») ;
  2. « Données collectées et pourquoi » (C0 à C3) ;
  3. « Où sont les données » (serveur à domicile en France, États-Unis pour le coach, sauvegardes chiffrées hors du domicile) ;
  4. « Durées de conservation » (table de 03 §7, dont « 90 jours sans usage, 365 jours au maximum », « 30 jours au plus », « 12 mois », « 7 jours », « 24 h » et « 90 jours » pour les marques de suppression) ;
  5. « Ce que l'administrateur voit et ne voit pas » (table 03 §5 ; P-ADM-3 : « L'administrateur a la main sur le serveur et peut techniquement lire la base. Il s'engage à ne faire aucune requête manuelle sur les données d'une personne sans son accord. » ; « L'administrateur voit l'adresse de ton compte Tailscale, une information gérée par Tailscale. ») ;
  6. « Tes droits et comment les exercer » (Profil › Confidentialité : export, retrait, suppression) ;
  7. « Règles pour les 16-17 ans » (âge minimum 16 ans ; « Perdre du gras » non proposé ; invisible par défaut à la salle ; profil prudent ; nutrition sans chiffres ; pas d'accord parental, art. 45 de la loi Informatique et Libertés) ;
  8. « Pas un avis médical » (`HEALTH_WARNING_TEXT`) ;
  9. « Coach et mineurs » (coach à venir, envoi à Anthropic aux États-Unis seulement avec l'accord coach, garde-fous pour les 16-17 ans, bouton « Signaler »).

  `PrivacyPage` affiche `Version ${PRIVACY_POLICY_VERSION}`.
- `HelpPage` : un lien `tel:` par numéro (on découpe `phone` sur ` / ` et on retire les espaces de `href`), « Horaires : … » seulement si `hours` n'est pas nul, un lien vers la source, puis « Numéros vérifiés le 06/10/2026 » (le `verifiedOn` le plus ancien, passé à `formatDate`).
- `CreditsPage` : titre « Crédits », puis « Aucune illustration pour le moment. » La brique 2 alimentera la liste.
- `HomePage` : « Bonjour <pseudo> ». Si `me.passwordReminderDue`, `Banner` info « Pense à changer ton mot de passe (rappel annuel). »
- `test/setup.ts` : `import 'fake-indexeddb/auto'`, `afterEach(cleanup)`, `globalThis.IS_REACT_ACT_ENVIRONMENT = true`.
- `render.tsx` :
  - crée la base avec `createTestLocalDb()`. Si `me` est donné, écrit `meta.me` et `meta.userId` ;
  - monte `<ServicesProvider>` puis `<Router hook={mem.hook} searchHook={mem.searchHook}>`, avec `mem = memoryLocation({ path, record: true })` ;
  - attend `act` pour la première lecture de `meta` ;
  - `now` vaut par défaut `Date.parse('2026-10-06T12:00:00.000Z')`, `newOpId` vient de `createMonotonicUuidV7` sur cette horloge, `location()` lit la dernière entrée de `mem.history`.
- Tous les styles passent par des CSS Modules, sans attribut `style` en dur.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/contracts test -- help-resources` et `pnpm --filter @appsport/web test -- app/` : tous les tests sont verts. Puis `pnpm lint && pnpm typecheck` : aucune erreur.

- [ ] **Step 5: Commit**

`git add packages/contracts apps/web vitest.config.ts && git commit -m "feat(web): coquille de l'appli, client API et pages publiques"`

---

### Task 29: Dépôts d'accès aux données, état hors ligne et voyant « Prêt hors ligne »

**Files:**
- Create: `apps/web/src/repos/{index.ts, rows.ts, me-repo.ts, profile-repo.ts, places-repo.ts, gyms-repo.ts, consent-repo.ts, admin-repo.ts, rejections-repo.ts, status-repo.ts}`
- Create: `apps/web/src/sw/protocol.ts`, `apps/web/src/sw/sw-client.ts`
- Create: `apps/web/src/features/status/{readiness.ts, use-readiness.ts, OfflineReadyIndicator.tsx, status.module.css}`
- Modify: `apps/web/src/App.tsx` (appel de `repos.me.refresh()` au lancement), `apps/web/src/features/home/HomePage.tsx` (ajout de `<OfflineReadyIndicator/>`)
- Create: `apps/web/test/support/seed.ts`
- Test: `apps/web/test/repos/me-repo.test.ts`, `apps/web/test/repos/profile-places-gyms.test.ts`, `apps/web/test/repos/consent-repo.test.ts`, `apps/web/test/repos/admin-rejections.test.ts`, `apps/web/test/repos/offline-mutations.test.ts`, `apps/web/test/status/readiness.test.ts`, `apps/web/test/status/sw-client.test.ts`, `apps/web/test/status/offline-ready.test.tsx`, `apps/web/test/architecture.test.ts`

**Interfaces:**
- Consumes :
  - T28 : `AppServices`, `useServices`, `useLive`, `ApiClient`, `ApiError`, `NetworkRequiredError`, `createFakeApi`, `createFakeSyncEngine`, `renderWithServices`, `makeMe` ;
  - synchro T25 : `AppDb`, `MirrorRow`, `getMeta`, `setMeta`, `wipeUserData`, `writeLocal`, `pendingCount`, `createAppDb(name, { extraMirrors })`, `createTestLocalDb` ;
  - synchro T26 : `refreshCatalog(db, t)` ;
  - contracts : `MeResponse`, `LoginRequest`, `ChangePasswordRequest`, `InvitationCheckResponse`, `AcceptInvitationRequest`, `ResetCheckResponse`, `ResetPasswordRequest`, `ExportV1`, `TrainingProfilePatch`, `Goal`, `Experience`, `SportCode`, `OnboardingStep`, `CreatePlaceRequest`, `UpdatePlaceRequest`, `DeletePlaceRequest`, `GymSummary`, `GymDetail`, `CreateGymRequest`, `UpdateGymRequest`, `EquipmentCode`, `LoadSettings`, `ConsentState`, `LimitationInput`, `HEALTH_CONSENT_TEXT`, `HEALTH_QUESTIONNAIRE`, `majorOf`, `MemberSummary`, `InvitationSummary`, `CreateInvitationRequest`, `CreateInvitationResponse`, `ResetLinkResponse`, `OpsStatusResponse`, `Role`, `UserStatus`, `entityRules`, `EntityRulesMap`, `snakeToCamel` ;
  - domain : `firstIncompleteStep` ;
  - `@appsport/server/testing` (dev) : `SYNC_FIXTURE_RULES`.
- Produces :
```ts
// repos/rows.ts
export function parseJsonColumn<T>(v: unknown, schema: z.ZodType<T>): T | null; // objet ou chaîne JSON → validé, sinon null
export function isLive(row: MirrorRow): boolean;                                  // deletedAt === null
// repos/me-repo.ts
export interface DeviceOwner { userId: string | null; username: string | null; pending: number }
export interface MeRepo {
  current(): Promise<MeResponse | null>;
  refresh(): Promise<MeResponse | null>;            // GET /api/me → meta.me ; NetworkRequiredError → cache ; ApiError → null sans rien effacer
  deviceOwner(): Promise<DeviceOwner>;               // meta.userId, meta.me.username, pendingCount
  login(req: LoginRequest): Promise<MeResponse>;     // POST /api/auth/login puis adoptSession
  checkInvitation(code: string): Promise<InvitationCheckResponse>;      // POST /api/invitations/check {code}
  acceptInvitation(req: AcceptInvitationRequest): Promise<MeResponse>;  // POST /api/invitations/accept puis adoptSession
  checkReset(code: string): Promise<ResetCheckResponse>;                // POST /api/auth/reset/check {code}
  resetPassword(req: ResetPasswordRequest): Promise<MeResponse>;        // POST /api/auth/reset puis adoptSession
  updateUsername(username: string): Promise<MeResponse>;                // PATCH /api/me
  changePassword(req: ChangePasswordRequest): Promise<void>;            // POST /api/auth/password
  logout(mode: 'current' | 'all'): Promise<void>;   // POST /api/auth/logout | logout-all, puis wipeUserData({keepOutbox:false})
  exportData(): Promise<ExportV1>;                   // GET /api/me/export
  deleteAccount(password: string): Promise<void>;    // POST /api/me/delete {password}, puis wipeUserData({keepOutbox:false})
}
// adoptSession(me) (interne) : si meta.userId existe et diffère de me.id → wipeUserData({keepOutbox:false}) ; setMeta userId et me ; sync.syncNow('manual')
// repos/profile-repo.ts
export interface TrainingProfileView { goal: Goal | null; experience: Experience | null; daysPerWeek: 2 | 3 | 4 | null;
  sessionMinutes: 30 | 45 | 60 | 75 | 90 | null; sportCode: SportCode | null; sportOtherLabel: string | null; cautiousMode: boolean }
export interface ProfileRepo {
  get(): Promise<TrainingProfileView | null>;                       // miroir training_profile, id = meta.userId
  update(patch: TrainingProfilePatch): Promise<MeResponse>;         // PATCH /api/me/training-profile → meta.me → await pullNow()
  completeOnboarding(): Promise<MeResponse>;                        // POST /api/me/onboarding/complete → meta.me → pullNow()
  onboardingInput(): Promise<Parameters<typeof firstIncompleteStep>[0]>;
}
// repos/places-repo.ts
export interface PlaceView { id: string; kind: 'gym' | 'home'; gymId: string | null; name: string; city: string | null; isPrimary: boolean;
  visibleAtGym: boolean | null; loadSettings: LoadSettings | null; equipment: EquipmentCode[] }
export interface PlacesRepo {
  list(): Promise<PlaceView[]>;            // lieux non supprimés, le principal d'abord, puis par nom (fr)
  get(id: string): Promise<PlaceView | null>;
  create(req: CreatePlaceRequest): Promise<void>;                          // POST /api/places
  update(id: string, req: UpdatePlaceRequest): Promise<void>;              // PATCH /api/places/:id
  remove(id: string, req: DeletePlaceRequest): Promise<void>;              // DELETE /api/places/:id
  setEquipment(placeId: string, code: EquipmentCode, present: boolean): Promise<void>; // PUT | DELETE /api/places/:id/equipment/:code
}
// repos/gyms-repo.ts
export interface GymsRepo {
  search(q: string): Promise<GymSummary[]>;                   // GET /api/gyms?q=
  similar(name: string, city: string): Promise<GymSummary[]>; // GET /api/gyms/similar?name=&city=
  create(req: CreateGymRequest): Promise<{ gymId: string; placeId: string }>;
  detail(id: string): Promise<{ detail: GymDetail; offline: boolean }>; // hors ligne : miroirs gym + gym_equipment, canEdit false, history [], visibleMembers []
  update(id: string, req: UpdateGymRequest): Promise<void>;
  setEquipment(id: string, code: EquipmentCode, present: boolean): Promise<void>;
}
// repos/consent-repo.ts
export interface ScreeningView { caution: boolean; questionnaireVersion: string; answeredAt: string }
export interface LimitationView { id: string; bodyArea: LimitationInput['bodyArea']; side: LimitationInput['side'];
  severity: LimitationInput['severity']; note: string | null; active: boolean }
export interface ConsentRepo {
  state(): Promise<ConsentState | null>;           // meta.me.consents
  needsHealthReconsent(): Promise<boolean>;        // actif et majorOf(textVersion) < majorOf(HEALTH_CONSENT_TEXT.version)
  grantHealth(): Promise<MeResponse>;              // POST /api/me/consents {type:'health', textVersion} puis me.refresh()
  withdrawHealth(password: string): Promise<MeResponse>; // POST /api/me/consents/withdraw {type:'health', password} → purgeLocalHealthData → refresh → pullNow
  screening(): Promise<ScreeningView | null>;
  saveScreening(answers: [boolean, boolean, boolean, boolean]): Promise<{ caution: boolean }>; // PUT /api/me/health-screening {answers, questionnaireVersion}
  limitations(): Promise<LimitationView[]>;
  addLimitation(input: LimitationInput): Promise<{ id: string }>;
  updateLimitation(id: string, patch: Partial<LimitationInput>): Promise<void>;
  removeLimitation(id: string): Promise<void>;
}
export async function purgeLocalHealthData(db: AppDb, userId: string, rules?: EntityRulesMap):
  Promise<{ rowsCleared: number; opsRemoved: number; opsStripped: number }>;
// repos/admin-repo.ts
export interface AdminRepo {
  members(): Promise<MemberSummary[]>; resetLink(memberId: string): Promise<ResetLinkResponse>; revokeSessions(memberId: string): Promise<void>;
  setStatus(memberId: string, status: UserStatus): Promise<void>; setRole(memberId: string, role: Role, password: string): Promise<void>;
  setBirthDate(memberId: string, birthDate: string): Promise<void>; deleteMember(memberId: string, confirmUsername: string): Promise<void>;
  invitations(): Promise<InvitationSummary[]>; createInvitation(req: CreateInvitationRequest): Promise<CreateInvitationResponse>;
  revokeInvitation(id: string): Promise<void>; opsStatus(): Promise<OpsStatusResponse>;
  gyms(): Promise<GymSummary[]>; deleteGym(id: string): Promise<void>;      // DELETE /api/admin/gyms/:id puis pullNow
}
// repos/rejections-repo.ts
export interface RejectionView { id: string /* id sync_rejection, ou 'local:<opId>' */; source: 'server' | 'local'; opId: string;
  entity: string; rowId: string; code: string; detail: unknown; at: string }
export interface RejectionsRepo { list(): Promise<RejectionView[]>; count(): Promise<number>; dismiss(id: string): Promise<void> }
// repos/status-repo.ts
export interface ReadinessInputs { catalogVersion: string | null; serverCatalogVersion: string | null; lastPullOkAt: string | null }
export interface StatusRepo { readinessInputs(): Promise<ReadinessInputs>; persistGranted(): Promise<boolean | null>;
  pendingCount(): Promise<number>; retry(): Promise<void> /* sync.syncNow('manual') puis refreshCatalog(db, transport) */ }
// repos/index.ts
export interface Repos { me: MeRepo; profile: ProfileRepo; places: PlacesRepo; gyms: GymsRepo; consent: ConsentRepo; admin: AdminRepo;
  rejections: RejectionsRepo; status: StatusRepo }
export function createRepos(s: AppServices): Repos;
export function useRepos(): Repos;   // mémoïsé par services (WeakMap)
// sw/protocol.ts
export type PageToSw = { type: 'SKIP_WAITING' } | { type: 'GET_STATUS' } | { type: 'SYNC_ILLUSTRATIONS'; files: string[] };
export interface SwStatus { type: 'STATUS'; buildHash: string; shellCached: boolean; illustrationsMissing: number }
// sw/sw-client.ts
export async function getSwStatus(timeoutMs?: number /* 1000 */): Promise<SwStatus | null>; // null sans contrôleur ou sans réponse ; MessageChannel
export function postToSw(msg: PageToSw): boolean;   // false sans contrôleur
// features/status/readiness.ts
export const RECENT_PULL_MS = 86_400_000;
export interface Readiness { ready: boolean; checks: { shell: boolean; catalog: boolean; illustrations: boolean; recentPull: boolean } }
export function computeReadiness(i: { sw: SwStatus | null; catalogVersion: string | null; serverCatalogVersion: string | null; lastPullOkAt: string | null; now: number }): Readiness;
// features/status/use-readiness.ts
export function useReadiness(): { readiness: Readiness; refresh(): Promise<void>; retry(): Promise<void> }; // recalcul au montage, à chaque SyncState, toutes les 5 s
// features/status/OfflineReadyIndicator.tsx
export function OfflineReadyIndicator(p: { readiness?: Readiness }): JSX.Element; // data-testid="offline-ready" data-state="ready|not-ready"
// test/support/seed.ts
export async function seedMirror(db: AppDb, entity: string, rows: Record<string, unknown>[]): Promise<void>; // serverRevSeen 1 et deletedAt null par défaut
export async function seedOutbox(db: AppDb, userId: string, n: number, entity?: string /* 'sync_rejection' */): Promise<OutboxOp[]>;
export async function dumpAll(db: AppDb): Promise<string>;  // JSON de toutes les tables Dexie (témoins)
```

**Spec:** 01 §2 et §3 (Dexie derrière des dépôts, aucun accès direct depuis un écran), 01 §1 principe 4 (E en ligne, « Nécessite le réseau »), 02 §1 principe 4, 01 R-SYN-12, R-SYN-18, R-SYN-30 (pas de `navigator.onLine`), R-SYN-33, R-SYN-34, 02 R-AUTH-8, 03 P-AUT-6, P-CST-3 (purge locale), P-CST-4, Review Focus 3 (aucune valeur C2 locale après retrait)

- [ ] **Step 1: Write the failing test**

`apps/web/test/repos/me-repo.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createRepos } from '../../src/repos';
import { createFakeApi } from '../support/fake-api';
import { makeMe, renderWithServices } from '../support/render';
import { seedOutbox } from '../support/seed';

async function setup(api = createFakeApi()) {
  const r = await renderWithServices(<div />, { api, me: makeMe({ id: 'u-A', username: 'lea' }) });
  return { ...r, repos: createRepos(r.services) };
}
describe('MeRepo', () => {
  it('refresh met à jour meta.me après /api/me', async () => {
    const api = createFakeApi().on('GET', '/api/me', { status: 200, body: makeMe({ id: 'u-A', username: 'lea2' }) });
    const { repos, db } = await setup(api);
    await repos.me.refresh();
    expect((await getMeta(db, 'me'))?.username).toBe('lea2');
  });
  it('refresh hors ligne renvoie le cache sans rien effacer', async () => {
    const api = createFakeApi(); api.setOffline('reject');
    const { repos, db } = await setup(api);
    expect((await repos.me.refresh())?.username).toBe('lea');
    expect((await getMeta(db, 'me'))?.username).toBe('lea');
  });
  it('une connexion par un autre compte efface la file du précédent', async () => {
    const api = createFakeApi().on('POST', '/api/auth/login', { status: 200, body: makeMe({ id: 'u-B', username: 'max' }) });
    const { repos, db, sync } = await setup(api);
    await seedOutbox(db, 'u-A', 2);
    expect(await repos.me.deviceOwner()).toEqual({ userId: 'u-A', username: 'lea', pending: 2 });
    await repos.me.login({ username: 'max', password: 'cheval agrafe batterie correcte' });
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'userId')).toBe('u-B');
    expect(sync.triggers).toContain('manual');
  });
  it('une reconnexion du même compte garde la file', async () => {
    const api = createFakeApi().on('POST', '/api/auth/login', { status: 200, body: makeMe({ id: 'u-A', username: 'lea' }) });
    const { repos, db } = await setup(api);
    await seedOutbox(db, 'u-A', 2);
    await repos.me.login({ username: 'Lea', password: 'cheval agrafe batterie correcte' });
    expect(await db.outbox.count()).toBe(2);
  });
  it('logout appelle le serveur puis efface les données locales', async () => {
    const api = createFakeApi().on('POST', '/api/auth/logout', { status: 204 });
    const { repos, db } = await setup(api);
    await seedOutbox(db, 'u-A', 1);
    await repos.me.logout('current');
    expect(api.calls.map((c) => c.path)).toEqual(['/api/auth/logout']);
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'me')).toBeUndefined();
  });
});
```

`apps/web/test/repos/profile-places-gyms.test.ts` :
- `profile.get()` lit le miroir `training_profile` `{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45, sportCode: null, sportOtherLabel: null, cautiousMode: false }` et renvoie exactement ces 7 champs.
- `profile.update({ goal: 'strength', onboardingStep: 'goal' })` :
  - envoie `PATCH /api/me/training-profile` avec ce corps ;
  - écrit la `MeResponse` renvoyée dans `meta.me` ;
  - laisse `sync.pullCount === 1`.
- `profile.onboardingInput()` se construit à partir de `meta.me.onboardingStep = 'sport'`, du profil ci-dessus et d'un lieu principal. Le résultat vaut `{ goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45, hasPrimaryPlace: true, lastValidatedStep: 'sport' }`.
- `places.list()` lit les miroirs suivants :
  - `place` : p-1 gym→g-1, principal, visible ; p-2 maison « Garage », non principal ; p-3 supprimé ;
  - `gym` : g-1 « Basic Fit », « Lyon » ;
  - `home_equipment` : `p-2:chair` actif, `p-2:table` supprimé ;
  - `loadSettings` de p-2 au format chaîne JSON `defaultLoadSettings('home')`.

  Résultat attendu : `[{ id: 'p-1', kind: 'gym', name: 'Basic Fit', city: 'Lyon', isPrimary: true, visibleAtGym: true, equipment: [], … }, { id: 'p-2', kind: 'home', name: 'Garage', city: null, equipment: ['chair'], loadSettings: defaultLoadSettings('home'), … }]`.
- `gyms.detail('g-1')` :
  - en ligne, `GET /api/gyms/g-1` donne un `GymDetail` et `{ offline: false }` ;
  - avec `api.setOffline('reject')`, on obtient `offline: true`, `detail.name === 'Basic Fit'`, `detail.equipment` = codes non supprimés de `gym_equipment` pour g-1, `canEdit: false`, `history: []` et `visibleMembers: []`.
- `gyms.create(...)` renvoie `{ gymId: 'g-9', placeId: 'p-9' }` quand le serveur répond 201. Une réponse 409 `{ error: 'gym_duplicate', gymId: 'g-1' }` rejette avec une `ApiError` dont `body.gymId === 'g-1'`.

`apps/web/test/repos/consent-repo.test.ts`, test témoin du Review Focus 3 côté appareil qui retire son accord :
```ts
import { describe, expect, it } from 'vitest';
import { SYNC_FIXTURE_RULES } from '@appsport/server/testing';
import { createAppDb } from '../../src/local-db/db';
import { purgeLocalHealthData } from '../../src/repos/consent-repo';
import { dumpAll, seedMirror } from '../support/seed';

const W = 'TEMOIN-C2';
it('le retrait purge toute valeur C2 des miroirs, de l’outbox et de la deadletter', async () => {
  const db = createAppDb(`purge-${Math.random()}`, { extraMirrors: { fixture_note_item: 'id', fixture_c2_log: 'id', fixture_note: 'id' } });
  await seedMirror(db, 'health_screening', [{ id: 'u-1', ownerId: 'u-1', caution: true, questionnaireVersion: '1.0', answeredAt: '2026-10-01T10:00:00.000Z' }]);
  await seedMirror(db, 'limitation', [{ id: 'l-1', ownerId: 'u-1', bodyArea: 'knee', side: 'left', severity: 'mild', note: W, active: true }]);
  await seedMirror(db, 'fixture_c2_log', [{ id: 'c-1', ownerId: 'u-1', value: W }]);
  await seedMirror(db, 'fixture_note_item', [{ id: 'i-1', ownerId: 'u-1', noteId: 'n-1', label: 'ok', painNote: W }]);
  const op = (opId: string, entity: string, kind: 'create' | 'patch', fields: Record<string, unknown>) =>
    ({ opId, userId: 'u-1', entity, id: 'x', kind, fields, clientTs: '2026-10-06T10:00:00.000Z', protocol: 1, attempts: 0 });
  await db.outbox.bulkAdd([
    op('0192a000-0000-7000-8000-000000000001', 'fixture_c2_log', 'create', { value: W }),
    op('0192a000-0000-7000-8000-000000000002', 'fixture_note_item', 'patch', { painNote: W, label: 'x' }),
    op('0192a000-0000-7000-8000-000000000003', 'fixture_note_item', 'patch', { painNote: W }),
  ]);
  await db.deadletter.add({ opId: 'd-1', userId: 'u-1', entity: 'fixture_c2_log', id: 'c-2', code: 'validation', detail: W, receivedAt: '2026-10-06T10:00:00.000Z' });

  const res = await purgeLocalHealthData(db, 'u-1', SYNC_FIXTURE_RULES);

  expect(res).toEqual({ rowsCleared: 4, opsRemoved: 2, opsStripped: 1 });
  expect(await dumpAll(db)).not.toContain(W);
  expect(await db.mirror('fixture_note_item').get('i-1')).toMatchObject({ label: 'ok', painNote: null });
  expect((await db.outbox.toArray()).map((o) => o.fields)).toEqual([{ label: 'x' }]);
});
```
Tests complémentaires dans le même fichier :
- `withdrawHealth('pw')` :
  - envoie `POST /api/me/consents/withdraw` avec le corps `{ type: 'health', password: 'pw' }` ;
  - vide ensuite les miroirs `health_screening` et `limitation` ;
  - appelle `GET /api/me` ;
  - laisse `sync.pullCount === 1`.
- Si le serveur répond 401 `invalid_credentials`, la fonction rejette et ne purge rien.
- `needsHealthReconsent()` est vrai pour `textVersion: '0.9'` et faux pour `'1.0'`, `'1.4'` ou un consentement inactif.
- `saveScreening([true,false,false,false])` envoie `PUT /api/me/health-screening` avec `{ answers: [true,false,false,false], questionnaireVersion: HEALTH_QUESTIONNAIRE.version }`.
- `limitations()` lit le miroir et ignore les lignes supprimées.

`apps/web/test/repos/admin-rejections.test.ts` :
- `admin.createInvitation({ birthDate: '2009-05-01', note: 'pour Léa' })` envoie `POST /api/admin/invitations` avec ce corps et renvoie la `CreateInvitationResponse` validée.
- `admin.members()` valide `MemberSummary[]`.
- `rejections.list()` :
  - entrées : miroir `sync_rejection` (r-1 opId `op-1` non ignoré, r-2 ignoré avec `dismissedAt`, r-3 supprimé) et deadletter (`op-1` de u-1, `op-7` de u-1, `op-8` de u-2) ;
  - résultat : `[ { id: 'r-1', source: 'server', opId: 'op-1' }, { id: 'local:op-7', source: 'local', opId: 'op-7' } ]` (seules ces clés sont comparées) ;
  - `count()` vaut 2.
- `rejections.dismiss('r-1')` :
  - crée dans l'outbox exactement une op `{ entity: 'sync_rejection', id: 'r-1', kind: 'patch', fields: { dismissedAt: '2026-10-06T12:00:00.000Z' } }` ;
  - supprime l'entrée `op-1` de la deadletter ;
  - ajoute `'mutation'` à `sync.triggers`.
- `dismiss('local:op-7')` supprime `op-7` de la deadletter et ne crée aucune op.

`apps/web/test/repos/offline-mutations.test.ts` :
```ts
it.each([
  ['profile.update', (r: Repos) => r.profile.update({ goal: 'muscle' })],
  ['places.create', (r: Repos) => r.places.create({ kind: 'home', equipment: [], isPrimary: false })],
  ['gyms.setEquipment', (r: Repos) => r.gyms.setEquipment('g-1', 'barbell', true)],
  ['consent.grantHealth', (r: Repos) => r.consent.grantHealth()],
  ['admin.revokeSessions', (r: Repos) => r.admin.revokeSessions('u-2')],
])('%s hors ligne lève « Nécessite le réseau » sans rien écrire', async (_n, call) => {
  const api = createFakeApi(); api.setOffline('reject');
  const { services, db, sync } = await renderWithServices(<div />, { api, me: makeMe() });
  const before = await dumpAll(db);
  await expect(call(createRepos(services))).rejects.toThrow('Nécessite le réseau');
  expect(await dumpAll(db)).toBe(before);
  expect(sync.pullCount).toBe(0);
});
```

`apps/web/test/status/readiness.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { computeReadiness } from '../../src/features/status/readiness';

const now = Date.parse('2026-10-06T12:00:00.000Z');
const input = (shell: boolean, catalog: boolean, ill: boolean, pull: boolean) => ({
  sw: { type: 'STATUS' as const, buildHash: 'abcdef012345', shellCached: shell, illustrationsMissing: ill ? 0 : 3 },
  catalogVersion: 'c1', serverCatalogVersion: catalog ? 'c1' : 'c2',
  lastPullOkAt: pull ? '2026-10-06T00:00:00.000Z' : '2026-10-05T11:00:00.000Z', now,
});
describe('computeReadiness', () => {
  const combos = Array.from({ length: 16 }, (_, m) => [!!(m & 8), !!(m & 4), !!(m & 2), !!(m & 1)] as const);
  it.each(combos)('coquille=%s catalogue=%s illustrations=%s pull=%s', (s, c, i, p) => {
    expect(computeReadiness(input(s, c, i, p))).toEqual({ ready: s && c && i && p, checks: { shell: s, catalog: c, illustrations: i, recentPull: p } });
  });
  it('un pull de 24 h exactement ne suffit plus', () => {
    expect(computeReadiness({ ...input(true, true, true, true), lastPullOkAt: '2026-10-05T12:00:00.000Z' }).checks.recentPull).toBe(false);
    expect(computeReadiness({ ...input(true, true, true, true), lastPullOkAt: '2026-10-05T12:00:00.001Z' }).checks.recentPull).toBe(true);
  });
  it('sans SW ni catalogue ni pull, rien n’est prêt', () => {
    expect(computeReadiness({ sw: null, catalogVersion: null, serverCatalogVersion: null, lastPullOkAt: null, now }))
      .toEqual({ ready: false, checks: { shell: false, catalog: false, illustrations: false, recentPull: false } });
  });
});
```

`apps/web/test/status/sw-client.test.ts` :
- On remplace `navigator.serviceWorker` par `{ controller: { postMessage(msg, [port]) { port.postMessage({ type: 'STATUS', buildHash: 'abcdef012345', shellCached: true, illustrationsMissing: 0 }) } } }`. `getSwStatus()` renvoie alors ce statut, et le message reçu par le contrôleur est `{ type: 'GET_STATUS' }`.
- Avec `controller: null`, on obtient `null`, et `postToSw({ type: 'SKIP_WAITING' })` renvoie `false`.
- Avec un contrôleur muet, `getSwStatus(50)` renvoie `null`.

`apps/web/test/status/offline-ready.test.tsx` (`vi.mock('../../src/sw/sw-client', () => ({ getSwStatus: vi.fn(async () => OK) }))`) :
- avec `meta.catalogVersion = meta.serverCatalogVersion = 'c1'` et `lastPullOkAt` une heure avant `now`, `screen.getByTestId('offline-ready').dataset.state === 'ready'` et le texte « Prêt hors ligne » s'affiche ;
- avec `lastPullOkAt` 25 h avant `now`, on obtient `data-state="not-ready"` avec « Pas encore prêt hors ligne » et « Pas de synchronisation depuis plus de 24 h ».

`apps/web/test/architecture.test.ts` :
```ts
const src = join(__dirname, '../src');
it("aucun écran n'accède à Dexie hors de repos/", () => {
  const files = [...walk(join(src, 'features')), ...walk(join(src, 'ui')), join(src, 'App.tsx')];
  for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from ['"](dexie|[./]*\/local-db\/[^'"]*)['"]/);
});
it("navigator.onLine n'est jamais utilisé", () => {
  for (const f of walk(src)) expect(readFileSync(f, 'utf8'), f).not.toContain('navigator.onLine');
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- repos/ status/ architecture` : échec attendu, car `../../src/repos`, `../../src/features/status/readiness`, `../../src/sw/sw-client` et `../support/seed` n'existent pas.

- [ ] **Step 3: Implement**

- Chaque dépôt est une fabrique `createXRepo(s: AppServices, deps)` appelée par `createRepos`. `ConsentRepo` et `ProfileRepo` reçoivent `me` pour `refresh`.
- Toute écriture E passe par `s.api.send`, puis, en cas de succès, par `await s.sync.pullNow().catch(() => undefined)`. Aucune écriture locale n'a lieu avant la réponse du serveur.
- Les lectures se font avec `s.db.mirror(entity)` et `getMeta`. Elles filtrent `deletedAt === null` (`isLive`), convertissent `loadSettings` avec `parseJsonColumn(v, LoadSettings)` et ramènent les colonnes 0/1 à des booléens (`Boolean(v)`).
- `purgeLocalHealthData` :
  - tables C2 = entrées de `rules` avec `category === 'C2'` ; colonnes C2 = `c2Columns` des autres entrées, passées par `snakeToCamel` ;
  - miroirs C2 : suppression de toutes les lignes ; miroirs avec colonnes C2 : mise à `null` sur les lignes concernées ;
  - outbox : suppression des ops dont l'entité est C2. Pour les autres, retrait des champs C2 ; si aucun champ ne reste et que `kind` vaut `patch`, l'op est supprimée ;
  - deadletter : suppression des entrées dont l'entité est C2 ;
  - le tout dans une seule transaction Dexie en `rw` sur les tables touchées. `rowsCleared` compte les lignes supprimées et les lignes mises à `null`.
- `rejections.dismiss` : l'op passe par `writeLocal(db, { entity: 'sync_rejection', id, kind: 'patch', fields: { dismissedAt } }, { userId, now: () => new Date(s.now()).toISOString(), newOpId: s.newOpId, healthConsentActive: me.consents.health.active })`. Suivent la suppression de la deadletter de même `opId` et `s.sync.syncNow('mutation')`. Le `detail` d'une ligne serveur vient de `parseJsonColumn(row.detailJson, z.unknown())`.
- `status.retry` : `await s.sync.syncNow('manual')`, puis `await refreshCatalog(s.db, s.transport)`.
- `computeReadiness` :
  - `shell = sw?.shellCached === true` ;
  - `catalog = catalogVersion !== null && catalogVersion === serverCatalogVersion` ;
  - `illustrations = sw !== null && sw.illustrationsMissing === 0` ;
  - `recentPull = lastPullOkAt !== null && now - Date.parse(lastPullOkAt) < RECENT_PULL_MS`.
- `useReadiness` : lit `repos.status.readinessInputs()` et `getSwStatus()`. **[décision plan]** Si `import.meta.env.MODE === 'development'` et que `sw === null`, on fournit `{ type: 'STATUS', buildHash: 'dev', shellCached: true, illustrationsMissing: 0 }` : le serveur de dev Vite n'a pas de SW. Vitest tourne en mode `test`, donc ce remplacement ne s'applique pas aux tests.
- `OfflineReadyIndicator` : sans prop, il appelle `useReadiness()`. Libellés d'échec : shell « Appli pas encore enregistrée sur l'appareil », catalog « Catalogue à télécharger », illustrations « Illustrations à télécharger », recentPull « Pas de synchronisation depuis plus de 24 h ».
- `App.tsx` : `useEffect(() => { void repos.me.refresh() }, [])` au montage.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- repos/ status/ architecture` : tous les tests sont verts, dont les 16 combinaisons et les deux bornes de 24 h.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(web): dépôts d'accès aux données et voyant Prêt hors ligne"`

---

### Task 30: Écrans d'accès (invitation, création du compte, connexion, réinitialisation, déconnexion)

**Files:**
- Create: `apps/web/src/features/auth/{InvitePage.tsx, CreateAccountForm.tsx, LoginPage.tsx, ResetPage.tsx, LogoutDialog.tsx, PasswordFields.tsx, install-help.ts, messages.ts, auth.module.css}`
- Modify: `apps/web/src/App.tsx` (routes `/login`, `/invite`, `/reset`)
- Test: `apps/web/test/auth/invite.test.tsx`, `apps/web/test/auth/login.test.tsx`, `apps/web/test/auth/logout-reset.test.tsx`, `apps/web/test/auth/messages.test.ts`

**Interfaces:**
- Consumes :
  - T28 : `useServices`, `useMe`, `Page`, `Field`, `Button`, `Banner`, `Dialog`, `CopyButton`, `useAction`, `errorMessage`, `ApiError`, `renderApp`, `makeMe`, `createFakeApi` ;
  - T29 : `useRepos` (`me.checkInvitation`, `acceptInvitation`, `login`, `deviceOwner`, `checkReset`, `resetPassword`, `logout`), `seedOutbox` ;
  - domain : `parseSecretCode`, `formatSecretCode`, `validateUsername`, `validatePassword`, `usernameKey`, `PasswordRejection` ;
  - contracts : `PRIVACY_POLICY_VERSION`, `ApiErrorCode`, `Role`.
- Produces :
```ts
// features/auth/install-help.ts
export function isStandalone(win?: Window): boolean;   // matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
export type InstallPlatform = 'ios' | 'android' | 'other';
export function detectPlatform(userAgent: string): InstallPlatform;   // /iPhone|iPad|iPod/ → ios ; /Android/ → android
// features/auth/messages.ts
export const USERNAME_MESSAGES: Record<'length' | 'characters' | 'reserved', string>;
export const PASSWORD_MESSAGES: Record<PasswordRejection, string>;   // too_short reçoit la longueur minimale
export function passwordMessage(reason: PasswordRejection, role: Role): string;
export function checkNewPassword(i: { password: string; confirm: string; username: string; role: Role }): string | null; // validatePassword(…, commonPasswords: new Set()) + confirmation
export function invitationErrorMessage(code: ApiErrorCode): string;   // termine par « Demande un nouveau code à l'administrateur. »
export function pendingWarning(n: number, username: string): string;  // « N éléments non envoyés de <pseudo> seront effacés de cet appareil »
// composants
export function PasswordFields(p: { username: string; role: Role; password: string; confirm: string;
  onChange(v: { password: string; confirm: string }): void; label?: string }): JSX.Element;   // avec suggestion de phrase de passe
export function CreateAccountForm(p: { code: string; birthDate: string; onCreated(me: MeResponse): void }): JSX.Element;
export function LogoutDialog(p: { mode: 'current' | 'all'; open: boolean; onClose(): void }): JSX.Element | null;
export function InvitePage(): JSX.Element; export function LoginPage(): JSX.Element; export function ResetPage(): JSX.Element;
```

**Spec:** 02 R-ARR-1, R-ARR-2, R-INV-4, R-INV-5, R-INV-8, §3.4 (écran de création, R-CPT-1, R-CPT-2 côté client), R-MDP-2, R-AUTH-1, R-AUTH-5, R-AUTH-8, R-AUTH-9, R-RST-1, 01 R-SYN-14, 03 §13.1, P-AUT-2 (code jamais dans l'URL envoyée), P-AUT-6, P-DRT-4 (message « Ce compte a été supprimé »), 02 §15 n°3 et n°5

- [ ] **Step 1: Write the failing test**

`apps/web/test/auth/invite.test.tsx` :
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createFakeApi } from '../support/fake-api';
import { makeMe, renderApp } from '../support/render';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 Chrome/140.0 Mobile';
function setStandalone(on: boolean) { vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: on && q.includes('standalone'), media: q } as MediaQueryList)); }
function openInvite(hash: string) { window.history.replaceState(null, '', `/invite${hash}`); }
const okCheck = () => createFakeApi().on('POST', '/api/invitations/check', { status: 200, body: { birthDate: '2008-03-01' } });
afterEach(() => vi.restoreAllMocks());

describe('InvitePage', () => {
  it("affiche l'avertissement d'accueil et le lien Confidentialité", async () => {
    setStandalone(true); openInvite('');
    await renderApp({ path: '/invite', me: null });
    expect(document.body.textContent).toContain('appsport est un outil de suivi entre proches');
    expect(document.body.textContent).toContain("Ce n'est pas un service médical.");
    expect(screen.getByRole('link', { name: 'Confidentialité et règles' }).getAttribute('href')).toBe('/privacy');
  });
  it('en mode installé, le lien mène à la création du compte (saisie tolérante)', async () => {
    setStandalone(true); openInvite('#abcd-efgh-jkmn-pqrO');
    const api = okCheck().on('POST', '/api/invitations/accept', { status: 201, body: makeMe({ id: 'u-9', onboardingCompletedAt: null }) });
    const r = await renderApp({ path: '/invite', me: null, api });
    await screen.findByLabelText('Pseudo');
    expect(api.calls[0]!.body).toEqual({ code: 'ABCDEFGHJKMNPQR0' });
    expect(window.location.hash).toBe('');                       // le code quitte la barre d'adresse
    const birth = screen.getByLabelText('Date de naissance') as HTMLInputElement;
    expect(birth.readOnly).toBe(true);
    expect(birth.value).toBe('01/03/2008');
    expect(document.body.textContent).toContain("Renseignée par l'administrateur. Une erreur ? Préviens-le.");
    expect(document.body.textContent).toContain('4 mots');
    fireEvent.change(screen.getByLabelText('Pseudo'), { target: { value: 'lea' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'cheval agrafe batterie correcte' } });
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'cheval agrafe batterie correcte' } });
    const submit = screen.getByRole('button', { name: 'Créer mon compte' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);                           // case Confidentialité obligatoire
    fireEvent.click(screen.getByLabelText(/J'ai lu la page Confidentialité et règles/));
    fireEvent.click(submit);
    await waitFor(() => expect(r.location()).toBe('/onboarding'));
    expect(api.calls[1]!.body).toEqual({ code: 'ABCDEFGHJKMNPQR0', username: 'lea', password: 'cheval agrafe batterie correcte', termsVersion: '1.0' });
  });
  it.each([[IPHONE, "Sur l'écran d'accueil"], [ANDROID, "Installer l'application"]])(
    'dans un navigateur, affiche l’aide à l’installation (%#) sans formulaire', async (ua, hint) => {
    setStandalone(false); vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua); openInvite('#ABCD-EFGH-JKMN-PQRS');
    const api = okCheck();
    await renderApp({ path: '/invite', me: null, api });
    expect(document.body.textContent).toContain(hint);
    expect(screen.getByText('ABCD-EFGH-JKMN-PQRS')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copier' })).toBeTruthy();
    expect(screen.queryByLabelText('Pseudo')).toBeNull();
    expect(api.calls).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Continuer dans ce navigateur' }));
    expect(document.body.textContent).toContain("sur téléphone, tes données ne seront pas dans l'appli installée");
    await screen.findByLabelText('Pseudo');
  });
  it.each([
    ['invitation_expired', 'Cette invitation a expiré.'],
    ['invitation_used', 'Cette invitation a déjà été utilisée.'],
    ['invitation_revoked', 'Cette invitation a été révoquée.'],
    ['invitation_unknown', 'Ce code est inconnu.'],
  ])('%s → message dédié', async (code, start) => {
    setStandalone(true); openInvite('#ABCD-EFGH-JKMN-PQRS');
    const api = createFakeApi().on('POST', '/api/invitations/check', { status: 400, body: { error: code } });
    await renderApp({ path: '/invite', me: null, api });
    expect((await screen.findByRole('alert')).textContent).toBe(`${start} Demande un nouveau code à l'administrateur.`);
  });
  it('accepte le lien complet collé et refuse un code incomplet sans requête', async () => {
    setStandalone(true); openInvite('');
    const api = okCheck();
    await renderApp({ path: '/invite', me: null, api });
    const input = screen.getByLabelText('Lien ou code d’invitation');
    fireEvent.change(input, { target: { value: 'ABC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('alert').textContent).toContain('Code incomplet');
    expect(api.calls).toHaveLength(0);
    fireEvent.change(input, { target: { value: 'https://appsport.exemple/invite#abcd-efgh-jkmn-pqrs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(api.calls[0]!.body).toEqual({ code: 'ABCDEFGHJKMNPQRS' }));
  });
  it('valide localement le mot de passe et affiche username_taken sans quitter le formulaire', async () => {
    // mot de passe de 11 caractères → « 12 caractères au moins. » et aucune requête accept ;
    // confirmation différente → « Les deux mots de passe ne correspondent pas. » ;
    // mot de passe contenant le pseudo → PASSWORD_MESSAGES.contains_username ;
    // réponse 409 username_taken → alert « Ce pseudo est déjà pris. », champ Pseudo toujours présent
  });
});
```
(Le dernier test est écrit en entier avec le même schéma : `fireEvent.change` sur les champs, puis des assertions sur `screen.getByRole('alert').textContent` et sur `api.calls.filter((c) => c.path === '/api/invitations/accept').length`.)

`apps/web/test/auth/login.test.tsx` :
```ts
it('échec → « Pseudo ou mot de passe incorrect »', async () => {
  const api = createFakeApi().on('POST', '/api/auth/login', { status: 401, body: { error: 'invalid_credentials' } });
  await renderApp({ path: '/login', me: null, api });
  fill('Pseudo', 'lea'); fill('Mot de passe', 'mauvais mot de passe');
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Pseudo ou mot de passe incorrect');
});
it('compte désactivé → message dédié', /* 403 account_disabled → « Compte désactivé, contacte l'administrateur » */);
it('connexion d’un autre pseudo avec une file non vide : avertissement puis effacement', async () => {
  const api = createFakeApi().on('POST', '/api/auth/login', { status: 200, body: makeMe({ id: 'u-B', username: 'max' }) });
  const r = await renderApp({ path: '/login', me: makeMe({ id: 'u-A', username: 'lea' }), api, sync: createFakeSyncEngine({ connection: 'unauthenticated' }) });
  await seedOutbox(r.db, 'u-A', 2);
  fill('Pseudo', 'max'); fill('Mot de passe', 'cheval agrafe batterie correcte');
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog.textContent).toContain('2 éléments non envoyés de lea seront effacés de cet appareil');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
  expect(api.calls).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuer' }));
  await waitFor(() => expect(r.location()).toBe('/'));
  expect(await r.db.outbox.count()).toBe(0);
});
it('reconnexion du même pseudo (casse différente) : pas d’avertissement, file gardée', /* 'Lea' → aucune boîte, outbox.count() === 2 */);
it('affiche « Ce compte a été supprimé » après un 410', async () => {
  await renderApp({ path: '/login?reason=account_deleted', me: null });
  expect(document.body.textContent).toContain('Ce compte a été supprimé');
});
it('affiche « Ta session a expiré » quand la connexion est unauthenticated', /* me présent + connection 'unauthenticated' → texte « Ta session a expiré. Reconnecte-toi. » */);
```
(`fill(label, v)` = `fireEvent.change(screen.getByLabelText(label), { target: { value: v } })`.)

`apps/web/test/auth/logout-reset.test.tsx` :
- `LogoutDialog` en mode `current`, avec 3 ops en attente pour u-1 :
  - il affiche `pendingWarning(3, 'lea')`, « Exporter mes données » (lien `/profile/privacy`), « Annuler » et « Se déconnecter quand même » ;
  - « Annuler » n'envoie aucune requête ;
  - la confirmation envoie `POST /api/auth/logout` avec le corps `{}`, puis `outbox.count() === 0`, `getMeta(db,'me') === undefined` et `location() === '/login'`.
- Sans op en attente, la boîte affiche « Se déconnecter de cet appareil ? » et le bouton « Se déconnecter ».
- En mode `all`, la boîte envoie `POST /api/auth/logout-all`.
- Hors ligne (`setOffline('reject')`), une alerte « Nécessite le réseau » s'affiche et l'outbox est intacte.
- `ResetPage` avec `#abcd-efgh-jkmn-pqrs` :
  - `POST /api/auth/reset/check` part avec `{ code: 'ABCDEFGHJKMNPQRS' }`, puis la page affiche « Nouveau mot de passe pour lea » ;
  - la validation envoie `POST /api/auth/reset` avec `{ code: 'ABCDEFGHJKMNPQRS', newPassword: 'cheval agrafe batterie correcte' }`, puis `location() === '/'` ;
  - une réponse 400 `reset_invalid` donne l'alerte « Ce lien n'est plus valable. Demande un nouveau lien à l'administrateur. »

`apps/web/test/auth/messages.test.ts` :
- `pendingWarning(1,'lea')` = « 1 élément non envoyé de lea sera effacé de cet appareil » ;
- `pendingWarning(2,'lea')` = « 2 éléments non envoyés de lea seront effacés de cet appareil » ;
- `detectPlatform(IPHONE) === 'ios'`, `detectPlatform(ANDROID) === 'android'`, `detectPlatform('Mozilla/5.0 (Windows NT 10.0)') === 'other'` ;
- `passwordMessage('too_short','admin')` = « 14 caractères au moins. » ;
- `checkNewPassword({ password: 'a'.repeat(12), confirm: 'a'.repeat(12), username: 'lea', role: 'member' })` = `PASSWORD_MESSAGES.single_char`.

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- auth/` : échec attendu, car `src/features/auth/*` est introuvable et les routes `/invite`, `/login` et `/reset` affichent `NotFound`.

- [ ] **Step 3: Implement**

- `InvitePage` :
  - au montage, lit `window.location.hash.slice(1)`, puis l'efface avec `history.replaceState(null, '', location.pathname)` ;
  - affiche en tête « appsport est un outil de suivi entre proches, hébergé chez ${OWNER_FIRST_NAME}. Ce n'est pas un service médical. » et un lien « Confidentialité et règles » ;
  - en mode installé (`isStandalone()`) ou après « Continuer dans ce navigateur » : champ « Lien ou code d’invitation » prérempli avec le fragment, bouton « Suivant », `parseSecretCode`, puis `repos.me.checkInvitation(canonical)` ;
  - avec un fragment présent, la vérification part d'elle-même. En cas de succès, la page affiche `<CreateAccountForm>` ;
  - dans un navigateur (non installé), le flux de vérification n'est pas lancé. La page affiche :
    - l'aide de `detectPlatform` : iOS « Sur iPhone : touche Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite appsport depuis l'écran d'accueil et colle le code. » ; Android « Sur Android : ouvre le menu ⋮ puis « Installer l'application ». » ; autre : les deux textes ;
    - le code formaté (`formatSecretCode`), avec `<CopyButton>` ;
    - un bouton secondaire « Continuer dans ce navigateur », qui affiche le `Banner` warning « Attention : sur téléphone, tes données ne seront pas dans l'appli installée. »
- Codes d'erreur (`invitationErrorMessage`) : `invitation_expired` « Cette invitation a expiré. », `invitation_used` « Cette invitation a déjà été utilisée. », `invitation_revoked` « Cette invitation a été révoquée. », `invitation_unknown` « Ce code est inconnu. », `rate_limited` « Trop d'essais depuis cet appareil. ». Chaque message est suivi de « Demande un nouveau code à l'administrateur. ». Si `parseSecretCode` renvoie `null` : « Code incomplet : il faut 16 caractères. »
- `CreateAccountForm` :
  - champs « Pseudo », `<PasswordFields>` (« Mot de passe », « Confirmation ») et « Date de naissance » (`readOnly`, `formatDate`, aide « Renseignée par l'administrateur. Une erreur ? Préviens-le. ») ;
  - case « J'ai lu la page Confidentialité et règles », avec un lien `/privacy` en `target="_blank"` et `rel="noreferrer"` ;
  - bouton « Créer mon compte » désactivé tant que la case n'est pas cochée ;
  - contrôles locaux (`validateUsername`, `checkNewPassword` avec le rôle `member`) avant tout envoi ;
  - envoi par `repos.me.acceptInvitation({ code, username, password, termsVersion: PRIVACY_POLICY_VERSION })`, puis `onCreated` → `navigate('/onboarding')` ;
  - erreurs serveur : `password_rejected` et `username_invalid` lisent `body.reason` s'il correspond à une clé connue, sinon `errorMessage`.
- `PasswordFields` affiche l'aide « Astuce : une phrase de 4 mots ou plus, par exemple « cheval agrafe batterie correcte », est facile à retenir et solide. Les espaces sont acceptés. »
- `LoginPage` :
  - affiche selon `?reason=` : `account_deleted` « Ce compte a été supprimé », sinon `useSyncState().connection === 'unauthenticated'` « Ta session a expiré. Reconnecte-toi. » ;
  - à l'envoi, appelle `repos.me.deviceOwner()`. Si `pending > 0` et que `usernameKey(saisi) !== usernameKey(owner.username ?? '')`, une `Dialog` affiche `pendingWarning` avec « Annuler » et « Continuer » ;
  - puis `repos.me.login`, puis `navigate('/')` ;
  - `rate_limited` avec `body.retryAfterS` : « Trop de tentatives. Réessaie dans N min. » (N arrondi au supérieur).
- `ResetPage` : même lecture du fragment et du champ de code que l'invitation. `checkReset`, puis `<PasswordFields>` avec le libellé « Nouveau mot de passe pour <pseudo> », puis `resetPassword`, puis `navigate('/')`. `reset_invalid` → message ci-dessus.
- `LogoutDialog` : `repos.me.deviceOwner()` à l'ouverture, `repos.me.logout(mode)` à la confirmation, puis `navigate('/login')`. Les erreurs passent par `useAction`.
- `App.tsx` : `<Route path="/login" component={LoginPage}/>`, `<Route path="/invite" component={InvitePage}/>`, `<Route path="/reset" component={ResetPage}/>`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- auth/` : tous les tests sont verts.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(auth): écrans d'invitation, de connexion, de réinitialisation et de déconnexion"`

---

### Task 31: Onboarding en 8 écrans et choix du lieu (salle ou maison)

**Files:**
- Create: `apps/web/src/features/onboarding/{OnboardingFlow.tsx, GoalStep.tsx, SportStep.tsx, PlaceKindStep.tsx, PlaceStep.tsx, ExperienceStep.tsx, AvailabilityStep.tsx, HealthStep.tsx, ReadyStep.tsx, labels.ts, onboarding.module.css}`
- Create: `apps/web/src/features/places/{GymPicker.tsx, GymCreate.tsx, EquipmentChecklist.tsx, places.module.css}`. Ces trois composants sont avancés de T32, car E4 les consomme.
- Create: `apps/web/src/app-events.ts`
- Modify: `apps/web/src/App.tsx` (route `/onboarding`)
- Test: `apps/web/test/onboarding/flow.test.tsx`, `apps/web/test/onboarding/steps.test.tsx`, `apps/web/test/onboarding/health-step.test.tsx`, `apps/web/test/onboarding/ready-step.test.tsx`, `apps/web/test/places/gym-picker.test.tsx`

**Interfaces:**
- Consumes :
  - T28 : `useServices`, `useMe`, `ChoiceList`, `Field`, `Button`, `Banner`, `HealthWarning`, `HEALTH_WARNING_TEXT`, `useAction`, `renderApp`, `renderWithServices`, `makeMe`, `createFakeApi` ;
  - T29 : `useRepos` (`profile.update/get/onboardingInput/completeOnboarding`, `places.create/list`, `gyms.search/similar/create`, `consent.grantHealth/saveScreening/addLimitation/removeLimitation/limitations`), `useReadiness`, `OfflineReadyIndicator`, `seedMirror` ;
  - domain : `firstIncompleteStep` ;
  - contracts : `ONBOARDING_STEPS`, `OnboardingStep`, `Goal`, `Experience`, `SPORTS`, `SportCode`, `EQUIPMENT`, `EQUIPMENT_CATEGORIES`, `EQUIPMENT_LABELS`, `EQUIPMENT_PRESETS`, `EquipmentPresetId`, `EquipmentCode`, `HEALTH_CONSENT_TEXT`, `HEALTH_QUESTIONNAIRE`, `LimitationInput`, `GymSummary`.
- Produces :
```ts
// app-events.ts
export const ONBOARDING_COMPLETED_EVENT = 'appsport:onboarding-completed'; // window CustomEvent, écouté par pwa T37 (persist)
// features/onboarding/OnboardingFlow.tsx
export interface StepProps { mode: 'onboarding' | 'edit'; onNext(): void; onBack?: () => void }   // en 'edit' : bouton « Enregistrer », onboardingStep non envoyé
export function OnboardingFlow(): JSX.Element;   // « Étape n/8 » ; conteneur data-testid="onboarding-step" data-step=<OnboardingStep>
export function GoalStep(p: StepProps): JSX.Element; export function SportStep(p: StepProps): JSX.Element;
export function PlaceKindStep(p: StepProps & { value: 'gym' | 'home' | null; onChange(k: 'gym' | 'home'): void }): JSX.Element;
export function PlaceStep(p: StepProps & { kind: 'gym' | 'home' }): JSX.Element;
export function ExperienceStep(p: StepProps): JSX.Element; export function AvailabilityStep(p: StepProps): JSX.Element;
export function HealthStep(p: StepProps): JSX.Element; export function ReadyStep(p: { onBack(): void }): JSX.Element;
// sous-composants de HealthStep.tsx, réutilisés par HealthSection (T34)
export function HealthConsentPanel(p: { onGranted(): void; onSkip?: () => void }): JSX.Element;   // texte, case non cochée, « J'accepte et je renseigne », « Passer »
export function ScreeningQuestions(p: { record: boolean; onSaved?(caution: boolean): void }): JSX.Element; // record=false : auto-vérification non enregistrée
export function LimitationsEditor(): JSX.Element;
export function CautiousModeToggle(p: { value: boolean; minor: boolean; onChange(v: boolean): void }): JSX.Element;
// labels.ts
export const GOAL_LABELS: Record<Goal, string>; export const EXPERIENCE_LABELS: Record<Experience, string>;
export const BODY_AREA_LABELS: Record<LimitationInput['bodyArea'], string>; export const SIDE_LABELS: Record<LimitationInput['side'], string>;
export const SEVERITY_LABELS: Record<LimitationInput['severity'], string>;
// features/places
export function sortEquipment(codes: Iterable<EquipmentCode>): EquipmentCode[];   // ordre d'EQUIPMENT
export const EQUIPMENT_CATEGORY_LABELS: Record<keyof typeof EQUIPMENT_CATEGORIES, string>;
export function EquipmentChecklist(p: { kind: 'gym' | 'home'; value: readonly EquipmentCode[]; onChange(next: EquipmentCode[]): void; disabled?: boolean }): JSX.Element;
export function GymPicker(p: { isPrimary: boolean; defaultVisible: boolean; onDone(): void }): JSX.Element;   // choisir ou créer, puis POST
export function GymCreate(p: { isPrimary: boolean; visibleAtGym: boolean; onDone(): void; onPickExisting(gymId: string): void }): JSX.Element;
```

**Spec:** 02 R-ONB-1, R-ONB-2, R-ONB-3 (props `mode`), §8 E1 à E8, R-CPT-2 (démarrage de l'onboarding), §10.2 R-MAT-2, 04 R-EQ-3 (les objets de maison seulement pour une maison), 02 R-SAL-1, R-SAL-2, R-SAL-3, R-VIS-3 et P-MIN-6 (invisible par défaut pour un mineur), §12 écran E7 (R-CST-2, R-CST-6 non, R-CST-7 affiché), 03 P-CST-1, P-CST-2 (auto-vérification non enregistrée), 03 §13.2, 01 R-SYN-33 (exigé en fin d'onboarding), 02 §15 n°11

- [ ] **Step 1: Write the failing test**

`apps/web/test/onboarding/flow.test.tsx` :
```ts
import { firstIncompleteStep } from '@appsport/domain';
const fresh = makeMe({ onboardingCompletedAt: null, onboardingStep: null });
const step = () => screen.getByTestId('onboarding-step');

it('démarre à l’étape 1/8 « goal »', async () => {
  await renderApp({ path: '/onboarding', me: fresh });
  await waitFor(() => expect(step().dataset.step).toBe('goal'));
  expect(document.body.textContent).toContain('Étape 1/8');
});
it('reprend au premier écran incomplet', async () => {
  const me = makeMe({ onboardingCompletedAt: null, onboardingStep: 'sport' });
  const r = await renderApp({ path: '/onboarding', me });
  await seedMirror(r.db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', experience: null, daysPerWeek: null, sessionMinutes: null, sportCode: null, sportOtherLabel: null, cautiousMode: false }]);
  const expected = firstIncompleteStep({ goal: 'muscle', experience: null, daysPerWeek: null, sessionMinutes: null, hasPrimaryPlace: false, lastValidatedStep: 'sport' });
  await waitFor(() => expect(step().dataset.step).toBe(expected));
});
it('enregistre au clic sur Suivant puis passe à l’étape suivante ; Retour revient avec la réponse', async () => {
  const api = createFakeApi().on('PATCH', '/api/me/training-profile', (req) => ({ status: 200, body: makeMe({ onboardingCompletedAt: null, onboardingStep: (req.body as { onboardingStep: OnboardingStep }).onboardingStep }) }));
  const r = await renderApp({ path: '/onboarding', me: fresh, api });
  fireEvent.click(await screen.findByLabelText('Prendre du muscle'));
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
  await waitFor(() => expect(step().dataset.step).toBe('sport'));
  expect(api.calls[0]!.body).toEqual({ goal: 'muscle', onboardingStep: 'goal' });
  expect(document.body.textContent).toContain('Étape 2/8');
  await seedMirror(r.db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', cautiousMode: false }]);
  fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
  await waitFor(() => expect(step().dataset.step).toBe('goal'));
  expect((screen.getByLabelText('Prendre du muscle') as HTMLInputElement).checked).toBe(true);
});
it('à l’étape place sans type connu, repasse par place_kind', async () => {
  // onboardingStep 'place_kind' + goal/sport remplis, aucun lieu, rechargement → data-step 'place_kind'
});
it('hors ligne, Suivant affiche « Nécessite le réseau » et reste sur l’écran', async () => { /* setOffline('reject') → alert, data-step 'goal' */ });
```

`apps/web/test/onboarding/steps.test.tsx` :
- `GoalStep` :
  - pour un mineur (`makeMe({ ageBand: 'minor', onboardingCompletedAt: null })`), `screen.queryByLabelText('Perdre du gras')` vaut `null` et 4 options s'affichent ;
  - pour un adulte, les 5 options apparaissent dans l'ordre « Prendre du muscle », « Gagner en force », « Perdre du gras », « Forme et santé », « Me renforcer pour mon sport » ;
  - « Suivant » est désactivé tant qu'aucun choix n'est fait.
- `SportStep` :
  - avec le miroir `goal: 'sport_support'`, « Non » est désactivé, « Oui » est coché et le texte « Obligatoire avec l'objectif « Me renforcer pour mon sport ». » s'affiche ;
  - choisir « Autre » et saisir « Pétanque » envoie le PATCH `{ sportCode: 'other', sportOtherLabel: 'Pétanque', onboardingStep: 'sport' }`. Le champ a `maxLength === 40`. La liste contient les 15 libellés de `SPORTS` ;
  - « Non » envoie `{ sportCode: null, sportOtherLabel: null, onboardingStep: 'sport' }`.
- `PlaceKindStep` : la question « Où t'entraîneras-tu le plus souvent ? », avec « À la salle » et « À la maison », envoie `{ onboardingStep: 'place_kind' }`.
- `PlaceStep` maison :
  - le nom vaut par défaut « Maison » ; le préréglage par défaut est `home_none` ; le groupe « Objets du quotidien » est visible, avec `chair` et `table` cochés ;
  - choisir « Petit matériel » coche `dumbbells` ;
  - « Suivant » envoie `POST /api/places` avec `{ kind: 'home', name: 'Maison', equipment: EQUIPMENT.filter((c) => EQUIPMENT_PRESETS.home_small.codes.includes(c)), isPrimary: true }`, puis le PATCH `{ onboardingStep: 'place' }`.
- `PlaceStep` avec un lieu principal existant (retour arrière) : la page affiche « Ton lieu principal : Basic Fit » et « Suivant », et ne fait aucun `POST /api/places`.
- `ExperienceStep` : la question « Depuis combien de temps fais-tu de la musculation régulièrement (au moins une fois par semaine) ? » propose « Jamais », « Moins de 6 mois », « 6 mois à 2 ans » et « Plus de 2 ans ». Choisir « 6 mois à 2 ans » envoie le PATCH `{ experience: '6_to_24_months', onboardingStep: 'experience' }`.
- `AvailabilityStep` : 3 options de séances (2, 3, 4) et 5 durées (30, 45, 60, 75, 90 min). Choisir 3 séances et 60 min envoie le PATCH `{ daysPerWeek: 3, sessionMinutes: 60, onboardingStep: 'availability' }`.
- En mode `edit`, `GoalStep` affiche « Enregistrer », et le PATCH vaut `{ goal: 'strength' }`, sans `onboardingStep`.

`apps/web/test/places/gym-picker.test.tsx` :
- `GymPicker`, cas d'une salle existante :
  - `GET /api/gyms?q=` renvoie `[{ id: 'g-1', name: 'Basic Fit', city: 'Lyon', visibleMemberCount: 2 }]`, et la page affiche « Basic Fit · Lyon · 2 membres visibles » ;
  - saisir « bas » dans « Rechercher une salle » lance `GET /api/gyms?q=bas` ;
  - choisir la salle affiche la case « Apparaître dans « Qui va à cette salle » », cochée quand `defaultVisible` vaut vrai ;
  - pour `defaultVisible={false}`, la case est décochée et le texte « Désactivé par défaut pour les moins de 18 ans. » s'affiche ;
  - « Valider » envoie `POST /api/places` avec `{ kind: 'gym', gymId: 'g-1', isPrimary: true, visibleAtGym: false }`, puis appelle `onDone`.
- « Ma salle n'est pas dans la liste », puis `GymCreate` :
  - le nom « Basic-Fit » et la ville « Lyon » lancent `GET /api/gyms/similar?name=Basic-Fit&city=Lyon`. La page affiche « Ces salles existent peut-être déjà : », la salle similaire avec le bouton « C'est ma salle », et « Non, créer ma salle » ;
  - les préréglages proposés sont `gym_large`, `gym_small`, `gym_crossfit` et `gym_other` ;
  - « Petite salle de quartier » coche exactement les 12 codes de `gym_small`, et le titre « Objets du quotidien » est absent ;
  - « Valider » envoie `POST /api/gyms` avec `{ name: 'Basic-Fit', city: 'Lyon', equipment: sortEquipment(EQUIPMENT_PRESETS.gym_small.codes), isPrimary: true, visibleAtGym: true }`.
- Une réponse 409 `{ error: 'gym_duplicate', gymId: 'g-1' }` affiche « Cette salle existe déjà. » et le bouton « Choisir cette salle ». Ce bouton envoie `POST /api/places` avec `gymId: 'g-1'`.
- Un nom d'un seul caractère affiche « 2 à 60 caractères. » et n'envoie aucune requête.
- `EquipmentChecklist kind="gym"` affiche 4 titres de groupe : « Petit matériel », « Bancs et supports », « Charges libres », « Poulies et machines ». `kind="home"` en affiche 5. Cocher « Kettlebell » appelle `onChange` avec la liste triée qui inclut `kettlebell`.

`apps/web/test/onboarding/health-step.test.tsx` :
- Sans consentement :
  - `HEALTH_CONSENT_TEXT.text` s'affiche ; la case « J'accepte » est décochée ; « J'accepte et je renseigne » est désactivé ;
  - « Passer » affiche les 4 questions de `HEALTH_QUESTIONNAIRE.questions` et le texte « Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer » ;
  - basculer les réponses n'envoie aucune requête (`api.calls.length === 0`) ;
  - la page affiche ensuite « Je préfère une progression plus prudente » ;
  - « Suivant » envoie le PATCH `{ cautiousMode: true, onboardingStep: 'health' }` quand l'interrupteur est activé.
- Avec consentement :
  - cocher, puis « J'accepte et je renseigne », envoie `POST /api/me/consents` avec `{ type: 'health', textVersion: '1.0' }` ;
  - répondre « Oui » à la question 1, puis « Enregistrer mes réponses », envoie `PUT /api/me/health-screening` avec `{ answers: [true, false, false, false], questionnaireVersion: '1.0' }`. La réponse `{ caution: true }` affiche « Nous te recommandons de consulter un médecin avant de commencer. » ;
  - la section Limitations affiche « aucun diagnostic n'est nécessaire » et propose « Aucune » et « Ajouter une limitation ». L'ajout de genou, gauche, légère, avec la note « entorse ancienne », envoie `POST /api/me/limitations` avec `{ bodyArea: 'knee', side: 'left', severity: 'mild', note: 'entorse ancienne' }`. La note a `maxLength === 200`.
- Pour un mineur, l'interrupteur de mode prudent est coché et désactivé, avec « Imposé jusqu'à 18 ans ».
- `HEALTH_WARNING_TEXT` est affiché.
- « Suivant » reste actif sans aucune réponse, puisque l'écran est facultatif.

`apps/web/test/onboarding/ready-step.test.tsx`, avec `vi.mock('../../src/sw/sw-client', …)` et `getSwStatus` renvoyant `{ type: 'STATUS', buildHash: 'abcdef012345', shellCached: true, illustrationsMissing: 0 }` :
- Quand tout est prêt (`meta.catalogVersion = meta.serverCatalogVersion = 'c1'`, `lastPullOkAt` une heure avant `now`) :
  - le récapitulatif contient « Prendre du muscle », « 3 séances de 45 min », « Basic Fit » et « Jamais » ;
  - `offline-ready` vaut `ready`, « Commencer » est actif et `HEALTH_WARNING_TEXT` est présent ;
  - le clic envoie `POST /api/me/onboarding/complete`, puis `location() === '/'`, et un écouteur `ONBOARDING_COMPLETED_EVENT` est appelé une fois.
- Pas prêt (`lastPullOkAt` 25 h avant `now`) :
  - « Commencer » est désactivé et « Réessayer » est présent ;
  - le clic ajoute `'manual'` à `sync.triggers`.
- Une réponse 409 `onboarding_incomplete` ramène `data-step` sur le premier écran incomplet.

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- onboarding/ places/gym-picker` : échec attendu, car les modules `features/onboarding/*` et `features/places/GymPicker` n'existent pas.

- [ ] **Step 3: Implement**

- `OnboardingFlow` :
  - au montage, calcule `start = firstIncompleteStep(await repos.profile.onboardingInput())`. Si `start === 'place'` et que `placeKind` est inconnu, il démarre à `'place_kind'` ;
  - garde `step` et `placeKind` en état local ; `onNext` passe à `ONBOARDING_STEPS[i+1]` et `onBack` à `ONBOARDING_STEPS[i-1]` ;
  - affiche `Étape ${i+1}/${ONBOARDING_STEPS.length}` ;
  - chaque écran lit ses valeurs initiales dans `repos.profile.get()` et `repos.places.list()`, puis appelle `repos.profile.update({ …champs, onboardingStep: <étape> })` en mode `onboarding`.
- `labels.ts` :
  - objectifs (`GOAL_LABELS`) : `muscle` « Prendre du muscle », `strength` « Gagner en force », `fat_loss` « Perdre du gras », `fitness` « Forme et santé », `sport_support` « Me renforcer pour mon sport » ;
  - expérience (`EXPERIENCE_LABELS`) : « Jamais », « Moins de 6 mois », « 6 mois à 2 ans », « Plus de 2 ans » ;
  - zones (`BODY_AREA_LABELS`) : épaule, coude, poignet ou main, cou, haut du dos, bas du dos, hanche, genou, cheville ou pied, autre ;
  - côtés (`SIDE_LABELS`) : gauche, droite, les deux, sans objet ;
  - gêne (`SEVERITY_LABELS`) : `mild` « Légère », `severe` « Forte : m'empêche certains mouvements ».
- `GoalStep` masque `fat_loss` quand `me.ageBand === 'minor'`.
- `SportStep` impose « Oui » quand le profil a `goal === 'sport_support'`. Le libellé « Autre » ouvre un champ « Précise (40 caractères au plus) ».
- `PlaceStep` :
  - si un lieu principal existe déjà, il l'affiche avec « Suivant », sans rien créer ;
  - pour `gym`, il affiche `<GymPicker isPrimary defaultVisible={me.ageBand !== 'minor'} onDone={…}>` ;
  - pour `home`, il affiche un champ « Nom du lieu » (`maxLength` 30, « Maison » par défaut), une `ChoiceList` des préréglages `home_none`, `home_small` et `home_gym` (libellés de `EQUIPMENT_PRESETS`), puis `<EquipmentChecklist kind="home">` précochée par le préréglage (changer de préréglage recoche) ;
  - ensuite `repos.places.create`, puis le PATCH `{ onboardingStep: 'place' }`.
- `GymCreate` :
  - étape 1 : nom et ville (2 à 60 caractères), puis `repos.gyms.similar` ;
  - étape 2 : `ChoiceList` des préréglages `gym_*` ;
  - étape 3 : `EquipmentChecklist kind="gym"` précochée, puis « Valider » → `repos.gyms.create` ;
  - `gym_duplicate` affiche « Choisir cette salle », qui appelle `onPickExisting(body.gymId)`.
- `EquipmentChecklist` : un `<fieldset>` par catégorie, `household` exclu pour une salle, des cases libellées par `EQUIPMENT_LABELS`, et `onChange(sortEquipment(next))`.
- `HealthStep` :
  - si `me.consents.health.active`, il affiche `ScreeningQuestions record` puis `LimitationsEditor` ;
  - sinon `HealthConsentPanel`, et « Passer » affiche `ScreeningQuestions record={false}` ;
  - dans tous les cas, `CautiousModeToggle` (`minor`: checked + disabled), `HealthWarning` et « Suivant » ;
  - `ScreeningQuestions record` envoie `repos.consent.saveScreening`. Un seul « Oui » donne `caution = true` côté serveur, et le texte de recommandation suit la réponse.
- `ReadyStep` :
  - utilise `useReadiness()` et `<OfflineReadyIndicator readiness>` ;
  - « Commencer » est désactivé tant que `!readiness.ready` ;
  - le clic appelle `repos.profile.completeOnboarding()`, puis `window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETED_EVENT))`, puis `navigate('/')` ;
  - « Réessayer » appelle `retry()`, puis `refresh()`.
- `App.tsx` : `<Route path="/onboarding" component={OnboardingFlow}/>`, hors `AppShell`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- onboarding/ places/gym-picker` : tous les tests sont verts.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(web): onboarding en 8 écrans et choix de la salle ou de la maison"`

---

### Task 32: Profil, lieux et fiche de salle

**Files:**
- Create: `apps/web/src/features/profile/{ProfilePage.tsx, profile.module.css}`
- Create: `apps/web/src/features/places/{PlacesPage.tsx, PlaceDetail.tsx, GymPage.tsx}`
- Modify: `apps/web/src/App.tsx` (routes `/profile`, `/profile/places`, `/profile/places/:id`, `/gyms/:id`)
- Test: `apps/web/test/profile/profile-page.test.tsx`, `apps/web/test/places/places-page.test.tsx`, `apps/web/test/places/gym-page.test.tsx`

**Interfaces:**
- Consumes :
  - T28 : `Page`, `Field`, `Button`, `Banner`, `Dialog`, `useAction`, `errorMessage`, `formatDate`, `formatDateTime`, `useMe`, `renderApp`, `makeMe`, `createFakeApi` ;
  - T29 : `useRepos` (`me.updateUsername/changePassword`, `profile.get`, `places.*`, `gyms.detail/update/setEquipment`), `useLive`, `seedMirror` ;
  - T30 : `LogoutDialog`, `PasswordFields`, `checkNewPassword`, `USERNAME_MESSAGES` ;
  - T31 : `GoalStep`, `SportStep`, `ExperienceStep`, `AvailabilityStep`, `StepProps`, `GymPicker`, `EquipmentChecklist`, `CautiousModeToggle`, `GOAL_LABELS`, `EXPERIENCE_LABELS` ;
  - contracts : `EQUIPMENT_LABELS`, `EQUIPMENT_PRESETS`, `GymDetail`.
- Produces :
```ts
export function ProfilePage(): JSX.Element;   // /profile
export function PlacesPage(): JSX.Element;    // /profile/places
export function PlaceDetail(p: { params: { id: string } }): JSX.Element;   // /profile/places/:id
export function GymPage(p: { params: { id: string } }): JSX.Element;       // /gyms/:id
export const GYM_HISTORY_LIMIT = 10;
export function historyLine(h: GymDetail['history'][number]): string;      // « 06/10/2026 à 14:05 — Matériel ajouté : Kettlebell — modifié par lea | ancien membre »
```

**Spec:** 02 §11 (Compte, Entraînement, Lieux), R-ONB-3, R-CPT-3, R-MDP-1 (changement obligé), R-MDP-6, R-AUTH-7, R-SAL-1 à R-SAL-3, R-SAL-4 (affichage selon `canEdit`), R-SAL-6, R-LIEU-1 à R-LIEU-4, R-VIS-1 à R-VIS-4, R-CHG-3 (pas d'édition des réglages de charge dans le socle), 02 §1 principe 4 (« Nécessite le réseau », lecture hors ligne), 02 §15 n°15 et n°17 (affichage)

- [ ] **Step 1: Write the failing test**

`apps/web/test/profile/profile-page.test.tsx` :
```ts
it('affiche le compte avec la date de naissance en lecture seule', async () => {
  await renderApp({ path: '/profile', me: makeMe({ username: 'lea', birthDate: '1990-01-01' }) });
  expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('lea');
  const birth = screen.getByLabelText('Date de naissance') as HTMLInputElement;
  expect(birth.readOnly).toBe(true);
  expect(birth.value).toBe('01/01/1990');
});
it('change le pseudo en ligne', async () => {
  const api = createFakeApi().on('PATCH', '/api/me', { status: 200, body: makeMe({ username: 'leo' }) });
  await renderApp({ path: '/profile', me: makeMe(), api });
  fireEvent.change(screen.getByLabelText('Pseudo'), { target: { value: 'leo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' }));
  await waitFor(() => expect(api.calls[0]!.body).toEqual({ username: 'leo' }));
});
it('hors ligne, toute modification affiche « Nécessite le réseau »', async () => {
  const api = createFakeApi(); api.setOffline('reject');
  await renderApp({ path: '/profile', me: makeMe(), api });
  fireEvent.change(screen.getByLabelText('Pseudo'), { target: { value: 'leo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
});
```
Autres tests du fichier :
- Une réponse 409 `username_taken` donne l'alerte « Ce pseudo est déjà pris. ».
- Changement de mot de passe :
  - champs « Mot de passe actuel », « Nouveau mot de passe » et « Confirmation », puis « Changer le mot de passe » ;
  - la requête est `POST /api/auth/password` avec `{ currentPassword: 'ancien mot de passe ok', newPassword: 'cheval agrafe batterie correcte' }`, et le statut « Mot de passe changé. Tes autres appareils ont été déconnectés. » s'affiche ;
  - une réponse 401 `invalid_credentials` donne l'alerte « Mot de passe actuel incorrect. ».
- `makeMe({ mustChangePassword: true, role: 'admin' })` affiche le `Banner` « Ton mot de passe doit être changé avant de continuer (14 caractères au moins pour un administrateur). », et seule la section mot de passe est rendue (`queryByText('Entraînement') === null`).
- « Déconnecter tous mes appareils » ouvre `LogoutDialog` ; la confirmation envoie `POST /api/auth/logout-all`. « Se déconnecter » ouvre `LogoutDialog` en mode `current`.
- Section Entraînement :
  - elle affiche « Prendre du muscle », « Jamais » et « 3 séances de 45 min », lus dans le miroir `training_profile` ;
  - « Modifier l'objectif » affiche `GoalStep` en mode `edit`, et « Enregistrer » envoie le PATCH `{ goal: 'strength' }` ;
  - le mode prudent passe par `CautiousModeToggle` et envoie le PATCH `{ cautiousMode: true }`.
- Liens : « Lieux » vers `/profile/places`, « Santé » vers `/profile/health`, « Confidentialité » vers `/profile/privacy`, « Réglages » vers `/settings`.

`apps/web/test/places/places-page.test.tsx`, à partir des miroirs `place`, `gym` et `home_equipment` (p-1 salle g-1 « Basic Fit » principal et visible, p-2 maison « Garage ») :
- la liste affiche « Basic Fit » avec le badge « Principal », puis « Garage » ;
- « Définir comme principal » sur p-2 envoie `PATCH /api/places/p-2` avec `{ isPrimary: true }` ;
- renommer p-2 en « Cave » envoie `PATCH /api/places/p-2` avec `{ name: 'Cave' }`. Le champ a `maxLength === 30` ;
- décocher « Visible à la salle » sur p-1 envoie `PATCH /api/places/p-1` avec `{ visibleAtGym: false }` ;
- « Supprimer » sur p-2, puis confirmation, envoie `DELETE /api/places/p-2` avec `{}` ;
- « Supprimer » sur p-1 (principal) affiche le choix « Nouveau lieu principal ». Choisir « Garage » envoie `DELETE /api/places/p-1` avec `{ newPrimaryId: 'p-2' }` ;
- avec un seul lieu, « Supprimer » est désactivé et le texte « Tu dois garder au moins un lieu. » s'affiche ;
- une réponse 409 `last_place` donne le même message ;
- « Ajouter une salle » affiche `GymPicker`, avec `isPrimary` faux et `defaultVisible` vrai pour un adulte ;
- « Ajouter une maison » suit le parcours nom, préréglage et liste, puis envoie `POST /api/places` avec `{ kind: 'home', name: 'Garage 2', equipment: […], isPrimary: false }` ;
- `PlaceDetail` d'une maison : cocher « Haltères fixes ou réglables » envoie `PUT /api/places/p-2/equipment/dumbbells` avec `{}`, et décocher « Chaise ou banc stable » envoie `DELETE /api/places/p-2/equipment/chair` ;
- `PlaceDetail` d'une salle affiche un lien « Voir la salle » vers `/gyms/g-1` et ne propose aucune case de matériel.

`apps/web/test/places/gym-page.test.tsx` :
```ts
const detail = (o: Partial<GymDetail> = {}): GymDetail => ({
  id: 'g-1', name: 'Basic Fit', city: 'Lyon', loadSettings: defaultLoadSettings('gym'), deletedAt: null, equipment: ['barbell', 'flat_bench'],
  canEdit: true, visibleMembers: ['lea', 'max'],
  history: Array.from({ length: 12 }, (_, i) => ({ at: `2026-10-0${(i % 6) + 1}T10:00:00.000Z`, action: 'add_equipment' as const,
    authorUsername: i === 0 ? null : 'lea', detail: { code: 'barbell' } })), ...o });
it('affiche matériel, membres visibles et les 10 dernières modifications', async () => {
  const api = createFakeApi().on('GET', '/api/gyms/g-1', { status: 200, body: detail() });
  await renderApp({ path: '/gyms/g-1', me: makeMe(), api });
  await screen.findByRole('heading', { name: 'Basic Fit' });
  expect(document.body.textContent).toContain('Lyon');
  expect(document.body.textContent).toContain('Barre droite et disques');
  const members = screen.getByRole('list', { name: 'Qui va à cette salle' });
  expect(within(members).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['lea', 'max']);
  const hist = within(screen.getByRole('list', { name: 'Dernières modifications' })).getAllByRole('listitem');
  expect(hist).toHaveLength(10);
  expect(hist[0]!.textContent).toContain('ancien membre');
  expect(hist[1]!.textContent).toContain('modifié par lea');
  expect(hist[1]!.textContent).toContain('Matériel ajouté : Barre droite et disques');
});
```
Autres tests :
- Avec `canEdit: true`, « Modifier » avec le nom « Basic Fit Part-Dieu » envoie `PATCH /api/gyms/g-1` avec `{ name: 'Basic Fit Part-Dieu' }`. Cocher « Kettlebell » envoie `PUT /api/gyms/g-1/equipment/kettlebell`, et décocher « Banc plat » envoie `DELETE /api/gyms/g-1/equipment/flat_bench`.
- Avec `canEdit: false`, aucun bouton « Modifier » ni case cochable n'apparaît, et le texte « Seuls les membres qui ont cette salle parmi leurs lieux peuvent la modifier. » s'affiche.
- Avec `visibleMembers: []`, la page affiche « Personne n'est visible pour l'instant. ».
- Hors ligne, avec les miroirs `gym` et `gym_equipment` seuls :
  - le `Banner` « Hors ligne : dernière version connue. » s'affiche ;
  - le nom et le matériel viennent du miroir ;
  - aucune case n'est cochable.

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- profile/ places/places-page places/gym-page` : échec attendu, car les modules sont introuvables et les routes affichent `NotFound`.

- [ ] **Step 3: Implement**

- `ProfilePage` :
  - section « Compte » : pseudo (`validateUsername` local, puis `repos.me.updateUsername`), date de naissance en lecture seule avec « Seul l'administrateur peut la corriger. », section mot de passe (`PasswordFields` et `checkNewPassword` avec `me.role`), puis les boutons « Se déconnecter » et « Déconnecter tous mes appareils » (`LogoutDialog`) ;
  - section « Entraînement » : valeurs lues avec `useLive(() => repos.profile.get())`. Chaque « Modifier … » rend l'écran d'onboarding correspondant en `mode="edit"` ;
  - section « Mes rubriques » : liens vers les autres pages ;
  - si `me.mustChangePassword`, seule la section mot de passe est rendue ; après succès, `repos.me.refresh()`.
- `PlacesPage` : `useLive(() => repos.places.list())`. Une ligne par lieu, avec les actions ci-dessus. Les confirmations passent par `Dialog`. Le bouton « Supprimer » est désactivé quand `list.length === 1`. Pour supprimer le lieu principal, il faut choisir parmi les autres lieux dans une `ChoiceList` « Nouveau lieu principal ». Les messages `last_place` et `primary_required` sont surchargés (« Tu dois garder au moins un lieu. », « Choisis d'abord un nouveau lieu principal. »).
- `PlaceDetail` : une maison affiche le nom modifiable et `EquipmentChecklist kind="home"`. Chaque bascule appelle `repos.places.setEquipment` et la case reste désactivée pendant l'appel. Une salle affiche le lien et la visibilité.
- `GymPage` :
  - `repos.gyms.detail(id)` ;
  - historique : `slice(0, GYM_HISTORY_LIMIT)` (le serveur renvoie l'ordre décroissant) ;
  - libellés d'action : `create` « Création de la salle », `update_info` « Nom ou ville modifiés », `add_equipment` « Matériel ajouté : <libellé> », `remove_equipment` « Matériel retiré : <libellé> », `update_load_settings` « Réglages de charge modifiés ». Le libellé du matériel vient de `detail.code` quand c'est un `EquipmentCode`.
  - Auteur : « modifié par <pseudo> », ou « ancien membre » si `authorUsername === null`.
  - Pas d'écran d'édition des réglages de charge : c'est la brique 3.
- `App.tsx` : les quatre routes, dans `AppShell`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- profile/ places/` : tous les tests sont verts.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(salles): profil, lieux et fiche de salle"`

---

### Task 33: Écrans d'administration

**Files:**
- Create: `apps/web/src/features/admin/{MembersPage.tsx, InvitationsPage.tsx, AdminGymsPage.tsx, ServerHealthPage.tsx, AdminNav.tsx, share-message.ts, admin.module.css}`
- Modify: `apps/web/src/App.tsx` (routes `/admin/members`, `/admin/invitations`, `/admin/gyms`, `/admin/health`)
- Test: `apps/web/test/admin/members.test.tsx`, `apps/web/test/admin/invitations.test.tsx`, `apps/web/test/admin/gyms-health.test.tsx`

**Interfaces:**
- Consumes :
  - T28 : `Page`, `Field`, `Button`, `Banner`, `Dialog`, `CopyButton`, `useAction`, `formatDate`, `formatDateTime`, `formatAge`, `useServices` (`now`), `renderApp`, `makeMe`, `createFakeApi` ;
  - T29 : `useRepos().admin`, `useRepos().gyms.update` ;
  - contracts : `MemberSummary`, `InvitationSummary`, `InvitationState`, `OpsStatus`, `OpsStatusResponse`, `INVITATION_NOTE_MAX`, `INVITATION_TTL_DAYS`.
- Produces :
```ts
// features/admin/share-message.ts
export function buildInvitationShareMessage(origin: string, link: string, code: string): string;
// = `1. Installe Tailscale et accepte le partage.\n2. Ouvre ${origin} et installe l'appli.\n3. Dans l'appli, colle ce lien ou tape le code ${code} (valable 7 jours).\n${link}`
export const BACKUP_LATE_MS = 26 * 3_600_000;   // [décision plan] période 24 h + délai de grâce 2 h (08 §9)
export const DISK_WARN_PCT = 80;
export function MembersPage(): JSX.Element; export function InvitationsPage(): JSX.Element;
export function AdminGymsPage(): JSX.Element; export function ServerHealthPage(): JSX.Element;
export function AdminNav(): JSX.Element;   // onglets Membres · Invitations · Salles · État du serveur
```

**Spec:** 02 §6, R-ROLE-2 (message `last_admin`), R-ROLE-4 (l'interface masque, le serveur décide), R-INV-1, R-INV-2 (message), R-INV-3 (code affiché une seule fois, Copier, Partager), R-INV-7, R-INV-9, R-RST-3, R-RST-4 (message), R-ADM-1, R-AGE-4, R-SUP-2, R-SAL-7, 08 §9 (page « santé »), 03 P-ADM-1 (aucune donnée C1 à C3 affichée)

- [ ] **Step 1: Write the failing test**

`apps/web/test/admin/members.test.tsx` :
```ts
const admin = makeMe({ id: 'u-1', username: 'bastien', role: 'admin' });
const members: MemberSummary[] = [
  { id: 'u-1', username: 'bastien', role: 'admin', status: 'active', isMinor: false, lastLoginAt: '2026-10-06T08:00:00.000Z', onboardingCompleted: true, consents: { health: false, ai_coach: false }, activeSessions: 2 },
  { id: 'u-2', username: 'lea', role: 'member', status: 'active', isMinor: true, lastLoginAt: null, onboardingCompleted: false, consents: { health: true, ai_coach: false }, activeSessions: 0 },
];
const base = () => createFakeApi().on('GET', '/api/admin/members', { status: 200, body: members });
it('liste les membres avec badge mineur, dernière connexion et onboarding', async () => {
  await renderApp({ path: '/admin/members', me: admin, api: base() });
  const row = await screen.findByRole('row', { name: /lea/ });
  expect(row.textContent).toContain('mineur');
  expect(row.textContent).toContain('Jamais connecté');
  expect(row.textContent).toContain('Onboarding en cours');
  expect(screen.getByRole('row', { name: /bastien/ }).textContent).toContain('06/10/2026');
});
it('affiche le lien de réinitialisation une seule fois', async () => {
  const api = base().on('POST', '/api/admin/members/:id/reset-link', { status: 200, body: { code: 'ABCD-EFGH-JKMN-PQRS', link: 'https://x/reset#ABCD-EFGH-JKMN-PQRS', expiresAt: '2026-10-07T12:00:00.000Z' } });
  await renderApp({ path: '/admin/members', me: admin, api });
  fireEvent.click(within(await screen.findByRole('row', { name: /lea/ })).getByRole('button', { name: 'Lien de réinitialisation' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Générer' }));
  expect(await screen.findByText('ABCD-EFGH-JKMN-PQRS')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copier' })).toBeTruthy();
  expect(document.body.textContent).toContain('Ce code ne sera plus affiché.');
  fireEvent.click(screen.getByRole('button', { name: "J'ai transmis le lien" }));
  expect(screen.queryByText('ABCD-EFGH-JKMN-PQRS')).toBeNull();
});
```
Autres tests :
- « Fermer les sessions », puis confirmation, envoie `POST /api/admin/members/u-2/revoke-sessions` avec `{}`.
- « Désactiver », puis confirmation, envoie `POST /api/admin/members/u-2/status` avec `{ status: 'disabled' }`. Un membre `disabled` affiche « Réactiver », qui envoie `{ status: 'active' }`.
- « Promouvoir administrateur » ouvre une boîte avec « Ton mot de passe ». La confirmation envoie `POST /api/admin/members/u-2/role` avec `{ role: 'admin', password: 'mon mot de passe admin' }`.
- « Rétrograder » sur u-1, avec une réponse 409 `last_admin`, donne l'alerte « Il doit rester au moins un administrateur actif. ».
- « Corriger la date de naissance » envoie `POST /api/admin/members/u-2/birth-date` avec `{ birthDate: '2009-02-01' }`. Une réponse 400 `under_min_age` donne « appsport est réservé aux 16 ans et plus ».
- « Supprimer » : le bouton « Supprimer définitivement » reste désactivé tant que le champ « Tape le pseudo pour confirmer » ne vaut pas `lea`. Ensuite, il envoie `POST /api/admin/members/u-2/delete` avec `{ confirmUsername: 'lea' }`.
- Une réponse 403 `reset_self_forbidden` donne « Pour toi-même, utilise la commande admin:reset sur le serveur. ».
- Après chaque action réussie, `GET /api/admin/members` est rappelé.
- Aucune ligne n'affiche de donnée C1 à C3 : seuls `consents.health` et `consents.ai_coach` sont affichés, en « oui » ou « non ».
- Un membre (`makeMe()`) qui ouvre `/admin/members` voit « Page introuvable », et aucune requête n'est envoyée.

`apps/web/test/admin/invitations.test.tsx` :
```ts
it('crée une invitation, montre le code une fois avec Copier, Partager et le message', async () => {
  const share = vi.fn(async () => {}); Object.assign(navigator, { share });
  const api = createFakeApi()
    .on('GET', '/api/admin/invitations', { status: 200, body: [] })
    .on('POST', '/api/admin/invitations', { status: 201, body: { invitation: { id: 'i-1', note: 'pour Léa', createdAt: '2026-10-06T12:00:00.000Z', expiresAt: '2026-10-13T12:00:00.000Z', state: 'pending', usedByUsername: null }, code: 'ABCD-EFGH-JKMN-PQRS', link: `${window.location.origin}/invite#ABCD-EFGH-JKMN-PQRS` } });
  await renderApp({ path: '/admin/invitations', me: admin, api });
  fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '2009-05-01' } });
  fireEvent.change(screen.getByLabelText('Note (facultative)'), { target: { value: 'pour Léa' } });
  expect((screen.getByLabelText('Note (facultative)') as HTMLInputElement).maxLength).toBe(60);
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’invitation' }));
  await screen.findByText('ABCD-EFGH-JKMN-PQRS');
  expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({ birthDate: '2009-05-01', note: 'pour Léa' });
  const message = buildInvitationShareMessage(window.location.origin, `${window.location.origin}/invite#ABCD-EFGH-JKMN-PQRS`, 'ABCD-EFGH-JKMN-PQRS');
  expect(screen.getByTestId('share-message').textContent).toBe(message);
  fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
  expect(share).toHaveBeenCalledWith({ text: message });
});
```
Autres tests :
- `buildInvitationShareMessage('https://o', 'https://o/invite#C', 'C')` vaut exactement la chaîne définie dans Produces.
- Sans `navigator.share`, le bouton « Partager » est absent et « Copier le message » est présent.
- La liste affiche les états : `pending` « En attente (expire le 13/10/2026) », `used` « Utilisée par lea », `revoked` « Révoquée », `expired` « Expirée ». « Révoquer » n'existe que pour `pending` ; avec confirmation, il envoie `POST /api/admin/invitations/i-1/revoke`, puis recharge la liste.
- Une réponse 400 `under_min_age` donne « appsport est réservé aux 16 ans et plus ».
- Après « J'ai noté le code », le code n'est plus affiché nulle part.

`apps/web/test/admin/gyms-health.test.tsx` :
- `AdminGymsPage` :
  - liste les salles de `GET /api/gyms?q=` ;
  - « Modifier » avec la ville « Villeurbanne » envoie `PATCH /api/gyms/g-1` avec `{ city: 'Villeurbanne' }` ;
  - « Supprimer », puis confirmation, envoie `DELETE /api/admin/gyms/g-1` avec `{}`, puis recharge la liste ;
  - une réponse 409 `gym_in_use` donne « Des membres ont encore cette salle parmi leurs lieux : elle ne peut pas être supprimée. ».
- `ServerHealthPage`, avec `now = Date.parse('2026-10-06T12:00:00.000Z')` et `GET /api/admin/ops-status` → `{ version: 'v1.2.3', opsStatus: OPS }`, où `OPS = { backup: { at: '2026-10-06T07:00:00.000Z', ok: true }, restoreTest: { at: '2026-10-04T03:00:00.000Z', ok: true }, host: { at: '2026-10-06T02:00:00.000Z', ok: true, disks: [{ mount: '/', usedPct: 42 }, { mount: '/srv/appsport', usedPct: 81 }], smartOk: true, rebootRequired: true }, deploy: { at: '2026-10-01T19:00:00.000Z', version: 'v1.2.3', previousVersion: 'v1.2.2', ok: true } }`. La page affiche :
  - « Version en service : v1.2.3 » ;
  - « Dernier déploiement : v1.2.3 le 01/10/2026 (réussi) » ;
  - « Dernière sauvegarde : il y a 5 h (réussie) » ;
  - « Dernier test de restauration : 04/10/2026 (réussi) » ;
  - « / : 42 % » et « /srv/appsport : 81 % (au-delà de 80 %) » ;
  - « Redémarrage nécessaire ».
- Avec une sauvegarde à `2026-10-05T08:00:00.000Z` (28 h), un `Banner` warning « Sauvegarde en retard (plus de 26 h) » s'affiche.
- Avec `backup.ok: false`, la page affiche « (échouée) » et un `Banner` error.
- Avec `opsStatus: null`, la page affiche « Aucun état d'exploitation disponible : les scripts de l'hôte n'ont encore rien écrit. ».

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- admin/` : échec attendu, car les modules `features/admin/*` sont introuvables.

- [ ] **Step 3: Implement**

- `MembersPage` :
  - tableau accessible (`<table>`, une ligne `role="row"` par membre, nommée par le pseudo). Colonnes : pseudo, rôle (« admin » ou « membre »), statut, badge « mineur », dernière connexion (`formatDateTime` ou « Jamais connecté »), « Onboarding terminé » ou « Onboarding en cours », santé et coach (« oui » ou « non »), sessions actives ;
  - chaque action ouvre une `Dialog` de confirmation, appelle `repos.admin.*` avec `useAction` et ses surcharges de messages, puis recharge la liste ;
  - le lien de réinitialisation est affiché dans la boîte jusqu'à « J'ai transmis le lien ». Il n'est jamais rangé ailleurs que dans l'état du composant.
- `InvitationsPage` :
  - formulaire avec « Date de naissance » (`type="date"`, obligatoire) et « Note (facultative) » (`maxLength` `INVITATION_NOTE_MAX`) ;
  - le code s'affiche avec `CopyButton`, « Partager » (`navigator.share({ text })` si disponible, sinon « Copier le message ») et `<pre data-testid="share-message">` ;
  - le message vient de `buildInvitationShareMessage(window.location.origin, link, code)` ;
  - libellés d'état fixés ci-dessus.
- `AdminGymsPage` : `repos.admin.gyms()`, modification en ligne avec `repos.gyms.update`, suppression avec `repos.admin.deleteGym`.
- `ServerHealthPage` :
  - `repos.admin.opsStatus()` ;
  - âge des sauvegardes calculé avec `formatAge(at, services.now())` ;
  - retard si `now - Date.parse(backup.at) > BACKUP_LATE_MS` ;
  - disque en alerte si `usedPct > DISK_WARN_PCT` ;
  - « SMART : OK » ou « SMART : problème détecté ».
- `AdminNav` : liens vers les 4 pages, affichés en tête de chacune.
- `App.tsx` : les 4 routes. Le garde de T28 renvoie déjà `not_found` à un membre.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- admin/` : tous les tests sont verts.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(admin): écrans membres, invitations, salles et état du serveur"`

---

### Task 34: Confidentialité, santé, export, suppression, compteurs et rejets

**Files:**
- Create: `apps/web/src/features/privacy/{PrivacySettingsPage.tsx, HealthSection.tsx, ConsentWithdrawDialog.tsx, ExportButton.tsx, DeleteAccountDialog.tsx, HealthReconsentGate.tsx, privacy.module.css}`
- Create: `apps/web/src/features/status/{PendingCounter.tsx, ConnectionStatus.tsx, RejectionsPage.tsx, SettingsPage.tsx}`
- Create: `apps/web/src/ui/download.ts` (réexporté par `ui/index.ts`)
- Modify: `apps/web/src/ui/AppShell.tsx` (zone d'état : `ConnectionStatus`, `PendingCounter`, `RejectedCounter`), `apps/web/src/App.tsx` (routes `/profile/health`, `/profile/privacy`, `/settings`, `/rejections` ; `<HealthReconsentGate/>` monté pour une session onboardée)
- Test: `apps/web/test/privacy/withdraw.test.tsx`, `apps/web/test/privacy/export-delete.test.tsx`, `apps/web/test/privacy/health-section.test.tsx`, `apps/web/test/status/counters.test.tsx`, `apps/web/test/status/rejections-settings.test.tsx`

**Interfaces:**
- Consumes :
  - T28 : `Page`, `Dialog`, `Field`, `Button`, `Banner`, `useAction`, `useSyncState`, `useMe`, `useLive`, `formatDate`, `formatDateTime`, `plural`, `renderApp`, `renderWithServices`, `makeMe`, `createFakeApi`, `createFakeSyncEngine` ;
  - T29 : `useRepos` (`consent.*`, `me.exportData/deleteAccount`, `status.pendingCount/persistGranted`, `rejections.list/count/dismiss`, `profile.update`), `seedMirror`, `seedOutbox`, `dumpAll` ;
  - T31 : `HealthConsentPanel`, `ScreeningQuestions`, `LimitationsEditor`, `CautiousModeToggle` ;
  - domain : `parisDate` ;
  - contracts : `HEALTH_CONSENT_TEXT`, `PRIVACY_POLICY_VERSION`, `ConnectionState`.
- Produces :
```ts
// ui/download.ts
export function downloadJson(filename: string, data: unknown): void;   // Blob application/json + <a download> + revokeObjectURL
export function exportFileName(nowMs: number): string;                 // 'appsport-export-AAAA-MM-JJ.json' (date de Paris)
// features/status
export function PendingCounter(): JSX.Element;    // data-testid="pending-counter" data-count ; « N en attente »
export function RejectedCounter(): JSX.Element;   // data-testid="rejected-counter" data-count ; lien /rejections « N refusé(s) » si N > 0
export function ConnectionStatus(): JSX.Element;  // data-testid="connection-status" data-state=<ConnectionState>
export const CONNECTION_LABELS: Record<ConnectionState, string>;
export const REJECTION_CODE_LABELS: Record<string, string>;
export function RejectionsPage(): JSX.Element;    // /rejections
export function SettingsPage(): JSX.Element;      // /settings
// features/privacy
export function PrivacySettingsPage(): JSX.Element;   // /profile/privacy
export function HealthSection(): JSX.Element;         // /profile/health
export function ConsentWithdrawDialog(p: { open: boolean; onClose(): void; onWithdrawn?(): void }): JSX.Element | null;
export function ExportButton(p: { label?: string /* 'Télécharger mes données' */ }): JSX.Element;
export function DeleteAccountDialog(p: { open: boolean; onClose(): void }): JSX.Element | null;
export function HealthReconsentGate(): JSX.Element | null;
```

**Spec:** 01 R-SYN-18 (« Ignorer »), R-SYN-31 (affichage dans Réglages), R-SYN-33 (voyant, déjà en T29), R-SYN-34, R-SYN-30 (état connecté sans `navigator.onLine`), 02 §11 (Santé, Confidentialité), R-CST-4 (affichage), R-CST-5, R-CST-6, 03 P-CST-1, P-CST-3, P-CST-4 (purge locale), R-EXP-1, 03 P-DRT-1, R-SUP-1, R-SUP-4 (message), R-SUP-5, 03 P-DRT-4, P-DRT-6, 03 §17 n°4 et n°9 (côté client)

- [ ] **Step 1: Write the failing test**

`apps/web/test/status/counters.test.tsx` :
```ts
it.each([
  ['online', 'En ligne'], ['offline', 'Hors ligne'], ['unknown', 'Connexion…'], ['unauthenticated', 'Session expirée'],
  ['protocol_unsupported', 'Mise à jour nécessaire'], ['account_deleted', 'Compte supprimé'],
] as const)('connection-status reflète %s', async (state, label) => {
  await renderApp({ path: '/', me: makeMe(), sync: createFakeSyncEngine({ connection: state }) });
  const el = screen.getByTestId('connection-status');
  expect(el.dataset.state).toBe(state);
  expect(el.textContent).toBe(label);
});
it('pending-counter suit SyncState.pending', async () => {
  const sync = createFakeSyncEngine({ pending: 0 });
  await renderApp({ path: '/', me: makeMe(), sync });
  expect(screen.getByTestId('pending-counter').dataset.count).toBe('0');
  act(() => sync.set({ pending: 3 }));
  expect(screen.getByTestId('pending-counter').dataset.count).toBe('3');
  expect(screen.getByTestId('pending-counter').textContent).toBe('3 en attente');
});
it('rejected-counter compte les rejets non ignorés et mène à /rejections', async () => {
  const r = await renderApp({ path: '/', me: makeMe() });
  await seedMirror(r.db, 'sync_rejection', [{ id: 'r-1', ownerId: 'u-1', opId: 'op-1', entity: 'fixture_note', rowId: 'n-1', code: 'validation', detailJson: '{}', dismissedAt: null, createdAt: '2026-10-06T10:00:00.000Z' }]);
  await waitFor(() => expect(screen.getByTestId('rejected-counter').dataset.count).toBe('1'));
  expect(within(screen.getByTestId('rejected-counter')).getByRole('link').getAttribute('href')).toBe('/rejections');
});
```

`apps/web/test/status/rejections-settings.test.tsx` :
- `/rejections` avec r-1 (serveur, `validation`) et une deadletter `op-7` (`parent_rejected`) :
  - deux éléments s'affichent, avec « Données invalides » et « Élément parent refusé » ;
  - « Ignorer » sur r-1 crée dans l'outbox une op `patch` `{ dismissedAt: '2026-10-06T12:00:00.000Z' }`. L'élément disparaît une fois le miroir mis à jour par `writeLocal`, et `rejected-counter` passe à `1`.
- Sans rejet, la page affiche « Aucun refus. ».
- `/settings` selon `meta.persistGranted` :
  - `true` : « Stockage persistant : accordé » ;
  - `false` : « Stockage persistant : refusé », puis le conseil « Ton navigateur peut effacer les données de l'appli si l'espace manque. Pense à télécharger tes données régulièrement. » avec un lien vers `/profile/privacy` ;
  - absent : « Stockage persistant : pas encore demandé ».

`apps/web/test/privacy/withdraw.test.tsx` :
```ts
it('retrait : liste, export proposé, mot de passe, puis purge locale des copies C2', async () => {
  const api = createFakeApi()
    .on('POST', '/api/me/consents/withdraw', { status: 204 })
    .on('GET', '/api/me', { status: 200, body: makeMe() })
    .on('GET', '/api/me/export', { status: 200, body: { format: 'appsport-export/1', exportedAt: '2026-10-06T12:00:00.000Z', account: {}, tables: {}, gyms: [], gymHistory: [] } });
  const me = makeMe({ consents: { health: { active: true, textVersion: '1.0', at: '2026-10-01T10:00:00.000Z' }, ai_coach: { active: false, textVersion: null, at: null } } });
  const r = await renderApp({ path: '/profile/privacy', me, api });
  await seedMirror(r.db, 'limitation', [{ id: 'l-1', ownerId: 'u-1', bodyArea: 'knee', side: 'left', severity: 'mild', note: 'TEMOIN-C2', active: true }]);
  await seedMirror(r.db, 'health_screening', [{ id: 'u-1', ownerId: 'u-1', caution: true, questionnaireVersion: '1.0', answeredAt: '2026-10-01T10:00:00.000Z' }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Retirer mon accord santé' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.textContent).toContain('indicateur de prudence');
  expect(dialog.textContent).toContain('limitations et zones sensibles');
  expect(dialog.textContent).toContain('Le mode prudent est conservé.');
  expect(within(dialog).getByRole('button', { name: 'Télécharger mes données d’abord' })).toBeTruthy();
  const confirm = within(dialog).getByRole('button', { name: 'Retirer mon accord' }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText('Mot de passe'), { target: { value: 'cheval agrafe batterie correcte' } });
  fireEvent.click(confirm);
  await screen.findByText('Accord retiré. Tes données de santé ont été effacées.');
  expect(api.calls.find((c) => c.path === '/api/me/consents/withdraw')!.body).toEqual({ type: 'health', password: 'cheval agrafe batterie correcte' });
  expect(await dumpAll(r.db)).not.toContain('TEMOIN-C2');
});
```
Autres tests :
- Une réponse 401 `invalid_credentials` donne « Mot de passe incorrect. ». Le miroir `limitation` est alors intact.
- Hors ligne, la page affiche « Nécessite le réseau » et ne purge rien.
- `HealthReconsentGate` :
  - avec `consents.health = { active: true, textVersion: '0.9', … }` et le chemin `/`, une `Dialog` « Le texte de l'accord santé a changé » affiche `HEALTH_CONSENT_TEXT.text` et une case décochée ;
  - « J'accepte » envoie `POST /api/me/consents` avec `{ type: 'health', textVersion: '1.0' }` ;
  - « Je refuse » ouvre `ConsentWithdrawDialog`, puisqu'un refus vaut retrait ;
  - avec `textVersion: '1.0'` ou un accord inactif, aucune boîte ne s'affiche.

`apps/web/test/privacy/export-delete.test.tsx` :
```ts
it('export : avertit si la file n’est pas vide puis télécharge le JSON', async () => {
  const createObjectURL = vi.fn(() => 'blob:x'); const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('appsport-export-2026-10-06.json'); });
  const api = createFakeApi().on('GET', '/api/me/export', { status: 200, body: { format: 'appsport-export/1', exportedAt: '2026-10-06T12:00:00.000Z', account: { username: 'lea' }, tables: {}, gyms: [], gymHistory: [] } });
  const r = await renderApp({ path: '/profile/privacy', me: makeMe(), api });
  await seedOutbox(r.db, 'u-1', 2);
  fireEvent.click(await screen.findByRole('button', { name: 'Télécharger mes données' }));
  expect((await screen.findByRole('status')).textContent).toContain("2 éléments ne sont pas encore envoyés au serveur : ils ne figureront pas dans l'export.");
  expect(api.calls).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Exporter quand même' }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(createObjectURL).toHaveBeenCalledTimes(1);
});
```
Autres tests :
- Avec une file vide, le téléchargement part sans avertissement, au premier clic.
- Suppression du compte :
  - « Supprimer mon compte » ouvre `DeleteAccountDialog`, qui propose « Télécharger mes données » et la liste « Ton compte, ton profil, tes lieux, tes données de santé et l'historique de tes accords seront supprimés. Les salles restent : tu y apparaîtras comme « ancien membre ». Le journal de sécurité est gardé 12 mois et les sauvegardes 30 jours au plus. » ;
  - la boîte contient la mention P-DRT-6 « Si tu as utilisé le coach, appsport ne peut pas faire effacer tes échanges chez Anthropic : ils y sont effacés sous 30 jours, ou gardés jusqu'à 2 ans si ses filtres de sécurité en ont signalé un. » ;
  - « Supprimer définitivement » reste désactivé tant que le mot de passe est vide ;
  - la confirmation envoie `POST /api/me/delete` avec `{ password: 'cheval agrafe batterie correcte' }`. On vérifie ensuite que `await r.db.outbox.count() === 0`, que `getMeta(r.db, 'me')` est `undefined`, que `location() === '/login?reason=account_deleted'` et que le texte « Ce compte a été supprimé » s'affiche.
- Une réponse 409 `last_admin` donne « Tu es le dernier administrateur : nomme d'abord un autre administrateur. ». Rien n'est effacé.
- Le test « 410 d'un autre appareil » : un `GET /api/me` qui répond 410 `{ error: 'account_deleted' }` passe par `createApiClient` et `handleAccountDeleted`. La base locale est alors vidée, outbox comprise, et la page est redirigée vers `/login?reason=account_deleted`. Avec un 410 `watermark_expired`, rien n'est effacé.

`apps/web/test/privacy/health-section.test.tsx` :
- Sans accord, `/profile/health` affiche `HealthConsentPanel`. L'accord donne `POST /api/me/consents`, puis `ScreeningQuestions` s'affiche.
- Avec accord :
  - la page affiche « Dernière réponse le 01/10/2026 » (miroir `health_screening`) ;
  - la limitation l-1 est listée « Genou · gauche · légère ». « Supprimer » envoie `DELETE /api/me/limitations/l-1` avec `{}`, et « Modifier » envoie `PATCH /api/me/limitations/l-1` ;
  - une réponse 403 `health_consent_required` donne « Cette action demande ton accord santé. ».
- `CautiousModeToggle` envoie le PATCH `{ cautiousMode: false }`. Pour un mineur, il est désactivé.

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- privacy/ status/counters status/rejections-settings` : échec attendu, car les modules et les `data-testid` sont introuvables.

- [ ] **Step 3: Implement**

- `ConnectionStatus` lit `useSyncState().connection`. `PendingCounter` lit `useSyncState().pending`. `RejectedCounter` lit `useLive(() => repos.rejections.count())`. Les trois sont montés dans la zone d'état d'`AppShell`.
- `REJECTION_CODE_LABELS` : `validation` « Données invalides », `forbidden` « Action non autorisée », `parent_rejected` « Élément parent refusé », `stale_revision` « Version périmée », `unknown_entity` « Type de donnée inconnu », `protocol` « Version de l'appli trop ancienne ». Le code brut sert de repli.
- `RejectionsPage` : `useLive(() => repos.rejections.list())`. Chaque élément affiche l'entité, le motif, `formatDateTime(at)` et un bouton « Ignorer » qui appelle `repos.rejections.dismiss(id)`.
- `SettingsPage` : `repos.status.persistGranted()`, avec les textes ci-dessus.
- `PrivacySettingsPage` :
  - « Version en vigueur : 1.0 » et un lien « Lire la page Confidentialité et règles » ;
  - état de l'accord santé (« Donné le <date> » ou « Non donné »), avec le bouton « Retirer mon accord santé » s'il est actif, sinon un lien vers `/profile/health` ;
  - accord coach : « Non donné » (brique 4) ;
  - `ExportButton` et « Supprimer mon compte ».
- `ConsentWithdrawDialog` :
  - texte de liste : « Seront effacés : ton indicateur de prudence (questionnaire), tes limitations et zones sensibles, et toute donnée de santé enregistrée par l'appli (douleurs, pesées, suivi nutritionnel). Le mode prudent est conservé. » ;
  - `ExportButton label="Télécharger mes données d’abord"` ;
  - champ « Mot de passe » ;
  - « Retirer mon accord » appelle `repos.consent.withdrawHealth(password)`. Le retour « Accord retiré… » s'affiche ensuite, puis `onWithdrawn`.
- `ExportButton` : `repos.status.pendingCount()`. Si le compte est positif, un `Banner` info s'affiche avec le texte « N élément(s) … » (`plural`) et « Exporter quand même ». Ensuite `repos.me.exportData()`, puis `downloadJson(exportFileName(services.now()), data)`.
- `DeleteAccountDialog` : textes ci-dessus. `repos.me.deleteAccount(password)`, puis `navigate('/login?reason=account_deleted')`. Message surchargé pour `last_admin`.
- `HealthReconsentGate` : `useLive(() => repos.consent.needsHealthReconsent())`. Il est monté dans `App` pour une session onboardée et n'est pas monté sur `/onboarding`.
- `HealthSection` : composition des sous-composants de T31, plus la date de la dernière réponse et la liste des limitations avec « Modifier » et « Supprimer ».
- `downloadJson` : `URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))`, puis un `<a download>` créé, cliqué et retiré, puis `revokeObjectURL`. `exportFileName` utilise `parisDate(new Date(nowMs))`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- privacy/ status/`, puis `pnpm --filter @appsport/web test` (suite web complète), `pnpm lint` et `pnpm typecheck` : tout est vert.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(privacy): confidentialité, accord santé, export, suppression, compteurs et rejets"`
