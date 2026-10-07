import { isUuidV7 } from '@appsport/domain';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { nextRev, writeStamp } from '../../src/db/rev';
import { type Database, tableKey } from '../../src/db/schema';
import { getServerMeta, initServerMeta } from '../../src/db/server-meta';
import { FakeClock, seqIds } from '../support';

describe('server_meta et révisions', () => {
  let close: () => void;
  let db: Kysely<Database>;
  beforeEach(async () => {
    const h = openDatabase(':memory:');
    db = h.db;
    close = () => h.sqlite.close();
    await migrate(db, MIGRATIONS, new FakeClock());
  });
  afterEach(() => close());

  it('initServerMeta pose époque, date de début et compteurs', async () => {
    const meta = await initServerMeta(db, { ids: seqIds(1), clock: new FakeClock() });
    expect(isUuidV7(meta.serverEpoch)).toBe(true);
    expect(meta).toMatchObject({
      epochStartedAt: '2026-10-06T10:00:00.000Z',
      epochBaseRev: 0,
      syncCounter: 0,
      tombstonePurgeRev: 0,
      catalogVersion: null,
      catalogUpdatedAt: null,
    });
    expect(await getServerMeta(db)).toEqual(meta);
  });

  it('getServerMeta échoue sur une base non initialisée', async () => {
    await expect(getServerMeta(db)).rejects.toThrow('server_meta absent');
  });

  it('nextRev incrémente et ignore les transactions annulées', async () => {
    await initServerMeta(db, { ids: seqIds(1), clock: new FakeClock() });
    expect([await nextRev(db), await nextRev(db), await nextRev(db)]).toEqual([1, 2, 3]);
    await expect(
      db.transaction().execute(async (trx) => {
        await nextRev(trx);
        throw new Error('annulée');
      }),
    ).rejects.toThrow('annulée');
    expect(await nextRev(db)).toBe(4);
  });

  it('writeStamp renvoie révision, date serveur et auteur', async () => {
    await initServerMeta(db, { ids: seqIds(1), clock: new FakeClock() });
    expect(await writeStamp(db, { clock: new FakeClock() }, 'u1')).toEqual({
      rev: 1,
      updatedAt: '2026-10-06T10:00:00.000Z',
      updatedBy: 'u1',
    });
  });
});

describe('tableKey', () => {
  it('passe du snake_case au camelCase', () => {
    expect(tableKey('training_profile')).toBe('trainingProfile');
    expect(tableKey('user')).toBe('user');
  });
});
