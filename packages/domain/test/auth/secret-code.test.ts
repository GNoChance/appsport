import { describe, expect, it } from 'vitest';
import { encodeCrockford, formatSecretCode, parseSecretCode } from '../../src/auth/secret-code';

describe('encodeCrockford', () => {
  it('encode 10 octets en 16 caractères', () => {
    expect(encodeCrockford(new Uint8Array(10))).toBe('0000000000000000');
    expect(encodeCrockford(new Uint8Array(10).fill(255))).toBe('ZZZZZZZZZZZZZZZZ');
    expect(encodeCrockford(Uint8Array.of(8, 0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('1000000000000000');
  });
});

describe('formatSecretCode', () => {
  it('groupe par quatre', () => {
    expect(formatSecretCode('ABCDEFGHJKMNPQRS')).toBe('ABCD-EFGH-JKMN-PQRS');
  });
});

describe('parseSecretCode', () => {
  it.each([
    'abcd-efgh-jkmn-pqrs',
    ' abcd efgh jkmn pqrs ',
    'abcdefghjkmnpqrs',
    'https://appsport.tail1234.ts.net/invite#abcd-efgh-jkmn-pqrs',
    'https://appsport.tail1234.ts.net/reset#ABCD-EFGH-JKMN-PQRS',
  ])('accepte %s', (s) => {
    expect(parseSecretCode(s)).toBe('ABCDEFGHJKMNPQRS');
  });

  it('ignore les tirets Unicode', () => {
    expect(parseSecretCode('abcd‑efgh–jkmn−pqrs')).toBe('ABCDEFGHJKMNPQRS');
  });

  it('corrige I, L et O', () => {
    expect(parseSecretCode('O0OO-IiLl-0000-0000')).toBe('0000111100000000');
  });

  it.each(['ABCD-EFGH-JKMN-PQR', 'ABCD-EFGH-JKMN-PQRST', 'ABCD-EFGH-JKMN-PQRU', ''])('refuse "%s"', (s) => {
    expect(parseSecretCode(s)).toBeNull();
  });
});
