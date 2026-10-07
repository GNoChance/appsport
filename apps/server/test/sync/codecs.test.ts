import { COLUMN_CODECS, type ColumnCodec, mirroredTables } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

/** Codecs déduits du DDL : `x IN (0,1)` → boolean, `json_valid(x)` → json. */
function codecsFromSchema(): Record<string, Record<string, ColumnCodec>> {
  const out: Record<string, Record<string, ColumnCodec>> = {};
  for (const table of mirroredTables()) {
    const row = ctx.deps.sqlite
      .prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?")
      .get(table) as { sql: string } | undefined;
    if (!row) throw new Error(`Table absente : ${table}`);
    const codecs: Record<string, ColumnCodec> = {};
    for (const m of row.sql.matchAll(/\b(\w+) IN \(0,\s*1\)/g)) codecs[m[1] as string] = 'boolean';
    for (const m of row.sql.matchAll(/json_valid\((\w+)\)/g)) codecs[m[1] as string] = 'json';
    if (Object.keys(codecs).length > 0) out[table] = codecs;
  }
  return out;
}

describe('COLUMN_CODECS', () => {
  it('couvre exactement les booléens et JSON des tables miroirs', async () => {
    ctx = await createTestContext();
    expect(COLUMN_CODECS).toEqual(codecsFromSchema());
  });

  it('valeur exacte', () => {
    expect(COLUMN_CODECS).toEqual({
      training_profile: { cautious_mode: 'boolean' },
      health_screening: { caution: 'boolean' },
      limitation: { active: 'boolean' },
      gym: { load_settings: 'json' },
      place: { is_primary: 'boolean', visible_at_gym: 'boolean', load_settings: 'json' },
      sync_rejection: { detail_json: 'json' },
    });
  });
});
