import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS, parseCommonPasswords } from '../../src/auth/common-passwords';
import { COMMON_PASSWORDS_RAW } from '../../src/auth/common-passwords-list';

describe('COMMON_PASSWORDS', () => {
  it('contient environ dix mille entrées en minuscules', () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThan(9000);
    expect(COMMON_PASSWORDS.size).toBeLessThanOrEqual(10001);
    expect(COMMON_PASSWORDS.has('123456')).toBe(true);
    expect(COMMON_PASSWORDS.has('password')).toBe(true);
    for (const p of COMMON_PASSWORDS) expect(p).toBe(p.toLowerCase());
  });

  it('porte la source et la licence', () => {
    expect(COMMON_PASSWORDS_RAW.startsWith('# Source: SecLists')).toBe(true);
    expect(COMMON_PASSWORDS_RAW).toContain('MIT');
  });
});

describe('parseCommonPasswords', () => {
  it('ignore commentaires et lignes vides, passe en minuscules', () => {
    expect([...parseCommonPasswords('# Licence MIT\r\nPassword\r\n\r\nabc\n')]).toEqual(['password', 'abc']);
  });
});
