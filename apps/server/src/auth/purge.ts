import {
  CLOSED_AUTH_RECORD_RETENTION_DAYS,
  SECURITY_EVENT_RETENTION_MONTHS,
  SESSION_IDLE_DAYS,
} from '@appsport/contracts';
import type { DailyJob } from '../jobs/scheduler';

const DAY_MS = 86_400_000;

/** Retire des mois calendaires en UTC ; le jour est ramené à la fin du mois cible si besoin. */
function subtractMonths(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  target.setUTCHours(
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
  return target;
}

const affected = (r: { numDeletedRows?: bigint; numUpdatedRows?: bigint }): number =>
  Number(r.numDeletedRows ?? r.numUpdatedRows ?? 0n);

/**
 * Purge quotidienne des enregistrements d'authentification clos (03 §7). Avec R = 30 jours :
 * sessions `account_deleted` à l'expiration ; autres sessions à min(révocation, dernière vue + 90 j,
 * expiration) + R ; invitations : date de naissance effacée à l'expiration, ligne à
 * COALESCE(usage, révocation, expiration) + R ; réinitialisations idem ; journal à 12 mois.
 * Les dates sont des ISO UTC à la milliseconde : la comparaison de chaînes est chronologique.
 */
export const authPurgeJob: DailyJob = {
  name: 'auth-purge',
  async run(deps) {
    const now = deps.clock.now();
    const nowIso = now.toISOString();
    const closedBefore = new Date(now.getTime() - CLOSED_AUTH_RECORD_RETENTION_DAYS * DAY_MS).toISOString();
    const idleBefore = new Date(
      now.getTime() - (SESSION_IDLE_DAYS + CLOSED_AUTH_RECORD_RETENTION_DAYS) * DAY_MS,
    ).toISOString();
    const eventsBefore = subtractMonths(now, SECURITY_EVENT_RETENTION_MONTHS).toISOString();

    const count = await deps.db.transaction().execute(async (trx) => {
      let total = 0;
      total += affected(
        await trx
          .deleteFrom('session')
          .where((eb) =>
            eb.or([
              eb.and([eb('revokedReason', '=', 'account_deleted'), eb('expiresAt', '<=', nowIso)]),
              eb.and([
                eb.or([eb('revokedReason', 'is', null), eb('revokedReason', '!=', 'account_deleted')]),
                eb.or([
                  eb('revokedAt', '<=', closedBefore),
                  eb('lastSeenAt', '<=', idleBefore),
                  eb('expiresAt', '<=', closedBefore),
                ]),
              ]),
            ]),
          )
          .executeTakeFirst(),
      );
      total += affected(
        await trx
          .updateTable('invitation')
          .set({ birthDate: null })
          .where('birthDate', 'is not', null)
          .where('usedAt', 'is', null)
          .where('revokedAt', 'is', null)
          .where('expiresAt', '<=', nowIso)
          .executeTakeFirst(),
      );
      total += affected(
        await trx
          .deleteFrom('invitation')
          .where((eb) => eb(eb.fn.coalesce('usedAt', 'revokedAt', 'expiresAt'), '<=', closedBefore))
          .executeTakeFirst(),
      );
      total += affected(
        await trx
          .deleteFrom('passwordReset')
          .where((eb) => eb(eb.fn.coalesce('usedAt', 'cancelledAt', 'expiresAt'), '<=', closedBefore))
          .executeTakeFirst(),
      );
      total += affected(
        await trx.deleteFrom('securityEvent').where('at', '<', eventsBefore).executeTakeFirst(),
      );
      return total;
    });
    deps.logger.info('auth purge', { job: 'auth-purge', count });
  },
};
