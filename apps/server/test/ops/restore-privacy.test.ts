import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { restoreSnapshot } from '../../src/ops/restore';
import { takeSnapshot } from '../../src/ops/snapshot';
import { isHealthConsentActive } from '../../src/privacy/consent-state';
import { collectPrivacyEvents, reapplyPrivacyEvents } from '../../src/privacy/reapply';
import {
  createTestContext,
  createUserAndLogin,
  dumpDatabase,
  FakeClock,
  seqIds,
  type TestContext,
} from '../support';

const WITNESS = 'TEMOIN-C2-genou';
const T0 = '2026-10-07T10:00:00.000Z';

let ctx: TestContext | undefined;
let dir: string | undefined;

afterEach(() => {
  ctx?.close();
  if (dir) rmSync(dir, { recursive: true });
  ctx = undefined;
  dir = undefined;
});

type Member = Awaited<ReturnType<typeof createUserAndLogin>>;

// Review Focus 4 ; 03 §8 et §17 n°10 : une suppression ou un retrait survenu après l'instantané ne
// « revient » pas avec la restauration, sur la vraie chaîne fichier (instantané, restore, reapply).
it('restauration puis privacy:reapply : ni le compte supprimé ni les données santé retirées ne reviennent', async () => {
  dir = mkdtempSync(join(tmpdir(), 'appsport-restore-privacy-'));
  const dbPath = join(dir, 'appsport.db');
  let c = await createTestContext({ dbPath, now: T0 });
  ctx = c;
  const call = (u: Member, path: string, method = 'GET', json?: unknown) =>
    c.request(path, { method, cookie: u.cookie, ...(json !== undefined ? { json } : {}) });
  const equipHealth = async (u: Member, note: string) => {
    expect((await call(u, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' })).status).toBe(
      200,
    );
    const screening = { answers: [true, false, false, false], questionnaireVersion: '1.0' };
    expect((await call(u, '/api/me/health-screening', 'PUT', screening)).status).toBe(200);
    const limitation = { bodyArea: 'knee', side: 'left', severity: 'mild', note };
    expect((await call(u, '/api/me/limitations', 'POST', limitation)).status).toBe(201);
  };

  const alice = await createUserAndLogin(c, { username: 'alice' });
  const bob = await createUserAndLogin(c, { username: 'bob' });
  const carol = await createUserAndLogin(c, { username: 'carol' });
  await equipHealth(bob, WITNESS);
  await equipHealth(carol, 'note de carol');
  c.clock.advance(1000);
  const since = c.clock.now().toISOString();
  const snapshot = await takeSnapshot({ sqlite: c.deps.sqlite, dataDir: dir, clock: c.clock }, 'daily');

  c.clock.advance(60_000);
  expect((await call(alice, '/api/me/delete', 'POST', { password: alice.password })).status).toBe(204);
  const withdraw = (u: Member) =>
    call(u, '/api/me/consents/withdraw', 'POST', { type: 'health', password: u.password });
  expect((await withdraw(bob)).status).toBe(200);
  // Retiré puis redonné après l'instantané : retiré de nouveau (fail-closed, décision de T24).
  expect((await withdraw(carol)).status).toBe(200);
  c.clock.advance(1000);
  expect((await call(carol, '/api/me/consents', 'POST', { type: 'health', textVersion: '1.0' })).status).toBe(
    200,
  );

  const events = await collectPrivacyEvents(c.deps.db, since);
  expect(events.map((e) => e.type)).toEqual(['account_deleted', 'consent_revoked', 'consent_revoked']);
  const collectedAt = c.clock.now().toISOString();

  // Sous Windows, une base ouverte ne peut être ni déplacée ni remplacée.
  c.close();
  await restoreSnapshot({
    dataDir: dir,
    snapshotPath: snapshot,
    ids: seqIds(70),
    clock: new FakeClock('2026-10-07T10:05:00.000Z'),
  });
  c = await createTestContext({ dbPath, now: '2026-10-07T10:06:00.000Z', deps: { ids: seqIds(71) } });
  ctx = c;
  // Avant réapplication : l'instantané a ramené alice et les données de bob.
  expect(dumpDatabase(c.deps.sqlite)).toContain(WITNESS);
  expect(await reapplyPrivacyEvents(c.deps, { since, collectedAt, source: 'test', events })).toEqual({
    accountsDeleted: 1,
    consentsWithdrawn: 2,
  });

  const me = await call(alice, '/api/me');
  expect(me.status).toBe(410);
  expect(await me.json()).toEqual({ error: 'account_deleted' });
  expect(await c.deps.db.selectFrom('user').select('id').where('id', '=', alice.id).executeTakeFirst()).toBe(
    undefined,
  );
  expect(await isHealthConsentActive(c.deps.db, bob.id)).toBe(false);
  expect(await isHealthConsentActive(c.deps.db, carol.id)).toBe(false);
  const limitations = await c.deps.db
    .selectFrom('limitation')
    .select(['bodyArea', 'side', 'severity', 'note', 'active', 'deletedAt'])
    .where('ownerId', '=', bob.id)
    .execute();
  expect(limitations).toHaveLength(1);
  expect(limitations[0]).toMatchObject({
    bodyArea: null,
    side: null,
    severity: null,
    note: null,
    active: null,
  });
  expect(limitations[0]?.deletedAt).not.toBeNull();
  expect(dumpDatabase(c.deps.sqlite)).not.toContain(WITNESS);
});
