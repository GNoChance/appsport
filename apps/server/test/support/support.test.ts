import { isUuidV7 } from '@appsport/domain';
import { describe, expect, it } from 'vitest';
import { FakeClock, seqIds } from './index';

describe('FakeClock', () => {
  it('part de la date par défaut, avance et se règle', () => {
    const c = new FakeClock();
    expect(c.now().toISOString()).toBe('2026-10-06T10:00:00.000Z');
    c.advance(1500);
    expect(c.now().toISOString()).toBe('2026-10-06T10:00:01.500Z');
    c.set('2027-01-01T00:00:00.000Z');
    expect(c.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('seqIds', () => {
  const take = (seed: number) => {
    const ids = seqIds(seed);
    return Array.from({ length: 50 }, () => ids.uuidv7());
  };

  it('est déterministe, UUIDv7 et trié', () => {
    const a = take(1);
    expect(take(1)).toEqual(a);
    expect(a.every(isUuidV7)).toBe(true);
    expect([...a].sort()).toEqual(a);
  });

  it('change avec la graine', () => {
    expect(take(2)).not.toEqual(take(1));
  });

  it('fournit des octets aléatoires de la longueur demandée', () => {
    expect(seqIds(1).randomBytes(16)).toHaveLength(16);
  });
});
