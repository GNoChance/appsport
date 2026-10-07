import type { ApiErrorCode } from '@appsport/contracts';
import { ApiError, NetworkRequiredError } from '../api/client';

/** Message affiché pour chaque code d'erreur de l'API ; un écran peut en préciser certains. */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  validation: 'Certaines valeurs ne sont pas valides.',
  unauthenticated: 'Ta session a expiré. Reconnecte-toi.',
  invalid_credentials: 'Pseudo ou mot de passe incorrect',
  forbidden: "Cette action n'est pas autorisée.",
  origin_mismatch: "Requête refusée : recharge l'appli.",
  unsupported_media_type: "Requête refusée : recharge l'appli.",
  account_disabled: "Compte désactivé, contacte l'administrateur",
  password_change_required: "Change d'abord ton mot de passe.",
  health_consent_required: 'Cette action demande ton accord santé.',
  reset_self_forbidden: 'Tu ne peux pas réinitialiser ton propre mot de passe ici.',
  not_found: 'Élément introuvable.',
  conflict: "L'élément a changé entre-temps. Recharge et réessaie.",
  username_taken: 'Ce pseudo est déjà pris.',
  last_admin: 'Il doit rester au moins un administrateur actif.',
  gym_duplicate: 'Cette salle existe déjà.',
  gym_in_use: 'Cette salle est encore utilisée.',
  place_exists: 'Ce lieu existe déjà.',
  last_place: 'Il te faut au moins un lieu.',
  primary_required: 'Choisis un lieu principal.',
  onboarding_incomplete: "Termine d'abord ta prise en main.",
  password_rejected: 'Ce mot de passe ne convient pas.',
  username_invalid: "Ce pseudo n'est pas valide.",
  under_min_age: 'appsport est réservé aux 16 ans et plus',
  invitation_expired: 'Cette invitation a expiré.',
  invitation_used: 'Cette invitation a déjà servi.',
  invitation_revoked: 'Cette invitation a été révoquée.',
  invitation_unknown: 'Invitation introuvable. Vérifie le lien ou le code.',
  reset_invalid: "Ce lien de réinitialisation n'est plus valable.",
  account_deleted: 'Ce compte a été supprimé',
  watermark_expired: 'Synchronisation à reprendre.',
  protocol_unsupported: "Mets à jour l'appli pour continuer.",
  rate_limited: "Trop d'essais. Réessaie plus tard.",
  internal: 'Le serveur a rencontré une erreur.',
};

export const NETWORK_REQUIRED_MESSAGE = 'Nécessite le réseau';
export const UNEXPECTED_ERROR_MESSAGE = 'Une erreur inattendue est survenue.';

export function errorMessage(e: unknown, overrides: Partial<Record<ApiErrorCode, string>> = {}): string {
  if (e instanceof NetworkRequiredError) return NETWORK_REQUIRED_MESSAGE;
  if (e instanceof ApiError) return overrides[e.code] ?? ERROR_MESSAGES[e.code];
  return UNEXPECTED_ERROR_MESSAGE;
}
