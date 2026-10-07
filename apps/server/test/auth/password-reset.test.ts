import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acceptInvitation } from '../../src/auth/invitations';
import { checkPasswordReset } from '../../src/auth/password-reset';
import { runCli } from '../../src/cli';
import { createTestContext, createUser, login, type TestContext, type TestUser } from '../support';

let ctx: TestContext;
afterEach(() => ctx?.close());

const NEW = 'une phrase de passe neuve';
const IP = '100.64.0.7';
const BAD_CODE = '0000-0000-0000-0000';

async function setup(): Promise<{ admin: TestUser; lea: TestUser; adminCookie: string }> {
  ctx = await createTestContext();
  const admin = await createUser(ctx, { username: 'porteur', role: 'admin', password: 'quatorze carac' });
  const lea = await createUser(ctx, { username: 'lea', password: 'ancien mot de passe' });
  return { admin, lea, adminCookie: await login(ctx, 'porteur', admin.password) };
}

const link = async (adminCookie: string, id: string) => {
  const res = await ctx.request(`/api/admin/members/${id}/reset-link`, {
    method: 'POST',
    cookie: adminCookie,
    json: {},
  });
  return { res, body: (await res.json()) as { code: string; link: string; expiresAt: string } };
};
const check = (code: string, ip = IP) =>
  ctx.request('/api/auth/reset/check', { method: 'POST', json: { code }, ip });
const reset = (code: string, newPassword: string, ip = IP) =>
  ctx.request('/api/auth/reset', { method: 'POST', json: { code, newPassword }, ip });
const events = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).execute();

describe('liens de réinitialisation (R-RST-1 à R-RST-4)', () => {
  it('crée le lien, le vérifie, le consomme une fois et révoque les sessions', async () => {
    const { lea, adminCookie } = await setup();
    const old = await login(ctx, 'lea', lea.password);
    const { body: r } = await link(adminCookie, lea.id);
    expect(r.link).toBe(`https://appsport.test.ts.net/reset#${r.code}`);
    expect(r.expiresAt).toBe('2026-10-07T10:00:00.000Z');

    const checked = await check(r.code.toLowerCase());
    expect(await checked.json()).toEqual({ username: 'lea', role: 'member' });

    const done = await reset(r.code, NEW);
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({ id: lea.id, username: 'lea', role: 'member' });
    expect(done.headers.get('set-cookie')).toContain('session=');
    const fresh = done.headers.get('set-cookie')?.split(';')[0] as string;
    expect((await ctx.request('/api/me', { cookie: fresh })).status).toBe(200);
    expect((await ctx.request('/api/me', { cookie: old })).status).toBe(401);

    const again = await reset(r.code, NEW);
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: 'reset_invalid' });
    expect(await events('password_reset_created')).toHaveLength(1);
    expect(await events('password_reset_used')).toHaveLength(1);
    await login(ctx, 'lea', NEW);
  });

  it('expire au bout de 24 h', async () => {
    const { lea, adminCookie } = await setup();
    const { body: r } = await link(adminCookie, lea.id);
    ctx.clock.advance(24 * 3_600_000);
    expect(await (await check(r.code)).json()).toEqual({ error: 'reset_invalid' });
    expect(await (await reset(r.code, NEW)).json()).toEqual({ error: 'reset_invalid' });
  });

  it('un nouveau lien annule le précédent', async () => {
    const { lea, adminCookie } = await setup();
    const { body: first } = await link(adminCookie, lea.id);
    const { body: second } = await link(adminCookie, lea.id);
    expect((await check(first.code)).status).toBe(400);
    expect((await check(second.code)).status).toBe(200);
  });

  it('un changement de mot de passe annule le lien (R-RST-2)', async () => {
    const { lea, adminCookie } = await setup();
    const { body: r } = await link(adminCookie, lea.id);
    const cookie = await login(ctx, 'lea', lea.password);
    const changed = await ctx.request('/api/auth/password', {
      method: 'POST',
      cookie,
      json: { currentPassword: lea.password, newPassword: NEW },
    });
    expect(changed.status).toBe(204);
    expect((await check(r.code)).status).toBe(400);
  });

  it('débloque la connexion après 10 échecs', async () => {
    const { lea, adminCookie } = await setup();
    for (let i = 0; i < 10; i += 1) {
      await ctx.request('/api/auth/login', {
        method: 'POST',
        json: { username: 'lea', password: 'faux faux faux faux' },
        ip: '100.64.0.50',
      });
    }
    const blocked = await ctx.request('/api/auth/login', {
      method: 'POST',
      json: { username: 'lea', password: lea.password },
      ip: '100.64.0.50',
    });
    expect(blocked.status).toBe(429);
    const { body: r } = await link(adminCookie, lea.id);
    expect((await reset(r.code, NEW)).status).toBe(200);
    const res = await ctx.request('/api/auth/login', {
      method: 'POST',
      json: { username: 'lea', password: NEW },
      ip: '100.64.0.50',
    });
    expect(res.status).toBe(200);
  });

  it('refuse un mot de passe rejeté sans consommer le lien', async () => {
    const { lea, adminCookie } = await setup();
    const { body: r } = await link(adminCookie, lea.id);
    const res = await reset(r.code, 'lea lea lea lea');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'password_rejected', reason: 'contains_username' });
    expect((await check(r.code)).status).toBe(200);
  });

  it('un compte désactivé ne peut pas réinitialiser', async () => {
    const { lea, adminCookie } = await setup();
    const { body: r } = await link(adminCookie, lea.id);
    await ctx.deps.db.updateTable('user').set({ status: 'disabled' }).where('id', '=', lea.id).execute();
    const res = await reset(r.code, NEW);
    expect(await res.json()).toEqual({ error: 'account_disabled' });
  });

  it('un administrateur doit choisir 14 caractères', async () => {
    const { adminCookie } = await setup();
    const other = await createUser(ctx, { username: 'second', role: 'admin' });
    const { body: r } = await link(adminCookie, other.id);
    expect(await (await check(r.code)).json()).toEqual({ username: 'second', role: 'admin' });
    const short = await reset(r.code, 'treize carac');
    expect(await short.json()).toEqual({ error: 'password_rejected', reason: 'too_short' });
  });

  it('refuse un lien pour soi-même (R-RST-4)', async () => {
    const { admin, adminCookie } = await setup();
    const { res, body } = await link(adminCookie, admin.id);
    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'reset_self_forbidden' });
  });

  it('limite à 20 essais par heure et par IP, partagés entre check et reset (P-AUT-2)', async () => {
    await setup();
    for (let i = 0; i < 19; i += 1) expect((await check(BAD_CODE)).status).toBe(400);
    expect((await reset(BAD_CODE, NEW)).status).toBe(400);
    const blocked = await check(BAD_CODE);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: 'rate_limited' });
    expect((await check(BAD_CODE, '100.64.0.8')).status).toBe(400);
    ctx.clock.advance(3_600_000);
    expect((await check(BAD_CODE)).status).toBe(400);
  });
});

describe('admin:reset (CLI)', () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('affiche trois lignes pour un pseudo normalisé, refuse un inconnu', async () => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-reset-'));
    writeFileSync(join(dir, '.appsport-volume'), '');
    const env = { APP_ORIGIN: 'https://appsport.test.ts.net', APPSPORT_DATA_DIR: dir };
    const out: string[] = [];
    const err: string[] = [];
    const o = (l: string): void => {
      out.push(l);
    };
    const e = (l: string): void => {
      err.push(l);
    };
    expect(await runCli(['init'], env, o, e)).toBe(0);
    out.length = 0;
    expect(await runCli(['admin:reset', 'inconnu'], env, o, e)).toBe(1);
    expect(out).toEqual([]);
    expect(err.at(-1)).toBe('Pseudo inconnu : inconnu');

    expect(await runCli(['admin:bootstrap', '--birth-date', '1985-03-02'], env, o, e)).toBe(0);
    const code = (out[2] as string).slice('Code : '.length);
    out.length = 0;
    const c = await createTestContext({ dbPath: join(dir, 'appsport.db') });
    try {
      await acceptInvitation(
        c.deps,
        { code, username: 'porteur', password: 'quatorze carac', termsVersion: '1.0' },
        null,
      );
      expect(await runCli(['admin:reset', 'PORTEUR'], env, o, e)).toBe(0);
      expect(out).toHaveLength(3);
      expect(out[0]).toBe('Lien de réinitialisation pour porteur (valable 24 h)');
      expect(out[1]).toMatch(
        /^Lien : https:\/\/appsport\.test\.ts\.net\/reset#[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/,
      );
      const resetCode = (out[1] as string).split('#')[1] as string;
      expect(out[2]).toBe(`Code : ${resetCode}`);
      expect(await checkPasswordReset(c.deps.db, c.deps, resetCode)).toEqual({
        username: 'porteur',
        role: 'admin',
      });
    } finally {
      c.close();
    }
  });
});
