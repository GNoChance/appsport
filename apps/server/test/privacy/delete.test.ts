import { entityRules } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteAccount } from '../../src/privacy/delete-account';
import { createTestContext, createUser, insertFixtureRow, login, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const WRONG = 'faux faux faux faux';
const IP = '100.64.0.1';
const del = (cookie: string, json: unknown) =>
  ctx.request('/api/me/delete', { method: 'POST', cookie, json, ip: IP });
const adminDel = (cookie: string, id: string, json: unknown) =>
  ctx.request(`/api/admin/members/${id}/delete`, { method: 'POST', cookie, json, ip: IP });
const userExists = async (id: string) =>
  (await ctx.deps.db.selectFrom('user').select('id').where('id', '=', id).executeTakeFirst()) !== undefined;
const events = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).execute();

/** Une ligne dans chaque table liée du registre, plus gym, gym_equipment, gym_history et invitation.used_by. */
async function plant(userId: string): Promise<void> {
  const { db } = ctx.deps;
  for (const [table, rule] of Object.entries(entityRules)) {
    if (table === 'user' || table === 'session' || rule.onUserDelete !== 'cascade') continue;
    if (rule.ownerColumn !== 'owner_id' && rule.ownerColumn !== 'user_id') continue;
    await insertFixtureRow(db, table, {
      [rule.ownerColumn === 'owner_id' ? 'ownerId' : 'userId']: userId,
      ...(rule.columns.includes('updated_by') ? { updatedBy: userId } : {}),
    });
  }
  const gym = await insertFixtureRow(db, 'gym', { createdBy: userId, updatedBy: userId });
  await insertFixtureRow(db, 'gym_equipment', { gymId: gym.id, addedBy: userId });
  await insertFixtureRow(db, 'gym_history', { gymId: gym.id, authorId: userId });
  await insertFixtureRow(db, 'invitation', { usedBy: userId, createdBy: userId });
}

/** Nombre de cellules (hors security_event) qui contiennent l'identifiant. */
async function occurrences(id: string): Promise<string[]> {
  const { sqlite } = ctx.deps;
  const tables = sqlite
    .prepare("select name from sqlite_schema where type = 'table' and name not like 'sqlite_%'")
    .all() as { name: string }[];
  const found: string[] = [];
  for (const { name } of tables) {
    if (name === 'security_event') continue;
    const cols = sqlite.prepare(`select name from pragma_table_info('${name}')`).all() as { name: string }[];
    for (const { name: col } of cols) {
      const row = sqlite
        .prepare(`select count(*) as n from "${name}" where cast("${col}" as text) like ?`)
        .get(`%${id}%`) as { n: number };
      if (row.n > 0) found.push(`${name}.${col}`);
    }
  }
  return found;
}

async function setup() {
  ctx = await createTestContext();
  const admin = await createUser(ctx, { username: 'porteur', role: 'admin', password: 'quatorze carac' });
  const lea = await createUser(ctx, { username: 'Léa' });
  return { admin, lea };
}

describe('POST /api/me/delete (R-SUP-1 à R-SUP-6, P-DRT-3)', () => {
  it('mot de passe faux : invalid_credentials et compte intact', async () => {
    const { lea } = await setup();
    const cookie = await login(ctx, 'Léa', lea.password);
    const res = await del(cookie, { password: WRONG });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
    expect(await userExists(lea.id)).toBe(true);
  });

  it('5 faux puis le bon : 429 rate_limited, compte intact (P-AUT-5)', async () => {
    const { lea } = await setup();
    const cookie = await login(ctx, 'Léa', lea.password);
    for (let i = 0; i < 5; i += 1) expect((await del(cookie, { password: WRONG })).status).toBe(401);
    const res = await del(cookie, { password: lea.password });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited' });
    expect(await userExists(lea.id)).toBe(true);
  });

  it('supprime le compte, toutes ses données et ne laisse aucune trace de son identifiant', async () => {
    const { lea } = await setup();
    const cookie = await login(ctx, 'Léa', lea.password);
    const other = await login(ctx, 'Léa', lea.password);
    await plant(lea.id);
    const gymsBefore = await ctx.deps.db.selectFrom('gym').select('id').execute();
    await ctx.deps.db
      .insertInto('securityEvent')
      .values({
        id: 'ev-before',
        at: '2026-10-05T10:00:00.000Z',
        type: 'login_succeeded',
        actorId: lea.id,
        targetId: lea.id,
        outcome: 'success',
      })
      .execute();

    const res = await del(cookie, { password: lea.password });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i);

    expect(await userExists(lea.id)).toBe(false);
    expect(await occurrences(lea.id)).toEqual([]);
    const fks = ctx.deps.sqlite
      .prepare(
        `select m.name as tbl, f."on_delete" as onDelete from sqlite_schema m, pragma_foreign_key_list(m.name) f
         where m.type = 'table' and f."table" = 'user'`,
      )
      .all() as { tbl: string; onDelete: string }[];
    expect(fks.length).toBeGreaterThan(0);
    for (const fk of fks) expect(['CASCADE', 'SET NULL']).toContain(fk.onDelete);

    const sessions = await ctx.deps.db.selectFrom('session').selectAll().execute();
    expect(sessions).toHaveLength(2);
    for (const s of sessions) {
      expect(s).toMatchObject({ revokedReason: 'account_deleted', userId: null });
      expect(s.revokedAt).not.toBeNull();
    }
    expect((await ctx.deps.db.selectFrom('gym').select('id').execute()).length).toBe(gymsBefore.length);
    const history = await ctx.deps.db.selectFrom('gymHistory').selectAll().execute();
    expect(history).toHaveLength(1);
    expect(history[0]?.authorId).toBeNull();

    const [event, ...rest] = await events('account_deleted');
    expect(rest).toEqual([]);
    expect(event).toMatchObject({ actorId: lea.id, targetId: lea.id, details: null, outcome: 'success' });
    // le journal garde ses lignes antérieures
    const kept = (await events('login_succeeded')).filter((e) => e.id === 'ev-before');
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ actorId: lea.id, targetId: lea.id });

    const gone = await ctx.request('/api/me', { cookie: other });
    expect(gone.status).toBe(410);
    expect(await gone.json()).toEqual({ error: 'account_deleted' });
  });

  it('détache les références non cascadées des miroirs avec une nouvelle révision (R-SUP-3)', async () => {
    const { lea } = await setup();
    const { db } = ctx.deps;
    const cookie = await login(ctx, 'Léa', lea.password);
    const gym = await insertFixtureRow(db, 'gym', { createdBy: lea.id, updatedBy: lea.id });
    const equipment = await insertFixtureRow(db, 'gym_equipment', { gymId: gym.id, addedBy: lea.id });
    const peer = await insertFixtureRow(db, 'user', { updatedBy: lea.id });
    const revs = async () => ({
      gym: await db
        .selectFrom('gym')
        .select(['createdBy', 'updatedBy', 'rev', 'updatedAt'])
        .where('id', '=', gym.id as string)
        .executeTakeFirstOrThrow(),
      eq: await db
        .selectFrom('gymEquipment')
        .select(['addedBy', 'rev'])
        .where('id', '=', equipment.id as string)
        .executeTakeFirstOrThrow(),
      peer: await db
        .selectFrom('user')
        .select(['updatedBy', 'rev'])
        .where('id', '=', peer.id as string)
        .executeTakeFirstOrThrow(),
    });
    const before = await revs();
    expect((await del(cookie, { password: lea.password })).status).toBe(204);
    const after = await revs();
    expect(after.gym).toMatchObject({
      createdBy: null,
      updatedBy: null,
      updatedAt: '2026-10-06T10:00:00.000Z',
    });
    expect(after.eq.addedBy).toBeNull();
    expect(after.peer.updatedBy).toBeNull();
    expect(after.gym.rev).toBeGreaterThan(before.gym.rev);
    expect(after.eq.rev).toBeGreaterThan(before.eq.rev);
    expect(after.peer.rev).toBeGreaterThan(before.peer.rev);
    expect(await occurrences(lea.id)).toEqual([]);
  });

  it('la seule table anonymisée du registre est `session`', () => {
    expect(
      Object.entries(entityRules)
        .filter(([, r]) => r.onUserDelete === 'anonymize')
        .map(([t]) => t),
    ).toEqual(['session']);
  });
});

describe('POST /api/admin/members/:id/delete (R-SUP-2)', () => {
  it("mot de passe de l'admin faux : 401 invalid_credentials, compte intact", async () => {
    const { admin, lea } = await setup();
    const cookie = await login(ctx, 'porteur', admin.password);
    const res = await adminDel(cookie, lea.id, { confirmUsername: 'Léa', password: WRONG });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
    expect(await userExists(lea.id)).toBe(true);
  });

  it('pseudo de confirmation différent : validation, compte intact', async () => {
    const { admin, lea } = await setup();
    const cookie = await login(ctx, 'porteur', admin.password);
    const res = await adminDel(cookie, lea.id, { confirmUsername: 'leo', password: admin.password });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'validation' });
    expect(await userExists(lea.id)).toBe(true);
  });

  it('confirmation insensible à la casse et aux accents composés : « LÉA » pour « Léa »', async () => {
    const { admin, lea } = await setup();
    const cookie = await login(ctx, 'porteur', admin.password);
    await plant(lea.id);
    const res = await adminDel(cookie, lea.id, { confirmUsername: 'LÉA', password: admin.password });
    expect(res.status).toBe(204);
    expect(await userExists(lea.id)).toBe(false);
    expect(await occurrences(lea.id)).toEqual([]);
    expect(await events('account_deleted')).toMatchObject([
      { actorId: admin.id, targetId: lea.id, details: null },
    ]);
  });

  it('membre inconnu : 404 not_found', async () => {
    const { admin } = await setup();
    const cookie = await login(ctx, 'porteur', admin.password);
    const res = await adminDel(cookie, '0190a000-0000-7000-8000-000000000000', {
      confirmUsername: 'x',
      password: admin.password,
    });
    expect(res.status).toBe(404);
  });

  it('refusée à un membre', async () => {
    const { lea } = await setup();
    const cookie = await login(ctx, 'Léa', lea.password);
    const res = await adminDel(cookie, lea.id, { confirmUsername: 'Léa', password: lea.password });
    expect(res.status).toBe(403);
  });
});

describe('dernier administrateur (R-SUP-4)', () => {
  it('refusé : 409 last_admin par les deux routes, compte intact', async () => {
    ctx = await createTestContext();
    const admin = await createUser(ctx, { username: 'porteur', role: 'admin', password: 'quatorze carac' });
    const cookie = await login(ctx, 'porteur', admin.password);
    const self = await del(cookie, { password: admin.password });
    expect(self.status).toBe(409);
    expect(await self.json()).toMatchObject({ error: 'last_admin' });
    const viaAdmin = await adminDel(cookie, admin.id, {
      confirmUsername: 'porteur',
      password: admin.password,
    });
    expect(viaAdmin.status).toBe(409);
    expect(await viaAdmin.json()).toMatchObject({ error: 'last_admin' });
    expect(await userExists(admin.id)).toBe(true);
    expect(await events('account_deleted')).toEqual([]);
  });

  it('deleteAccount avec enforceLastAdmin: false supprime le dernier admin (réapplication)', async () => {
    ctx = await createTestContext();
    const admin = await createUser(ctx, { username: 'porteur', role: 'admin' });
    await expect(
      ctx.deps.db
        .transaction()
        .execute((trx) => deleteAccount(trx, ctx.deps, admin.id, { actorId: null, ip: null })),
    ).rejects.toMatchObject({ code: 'last_admin' });
    await ctx.deps.db
      .transaction()
      .execute((trx) =>
        deleteAccount(trx, ctx.deps, admin.id, { actorId: null, ip: null }, { enforceLastAdmin: false }),
      );
    expect(await userExists(admin.id)).toBe(false);
    const remaining = await ctx.deps.db.selectFrom('user').select('id').where('role', '=', 'admin').execute();
    expect(remaining).toEqual([]);
  });

  it('compte inconnu : not_found', async () => {
    ctx = await createTestContext();
    await expect(
      ctx.deps.db
        .transaction()
        .execute((trx) => deleteAccount(trx, ctx.deps, 'inconnu', { actorId: null, ip: null })),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
