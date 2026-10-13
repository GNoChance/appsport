import { z } from 'zod';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { withdrawHealthConsent } from './consent';
import { isHealthConsentActive } from './consent-state';
import { deleteAccount } from './delete-account';

/**
 * Forme canonique `toISOString()` (millisecondes, Z), celle de `security_event.at` : les dates se
 * comparent comme chaînes, et '…:00Z' contre '…:00.400Z' se comparerait mal ('.' < 'Z').
 */
export function canonicalInstant(iso: string): string {
  return new Date(iso).toISOString();
}

/** Liste écrite par `privacy:collect` et relue par `privacy:reapply` : identifiants, types et dates seulement. */
export const PrivacyEventList = z.object({
  since: z.iso.datetime().transform(canonicalInstant),
  collectedAt: z.iso.datetime(),
  source: z.string(),
  events: z.array(
    z.object({
      type: z.enum(['account_deleted', 'consent_revoked']),
      at: z.string(),
      targetId: z.string(),
      consentType: z.enum(['health', 'ai_coach']).optional(),
    }),
  ),
});
export type PrivacyEventList = z.infer<typeof PrivacyEventList>;
type PrivacyEvent = PrivacyEventList['events'][number];

function consentTypeOf(details: string | null): PrivacyEvent['consentType'] {
  if (details === null) return undefined;
  try {
    const value = (JSON.parse(details) as { consentType?: unknown }).consentType;
    return value === 'health' || value === 'ai_coach' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Suppressions de compte et retraits d'accord réussis après `since` (03 §8 étape 1), par date puis id. */
export async function collectPrivacyEvents(db: DbExecutor, since: string): Promise<PrivacyEvent[]> {
  const rows = await db
    .selectFrom('securityEvent')
    .select(['type', 'at', 'targetId', 'details'])
    .where('type', 'in', ['account_deleted', 'consent_revoked'])
    .where('outcome', '=', 'success')
    .where('at', '>', canonicalInstant(since))
    .where('targetId', 'is not', null)
    .orderBy('at')
    .orderBy('id')
    .execute();
  return rows.map((row) => {
    const event: PrivacyEvent = {
      type: row.type as PrivacyEvent['type'],
      at: row.at,
      targetId: row.targetId as string,
    };
    if (row.type === 'consent_revoked') {
      const consentType = consentTypeOf(row.details);
      if (consentType) event.consentType = consentType;
    }
    return event;
  });
}

/**
 * Réapplique, après restauration, les suppressions et retraits survenus depuis la sauvegarde
 * (03 §8 étapes 3-4, R-SUP-6, P-DRT-3, P-CST-3). Une transaction, dans l'ordre de la liste ;
 * idempotent. Le dernier admin peut être supprimé : la CLI signale alors l'absence d'admin.
 * `ai_coach` est ignoré : aucun accord coach n'existe avant la brique 4.
 * Un accord santé retiré puis redonné après la sauvegarde est retiré de nouveau (fail-closed, voulu).
 */
export async function reapplyPrivacyEvents(
  deps: AppDeps,
  list: PrivacyEventList,
): Promise<{ accountsDeleted: number; consentsWithdrawn: number }> {
  const actor = { actorId: null, ip: null };
  const since = canonicalInstant(list.since);
  return deps.db.transaction().execute(async (trx) => {
    let accountsDeleted = 0;
    let consentsWithdrawn = 0;
    for (const event of list.events) {
      if (event.at <= since) continue;
      const exists = await trx
        .selectFrom('user')
        .select('id')
        .where('id', '=', event.targetId)
        .executeTakeFirst();
      if (!exists) continue;
      if (event.type === 'account_deleted') {
        await deleteAccount(trx, deps, event.targetId, actor, { enforceLastAdmin: false });
        accountsDeleted += 1;
      } else if (event.consentType === 'health' && (await isHealthConsentActive(trx, event.targetId))) {
        await withdrawHealthConsent(trx, deps, event.targetId, actor);
        consentsWithdrawn += 1;
      }
    }
    return { accountsDeleted, consentsWithdrawn };
  });
}

/** Vrai si au moins un admin actif existe (sinon : lancer admin:bootstrap). */
export async function hasActiveAdmin(db: DbExecutor): Promise<boolean> {
  const admin = await db
    .selectFrom('user')
    .select('id')
    .where('role', '=', 'admin')
    .where('status', '=', 'active')
    .executeTakeFirst();
  return admin !== undefined;
}
