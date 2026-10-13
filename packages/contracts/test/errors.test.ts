import { describe, expect, it } from 'vitest';
import { ApiErrorBody, ApiErrorCode, ERROR_STATUS, HealthResponse } from '../src/index';

const GROUPS: Record<number, string[]> = {
  400: [
    'validation',
    'password_rejected',
    'username_invalid',
    'under_min_age',
    'invitation_expired',
    'invitation_used',
    'invitation_revoked',
    'invitation_unknown',
    'reset_invalid',
  ],
  401: ['unauthenticated', 'invalid_credentials'],
  403: [
    'forbidden',
    'origin_mismatch',
    'account_disabled',
    'password_change_required',
    'health_consent_required',
    'reset_self_forbidden',
  ],
  404: ['not_found'],
  409: [
    'conflict',
    'username_taken',
    'last_admin',
    'gym_duplicate',
    'gym_in_use',
    'place_exists',
    'last_place',
    'primary_required',
    'onboarding_incomplete',
  ],
  410: ['account_deleted', 'watermark_expired'],
  415: ['unsupported_media_type'],
  426: ['protocol_unsupported'],
  429: ['rate_limited'],
  500: ['internal'],
};

describe('ApiErrorCode et ERROR_STATUS', () => {
  it('compte 33 codes', () => {
    expect(ApiErrorCode.options).toHaveLength(33);
  });

  it('associe chaque code au statut de son groupe', () => {
    const expected: Record<string, number> = {};
    for (const [status, codes] of Object.entries(GROUPS)) for (const c of codes) expected[c] = Number(status);
    expect(Object.keys(expected).sort()).toEqual([...ApiErrorCode.options].sort());
    for (const code of ApiErrorCode.options) expect(ERROR_STATUS[code]).toBe(expected[code]);
  });
});

describe('ApiErrorBody', () => {
  it('conserve les champs supplémentaires', () => {
    expect(ApiErrorBody.parse({ error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 })).toEqual({
      error: 'protocol_unsupported',
      serverProtocol: 1,
      minProtocol: 1,
    });
  });

  it('refuse un code inconnu', () => {
    expect(ApiErrorBody.safeParse({ error: 'boum' }).success).toBe(false);
  });
});

describe('HealthResponse', () => {
  it('accepte une époque nulle', () => {
    const body = {
      status: 'error',
      version: 'dev',
      db: 'error',
      protocol: 1,
      minProtocol: 1,
      epoch: null,
      swKill: false,
    };
    expect(HealthResponse.parse(body)).toEqual(body);
  });
});
