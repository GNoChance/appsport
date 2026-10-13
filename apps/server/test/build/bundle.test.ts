import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isBuiltin } from 'node:module';
import { type AddressInfo, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild, transform } from 'esbuild';
import { beforeAll, expect, it } from 'vitest';

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));
const DIST_DIR = join(SERVER_DIR, 'dist');
const REPO_DATA_DIR = fileURLToPath(new URL('../../../../data', import.meta.url));
const VERSION = 'v9.9.9-test';
const INDEX_HTML = '<!doctype html><title>Rune</title>';

/**
 * spawnSync bloque la boucle d'événements du worker : le délai de Vitest ne peut pas l'interrompre. Chaque
 * appel a donc sa propre limite, puis SIGKILL.
 */
const SYNC_LIMITS = { timeout: 30_000, killSignal: 'SIGKILL' } as const;

/**
 * Seules variables du système transmises aux processus du bundle. Rien d'autre ne passe : ni la clé
 * Anthropic (aucun réseau externe en test), ni NODE_PATH, que le lanceur pnpm de vitest pointe vers
 * node_modules/.pnpm/node_modules (le `require` du bandeau y trouverait hono ou zod hors du dépôt), ni
 * NODE_OPTIONS.
 */
const SYSTEM_ENV = new Set(['PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE']);
const LEAKS = ['NODE_PATH', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY', 'COACH_MODEL', 'SW_KILL_SWITCH'];

function childEnv(own: Record<string, string>): Record<string, string | undefined> {
  const system = Object.entries(process.env).filter(([key]) => SYSTEM_ENV.has(key.toUpperCase()));
  return { ...Object.fromEntries(system), ...own };
}

/** Un processus terminé seul (ni échec de lancement, ni délai dépassé) avec le code 0. */
function expectSuccess(result: SpawnSyncReturns<string>): void {
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.status, result.stderr).toBe(0);
}

let build: SpawnSyncReturns<string>;

beforeAll(() => {
  rmSync(DIST_DIR, { recursive: true, force: true });
  build = spawnSync(process.execPath, ['build.mjs'], { cwd: SERVER_DIR, encoding: 'utf8', ...SYNC_LIMITS });
}, 60_000);

/**
 * Le code du bundle sans ses commentaires : esbuild garde la JSDoc des dépendances, dont les exemples
 * (`import { Hono } from 'hono'`) ne sont pas des imports. Minifié (commentaires retirés) puis réimprimé
 * avec ses espaces, pour que `"from" in x` ne devienne pas `"from"in x`. Sans `format` : en ESM, esbuild
 * renommerait le `require` du bandeau en `require2`, que le relevé des require ne verrait plus.
 */
async function withoutComments(src: string): Promise<string> {
  const options = { loader: 'js', target: 'node24', legalComments: 'none' } as const;
  const minified = await transform(src, { ...options, minifyWhitespace: true });
  return (await transform(minified.code, options)).code;
}

/**
 * Imports du fichier (statiques, de bord, dynamiques), lus par le parseur d'esbuild. Le `require` du
 * bandeau et le `__require` d'esbuild sont des liaisons locales : leurs appels n'y figurent pas, d'où
 * `requiredModules`.
 */
async function bundleImports(file: string): Promise<{ inputs: string[]; imports: string[] }> {
  const { metafile } = await esbuild({
    entryPoints: [file],
    bundle: true,
    write: false,
    metafile: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    logLevel: 'silent',
  });
  const inputs = Object.values(metafile.inputs);
  return {
    inputs: Object.keys(metafile.inputs),
    imports: inputs.flatMap((i) => i.imports.map((m) => m.path)),
  };
}

/** Modules chargés par `require('x')` ou `__require('x')` ; le `CreateRequire(` du bandeau n'en est pas un. */
function requiredModules(src: string): string[] {
  return [...src.matchAll(/\b(?:__)?require\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');
}

it('node build.mjs produit un seul server.mjs ESM, sans import hors node:*', async () => {
  expectSuccess(build);
  expect(readdirSync(DIST_DIR)).toEqual(['server.mjs']);
  const src = await withoutComments(readFileSync(join(DIST_DIR, 'server.mjs'), 'utf8'));
  expect(src).toMatch(/^export \{/m);
  expect(src).not.toMatch(/(?:from|import\()\s*['"](?!node:)[a-z@][^'"]*['"]/);
  expect(requiredModules(src).filter((specifier) => !isBuiltin(specifier))).toEqual([]);
  const { inputs, imports } = await bundleImports(join(DIST_DIR, 'server.mjs'));
  expect(inputs).toHaveLength(1);
  expect(imports).toContain('node:sqlite');
  expect(imports.filter((path) => !path.startsWith('node:'))).toEqual([]);
});

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/** Le dossier et ses parents jusqu'à la racine : là où Node chercherait des node_modules. */
function ancestors(dir: string): string[] {
  const parent = dirname(dir);
  return parent === dir ? [dir] : [dir, ...ancestors(parent)];
}

async function waitForHealth(url: string, child: ChildProcess, logs: () => string): Promise<Response> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`serveur arrêté (code ${child.exitCode}) : ${logs()}`);
    try {
      return await fetch(url);
    } catch {
      // Pas encore à l'écoute.
    }
    if (Date.now() > deadline) throw new Error(`/api/health sans réponse en 20 s : ${logs()}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Vrai si `exited` se résout avant `ms` millisecondes. */
async function within(exited: Promise<void>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([exited.then(() => true), late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Arrête le serveur et attend la fin du processus (sous Windows, la base reste verrouillée avant) :
 * SIGTERM, puis SIGKILL s'il tourne encore après 10 s.
 */
async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill();
  if (await within(exited, 10_000)) return;
  child.kill('SIGKILL');
  await within(exited, 5_000);
}

type Running = { child: ChildProcess; port: number; logs: () => string };

function launch(
  serverPath: string,
  dir: string,
  port: number,
  env: Record<string, string | undefined>,
): Running {
  let output = '';
  const child = spawn(process.execPath, [serverPath], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr?.on('data', (chunk) => {
    output += chunk;
  });
  return { child, port, logs: () => output };
}

/**
 * Lance le serveur sur un port choisi juste avant, puis attend /api/health. Un seul nouvel essai si un autre
 * processus a pris le port entre-temps. Chaque processus lancé va dans `launched`, que l'appelant arrête.
 */
async function startHealthy(
  serverPath: string,
  dir: string,
  envFor: (port: number) => Record<string, string | undefined>,
  launched: Running[],
): Promise<{ running: Running; health: Response }> {
  for (let attempt = 1; ; attempt++) {
    const port = await freePort();
    const running = launch(serverPath, dir, port, envFor(port));
    launched.push(running);
    try {
      const health = await waitForHealth(`http://127.0.0.1:${port}/api/health`, running.child, running.logs);
      return { running, health };
    } catch (error) {
      if (attempt >= 2 || !running.logs().includes('EADDRINUSE')) throw error;
    }
  }
}

it('server.mjs seul, hors du dépôt et sans node_modules : init, db:check puis /api/health', async () => {
  expectSuccess(build);
  const dir = mkdtempSync(join(tmpdir(), 'rune-bundle-'));
  const launched: Running[] = [];
  try {
    expect(ancestors(dir).filter((d) => existsSync(join(d, 'node_modules')))).toEqual([]);
    const serverPath = join(dir, 'server.mjs');
    cpSync(join(DIST_DIR, 'server.mjs'), serverPath);
    mkdirSync(join(dir, 'data'));
    writeFileSync(join(dir, 'data', '.rune-volume'), '');
    mkdirSync(join(dir, 'public'));
    writeFileSync(join(dir, 'public', 'index.html'), INDEX_HTML);
    cpSync(REPO_DATA_DIR, join(dir, 'content'), { recursive: true });
    const own = {
      NODE_ENV: 'production',
      APP_VERSION: VERSION,
      HOST: '127.0.0.1',
      RUNE_DATA_DIR: join(dir, 'data'),
      RUNE_PUBLIC_DIR: join(dir, 'public'),
      RUNE_CONTENT_DIR: join(dir, 'content'),
    };
    // Les commandes n'écoutent pas : leur origine n'a pas besoin du port du serveur.
    const cliEnv = childEnv({ ...own, APP_ORIGIN: 'http://127.0.0.1' });
    const serverEnv = (port: number) =>
      childEnv({ ...own, APP_ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) });
    const ownKeys = new Set([...Object.keys(own), 'APP_ORIGIN', 'PORT']);
    for (const env of [cliEnv, serverEnv(3000)]) {
      const inherited = Object.keys(env).filter(
        (key) => !SYSTEM_ENV.has(key.toUpperCase()) && !ownKeys.has(key),
      );
      expect(inherited).toEqual([]);
      for (const key of LEAKS) expect(env).not.toHaveProperty(key);
    }
    const cli = (command: string) =>
      spawnSync(process.execPath, [serverPath, command], {
        cwd: dir,
        env: cliEnv,
        encoding: 'utf8',
        ...SYNC_LIMITS,
      });

    expectSuccess(cli('init'));
    expect(existsSync(join(dir, 'data', 'rune.db'))).toBe(true);
    expectSuccess(cli('db:check'));

    const { running, health } = await startHealthy(serverPath, dir, serverEnv, launched);
    expect(health.status, running.logs()).toBe(200);
    expect(await health.json()).toMatchObject({
      status: 'ok',
      version: VERSION,
      db: 'ok',
      protocol: 1,
      minProtocol: 1,
      swKill: false,
    });
    const home = await fetch(`http://127.0.0.1:${running.port}/`);
    expect(await home.text()).toBe(INDEX_HTML);
  } finally {
    for (const { child } of launched) await stop(child);
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    } catch (error) {
      // Un dossier temporaire resté verrouillé ne doit pas masquer l'échec réel du test.
      console.warn(`dossier temporaire non supprimé : ${dir} (${String(error)})`);
    }
  }
}, 60_000);
