import { type Kysely, sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import type { Migration } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { FakeClock } from '../support';
import { m1 } from './m1';

describe('migrate', () => {
  let close: () => void;
  // biome-ignore lint/suspicious/noExplicitAny: base de test sans schéma typé
  let db: Kysely<any>;
  const clock = new FakeClock();
  const tables = async () =>
    (
      await sql<{
        name: string;
      }>`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`.execute(db)
    ).rows.map((r) => r.name);

  beforeEach(() => {
    const h = openDatabase(':memory:');
    db = h.db;
    close = () => h.sqlite.close();
  });
  afterEach(() => close());

  it('applique une fois, puis ne fait plus rien', async () => {
    expect(await migrate(db, [m1], clock)).toEqual({ applied: ['0001_t'], unknownNonBreaking: [] });
    expect(await migrate(db, [m1], clock)).toEqual({ applied: [], unknownNonBreaking: [] });
    expect(await db.selectFrom('schemaMigrations').selectAll().execute()).toEqual([
      { id: '0001_t', breaking: 0, appliedAt: '2026-10-06T10:00:00.000Z' },
    ]);
  });

  it('un échec annule toute la série', async () => {
    const fail: Migration = {
      id: '0002_fail',
      breaking: false,
      up: async (trx) => {
        await sql`CREATE TABLE x (a INTEGER) STRICT`.execute(trx);
        throw new Error('boum');
      },
    };
    await expect(migrate(db, [m1, fail], clock)).rejects.toMatchObject({
      name: 'MigrationError',
      code: 'migration_failed',
    });
    expect(await tables()).toEqual(['schema_migrations']);
    expect(await db.selectFrom('schemaMigrations').selectAll().execute()).toEqual([]);
  });

  it('migration inconnue cassante → unknown_breaking_migration (R-VER-7)', async () => {
    await migrate(db, [], clock);
    await sql`INSERT INTO schema_migrations (id, breaking, applied_at) VALUES ('0099_future', 1, 'x')`.execute(
      db,
    );
    await expect(migrate(db, [m1], clock)).rejects.toMatchObject({
      name: 'MigrationError',
      code: 'unknown_breaking_migration',
    });
    expect(await tables()).toEqual(['schema_migrations']);
  });

  it('migrations inconnues non cassantes permises', async () => {
    await migrate(db, [], clock);
    await sql`INSERT INTO schema_migrations (id, breaking, applied_at) VALUES ('0002_future', 0, 'x')`.execute(
      db,
    );
    expect(await migrate(db, [], clock)).toEqual({ applied: [], unknownNonBreaking: ['0002_future'] });
  });
});
