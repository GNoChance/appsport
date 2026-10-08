import type { ApiErrorCode } from '@appsport/contracts';
import { ApiError } from '../../api/client';
import { errorMessage } from '../../ui';
import { loginErrorMessage } from '../auth/messages';

/** Ce que le retrait de l'accord santé efface (R-CST-5, P-CST-3 étape 2). */
export const WITHDRAW_LIST_TEXT =
  "Seront effacés : ton indicateur de prudence (questionnaire), tes limitations et zones sensibles, et toute donnée de santé enregistrée par l'appli (douleurs, pesées, suivi nutritionnel). Le mode prudent est conservé.";

export const WITHDRAWN_TEXT = 'Accord retiré. Tes données de santé ont été effacées.';

/** Ce que la suppression du compte efface et ce qui subsiste (R-SUP-1, R-SUP-6). */
export const DELETE_LIST_TEXT =
  "Ton compte, ton profil, tes lieux, tes données de santé et l'historique de tes accords seront supprimés. Les salles restent : tu y apparaîtras comme « ancien membre ». Le journal de sécurité est gardé 12 mois et les sauvegardes 30 jours au plus.";

/** P-DRT-6 : appsport ne peut pas déclencher l'effacement chez Anthropic. */
export const ANTHROPIC_RETENTION_TEXT =
  "Si tu as utilisé le coach, appsport ne peut pas faire effacer tes échanges chez Anthropic : ils y sont effacés sous 30 jours, ou gardés jusqu'à 2 ans si ses filtres de sécurité en ont signalé un.";

const PASSWORD_ERRORS: Partial<Record<ApiErrorCode, string>> = {
  invalid_credentials: 'Mot de passe incorrect.',
  last_admin: "Tu es le dernier administrateur : nomme d'abord un autre administrateur.",
};

/**
 * Erreur d'une action confirmée par le mot de passe (P-AUT-5) : mot de passe refusé, dernier
 * administrateur, attente annoncée en minutes (`rate_limited`), sinon le message commun.
 */
export function passwordActionError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'rate_limited') return loginErrorMessage(e);
  return errorMessage(e, PASSWORD_ERRORS);
}
