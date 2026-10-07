import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { logSecurityEvent } from '../../src/auth/security-log';
import { collectPrivacyEvents, reapplyPrivacyEvents } from '../../src/privacy/reapply';
import {
  createSyncTestContext,
  createUserAndLogin,
  dumpDatabase,
  makeOp,
  restoreInPlace,
  seqIds,
  snapshotDb,
  syncPush,
  type TestContext,
} from '../support';

const WITNESS = 'TEMOIN-C2-genou';
const ADMIN_PASSWORD = 'quatorze carac';
const rowIds = seqIds(8000);

let ctx: TestContext;
let dir: string;
let S: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'appsport-reapply-'));
  S = join(dir, 'S.db');
});

afterEach(() => {
  ctx?.close();
  rmSync(dir, { recursive: true });
});

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;
const call = (u: Member, path: string, method = 'GET', json?: unknown) =>
  ctx.request(path, { method, cookie: u.cookie, ...(json !== undefined ? { json } : {}) });
const userExists = async (id: string) =>
  (await ctx.deps.db.selectFrom('user').select('id').where('id', '=', id).executeTakeFirst()) !== undefined;
const now = () => ctx.clock.now().toISOString();

async function equipHealth(u: Member): Promise<void> {
  expect((await call(u, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' })).status).toBe(
    200,
  );
  const screening = { answers: [true, false, false, false], questionnaireVersion: '1.0' };
  expect((await call(u, '/api/me/health-screening', 'PUT', screening)).status).toBe(200);
  const limitation = { bodyArea: 'knee', side: 'left', severity: 'mild', note: WITNESS };
  expect((await call(u, '/api/me/limitations', 'POST', limitation)).status).toBe(201);
}

describe('privacy:reapply après restauration (03 §17 n°10, P-DRT-3, P-CST-3)', () => {
  it('réapplique suppressions et retraits survenus après la sauvegarde', async () => {
    ctx = await createSyncTestContext();
    const x = await createUserAndLogin(ctx, { username: 'xavier' });
    const y = await createUserAndLogin(ctx, { username: 'yasmine' });
    const z = await createUserAndLogin(ctx, { username: 'zoe' });
    expect((await call(z, '/api/me/delete', 'POST', { password: z.password })).status).toBe(204);
    await equipHealth(y);
    ctx.clock.advance(1000);

    await snapshotDb(ctx, S);
    const since = now();
    ctx.clock.advance(60_000);
    expect((await call(x, '/api/me/delete', 'POST', { password: x.password })).status).toBe(204);
    const withdraw = await call(y, '/api/me/consents/withdraw', 'POST', {
      type: 'health',
      password: y.password,
    });
    expect(withdraw.status).toBe(200);

    const events = await collectPrivacyEvents(ctx.deps.db, since);
    expect(events).toEqual([
      { type: 'account_deleted', at: expect.any(String), targetId: x.id },
      { type: 'consent_revoked', at: expect.any(String), targetId: y.id, consentType: 'health' },
    ]);
    const collectedAt = now();

    const restored = await restoreInPlace(ctx, S);
    expect(restored.epoch).toEqual(expect.any(String));
    expect(dumpDatabase(ctx.deps.sqlite)).toContain(WITNESS);
    expect(await userExists(x.id)).toBe(true);
    expect(await userExists(z.id)).toBe(false);

    ctx.clock.advance(1000);
    const list = { since, collectedAt, source: 'test', events };
    expect(await reapplyPrivacyEvents(ctx.deps, list)).toEqual({ accountsDeleted: 1, consentsWithdrawn: 1 });

    expect(await userExists(x.id)).toBe(false);
    const me = await call(x, '/api/me');
    expect(me.status).toBe(410);
    expect(await me.json()).toEqual({ error: 'account_deleted' });
    const op = makeOp({
      userId: x.id,
      entity: 'fixture_note',
      id: rowIds.uuidv7(),
      kind: 'create',
      fields: { title: 't' },
    });
    const push = await syncPush(ctx, x.cookie, [op]);
    expect(push.status).toBe(410);
    expect(push.body).toEqual({ error: 'account_deleted' });

    expect(dumpDatabase(ctx.deps.sqlite)).not.toContain(WITNESS);
    const screening = await ctx.deps.db
      .selectFrom('healthScreening')
      .select(['caution', 'deletedAt'])
      .where('id', '=', y.id)
      .executeTakeFirstOrThrow();
    expect(screening.caution).toBeNull();
    expect(screening.deletedAt).not.toBeNull();

    expect(await reapplyPrivacyEvents(ctx.deps, list)).toEqual({ accountsDeleted: 0, consentsWithdrawn: 0 });
  });

  it('collecte : ignore les événements antérieurs à since, les échecs et les autres types', async () => {
    ctx = await createSyncTestContext();
    const u = await createUserAndLogin(ctx, { username: 'ugo' });
    await logSecurityEvent(ctx.deps.db, ctx.deps, {
      type: 'account_deleted',
      actorId: null,
      targetId: 'avant',
      ip: null,
      outcome: 'success',
    });
    ctx.clock.advance(1000);
    const since = now();
    ctx.clock.advance(1000);
    for (const ev of [
      { type: 'consent_granted', outcome: 'success' },
      { type: 'account_deleted', outcome: 'failure' },
      { type: 'login_succeeded', outcome: 'success' },
    ] as const) {
      await logSecurityEvent(ctx.deps.db, ctx.deps, { ...ev, actorId: u.id, targetId: u.id, ip: null });
    }
    await logSecurityEvent(ctx.deps.db, ctx.deps, {
      type: 'consent_revoked',
      actorId: u.id,
      targetId: u.id,
      ip: null,
      outcome: 'success',
      details: { consentType: 'ai_coach' },
    });
    expect(await collectPrivacyEvents(ctx.deps.db, since)).toEqual([
      { type: 'consent_revoked', at: expect.any(String), targetId: u.id, consentType: 'ai_coach' },
    ]);
  });

  it('réapplication : ignore les événements antérieurs à since et le retrait ai_coach', async () => {
    ctx = await createSyncTestContext();
    const y = await createUserAndLogin(ctx, { username: 'yasmine' });
    await equipHealth(y);
    const before = now();
    ctx.clock.advance(60_000);
    const since = now();
    ctx.clock.advance(60_000);
    const list = {
      since,
      collectedAt: now(),
      source: 'test',
      events: [
        { type: 'consent_revoked' as const, at: before, targetId: y.id, consentType: 'health' as const },
        { type: 'account_deleted' as const, at: before, targetId: y.id },
        { type: 'consent_revoked' as const, at: now(), targetId: y.id, consentType: 'ai_coach' as const },
      ],
    };
    expect(await reapplyPrivacyEvents(ctx.deps, list)).toEqual({ accountsDeleted: 0, consentsWithdrawn: 0 });
    expect(await userExists(y.id)).toBe(true);
    expect(dumpDatabase(ctx.deps.sqlite)).toContain(WITNESS);
  });

  it('supprime le dernier admin sans last_admin (enforceLastAdmin: false)', async () => {
    ctx = await createSyncTestContext();
    const w = await createUserAndLogin(ctx, { username: 'wanda', role: 'admin', password: ADMIN_PASSWORD });
    const x = await createUserAndLogin(ctx, { username: 'xavier' });
    ctx.clock.advance(1000);
    await snapshotDb(ctx, S);
    const since = now();
    ctx.clock.advance(60_000);
    const promote = await call(w, `/api/admin/members/${x.id}/role`, 'POST', {
      role: 'admin',
      password: ADMIN_PASSWORD,
    });
    expect(promote.status).toBe(204);
    expect((await call(w, '/api/me/delete', 'POST', { password: ADMIN_PASSWORD })).status).toBe(204);
    const events = await collectPrivacyEvents(ctx.deps.db, since);
    expect(events).toEqual([{ type: 'account_deleted', at: expect.any(String), targetId: w.id }]);

    await restoreInPlace(ctx, S);
    const list = { since, collectedAt: now(), source: 'test', events };
    expect(await reapplyPrivacyEvents(ctx.deps, list)).toEqual({ accountsDeleted: 1, consentsWithdrawn: 0 });
    expect(await userExists(w.id)).toBe(false);
    const admins = await ctx.deps.db.selectFrom('user').select('id').where('role', '=', 'admin').execute();
    expect(admins).toEqual([]);
  });
});
