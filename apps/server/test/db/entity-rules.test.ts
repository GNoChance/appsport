import { entityRules, snakeToCamel } from '@appsport/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { FakeClock, insertFixtureRow } from '../support';

describe('entityRules contre la base migrée', () => {
  let h: ReturnType<typeof openDatabase>;

  beforeEach(async () => {
    h = openDatabase(':memory:');
    await migrate(h.db, MIGRATIONS, new FakeClock());
  });
  afterEach(() => h.sqlite.close());

  it('chaque table et chaque colonne de sqlite_schema est déclarée, et inversement', () => {
    const names = (sql: string, ...args: string[]) =>
      (h.sqlite.prepare(sql).all(...args) as { name: string }[]).map((r) => r.name).sort();
    const tables = names("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    expect(Object.keys(entityRules).sort()).toEqual(tables);
    for (const t of tables) {
      expect([...(entityRules[t]?.columns ?? [])].sort(), t).toEqual(
        names('SELECT name FROM pragma_table_info(?)', t),
      );
    }
  });

  it('toute table C1–C3 liée à un utilisateur est exportée et supprimée', () => {
    for (const [t, r] of Object.entries(entityRules)) {
      if (!['C1', 'C2', 'C3'].includes(r.category) || r.ownerColumn === null) continue;
      expect(['cascade', 'anonymize'], t).toContain(r.onUserDelete);
      // session : anonymisée et non exportée (02 R-EXP-2)
      expect(r.exported, t).toBe(t !== 'session');
    }
  });

  it('secretColumns = toutes les colonnes *_hash', () => {
    const declared = Object.entries(entityRules)
      .flatMap(([t, r]) => r.secretColumns.map((c) => `${t}.${c}`))
      .sort();
    expect(declared).toEqual([
      'invitation.code_hash',
      'password_reset.code_hash',
      'session.token_hash',
      'user.password_hash',
    ]);
    const hashes = Object.entries(entityRules)
      .flatMap(([t, r]) => r.columns.filter((c) => c.endsWith('_hash')).map((c) => `${t}.${c}`))
      .sort();
    expect(declared).toEqual(hashes);
  });

  it.each(Object.keys(entityRules))('insertFixtureRow(%s) insère une ligne valide', async (table) => {
    const row = await insertFixtureRow(h.db, table);
    expect(Object.keys(row).sort()).toEqual((entityRules[table]?.columns ?? []).map(snakeToCamel).sort());
    expect(h.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('insertFixtureRow applique les valeurs fournies', async () => {
    const user = await insertFixtureRow(h.db, 'user');
    const place = await insertFixtureRow(h.db, 'place', { ownerId: user.id, kind: 'home', name: 'Maison' });
    expect(place).toMatchObject({ ownerId: user.id, kind: 'home', name: 'Maison' });
  });
});
