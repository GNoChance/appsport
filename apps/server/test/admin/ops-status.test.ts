import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readOpsStatus } from '../../src/admin/ops-status';
import { createTestContext, createUser, login, type TestContext } from '../support';

let dir: string;
let ctx: TestContext | undefined;
afterEach(() => {
  ctx?.close();
  ctx = undefined;
  rmSync(dir, { recursive: true, force: true });
});

const write = (content: string): void => {
  mkdirSync(join(dir, 'ops'), { recursive: true });
  writeFileSync(join(dir, 'ops', 'status.json'), content);
};

describe('readOpsStatus (08 §9)', () => {
  it('renvoie null si le fichier est absent, illisible ou invalide', async () => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-ops-'));
    expect(await readOpsStatus(dir)).toBeNull();
    write('{pas du json');
    expect(await readOpsStatus(dir)).toBeNull();
    write(JSON.stringify({ backup: { at: 'x', ok: 'oui' } }));
    expect(await readOpsStatus(dir)).toBeNull();
  });

  it('renvoie le contenu validé', async () => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-ops-'));
    const status = {
      backup: { at: '2026-10-06T01:30:00Z', ok: true },
      deploy: { at: '2026-10-05T09:00:00Z', version: 'v1.2.3', previousVersion: null, ok: true },
    };
    write(JSON.stringify(status));
    expect(await readOpsStatus(dir)).toEqual(status);
  });
});

describe('GET /api/admin/ops-status', () => {
  it('renvoie la version et un état nul sans fichier ; refuse un membre', async () => {
    dir = mkdtempSync(join(tmpdir(), 'appsport-ops-'));
    ctx = await createTestContext({ config: { dataDir: dir, version: 'v1.2.3' } });
    const admin = await createUser(ctx, { role: 'admin' });
    const member = await createUser(ctx);
    const res = await ctx.request('/api/admin/ops-status', {
      cookie: await login(ctx, admin.username, admin.password),
    });
    expect(await res.json()).toEqual({ version: 'v1.2.3', opsStatus: null });
    const denied = await ctx.request('/api/admin/ops-status', {
      cookie: await login(ctx, member.username, member.password),
    });
    expect(denied.status).toBe(403);
  });
});
