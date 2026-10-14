import { z } from 'zod';

/**
 * Coachs au choix (spec refonte §8) : L'Ombre, Le Skald, Le Scribe. Colonne `training_profile.coach`
 * (migration 0002_coach) ; choisi à la première étape de l'onboarding, exigé pour le terminer.
 */
export const COACH_IDS = ['ombre', 'skald', 'scribe'] as const;
export const CoachIdSchema = z.enum(COACH_IDS);
export type CoachId = z.infer<typeof CoachIdSchema>;
