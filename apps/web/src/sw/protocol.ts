/** Messages de la page vers le service worker. */
export type PageToSw =
  | { type: 'SKIP_WAITING' }
  | { type: 'GET_STATUS' }
  | { type: 'SYNC_ILLUSTRATIONS'; files: string[] };

/** Réponse du service worker à `GET_STATUS`, par le port du MessageChannel. */
export interface SwStatus {
  type: 'STATUS';
  buildHash: string;
  shellCached: boolean;
  /** Illustrations de la liste comptée (`illustrationsReferenced`) absentes du cache. */
  illustrationsMissing: number;
  /**
   * Illustrations distinctes de la liste que le SW compte : la dernière reçue par `SYNC_ILLUSTRATIONS`, sinon
   * celle qu'il a enregistrée. `null` : aucune liste, 0 manquante ne prouve alors rien (R-SYN-33 condition 3).
   * Absent : pas de liste suivie (bouchon de développement, sans SW).
   */
  illustrationsReferenced?: number | null;
  /** Version de la base locale attendue par le SW (manifeste, T36). */
  localDbVersion?: number;
}
