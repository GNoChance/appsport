import { z } from 'zod';

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
