/** Messages de la page vers le service worker. */
export type PageToSw =
  | { type: 'SKIP_WAITING' }
  | { type: 'GET_STATUS' }
  | { type: 'SYNC_ILLUSTRATIONS'; files: string[] };
