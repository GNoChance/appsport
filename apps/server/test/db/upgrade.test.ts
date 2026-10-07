import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { FakeClock } from '../support';
import { dumpSchema } from './schema-dump';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('passage de la version précédente (01 §9.1.4)', () => {
  let h: ReturnType<typeof openDatabase>;
  beforeEach(() => {
    h = openDatabase(':memory:');
  });
  afterEach(() => h.sqlite.close());

  it('le schéma v1 figé est déjà à jour et identique à l’instantané', async () => {
    h.sqlite.exec(read('../fixtures/schema-v1.sql'));
    h.sqlite.exec("INSERT INTO schema_migrations VALUES ('0001_socle', 0, 'x')");
    expect(await migrate(h.db, MIGRATIONS, new FakeClock())).toEqual({ applied: [], unknownNonBreaking: [] });
    expect(dumpSchema(h.sqlite)).toBe(read('../__snapshots__/schema.sql'));
  });
});
