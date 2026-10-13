import type { TemplateDescriptor } from '../../src/recommend-template';

/** Six modèles factices : le vrai catalogue arrive avec la brique 2. */
export const FAKE_TEMPLATES: readonly TemplateDescriptor[] = [
  {
    id: 'gym-beginner-full-body-ab',
    context: 'gym',
    level: 'beginner',
    days: { min: 2, max: 3 },
    available: true,
  },
  {
    id: 'gym-intermediate-upper-lower',
    context: 'gym',
    level: 'intermediate',
    days: { min: 3, max: 4 },
    available: true,
  },
  {
    id: 'home-beginner-full-body',
    context: 'home',
    level: 'beginner',
    days: { min: 2, max: 3 },
    available: true,
  },
  {
    id: 'home-intermediate-upper-lower',
    context: 'home',
    level: 'intermediate',
    days: { min: 3, max: 4 },
    available: true,
  },
  {
    id: 'sport-beginner-complement',
    context: 'sport',
    level: 'beginner',
    days: { min: 2, max: 2 },
    available: true,
  },
  {
    id: 'sport-intermediate-strength-prevention',
    context: 'sport',
    level: 'intermediate',
    days: { min: 2, max: 2 },
    available: true,
  },
];

/** Copie de FAKE_TEMPLATES dont les ids donnés passent à available = false. */
export function withUnavailable(ids: readonly string[]): TemplateDescriptor[] {
  return FAKE_TEMPLATES.map((t) => ({
    ...t,
    days: { ...t.days },
    available: t.available && !ids.includes(t.id),
  }));
}
