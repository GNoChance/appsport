import { afterEach, describe, expect, it } from 'vitest';
import { getServerMeta } from '../../src/db/server-meta';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

describe('GET /api/health', () => {
  it('répond ok avec époque et protocole', async () => {
    ctx = await createTestContext();
    const meta = await getServerMeta(ctx.deps.db);
    const res = await ctx.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      version: 'dev',
      db: 'ok',
      protocol: 1,
      minProtocol: 1,
      epoch: meta.serverEpoch,
      swKill: false,
    });
  });

  it('reflète la configuration', async () => {
    ctx = await createTestContext({ config: { swKillSwitch: true, version: 'v1.0.0' } });
    expect(await (await ctx.request('/api/health')).json()).toMatchObject({
      swKill: true,
      version: 'v1.0.0',
    });
  });

  it('répond 503 quand la base est fermée', async () => {
    ctx = await createTestContext();
    ctx.deps.sqlite.close();
    const res = await ctx.request('/api/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'error', db: 'error', epoch: null });
  });
});
