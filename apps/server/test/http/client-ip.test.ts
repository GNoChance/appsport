import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientIp } from '../../src/http/client-ip';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
  ctx.app.get('/api/test/ip', (c) => c.json({ ip: clientIp(c) }));
});
afterEach(() => ctx.close());

async function ipOf(xff?: string, peer?: string): Promise<string | null> {
  const headers: Record<string, string> = xff === undefined ? {} : { 'X-Forwarded-For': xff };
  const env = peer === undefined ? undefined : { incoming: { socket: { remoteAddress: peer } } };
  const res = await ctx.app.request('http://localhost/api/test/ip', { headers }, env);
  return ((await res.json()) as { ip: string | null }).ip;
}

describe('clientIp', () => {
  it('sans socket, prend le premier élément de X-Forwarded-For', async () => {
    expect(await ipOf('100.64.0.7')).toBe('100.64.0.7');
    expect(await ipOf('100.64.0.7, 10.0.0.1')).toBe('100.64.0.7');
  });

  it('sans pair ni en-tête, renvoie null', async () => {
    expect(await ipOf()).toBeNull();
  });

  it('fait confiance à X-Forwarded-For quand le pair est loopback ou privé', async () => {
    const peers = [
      '172.18.0.1',
      '::ffff:172.18.0.1',
      '127.0.0.1',
      '::1',
      '10.1.2.3',
      '192.168.1.5',
      '172.16.0.1',
    ];
    for (const peer of [...peers, '172.31.255.1']) {
      expect(await ipOf('100.64.0.7', peer)).toBe('100.64.0.7');
    }
  });

  it('ignore X-Forwarded-For quand le pair est public ou hors RFC 1918', async () => {
    expect(await ipOf('100.64.0.7', '100.64.0.9')).toBe('100.64.0.9');
    expect(await ipOf('100.64.0.7', '172.32.0.1')).toBe('172.32.0.1');
    expect(await ipOf('100.64.0.7', '::ffff:8.8.8.8')).toBe('8.8.8.8');
  });

  it('renvoie le pair loopback sans en-tête', async () => {
    expect(await ipOf(undefined, '127.0.0.1')).toBe('127.0.0.1');
  });
});
