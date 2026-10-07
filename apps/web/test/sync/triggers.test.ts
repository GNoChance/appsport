import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncEngine, SyncState } from '../../src/sync/engine';
import { installSyncTriggers } from '../../src/sync/triggers';

let pending = 0;
let visibility: DocumentVisibilityState = 'visible';
let engine: SyncEngine & { syncNow: ReturnType<typeof vi.fn> };
let onLine: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  pending = 0;
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  onLine = vi.spyOn(navigator, 'onLine', 'get');
  const state = (): SyncState => ({
    connection: 'online',
    pending,
    rejected: 0,
    lastPullOkAt: null,
    syncing: false,
    serverEpoch: null,
  });
  engine = {
    syncNow: vi.fn(async () => {}),
    pullNow: vi.fn(async () => {}),
    flushBefore: vi.fn(async () => {}),
    getState: state,
    subscribe: () => () => {},
    start: () => {},
    stop: () => {},
  };
});
afterEach(() => {
  expect(onLine).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('installSyncTriggers', () => {
  it('retour au premier plan → syncNow(foreground) ; caché → rien', () => {
    const uninstall = installSyncTriggers(engine);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(engine.syncNow).not.toHaveBeenCalled();
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(engine.syncNow).toHaveBeenCalledWith('foreground');
    uninstall();
  });

  it("'online' → syncNow(online)", () => {
    const uninstall = installSyncTriggers(engine);
    window.dispatchEvent(new Event('online'));
    expect(engine.syncNow).toHaveBeenCalledWith('online');
    uninstall();
  });

  it('toutes les 60 s : interval si visible et pending > 0', async () => {
    const uninstall = installSyncTriggers(engine);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.syncNow).not.toHaveBeenCalled();
    pending = 3;
    visibility = 'hidden';
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.syncNow).not.toHaveBeenCalled();
    visibility = 'visible';
    await vi.advanceTimersByTimeAsync(59_999);
    expect(engine.syncNow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.syncNow).toHaveBeenCalledExactlyOnceWith('interval');
    uninstall();
  });

  it('la fonction rendue retire écouteurs et intervalle', async () => {
    pending = 1;
    installSyncTriggers(engine)();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(180_000);
    expect(engine.syncNow).not.toHaveBeenCalled();
  });

  it('env injecté : doc et win', () => {
    const doc = new EventTarget() as Document;
    Object.defineProperty(doc, 'visibilityState', { get: () => 'visible' });
    const win = new EventTarget() as Window;
    const uninstall = installSyncTriggers(engine, { doc, win });
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('online'));
    expect(engine.syncNow.mock.calls).toEqual([['foreground'], ['online']]);
    uninstall();
  });
});
