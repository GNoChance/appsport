import { afterEach, expect, it } from 'vitest';
import { type AppDb, createAppDb, LOCAL_DB_VERSION } from '../../src/local-db/db';
import { getMeta } from '../../src/local-db/meta';
import { convertOutboxOp } from '../../src/sync/protocol-converters';
import { loadFrozenLocalDb, readFrozenDump } from '../support/local-db';

let db: AppDb | undefined;
afterEach(async () => {
  await db?.delete();
});

// R-VER-5 : une base locale v1 figée s'ouvre avec la version courante, sans perte.
it('ouvre le jeu figé v1 avec la version courante', async () => {
  const name = `frozen-v1-${crypto.randomUUID()}`;
  await loadFrozenLocalDb(1, name);
  const dump = await readFrozenDump(1);
  db = createAppDb(name);
  await db.open();
  expect(db.verno).toBe(LOCAL_DB_VERSION);
  expect(await db.outbox.toArray()).toEqual(dump.outbox.map((op) => convertOutboxOp(op)));
  for (const [store, rows] of Object.entries(dump.mirrors)) {
    expect(await db.mirror(store).toArray(), store).toEqual(rows);
  }
  expect(await getMeta(db, 'watermark')).toBe('0199b9a0-0000-7000-8000-0000000000e1:42');
  expect(await getMeta(db, 'deviceId')).toBe(dump.meta.deviceId);
});
