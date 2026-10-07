export const INVITATION_TTL_DAYS = 7;
export const BOOTSTRAP_INVITATION_TTL_HOURS = 24;
export const RESET_TTL_HOURS = 24;
export const SECRET_CODE_LENGTH = 16;
export const INVITATION_NOTE_MAX = 60;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const RESERVED_USERNAMES = ['admin', 'appsport', 'systeme'] as const;
export const PASSWORD_MIN_MEMBER = 12;
export const PASSWORD_MIN_ADMIN = 14;
export const PASSWORD_MAX = 128;
export const SESSION_IDLE_DAYS = 90;
export const SESSION_MAX_DAYS = 365;
export const ADMIN_PASSWORD_REMINDER_MONTHS = 12;
export const LOGIN_LIMITS = {
  consecutiveThreshold: 5,
  firstDelayMs: 60_000,
  maxDelayMs: 900_000,
  hourlyMaxFailures: 10,
  lockMs: 3_600_000,
  windowMs: 3_600_000,
  ipMaxFailuresPerHour: 30,
} as const;
export const CODE_CHECKS_PER_HOUR = 20;
export const CLOSED_AUTH_RECORD_RETENTION_DAYS = 30;
export const SECURITY_EVENT_RETENTION_MONTHS = 12;
export const SESSION_TOUCH_INTERVAL_MS = 3_600_000;
