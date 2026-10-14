import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { type AddressInfo, createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRIVACY_POLICY_VERSION } from '@rune/contracts';
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

  it("relance : ni init ni base refaite ; plus de lien d'invitation une fois le compte créé", async () => {
    const before = gitStatus();
    const dataDir = join(tmp, 'donnees');
    const dbPath = join(dataDir, 'rune.db');
    const serverPort = await freePort();
    const webPort = await freePort();
    const env = { RUNE_DATA_DIR: dataDir, PORT: String(serverPort), RUNE_DEV_WEB_PORT: String(webPort) };
    // Booléens et sortie masquée : ni lien ni code dans un message d'échec.
    const has = (text: string): boolean => output.includes(text);
    const launch = async (): Promise<void> => {
      output = '';
      startDev(env);
      await waitFor('santé du serveur', async () => {
        const res = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
        return res.status === 200;
      });
    };
    const stop = async (): Promise<void> => {
      if (child) await killTree(child, 'SIGINT');
      await waitFor(
        'ports libérés',
        async () => !(await isPortBusy(serverPort)) && !(await isPortBusy(webPort)),
        { timeoutMs: 15_000, scriptAlive: false },
      );
    };

    await launch();
    expect(has('Base initialisée'), masked()).toBe(true);
    await stop();
    const db = statSync(dbPath);

    // Deuxième lancement, toujours sans compte : pas d'init, même base, un nouveau lien.
    await launch();
    expect(has('Base initialisée'), masked()).toBe(false);
    const again = statSync(dbPath);
    expect(again.ino).toBe(db.ino);
    expect(again.birthtimeMs).toBe(db.birthtimeMs);
    const code = new RegExp(`http://localhost:${webPort}/invite#(\\S+)`).exec(output)?.[1];
    expect(code !== undefined, masked()).toBe(true);
    const accepted = await fetch(`http://127.0.0.1:${serverPort}/api/invitations/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: `http://localhost:${webPort}` },
      body: JSON.stringify({
        code,
        username: 'proprietaire',
        password: 'tortue verte du jardin potager',
        termsVersion: PRIVACY_POLICY_VERSION,
      }),
    });
    expect(accepted.status).toBe(201);
    await stop();

    // Troisième lancement : le compte existe, donc ni admin:bootstrap ni lien.
    await launch();
    expect(has('/invite#'), masked()).toBe(false);
    expect(has('Base initialisée'), masked()).toBe(false);
    await stop();
    expect(gitStatus()).toBe(before);
  }, 240_000);

  it("le serveur échoue au démarrage : tout s'arrête seul, sortie non nulle, ports libérés", async () => {
    // Adresse de documentation (RFC 5737), jamais locale : init, db:stats et admin:bootstrap passent, les ports
    // sondés sur la boucle locale sont libres, seule l'écoute du serveur échoue (EADDRNOTAVAIL).
    const serverPort = await freePort();
    const webPort = await freePort();
    const proc = startDev({
      RUNE_DATA_DIR: join(tmp, 'donnees'),
      HOST: '192.0.2.1',
      PORT: String(serverPort),
      RUNE_DEV_WEB_PORT: String(webPort),
    });
    const code = await Promise.race([
      exitOf(proc),
      new Promise<'toujours lancé'>((resolve) => setTimeout(() => resolve('toujours lancé'), 60_000)),
    ]);
    expect(code, masked()).not.toBe('toujours lancé');
    expect(code).not.toBe(0);
    expect(code).not.toBeNull();
    expect(output.includes("Le serveur n'a pas pu démarrer"), masked()).toBe(true);
    await waitFor(
      'ports libérés',
      async () => !(await isPortBusy(serverPort)) && !(await isPortBusy(webPort)),
      { timeoutMs: 15_000, scriptAlive: false },
    );
  }, 120_000);

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
