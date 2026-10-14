import type { ConnectionState } from '../../sync/engine';

/**
 * Libellés de l'état de connexion tel que le moteur de synchro l'a constaté (résultat des appels et sonde
 * `/api/health`, R-SYN-30), jamais `navigator.onLine`. Affichés par la pastille de l'en-tête (`ConnectionPill`),
 * qui lit la même source que les écrans qui répondent « Nécessite le réseau » : `useSyncState().connection`.
 */
export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  online: 'En ligne',
  offline: 'Hors ligne',
  unknown: 'Connexion…',
  unauthenticated: 'Session expirée',
  protocol_unsupported: 'Mise à jour nécessaire',
  account_deleted: 'Compte supprimé',
};

/** Ton du point de la pastille : vert en ligne, avertissement quand il faut agir, gris sinon. */
export type ConnectionTone = 'online' | 'warning' | 'muted';

export const CONNECTION_TONES: Record<ConnectionState, ConnectionTone> = {
  online: 'online',
  offline: 'muted',
  unknown: 'muted',
  unauthenticated: 'warning',
  protocol_unsupported: 'warning',
  account_deleted: 'warning',
};
