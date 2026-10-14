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
/** Délai de grâce du script (GRACE_MS de main.ts). */
const SCRIPT_GRACE_MS = 5000;

let tmp: string;
let child: ChildProcess | null = null;
let blocker: Server | null = null;
let output = '';

/** Ports libres et distincts : tous les écouteurs restent ouverts ensemble, puis sont fermés ensemble. */
async function freePorts(count: number): Promise<number[]> {
  const servers: Server[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const s = createServer();
      servers.push(s);
      await new Promise<void>((resolve, reject) => {
        s.once('error', reject);
        s.listen(0, '127.0.0.1', () => resolve());
      });
    }
    return servers.map((s) => (s.address() as AddressInfo).port);
  } finally {
    await Promise.all(
      servers.map(
        (s) => new Promise<void>((resolve) => (s.listening ? s.close(() => resolve()) : resolve())),
      ),
    );
  }
}

/** Lien d'invitation et code masqués : rien de secret dans un message d'échec. */
const masked = (): string => output.replace(/#\S+/g, '#XXXX').replace(/Code : \S+/g, 'Code : XXXX');

/** Variables qui changeraient le comportement du script si elles venaient du terminal du développeur. */
const inheritedDevVariable = (key: string): boolean =>
  key.startsWith('VITEST') ||
  key.startsWith('RUNE_') ||
  ['NODE_ENV', 'APP_ORIGIN', 'HOST', 'PORT'].includes(key);

/** Environnement du test sans les variables de Vitest (que Vite lirait) ni celles de Rune du terminal. */
function devEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) if (inheritedDevVariable(key)) delete env[key];
  return { ...env, ...extra };
}

/** PID du serveur (tsx watch) et du web (Vite), affichés par le script sur une ligne [dev]. */
function childPids(): number[] {
  const match = /^\[dev\] Processus : serveur (\d+), web (\d+)$/m.exec(output.replace(/\r/g, ''));
  return match ? [Number(match[1]), Number(match[2])] : [];
}

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** POSIX : descendants d'un processus, lus avant de tuer quoi que ce soit (ensuite, ils changent de parent). */
function descendantsOf(root: number): number[] {
  const children = new Map<number, number[]>();
  for (const line of execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid || ppid === undefined || Number.isNaN(ppid)) continue;
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  const found: number[] = [];
  const queue = [root];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const pid of children.get(next) ?? []) {
      found.push(pid);
      queue.push(pid);
    }
  }
  return found;
}

function startDev(extra: Record<string, string>): ChildProcess {
  const proc = spawn(process.execPath, ['--import', TSX, SCRIPT], {
    cwd: SERVER_DIR,
    env: devEnv(extra),
    stdio: ['ignore', 'pipe', 'pipe'],
    // POSIX : son propre groupe, que le SIGINT du test atteint en entier. Les enfants du script ont chacun
    // le leur : le nettoyage du test les tue un par un (voir killAll).
    detached: !WINDOWS,
    windowsHide: true,
  });
  proc.stdout?.setEncoding('utf8');
  proc.stderr?.setEncoding('utf8');
  proc.stdout?.on('data', (d: string) => {
    output += d;
  });
  proc.stderr?.on('data', (d: string) => {
    output += d;
  });
  child = proc;
  return proc;
}

const exitOf = (proc: ChildProcess): Promise<number | null> =>
  proc.exitCode !== null || proc.signalCode !== null
    ? Promise.resolve(proc.exitCode)
    : new Promise((resolve) => proc.once('exit', (code) => resolve(code)));

/** Arrêt demandé : SIGINT au groupe du script sous POSIX ; sous Windows, l'arbre est tué (pas de Ctrl+C ici). */
async function interrupt(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null || proc.pid === undefined) return;
  const exited = exitOf(proc);
  try {
    if (WINDOWS) execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-proc.pid, 'SIGINT');
  } catch {
    // Déjà arrêté.
  }
  await exited;
}

/**
 * Nettoyage, même en cas d'échec du test : le script et tous ses descendants. Sous Windows, `taskkill /T`
 * suit l'arbre. Sous POSIX, les enfants du script ont leurs propres groupes, que tuer le groupe du script
 * n'atteint pas : chaque descendant et son groupe sont tués, PID affichés par le script compris.
 */
async function killAll(proc: ChildProcess): Promise<void> {
  const pids = new Set(proc.pid === undefined ? [] : [proc.pid]);
  for (const pid of childPids()) pids.add(pid);
  if (WINDOWS) {
    for (const pid of pids) {
      try {
        execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        // Déjà arrêté.
      }
    }
  } else {
    for (const root of [...pids]) {
      try {
        for (const pid of descendantsOf(root)) pids.add(pid);
      } catch {
        // ps indisponible : les PID affichés par le script restent.
      }
    }
    for (const pid of pids) {
      for (const target of [-pid, pid]) {
        try {
          process.kill(target, 'SIGKILL');
        } catch {
          // Déjà arrêté, ou pas chef de groupe.
        }
      }
    }
  }
  if (proc.exitCode === null && proc.signalCode === null) await exitOf(proc);
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

/** Lance le script sur des ports libres et attend que le serveur et le web répondent. */
async function startReady(dataDir: string) {
  const [serverPort, webPort] = (await freePorts(2)) as [number, number];
  const proc = startDev({
    RUNE_DATA_DIR: dataDir,
    PORT: String(serverPort),
    RUNE_DEV_ANY_PORT: '1',
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
  return { proc, serverPort, webPort };
}

const portsFree = async (...ports: number[]): Promise<boolean> =>
  (await Promise.all(ports.map((port) => isPortBusy(port)))).every((busy) => !busy);

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'rune-dev-'));
  output = '';
});

afterEach(async () => {
  if (child) await killAll(child);
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
    const { proc, serverPort, webPort } = await startReady(dataDir);

    expect(existsSync(join(dataDir, '.rune-volume'))).toBe(true);
    expect(existsSync(join(dataDir, 'rune.db'))).toBe(true);
    expect(existsSync(join(dataDir, '.rune-dev'))).toBe(true);
    expect(masked()).toMatch(/^\[serveur\] /m);
    expect(masked()).toMatch(/^\[web\] /m);
    // Le lien vise le web (port de Vite), pas le serveur, et ne s'affiche qu'une fois, sans la ligne
    // « Code » de admin:bootstrap. Il n'est vérifié que par des booléens et des comptes.
    expect(new RegExp(`http://localhost:${webPort}/invite#`).test(output)).toBe(true);
    expect(output.match(/invite#/g)?.length ?? 0).toBe(1);
    expect(/Code : /.test(output)).toBe(false);
    const pids = childPids();
    expect(pids).toHaveLength(2);

    await interrupt(proc);
    if (!WINDOWS) expect(proc.exitCode).toBe(0);
    await waitFor('ports libérés', () => portsFree(serverPort, webPort), {
      timeoutMs: 15_000,
      scriptAlive: false,
    });
    await waitFor('enfants arrêtés', async () => !pids.some(isAlive), {
      timeoutMs: 15_000,
      scriptAlive: false,
    });
    expect(gitStatus()).toBe(before);
  }, 180_000);

  it("relance : ni init ni base refaite ; plus de lien d'invitation une fois le compte créé", async () => {
    const before = gitStatus();
    const dataDir = join(tmp, 'donnees');
    const dbPath = join(dataDir, 'rune.db');
    const [serverPort, webPort] = (await freePorts(2)) as [number, number];
    const env = {
      RUNE_DATA_DIR: dataDir,
      PORT: String(serverPort),
      RUNE_DEV_ANY_PORT: '1',
      RUNE_DEV_WEB_PORT: String(webPort),
    };
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
      const pids = childPids();
      if (child) await interrupt(child);
      await waitFor('ports libérés', () => portsFree(serverPort, webPort), {
        timeoutMs: 15_000,
        scriptAlive: false,
      });
      await waitFor('enfants arrêtés', async () => !pids.some(isAlive), {
        timeoutMs: 15_000,
        scriptAlive: false,
      });
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
    const [serverPort, webPort] = (await freePorts(2)) as [number, number];
    const proc = startDev({
      RUNE_DATA_DIR: join(tmp, 'donnees'),
      HOST: '192.0.2.1',
      PORT: String(serverPort),
      RUNE_DEV_ANY_PORT: '1',
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
    await waitFor('ports libérés', () => portsFree(serverPort, webPort), {
      timeoutMs: 15_000,
      scriptAlive: false,
    });
  }, 120_000);

  it("si le web s'arrête, le script arrête lui-même le serveur et son arbre, puis sort en erreur", async () => {
    const { proc, serverPort, webPort } = await startReady(join(tmp, 'donnees'));
    const [serverPid, webPid] = childPids() as [number, number];
    expect(serverPid).toBeGreaterThan(0);

    // Seul Vite est tué, sans ses sous-processus. Le serveur réel est un petit-enfant de tsx watch : seul
    // l'arrêt de son arbre par le script (taskkill /T ou groupe POSIX) libère son port.
    const exited = exitOf(proc);
    process.kill(webPid, 'SIGKILL');
    const late = new Promise<'délai'>((resolve) =>
      setTimeout(() => resolve('délai'), SCRIPT_GRACE_MS + 10_000),
    );
    const code = await Promise.race([exited, late]);
    expect(code).not.toBe('délai');
    expect(code).not.toBe(0);
    expect(code).not.toBeNull();
    // Le script a bien arrêté le serveur lui-même : sous Windows, sa propre mort tuerait aussi ses enfants
    // (job de Node), les ports libres seuls ne le prouveraient donc pas.
    expect(masked()).toMatch(/Le web s'est arrêté/);
    expect(masked()).not.toMatch(/ne répond pas à l'arrêt/);
    // Rien n'a encore été arrêté par le test.
    await waitFor('ports libérés par le script', () => portsFree(serverPort, webPort), {
      timeoutMs: 10_000,
      scriptAlive: false,
    });
    await waitFor('serveur arrêté par le script', async () => !isAlive(serverPid), {
      timeoutMs: 10_000,
      scriptAlive: false,
    });
  }, 180_000);

  it('port déjà pris : message clair, sortie non nulle, aucun dossier créé', async () => {
    const dataDir = join(tmp, 'donnees');
    const [serverPort, webPort] = (await freePorts(2)) as [number, number];
    blocker = createServer();
    await new Promise<void>((resolve) => blocker?.listen(serverPort, '127.0.0.1', () => resolve()));
    const proc = startDev({
      RUNE_DATA_DIR: dataDir,
      PORT: String(serverPort),
      RUNE_DEV_ANY_PORT: '1',
      RUNE_DEV_WEB_PORT: String(webPort),
    });
    const code = await exitOf(proc);
    expect(code).not.toBe(0);
    expect(output).toContain(`Le port ${serverPort} (serveur) est déjà pris`);
    expect(existsSync(dataDir)).toBe(false);
  }, 60_000);
});
