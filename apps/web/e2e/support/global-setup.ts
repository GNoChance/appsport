import { mkdirSync } from 'node:fs';
import { buildTwice, buildWeb } from './builds';
import { E2E_DATA_DIR } from './server';

/**
 * Build de production dans apps/web/dist (`buildWeb` : chargeur de configuration du script `build` du
 * paquet, prénom du porteur « Alex »), puis `.e2e-data/`, où chaque serveur de test crée son dossier de
 * données, et enfin les coquilles A et B de la mise à jour du SW (`.e2e-data/builds/`).
 */
export default async function globalSetup(): Promise<void> {
  await buildWeb();
  mkdirSync(E2E_DATA_DIR, { recursive: true });
  await buildTwice();
}
