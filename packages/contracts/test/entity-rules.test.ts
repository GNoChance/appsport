import { describe, expect, it } from 'vitest';
import { entityRules, mirroredTables, SYNC_COLUMNS } from '../src/entity-rules';

const EXPECTED: Record<string, string> = {
  applied_op: 'C0/H/user_id/false/cascade',
  consent_event: 'C1/E/owner_id/true/cascade',
  gym: 'C0/E//false/set_null',
  gym_equipment: 'C0/E//false/set_null',
  gym_history: 'C0/H//false/set_null',
  health_screening: 'C2/E/owner_id/true/cascade',
  home_equipment: 'C1/E/owner_id/true/cascade',
  invitation: 'C0/H//false/set_null',
  limitation: 'C2/E/owner_id/true/cascade',
  password_reset: 'C0/H/user_id/false/cascade',
  place: 'C1/E/owner_id/true/cascade',
  schema_migrations: 'C0/H//false/not_linked',
  security_event: 'C0/H//false/keep',
  server_meta: 'C0/H//false/not_linked',
  session: 'C1/H/user_id/false/anonymize',
  sync_rejection: 'C1/J/owner_id/true/cascade',
  training_profile: 'C1/E/owner_id/true/cascade',
  user: 'C0/E/id/true/cascade',
};

const ruleOf = (t: string) => {
  const r = entityRules[t];
  if (!r) throw new Error(t);
  return r;
};

const pick = (t: string) => {
  const r = ruleOf(t);
  return [r.category, r.syncClass, r.ownerColumn ?? '', r.exported, r.onUserDelete].join('/');
};

describe('entityRules', () => {
  it('déclare les 18 tables du socle avec leurs valeurs', () => {
    expect(Object.keys(entityRules).sort()).toEqual(Object.keys(EXPECTED));
    for (const t of Object.keys(EXPECTED)) expect(pick(t)).toBe(EXPECTED[t]);
  });

  it('porte les colonnes écrivables par le client et les secrets', () => {
    expect(ruleOf('sync_rejection').clientWritable).toEqual(['dismissed_at']);
    expect(ruleOf('user').secretColumns).toEqual(['password_hash']);
  });

  it('liste les tables miroir en ordre alphabétique', () => {
    expect(mirroredTables()).toEqual([
      'consent_event',
      'gym',
      'gym_equipment',
      'health_screening',
      'home_equipment',
      'limitation',
      'place',
      'sync_rejection',
      'training_profile',
      'user',
    ]);
  });

  describe('invariants', () => {
    const all = Object.entries(entityRules);

    it('clientWritable est vide hors classe J', () => {
      for (const [, r] of all) if (r.syncClass !== 'J') expect(r.clientWritable).toEqual([]);
    });

    it('clientWritable, c2Columns, secretColumns et ownerColumn sont des colonnes déclarées', () => {
      for (const [, r] of all) {
        for (const c of [...r.clientWritable, ...r.c2Columns, ...r.secretColumns])
          expect(r.columns).toContain(c);
        if (r.ownerColumn) expect(r.columns).toContain(r.ownerColumn);
      }
    });

    it('les tables à owner_id portent les colonnes de synchro (consent_event sans deleted_at)', () => {
      for (const [t, r] of all) {
        if (r.ownerColumn !== 'owner_id') continue;
        const expected =
          t === 'consent_event' ? SYNC_COLUMNS.filter((c) => c !== 'deleted_at') : SYNC_COLUMNS;
        for (const c of expected) expect(r.columns, t).toContain(c);
      }
    });

    it('les tables J, D et E portent rev', () => {
      for (const [, r] of all) if (['J', 'D', 'E'].includes(r.syncClass)) expect(r.columns).toContain('rev');
    });

    it("les points d'extension, quand ils existent, sont cohérents", () => {
      for (const [, r] of all) {
        if (r.parent) {
          expect(Object.keys(entityRules)).toContain(r.parent.entity);
          expect(r.columns).toContain(r.parent.column);
        }
        for (const c of Object.keys(r.c2Values ?? {})) {
          expect(r.columns).toContain(c);
          expect(r.c2Columns).not.toContain(c);
        }
      }
    });

    it("aucune table du socle n'a de parent ni de c2Values", () => {
      for (const [, r] of all) {
        expect(r.parent).toBeUndefined();
        expect(r.c2Values).toBeUndefined();
      }
    });
  });
});
