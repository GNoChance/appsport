import type { Role } from '@appsport/contracts';
import { describe, expect, it } from 'vitest';
import { passwordLength, validatePassword } from '../../src/auth/password';

const member = { username: 'lea', role: 'member' as Role, commonPasswords: new Set(['soleil123456']) };
const admin = { ...member, role: 'admin' as Role };

describe('validatePassword', () => {
  it('applique le minimum selon le rôle', () => {
    expect(validatePassword('abcdefghijk', member)).toEqual({ ok: false, reason: 'too_short' });
    expect(validatePassword('girafebleuet', member)).toEqual({ ok: true });
    expect(validatePassword('girafebleuet1', admin)).toEqual({ ok: false, reason: 'too_short' });
    expect(validatePassword('girafebleuet12', admin)).toEqual({ ok: true });
  });

  it('plafonne à 128 points de code', () => {
    expect(validatePassword('ab'.repeat(64), member)).toEqual({ ok: true });
    expect(validatePassword(`${'ab'.repeat(64)}c`, member)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('refuse les mots de passe courants, sans tenir compte de la casse', () => {
    expect(validatePassword('SOLEIL123456', member)).toEqual({ ok: false, reason: 'common' });
  });

  it('refuse le pseudo et appsport', () => {
    expect(validatePassword('xxÉloïse_2 et la mer', { ...member, username: 'éloïse_2' })).toEqual({
      ok: false,
      reason: 'contains_username',
    });
    expect(validatePassword('mon appSport adoré', member)).toEqual({
      ok: false,
      reason: 'contains_appsport',
    });
  });

  it('refuse un seul caractère répété', () => {
    expect(validatePassword('aaaaaaaaaaaa', member)).toEqual({ ok: false, reason: 'single_char' });
    expect(validatePassword('💪'.repeat(12), member)).toEqual({ ok: false, reason: 'single_char' });
  });

  it('compte en points de code après NFC', () => {
    expect(passwordLength('💪'.repeat(11))).toBe(11);
    expect(validatePassword(`${'💪'.repeat(11)}a`, member)).toEqual({ ok: true });
    expect(validatePassword(`${'é'.repeat(6)}abcde`, member)).toEqual({ ok: false, reason: 'too_short' });
    expect(passwordLength('é'.repeat(6))).toBe(6);
    expect(validatePassword(`${'é'.repeat(6)}abcde`, member)).toEqual({ ok: false, reason: 'too_short' });
    expect(validatePassword(`${'é'.repeat(6)}abcdef`, member)).toEqual({ ok: true });
  });
});
