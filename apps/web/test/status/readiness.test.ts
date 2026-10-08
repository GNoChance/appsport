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
        illustrationCount: 3,
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
        illustrationCount: 0,
        catalogVersion: 'c',
        serverCatalogVersion: 'c',
        lastPullOkAt: iso(NOW - ms),
        now: NOW,
      }).checks.recentPull;
    expect(RECENT_PULL_MS).toBe(86_400_000);
    expect(at(RECENT_PULL_MS)).toBe(false);
    expect(at(RECENT_PULL_MS - 1)).toBe(true);
  });

  it('illustrations : le SW compte sur la liste du catalogue local, pas sur une liste inconnue ou ancienne', () => {
    const illustrations = (o: Partial<SwStatus>, illustrationCount: number) =>
      computeReadiness({
        sw: sw(o),
        illustrationCount,
        catalogVersion: 'c',
        serverCatalogVersion: 'c',
        lastPullOkAt: iso(NOW - 3_600_000),
        now: NOW,
      }).checks.illustrations;
    // Aucune liste reçue par le SW : 0 manquante ne prouve rien.
    expect(illustrations({ illustrationsReferenced: null }, 0)).toBe(false);
    expect(illustrations({ illustrationsReferenced: null }, 3)).toBe(false);
    // Liste d'un autre catalogue (autre nombre d'illustrations) : pas prêt.
    expect(illustrations({ illustrationsReferenced: 2 }, 3)).toBe(false);
    expect(illustrations({ illustrationsReferenced: 3 }, 3)).toBe(true);
    expect(illustrations({ illustrationsReferenced: 0 }, 0)).toBe(true);
    expect(illustrations({ illustrationsReferenced: 3, illustrationsMissing: 1 }, 3)).toBe(false);
    // Bouchon sans SW (développement) : pas de liste suivie, seules les manquantes comptent.
    expect(illustrations({}, 3)).toBe(true);
  });

  it('sans SW, sans versions ni pull : tout échoue', () => {
    expect(
      computeReadiness({
        sw: null,
        illustrationCount: 0,
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
