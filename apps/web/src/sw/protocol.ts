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
  illustrationsMissing: number;
  /** Version de la base locale attendue par le SW (manifeste, T36). */
  localDbVersion?: number;
}
