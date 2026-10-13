import Dexie from 'dexie';
import type { AppDb } from './db';

/** Accord santé actif d'après le miroir : dernier événement `health` (index `[type+createdAt]`) = grant. */
export async function localHealthConsentActive(db: AppDb): Promise<boolean> {
  const last = await db
    .mirror('consent_event')
    .where('[type+createdAt]')
    .between(['health', Dexie.minKey], ['health', Dexie.maxKey])
    .last();
  return last?.action === 'grant';
}
