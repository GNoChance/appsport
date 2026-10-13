import type { CoachId } from '@rune/contracts';
import { useLive } from '../app-services';
// Pas de réexport depuis ./index : ce module en dépend (useRepos), le réexporter ferait un cycle.
import { useRepos } from './index';
import type { TrainingProfileView } from './profile-repo';

export interface TrainingProfileState {
  /** Faux tant que le miroir n'a pas répondu : ne rien conclure de `coach` avant. */
  loaded: boolean;
  /** Profil du miroir ; null sans ligne (onboarding pas commencé). */
  profile: TrainingProfileView | null;
  /** Coach choisi ; null sans choix, ou tant que `loaded` est faux. */
  coach: CoachId | null;
}

/** Profil d'entraînement de l'utilisateur, observé dans le miroir (à jour après chaque pull). */
export function useTrainingProfile(): TrainingProfileState {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  return { loaded: profile !== undefined, profile: profile ?? null, coach: profile?.coach ?? null };
}
