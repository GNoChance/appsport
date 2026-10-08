import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AppDb, LOCAL_DB_NAME } from '../../src/local-db/db';
import { getMeta, setMeta } from '../../src/local-db/meta';
import {
  ILLUSTRATIONS_CACHE,
  LOCAL_DB_MARKER_CACHE,
  LOCAL_DB_MARKER_KEY,
  type PrecacheManifest,
} from '../../src/sw/precache-manifest';
import {
  createSwHandlers,
  installServiceWorker,
  REFERENCED_ILLUSTRATIONS_KEY,
  type SwEvent,
  type SwFetchEvent,
  type SwGlobalLike,
  type SwHandlers,
  type SwMessageEvent,
  type SwRequest,
} from '../../src/sw/sw';
import {
  createFakeCacheStorage,
  createFakeSwScope,
  deferred,
  type FakeSwScope,
  quotaExceeded,
  staticNetwork,
} from '../support/fake-sw-scope';
import { createTestLocalDb } from '../support/local-db';

const ORIGIN = 'https://appsport.test';
const A: PrecacheManifest = {
  buildHash: 'aaaaaaaaaaaa',
  files: ['/assets/app-1.js', '/index.html'],
  localDbVersion: 1,
};
const B: PrecacheManifest = {
  buildHash: 'bbbbbbbbbbbb',
  files: ['/assets/app-2.js', '/index.html'],
  localDbVersion: 1,
};
const A_FILES = { '/index.html': 'A-index', '/assets/app-1.js': 'A-app' };
const B_FILES = { '/index.html': 'B-index', '/assets/app-2.js': 'B-app' };
const SHELL_A = 'shell-aaaaaaaaaaaa';

const ILL = (file: string) => `/illustrations/${file}`;
const IA = 'a.11111111.svg';
const IB = 'b.22222222.svg';
const IC = 'c.33333333.svg';
const ILLUSTRATIONS_NET = staticNetwork({
  [ILL(IA)]: '<svg>a</svg>',
  [ILL(IB)]: '<svg>b</svg>',
  [ILL(IC)]: '<svg>c</svg>',
});

const nav = (path: string, origin = ORIGIN): SwRequest => ({
  url: origin + path,
  method: 'GET',
  mode: 'navigate',
});
const get = (path: string, origin = ORIGIN): SwRequest => ({
  url: origin + path,
  method: 'GET',
  mode: 'no-cors',
});
const offline = (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'));
const health =
  (body: unknown, status = 200) =>
  (url: string): Promise<Response> =>
    url === `${ORIGIN}/api/health` ? Promise.resolve(Response.json(body, { status })) : offline();

/** Laisse filer les tâches en cours (réseau factice, Cache Storage, files de promesses). */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

async function bodyOf(response: Promise<Response> | null): Promise<string> {
  if (response === null) throw new Error('requête non interceptée');
  return (await response).text();
}

const cacheNames = async (s: FakeSwScope) => (await s.caches.keys()).sort();
const cachedText = async (s: FakeSwScope, cacheName: string, path: string) =>
  (await s.caches.match(path, { cacheName }))?.text();

async function illustrationPaths(s: FakeSwScope): Promise<string[]> {
  const cache = await s.caches.open(ILLUSTRATIONS_CACHE);
  return (await cache.keys())
    .map((r) => new URL(r.url).pathname)
    .filter((p) => p.startsWith('/illustrations/'))
    .sort();
}

/** A installé puis activé ; journal réseau vidé. */
async function activeA(o: Parameters<typeof createFakeSwScope>[0] = {}) {
  const s = createFakeSwScope(o);
  s.setNetwork(staticNetwork(A_FILES));
  const h = createSwHandlers(s, A);
  await h.install();
  await h.activate();
  s.fetchLog.length = 0;
  s.events.length = 0;
  return { s, h };
}

/** `GET_STATUS` par un vrai MessageChannel, comme `getSwStatus` côté page. */
async function getStatus(h: SwHandlers): Promise<unknown> {
  const channel = new MessageChannel();
  const reply = new Promise<unknown>((resolve) => {
    channel.port1.onmessage = (e: MessageEvent) => resolve(e.data);
  });
  try {
    await h.handleMessage({ type: 'GET_STATUS' }, channel.port2);
    return await reply;
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
}

let db: AppDb | null = null;

/** Base locale réelle 'appsport' (fake-indexeddb) : le SW ne doit jamais y toucher. */
async function seedLocalDb(): Promise<AppDb> {
  db = createTestLocalDb(LOCAL_DB_NAME);
  await setMeta(db, 'userId', 'u1');
  return db;
}

afterEach(async () => {
  await db?.delete();
  db = null;
});

describe('install', () => {
  it('précache la coquille dans shell-<buildHash> (cache: reload), sans skipWaiting (mode prompt)', async () => {
    const s = createFakeSwScope();
    const inits: (RequestInit | undefined)[] = [];
    s.setNetwork((url, init) => {
      inits.push(init);
      return staticNetwork(A_FILES)(url);
    });
    await createSwHandlers(s, A).install();
    expect(await cachedText(s, SHELL_A, '/index.html')).toBe('A-index');
    expect(await cachedText(s, SHELL_A, '/assets/app-1.js')).toBe('A-app');
    expect(s.fetchLog.sort()).toEqual([`${ORIGIN}/assets/app-1.js`, `${ORIGIN}/index.html`]);
    expect(inits.map((i) => i?.cache)).toEqual(['reload', 'reload']);
    expect(s.skipWaitingCalls).toBe(0);
  });

  it('un fichier en 404 : install rejette et ne laisse pas de coquille partielle', async () => {
    const s = createFakeSwScope();
    s.setNetwork(staticNetwork({ '/index.html': 'A-index' }));
    await expect(createSwHandlers(s, A).install()).rejects.toThrow(/\/assets\/app-1\.js/);
    expect(await s.caches.has(SHELL_A)).toBe(false);
    expect(s.skipWaitingCalls).toBe(0);
  });
});

describe('activate', () => {
  it('purge les anciens shell-*, ouvre illustrations-v1, clients.claim ; base appsport intacte (R-PWA-4)', async () => {
    const local = await seedLocalDb();
    const s = createFakeSwScope();
    s.setNetwork(staticNetwork(A_FILES));
    await (await s.caches.open('shell-old000000000')).put('/index.html', new Response('vieux'));
    const h = createSwHandlers(s, A);
    await h.install();
    await h.activate();
    expect(await cacheNames(s)).toEqual([LOCAL_DB_MARKER_CACHE, ILLUSTRATIONS_CACHE, SHELL_A]);
    expect(s.claimCalls).toBe(1);
    expect(s.skipWaitingCalls).toBe(0);
    expect(await getMeta(local, 'userId')).toBe('u1');
  });
});

describe('marqueur de version de la base locale (ADR 0001 décision 5, R-PWA-9)', () => {
  const putMarker = async (s: FakeSwScope, value: string) =>
    (await s.caches.open(LOCAL_DB_MARKER_CACHE)).put(LOCAL_DB_MARKER_KEY, new Response(value));
  const marker = (s: FakeSwScope) => cachedText(s, LOCAL_DB_MARKER_CACHE, LOCAL_DB_MARKER_KEY);

  it('marqueur supérieur à localDbVersion : install rejette avant tout téléchargement', async () => {
    const s = createFakeSwScope();
    s.setNetwork(staticNetwork(A_FILES));
    await putMarker(s, '2');
    await expect(createSwHandlers(s, A).install()).rejects.toThrow(/localDbVersion/);
    expect(s.fetchLog).toEqual([]);
    expect(await s.caches.has(SHELL_A)).toBe(false);
  });

  it('marqueur égal : install acceptée', async () => {
    const s = createFakeSwScope();
    s.setNetwork(staticNetwork(A_FILES));
    await putMarker(s, '1');
    await createSwHandlers(s, A).install();
    expect(await cachedText(s, SHELL_A, '/index.html')).toBe('A-index');
  });

  it('activate écrit sa version, sans jamais abaisser le marqueur', async () => {
    const s = createFakeSwScope();
    s.setNetwork(staticNetwork(A_FILES));
    const h1 = createSwHandlers(s, A);
    await h1.install();
    await h1.activate();
    expect(await marker(s)).toBe('1');
    s.setNetwork(staticNetwork(B_FILES));
    const h3 = createSwHandlers(s, { ...B, localDbVersion: 3 });
    await h3.install();
    await h3.activate();
    expect(await marker(s)).toBe('3');
    await putMarker(s, '5'); // écrit par la page d'un build plus récent
    await h3.activate();
    expect(await marker(s)).toBe('5');
  });
});

describe('handleFetch', () => {
  it('navigation : index.html de shell-<buildHash> sans réseau ; index.html absent du cache → réseau', async () => {
    const { s, h } = await activeA();
    s.setNetwork(offline);
    expect(await bodyOf(h.handleFetch(nav('/profile')))).toBe('A-index');
    expect(s.fetchLog).toEqual([]);
    await (await s.caches.open(SHELL_A)).delete('/index.html');
    s.setNetwork(async () => new Response('net-index'));
    expect(await bodyOf(h.handleFetch(nav('/profile')))).toBe('net-index');
    expect(s.fetchLog).toEqual([`${ORIGIN}/profile`]);
  });

  it('Review Focus 5 : A actif sert sa coquille pendant que B attend, réseau servant B puis coupé', async () => {
    const caches = createFakeCacheStorage();
    const sA = createFakeSwScope({ caches });
    sA.setNetwork(staticNetwork(A_FILES));
    const hA = createSwHandlers(sA, A);
    await hA.install();
    await hA.activate();
    const sB = createFakeSwScope({ caches });
    sB.setNetwork(staticNetwork(B_FILES));
    await createSwHandlers(sB, B).install(); // B en attente : pas d'activate
    for (const network of [staticNetwork(B_FILES), offline]) {
      sA.setNetwork(network);
      sA.fetchLog.length = 0;
      expect(await bodyOf(hA.handleFetch(nav('/')))).toBe('A-index');
      expect(await bodyOf(hA.handleFetch(get('/assets/app-1.js')))).toBe('A-app');
      expect(sA.fetchLog).toEqual([]);
    }
    expect((await caches.keys()).sort()).toEqual([
      LOCAL_DB_MARKER_CACHE,
      ILLUSTRATIONS_CACHE,
      SHELL_A,
      'shell-bbbbbbbbbbbb',
    ]);
    expect(sA.skipWaitingCalls + sB.skipWaitingCalls).toBe(0);
  });

  it('fichier du manifeste : servi du cache sans réseau ; absent du cache → réseau', async () => {
    const { s, h } = await activeA();
    s.setNetwork(offline);
    expect(await bodyOf(h.handleFetch(get('/assets/app-1.js')))).toBe('A-app');
    expect(s.fetchLog).toEqual([]);
    await (await s.caches.open(SHELL_A)).delete('/assets/app-1.js');
    s.setNetwork(staticNetwork({ '/assets/app-1.js': 'net-app' }));
    expect(await bodyOf(h.handleFetch(get('/assets/app-1.js')))).toBe('net-app');
  });

  it.each<[string, SwRequest]>([
    ['GET /api/me', get('/api/me')],
    ['GET /api/sync/pull', get('/api/sync/pull?since=0')],
    ['navigation /api/me/export (R-EXP-1)', nav('/api/me/export')],
    ['navigation /api', nav('/api')],
    ["POST d'un fichier de la coquille", { ...get('/assets/app-1.js'), method: 'POST' }],
    ['navigation vers une autre origine', nav('/index.html', 'https://autre.test')],
    ['fichier inconnu', get('/inconnu.txt')],
    ['le SW lui-même', get('/sw.js')],
  ])('non intercepté (null, pas de respondWith) : %s', async (_, request) => {
    const { s, h } = await activeA();
    expect(h.handleFetch(request)).toBeNull();
    expect(s.fetchLog).toEqual([]);
  });

  it("illustration : cache d'abord ; mise en cache seulement si 200", async () => {
    const { s, h } = await activeA();
    s.setNetwork((url) =>
      url.endsWith(IC) ? Promise.resolve(new Response('panne', { status: 500 })) : ILLUSTRATIONS_NET(url),
    );
    expect(await bodyOf(h.handleFetch(get(ILL(IA))))).toBe('<svg>a</svg>');
    expect(await bodyOf(h.handleFetch(get(ILL(IA))))).toBe('<svg>a</svg>');
    expect(s.fetchLog).toEqual([ORIGIN + ILL(IA)]);
    for (const file of [IC, 'z.99999999.svg']) {
      expect((await h.handleFetch(get(ILL(file))))?.status).toBe(file === IC ? 500 : 404);
      expect(await s.caches.match(ILL(file), { cacheName: ILLUSTRATIONS_CACHE })).toBeUndefined();
    }
    expect(await illustrationPaths(s)).toEqual([ILL(IA)]);
  });
});

describe('handleMessage', () => {
  it('SKIP_WAITING → skipWaiting une fois', async () => {
    const { s, h } = await activeA();
    await h.handleMessage({ type: 'SKIP_WAITING' }, null);
    expect(s.skipWaitingCalls).toBe(1);
  });

  it('GET_STATUS : SwStatus par le MessageChannel ; fichier du manifeste retiré → shellCached false', async () => {
    const { s, h } = await activeA();
    // Aucune liste reçue : illustrationsReferenced null, inconnu et non vide (R-SYN-33 condition 3).
    expect(await getStatus(h)).toEqual({
      type: 'STATUS',
      buildHash: 'aaaaaaaaaaaa',
      shellCached: true,
      illustrationsMissing: 0,
      illustrationsReferenced: null,
      localDbVersion: 1,
    });
    await (await s.caches.open(SHELL_A)).delete('/assets/app-1.js');
    expect(await getStatus(h)).toMatchObject({ shellCached: false });
  });

  it('SYNC_ILLUSTRATIONS : télécharge les manquantes, supprime celles qui ne sont plus référencées', async () => {
    const { s, h } = await activeA();
    s.setNetwork(ILLUSTRATIONS_NET);
    await (await s.caches.open(ILLUSTRATIONS_CACHE)).put(ILL(IC), new Response('<svg>c</svg>'));
    await h.handleMessage({ type: 'SYNC_ILLUSTRATIONS', files: [IA, IB] }, null);
    expect(await illustrationPaths(s)).toEqual([ILL(IA), ILL(IB)]);
    expect(await cachedText(s, ILLUSTRATIONS_CACHE, ILL(IB))).toBe('<svg>b</svg>');
    expect((await h.status()).illustrationsMissing).toBe(0);
  });

  it('illustration en 500 : manquante, retentée en tâche de fond au GET_STATUS suivant', async () => {
    const { s, h } = await activeA();
    let bFails = true;
    s.setNetwork((url) =>
      bFails && url.endsWith(IB)
        ? Promise.resolve(new Response('panne', { status: 500 }))
        : ILLUSTRATIONS_NET(url),
    );
    await h.handleMessage({ type: 'SYNC_ILLUSTRATIONS', files: [IA, IB] }, null);
    expect(await illustrationPaths(s)).toEqual([ILL(IA)]);
    expect((await h.status()).illustrationsMissing).toBe(1);
    bFails = false;
    // La réponse part avant la reprise ; la reprise est terminée quand handleMessage se résout.
    expect(await getStatus(h)).toMatchObject({ illustrationsMissing: 1 });
    expect(await getStatus(h)).toMatchObject({ illustrationsMissing: 0 });
    expect(s.fetchLog.filter((u) => u.endsWith(IB))).toHaveLength(2);
    expect(await illustrationPaths(s)).toEqual([ILL(IA), ILL(IB)]);
  });

  it('liste référencée relue après redémarrage du SW, jamais supprimée (même par SYNC_ILLUSTRATIONS [])', async () => {
    const { s, h } = await activeA();
    s.setNetwork(ILLUSTRATIONS_NET);
    await h.handleMessage({ type: 'SYNC_ILLUSTRATIONS', files: [IA, IB] }, null);
    const cache = await s.caches.open(ILLUSTRATIONS_CACHE);
    await cache.delete(ILL(IA));
    const restarted = createSwHandlers(s, A); // rien en mémoire : la liste vient du cache
    expect((await restarted.status()).illustrationsMissing).toBe(1);
    await getStatus(restarted); // reprise en tâche de fond
    expect(await illustrationPaths(s)).toEqual([ILL(IA), ILL(IB)]);
    await restarted.handleMessage({ type: 'SYNC_ILLUSTRATIONS', files: [] }, null);
    expect(await illustrationPaths(s)).toEqual([]);
    expect(await (await cache.match(REFERENCED_ILLUSTRATIONS_KEY))?.json()).toEqual([]);
    // Liste vide connue : 0 référencée, à distinguer de « aucune liste » (null).
    expect(await restarted.status()).toMatchObject({ illustrationsMissing: 0, illustrationsReferenced: 0 });
    expect(await createSwHandlers(s, A).status()).toMatchObject({ illustrationsReferenced: 0 });
  });

  it('syncIllustrations sérialisé, 4 téléchargements en parallèle au plus', async () => {
    const { s, h } = await activeA();
    let active = 0;
    let peak = 0;
    s.setNetwork(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active--;
      return new Response('<svg/>');
    });
    const files = Array.from({ length: 10 }, (_, i) => `f${i}.0000000${i}.svg`);
    const first = h.syncIllustrations(files);
    const second = h.syncIllustrations(['z.99999999.svg']);
    await Promise.all([first, second]);
    expect(peak).toBe(4);
    // Lancée pendant la première, la seconde passe après elle : seule z reste, téléchargée en dernier.
    expect(await illustrationPaths(s)).toEqual([ILL('z.99999999.svg')]);
    expect(s.fetchLog.at(-1)).toBe(ORIGIN + ILL('z.99999999.svg'));
  });

  it('noms de fichier invalides ignorés : rien hors de /illustrations/', async () => {
    const { s, h } = await activeA();
    s.setNetwork(ILLUSTRATIONS_NET);
    await h.syncIllustrations(['../api/me', 'x/../../api/me', '', '.', IA]);
    expect(s.fetchLog).toEqual([ORIGIN + ILL(IA)]);
    expect(await h.status()).toMatchObject({ illustrationsMissing: 0, illustrationsReferenced: 1 });
  });
});

describe('liste des illustrations comptée par le statut (R-SYN-32, R-SYN-33 condition 3)', () => {
  it('SYNC_ILLUSTRATIONS puis GET_STATUS sans attendre la synchro : compté sur la nouvelle liste', async () => {
    const { s, h } = await activeA();
    const network = deferred();
    s.setNetwork(async (url) => {
      await network.promise;
      return ILLUSTRATIONS_NET(url);
    });
    const running = h.syncIllustrations([IC]);
    const queued = h.handleMessage({ type: 'SYNC_ILLUSTRATIONS', files: [IA, IB, IA] }, null);
    // c en cours de téléchargement, [a, b] en file : le statut compte déjà sur [a, b], dédoublonnée.
    expect(await getStatus(h)).toMatchObject({ illustrationsMissing: 2, illustrationsReferenced: 2 });
    network.release();
    await Promise.all([running, queued]);
    expect(await h.status()).toMatchObject({ illustrationsMissing: 0, illustrationsReferenced: 2 });
    expect(await illustrationPaths(s)).toEqual([ILL(IA), ILL(IB)]);
  });

  it('liste non enregistrée, stockage plein : périmées supprimées, statut sur la nouvelle liste, même après redémarrage', async () => {
    let full = false;
    const caches = createFakeCacheStorage({
      failPut: (name) => (full && name === ILLUSTRATIONS_CACHE ? quotaExceeded() : undefined),
    });
    const { s, h } = await activeA({ caches });
    s.setNetwork(ILLUSTRATIONS_NET);
    await h.syncIllustrations([IC]); // ancien catalogue, entièrement en cache
    full = true;
    await expect(h.syncIllustrations([IA, IB])).resolves.toBeUndefined();
    // c supprimée avant l'écriture de la liste : la place libérée ne dépend pas de cette écriture.
    expect(await illustrationPaths(s)).toEqual([]);
    expect(await h.status()).toMatchObject({ illustrationsMissing: 2, illustrationsReferenced: 2 });
    // Redémarrage : seule l'ancienne liste est enregistrée, mais c n'est plus là : rien ne passe pour prêt.
    expect(await createSwHandlers(s, A).status()).toMatchObject({ illustrationsMissing: 1 });
  });

  it('écriture de la liste en échec seule : illustrations téléchargées, statut sur la liste reçue', async () => {
    const caches = createFakeCacheStorage({
      failPut: (_, url) => (url === ORIGIN + REFERENCED_ILLUSTRATIONS_KEY ? quotaExceeded() : undefined),
    });
    const { s, h } = await activeA({ caches });
    s.setNetwork(ILLUSTRATIONS_NET);
    await expect(h.syncIllustrations([IA, IB])).resolves.toBeUndefined();
    expect(await illustrationPaths(s)).toEqual([ILL(IA), ILL(IB)]);
    expect(await h.status()).toMatchObject({ illustrationsMissing: 0, illustrationsReferenced: 2 });
  });

  it('illustration refusée par le stockage plein : ignorée, toujours manquante', async () => {
    const caches = createFakeCacheStorage({
      failPut: (_, url) => (url === ORIGIN + ILL(IB) ? quotaExceeded() : undefined),
    });
    const { s, h } = await activeA({ caches });
    s.setNetwork(ILLUSTRATIONS_NET);
    await expect(h.syncIllustrations([IA, IB])).resolves.toBeUndefined();
    expect(await illustrationPaths(s)).toEqual([ILL(IA)]);
    expect(await h.status()).toMatchObject({ illustrationsMissing: 1, illustrationsReferenced: 2 });
  });

  it('téléchargement rejeté (réseau) : ignoré, la synchro se résout, une manquante', async () => {
    const { s, h } = await activeA();
    s.setNetwork((url) => (url.endsWith(IB) ? offline() : ILLUSTRATIONS_NET(url)));
    await expect(h.syncIllustrations([IA, IB])).resolves.toBeUndefined();
    expect(await illustrationPaths(s)).toEqual([ILL(IA)]);
    expect(await h.status()).toMatchObject({ illustrationsMissing: 1 });
  });

  it('téléchargement rejeté pendant que les autres continuent : la synchro suivante attend leur fin', async () => {
    const { s, h } = await activeA();
    const slowA = deferred();
    s.setNetwork(async (url) => {
      if (url.endsWith(IB)) throw new TypeError('Failed to fetch');
      if (url.endsWith(IA)) await slowA.promise;
      return ILLUSTRATIONS_NET(url);
    });
    const first = h.syncIllustrations([IA, IB]);
    const second = h.syncIllustrations([IA, IC]);
    await flush();
    expect(s.fetchLog.filter((u) => u.endsWith(IC))).toEqual([]);
    slowA.release();
    await expect(first).resolves.toBeUndefined();
    await second;
    expect(s.fetchLog.filter((u) => u.endsWith(IC))).toHaveLength(1);
    expect(await illustrationPaths(s)).toEqual([ILL(IA), ILL(IC)]);
  });

  it("illustration servie du réseau malgré un stockage plein : rien en cache, l'image s'affiche", async () => {
    const caches = createFakeCacheStorage({
      failPut: (name) => (name === ILLUSTRATIONS_CACHE ? quotaExceeded() : undefined),
    });
    const { s, h } = await activeA({ caches });
    s.setNetwork(ILLUSTRATIONS_NET);
    expect(await bodyOf(h.handleFetch(get(ILL(IA))))).toBe('<svg>a</svg>');
    expect(await illustrationPaths(s)).toEqual([]);
  });
});

describe('checkKillSwitch (R-PWA-6, étapes 1 à 3 côté SW)', () => {
  it('swKill vrai : désenregistre, vide shell-* et illustrations-*, recharge chaque fenêtre ; IndexedDB intact', async () => {
    const local = await seedLocalDb();
    const { s, h } = await activeA({ clientUrls: [`${ORIGIN}/profile`] });
    await (await s.caches.open('autre')).put('/x', new Response('x'));
    await (await s.caches.open(ILLUSTRATIONS_CACHE)).put(ILL(IA), new Response('a'));
    const inits: (RequestInit | undefined)[] = [];
    s.setNetwork((url, init) => {
      inits.push(init);
      return health({ status: 'ok', swKill: true })(url);
    });
    expect(await h.checkKillSwitch()).toBe(true);
    expect(s.unregistered).toBe(true);
    // Le marqueur de base locale reste, comme la base qu'il décrit (ADR 0001 décision 5).
    expect(await cacheNames(s)).toEqual([LOCAL_DB_MARKER_CACHE, 'autre']);
    expect(s.navigations).toEqual([`${ORIGIN}/profile`]);
    expect(s.fetchLog).toEqual([`${ORIGIN}/api/health`]);
    expect(inits[0]?.cache).toBe('no-store');
    expect(inits[0]?.signal).toBeDefined();
    expect(await getMeta(local, 'userId')).toBe('u1');
  });

  it('503 avec swKill vrai : le JSON compte quel que soit le statut', async () => {
    const { s, h } = await activeA();
    s.setNetwork(health({ swKill: true }, 503));
    expect(await h.checkKillSwitch()).toBe(true);
    expect(s.unregistered).toBe(true);
  });

  it.each<[string, (url: string) => Promise<Response>]>([
    ['swKill faux', health({ status: 'ok', swKill: false })],
    ['503 avec swKill faux', health({ status: 'degraded', swKill: false }, 503)],
    ['réseau en échec', offline],
    ['corps illisible', async () => new Response('<html>')],
    ['swKill "true" en chaîne', health({ swKill: 'true' })],
  ])('%s → false, rien ne change', async (_, network) => {
    const { s, h } = await activeA({ clientUrls: [`${ORIGIN}/profile`] });
    const before = await cacheNames(s);
    s.setNetwork(network);
    expect(await h.checkKillSwitch()).toBe(false);
    expect(s.unregistered).toBe(false);
    expect(await cacheNames(s)).toEqual(before);
    expect(s.navigations).toEqual([]);
  });

  it('/api/health sans réponse : false au bout de 4 s, requête annulée, rien ne change', async () => {
    const { s, h } = await activeA({ clientUrls: [`${ORIGIN}/profile`] });
    const before = await cacheNames(s);
    const inits: (RequestInit | undefined)[] = [];
    s.setNetwork((_, init) => {
      inits.push(init);
      return new Promise<Response>(() => {}); // ni réponse ni rejet, même annulée
    });
    vi.useFakeTimers();
    try {
      let verdict: boolean | null = null;
      void h.checkKillSwitch().then((v) => {
        verdict = v;
      });
      await vi.advanceTimersByTimeAsync(3999);
      expect(verdict).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(verdict).toBe(false);
      expect(inits[0]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    expect(s.unregistered).toBe(false);
    expect(await cacheNames(s)).toEqual(before);
    expect(s.navigations).toEqual([]);
  });
});

interface Fired {
  waits: Promise<unknown>[];
  responses: Promise<Response>[];
}

/** Global de service worker factice branché sur un FakeSwScope ; `fire` rejoue un événement. */
function fakeGlobal(s: FakeSwScope) {
  const listeners = new Map<string, (e: never) => void>();
  const g: SwGlobalLike = {
    caches: s.caches,
    fetch: (input, init) => s.fetch(input, init),
    skipWaiting: () => s.skipWaiting(),
    clients: { claim: () => s.claimClients(), matchAll: () => s.windowClients() },
    registration: { unregister: () => s.unregister() },
    location: { origin: s.origin },
    addEventListener(type: string, fn: (e: never) => void) {
      listeners.set(type, fn);
    },
  };
  const fire = <E extends SwEvent>(type: string, extra: Omit<E, keyof SwEvent | 'respondWith'>): Fired => {
    const fired: Fired = { waits: [], responses: [] };
    const listener = listeners.get(type) as ((e: E) => void) | undefined;
    listener?.({
      ...extra,
      waitUntil: (p: Promise<unknown>) => fired.waits.push(p),
      respondWith: (r: Promise<Response>) => fired.responses.push(r),
    } as unknown as E);
    return fired;
  };
  return {
    g,
    install: () => fire<SwEvent>('install', {}),
    activate: () => fire<SwEvent>('activate', {}),
    fetch: (request: SwRequest) => fire<SwFetchEvent>('fetch', { request }),
    message: (data: unknown, ports: readonly MessagePort[] = []) =>
      fire<SwMessageEvent>('message', { data, ports }),
  };
}

describe('installServiceWorker', () => {
  it('install puis activate : chacun prolongé par waitUntil', async () => {
    const s = createFakeSwScope();
    s.setNetwork(staticNetwork(A_FILES));
    const sw = fakeGlobal(s);
    installServiceWorker(sw.g, A);
    const install = sw.install();
    expect(install.waits).toHaveLength(1);
    await install.waits[0];
    expect(await cachedText(s, SHELL_A, '/index.html')).toBe('A-index');
    const activate = sw.activate();
    expect(activate.waits).toHaveLength(1);
    await activate.waits[0];
    expect(s.claimCalls).toBe(1);
    expect(s.skipWaitingCalls).toBe(0);
  });

  it('navigation : respondWith une fois ; vérification de /api/health non bloquante, par waitUntil', async () => {
    const { s } = await activeA();
    const sw = fakeGlobal(s);
    installServiceWorker(sw.g, A);
    s.setNetwork((url) => (url === `${ORIGIN}/api/health` ? new Promise<Response>(() => {}) : offline()));
    const fired = sw.fetch(nav('/profile'));
    expect(fired.responses).toHaveLength(1);
    expect(await bodyOf(fired.responses[0] ?? null)).toBe('A-index');
    expect(fired.waits).toHaveLength(1);
    expect(s.fetchLog).toEqual([`${ORIGIN}/api/health`]);
  });

  it('navigation avec swKill vrai : interrupteur appliqué dans le waitUntil', async () => {
    const { s } = await activeA({ clientUrls: [`${ORIGIN}/`] });
    const sw = fakeGlobal(s);
    installServiceWorker(sw.g, A);
    s.setNetwork(health({ swKill: true }));
    const fired = sw.fetch(nav('/'));
    expect(await bodyOf(fired.responses[0] ?? null)).toBe('A-index');
    await Promise.all(fired.waits);
    expect(s.unregistered).toBe(true);
    expect(s.navigations).toEqual([`${ORIGIN}/`]);
  });

  it('requête non interceptée : ni respondWith ni waitUntil ; sous-ressource : respondWith sans vérification', async () => {
    const { s } = await activeA();
    const sw = fakeGlobal(s);
    installServiceWorker(sw.g, A);
    for (const request of [get('/api/me'), nav('/api/me/export'), nav('/', 'https://autre.test')]) {
      expect(sw.fetch(request)).toEqual({ waits: [], responses: [] });
    }
    const asset = sw.fetch(get('/assets/app-1.js'));
    expect(asset.responses).toHaveLength(1);
    expect(asset.waits).toEqual([]);
    expect(await bodyOf(asset.responses[0] ?? null)).toBe('A-app');
    expect(s.fetchLog).toEqual([]);
  });

  it('message SKIP_WAITING → skipWaiting une fois ; GET_STATUS répond sur le port ; message inconnu ignoré', async () => {
    const { s } = await activeA();
    const sw = fakeGlobal(s);
    installServiceWorker(sw.g, A);
    const skip = sw.message({ type: 'SKIP_WAITING' });
    await Promise.all(skip.waits);
    expect(s.skipWaitingCalls).toBe(1);

    const channel = new MessageChannel();
    const reply = new Promise<unknown>((resolve) => {
      channel.port1.onmessage = (e: MessageEvent) => resolve(e.data);
    });
    const status = sw.message({ type: 'GET_STATUS' }, [channel.port2]);
    await Promise.all(status.waits);
    expect(await reply).toMatchObject({ type: 'STATUS', buildHash: 'aaaaaaaaaaaa', localDbVersion: 1 });
    channel.port1.close();
    channel.port2.close();

    for (const data of [
      null,
      'SKIP_WAITING',
      { type: 'AUTRE' },
      { type: 'SYNC_ILLUSTRATIONS', files: 'a' },
    ]) {
      expect(sw.message(data).waits).toEqual([]);
    }
    expect(s.skipWaitingCalls).toBe(1);
    expect(s.fetchLog).toEqual([]);
  });
});
