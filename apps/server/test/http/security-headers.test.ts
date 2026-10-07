import { EPOCH_HEADER } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { getServerMeta } from '../../src/db/server-meta';
import { createTestContext, type TestContext } from '../support';

const HEADER_NAMES = [
  'strict-transport-security',
  'content-security-policy',
  'referrer-policy',
  'x-content-type-options',
  'permissions-policy',
];

function pick(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of HEADER_NAMES) {
    const v = headers.get(name);
    if (v !== null) out[name] = v;
  }
  return out;
}

const EXPECTED = {
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

let ctx: TestContext;
afterEach(() => ctx.close());

describe('en-têtes de sécurité', () => {
  it('sont posés sur une réponse normale, un 404 et une erreur 500', async () => {
    ctx = await createTestContext();
    ctx.app.get('/api/test/boom', () => {
      throw new Error('boom');
    });
    const ok = await ctx.request('/api/health');
    const missing = await ctx.request('/api/inexistant');
    const boom = await ctx.request('/api/test/boom');
    expect(ok.status).toBe(200);
    expect(missing.status).toBe(404);
    expect(boom.status).toBe(500);
    for (const res of [ok, missing, boom]) expect(pick(res.headers)).toEqual(EXPECTED);
  });
});

describe("en-tête d'époque", () => {
  it('suit serverEpoch sur /api/health et sur un 404 /api/…', async () => {
    ctx = await createTestContext();
    const meta = await getServerMeta(ctx.deps.db);
    expect((await ctx.request('/api/health')).headers.get(EPOCH_HEADER)).toBe(meta.serverEpoch);
    expect((await ctx.request('/api/inexistant')).headers.get(EPOCH_HEADER)).toBe(meta.serverEpoch);
  });

  it('est absent hors /api', async () => {
    ctx = await createTestContext();
    ctx.app.get('/privacy', (c) => c.text('ok'));
    const res = await ctx.request('/privacy');
    expect(res.status).toBe(200);
    expect(res.headers.get(EPOCH_HEADER)).toBeNull();
  });

  it('est omis quand server_meta est illisible', async () => {
    ctx = await createTestContext();
    ctx.deps.sqlite.close();
    expect((await ctx.request('/api/inexistant')).headers.get(EPOCH_HEADER)).toBeNull();
  });
});
