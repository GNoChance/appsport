import type { AgeBand } from '@appsport/contracts';
import { describe, expect, it } from 'vitest';
import { computeCautious } from '../src/cautious';

interface Case {
  ageBand: AgeBand;
  cautiousMode: boolean;
  healthConsentActive: boolean;
  caution: boolean | null;
}

const cases: Case[] = [];
for (const ageBand of ['minor', 'adult'] as const) {
  for (const cautiousMode of [false, true]) {
    for (const healthConsentActive of [false, true]) {
      for (const caution of [true, false, null]) {
        cases.push({ ageBand, cautiousMode, healthConsentActive, caution });
      }
    }
  }
}

describe('computeCautious', () => {
  it('couvre les 24 cas', () => expect(cases).toHaveLength(24));

  it.each(cases)('%j', (c) => {
    expect(computeCautious(c)).toBe(
      c.ageBand === 'minor' || c.cautiousMode || (c.healthConsentActive && c.caution === true),
    );
  });

  it('R-CST-7 : sans consentement santé, la précaution déclarée est ignorée', () => {
    expect(
      computeCautious({ ageBand: 'adult', cautiousMode: false, healthConsentActive: false, caution: true }),
    ).toBe(false);
    expect(
      computeCautious({ ageBand: 'minor', cautiousMode: false, healthConsentActive: false, caution: null }),
    ).toBe(true);
  });
});
