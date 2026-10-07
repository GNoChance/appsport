import { z } from 'zod';
import { SPORT_OTHER_LABEL_MAX, SportCodeSchema } from '../sports';
import { OnboardingStep } from './auth';

export const GOALS = ['muscle', 'strength', 'fat_loss', 'fitness', 'sport_support'] as const;
export const Goal = z.enum(GOALS);
export type Goal = z.infer<typeof Goal>;

export const EXPERIENCES = ['none', 'lt_6_months', '6_to_24_months', 'gt_24_months'] as const;
export const Experience = z.enum(EXPERIENCES);
export type Experience = z.infer<typeof Experience>;

export const GOAL_LABELS: Record<Goal, string> = {
  muscle: 'Prendre du muscle',
  strength: 'Gagner en force',
  fat_loss: 'Perdre du gras',
  fitness: 'Forme et santé',
  sport_support: 'Me renforcer pour mon sport',
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: 'Jamais',
  lt_6_months: 'Moins de 6 mois',
  '6_to_24_months': '6 mois à 2 ans',
  gt_24_months: 'Plus de 2 ans',
};

export const DAYS_PER_WEEK = [2, 3, 4] as const;
export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;

/** Strict : tout champ inconnu → 400 validation. */
export const TrainingProfilePatch = z.strictObject({
  goal: Goal.optional(),
  experience: Experience.optional(),
  daysPerWeek: z.literal(DAYS_PER_WEEK).optional(),
  sessionMinutes: z.literal(SESSION_MINUTES).optional(),
  sportCode: SportCodeSchema.nullable().optional(),
  sportOtherLabel: z.string().trim().min(1).max(SPORT_OTHER_LABEL_MAX).nullable().optional(),
  cautiousMode: z.boolean().optional(),
  onboardingStep: OnboardingStep.optional(),
});
export type TrainingProfilePatch = z.infer<typeof TrainingProfilePatch>;
