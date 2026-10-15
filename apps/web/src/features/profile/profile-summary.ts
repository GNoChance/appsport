import { EXPERIENCE_LABELS, GOAL_LABELS, SPORTS } from '@rune/contracts';
import type { TrainingProfileView } from '../../repos';
import { plural } from '../../ui';

export const NOT_SET = 'Non renseigné';

/** Réponse de l'onboarding que Mon profil modifie depuis une ligne (R-ONB-3). */
export type TrainingAnswer = 'goal' | 'sport' | 'experience' | 'availability';

function sportLabel(profile: TrainingProfileView): string {
  if (profile.sportCode === null) return 'Aucun';
  if (profile.sportCode === 'other') return profile.sportOtherLabel ?? NOT_SET;
  return SPORTS.find((s) => s.code === profile.sportCode)?.label ?? NOT_SET;
}

/** « 3 séances de 45 min », ou null tant que la disponibilité n'est pas répondue. */
function availabilityLabel(profile: TrainingProfileView): string | null {
  return profile.daysPerWeek && profile.sessionMinutes
    ? `${profile.daysPerWeek} ${plural(profile.daysPerWeek, 'séance', 'séances')} de ${profile.sessionMinutes} min`
    : null;
}

/** Valeur affichée d'une réponse : « Non renseigné » tant qu'elle manque (« Aucun » pour le sport). */
export function answerValue(key: TrainingAnswer, profile: TrainingProfileView | null): string {
  if (!profile) return key === 'sport' ? 'Aucun' : NOT_SET;
  switch (key) {
    case 'goal':
      return profile.goal ? GOAL_LABELS[profile.goal] : NOT_SET;
    case 'sport':
      return sportLabel(profile);
    case 'experience':
      return profile.experience ? EXPERIENCE_LABELS[profile.experience] : NOT_SET;
    case 'availability':
      return availabilityLabel(profile) ?? NOT_SET;
  }
}

/**
 * Résumé du profil sur la ligne « Mon profil » du hub : objectif et disponibilité répondus
 * (« Prendre du muscle · 3 séances de 60 min ») ; rien tant qu'aucun des deux ne l'est.
 */
export function profileSummary(profile: TrainingProfileView | null): string | undefined {
  if (!profile) return undefined;
  const parts = [profile.goal ? GOAL_LABELS[profile.goal] : null, availabilityLabel(profile)];
  const known = parts.filter((p): p is string => p !== null);
  return known.length > 0 ? known.join(' · ') : undefined;
}
