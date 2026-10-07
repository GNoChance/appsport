import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapAdminInvitation } from '../../src/auth/bootstrap';
import { hashSecret } from '../../src/auth/secret';
import { runCli } from '../../src/cli';
import { openDatabase } from '../../src/db/open';
import { createTestContext, createUser, type TestContext } from '../support';

let ctx: TestContext | undefined;
afterEach(() => ctx?.close());

async function open(): Promise<TestContext> {
  ctx = await createTestContext();
  return ctx;
}

const check = (c: TestContext, code: string) =>
  c.request('/api/invitations/check', { method: 'POST', json: { code }, ip: '100.64.0.7' });
const accept = (c: TestContext, code: string, username: string, password: string) =>
  c.request('/api/invitations/accept', {
    method: 'POST',
    json: { code, username, password, termsVersion: '1.0' },
    ip: '100.64.0.7',
  });

describe('bootstrapAdminInvitation (R-ROLE-5)', () => {
  it("crée l'invitation admin valable 24 h, minimum de 14 caractères", async () => {
    const c = await open();
    const r = await bootstrapAdminInvitation(c.deps, '1985-03-02');
    expect(r.expiresAt).toBe('2026-10-07T10:00:00.000Z');
    expect(r.link).toBe(`https://appsport.test.ts.net/invite#${r.code}`);
    expect(await (await check(c, r.code)).json()).toEqual({ birthDate: '1985-03-02', role: 'admin' });
    const short = await accept(c, r.code, 'porteur', 'treize carac');
    expect(await short.json()).toEqual({ error: 'password_rejected', reason: 'too_short' });
    const ok = await accept(c, r.code, 'porteur', 'quatorze carac');
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ role: 'admin', birthDate: '1985-03-02' });
  });

  it('une seconde invitation révoque la première', async () => {
    const c = await open();
    const first = await bootstrapAdminInvitation(c.deps, '1985-03-02');
    const second = await bootstrapAdminInvitation(c.deps, '1985-03-02');
    expect(await (await check(c, first.code)).json()).toEqual({ error: 'invitation_revoked' });
    const row = await c.deps.db
      .selectFrom('invitation')
      .selectAll()
      .where('codeHash', '=', hashSecret(first.code.replaceAll('-', '')))
      .executeTakeFirstOrThrow();
    expect(row.birthDate).toBeNull();
    expect((await check(c, second.code)).status).toBe(200);
  });

  it('refuse quand un administrateur existe', async () => {
    const c = await open();
    await createUser(c, { role: 'admin' });
    await expect(bootstrapAdminInvitation(c.deps, '1985-03-02')).rejects.toMatchObject({
      code: 'conflict',
      extra: { reason: 'admin_exists' },
    });
  });

  it('refuse un mineur', async () => {
    const c = await open();
    await expect(bootstrapAdminInvitation(c.deps, '2015-01-01')).rejects.toMatchObject({
      code: 'under_min_age',
    });
  });
});

describe('admin:bootstrap (CLI)', () => {
  let dir: string;
  let env: Record<string, string>;
  const out: string[] = [];
  const err: string[] = [];
  const o = (l: string): void => {
    out.push(l);
  };
  const e = (l: string): void => {
    err.push(l);
  };

  async function init(): Promise<void> {
    out.length = 0;
    err.length = 0;
    dir = mkdtempSync(join(tmpdir(), 'appsport-boot-'));
    env = {
      APP_ORIGIN: 'https://appsport.test.ts.net',
      APPSPORT_DATA_DIR: dir,
      HOST: '127.0.0.1',
      PORT: '0',
    };
    writeFileSync(join(dir, '.appsport-volume'), '');
    expect(await runCli(['init'], env, o, e)).toBe(0);
    out.length = 0;
  }
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("écrit exactement trois lignes et ne stocke que l'empreinte", async () => {
    await init();
    expect(await runCli(['admin:bootstrap', '--birth-date', '1985-03-02'], env, o, e)).toBe(0);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('Invitation administrateur (valable 24 h)');
    expect(out[1]).toMatch(
      /^Lien : https:\/\/appsport\.test\.ts\.net\/invite#[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/,
    );
    const code = out[1]?.split('#')[1] as string;
    expect(out[2]).toBe(`Code : ${code}`);
    const { sqlite, db } = openDatabase(join(dir, 'appsport.db'));
    const rows = await db.selectFrom('invitation').selectAll().execute();
    await db.destroy();
    sqlite.close();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isAdminBootstrap: 1, createdBy: null, birthDate: '1985-03-02' });
    expect(Date.parse(rows[0]?.expiresAt ?? '') - Date.parse(rows[0]?.createdAt ?? '')).toBe(86_400_000);
    expect(rows[0]?.codeHash).toBe(hashSecret(code.replaceAll('-', '')));
    expect(JSON.stringify(rows)).not.toContain(code.replaceAll('-', ''));
  });

  it.each([[[]], [['--birth-date', '1985-02-30']], [['--birth-date', '2015-01-01']]])(
    'entrée refusée %j : code 1 et rien sur stdout',
    async (args) => {
      await init();
      expect(await runCli(['admin:bootstrap', ...args], env, o, e)).toBe(1);
      expect(out).toEqual([]);
      expect(err).toHaveLength(1);
    },
  );
});
