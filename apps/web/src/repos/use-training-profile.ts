import type { CoachId } from '@rune/contracts';
import { useLive, useSyncState } from '../app-services';
// Pas de réexport depuis ./index : ce module en dépend (useRepos), le réexporter ferait un cycle.
import { useRepos } from './index';
import type { TrainingProfileView } from './profile-repo';

export interface TrainingProfileState {
  /** Vrai dès que le miroir a répondu ; un miroir vide ne dit rien du serveur (voir `known`). */
  loaded: boolean;
  /**
   * Vrai quand le miroir reflète le serveur : il porte le profil (seul un pull l'y écrit) ou un
   * pull a réussi pour cet utilisateur. Faux sur un nouvel appareil avant le premier pull : un
   * `coach` nul n'y veut pas dire « pas choisi » (ne pas rouvrir l'étape coach sur cette base).
   */
  known: boolean;
  /** Profil du miroir ; null sans ligne (onboarding pas commencé, ou pas encore tiré). */
  profile: TrainingProfileView | null;
  /** Coach choisi ; null sans choix, ou tant que `known` est faux. */
  coach: CoachId | null;
}

/** Profil d'entraînement de l'utilisateur, observé dans le miroir (à jour après chaque pull). */
export function useTrainingProfile(): TrainingProfileState {
  const repos = useRepos();
  const { lastPullOkAt } = useSyncState();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const loaded = profile !== undefined;
  return {
    loaded,
    known: loaded && (profile !== null || lastPullOkAt !== null),
    profile: profile ?? null,
    coach: profile?.coach ?? null,
  };
}
