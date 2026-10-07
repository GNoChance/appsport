import { describe, expect, it } from 'vitest';
import { CivilDate } from '../src/api/auth';
import {
  ADMIN_PASSWORD_REMINDER_MONTHS,
  BOOTSTRAP_INVITATION_TTL_HOURS,
  CODE_CHECKS_PER_HOUR,
  INVITATION_NOTE_MAX,
  INVITATION_TTL_DAYS,
  LOGIN_LIMITS,
  PASSWORD_MAX,
  PASSWORD_MIN_ADMIN,
  PASSWORD_MIN_MEMBER,
  RESERVED_USERNAMES,
  RESET_TTL_HOURS,
  SECRET_CODE_LENGTH,
  SESSION_IDLE_DAYS,
  SESSION_MAX_DAYS,
  USERNAME_MAX,
  USERNAME_MIN,
} from '../src/auth-constants';

describe('auth-constants', () => {
  it('porte les valeurs de la spec', () => {
    expect([
      INVITATION_TTL_DAYS,
      BOOTSTRAP_INVITATION_TTL_HOURS,
      RESET_TTL_HOURS,
      SECRET_CODE_LENGTH,
      INVITATION_NOTE_MAX,
      USERNAME_MIN,
      USERNAME_MAX,
      PASSWORD_MIN_MEMBER,
      PASSWORD_MIN_ADMIN,
      PASSWORD_MAX,
      SESSION_IDLE_DAYS,
      SESSION_MAX_DAYS,
      ADMIN_PASSWORD_REMINDER_MONTHS,
    ]).toEqual([7, 24, 24, 16, 60, 3, 24, 12, 14, 128, 90, 365, 12]);
    expect(RESERVED_USERNAMES).toEqual(['admin', 'appsport', 'systeme']);
    expect(CODE_CHECKS_PER_HOUR).toBe(20);
    expect(LOGIN_LIMITS).toEqual({
      consecutiveThreshold: 5,
      firstDelayMs: 60_000,
      maxDelayMs: 900_000,
      hourlyMaxFailures: 10,
      lockMs: 3_600_000,
      windowMs: 3_600_000,
      ipMaxFailuresPerHour: 30,
    });
  });
});

describe('CivilDate', () => {
  it.each(['2026-10-06', '2024-02-29'])('accepte %s', (d) => {
    expect(CivilDate.safeParse(d).success).toBe(true);
  });
  it.each(['2026-02-30', '06/10/2026'])('refuse %s', (d) => {
    expect(CivilDate.safeParse(d).success).toBe(false);
  });
});
