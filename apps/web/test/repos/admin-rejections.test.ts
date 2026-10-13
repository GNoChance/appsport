import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeadletterEntry } from '../../src/local-db/db';
import { createRepos } from '../../src/repos';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { createTestServices, DEFAULT_NOW, makeMe } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const AT = '2026-10-06T10:00:00.000Z';
const rejection = (id: string, opId: string, extra: Record<string, unknown> = {}) => ({
  id,
  ownerId: 'u-1',
  opId,
  entity: 'place',
  rowId: 'p-1',
  code: 'validation',
  detailJson: { field: 'name' },
  dismissedAt: null,
  createdAt: AT,
  ...extra,
});
const dead = (opId: string, userId: string): DeadletterEntry => ({
  opId,
  userId,
  entity: 'sync_rejection',
  id: `row-${opId}`,
  code: 'forbidden',
  detail: { kind: 'patch', fieldNames: ['dismissedAt'] },
  receivedAt: AT,
});

async function setup() {
  const t = await createTestServices({ me: makeMe() });
  await seedMirror(t.db, 'sync_rejection', [
    rejection('r-1', 'op-1'),
    rejection('r-2', 'op-2', { dismissedAt: AT }),
    rejection('r-3', 'op-3', { deletedAt: AT }),
  ]);
  // op-2 : rejet déjà écarté (sur un autre appareil) ; sa deadletter locale ne doit pas réapparaître.
  await t.db.deadletter.bulkPut([
    dead('op-1', 'u-1'),
    dead('op-2', 'u-1'),
    dead('op-7', 'u-1'),
    dead('op-8', 'u-2'),
  ]);
  return { ...t, repos: createRepos(t.services) };
}

let engine: SyncEngine | null = null;
afterEach(() => {
  engine?.stop();
  engine = null;
  vi.restoreAllMocks();
});

describe('RejectionsRepo', () => {
  it('list : rejets serveur actifs puis rejets locaux non couverts, utilisateur courant seulement', async () => {
    const { repos } = await setup();
    const list = await repos.rejections.list();
    expect(list).toMatchObject([
      {
        id: 'r-1',
        source: 'server',
        opId: 'op-1',
        entity: 'place',
        rowId: 'p-1',
        code: 'validation',
        at: AT,
      },
      { id: 'local:op-7', source: 'local', opId: 'op-7', code: 'forbidden', at: AT },
    ]);
    expect(list[0]?.detail).toEqual({ field: 'name' });
    expect(await repos.rejections.count()).toBe(2);
  });

  it('dismiss d’un rejet serveur : op patch dismissedAt, deadletter retirée, synchro « mutation »', async () => {
    const { repos, db, sync } = await setup();
    await repos.rejections.dismiss('r-1');
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      entity: 'sync_rejection',
      id: 'r-1',
      kind: 'patch',
      userId: 'u-1',
      fields: { dismissedAt: '2026-10-06T12:00:00.000Z' },
    });
    expect(await db.deadletter.get('op-1')).toBeUndefined();
    expect(sync.triggers).toContain('mutation');
    expect((await repos.rejections.list()).map((r) => r.id)).toEqual(['local:op-7']);
  });

  it('dismiss atomique : échec sur la deadletter → ni op ni copie modifiée', async () => {
    const { repos, db } = await setup();
    vi.spyOn(db.deadletter, 'where').mockImplementationOnce(() => {
      throw new Error('deadletter inaccessible');
    });
    await expect(repos.rejections.dismiss('r-1')).rejects.toThrow('deadletter inaccessible');
    expect(await db.outbox.count()).toBe(0);
    expect((await db.mirror('sync_rejection').get('r-1'))?.dismissedAt).toBeNull();
    expect(await db.deadletter.get('op-1')).toBeDefined();
  });

  it('dismiss d’un rejet local : deadletter retirée, aucune op', async () => {
    const { repos, db } = await setup();
    await repos.rejections.dismiss('local:op-7');
    expect(await db.outbox.count()).toBe(0);
    expect(await db.deadletter.get('op-7')).toBeUndefined();
    expect(await db.deadletter.get('op-8')).toBeDefined();
  });

  it('après l’écriture locale, le compteur du moteur voit l’op en attente (intervalle de 60 s)', async () => {
    const { services, api, db } = await setup();
    api.setOffline('reject');
    engine = createSyncEngine({
      db,
      transport: api.transport,
      now: () => DEFAULT_NOW,
      triggers: () => () => {},
    });
    const real = engine;
    await createRepos({ ...services, sync: real }).rejections.dismiss('r-1');
    await until(() => real.getState().pending === 1);
    expect(real.getState().pending).toBe(1);
    // r-1 en cours d'écartement (op en attente, copie à jour) et op-2 couvert par r-2 écarté : reste op-7.
    expect(real.getState().rejected).toBe(1);
  });
});

describe('AdminRepo', () => {
  it('deleteMember : POST /delete { confirmUsername, password }', async () => {
    const { repos, api, sync } = await setup();
    api.on('POST', '/api/admin/members/:id/delete', { status: 204 });
    await repos.admin.deleteMember('u-2', 'lea', 'pw');
    expect(api.calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/admin/members/u-2/delete',
      body: { confirmUsername: 'lea', password: 'pw' },
    });
    expect(sync.pullCount).toBe(1);
  });

  it('resetLink : 200 ResetLinkResponse', async () => {
    const { repos, api } = await setup();
    const link = { code: 'ABCD-EFGH-JKMN-PQRS', link: '/reset#ABCD-EFGH-JKMN-PQRS', expiresAt: AT };
    api.on('POST', '/api/admin/members/:id/reset-link', { status: 200, body: link });
    expect(await repos.admin.resetLink('u-2')).toEqual(link);
  });

  it('chemins et corps des actions admin', async () => {
    const { repos, api } = await setup();
    api.on('GET', '/api/admin/members', { status: 200, body: [] });
    api.on('POST', '/api/admin/members/:id/revoke-sessions', { status: 204 });
    api.on('POST', '/api/admin/members/:id/status', { status: 204 });
    api.on('POST', '/api/admin/members/:id/role', { status: 204 });
    api.on('POST', '/api/admin/members/:id/birth-date', { status: 204 });
    api.on('GET', '/api/admin/invitations', { status: 200, body: [] });
    api.on('POST', '/api/admin/invitations/:id/revoke', { status: 204 });
    api.on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'dev', opsStatus: null } });
    api.on('GET', '/api/gyms', { status: 200, body: [] });
    api.on('DELETE', '/api/admin/gyms/:id', { status: 204 });
    expect(await repos.admin.members()).toEqual([]);
    await repos.admin.revokeSessions('u-2');
    await repos.admin.setStatus('u-2', 'disabled');
    await repos.admin.setRole('u-2', 'admin', 'pw');
    await repos.admin.setBirthDate('u-2', '2000-01-01');
    expect(await repos.admin.invitations()).toEqual([]);
    await repos.admin.revokeInvitation('i-1');
    expect(await repos.admin.opsStatus()).toEqual({ version: 'dev', opsStatus: null });
    expect(await repos.admin.gyms()).toEqual([]);
    await repos.admin.deleteGym('g-1');
    expect(api.calls.map((c) => [`${c.method} ${c.path}`, c.method === 'GET' ? undefined : c.body])).toEqual([
      ['GET /api/admin/members', undefined],
      ['POST /api/admin/members/u-2/revoke-sessions', {}],
      ['POST /api/admin/members/u-2/status', { status: 'disabled' }],
      ['POST /api/admin/members/u-2/role', { role: 'admin', password: 'pw' }],
      ['POST /api/admin/members/u-2/birth-date', { birthDate: '2000-01-01' }],
      ['GET /api/admin/invitations', undefined],
      ['POST /api/admin/invitations/i-1/revoke', {}],
      ['GET /api/admin/ops-status', undefined],
      ['GET /api/gyms', undefined],
      ['DELETE /api/admin/gyms/g-1', {}],
    ]);
  });
});
