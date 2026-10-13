import { sql } from 'kysely';
import type { Migration } from './index';

/**
 * Coach choisi (spec refonte §8) : colonne nullable de `training_profile`, les profils existants
 * restent sans coach. Valeurs figées ici comme dans 0001 (`COACH_IDS` les recoupe, test
 * enum-consistency) ; `ONBOARDING_STEPS` ne change pas, la table `user` n'est pas reconstruite.
 */
export const coach: Migration = {
  id: '0002_coach',
  breaking: false,
  up: async (db) => {
    await sql
      .raw("ALTER TABLE training_profile ADD COLUMN coach TEXT CHECK (coach IN ('ombre','skald','scribe'))")
      .execute(db);
  },
};
