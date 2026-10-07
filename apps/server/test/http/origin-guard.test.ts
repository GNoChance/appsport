import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
  ctx.app.post('/api/test/echo', (c) => c.json({ ok: true }));
  ctx.app.put('/api/test/echo', (c) => c.json({ ok: true }));
  ctx.app.delete('/api/test/echo', (c) => c.body(null, 204));
  ctx.app.get('/api/test/echo', (c) => c.json({ ok: true }));
  ctx.app.get('/api/test/whoami', (c) => c.json({ user: c.get('user') ?? null }));
});
afterEach(() => ctx.close());

describe('originGuard', () => {
  it('refuse une origine étrangère ou absente sur les méthodes à effet de bord', async () => {
    for (const init of [
      { method: 'POST', json: {}, origin: 'https://evil.example' },
      { method: 'POST', json: {}, origin: null },
      { method: 'PUT', json: {}, origin: 'https://evil.example' },
      { method: 'DELETE', origin: 'https://evil.example' },
    ]) {
      const res = await ctx.request('/api/test/echo', init);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'origin_mismatch' });
    }
  });

  it('exige application/json sur POST, PUT et PATCH', async () => {
    const res = await ctx.request('/api/test/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: 'unsupported_media_type' });
    const noType = await ctx.request('/api/test/echo', { method: 'PUT' });
    expect(noType.status).toBe(415);
  });

  it('laisse passer les requêtes légitimes', async () => {
    const post = await ctx.request('/api/test/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
    expect(post.status).toBe(200);
    expect((await ctx.request('/api/test/echo', { method: 'DELETE' })).status).toBe(204);
    expect((await ctx.request('/api/test/echo', { origin: 'https://evil.example' })).status).toBe(200);
  });

  it('ignore les en-têtes Tailscale-User-* (P-AUT-7)', async () => {
    const res = await ctx.request('/api/test/whoami', {
      headers: { 'Tailscale-User-Login': 'admin@exemple' },
    });
    expect(await res.json()).toEqual({ user: null });
    const srcDir = join(__dirname, '../../src');
    const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' });
    for (const f of files.filter((p) => p.endsWith('.ts'))) {
      expect(readFileSync(join(srcDir, f), 'utf8')).not.toMatch(/tailscale-user/i);
    }
  });
});
