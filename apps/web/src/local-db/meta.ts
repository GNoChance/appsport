import type { AgeBand, MeResponse } from '@appsport/contracts';
import type { AppDb } from './db';

export interface MetaValues {
  deviceId: string;
  userId: string;
  watermark: string;
  serverEpoch: string;
  protocol: number;
  catalogVersion: string;
  serverCatalogVersion: string;
  activeSessionId: string | null;
  lastPullOkAt: string;
  persistGranted: boolean;
  me: MeResponse;
  /** Tranche d'âge vue en dernier sur l'appareil : message des 18 ans, une fois (R-AGE-6). */
  lastAgeBand: AgeBand;
}

/** Clés liées à l'utilisateur connecté, effacées par `wipeUserData`. */
export const USER_META_KEYS: readonly (keyof MetaValues)[] = [
  'userId',
  'watermark',
  'serverEpoch',
  'lastPullOkAt',
  'activeSessionId',
  'me',
  'lastAgeBand',
];

export async function getMeta<K extends keyof MetaValues>(
  db: AppDb,
  k: K,
): Promise<MetaValues[K] | undefined> {
  const entry = await db.meta.get(k);
  return entry?.value as MetaValues[K] | undefined;
}

export async function setMeta<K extends keyof MetaValues>(db: AppDb, k: K, v: MetaValues[K]): Promise<void> {
  await db.meta.put({ key: k, value: v });
}

export async function deleteMeta(db: AppDb, k: keyof MetaValues): Promise<void> {
  await db.meta.delete(k);
}
