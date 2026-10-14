import { type AddressInfo, createServer } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPortBusy } from '../../scripts/dev/ports';
import {
  type DevChild,
  killTree,
  killTreeSync,
  runCapture,
  spawnPrefixed,
} from '../../scripts/dev/processes';

// Processus réels : arrêt d'un arbre complet, sorties décodées sans couper les caractères.

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });

async function waitUntil(what: string, check: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Délai dépassé : ${what}`);
}

/** « é » en UTF-8 (C3 A9), écrit en deux morceaux séparés par une pause. */
const SPLIT_E_ACUTE =
  'process.stdout.write(Buffer.from([0xc3]));' +
  'setTimeout(() => process.stdout.write(Buffer.from([0xa9, 0x0a])), 100);';

const started: DevChild[] = [];
/** PID des petits-enfants, tués aussi au nettoyage : un test raté ne laisse rien derrière lui. */
const grandchildren: number[] = [];

/** Lignes écrites par un enfant `[label]` sur la sortie du test, capturées sans être affichées. */
function captureLines(label: string): string[] {
  const lines: string[] = [];
  const real = process.stdout.write.bind(process.stdout);
  vi.spyOn(process.stdout, 'write').mockImplementation(((text: string | Uint8Array, ...rest: never[]) => {
    if (typeof text === 'string' && text.startsWith(`[${label}]`)) {
      lines.push(text);
      return true;
    }
    return real(text, ...rest);
  }) as typeof process.stdout.write);
  return lines;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(started.splice(0).map((child) => killTree(child)));
  for (const pid of grandchildren.splice(0)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Déjà arrêté.
    }
  }
});

// killTreeSync : même arrêt, sans attendre, pour les sorties anormales du script (exception, process.exit).
describe.each([
  ['killTree', killTree],
  ['killTreeSync', killTreeSync],
] as const)('%s', (_, kill) => {
  it("arrête l'enfant et le petit-enfant qui tient un port", async () => {
    const port = await freePort();
    // L'enfant lance un petit-enfant qui écoute sur le port, puis attend sans fin. Sous Windows, Node met
    // ses enfants dans un job tué avec lui : le petit-enfant est détaché pour en sortir, comme un processus
    // que seul `taskkill /T` (l'arbre par PID parent) atteint. Sous POSIX, il reste dans le groupe.
    const grandchild = `require('node:net').createServer().listen(${port}, '127.0.0.1'); setInterval(() => {}, 1000);`;
    const parent =
      `const g = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], ` +
      `{ stdio: 'ignore', detached: process.platform === 'win32' });` +
      'console.log(String(g.pid)); setInterval(() => {}, 1000);';
    const lines = captureLines('arbre');
    const child = spawnPrefixed('arbre', { args: ['-e', parent], cwd: process.cwd(), env: process.env });
    started.push(child);
    await waitUntil('PID du petit-enfant', async () => lines.length > 0);
    grandchildren.push(Number(lines[0]?.replace('[arbre] ', '')));
    await waitUntil('port tenu par le petit-enfant', () => isPortBusy(port));

    await kill(child);

    await child.exited;
    await waitUntil('port libéré', async () => !(await isPortBusy(port)));
  }, 30_000);
});

describe('décodage des sorties', () => {
  it('runCapture ne coupe pas un caractère réparti sur deux morceaux', async () => {
    const { stdout } = await runCapture({
      args: ['-e', SPLIT_E_ACUTE],
      cwd: process.cwd(),
      env: process.env,
    });
    expect(stdout).toBe('é\n');
  });

  it('spawnPrefixed ne coupe pas un caractère réparti sur deux morceaux', async () => {
    const written = captureLines('accents');
    const child = spawnPrefixed('accents', {
      args: ['-e', SPLIT_E_ACUTE],
      cwd: process.cwd(),
      env: process.env,
    });
    started.push(child);
    await child.exited;
    expect(written.join('')).toBe('[accents] é\n');
  });
});
