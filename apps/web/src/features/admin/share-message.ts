import { INVITATION_TTL_DAYS } from '@appsport/contracts';

/**
 * Message de partage d'une invitation (R-INV-9) : les trois étapes de l'arrivée, puis le lien seul
 * sur la dernière ligne (les messageries le rendent cliquable). `origin` : adresse de l'appli.
 */
export function buildInvitationShareMessage(origin: string, link: string, code: string): string {
  return [
    '1. Installe Tailscale et accepte le partage.',
    `2. Ouvre ${origin} et installe l'appli.`,
    `3. Dans l'appli, colle ce lien ou tape le code ${code} (valable ${INVITATION_TTL_DAYS} jours).`,
    link,
  ].join('\n');
}
