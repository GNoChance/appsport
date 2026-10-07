import { CODE_CHECKS_PER_HOUR, LOGIN_LIMITS } from '@appsport/contracts';
import type { AppDeps, Clock } from '../deps';

type Verdict = { allowed: true } | { allowed: false; retryAfterS: number };

export interface LoginLimiter {
  check(usernameKey: string, ip: string | null): Verdict;
  recordFailure(usernameKey: string, ip: string | null): void;
  recordSuccess(usernameKey: string): void;
  unlock(usernameKey: string): void;
}

export interface IpLimiter {
  hit(ip: string | null): { allowed: boolean; retryAfterS: number };
}

interface UserState {
  consecutive: number;
  lastFailureAt: number;
  failures: number[];
  lockedUntil: number;
}

/** Une IP inconnue partage un seul seau : elle ne contourne pas les limites par IP. */
const UNKNOWN_IP = 'unknown';
const ipKey = (ip: string | null): string => ip ?? UNKNOWN_IP;

const seconds = (ms: number): number => Math.ceil(ms / 1000);

/** Limiteur en mémoire (R-AUTH-2, R-AUTH-3) : repart de zéro au redémarrage. */
export function createLoginLimiter(clock: Clock): LoginLimiter {
  const L = LOGIN_LIMITS;
  const users = new Map<string, UserState>();
  const ips = new Map<string, number[]>();
  const recent = (times: number[], now: number): number[] => times.filter((t) => now - t < L.windowMs);

  return {
    check(usernameKey, ip) {
      const now = clock.now().getTime();
      const waits = [0];
      const state = users.get(usernameKey);
      if (state) {
        if (state.lockedUntil > now) waits.push(state.lockedUntil - now);
        if (state.consecutive >= L.consecutiveThreshold) {
          const delay = Math.min(
            L.firstDelayMs * 2 ** (state.consecutive - L.consecutiveThreshold),
            L.maxDelayMs,
          );
          waits.push(state.lastFailureAt + delay - now);
        }
      }
      const ipFailures = recent(ips.get(ipKey(ip)) ?? [], now);
      const oldest = ipFailures[0];
      if (ipFailures.length >= L.ipMaxFailuresPerHour && oldest !== undefined) {
        waits.push(oldest + L.windowMs - now);
      }
      const wait = Math.max(...waits);
      return wait > 0 ? { allowed: false, retryAfterS: seconds(wait) } : { allowed: true };
    },
    recordFailure(usernameKey, ip) {
      const now = clock.now().getTime();
      const state = users.get(usernameKey) ?? {
        consecutive: 0,
        lastFailureAt: 0,
        failures: [],
        lockedUntil: 0,
      };
      state.consecutive += 1;
      state.lastFailureAt = now;
      state.failures = [...recent(state.failures, now), now];
      if (state.failures.length >= L.hourlyMaxFailures) state.lockedUntil = now + L.lockMs;
      users.set(usernameKey, state);
      const bucket = ipKey(ip);
      ips.set(bucket, [...recent(ips.get(bucket) ?? [], now), now]);
    },
    recordSuccess(usernameKey) {
      const state = users.get(usernameKey);
      if (state) state.consecutive = 0;
    },
    unlock(usernameKey) {
      users.delete(usernameKey);
    },
  };
}

/** Compte seulement les essais acceptés ; un essai refusé ne prolonge pas le blocage. */
export function createIpLimiter(clock: Clock, opts: { limit: number; windowMs: number }): IpLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(ip) {
      const bucket = ipKey(ip);
      const now = clock.now().getTime();
      const inWindow = (hits.get(bucket) ?? []).filter((t) => now - t < opts.windowMs);
      const oldest = inWindow[0];
      if (inWindow.length >= opts.limit && oldest !== undefined) {
        hits.set(bucket, inWindow);
        return { allowed: false, retryAfterS: seconds(oldest + opts.windowMs - now) };
      }
      hits.set(bucket, [...inWindow, now]);
      return { allowed: true, retryAfterS: 0 };
    },
  };
}

export interface AuthLimiters {
  login: LoginLimiter;
  invitationCheck: IpLimiter;
  resetCheck: IpLimiter;
}

const instances = new WeakMap<AppDeps, AuthLimiters>();

export function authLimiters(deps: AppDeps): AuthLimiters {
  let limiters = instances.get(deps);
  if (!limiters) {
    const codes = { limit: CODE_CHECKS_PER_HOUR, windowMs: LOGIN_LIMITS.windowMs };
    limiters = {
      login: createLoginLimiter(deps.clock),
      invitationCheck: createIpLimiter(deps.clock, codes),
      resetCheck: createIpLimiter(deps.clock, codes),
    };
    instances.set(deps, limiters);
  }
  return limiters;
}
