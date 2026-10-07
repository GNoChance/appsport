import { describe, expect, it } from 'vitest';
import { createApiClient } from '../../src/api/client';
import type { AppServices } from '../../src/app-services';
import { bootApp } from '../../src/boot';
import { setMeta } from '../../src/local-db/meta';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { createFakeApi, createFakeSyncEngine, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { DEFAULT_NOW } from '../support/render';
import { until } from '../support/wait';

function services(api: FakeApi, sync: SyncEngine, db = createTestLocalDb()): AppServices {
  return {
    db,
    api: createApiClient(api.transport, { onUnauthenticated: () => {}, onAccountDeleted: () => {} }),
    sync,
    transport: api.transport,
    now: () => DEFAULT_NOW,
    newOpId: () => crypto.randomUUID(),
  };
}

describe('bootApp', () => {
  it("démarre le moteur et rend de quoi l'arrêter", () => {
    const api = createFakeApi();
    const sync = createFakeSyncEngine();
    const stop = bootApp(services(api, sync));
    expect(sync.started).toBe(true);
    stop();
    expect(sync.started).toBe(false);
  });

  it('moteur réel : synchro au lancement, puis au retour au premier plan (R-SYN-29)', async () => {
    const api = createFakeApi();
    api.on('GET', '/api/health', { status: 200, body: { ok: true }, headers: { 'X-Appsport-Epoch': 'E1' } });
    const db = createTestLocalDb();
    await setMeta(db, 'userId', 'u-1');
    const sync = createSyncEngine({ db, transport: api.transport, now: () => DEFAULT_NOW });
    const health = () => api.calls.filter((c) => c.method === 'GET' && c.path === '/api/health').length;
    const stop = bootApp(services(api, sync, db));
    try {
      await until(() => api.calls.length > 0 && !sync.getState().syncing);
      expect(`${api.calls[0]?.method} ${api.calls[0]?.path}`).toBe('GET /api/health');
      expect(health()).toBe(1);
      document.dispatchEvent(new Event('visibilitychange'));
      await until(() => health() === 2);
    } finally {
      stop();
    }
  });
});
