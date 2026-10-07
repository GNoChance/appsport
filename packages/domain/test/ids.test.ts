import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createMonotonicUuidV7, createUuidV7, isUuidV7 } from '../src/ids';

const seededRandom = () => {
  let n = 7;
  return (len: number) => {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      out[i] = (n >> 8) & 0xff;
    }
    return out;
  };
};

const fromClock = (values: readonly number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] as number;
};

const expectStrictlyIncreasing = (ids: readonly string[]) => {
  for (let i = 1; i < ids.length; i++) {
    expect((ids[i] as string) > (ids[i - 1] as string)).toBe(true);
  }
};

describe('createUuidV7', () => {
  it('vecteur de la RFC 9562', () => {
    expect(
      createUuidV7(0x017f22e279b0, Uint8Array.of(0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f)),
    ).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
  });

  it('RangeError : aléa < 10 octets, horodatage hors [0, 2^48)', () => {
    expect(() => createUuidV7(0, new Uint8Array(9))).toThrow(RangeError);
    expect(() => createUuidV7(-1, new Uint8Array(10))).toThrow(RangeError);
    expect(() => createUuidV7(2 ** 48, new Uint8Array(10))).toThrow(RangeError);
  });
});

describe('isUuidV7', () => {
  it('minuscules, version 7, variante 10xx', () => {
    expect(isUuidV7('017f22e2-79b0-7cc3-98c4-dc0c0c07398f')).toBe(true);
    for (const s of [
      '017F22E2-79B0-7CC3-98C4-DC0C0C07398F',
      '017f22e2-79b0-4cc3-98c4-dc0c0c07398f',
      '017f22e2-79b0-7cc3-c8c4-dc0c0c07398f',
      'user:1',
    ]) {
      expect(isUuidV7(s)).toBe(false);
    }
  });
});

describe('createMonotonicUuidV7', () => {
  it("strictement croissant quand l'horloge recule", () => {
    const gen = createMonotonicUuidV7(fromClock([1000, 999, 999, 500, 1000, 1001]), seededRandom());
    const ids = Array.from({ length: 5000 }, () => gen());
    for (const id of ids) expect(isUuidV7(id)).toBe(true);
    expectStrictlyIncreasing(ids);
  });

  it("propriété : toute suite d'horloges donne des ids uniques et croissants", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 2 ** 40 }), { minLength: 1, maxLength: 300 }),
        (clocks) => {
          const gen = createMonotonicUuidV7(fromClock(clocks), seededRandom());
          const ids = clocks.map(() => gen());
          expect(new Set(ids).size).toBe(ids.length);
          expectStrictlyIncreasing(ids);
        },
      ),
    );
  });
});
