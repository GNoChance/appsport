import type { AgeBand } from '@appsport/contracts';

/** R-CST-7 : la précaution déclarée ne compte qu'avec le consentement santé actif. */
export function computeCautious(i: {
  ageBand: AgeBand;
  cautiousMode: boolean;
  healthConsentActive: boolean;
  caution: boolean | null;
}): boolean {
  return i.ageBand === 'minor' || i.cautiousMode || (i.healthConsentActive && i.caution === true);
}
