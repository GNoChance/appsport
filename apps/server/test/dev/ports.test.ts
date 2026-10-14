import { type AddressInfo, createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { isPortBusy } from '../../scripts/dev/ports';

let server: Server | null = null;

afterEach(async () => {
  const s = server;
  server = null;
  if (s?.listening) await new Promise<void>((resolve) => s.close(() => resolve()));
});

const listen = (host: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    server = s;
    s.once('error', reject);
    s.listen(0, host, () => resolve((s.address() as AddressInfo).port));
  });

/** Sans boucle locale IPv6 (certains runners), écouter sur ::1 échoue (EADDRNOTAVAIL) : le test ::1 est alors sauté. */
const hasIpv6Loopback = await new Promise<boolean>((resolve) => {
  const probe = createServer();
  probe.once('error', () => resolve(false));
  probe.listen(0, '::1', () => probe.close(() => resolve(true)));
});

describe('isPortBusy', () => {
  it('voit un port pris sur 127.0.0.1, puis libre une fois fermé', async () => {
    const port = await listen('127.0.0.1');
    expect(await isPortBusy(port)).toBe(true);
    const s = server as Server;
    await new Promise<void>((resolve) => s.close(() => resolve()));
    expect(await isPortBusy(port)).toBe(false);
  });

  it.skipIf(!hasIpv6Loopback)('voit un port pris sur ::1 seulement (Vite écoute sur localhost)', async () => {
    const port = await listen('::1');
    expect(await isPortBusy(port)).toBe(true);
  });
});
