import { describe, expect, it } from 'vitest';
import { shouldShowUpdateBanner } from '../../src/sw/register';

// available, forced, activeSessionId, onboardingInProgress → show, dismissible
const ROWS: readonly [boolean, boolean, string | null, boolean, boolean, boolean][] = [
  [false, false, null, false, false, true],
  [false, true, null, false, false, false],
  [true, false, null, false, true, true],
  [true, true, null, false, true, false],
  [true, false, 's1', false, false, true],
  [true, true, 's1', false, false, false],
  [true, false, null, true, false, true],
  [true, true, null, true, false, false],
];

describe('shouldShowUpdateBanner (R-PWA-2, R-PWA-3, R-PWA-5)', () => {
  it.each(ROWS)(
    'available %s, forced %s, activeSessionId %s, onboarding %s → show %s, dismissible %s',
    (available, forced, activeSessionId, onboardingInProgress, show, dismissible) => {
      expect(shouldShowUpdateBanner({ available, forced, activeSessionId, onboardingInProgress })).toEqual({
        show,
        dismissible,
      });
    },
  );
});
