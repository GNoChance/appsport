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

describe('isPortBusy', () => {
  it('voit un port pris sur 127.0.0.1, puis libre une fois fermé', async () => {
    const port = await listen('127.0.0.1');
    expect(await isPortBusy(port)).toBe(true);
    const s = server as Server;
    await new Promise<void>((resolve) => s.close(() => resolve()));
    expect(await isPortBusy(port)).toBe(false);
  });

  it('voit un port pris sur ::1 seulement (Vite écoute sur localhost)', async () => {
    const port = await listen('::1');
    expect(await isPortBusy(port)).toBe(true);
  });
});
