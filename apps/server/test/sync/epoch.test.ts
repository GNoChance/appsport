import { EPOCH_HEADER, encodeWatermark } from '@appsport/contracts';
import { isUuidV7 } from '@appsport/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { getServerMeta } from '../../src/db/server-meta';
import { rotateServerEpoch } from '../../src/sync/epoch';
import { createSyncTestContext, createUserAndLogin, syncPull, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const bumpRev = () => ctx.deps.sqlite.prepare('UPDATE server_meta SET sync_counter = sync_counter + 1').run();

describe('rotateServerEpoch', () => {
  it('nouvelle époque UUIDv7, base au compteur courant, début à l’heure de la rotation', async () => {
    ctx = await createSyncTestContext({ now: '2026-10-05T10:00:00.000Z' });
    bumpRev();
    bumpRev();
    const before = await getServerMeta(ctx.deps.db);
    ctx.clock.set('2026-10-06T10:00:00.000Z');

    const r = await rotateServerEpoch(ctx.deps.db, ctx.deps);
    const after = await getServerMeta(ctx.deps.db);

    expect(r.epoch).not.toBe(before.serverEpoch);
    expect(isUuidV7(r.epoch)).toBe(true);
    expect(after).toMatchObject({
      serverEpoch: r.epoch,
      epochBaseRev: before.syncCounter,
      syncCounter: before.syncCounter,
      epochStartedAt: '2026-10-06T10:00:00.000Z',
    });
    expect(r.baseRev).toBe(before.syncCounter);
    expect(before.syncCounter).toBe(2);

    const health = await createApp(ctx.deps).request('/api/health');
    expect(health.headers.get(EPOCH_HEADER)).toBe(r.epoch);
  });

  it("un watermark de l'ancienne époque donne 410 watermark_expired", async () => {
    ctx = await createSyncTestContext();
    const a = await createUserAndLogin(ctx);
    const old = await getServerMeta(ctx.deps.db);
    const watermark = encodeWatermark(old.serverEpoch, old.syncCounter);
    expect((await syncPull(ctx, a.cookie, { since: watermark })).status).toBe(200);

    await rotateServerEpoch(ctx.deps.db, ctx.deps);
    const res = await syncPull(ctx, a.cookie, { since: watermark });
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('watermark_expired');
  });
});
