import { describe, expect, it } from 'vitest';
import { TrainingProfilePatch } from '../src/api/profile';
import { COACH_IDS, CoachIdSchema } from '../src/coach';
import { entityRules } from '../src/entity-rules';

describe('coach (spec refonte §8)', () => {
  it('trois coachs, dans cet ordre', () => {
    expect(COACH_IDS).toEqual(['ombre', 'skald', 'scribe']);
  });

  it('CoachIdSchema refuse tout autre identifiant', () => {
    for (const id of COACH_IDS) expect(CoachIdSchema.parse(id)).toBe(id);
    for (const bad of ['berserker', 'Skald', '', null, 1])
      expect(CoachIdSchema.safeParse(bad).success).toBe(false);
  });

  it("TrainingProfilePatch accepte un coach, jamais null : un coach choisi se change, il ne s'efface pas", () => {
    for (const coach of COACH_IDS) expect(TrainingProfilePatch.parse({ coach })).toEqual({ coach });
    expect(TrainingProfilePatch.safeParse({ coach: null }).success).toBe(false);
    expect(TrainingProfilePatch.safeParse({ coach: 'berserker' }).success).toBe(false);
  });

  it("colonne C1 du profil d'entraînement, écrite par l'API seulement (classe E)", () => {
    const rule = entityRules.training_profile;
    expect(rule?.columns).toContain('coach');
    expect(rule?.category).toBe('C1');
    expect(rule?.syncClass).toBe('E');
    expect(rule?.c2Columns).not.toContain('coach');
    expect(rule?.clientWritable).toEqual([]);
  });
});
