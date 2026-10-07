import { createHash } from 'node:crypto';
import { formatSecretCode } from '@appsport/domain';
import { describe, expect, it, vi } from 'vitest';
import { createSecretCode, hashSecret } from '../../src/auth/secret';
import { seqIds } from '../support';

describe('createSecretCode', () => {
  it('produit un code canonique, sa forme affichée et son empreinte', () => {
    const ids = seqIds();
    const spy = vi.spyOn(ids, 'randomBytes');
    const { canonical, formatted, hash } = createSecretCode(ids);
    expect(canonical).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
    expect(formatted).toBe(formatSecretCode(canonical));
    expect(hash).toBe(createHash('sha256').update(canonical).digest('hex'));
    expect(spy).toHaveBeenCalledWith(10);
  });
});

describe('hashSecret', () => {
  it('est un sha256 hexadécimal', () => {
    expect(hashSecret('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
