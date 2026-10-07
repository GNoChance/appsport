import {
  type AgeBand,
  type Experience,
  GOALS,
  type Goal,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '@appsport/contracts';

/** E1 : pas d'objectif de perte de gras pour un mineur. */
export function availableGoals(ageBand: AgeBand): Goal[] {
  return GOALS.filter((g) => ageBand === 'adult' || g !== 'fat_loss');
}

/** R-ONB-2 : écran de reprise de l'onboarding. */
export function firstIncompleteStep(s: {
  goal: Goal | null;
  experience: Experience | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  hasPrimaryPlace: boolean;
  lastValidatedStep: OnboardingStep | null;
}): OnboardingStep {
  const last = s.lastValidatedStep === null ? -1 : ONBOARDING_STEPS.indexOf(s.lastValidatedStep);
  const validated = (step: OnboardingStep) => last >= ONBOARDING_STEPS.indexOf(step);
  if (s.goal === null) return 'goal';
  if (!validated('sport')) return 'sport';
  if (!s.hasPrimaryPlace) return 'place_kind';
  if (s.experience === null) return 'experience';
  if (s.daysPerWeek === null || s.sessionMinutes === null) return 'availability';
  if (!validated('health')) return 'health';
  return 'ready';
}
