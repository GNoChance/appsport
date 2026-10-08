import type { MeResponse } from '@appsport/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createRepos, type Repos } from '../../src/repos';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { createFakeSyncEngine } from '../support/fake-api';
import { createTestServices, DEFAULT_NOW, makeMe } from '../support/render';
import { seedOutbox } from '../support/seed';
import { until } from '../support/wait';

const lea = makeMe({ id: 'u-A', username: 'lea' });
const max = makeMe({ id: 'u-B', username: 'max' });
const ok = (body: unknown) => ({ status: 200, body });
const EMPTY_PULL = { rows: [], nextWatermark: 'e1:0', hasMore: false, catalogVersion: null };

let engine: SyncEngine | null = null;
afterEach(() => {
  engine?.stop();
  engine = null;
  vi.restoreAllMocks();
});

describe('MeRepo : profil en cache', () => {
  it('refresh met meta.me à jour', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    api.on('GET', '/api/me', ok({ ...lea, username: 'lea2' }));
    const me = await createRepos(services).me.refresh();
    expect(me?.username).toBe('lea2');
    expect((await getMeta(db, 'me'))?.username).toBe('lea2');
  });

  it('hors ligne : refresh rend le cache', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    api.setOffline('reject');
    expect((await createRepos(services).me.refresh())?.username).toBe('lea');
    expect((await getMeta(db, 'me'))?.username).toBe('lea');
  });

  it('erreur API : null sans effacer le cache', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    api.on('GET', '/api/me', { status: 500, body: { error: 'internal' } });
    expect(await createRepos(services).me.refresh()).toBeNull();
    expect((await getMeta(db, 'me'))?.username).toBe('lea');
  });
});

describe('MeRepo : déconnexion sur une session que le serveur ne connaît plus (R-AUTH-9)', () => {
  const logoutWith = async (status: number, error: string) => {
    const { services, api, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    api.on('POST', '/api/auth/logout', { status, body: { error } });
    const outcome = await createRepos(services)
      .me.logout('current')
      .then(
        () => 'resolved',
        (e: { code?: string }) => e.code,
      );
    return { outcome, outbox: await db.outbox.count(), me: await getMeta(db, 'me') };
  };

  it('401 : déconnexion faite, données locales effacées', async () => {
    expect(await logoutWith(401, 'unauthenticated')).toEqual({
      outcome: 'resolved',
      outbox: 0,
      me: undefined,
    });
  });

  it('410 : données effacées, erreur account_deleted rendue', async () => {
    expect(await logoutWith(410, 'account_deleted')).toEqual({
      outcome: 'account_deleted',
      outbox: 0,
      me: undefined,
    });
  });

  it('500 : erreur rendue, rien effacé', async () => {
    const r = await logoutWith(500, 'internal');
    expect(r.outcome).toBe('internal');
    expect(r.outbox).toBe(2);
    expect(r.me?.username).toBe('lea');
  });
});

describe('MeRepo : changement de compte (P-AUT-6)', () => {
  it("connexion d'un autre compte : file de l'ancien effacée, meta.userId posé, synchro relancée", async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    const repos = createRepos(services);
    expect(await repos.me.deviceOwner()).toEqual({ userId: 'u-A', username: 'lea', pending: 2 });

    sync.start();
    let startedDuringLogin: boolean | null = null;
    api.on('POST', '/api/auth/login', () => {
      startedDuringLogin = sync.started;
      return ok(max);
    });
    const me = await repos.me.login({ username: 'max', password: 'pw' });
    // Moteur arrêté pendant la requête : aucun cycle de u-A sous le cookie de u-B.
    expect(startedDuringLogin).toBe(false);
    expect(me.id).toBe('u-B');
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'userId')).toBe('u-B');
    expect((await getMeta(db, 'me'))?.id).toBe('u-B');
    expect(sync.triggers).toContain('manual');
    expect(sync.started).toBe(true);
  });

  it('reconnexion du même compte : file gardée', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    api.on('POST', '/api/auth/login', ok(lea));
    await createRepos(services).me.login({ username: 'Lea', password: 'pw' });
    expect(await db.outbox.count()).toBe(2);
    expect(await getMeta(db, 'userId')).toBe('u-A');
  });

  it('acceptInvitation et resetPassword adoptent la session', async () => {
    const { services, api, db } = await createTestServices({ me: null });
    const repos = createRepos(services);
    api.on('POST', '/api/invitations/accept', { status: 201, body: max });
    await repos.me.acceptInvitation({ code: 'c', username: 'max', password: 'pw', termsVersion: '1.0' });
    expect(await getMeta(db, 'userId')).toBe('u-B');
    api.on('POST', '/api/auth/reset', ok(lea));
    await repos.me.resetPassword({ code: 'c', newPassword: 'pw' });
    expect(await getMeta(db, 'userId')).toBe('u-A');
  });

  it("connexion refusée : rien n'est effacé, moteur relancé", async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    sync.start();
    api.on('POST', '/api/auth/login', { status: 401, body: { error: 'invalid_credentials' } });
    await expect(createRepos(services).me.login({ username: 'max', password: 'x' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(await db.outbox.count()).toBe(2);
    expect(await getMeta(db, 'userId')).toBe('u-A');
    expect(sync.started).toBe(true);
  });

  it('échec local après la réponse : moteur relancé quand même', async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    sync.start();
    api.on('POST', '/api/auth/login', ok(lea));
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('base inaccessible'));
    await expect(createRepos(services).me.login({ username: 'lea', password: 'pw' })).rejects.toThrow(
      'base inaccessible',
    );
    expect(sync.started).toBe(true);
  });

  it('refresh vers un autre compte en échec : moteur relancé', async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    sync.start();
    api.on('GET', '/api/me', ok(max));
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('base inaccessible'));
    await expect(createRepos(services).me.refresh()).rejects.toThrow('base inaccessible');
    expect(sync.started).toBe(true);
  });

  it('logout : une requête, base vidée, meta.userId et meta.me absents', async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    sync.start();
    let startedDuringLogout: boolean | null = null;
    api.on('POST', '/api/auth/logout', () => {
      startedDuringLogout = sync.started;
      return { status: 204 };
    });
    await createRepos(services).me.logout('current');
    expect(api.calls.map((c) => c.path)).toEqual(['/api/auth/logout']);
    expect(startedDuringLogout).toBe(false);
    expect(sync.started).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'me')).toBeUndefined();
    expect(await getMeta(db, 'userId')).toBeUndefined();
  });

  it('logout("all") appelle /api/auth/logout-all', async () => {
    const { services, api } = await createTestServices({ me: lea });
    api.on('POST', '/api/auth/logout-all', { status: 204 });
    await createRepos(services).me.logout('all');
    expect(api.calls.map((c) => c.path)).toEqual(['/api/auth/logout-all']);
  });

  it('logout hors ligne : rien effacé, moteur relancé', async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    sync.start();
    api.setOffline('reject');
    await expect(createRepos(services).me.logout('current')).rejects.toThrow('Nécessite le réseau');
    expect(await getMeta(db, 'userId')).toBe('u-A');
    expect(sync.started).toBe(true);
  });

  it('deleteAccount : moteur arrêté pendant la requête, base vidée, moteur relancé', async () => {
    const { services, api, sync, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    sync.start();
    let startedDuringDelete: boolean | null = null;
    api.on('POST', '/api/me/delete', (req) => {
      startedDuringDelete = sync.started;
      expect(req.body).toEqual({ password: 'pw' });
      return { status: 204 };
    });
    await createRepos(services).me.deleteAccount('pw');
    expect(startedDuringDelete).toBe(false);
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'userId')).toBeUndefined();
    expect(sync.started).toBe(true);
  });

  it('changePassword : POST puis GET /api/me, meta.me à jour, synchro manuelle', async () => {
    const { services, api, sync, db } = await createTestServices({
      me: { ...lea, mustChangePassword: true },
    });
    api.on('POST', '/api/auth/password', { status: 204 });
    api.on('GET', '/api/me', ok(lea));
    await createRepos(services).me.changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/auth/password', 'GET /api/me']);
    expect((await getMeta(db, 'me'))?.mustChangePassword).toBe(false);
    expect(sync.triggers).toContain('manual');
  });
});

describe('MeRepo : session ouverte, état de connexion remis à zéro (R-AUTH-8, P-DRT-4)', () => {
  const CODE = 'ABCDEFGHJKMNPQRS';
  const opens: [string, string, (r: Repos) => Promise<MeResponse>][] = [
    ['login', '/api/auth/login', (r) => r.me.login({ username: 'lea', password: 'pw' })],
    [
      'acceptInvitation',
      '/api/invitations/accept',
      (r) => r.me.acceptInvitation({ code: CODE, username: 'lea', password: 'pw', termsVersion: '1.0' }),
    ],
    ['resetPassword', '/api/auth/reset', (r) => r.me.resetPassword({ code: CODE, newPassword: 'pw' })],
  ];

  it.each(opens)(
    '%s réussi : connexion « unknown » avant la relance du moteur et avant la fin',
    async (_, path, open) => {
      const sync = createFakeSyncEngine({ connection: 'unauthenticated' });
      const { services, api } = await createTestServices({ me: lea, sync });
      api.on('POST', path, ok(lea));
      const order: string[] = [];
      const { start, sessionOpened } = sync;
      sync.start = () => {
        order.push('start');
        start();
      };
      sync.sessionOpened = () => {
        order.push(`sessionOpened:${sync.started}`);
        sessionOpened();
      };
      await open(createRepos(services));
      expect(sync.getState().connection).toBe('unknown');
      expect(order).toEqual(['sessionOpened:false', 'start']);
    },
  );

  it.each(opens)(
    "%s refusé : connexion inchangée, la pause d'après le 401 continue",
    async (_, path, open) => {
      const sync = createFakeSyncEngine({ connection: 'unauthenticated' });
      const { services, api } = await createTestServices({ me: lea, sync });
      api.on('POST', path, { status: 401, body: { error: 'invalid_credentials' } });
      await expect(open(createRepos(services))).rejects.toMatchObject({ code: 'invalid_credentials' });
      expect(sync.sessionsOpened).toBe(0);
      expect(sync.getState().connection).toBe('unauthenticated');
      expect(sync.started).toBe(true);
    },
  );

  it("session d'un autre compte adoptée par refresh : connexion remise à zéro", async () => {
    const sync = createFakeSyncEngine({ connection: 'unauthenticated' });
    const { services, api } = await createTestServices({ me: lea, sync });
    api.on('GET', '/api/me', ok(max));
    await createRepos(services).me.refresh();
    expect(sync.sessionsOpened).toBe(1);
    expect(sync.getState().connection).toBe('unknown');
  });
});

describe('MeRepo avec le moteur réel', () => {
  it('après un 401, la reconnexion du même utilisateur relance un cycle complet', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 1);
    const unauthenticated = { status: 401, body: { error: 'unauthenticated' } };
    api.on('GET', '/api/health', ok({}));
    api.on('POST', '/api/sync/push', unauthenticated);
    engine = createSyncEngine({
      db,
      transport: api.transport,
      now: () => DEFAULT_NOW,
      triggers: () => () => {},
    });
    engine.start();
    const real = engine;
    await until(() => real.getState().connection === 'unauthenticated');

    api.on('POST', '/api/sync/push', (req) => {
      const ops = (req.body as { ops: { opId: string }[] }).ops;
      return ok({ results: ops.map((o) => ({ opId: o.opId, status: 'applied', rev: 1 })) });
    });
    api.on('GET', '/api/sync/pull', ok(EMPTY_PULL));
    api.on('POST', '/api/auth/login', ok(lea));
    const before = api.calls.length;
    await createRepos({ ...services, sync: real }).me.login({ username: 'lea', password: 'pw' });
    expect(real.getState().connection).toBe('unknown');
    await until(() => api.calls.slice(before).some((c) => c.path === '/api/sync/pull'));
    await until(() => !real.getState().syncing);
    expect(api.calls.slice(before).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/auth/login',
      'GET /api/health',
      'POST /api/sync/push',
      'GET /api/sync/pull',
    ]);
    expect(real.getState().connection).toBe('online');
    expect(await db.outbox.count()).toBe(0);
  });

  it('après un 410 account_deleted, la connexion de u-B relance un cycle complet', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    api.on('GET', '/api/health', { status: 410, body: { error: 'account_deleted' } });
    api.on('GET', '/api/sync/pull', ok(EMPTY_PULL));
    engine = createSyncEngine({
      db,
      transport: api.transport,
      now: () => DEFAULT_NOW,
      triggers: () => () => {},
    });
    engine.start();
    const real = engine;
    await until(() => real.getState().connection === 'account_deleted');
    expect(await getMeta(db, 'userId')).toBeUndefined();

    api.on('GET', '/api/health', ok({}));
    api.on('POST', '/api/auth/login', ok(max));
    const before = api.calls.length;
    await createRepos({ ...services, sync: real }).me.login({ username: 'max', password: 'pw' });
    await until(() => api.calls.slice(before).some((c) => c.path === '/api/sync/pull'));
    expect(api.calls.slice(before, before + 3).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/auth/login',
      'GET /api/health',
      'GET /api/sync/pull',
    ]);
    await until(() => !real.getState().syncing);
    expect(real.getState().connection).toBe('online');
  });

  it("A → B : la file de A n'est jamais envoyée sous la session de B", async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    await seedOutbox(db, 'u-A', 2);
    let release: () => void = () => {};
    api.on(
      'GET',
      '/api/health',
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 200, body: {} });
        }),
    );
    api.on('POST', '/api/sync/push', (req) => {
      const ops = (req.body as { ops: { opId: string }[] }).ops;
      return ok({ results: ops.map((o) => ({ opId: o.opId, status: 'applied', rev: 1 })) });
    });
    api.on('GET', '/api/sync/pull', ok(EMPTY_PULL));
    engine = createSyncEngine({
      db,
      transport: api.transport,
      now: () => DEFAULT_NOW,
      triggers: () => () => {},
    });
    engine.start();
    const real = engine;
    // Cycle de A en vol, bloqué sur /api/health.
    await until(() => api.calls.some((c) => c.path === '/api/health'));

    api.on('POST', '/api/auth/login', ok(max));
    await createRepos({ ...services, sync: real }).me.login({ username: 'max', password: 'pw' });
    api.on('GET', '/api/health', ok({}));
    release();
    await until(() => api.calls.some((c) => c.path === '/api/sync/pull'));
    await until(() => !real.getState().syncing);

    const pushed = api.calls
      .filter((c) => c.path === '/api/sync/push')
      .flatMap((c) => (c.body as { ops: { userId: string }[] }).ops);
    expect(pushed.filter((o) => o.userId === 'u-A')).toEqual([]);
    expect(await getMeta(db, 'userId')).toBe('u-B');
  });
});

describe('MeRepo : message des 18 ans (R-AGE-6)', () => {
  const minor: MeResponse = { ...lea, ageBand: 'minor' };

  it('mineur devenu adulte : avis affiché une fois, puis effacé', async () => {
    const { services, api, db } = await createTestServices({ me: minor });
    await setMeta(db, 'lastAgeBand', 'minor');
    api.on('GET', '/api/me', ok(lea));
    const repos = createRepos(services);
    await repos.me.refresh();
    expect(await repos.me.adultNotice()).toBe(true);
    await repos.me.dismissAdultNotice();
    expect(await repos.me.adultNotice()).toBe(false);
    expect(await getMeta(db, 'lastAgeBand')).toBe('adult');
  });

  it('adulte à l’installation : jamais d’avis', async () => {
    const { services, api, db } = await createTestServices({ me: lea });
    api.on('GET', '/api/me', ok(lea));
    const repos = createRepos(services);
    await repos.me.refresh();
    expect(await getMeta(db, 'lastAgeBand')).toBe('adult');
    expect(await repos.me.adultNotice()).toBe(false);
  });

  it('mineur : tranche notée, pas d’avis', async () => {
    const { services, api, db } = await createTestServices({ me: minor });
    api.on('GET', '/api/me', ok(minor));
    const repos = createRepos(services);
    await repos.me.refresh();
    expect(await getMeta(db, 'lastAgeBand')).toBe('minor');
    expect(await repos.me.adultNotice()).toBe(false);
  });
});
