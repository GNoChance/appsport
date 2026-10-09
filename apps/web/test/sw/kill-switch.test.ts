import type { HealthResponse } from '@appsport/contracts';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { applyKillSwitchIfNeeded, probeHealth } from '../../src/sw/kill-switch';
import { LOCAL_DB_MARKER_CACHE, LOCAL_DB_MARKER_KEY } from '../../src/sw/precache-manifest';
import { createFakeApi } from '../support/fake-api';
import { createFakeSwContainer } from '../support/fake-sw-container';
import { createFakeCacheStorage } from '../support/fake-sw-scope';
import { createTestLocalDb } from '../support/local-db';
import { until } from '../support/wait';

const HEALTH: HealthResponse = {
  status: 'ok',
  version: 'test',
  db: 'ok',
  protocol: 1,
  minProtocol: 1,
  epoch: 'e1',
  swKill: false,
};
const KILL: HealthResponse = { ...HEALTH, swKill: true };

/** Marqueur de base locale, deux coquilles, deux générations d'illustrations et un cache inconnu. */
async function seededCaches(o: Parameters<typeof createFakeCacheStorage>[0] = {}): Promise<CacheStorage> {
  const caches = createFakeCacheStorage(o);
  await (await caches.open(LOCAL_DB_MARKER_CACHE)).put(LOCAL_DB_MARKER_KEY, new Response('1'));
  for (const name of [
    'shell-aaaaaaaaaaaa',
    'illustrations-v1',
    'shell-bbbbbbbbbbbb',
    'illustrations-v0',
    'autre',
  ]) {
    await caches.open(name);
  }
  return caches;
}

/** Trace console du rechargement (diagnostic sur téléphone, P8) : attendue, gardée hors de la sortie des tests. */
let info: MockInstance<typeof console.info>;

beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('applyKillSwitchIfNeeded (R-PWA-6)', () => {
  it('swKill faux → false, rien touché', async () => {
    const f = createFakeSwContainer();
    const caches = await seededCaches();
    const reload = vi.fn();
    expect(await applyKillSwitchIfNeeded(HEALTH, { serviceWorker: f.container, caches, reload })).toBe(false);
    expect(f.unregisterCalls).toBe(0);
    expect(await caches.keys()).toHaveLength(6);
    expect(reload).not.toHaveBeenCalled();
  });

  it('swKill vrai → désenregistré, shell-* et illustrations-* supprimés, marqueur et IndexedDB gardés, rechargé une fois', async () => {
    const db = createTestLocalDb();
    await setMeta(db, 'userId', 'u1');
    const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase');
    const f = createFakeSwContainer({ registrations: 1 });
    const caches = await seededCaches();
    const reload = vi.fn();
    expect(await applyKillSwitchIfNeeded(KILL, { serviceWorker: f.container, caches, reload })).toBe(true);
    expect(f.unregisterCalls).toBe(1);
    expect(await caches.keys()).toEqual([LOCAL_DB_MARKER_CACHE, 'autre']);
    expect(await caches.match(LOCAL_DB_MARKER_KEY, { cacheName: LOCAL_DB_MARKER_CACHE })).toBeDefined();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0] ?? 0);
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(await getMeta(db, 'userId')).toBe('u1');
  });

  it('swKill vrai sans rien à nettoyer (le SW a déjà fait le ménage) → false, pas de rechargement', async () => {
    const f = createFakeSwContainer({ registrations: 0 });
    const caches = createFakeCacheStorage();
    await caches.open(LOCAL_DB_MARKER_CACHE);
    await caches.open('autre');
    const reload = vi.fn();
    expect(await applyKillSwitchIfNeeded(KILL, { serviceWorker: f.container, caches, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('deuxième passage après le rechargement → plus rien à faire, pas de boucle', async () => {
    const f = createFakeSwContainer({ registrations: 2 });
    const caches = await seededCaches();
    const reload = vi.fn();
    const env = { serviceWorker: f.container, caches, reload };
    expect(await applyKillSwitchIfNeeded(KILL, env)).toBe(true);
    expect(f.unregisterCalls).toBe(2);
    expect(await applyKillSwitchIfNeeded(KILL, env)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('seulement des registrations à retirer → rechargé', async () => {
    const f = createFakeSwContainer({ registrations: 1 });
    const reload = vi.fn();
    const caches = createFakeCacheStorage();
    expect(await applyKillSwitchIfNeeded(KILL, { serviceWorker: f.container, caches, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("une suppression refusée n'empêche ni les autres ni le rechargement", async () => {
    const f = createFakeSwContainer({ registrations: 0 });
    const caches = await seededCaches({
      failDelete: (name) => (name === 'shell-aaaaaaaaaaaa' ? new Error('refus') : undefined),
    });
    const reload = vi.fn();
    expect(await applyKillSwitchIfNeeded(KILL, { serviceWorker: f.container, caches, reload })).toBe(true);
    expect(await caches.keys()).toEqual([LOCAL_DB_MARKER_CACHE, 'shell-aaaaaaaaaaaa', 'autre']);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('sans service worker ni Cache Storage (navigateur ancien) → false', async () => {
    const reload = vi.fn();
    expect('serviceWorker' in navigator).toBe(false);
    expect(await applyKillSwitchIfNeeded(KILL, { reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('probeHealth', () => {
  it('200 → réponse de /api/health', async () => {
    const api = createFakeApi().on('GET', '/api/health', { status: 200, body: HEALTH });
    expect(await probeHealth(api.transport)).toEqual(HEALTH);
    expect(api.calls[0]?.init.cache).toBe('no-store');
  });

  it('503 (base en panne) → corps lu quand même : swKill gardé', async () => {
    const degraded = { ...KILL, status: 'error', db: 'error', epoch: null };
    const api = createFakeApi().on('GET', '/api/health', { status: 503, body: degraded });
    expect(await probeHealth(api.transport)).toEqual(degraded);
  });

  it.each([
    ['réseau injoignable', (api: ReturnType<typeof createFakeApi>) => api.setOffline('reject')],
    [
      'corps hors contrat (proxy en 502)',
      (api: ReturnType<typeof createFakeApi>) =>
        api.on('GET', '/api/health', { status: 502, body: { oops: 1 } }),
    ],
  ])('%s → null', async (_, setup) => {
    const api = createFakeApi();
    setup(api);
    expect(await probeHealth(api.transport)).toBeNull();
  });

  it('pas de réponse en 4 s → null', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const api = createFakeApi();
    api.setOffline('hang');
    const probe = probeHealth(api.transport);
    await until(() => api.calls.length === 1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await probe).toBeNull();
  });
});
