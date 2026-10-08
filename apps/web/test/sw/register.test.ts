import type { HealthResponse } from '@appsport/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AppDb, LOCAL_DB_VERSION } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import { LOCAL_DB_MARKER_CACHE, LOCAL_DB_MARKER_KEY } from '../../src/sw/precache-manifest';
import type { PageToSw } from '../../src/sw/protocol';
import {
  bootServiceWorker,
  raiseLocalDbMarker,
  registerServiceWorker,
  type SwController,
  swControllerStore,
} from '../../src/sw/register';
import { createFakeSyncEngine, type FakeSyncEngine } from '../support/fake-api';
import { createFakeSwContainer, type FakeSwContainer, type FakeSwWorker } from '../support/fake-sw-container';
import { createFakeCacheStorage, quotaExceeded } from '../support/fake-sw-scope';
import { createTestLocalDb } from '../support/local-db';
import { until } from '../support/wait';

const HOUR_MS = 3_600_000;
const SKIP_WAITING: PageToSw = { type: 'SKIP_WAITING' };
const GET_STATUS: PageToSw = { type: 'GET_STATUS' };
const FILES = ['a.11111111.svg'];
const SYNC_ILLUSTRATIONS: PageToSw = { type: 'SYNC_ILLUSTRATIONS', files: FILES };

interface FakeDoc {
  doc: Pick<Document, 'visibilityState' | 'addEventListener'>;
  show(): void;
  hide(): void;
}

/** Document factice : visible au départ ; `show` et `hide` émettent `visibilitychange`. */
function createFakeDoc(): FakeDoc {
  const listeners: (() => void)[] = [];
  const state = { visibilityState: 'visible' as DocumentVisibilityState };
  const set = (v: DocumentVisibilityState) => {
    state.visibilityState = v;
    for (const fn of listeners) fn();
  };
  const doc = {
    get visibilityState() {
      return state.visibilityState;
    },
    addEventListener(type: string, fn: () => void) {
      if (type === 'visibilitychange') listeners.push(fn);
    },
  } as unknown as Pick<Document, 'visibilityState' | 'addEventListener'>;
  return { doc, show: () => set('visible'), hide: () => set('hidden') };
}

const health = (swKill: boolean): HealthResponse => ({
  status: 'ok',
  version: 'test',
  db: 'ok',
  protocol: 1,
  minProtocol: 1,
  epoch: 'e1',
  swKill,
});

/** Tours réels de la boucle (MessageChannel, fake-indexeddb), sans avancer l'horloge simulée. */
async function turns(n = 30): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Laisse répondre les SW puis passe le délai de GET_STATUS (1 s) : toute évaluation est finie. */
async function settled(): Promise<void> {
  await turns();
  await vi.advanceTimersByTimeAsync(1000);
  await turns();
}

const skipWaitings = (w: FakeSwWorker) => w.messages.filter((m) => m.type === 'SKIP_WAITING');

let db: AppDb;
let sync: FakeSyncEngine;
let page: FakeDoc;
let reload: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  db = createTestLocalDb();
  sync = createFakeSyncEngine({ connection: 'unknown' });
  page = createFakeDoc();
  reload = vi.fn<() => void>();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  swControllerStore.set(null);
});

function start(f: FakeSwContainer): SwController {
  return registerServiceWorker({ db, sync, container: f.container, doc: page.doc, reload });
}

describe('registerServiceWorker : recherche de mise à jour (R-PWA-2)', () => {
  it("enregistre /sw.js (scope /, updateViaCache 'none') et cherche une mise à jour au lancement", async () => {
    const f = createFakeSwContainer({ controller: true });
    const registerSpy = vi.spyOn(f.container, 'register');
    start(f);
    await until(() => f.registration.updateCalls === 1);
    expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
    expect(registerSpy).toHaveBeenCalledTimes(1);
    await settled();
    expect(f.registration.updateCalls).toBe(1);
  });

  it('au retour au premier plan, puis toutes les 60 min seulement quand la page est visible', async () => {
    const f = createFakeSwContainer({ controller: true });
    start(f);
    await until(() => f.registration.updateCalls === 1);
    page.hide();
    await settled();
    expect(f.registration.updateCalls).toBe(1);
    page.show();
    await until(() => f.registration.updateCalls === 2);
    await vi.advanceTimersByTimeAsync(HOUR_MS - 1000);
    await turns();
    expect(f.registration.updateCalls).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    await until(() => f.registration.updateCalls === 3);
    page.hide();
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    await settled();
    expect(f.registration.updateCalls).toBe(3);
  });
});

describe('registerServiceWorker : version disponible (R-PWA-2, R-PWA-9, R-DEP-4)', () => {
  it('SW déjà en attente et page contrôlée → available, après la réponse du SW en attente', async () => {
    const f = createFakeSwContainer({ controller: true, waiting: true });
    const c = start(f);
    await until(() => c.getState().available);
    expect(c.getState()).toEqual({ available: true, forced: false });
    const waiting = f.registration.waiting as FakeSwWorker;
    expect(waiting.messages).toContainEqual(GET_STATUS);
    expect(f.controllerMessages).not.toContainEqual(GET_STATUS);
  });

  it('première installation (sans contrôleur) → jamais available', async () => {
    const f = createFakeSwContainer({ controller: false });
    const c = start(f);
    await settled();
    f.installUpdate();
    await settled();
    expect(c.getState()).toEqual({ available: false, forced: false });
  });

  it('installUpdate() → { available: true, forced: false }, abonnés prévenus', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    const seen: boolean[] = [];
    c.subscribe((s) => seen.push(s.available));
    await settled();
    expect(c.getState().available).toBe(false);
    const worker = f.installUpdate();
    await until(() => c.getState().available);
    expect(c.getState()).toEqual({ available: true, forced: false });
    expect(seen).toEqual([true]);
    expect(worker.messages).toEqual([GET_STATUS]);
  });

  it('version de base locale supérieure → proposée', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await settled();
    f.installUpdate({ localDbVersion: LOCAL_DB_VERSION + 1 });
    await until(() => c.getState().available);
  });

  it("R-DEP-4 : localDbVersion inférieur → jamais proposé, applyUpdate n'envoie pas SKIP_WAITING", async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await settled();
    const worker = f.installUpdate({ localDbVersion: LOCAL_DB_VERSION - 1 });
    await until(() => worker.messages.length > 0);
    await settled();
    expect(worker.messages).toEqual([GET_STATUS]);
    expect(c.getState().available).toBe(false);
    await c.applyUpdate();
    expect(skipWaitings(worker)).toEqual([]);
    expect(f.controllerMessages).toEqual([]);
  });

  it("SW en attente muet → false après 1 s, applyUpdate n'envoie pas SKIP_WAITING", async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await settled();
    const worker = f.installUpdate({ silent: true });
    await until(() => worker.messages.length > 0);
    await settled();
    expect(c.getState().available).toBe(false);
    await c.applyUpdate();
    expect(skipWaitings(worker)).toEqual([]);
  });

  it('une version plus récente remplace celle qui attendait : seule la dernière reçoit SKIP_WAITING', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await settled();
    const first = f.installUpdate();
    await until(() => c.getState().available);
    const second = f.installUpdate();
    await until(() => second.messages.length > 0);
    await settled();
    expect(c.getState().available).toBe(true);
    await c.applyUpdate();
    expect(skipWaitings(first)).toEqual([]);
    expect(skipWaitings(second)).toEqual([SKIP_WAITING]);
  });
});

describe('registerServiceWorker : applyUpdate (R-PWA-4, R-PWA-3)', () => {
  it('un seul SKIP_WAITING au SW en attente, rechargement au controllerchange, une seule fois', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    const worker = f.installUpdate();
    await until(() => c.getState().available);
    await c.applyUpdate();
    await c.applyUpdate();
    expect(skipWaitings(worker)).toEqual([SKIP_WAITING]);
    expect(f.controllerMessages).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
    f.fireControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
    f.fireControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('controllerchange sans applyUpdate (clients.claim de la première installation) → pas de rechargement', async () => {
    const f = createFakeSwContainer({ controller: false });
    start(f);
    await settled();
    f.setController(true);
    f.fireControllerChange();
    await settled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("séance en cours (meta.activeSessionId) → applyUpdate n'envoie rien", async () => {
    await setMeta(db, 'activeSessionId', 's1');
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    const worker = f.installUpdate();
    await until(() => c.getState().available);
    await c.applyUpdate();
    expect(skipWaitings(worker)).toEqual([]);
    f.fireControllerChange();
    expect(reload).not.toHaveBeenCalled();
  });

  it('sans SW en attente → rien, sans erreur', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await settled();
    await c.applyUpdate();
    f.fireControllerChange();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('registerServiceWorker : 426 (R-PWA-5, R-VER-2)', () => {
  it('connexion protocol_unsupported → forced et nouvelle recherche, une fois par passage', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await until(() => f.registration.updateCalls === 1);
    expect(c.getState().forced).toBe(false);
    sync.set({ connection: 'protocol_unsupported' });
    expect(c.getState()).toEqual({ available: false, forced: true });
    await until(() => f.registration.updateCalls === 2);
    sync.set({ pending: 3 });
    await settled();
    expect(f.registration.updateCalls).toBe(2);
    expect(c.getState().forced).toBe(true);
  });

  it('426 puis nouvelle version trouvée → available et forced', async () => {
    const f = createFakeSwContainer({ controller: true });
    const c = start(f);
    await settled();
    sync.set({ connection: 'protocol_unsupported' });
    f.installUpdate();
    await until(() => c.getState().available);
    expect(c.getState()).toEqual({ available: true, forced: true });
  });

  it('sans service worker → contrôleur inerte { available: false, forced: false }', async () => {
    expect('serviceWorker' in navigator).toBe(false);
    const c = registerServiceWorker({ db, sync, doc: page.doc, reload });
    expect(c.getState()).toEqual({ available: false, forced: false });
    await c.checkForUpdate();
    await c.applyUpdate();
    c.markForced();
    sync.set({ connection: 'protocol_unsupported' });
    expect(c.getState()).toEqual({ available: false, forced: false });
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('raiseLocalDbMarker (ADR 0001 décision 5)', () => {
  const readMarker = async (caches: CacheStorage) =>
    (await caches.match(LOCAL_DB_MARKER_KEY, { cacheName: LOCAL_DB_MARKER_CACHE }))?.text();

  it('marqueur absent → LOCAL_DB_VERSION', async () => {
    const caches = createFakeCacheStorage();
    await raiseLocalDbMarker(caches);
    expect(await readMarker(caches)).toBe(String(LOCAL_DB_VERSION));
  });

  it.each([
    ['inférieur', String(LOCAL_DB_VERSION - 1), String(LOCAL_DB_VERSION)],
    ['illisible', 'abc', String(LOCAL_DB_VERSION)],
    ['égal', String(LOCAL_DB_VERSION), String(LOCAL_DB_VERSION)],
    ['supérieur (jamais abaissé)', String(LOCAL_DB_VERSION + 4), String(LOCAL_DB_VERSION + 4)],
  ])('marqueur %s → %s devient %s', async (_, before, after) => {
    const caches = createFakeCacheStorage();
    await (await caches.open(LOCAL_DB_MARKER_CACHE)).put(LOCAL_DB_MARKER_KEY, new Response(before));
    await raiseLocalDbMarker(caches);
    expect(await readMarker(caches)).toBe(after);
  });
});

describe('bootServiceWorker', () => {
  const status = { illustrationFiles: async () => [...FILES] };

  function boot(f: FakeSwContainer, probe: HealthResponse | null, caches = createFakeCacheStorage()) {
    return bootServiceWorker({
      db,
      status,
      sync,
      fetchHealth: async () => probe,
      container: f.container,
      killEnv: { serviceWorker: f.container, caches, reload },
    });
  }

  it('swKill vrai → interrupteur appliqué, aucun enregistrement, aucun contrôleur publié', async () => {
    const f = createFakeSwContainer({ controller: true });
    const registerSpy = vi.spyOn(f.container, 'register');
    const caches = createFakeCacheStorage();
    await caches.open('shell-aaaaaaaaaaaa');
    await boot(f, health(true), caches);
    expect(registerSpy).not.toHaveBeenCalled();
    expect(swControllerStore.get()).toBeNull();
    expect(f.unregisterCalls).toBe(1);
    expect(await caches.keys()).toEqual([LOCAL_DB_MARKER_CACHE]);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(f.controllerMessages).toEqual([]);
  });

  it.each([
    ['sonde sans réponse (null)', null],
    ['swKill faux', health(false)],
  ])('%s → enregistrement et contrôleur publié', async (_, probe) => {
    const f = createFakeSwContainer({ controller: true });
    const registerSpy = vi.spyOn(f.container, 'register');
    await boot(f, probe);
    expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
    expect(swControllerStore.get()).not.toBeNull();
    expect(f.unregisterCalls).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('sonde en échec (rejet) → enregistrement quand même', async () => {
    const f = createFakeSwContainer({ controller: true });
    await bootServiceWorker({
      db,
      status,
      sync,
      fetchHealth: () => Promise.reject(new TypeError('Failed to fetch')),
      container: f.container,
      killEnv: { serviceWorker: f.container, caches: createFakeCacheStorage(), reload },
    });
    expect(swControllerStore.get()).not.toBeNull();
  });

  it('R-SYN-32 : SYNC_ILLUSTRATIONS au contrôleur au démarrage, puis à chaque controllerchange', async () => {
    const f = createFakeSwContainer({ controller: true });
    await boot(f, health(false));
    expect(f.controllerMessages).toEqual([SYNC_ILLUSTRATIONS]);
    f.fireControllerChange();
    await until(() => f.controllerMessages.length === 2);
    f.fireControllerChange();
    await until(() => f.controllerMessages.length === 3);
    expect(f.controllerMessages).toEqual([SYNC_ILLUSTRATIONS, SYNC_ILLUSTRATIONS, SYNC_ILLUSTRATIONS]);
    expect(reload).not.toHaveBeenCalled();
  });

  it("sans contrôleur → rien ; envoyé dès qu'un contrôleur apparaît (première installation)", async () => {
    const f = createFakeSwContainer({ controller: false });
    await boot(f, health(false));
    await turns();
    expect(f.controllerMessages).toEqual([]);
    f.setController(true);
    f.fireControllerChange();
    await until(() => f.controllerMessages.length === 1);
    expect(f.controllerMessages).toEqual([SYNC_ILLUSTRATIONS]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('marqueur de base locale posé une fois Dexie ouverte', async () => {
    const f = createFakeSwContainer({ controller: true });
    const caches = createFakeCacheStorage();
    await boot(f, health(false), caches);
    expect(db.isOpen()).toBe(true);
    const marker = await caches.match(LOCAL_DB_MARKER_KEY, { cacheName: LOCAL_DB_MARKER_CACHE });
    expect(await marker?.text()).toBe(String(LOCAL_DB_VERSION));
  });

  it("écriture du marqueur refusée (stockage plein) → le démarrage continue", async () => {
    const f = createFakeSwContainer({ controller: true });
    const caches = createFakeCacheStorage({ failPut: () => quotaExceeded() });
    await boot(f, health(false), caches);
    expect(swControllerStore.get()).not.toBeNull();
    expect(f.controllerMessages).toEqual([SYNC_ILLUSTRATIONS]);
  });
});
