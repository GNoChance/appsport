import { describe, expect, it } from 'vitest';
import { computeReadiness, RECENT_PULL_MS } from '../../src/features/status/readiness';
import type { SwStatus } from '../../src/sw/protocol';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();
const sw = (o: Partial<SwStatus> = {}): SwStatus => ({
  type: 'STATUS',
  buildHash: 'b1',
  shellCached: true,
  illustrationsMissing: 0,
  ...o,
});

describe('computeReadiness', () => {
  it('16 combinaisons : prêt si et seulement si les quatre vérifications passent', () => {
    for (let mask = 0; mask < 16; mask++) {
      const s = (mask & 1) !== 0;
      const c = (mask & 2) !== 0;
      const i = (mask & 4) !== 0;
      const p = (mask & 8) !== 0;
      const r = computeReadiness({
        sw: sw({ shellCached: s, illustrationsMissing: i ? 0 : 3 }),
        catalogVersion: 'cat-1',
        serverCatalogVersion: c ? 'cat-1' : 'cat-2',
        lastPullOkAt: iso(p ? NOW - 3_600_000 : NOW - 2 * RECENT_PULL_MS),
        now: NOW,
      });
      expect(r, `masque ${mask}`).toEqual({
        ready: s && c && i && p,
        checks: { shell: s, catalog: c, illustrations: i, recentPull: p },
      });
    }
  });

  it('pull il y a 24 h exactement → pas récent ; 24 h − 1 ms → récent', () => {
    const at = (ms: number) =>
      computeReadiness({
        sw: sw(),
        catalogVersion: 'c',
        serverCatalogVersion: 'c',
        lastPullOkAt: iso(NOW - ms),
        now: NOW,
      }).checks.recentPull;
    expect(RECENT_PULL_MS).toBe(86_400_000);
    expect(at(RECENT_PULL_MS)).toBe(false);
    expect(at(RECENT_PULL_MS - 1)).toBe(true);
  });

  it('sans SW, sans versions ni pull : tout échoue', () => {
    expect(
      computeReadiness({
        sw: null,
        catalogVersion: null,
        serverCatalogVersion: null,
        lastPullOkAt: null,
        now: NOW,
      }),
    ).toEqual({
      ready: false,
      checks: { shell: false, catalog: false, illustrations: false, recentPull: false },
    });
  });
});
