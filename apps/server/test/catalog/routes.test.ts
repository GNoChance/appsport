import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getServerMeta } from '../../src/db/server-meta';
import { createTestContext, createUserAndLogin, type TestContext } from '../support';

const REPO_DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../data');

let ctx: TestContext;
afterEach(() => ctx?.close());

async function setup(contentDir = REPO_DATA): Promise<string> {
  ctx = await createTestContext({ config: { contentDir } });
  const { cookie } = await createUserAndLogin(ctx);
  return cookie;
}

describe('GET /api/catalog', () => {
  it('sans session : 401', async () => {
    ctx = await createTestContext({ config: { contentDir: REPO_DATA } });
    expect((await ctx.request('/api/catalog')).status).toBe(401);
  });

  it('avec session : 200, version, ETag et no-cache', async () => {
    const cookie = await setup();
    const res = await ctx.request('/api/catalog', { cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: string; exercises: unknown[] };
    expect(body.version).toBe((await getServerMeta(ctx.deps.db)).catalogVersion);
    expect(body.exercises).toEqual([]);
    expect(res.headers.get('ETag')).toBe(`"${body.version}"`);
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('If-None-Match identique, faible ou dans une liste : 304 sans corps', async () => {
    const cookie = await setup();
    const etag = (await ctx.request('/api/catalog', { cookie })).headers.get('ETag') as string;
    for (const value of [etag, `W/${etag}`, `"autre", ${etag}`]) {
      const res = await ctx.request('/api/catalog', { cookie, headers: { 'If-None-Match': value } });
      expect(res.status).toBe(304);
      expect(await res.text()).toBe('');
      expect(res.headers.get('ETag')).toBe(etag);
    }
  });

  it('If-None-Match différent : 200', async () => {
    const cookie = await setup();
    const res = await ctx.request('/api/catalog', { cookie, headers: { 'If-None-Match': '"autre"' } });
    expect(res.status).toBe(200);
  });

  it('catalogue invalide jamais chargé : 500 internal', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'appsport-catalog-'));
    try {
      mkdirSync(join(dir, 'illustrations'));
      writeFileSync(join(dir, 'illustrations/manifest.json'), '[');
      const cookie = await setup(dir);
      const res = await ctx.request('/api/catalog', { cookie });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'internal' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
