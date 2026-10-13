import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { httpError } from '../../src/http/errors';
import { parseJson, parseQuery } from '../../src/http/validate';
import { createLogger } from '../../src/logger';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
let lines: string[];
afterEach(() => ctx.close());

async function setup() {
  lines = [];
  ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
}

describe('erreurs HTTP', () => {
  it('httpError prend le statut dans ERROR_STATUS et ajoute les champs', async () => {
    await setup();
    ctx.app.get('/api/test/dup', () => {
      throw httpError('gym_duplicate', { gymId: 'g1' });
    });
    const res = await ctx.request('/api/test/dup');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'gym_duplicate', gymId: 'g1' });
  });

  it('une erreur inattendue donne 500 internal sans fuite', async () => {
    await setup();
    ctx.app.get('/api/test/boom', () => {
      throw new Error('boom TEMOIN');
    });
    const res = await ctx.request('/api/test/boom');
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'internal' });
    expect(text).not.toContain('boom');
    expect(text).not.toContain('.ts:');
    const errorLine = lines.map((l) => JSON.parse(l)).find((l) => l.level === 'error');
    expect(errorLine).toMatchObject({ msg: 'unhandled_error', code: 'internal', event: 'Error' });
    expect(lines.join('\n')).not.toContain('TEMOIN');
  });

  it('une route inconnue donne 404 not_found', async () => {
    await setup();
    const res = await ctx.request('/api/inexistant');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('parseJson et parseQuery', () => {
  const schema = z.object({ n: z.number() });

  it('refuse un JSON invalide', async () => {
    await setup();
    ctx.app.post('/api/test/p', async (c) => c.json(await parseJson(c, schema)));
    const res = await ctx.request('/api/test/p', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation' });
  });

  it('renvoie les anomalies avec chemin et message', async () => {
    await setup();
    ctx.app.post('/api/test/p', async (c) => c.json(await parseJson(c, schema)));
    const res = await ctx.request('/api/test/p', { method: 'POST', json: { n: 'x' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('validation');
    expect(body.issues[0]).toEqual({ path: 'n', message: expect.any(String) });
  });

  it('accepte un corps valide', async () => {
    await setup();
    ctx.app.post('/api/test/p', async (c) => c.json(await parseJson(c, schema)));
    const res = await ctx.request('/api/test/p', { method: 'POST', json: { n: 4 } });
    expect(await res.json()).toEqual({ n: 4 });
  });

  it('parseQuery valide la chaîne de requête', async () => {
    await setup();
    ctx.app.get('/api/test/q', (c) => c.json(parseQuery(c, z.object({ limit: z.coerce.number() }))));
    expect(await (await ctx.request('/api/test/q?limit=5')).json()).toEqual({ limit: 5 });
    const bad = await ctx.request('/api/test/q?limit=abc');
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe('validation');
  });
});
