import { type Experience, type Goal, ONBOARDING_STEPS, type OnboardingStep } from '@appsport/contracts';
import { describe, expect, it } from 'vitest';
import { availableGoals, firstIncompleteStep } from '../src/onboarding';

type State = Parameters<typeof firstIncompleteStep>[0];
type Row = [
  goal: Goal | null,
  experience: Experience | null,
  daysPerWeek: number | null,
  sessionMinutes: number | null,
  hasPrimaryPlace: boolean,
  lastValidatedStep: OnboardingStep | null,
  expected: OnboardingStep,
];

const state = ([
  goal,
  experience,
  daysPerWeek,
  sessionMinutes,
  hasPrimaryPlace,
  lastValidatedStep,
]: Row): State => ({
  goal,
  experience,
  daysPerWeek,
  sessionMinutes,
  hasPrimaryPlace,
  lastValidatedStep,
});

const ROWS: Row[] = [
  [null, null, null, null, false, null, 'goal'],
  ['muscle', null, null, null, false, 'goal', 'sport'],
  ['muscle', null, null, null, false, 'sport', 'place_kind'],
  ['muscle', null, null, null, false, 'place_kind', 'place_kind'],
  ['muscle', null, null, null, true, 'sport', 'experience'],
  ['muscle', 'none', null, null, true, 'experience', 'availability'],
  ['muscle', 'none', 3, null, true, 'availability', 'availability'],
  ['muscle', 'none', 3, 45, true, 'availability', 'health'],
  ['muscle', 'none', 3, 45, true, 'health', 'ready'],
  ['muscle', 'none', 3, 45, true, 'ready', 'ready'],
  ['muscle', 'none', 3, 45, true, 'goal', 'sport'],
  [null, 'none', 3, 45, true, 'health', 'goal'],
  ['muscle', 'none', 3, 45, false, 'health', 'place_kind'],
];

describe('onboarding', () => {
  it('R-ONB-2 : ordre des écrans', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'goal',
      'sport',
      'place_kind',
      'place',
      'experience',
      'availability',
      'health',
      'ready',
    ]);
  });

  it('couvre les 13 cas', () => expect(ROWS).toHaveLength(13));

  it.each(ROWS)('firstIncompleteStep(%j, %j, %j, %j, %j, %j) → %s', (...row) => {
    expect(firstIncompleteStep(state(row))).toBe(row[6]);
  });

  it('E1 : pas de perte de gras pour un mineur', () => {
    expect(availableGoals('minor')).toEqual(['muscle', 'strength', 'fitness', 'sport_support']);
    expect(availableGoals('adult')).toEqual(['muscle', 'strength', 'fat_loss', 'fitness', 'sport_support']);
  });
});
