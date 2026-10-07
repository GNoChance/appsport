import type { ConsentState, ConsentStatus, ConsentType } from '@appsport/contracts';
import type { DbExecutor } from '../db/schema';

const INACTIVE: ConsentStatus = { active: false, textVersion: null, at: null };

async function latestEvent(db: DbExecutor, userId: string, type: ConsentType): Promise<ConsentStatus> {
  const row = await db
    .selectFrom('consentEvent')
    .select(['action', 'textVersion', 'createdAt'])
    .where('ownerId', '=', userId)
    .where('type', '=', type)
    .orderBy('createdAt', 'desc')
    .orderBy('rev', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!row) return { ...INACTIVE };
  return { active: row.action === 'grant', textVersion: row.textVersion, at: row.createdAt };
}

/** R-CST-1 : le dernier événement de chaque type fait foi (created_at, puis rev). */
export async function getConsentState(db: DbExecutor, userId: string): Promise<ConsentState> {
  return {
    health: await latestEvent(db, userId, 'health'),
    aiCoach: await latestEvent(db, userId, 'ai_coach'),
  };
}

export async function isHealthConsentActive(db: DbExecutor, userId: string): Promise<boolean> {
  return (await latestEvent(db, userId, 'health')).active;
}
