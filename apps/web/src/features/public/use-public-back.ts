import { useMe } from '../../app-services';

/**
 * Retour des pages publiques (Aide, Confidentialité, Crédits ; maquette A05) : en session, le Profil, où
 * elles sont rangées (Compte et appli, spec refonte §5) ; sans session, la connexion. La garde de l'appli
 * mène ensuite où il faut (session perdue, onboarding).
 */
export function usePublicBack(): string {
  return useMe() ? '/profile' : '/login';
}
