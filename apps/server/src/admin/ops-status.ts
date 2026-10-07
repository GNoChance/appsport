import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OpsStatus } from '@appsport/contracts';

/** Contenu validé de `<dataDir>/ops/status.json` ; null si le fichier est absent, illisible ou invalide. */
export async function readOpsStatus(dataDir: string): Promise<OpsStatus | null> {
  let raw: string;
  try {
    raw = await readFile(join(dataDir, 'ops', 'status.json'), 'utf8');
  } catch {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = OpsStatus.safeParse(json);
  return parsed.success ? parsed.data : null;
}
