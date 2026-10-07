import { argon2, timingSafeEqual } from 'node:crypto';
import type { Argon2Params, IdGen } from '../deps';

interface ParsedPhc {
  memoryKiB: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
}

interface DeriveParams {
  memoryKiB: number;
  passes: number;
  parallelism: number;
  tagLength: number;
}

function derive(pw: string, salt: Uint8Array, p: DeriveParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: pw.normalize('NFC'),
        nonce: salt,
        memory: p.memoryKiB,
        passes: p.passes,
        parallelism: p.parallelism,
        tagLength: p.tagLength,
      },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64').replace(/=+$/, '');

export async function hashPassword(pw: string, params: Argon2Params, ids: IdGen): Promise<string> {
  const salt = ids.randomBytes(params.saltLength);
  const hash = await derive(pw, salt, params);
  return `$argon2id$v=19$m=${params.memoryKiB},t=${params.passes},p=${params.parallelism}$${b64(salt)}$${b64(hash)}`;
}

function parsePhc(phc: string): ParsedPhc | null {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(phc);
  if (!m) return null;
  return {
    memoryKiB: Number(m[1]),
    passes: Number(m[2]),
    parallelism: Number(m[3]),
    salt: Buffer.from(m[4] as string, 'base64'),
    hash: Buffer.from(m[5] as string, 'base64'),
  };
}

export async function verifyPassword(pw: string, phc: string): Promise<boolean> {
  try {
    const parsed = parsePhc(phc);
    if (!parsed) return false;
    const actual = await derive(pw, parsed.salt, { ...parsed, tagLength: parsed.hash.length });
    return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash);
  } catch {
    return false;
  }
}

export function needsRehash(phc: string, params: Argon2Params): boolean {
  const p = parsePhc(phc);
  if (!p) return true;
  return (
    p.memoryKiB < params.memoryKiB ||
    p.passes < params.passes ||
    p.parallelism !== params.parallelism ||
    p.salt.length < params.saltLength
  );
}
