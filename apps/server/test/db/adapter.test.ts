import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import BetterSqlite3 from 'better-sqlite3';
import { CamelCasePlugin, type Generated, Kysely, SqliteDialect, sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/open';

type TestDb = {
  item: { id: Generated<number>; itemName: string; qty: Generated<number> };
};

interface Handle {
  db: Kysely<TestDb>;
  close(): void;
}

const factories: [string, () => Handle][] = [
  [
    'node:sqlite',
    () => {
      const { sqlite, db } = openDatabase(':memory:');
      return { db: db.withTables<TestDb>(), close: () => sqlite.close() };
    },
  ],
  [
    'better-sqlite3',
    () => {
      const database = new BetterSqlite3(':memory:');
      const db = new Kysely<TestDb>({
        dialect: new SqliteDialect({ database }),
        plugins: [new CamelCasePlugin()],
      });
      return { db, close: () => database.close() };
    },
  ],
];

const tick = () => new Promise((r) => setTimeout(r, 5));

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe.each(factories)('adaptateur Kysely (%s)', (driverName, open) => {
  let handle: Handle;
  let db: Kysely<TestDb>;

  const names = async () =>
    (await db.selectFrom('item').select('itemName').orderBy('id').execute()).map((r) => r.itemName);

  beforeEach(async () => {
    handle = open();
    db = handle.db;
    await sql`CREATE TABLE item (id INTEGER PRIMARY KEY, item_name TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0) STRICT`.execute(
      db,
    );
  });

  afterEach(() => {
    handle.close();
  });

  it('CRUD avec CamelCasePlugin', async () => {
    const inserted = await db.insertInto('item').values({ itemName: 'a', qty: 1 }).executeTakeFirstOrThrow();
    expect(inserted.insertId).toBe(1n);
    await db.insertInto('item').values({ itemName: 'b', qty: 1 }).execute();

    const updated = await db.updateTable('item').set({ qty: 3 }).executeTakeFirstOrThrow();
    expect(updated.numUpdatedRows).toBe(2n);

    expect(await db.selectFrom('item').selectAll().where('id', '=', 1).executeTakeFirstOrThrow()).toEqual({
      id: 1,
      itemName: 'a',
      qty: 3,
    });

    const deleted = await db.deleteFrom('item').where('itemName', '=', 'b').executeTakeFirstOrThrow();
    expect(deleted.numDeletedRows).toBe(1n);
  });

  it('RETURNING renvoie les lignes', async () => {
    const rows = await db
      .insertInto('item')
      .values({ itemName: 'r' })
      .returning(['id', 'itemName'])
      .execute();
    expect(rows).toEqual([{ id: 1, itemName: 'r' }]);
  });

  it('une transaction qui lève est annulée et la connexion libérée', async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await trx.insertInto('item').values({ itemName: 'dedans' }).execute();
        throw new Error('échec voulu');
      }),
    ).rejects.toThrow('échec voulu');
    expect(await names()).toEqual([]);

    await db.insertInto('item').values({ itemName: 'après' }).execute();
    expect(await names()).toEqual(['après']);
  });

  it('un savepoint annulé ne perd pas le reste de la transaction', async () => {
    const trx = await db.startTransaction().execute();
    await trx.insertInto('item').values({ itemName: 'garde' }).execute();

    const sp1 = await trx.savepoint('sp1').execute();
    await sp1.insertInto('item').values({ itemName: 'jete' }).execute();
    const afterRollback = await sp1.rollbackToSavepoint('sp1').execute();

    const sp2 = await afterRollback.savepoint('sp2').execute();
    await sp2.insertInto('item').values({ itemName: 'garde2' }).execute();
    await sp2.releaseSavepoint('sp2').execute();
    await trx.commit().execute();

    expect(await names()).toEqual(['garde', 'garde2']);
  });

  it("Review Focus 1 : deux transactions concurrentes sérialisées ; l'échec de l'une n'annule pas l'autre", async () => {
    const res = await Promise.allSettled([
      db.transaction().execute(async (trx) => {
        await trx.insertInto('item').values({ itemName: 'a' }).execute();
        await tick();
        throw new Error('échec voulu');
      }),
      db.transaction().execute(async (trx) => {
        await trx.insertInto('item').values({ itemName: 'b' }).execute();
        await tick();
      }),
    ]);
    expect(res.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(await names()).toEqual(['b']);
  });

  it('Review Focus 1 : une requête hors transaction attend la transaction ouverte et survit à son rollback', async () => {
    const started = deferred();
    const gate = deferred();
    const inTransaction = db.transaction().execute(async (trx) => {
      await trx.insertInto('item').values({ itemName: 'dedans' }).execute();
      started.resolve();
      await gate.promise;
      throw new Error('annulée');
    });
    await started.promise;

    const outside = db.insertInto('item').values({ itemName: 'dehors' }).execute();
    await tick();
    gate.resolve();

    await expect(inTransaction).rejects.toThrow('annulée');
    await outside;
    expect(await names()).toEqual(['dehors']);
  });

  // Le SqliteDialect de Kysely se bloquerait sur son mutex : seul node:sqlite détecte la réentrance.
  it.runIf(driverName === 'node:sqlite')(
    'une requête sur db dans un callback de transaction lève au lieu de bloquer',
    { timeout: 1000 },
    async () => {
      await expect(
        db.transaction().execute(async (trx) => {
          await trx.insertInto('item').values({ itemName: 'dedans' }).execute();
          return db.selectFrom('item').selectAll().execute();
        }),
      ).rejects.toThrow(/utiliser trx/);
      expect(await names()).toEqual([]);
    },
  );

  it.runIf(driverName === 'node:sqlite')(
    'propage les erreurs du pilote telles quelles (errcode)',
    async () => {
      const error = await sql`INSERT INTO item (item_name) VALUES (NULL)`
        .execute(db)
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ errcode: 1299 }); // SQLITE_CONSTRAINT_NOTNULL
    },
  );
});

describe('openDatabase', () => {
  let dir: string;
  let sqlite: DatabaseSync | undefined;

  const pragma = (name: string) => {
    const row = sqlite?.prepare(`PRAGMA ${name}`).get() as Record<string, unknown>;
    return Object.values(row)[0];
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-db-'));
  });

  afterEach(() => {
    sqlite?.close(); // avant rmSync : Windows refuse de supprimer un fichier ouvert (EBUSY)
    sqlite = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('applique les pragmas sur un fichier', () => {
    ({ sqlite } = openDatabase(join(dir, 'appsport.db')));
    expect(pragma('journal_mode')).toBe('wal');
    expect(pragma('synchronous')).toBe(2);
    expect(pragma('foreign_keys')).toBe(1);
    expect(pragma('busy_timeout')).toBe(5000);
  });

  it("accepte ':memory:'", async () => {
    const opened = openDatabase(':memory:');
    sqlite = opened.sqlite;
    const { rows } = await sql<{ one: number }>`SELECT 1 AS one`.execute(opened.db);
    expect(rows).toEqual([{ one: 1 }]);
  });
});
