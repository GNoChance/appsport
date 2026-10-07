import { describe, expect, it } from 'vitest';
import { ApiError, NetworkRequiredError } from '../../src/api/client';
import { ERROR_MESSAGES, errorMessage } from '../../src/ui/errors';
import { formatAge, formatDate, formatDateTime, plural } from '../../src/ui/format';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('format', () => {
  it("formatDate : date civile telle quelle, horodatage à l'heure de Paris", () => {
    expect(formatDate('2008-03-01')).toBe('01/03/2008');
    expect(formatDate('2026-10-05T23:30:00.000Z')).toBe('06/10/2026');
  });

  it("formatDateTime à l'heure de Paris", () => {
    expect(formatDateTime('2026-10-06T12:05:00.000Z')).toBe('06/10/2026 à 14:05');
  });

  it('formatAge', () => {
    expect(formatAge(ago(30_000), NOW)).toBe("à l'instant");
    expect(formatAge(ago(3 * 60_000), NOW)).toBe('il y a 3 min');
    expect(formatAge(ago(5 * 3_600_000), NOW)).toBe('il y a 5 h');
    expect(formatAge(ago(2 * 86_400_000), NOW)).toBe('il y a 2 j');
  });

  it('plural : singulier pour 0 et 1', () => {
    expect(plural(0, 'envoi', 'envois')).toBe('envoi');
    expect(plural(1, 'envoi', 'envois')).toBe('envoi');
    expect(plural(2, 'envoi', 'envois')).toBe('envois');
  });
});

describe('errorMessage', () => {
  it('traduit chaque cas', () => {
    expect(errorMessage(new NetworkRequiredError())).toBe('Nécessite le réseau');
    expect(errorMessage(new ApiError(409, 'username_taken', {}))).toBe('Ce pseudo est déjà pris.');
    expect(errorMessage(new ApiError(409, 'last_place', {}), { last_place: 'X' })).toBe('X');
    expect(errorMessage(new Error('boom'))).toBe('Une erreur inattendue est survenue.');
  });

  it('textes imposés', () => {
    expect(ERROR_MESSAGES).toMatchObject({
      invalid_credentials: 'Pseudo ou mot de passe incorrect',
      account_disabled: "Compte désactivé, contacte l'administrateur",
      under_min_age: 'appsport est réservé aux 16 ans et plus',
      last_admin: 'Il doit rester au moins un administrateur actif.',
      health_consent_required: 'Cette action demande ton accord santé.',
      rate_limited: "Trop d'essais. Réessaie plus tard.",
      internal: 'Le serveur a rencontré une erreur.',
    });
    for (const text of Object.values(ERROR_MESSAGES)) {
      expect(text).not.toBe('');
      expect(text).not.toMatch(/’/);
    }
  });
});
