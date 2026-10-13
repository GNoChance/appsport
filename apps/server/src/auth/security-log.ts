import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';

export type SecurityEventType =
  | 'login_succeeded'
  | 'login_failed'
  | 'login_blocked'
  | 'logout'
  | 'logout_all'
  | 'password_changed'
  | 'password_reset_created'
  | 'password_reset_used'
  | 'invitation_created'
  | 'invitation_revoked'
  | 'invitation_used'
  | 'role_changed'
  | 'status_changed'
  | 'sessions_revoked'
  | 'birth_date_corrected'
  | 'username_changed'
  | 'consent_granted'
  | 'consent_revoked'
  | 'data_exported'
  | 'account_deleted'
  | 'gym_deleted';

export type SecurityDetails = { [key: string]: string | number | boolean };

/**
 * Clés jamais écrites dans le journal : retirées à l'exécution (P-LOG-1).
 * Volontairement large : retire aussi des clés inoffensives (equipmentCode, par exemple).
 */
export const FORBIDDEN_DETAIL_KEY = /password|code|token|secret|hash|cookie/i;

export interface SecurityEventInput {
  type: SecurityEventType;
  actorId: string | null;
  targetId: string | null;
  ip: string | null;
  outcome: 'success' | 'failure' | 'blocked';
  details?: SecurityDetails;
}

export async function logSecurityEvent(
  trx: DbExecutor,
  deps: AppDeps,
  ev: SecurityEventInput,
): Promise<void> {
  let details: string | null = null;
  if (ev.details) {
    const kept: SecurityDetails = {};
    let dropped = 0;
    for (const [key, value] of Object.entries(ev.details)) {
      if (FORBIDDEN_DETAIL_KEY.test(key)) dropped += 1;
      else kept[key] = value;
    }
    if (dropped > 0) deps.logger.warn('security details dropped', { event: ev.type, count: dropped });
    if (Object.keys(kept).length > 0) details = JSON.stringify(kept);
  }
  await trx
    .insertInto('securityEvent')
    .values({
      id: deps.ids.uuidv7(),
      at: deps.clock.now().toISOString(),
      type: ev.type,
      actorId: ev.actorId,
      targetId: ev.targetId,
      tailnetIp: ev.ip,
      outcome: ev.outcome,
      details,
    })
    .execute();
}
