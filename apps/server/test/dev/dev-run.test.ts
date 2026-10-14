import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { type AddressInfo, createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPortBusy } from '../../scripts/dev/ports';

// Test d'intégration de `pnpm dev` : le vrai script sur un dossier temporaire et des ports libres.

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = join(SERVER_DIR, '..', '..');
const SCRIPT = join(SERVER_DIR, 'scripts', 'dev', 'main.ts');
const TSX = pathToFileURL(createRequire(join(SERVER_DIR, 'package.json')).resolve('tsx')).href;
const WINDOWS = process.platform === 'win32';

let tmp: string;
let child: ChildProcess | null = null;
let blocker: Server | null = null;
let output = '';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });

/** Lien d'invitation et code masqués : rien de secret dans un message d'échec. */
const masked = (): string => output.replace(/#\S+/g, '#XXXX').replace(/Code : \S+/g, 'Code : XXXX');

/** Environnement du test sans les variables de Vitest, que Vite lirait. */
function devEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const key of Object.keys(env)) if (key.startsWith('VITEST') || key === 'NODE_ENV') delete env[key];
  return env;
}

function startDev(extra: Record<string, string>): ChildProcess {
  const proc = spawn(process.execPath, ['--import', TSX, SCRIPT], {
    cwd: SERVER_DIR,
    env: devEnv(extra),
    stdio: ['ignore', 'pipe', 'pipe'],
    // POSIX : son propre groupe, pour arrêter tout l'arbre d'un coup.
    detached: !WINDOWS,
    windowsHide: true,
  });
  proc.stdout?.on('data', (d: Buffer) => {
    output += d.toString();
  });
  proc.stderr?.on('data', (d: Buffer) => {
    output += d.toString();
  });
  child = proc;
  return proc;
}

const exitOf = (proc: ChildProcess): Promise<number | null> =>
  proc.exitCode !== null || proc.signalCode !== null
    ? Promise.resolve(proc.exitCode)
    : new Promise((resolve) => proc.once('exit', (code) => resolve(code)));

/** Arrête tout l'arbre du script, même en cas d'échec du test. */
async function killTree(proc: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null || proc.pid === undefined) return;
  const exited = exitOf(proc);
  if (WINDOWS) {
    try {
      execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Déjà arrêté.
    }
  } else {
    try {
      process.kill(-proc.pid, signal);
    } catch {
      // Déjà arrêté.
    }
  }
  await exited;
}

async function waitFor(
  what: string,
  check: () => Promise<boolean>,
  { timeoutMs = 90_000, scriptAlive = true } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (scriptAlive && child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(`Le script s'est arrêté avant : ${what}\n${masked()}`);
    }
    try {
      if (await check()) return;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Délai dépassé : ${what}\n${masked()}`);
}

const gitStatus = (): string =>
  execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'rune-dev-'));
  output = '';
});

afterEach(async () => {
  if (child) await killTree(child, 'SIGKILL');
  child = null;
  const b = blocker;
  blocker = null;
  if (b?.listening) await new Promise<void>((resolve) => b.close(() => resolve()));
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe('pnpm dev', () => {
  it("crée la base et le premier admin, lance le serveur et le web, puis tout s'arrête", async () => {
    const before = gitStatus();
    const dataDir = join(tmp, 'donnees');
    const serverPort = await freePort();
    const webPort = await freePort();
    const proc = startDev({
      RUNE_DATA_DIR: dataDir,
      PORT: String(serverPort),
      RUNE_DEV_WEB_PORT: String(webPort),
    });

    await waitFor('santé du serveur', async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      return res.status === 200;
    });
    await waitFor('page du web', async () => {
      const res = await fetch(`http://localhost:${webPort}/`);
      return res.status === 200 && (await res.text()).includes('id="root"');
    });

    expect(existsSync(join(dataDir, '.rune-volume'))).toBe(true);
    expect(existsSync(join(dataDir, 'rune.db'))).toBe(true);
    expect(output).toMatch(/^\[serveur\] /m);
    expect(output).toMatch(/^\[web\] /m);
    // Le lien vise le web (port de Vite), pas le serveur ; il n'est vérifié que par un booléen.
    expect(new RegExp(`http://localhost:${webPort}/invite#`).test(output)).toBe(true);

    await killTree(proc, 'SIGINT');
    if (!WINDOWS) expect(proc.exitCode).toBe(0);
    await waitFor(
      'ports libérés',
      async () => !(await isPortBusy(serverPort)) && !(await isPortBusy(webPort)),
      {
        timeoutMs: 15_000,
        scriptAlive: false,
      },
    );
    expect(gitStatus()).toBe(before);
  }, 180_000);

  it('port déjà pris : message clair, sortie non nulle, aucun dossier créé', async () => {
    const dataDir = join(tmp, 'donnees');
    const serverPort = await freePort();
    blocker = createServer();
    await new Promise<void>((resolve) => blocker?.listen(serverPort, '127.0.0.1', () => resolve()));
    const proc = startDev({
      RUNE_DATA_DIR: dataDir,
      PORT: String(serverPort),
      RUNE_DEV_WEB_PORT: String(await freePort()),
    });
    const code = await exitOf(proc);
    expect(code).not.toBe(0);
    expect(output).toContain(`Le port ${serverPort} (serveur) est déjà pris`);
    expect(existsSync(dataDir)).toBe(false);
  }, 60_000);
});
