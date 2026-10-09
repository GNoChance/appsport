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
const INDEX_HTML = '<!doctype html><title>appsport</title>';

let build: SpawnSyncReturns<string>;

beforeAll(() => {
  rmSync(DIST_DIR, { recursive: true, force: true });
  build = spawnSync(process.execPath, ['build.mjs'], { cwd: SERVER_DIR, encoding: 'utf8' });
}, 60_000);

/**
 * Le code du bundle sans ses commentaires : esbuild garde la JSDoc des dépendances, dont les exemples
 * (`import { Hono } from 'hono'`) ne sont pas des imports. Minifié (commentaires retirés) puis réimprimé
 * avec ses espaces, pour que `"from" in x` ne devienne pas `"from"in x`.
 */
async function withoutComments(src: string): Promise<string> {
  const options = { loader: 'js', format: 'esm', target: 'node24', legalComments: 'none' } as const;
  const minified = await transform(src, { ...options, minifyWhitespace: true });
  return (await transform(minified.code, options)).code;
}

/** Imports réels (statiques, de bord, dynamiques, require) du fichier, lus par le parseur d'esbuild. */
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

it('node build.mjs produit un seul server.mjs ESM, sans import hors node:*', async () => {
  expect(build.status, build.stderr).toBe(0);
  expect(readdirSync(DIST_DIR)).toEqual(['server.mjs']);
  const src = await withoutComments(readFileSync(join(DIST_DIR, 'server.mjs'), 'utf8'));
  expect(src).toMatch(/^export \{/m);
  expect(src).not.toMatch(/(?:from|import\()\s*['"](?!node:)[a-z@][^'"]*['"]/);
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

/** Arrête le serveur et attend la fin du processus : sous Windows, la base reste verrouillée avant. */
async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await exited;
}

it('server.mjs seul, hors du dépôt et sans node_modules : init, db:check puis /api/health', async () => {
  expect(build.status, build.stderr).toBe(0);
  const dir = mkdtempSync(join(tmpdir(), 'appsport-bundle-'));
  let server: ChildProcess | undefined;
  try {
    expect(ancestors(dir).filter((d) => existsSync(join(d, 'node_modules')))).toEqual([]);
    const serverPath = join(dir, 'server.mjs');
    cpSync(join(DIST_DIR, 'server.mjs'), serverPath);
    mkdirSync(join(dir, 'data'));
    writeFileSync(join(dir, 'data', '.appsport-volume'), '');
    mkdirSync(join(dir, 'public'));
    writeFileSync(join(dir, 'public', 'index.html'), INDEX_HTML);
    cpSync(REPO_DATA_DIR, join(dir, 'content'), { recursive: true });
    const port = await freePort();
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      APP_ORIGIN: `http://127.0.0.1:${port}`,
      APP_VERSION: VERSION,
      HOST: '127.0.0.1',
      PORT: String(port),
      APPSPORT_DATA_DIR: join(dir, 'data'),
      APPSPORT_PUBLIC_DIR: join(dir, 'public'),
      APPSPORT_CONTENT_DIR: join(dir, 'content'),
      SW_KILL_SWITCH: undefined,
    };
    const cli = (command: string) =>
      spawnSync(process.execPath, [serverPath, command], { cwd: dir, env, encoding: 'utf8' });

    const init = cli('init');
    expect(init.status, init.stderr).toBe(0);
    expect(existsSync(join(dir, 'data', 'appsport.db'))).toBe(true);
    const check = cli('db:check');
    expect(check.status, check.stderr).toBe(0);

    let output = '';
    server = spawn(process.execPath, [serverPath], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout?.on('data', (chunk) => {
      output += chunk;
    });
    server.stderr?.on('data', (chunk) => {
      output += chunk;
    });
    const health = await waitForHealth(`http://127.0.0.1:${port}/api/health`, server, () => output);
    expect(health.status, output).toBe(200);
    expect(await health.json()).toMatchObject({
      status: 'ok',
      version: VERSION,
      db: 'ok',
      protocol: 1,
      minProtocol: 1,
      swKill: false,
    });
    const home = await fetch(`http://127.0.0.1:${port}/`);
    expect(await home.text()).toBe(INDEX_HTML);
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, maxRetries: 5 });
  }
}, 60_000);
