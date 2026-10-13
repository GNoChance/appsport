import { describe, expect, it, vi } from 'vitest';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createRepos } from '../../src/repos';
import { createTestServices, makeMe } from '../support/render';
import { seedOutbox } from '../support/seed';

type Storage = Parameters<ReturnType<typeof createRepos>['status']['requestPersistentStorage']>[0];

async function setup() {
  const t = await createTestServices({ me: makeMe() });
  return { ...t, status: createRepos(t.services).status };
}

describe('StatusRepo', () => {
  it('readinessInputs : versions du catalogue et dernier pull réussi, null sinon', async () => {
    const { status, db } = await setup();
    expect(await status.readinessInputs()).toEqual({
      catalogVersion: null,
      serverCatalogVersion: null,
      lastPullOkAt: null,
    });
    await setMeta(db, 'catalogVersion', 'cat-1');
    await setMeta(db, 'serverCatalogVersion', 'cat-2');
    await setMeta(db, 'lastPullOkAt', '2026-10-06T11:00:00.000Z');
    expect(await status.readinessInputs()).toEqual({
      catalogVersion: 'cat-1',
      serverCatalogVersion: 'cat-2',
      lastPullOkAt: '2026-10-06T11:00:00.000Z',
    });
  });

  it("pendingCount : ops de l'utilisateur connecté seulement", async () => {
    const { status, db } = await setup();
    await seedOutbox(db, 'u-1', 3);
    await seedOutbox(db, 'u-2', 1);
    expect(await status.pendingCount()).toBe(3);
  });

  it('activeSessionId : meta ou null', async () => {
    const { status, db } = await setup();
    expect(await status.activeSessionId()).toBeNull();
    await setMeta(db, 'activeSessionId', 's-1');
    expect(await status.activeSessionId()).toBe('s-1');
  });

  it('illustrationFiles : champ file du magasin illustrations, trié', async () => {
    const { status, db } = await setup();
    await db.table('illustrations').bulkPut([
      { id: 'b', file: 'b.22222222.svg' },
      { id: 'a', file: 'a.11111111.svg' },
    ]);
    expect(await status.illustrationFiles()).toEqual(['a.11111111.svg', 'b.22222222.svg']);
  });

  it('retry : synchro manuelle puis catalogue', async () => {
    const { status, api, sync } = await setup();
    api.on('GET', '/api/catalog', { status: 304 });
    await status.retry();
    expect(sync.triggers).toEqual(['manual']);
    expect(api.calls.map((c) => c.path)).toEqual(['/api/catalog']);
  });

  describe('requestPersistentStorage', () => {
    const cases: [string, () => Storage, boolean][] = [
      ['API absente', () => ({}) as Storage, false],
      ['refusé', () => ({ persisted: async () => false, persist: async () => false }), false],
      ['accordé', () => ({ persisted: async () => false, persist: async () => true }), true],
      [
        'erreur',
        () => ({ persisted: async () => false, persist: () => Promise.reject(new Error('x')) }),
        false,
      ],
    ];
    for (const [name, storage, expected] of cases) {
      it(`${name} → ${expected}, meta.persistGranted = ${expected}`, async () => {
        const { status, db } = await setup();
        expect(await status.requestPersistentStorage(storage())).toBe(expected);
        expect(await getMeta(db, 'persistGranted')).toBe(expected);
        expect(await status.persistGranted()).toBe(expected);
      });
    }

    it('déjà persistant : true sans appeler persist()', async () => {
      const { status, db } = await setup();
      const persist = vi.fn(async () => true);
      expect(await status.requestPersistentStorage({ persisted: async () => true, persist })).toBe(true);
      expect(persist).not.toHaveBeenCalled();
      expect(await getMeta(db, 'persistGranted')).toBe(true);
    });

    it('persistGranted : null tant que rien n’est demandé', async () => {
      const { status } = await setup();
      expect(await status.persistGranted()).toBeNull();
    });
  });
});
