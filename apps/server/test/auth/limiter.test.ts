import { describe, expect, it } from 'vitest';
import { createIpLimiter, createLoginLimiter } from '../../src/auth/limiter';
import { FakeClock } from '../support';

const IP = '100.64.0.9';
const setup = () => {
  const clock = new FakeClock();
  return { clock, limiter: createLoginLimiter(clock) };
};

describe('limiteur de connexion par pseudo (R-AUTH-2)', () => {
  it('bloque dès le 5e échec consécutif, puis double jusqu au plafond de 900 s', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('lea', null);
    expect(limiter.check('lea', null)).toEqual({ allowed: true });
    limiter.recordFailure('lea', null);
    expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: 60 });
    let wait = 60;
    for (const expected of [120, 240, 480, 900]) {
      clock.advance(wait * 1000 - 1000);
      expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: 1 });
      clock.advance(1000);
      expect(limiter.check('lea', null)).toEqual({ allowed: true });
      limiter.recordFailure('lea', null);
      expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: expected });
      wait = expected;
    }
  });

  it('verrouille une heure au 10e échec de la fenêtre', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 10; i += 1) limiter.recordFailure('lea', null);
    expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: 3600 });
    clock.advance(3_599_000);
    expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: 1 });
    clock.advance(1000);
    expect(limiter.check('lea', null)).toEqual({ allowed: true });
  });

  it('un succès remet le compteur consécutif à zéro mais pas la fenêtre d une heure', () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('lea', null);
    limiter.recordSuccess('lea');
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('lea', null);
    expect(limiter.check('lea', null)).toEqual({ allowed: true });
    limiter.recordSuccess('lea');
    limiter.recordFailure('lea', null);
    limiter.recordFailure('lea', null);
    expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: 3600 });
  });

  it('les échecs de plus d une heure sortent de la fenêtre', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('lea', null);
    clock.advance(3_600_000);
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('lea', null);
    limiter.recordSuccess('lea');
    limiter.recordFailure('lea', null);
    limiter.recordFailure('lea', null);
    expect(limiter.check('lea', null)).toEqual({ allowed: true });
  });

  it('unlock efface l état du pseudo', () => {
    const { limiter } = setup();
    for (let i = 0; i < 10; i += 1) limiter.recordFailure('lea', null);
    limiter.unlock('lea');
    expect(limiter.check('lea', null)).toEqual({ allowed: true });
  });
});

describe('limiteur de connexion par IP (R-AUTH-3)', () => {
  it('30 échecs d une IP bloquent tous les pseudos pour cette IP seulement', () => {
    const { limiter } = setup();
    for (let i = 0; i < 30; i += 1) limiter.recordFailure(`pseudo${i}`, IP);
    expect(limiter.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(limiter.check('lea', '100.64.0.10')).toEqual({ allowed: true });
    limiter.unlock('lea');
    expect(limiter.check('lea', IP)).toEqual({ allowed: false, retryAfterS: 3600 });
  });

  it('une IP nulle partage le seau unknown : elle ne contourne pas la limite par IP', () => {
    const { limiter } = setup();
    for (let i = 0; i < 30; i += 1) limiter.recordFailure(`pseudo${i}`, null);
    expect(limiter.check('lea', null)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(limiter.check('lea', IP)).toEqual({ allowed: true });
  });
});

describe('limiteur d IP (codes)', () => {
  it('accepte 20 essais par heure et par IP', () => {
    const clock = new FakeClock();
    const limiter = createIpLimiter(clock, { limit: 20, windowMs: 3_600_000 });
    for (let i = 0; i < 20; i += 1) expect(limiter.hit(IP).allowed).toBe(true);
    expect(limiter.hit(IP)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(limiter.hit(IP)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(limiter.hit('100.64.0.10').allowed).toBe(true);
    clock.advance(3_600_000);
    expect(limiter.hit(IP).allowed).toBe(true);
  });

  it('une IP nulle partage un seau unknown : 20 essais par heure en tout', () => {
    const clock = new FakeClock();
    const limiter = createIpLimiter(clock, { limit: 20, windowMs: 3_600_000 });
    for (let i = 0; i < 20; i += 1) expect(limiter.hit(null).allowed).toBe(true);
    expect(limiter.hit(null)).toEqual({ allowed: false, retryAfterS: 3600 });
    expect(limiter.hit(IP).allowed).toBe(true);
  });
});
