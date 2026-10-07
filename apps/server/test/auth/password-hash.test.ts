import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from '../../src/auth/password-hash';
import { loadConfig } from '../../src/config';
import { ARGON2_PARAMS } from '../../src/deps';
import { seqIds, TEST_ARGON2 } from '../support';

describe('hashPassword', () => {
  it('produit un PHC argon2id aux paramètres de production', async () => {
    expect(await hashPassword('girafebleuet', ARGON2_PARAMS, seqIds())).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
  });

  it('la configuration porte ARGON2_PARAMS', () => {
    expect(loadConfig({ APP_ORIGIN: 'https://appsport.test.ts.net' }).argon2).toEqual(ARGON2_PARAMS);
  });

  it('deux hachés du même mot de passe diffèrent', async () => {
    const ids = seqIds();
    const a = await hashPassword('girafebleuet', TEST_ARGON2, ids);
    const b = await hashPassword('girafebleuet', TEST_ARGON2, ids);
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('accepte le bon mot de passe, en NFC comme en NFD', async () => {
    const phc = await hashPassword('é-girafe-bleue', TEST_ARGON2, seqIds());
    expect(await verifyPassword('é-girafe-bleue', phc)).toBe(true);
    expect(await verifyPassword('é-girafe-bleue', phc)).toBe(true);
  });

  it('refuse un mauvais mot de passe et un PHC illisible', async () => {
    const phc = await hashPassword('girafebleuet', TEST_ARGON2, seqIds());
    expect(await verifyPassword('girafebleuex', phc)).toBe(false);
    expect(await verifyPassword('girafebleuet', 'pas-un-phc')).toBe(false);
  });
});

describe('needsRehash', () => {
  it('compare aux paramètres cibles', async () => {
    const phc = await hashPassword('girafebleuet', TEST_ARGON2, seqIds());
    expect(needsRehash(phc, TEST_ARGON2)).toBe(false);
    expect(needsRehash(phc, { ...TEST_ARGON2, memoryKiB: 2048 })).toBe(true);
    expect(needsRehash(phc, { ...TEST_ARGON2, passes: 2 })).toBe(true);
    expect(needsRehash(phc, { ...TEST_ARGON2, memoryKiB: 512 })).toBe(false);
    expect(needsRehash(phc, { ...TEST_ARGON2, parallelism: 2 })).toBe(true);
    expect(needsRehash('garbage', TEST_ARGON2)).toBe(true);
  });
});
