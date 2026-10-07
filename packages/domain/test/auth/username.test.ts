import { describe, expect, it } from 'vitest';
import { usernameKey, validateUsername } from '../../src/auth/username';

describe('validateUsername', () => {
  it('contrôle la longueur', () => {
    expect(validateUsername('ab')).toEqual({ ok: false, reason: 'length' });
    expect(validateUsername('a'.repeat(25))).toEqual({ ok: false, reason: 'length' });
    expect(validateUsername('abc')).toEqual({ ok: true });
    expect(validateUsername('a'.repeat(24))).toEqual({ ok: true });
    expect(validateUsername('é'.repeat(24))).toEqual({ ok: true });
  });

  it('accepte les lettres latines, chiffres, point, tiret bas et tiret', () => {
    for (const u of ['Éloïse_2', 'jean-marc.b']) expect(validateUsername(u)).toEqual({ ok: true });
  });

  it('refuse les autres caractères, écritures et homoglyphes', () => {
    for (const u of ['lea b', 'lea@x', 'lea💪', 'аdmin', 'lеa', 'Αθηνά']) {
      expect(validateUsername(u)).toEqual({ ok: false, reason: 'characters' });
    }
  });

  it('contrôle la forme NFC', () => {
    expect(validateUsername('Léa')).toEqual({ ok: true });
  });

  it('refuse les noms réservés, sans accents', () => {
    for (const u of ['Admin', 'APPSPORT', 'Système']) {
      expect(validateUsername(u)).toEqual({ ok: false, reason: 'reserved' });
    }
  });
});

describe('usernameKey', () => {
  it('applique NFKC puis les minuscules', () => {
    expect(usernameKey('Éloïse')).toBe('éloïse');
    expect(usernameKey('ＬＥＡ')).toBe('lea');
  });
});
