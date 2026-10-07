// @vitest-environment node
import { SYNC_FIXTURE_RULES } from '@appsport/server/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../../src/local-db/db';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { postToSw } from '../../src/sw/sw-client';
import { refreshCatalog } from '../../src/sync/catalog';
import { createSyncEngine } from '../../src/sync/engine';
import { createFakeSyncServer, type FakeSyncServer } from '../support/fake-sync-server';
import { createFixtureLocalDb } from '../support/local-db';

const bundle = {
  version: 'cat-2',
  exercises: [{ id: 'squat', name: 'Squat' }],
  illustrations: [{ id: 'squat', file: 'squat.0123abcd.svg' }],
  programTemplates: [{ id: 'full-body' }],
  adviceSheets: [{ id: 'echauffement' }],
};

let db: AppDb;
let server: FakeSyncServer;

beforeEach(async () => {
  db = createFixtureLocalDb();
  server = createFakeSyncServer('E1');
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('refreshCatalog', () => {
  it('If-None-Match "<catalogVersion>" ; 304 → unchanged', async () => {
    await setMeta(db, 'catalogVersion', 'cat-1');
    expect(await refreshCatalog(db, server)).toBe('unchanged');
    expect(server.log[0]?.path).toBe('/api/catalog');
    expect(server.log[0]?.headers.get('If-None-Match')).toBe('"cat-1"');
  });

  it('sans version locale : pas d’If-None-Match', async () => {
    await refreshCatalog(db, server);
    expect(server.log[0]?.headers.has('If-None-Match')).toBe(false);
  });

  it('200 → 4 magasins remplacés, catalogVersion = serverCatalogVersion = version → updated', async () => {
    await db.table('exercises').put({ id: 'ancien' });
    await db.table('illustrations').put({ id: 'ancien', file: 'ancien.00000000.svg' });
    server.on('GET /api/catalog', () => server.json(200, bundle));
    expect(await refreshCatalog(db, server)).toBe('updated');
    expect(await db.table('exercises').toArray()).toEqual(bundle.exercises);
    expect(await db.table('illustrations').toArray()).toEqual(bundle.illustrations);
    expect(await db.table('programTemplates').toArray()).toEqual(bundle.programTemplates);
    expect(await db.table('adviceSheets').toArray()).toEqual(bundle.adviceSheets);
    expect(await getMeta(db, 'catalogVersion')).toBe('cat-2');
    expect(await getMeta(db, 'serverCatalogVersion')).toBe('cat-2');
  });

  it('SW contrôleur → postMessage SYNC_ILLUSTRATIONS', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { controller: { postMessage } } });
    server.on('GET /api/catalog', () => server.json(200, bundle));
    await refreshCatalog(db, server);
    expect(postMessage).toHaveBeenCalledWith({ type: 'SYNC_ILLUSTRATIONS', files: ['squat.0123abcd.svg'] });
  });

  it('élément sans id → rejet, rien remplacé', async () => {
    await db.table('exercises').put({ id: 'ancien' });
    server.on('GET /api/catalog', () => server.json(200, { ...bundle, exercises: [{ name: 'x' }] }));
    await expect(refreshCatalog(db, server)).rejects.toThrow();
    expect(await db.table('exercises').toArray()).toEqual([{ id: 'ancien' }]);
    expect(await getMeta(db, 'catalogVersion')).toBeUndefined();
  });

  it('autre statut → Error(catalog_http_<status>)', async () => {
    server.on('GET /api/catalog', () => server.json(500, { error: 'internal' }));
    await expect(refreshCatalog(db, server)).rejects.toThrow('catalog_http_500');
  });
});

describe('postToSw', () => {
  it('sans contrôleur → false', () => {
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    expect(postToSw({ type: 'SKIP_WAITING' })).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(postToSw({ type: 'GET_STATUS' })).toBe(false);
  });

  it('avec contrôleur → true', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { controller: { postMessage } } });
    expect(postToSw({ type: 'SKIP_WAITING' })).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});

describe('moteur', () => {
  const engineFor = () =>
    createSyncEngine({ db, transport: server, rules: SYNC_FIXTURE_RULES, triggers: () => () => {} });

  beforeEach(async () => {
    await setMeta(db, 'userId', 'u1');
    await setMeta(db, 'serverEpoch', 'E1');
    await setMeta(db, 'catalogVersion', 'cat-1');
  });

  it('après un pull où serverCatalogVersion ≠ catalogVersion → GET /api/catalog', async () => {
    server.catalogVersion = 'cat-2';
    server.on('GET /api/catalog', () => server.json(200, bundle));
    await engineFor().syncNow('manual');
    expect(server.paths().at(-1)).toBe('GET /api/catalog');
    expect(await getMeta(db, 'catalogVersion')).toBe('cat-2');
  });

  it('versions égales → pas de GET /api/catalog', async () => {
    server.catalogVersion = 'cat-1';
    await engineFor().syncNow('manual');
    expect(server.paths()).not.toContain('GET /api/catalog');
  });

  it('erreur du catalogue avalée', async () => {
    server.catalogVersion = 'cat-2';
    server.on('GET /api/catalog', () => server.json(500, { error: 'internal' }));
    const engine = engineFor();
    await expect(engine.syncNow('manual')).resolves.toBeUndefined();
    expect(engine.getState().connection).toBe('online');
    expect(await getMeta(db, 'lastPullOkAt')).toBeDefined();
  });
});
