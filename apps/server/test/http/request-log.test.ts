import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../src/logger';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

describe('requestLog', () => {
  it('journalise la route et le statut, sans chaîne de requête, cookie, corps ni identifiant', async () => {
    const lines: string[] = [];
    ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
    ctx.app.post('/api/test/items/:id', (c) => c.json({ ok: true }));
    const res = await ctx.request('/api/test/items/123?q=TEMOIN_QS', {
      method: 'POST',
      cookie: 'dev-session=TEMOIN_COOKIE',
      json: { pain: 'TEMOIN_C2' },
    });
    expect(res.status).toBe(200);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] as string);
    expect(line).toMatchObject({ msg: 'request', method: 'POST', route: '/api/test/items/:id', status: 200 });
    expect(typeof line.durationMs).toBe('number');
    expect(line.requestId).toEqual(expect.any(String));
    expect(line.requestId).not.toBe('');
    for (const temoin of ['TEMOIN_QS', 'TEMOIN_COOKIE', 'TEMOIN_C2', '123']) {
      expect(lines.join('\n')).not.toContain(temoin);
    }
  });
});
