import { describe, expect, it } from 'vitest';
import { camelToSnake, rowToCamel, snakeToCamel } from '../src/case';
import { entityRules } from '../src/entity-rules';

describe('conversion de casse', () => {
  it('convertit snake_case et camelCase', () => {
    expect(snakeToCamel('training_profile')).toBe('trainingProfile');
    expect(camelToSnake('usernameKey')).toBe('username_key');
  });

  it("convertit les clés d'une ligne", () => {
    expect(rowToCamel({ owner_id: 'u', deleted_at: null })).toEqual({ ownerId: 'u', deletedAt: null });
  });

  it('est réversible pour toutes les tables et colonnes déclarées', () => {
    for (const [t, r] of Object.entries(entityRules)) {
      for (const c of [t, ...r.columns]) expect(camelToSnake(snakeToCamel(c))).toBe(c);
    }
  });
});
