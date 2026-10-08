import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cachesToDelete, planIllustrationSync } from '../../src/sw/sw';

describe('cachesToDelete', () => {
  it('purge les shell-* des autres builds ; garde le build courant, les illustrations et le reste', () => {
    expect(
      cachesToDelete(
        ['shell-aaaaaaaaaaaa', 'shell-bbbbbbbbbbbb', 'illustrations-v1', 'autre'],
        'bbbbbbbbbbbb',
      ),
    ).toEqual(['shell-aaaaaaaaaaaa']);
  });

  it('garde le marqueur de base locale (appsport-meta, ADR 0001 décision 5)', () => {
    expect(cachesToDelete(['appsport-meta', 'shell-old000000000'], 'aaaaaaaaaaaa')).toEqual([
      'shell-old000000000',
    ]);
  });

  it('rien à purger', () => {
    expect(cachesToDelete([], 'aaaaaaaaaaaa')).toEqual([]);
    expect(cachesToDelete(['shell-aaaaaaaaaaaa'], 'aaaaaaaaaaaa')).toEqual([]);
  });
});

describe('planIllustrationSync', () => {
  it.each([
    { referenced: ['a', 'b', 'b'], cached: ['b', 'c'], plan: { toFetch: ['a'], toDelete: ['c'] } },
    { referenced: [], cached: ['c'], plan: { toFetch: [], toDelete: ['c'] } },
    { referenced: ['a'], cached: [], plan: { toFetch: ['a'], toDelete: [] } },
    { referenced: [], cached: [], plan: { toFetch: [], toDelete: [] } },
  ])('($referenced, $cached) → $plan', ({ referenced, cached, plan }) => {
    expect(planIllustrationSync(referenced, cached)).toEqual(plan);
  });
});

describe('sw.ts', () => {
  it("n'ouvre jamais IndexedDB : aucune référence à indexedDB, à Dexie ni à local-db (R-PWA-4, R-PWA-6)", () => {
    const source = readFileSync(resolve(import.meta.dirname, '../../src/sw/sw.ts'), 'utf8');
    expect(source).not.toMatch(/\bindexedDB\b|['"]dexie['"]|local-db/);
  });
});
