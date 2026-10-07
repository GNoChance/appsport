import type { Experience, Goal } from '@appsport/contracts';

export type TemplateContext = 'gym' | 'home' | 'sport';
export type TrainingLevel = 'beginner' | 'intermediate';

export interface TemplateDescriptor {
  id: string;
  context: TemplateContext;
  level: TrainingLevel;
  days: { min: number; max: number };
  available: boolean;
}

export interface RecommendInput {
  goal: Goal;
  sportCode: string | null;
  primaryPlaceKind: 'gym' | 'home';
  experience: Experience;
  daysPerWeek: 2 | 3 | 4;
}

export type RecommendReason = 'FEW_DAYS_FULL_BODY' | 'NO_TEMPLATE_AVAILABLE' | 'DAYS_ADJUSTED';

export interface Recommendation {
  templateId: string | null;
  context: TemplateContext;
  level: TrainingLevel;
  daysPerWeek: number;
  reasons: RecommendReason[];
}

/** R-REC-2 */
export function levelFromExperience(e: Experience): TrainingLevel {
  return e === 'none' || e === 'lt_6_months' ? 'beginner' : 'intermediate';
}

const OTHER_LEVEL: Record<TrainingLevel, TrainingLevel> = {
  beginner: 'intermediate',
  intermediate: 'beginner',
};

/** R-REC-1 à R-REC-6 : ni âge ni prudence en entrée. */
export function recommendTemplate(
  input: RecommendInput,
  templates: readonly TemplateDescriptor[],
): Recommendation {
  const context: TemplateContext =
    input.goal === 'sport_support' && input.sportCode?.trim() ? 'sport' : input.primaryPlaceKind;
  const reasons: RecommendReason[] = [];

  let level = levelFromExperience(input.experience);
  const intermediate = templates.find((t) => t.context === context && t.level === 'intermediate');
  if (level === 'intermediate' && intermediate && input.daysPerWeek < intermediate.days.min) {
    level = 'beginner';
    reasons.push('FEW_DAYS_FULL_BODY');
  }

  const pick = (l: TrainingLevel) =>
    templates.find((t) => t.context === context && t.level === l && t.available);
  const template = pick(level) ?? pick(OTHER_LEVEL[level]);
  if (!template) {
    return {
      templateId: null,
      context,
      level: levelFromExperience(input.experience),
      daysPerWeek: input.daysPerWeek,
      reasons: [...reasons, 'NO_TEMPLATE_AVAILABLE'],
    };
  }

  const daysPerWeek = Math.min(Math.max(input.daysPerWeek, template.days.min), template.days.max);
  if (daysPerWeek !== input.daysPerWeek) reasons.push('DAYS_ADJUSTED');
  return { templateId: template.id, context, level: template.level, daysPerWeek, reasons };
}
