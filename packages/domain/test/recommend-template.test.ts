import { EXPERIENCES, type Experience, GOALS, type Goal } from '@appsport/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  levelFromExperience,
  type Recommendation,
  type RecommendInput,
  type RecommendReason,
  recommendTemplate,
  type TemplateContext,
  type TrainingLevel,
} from '../src/recommend-template';
import { FAKE_TEMPLATES, withUnavailable } from './fixtures/templates';

type Days = 2 | 3 | 4;
type Expected = [templateId: string, level: TrainingLevel, daysPerWeek: number, reasons: RecommendReason[]];

/** Oracle écrit à la main pour les 6 modèles factices, tous disponibles. */
const ORACLE: Record<TemplateContext, Record<TrainingLevel, Record<Days, Expected>>> = {
  gym: {
    beginner: {
      2: ['gym-beginner-full-body-ab', 'beginner', 2, []],
      3: ['gym-beginner-full-body-ab', 'beginner', 3, []],
      4: ['gym-beginner-full-body-ab', 'beginner', 3, ['DAYS_ADJUSTED']],
    },
    intermediate: {
      2: ['gym-beginner-full-body-ab', 'beginner', 2, ['FEW_DAYS_FULL_BODY']],
      3: ['gym-intermediate-upper-lower', 'intermediate', 3, []],
      4: ['gym-intermediate-upper-lower', 'intermediate', 4, []],
    },
  },
  home: {
    beginner: {
      2: ['home-beginner-full-body', 'beginner', 2, []],
      3: ['home-beginner-full-body', 'beginner', 3, []],
      4: ['home-beginner-full-body', 'beginner', 3, ['DAYS_ADJUSTED']],
    },
    intermediate: {
      2: ['home-beginner-full-body', 'beginner', 2, ['FEW_DAYS_FULL_BODY']],
      3: ['home-intermediate-upper-lower', 'intermediate', 3, []],
      4: ['home-intermediate-upper-lower', 'intermediate', 4, []],
    },
  },
  sport: {
    beginner: {
      2: ['sport-beginner-complement', 'beginner', 2, []],
      3: ['sport-beginner-complement', 'beginner', 2, ['DAYS_ADJUSTED']],
      4: ['sport-beginner-complement', 'beginner', 2, ['DAYS_ADJUSTED']],
    },
    intermediate: {
      2: ['sport-intermediate-strength-prevention', 'intermediate', 2, []],
      3: ['sport-intermediate-strength-prevention', 'intermediate', 2, ['DAYS_ADJUSTED']],
      4: ['sport-intermediate-strength-prevention', 'intermediate', 2, ['DAYS_ADJUSTED']],
    },
  },
};

const EXPERIENCE_LEVEL: Record<Experience, TrainingLevel> = {
  none: 'beginner',
  lt_6_months: 'beginner',
  '6_to_24_months': 'intermediate',
  gt_24_months: 'intermediate',
};

const cases: RecommendInput[] = [];
for (const goal of GOALS) {
  for (const sportCode of [null, 'football']) {
    for (const primaryPlaceKind of ['gym', 'home'] as const) {
      for (const experience of EXPERIENCES) {
        for (const daysPerWeek of [2, 3, 4] as const) {
          cases.push({ goal, sportCode, primaryPlaceKind, experience, daysPerWeek });
        }
      }
    }
  }
}

describe('recommendTemplate', () => {
  it('couvre les 240 cas', () => expect(cases).toHaveLength(240));

  it.each(cases)('%j', (input) => {
    const context: TemplateContext =
      input.goal === 'sport_support' && input.sportCode ? 'sport' : input.primaryPlaceKind;
    const [templateId, level, daysPerWeek, reasons] =
      ORACLE[context][EXPERIENCE_LEVEL[input.experience]][input.daysPerWeek];
    expect(recommendTemplate(input, FAKE_TEMPLATES)).toEqual({
      templateId,
      context,
      level,
      daysPerWeek,
      reasons,
    });
  });

  it('R-REC-2 : niveau tiré de l’expérience', () => {
    expect(EXPERIENCES.map(levelFromExperience)).toEqual([
      'beginner',
      'beginner',
      'intermediate',
      'intermediate',
    ]);
  });

  it.each([null, '', '   '])('R-REC-1 : sport_support avec sportCode %j → contexte du lieu', (sportCode) => {
    const home = recommendTemplate(
      { goal: 'sport_support', sportCode, primaryPlaceKind: 'home', experience: 'none', daysPerWeek: 3 },
      FAKE_TEMPLATES,
    );
    expect(home).toEqual({
      templateId: 'home-beginner-full-body',
      context: 'home',
      level: 'beginner',
      daysPerWeek: 3,
      reasons: [],
    });
  });

  const base: RecommendInput = {
    goal: 'muscle',
    sportCode: null,
    primaryPlaceKind: 'gym',
    experience: 'gt_24_months',
    daysPerWeek: 2,
  };

  it('R-REC-3 : intermédiaire avec trop peu de jours → full body débutant', () => {
    expect(recommendTemplate(base, FAKE_TEMPLATES)).toEqual({
      templateId: 'gym-beginner-full-body-ab',
      context: 'gym',
      level: 'beginner',
      daysPerWeek: 2,
      reasons: ['FEW_DAYS_FULL_BODY'],
    });
  });

  it('R-REC-4 : modèle indisponible → celui de l’autre niveau', () => {
    expect(
      recommendTemplate({ ...base, daysPerWeek: 4 }, withUnavailable(['gym-intermediate-upper-lower'])),
    ).toEqual({
      templateId: 'gym-beginner-full-body-ab',
      context: 'gym',
      level: 'beginner',
      daysPerWeek: 3,
      reasons: ['DAYS_ADJUSTED'],
    });
    expect(recommendTemplate(base, withUnavailable(['gym-beginner-full-body-ab']))).toEqual({
      templateId: 'gym-intermediate-upper-lower',
      context: 'gym',
      level: 'intermediate',
      daysPerWeek: 3,
      reasons: ['FEW_DAYS_FULL_BODY', 'DAYS_ADJUSTED'],
    });
  });

  it('R-REC-4 : aucun modèle du contexte → null et NO_TEMPLATE_AVAILABLE', () => {
    expect(
      recommendTemplate(
        { ...base, daysPerWeek: 4 },
        withUnavailable(['gym-beginner-full-body-ab', 'gym-intermediate-upper-lower']),
      ),
    ).toEqual({
      templateId: null,
      context: 'gym',
      level: 'intermediate',
      daysPerWeek: 4,
      reasons: ['NO_TEMPLATE_AVAILABLE'],
    });
  });

  it('withUnavailable ne modifie pas FAKE_TEMPLATES', () => {
    withUnavailable(FAKE_TEMPLATES.map((t) => t.id));
    expect(FAKE_TEMPLATES.every((t) => t.available)).toBe(true);
  });

  describe('propriétés', () => {
    const arbInput = fc.record({
      goal: fc.constantFrom<Goal>(...GOALS),
      sportCode: fc.option(fc.oneof(fc.constantFrom('football', '', '   ', ' tennis '), fc.string()), {
        nil: null,
      }),
      primaryPlaceKind: fc.constantFrom<'gym' | 'home'>('gym', 'home'),
      experience: fc.constantFrom<Experience>(...EXPERIENCES),
      daysPerWeek: fc.constantFrom<Days>(2, 3, 4),
    });
    const arbUnavailable = fc.subarray(FAKE_TEMPLATES.map((t) => t.id));

    it('R-REC-5 : jours bornés par un modèle disponible du bon contexte, ou null + NO_TEMPLATE_AVAILABLE', () => {
      fc.assert(
        fc.property(arbInput, arbUnavailable, (input, ids) => {
          const templates = withUnavailable(ids);
          const r: Recommendation = recommendTemplate(input, templates);
          if (r.templateId === null) {
            expect(r.reasons).toContain('NO_TEMPLATE_AVAILABLE');
            expect(r.daysPerWeek).toBe(input.daysPerWeek);
            expect(templates.some((t) => t.context === r.context && t.available)).toBe(false);
            return;
          }
          const t = templates.find((d) => d.id === r.templateId);
          expect(t?.available).toBe(true);
          expect(t?.context).toBe(r.context);
          expect(t?.level).toBe(r.level);
          expect(r.daysPerWeek).toBeGreaterThanOrEqual(t?.days.min ?? Number.NaN);
          expect(r.daysPerWeek).toBeLessThanOrEqual(t?.days.max ?? Number.NaN);
          expect(r.reasons.includes('DAYS_ADJUSTED')).toBe(r.daysPerWeek !== input.daysPerWeek);
        }),
      );
    });

    it('R-REC-1 : contexte sport ⇔ sport_support et sportCode non vide', () => {
      fc.assert(
        fc.property(arbInput, arbUnavailable, (input, ids) => {
          const r = recommendTemplate(input, withUnavailable(ids));
          const sport = input.goal === 'sport_support' && (input.sportCode ?? '').trim() !== '';
          expect(r.context === 'sport').toBe(sport);
          if (!sport) expect(r.context).toBe(input.primaryPlaceKind);
        }),
      );
    });

    it('résultat déterministe', () => {
      fc.assert(
        fc.property(arbInput, arbUnavailable, (input, ids) => {
          expect(recommendTemplate(input, withUnavailable(ids))).toEqual(
            recommendTemplate({ ...input }, withUnavailable(ids)),
          );
        }),
      );
    });
  });
});
