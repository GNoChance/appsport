// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  OfflineError,
  type SyncTransport,
} from '../../src/sync/transport';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('fetchWithTimeout', () => {
  it('transport muet → OfflineError à 4000 ms', async () => {
    const mute: SyncTransport = { fetch: () => new Promise<Response>(() => {}) };
    let settled: unknown = null;
    const p = fetchWithTimeout(mute, '/api/health', { method: 'GET' }).catch((e: unknown) => {
      settled = e;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBeInstanceOf(OfflineError);
  });

  it('abandonne la requête à l’échéance (signal)', async () => {
    let signal: AbortSignal | undefined;
    const mute: SyncTransport = {
      fetch: (_p, init) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>(() => {});
      },
    };
    const p = fetchWithTimeout(mute, '/x', {}, 100).catch(() => {});
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(signal?.aborted).toBe(true);
  });

  it('TypeError → OfflineError', async () => {
    const down: SyncTransport = { fetch: () => Promise.reject(new TypeError('Failed to fetch')) };
    await expect(fetchWithTimeout(down, '/api/health', {})).rejects.toBeInstanceOf(OfflineError);
  });

  it('500 renvoyée telle quelle', async () => {
    const t: SyncTransport = { fetch: async () => new Response('{"error":"internal"}', { status: 500 }) };
    const res = await fetchWithTimeout(t, '/api/health', {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });
  });

  it('autre erreur propagée', async () => {
    const t: SyncTransport = { fetch: () => Promise.reject(new Error('boum')) };
    await expect(fetchWithTimeout(t, '/x', {})).rejects.toThrow('boum');
  });
});

const stalled = (status = 200) => new Response(new ReadableStream<Uint8Array>({ start() {} }), { status });

describe('fetchJsonWithTimeout', () => {
  it('corps lu et décodé dans le délai', async () => {
    const t: SyncTransport = { fetch: async () => new Response('{"a":1}', { status: 200 }) };
    const reply = await fetchJsonWithTimeout(t, '/x', {});
    expect(reply.res.status).toBe(200);
    expect(reply.body).toEqual({ a: 1 });
  });

  it('corps vide → null', async () => {
    const t: SyncTransport = { fetch: async () => new Response(null, { status: 304 }) };
    expect((await fetchJsonWithTimeout(t, '/x', {})).body).toBeNull();
  });

  it('corps bloqué → OfflineError à l’échéance, requête abandonnée', async () => {
    let signal: AbortSignal | undefined;
    const t: SyncTransport = {
      fetch: async (_p, init) => {
        signal = init.signal ?? undefined;
        return stalled();
      },
    };
    let settled: unknown = null;
    const p = fetchJsonWithTimeout(t, '/x', {}, 4000).catch((e: unknown) => {
      settled = e;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBeInstanceOf(OfflineError);
    expect(signal?.aborted).toBe(true);
  });

  it('onHeaders appelé avant la lecture du corps ; son exception est propagée', async () => {
    const t: SyncTransport = { fetch: async () => stalled() };
    const boom = new Error('epoch');
    await expect(
      fetchJsonWithTimeout(t, '/x', {}, 4000, () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
