import { describe, expect, it } from 'vitest';
import {
  ADULT_AGE,
  EPOCH_HEADER,
  MIN_AGE,
  MIN_PROTOCOL,
  PARIS_TZ,
  PRIVACY_POLICY_VERSION,
  PROTOCOL_HEADER,
  SYNC_PROTOCOL,
} from '../src/constants';

describe('constantes partagées', () => {
  it('valeurs figées', () => {
    expect({
      MIN_AGE,
      ADULT_AGE,
      PARIS_TZ,
      PRIVACY_POLICY_VERSION,
      SYNC_PROTOCOL,
      MIN_PROTOCOL,
      PROTOCOL_HEADER,
      EPOCH_HEADER,
    }).toEqual({
      MIN_AGE: 16,
      ADULT_AGE: 18,
      PARIS_TZ: 'Europe/Paris',
      PRIVACY_POLICY_VERSION: '1.0',
      SYNC_PROTOCOL: 1,
      MIN_PROTOCOL: 1,
      PROTOCOL_HEADER: 'X-Appsport-Protocol',
      EPOCH_HEADER: 'X-Appsport-Epoch',
    });
  });

  it('R-VER-1 : le protocole minimal tolère au plus une version de retard', () => {
    expect(MIN_PROTOCOL).toBeGreaterThanOrEqual(SYNC_PROTOCOL - 1);
  });
});
