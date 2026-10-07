import { MIN_PROTOCOL, PROTOCOL_HEADER, SYNC_PROTOCOL } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createSyncTestContext, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const ROUTES = [
  { method: 'GET', path: '/api/sync/pull' },
  { method: 'POST', path: '/api/sync/push' },
] as const;

const BAD_VERSIONS: (string | null)[] = [null, '0', '2', 'abc', '1.5'];

function send(route: (typeof ROUTES)[number], version: string | null) {
  return ctx.request(route.path, {
    method: route.method,
    ...(route.method === 'POST' ? { json: { ops: [] } } : {}),
    ...(version !== null ? { headers: { [PROTOCOL_HEADER]: version } } : {}),
  });
}

describe('garde de protocole /api/sync (R-VER-1, R-VER-2)', () => {
  for (const route of ROUTES) {
    it.each(BAD_VERSIONS)(
      `${route.method} ${route.path}, protocole %s sans cookie → 426`,
      async (version) => {
        ctx = await createSyncTestContext();
        const res = await send(route, version);
        expect(res.status).toBe(426);
        expect(await res.json()).toEqual({
          error: 'protocol_unsupported',
          serverProtocol: SYNC_PROTOCOL,
          minProtocol: MIN_PROTOCOL,
        });
      },
    );

    it(`${route.method} ${route.path}, protocole 1 sans session → 401 unauthenticated`, async () => {
      ctx = await createSyncTestContext();
      const res = await send(route, '1');
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthenticated' });
    });
  }

  it('les valeurs exactes du 426 : serverProtocol 1, minProtocol 1', () => {
    expect([SYNC_PROTOCOL, MIN_PROTOCOL]).toEqual([1, 1]);
  });
});
