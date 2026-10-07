import { randomBytes } from 'node:crypto';
import { createMonotonicUuidV7 } from '@appsport/domain';

export interface Clock {
  now(): Date;
}

export interface IdGen {
  uuidv7(): string;
  randomBytes(n: number): Uint8Array;
}

export const systemClock: Clock = { now: () => new Date() };

export function cryptoIds(): IdGen {
  const bytes = (n: number): Uint8Array => new Uint8Array(randomBytes(n));
  return { uuidv7: createMonotonicUuidV7(() => Date.now(), bytes), randomBytes: bytes };
}
