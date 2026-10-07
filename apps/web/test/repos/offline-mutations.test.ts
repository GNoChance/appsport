import { describe, expect, it } from 'vitest';
import { NetworkRequiredError } from '../../src/api/client';
import { createRepos, type Repos } from '../../src/repos';
import { dumpLocalDb } from '../support/local-db';
import { createTestServices, makeMe } from '../support/render';
import { seedMirror } from '../support/seed';

const WRITES: [string, (r: Repos) => Promise<unknown>][] = [
  ['profile.update', (r) => r.profile.update({ goal: 'strength' })],
  ['places.create', (r) => r.places.create({ kind: 'home', equipment: [], isPrimary: false })],
  ['gyms.setEquipment', (r) => r.gyms.setEquipment('g-1', 'barbell', true)],
  ['consent.grantHealth', (r) => r.consent.grantHealth()],
  ['admin.revokeSessions', (r) => r.admin.revokeSessions('u-2')],
];

describe('écritures E hors ligne (01 §1 principe 4)', () => {
  for (const [name, write] of WRITES) {
    it(`${name} → « Nécessite le réseau », base inchangée, aucun pull`, async () => {
      const { services, api, sync, db } = await createTestServices({ me: makeMe({ role: 'admin' }) });
      await seedMirror(db, 'place', [
        { id: 'p-1', ownerId: 'u-1', kind: 'home', gymId: null, name: 'Maison', isPrimary: true },
      ]);
      const before = await dumpLocalDb(db);
      api.setOffline('reject');
      const error = await write(createRepos(services)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NetworkRequiredError);
      expect((error as Error).message).toBe('Nécessite le réseau');
      expect(await dumpLocalDb(db)).toBe(before);
      expect(await db.outbox.count()).toBe(0);
      expect(sync.pullCount).toBe(0);
    });
  }
});
