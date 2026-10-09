import { mkdirSync } from 'node:fs';
import { build } from 'vite';
import { E2E_DATA_DIR, WEB_DIR } from './server';

/**
 * Build de production dans apps/web/dist, avec le chargeur de configuration du script `build` du paquet
 * (`vite build --configLoader runner`) ; prénom du porteur « Alex » (page d'invitation : « hébergé chez
 * Alex »). Puis `.e2e-data/`, où chaque serveur de test crée son dossier de données.
 */
export default async function globalSetup(): Promise<void> {
  const previous = process.env.VITE_OWNER_FIRST_NAME;
  process.env.VITE_OWNER_FIRST_NAME = 'Alex';
  try {
    await build({ root: WEB_DIR, configLoader: 'runner', logLevel: 'error' });
  } finally {
    if (previous === undefined) delete process.env.VITE_OWNER_FIRST_NAME;
    else process.env.VITE_OWNER_FIRST_NAME = previous;
  }
  mkdirSync(E2E_DATA_DIR, { recursive: true });
}
