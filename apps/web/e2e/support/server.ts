import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import http, { type IncomingHttpHeaders } from 'node:http';
import { type AddressInfo, createServer as createNetServer, type Socket } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const WEB_DIR = join(REPO_ROOT, 'apps', 'web');
const SERVER_DIR = join(REPO_ROOT, 'apps', 'server');
/** Build de production écrit par global-setup. */
export const DEFAULT_PUBLIC_DIR = join(WEB_DIR, 'dist');
/** Données des serveurs de test (ignoré par git) : un dossier par serveur, gardé pour l'enquête. */
export const E2E_DATA_DIR = join(REPO_ROOT, '.e2e-data');

const HEALTH_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;
const LOG_TAIL_LINES = 40;

/** Panne simulée par le proxy : requêtes sans réponse (VPN coupé), ou réponse imposée pour un préfixe. */
export type E2EFault =
  | null
  | { kind: 'blackhole' }
  | { kind: 'status'; pathPrefix: string; status: number; body: unknown };

export interface E2EServer {
  /** Origine vue par le navigateur (`http://localhost:<port du proxy>`) = APP_ORIGIN. */
  url: string;
  dataDir: string;
  publicDir: string;
  /** Arrête le serveur seul : le proxy reste et répond 502, `dataDir` est gardé. */
  stop(): Promise<void>;
  /** Relance le serveur, `env` fusionné à l'environnement courant (`''` retire la variable) ; même URL. */
  restart(env?: Record<string, string>): Promise<void>;
  /** Arrête le serveur et le proxy. */
  close(): Promise<void>;
  /** CLI du serveur (`node --import tsx src/main.ts <args>`) sur les mêmes données. */
  cli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
  setFault(f: E2EFault): void;
}

type Env = Record<string, string | undefined>;

/** `''` retire la variable. */
function mergeEnv(base: Env, extra: Record<string, string> = {}): Env {
  const env = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value === '') delete env[key];
    else env[key] = value;
  }
  return env;
}

async function freePort(): Promise<number> {
  const probe = createNetServer();
  await new Promise<void>((done, fail) => {
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', done);
  });
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((done) => probe.close(() => done()));
  return port;
}

function spawnServer(args: string[], env: Env): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', 'src/main.ts', ...args], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runCli(args: string[], env: Env): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done, fail) => {
    const child = spawnServer(args, env);
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', fail);
    child.once('close', (code) => done({ code: code ?? 1, stdout, stderr }));
  });
}

function healthy(port: number): Promise<boolean> {
  return new Promise((done) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', agent: false }, (res) => {
      res.resume();
      done(res.statusCode === 200);
    });
    req.setTimeout(1000, () => req.destroy());
    req.once('error', () => done(false));
  });
}

interface Backend {
  child: ChildProcess;
  exited: Promise<void>;
}

/** Serveur sur `port` ; prêt quand /api/health répond 200 (30 s au plus). Journal : dernières lignes. */
async function startBackend(port: number, env: Env, log: string[]): Promise<Backend> {
  const child = spawnServer([], { ...env, PORT: String(port) });
  const keep = (chunk: string) => {
    log.push(...chunk.split('\n').filter((line) => line !== ''));
    log.splice(0, Math.max(0, log.length - LOG_TAIL_LINES));
  };
  child.stdout?.setEncoding('utf8').on('data', keep);
  child.stderr?.setEncoding('utf8').on('data', keep);
  let alive = true;
  const exited = new Promise<void>((done) => {
    child.once('exit', () => {
      alive = false;
      done();
    });
  });
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!alive) throw new Error(`Le serveur s'est arrêté au démarrage :\n${log.join('\n')}`);
    if (await healthy(port)) return { child, exited };
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill('SIGKILL');
  throw new Error(`Serveur sans /api/health en ${HEALTH_TIMEOUT_MS / 1000} s :\n${log.join('\n')}`);
}

async function stopBackend(backend: Backend): Promise<void> {
  if (backend.child.exitCode !== null || backend.child.signalCode !== null) return;
  backend.child.kill('SIGTERM');
  const timer = setTimeout(() => backend.child.kill('SIGKILL'), STOP_TIMEOUT_MS);
  await backend.exited;
  clearTimeout(timer);
}

// En-têtes propres à une connexion : jamais relayés (RFC 9110 §7.6.1).
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function endToEnd(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP_BY_HOP.has(name)));
}

/**
 * Serveur réel (`node --import tsx src/main.ts`, cwd apps/server) sur une base neuve (`init`), derrière un
 * proxy `node:http` qui relaie tout (Host, Origin, Cookie compris) et simule les pannes : le navigateur
 * n'utilise que `url` (localhost), jamais 127.0.0.1.
 */
export async function startE2EServer(
  opts: { env?: Record<string, string>; publicDir?: string; port?: number } = {},
): Promise<E2EServer> {
  let fault: E2EFault = null;
  let backend: Backend | null = null;
  const held = new Set<Socket>();
  const log: string[] = [];
  const backendPort = await freePort();

  const reply = (res: http.ServerResponse, status: number, type: string, body: string) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };

  const handle = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const current = fault;
    if (current?.kind === 'blackhole') {
      // Requête gardée ouverte sans réponse ; libérée (socket détruite) par setFault(null) ou close().
      held.add(req.socket);
      req.socket.once('close', () => held.delete(req.socket));
      return;
    }
    if (current?.kind === 'status' && (req.url ?? '/').startsWith(current.pathPrefix)) {
      req.resume();
      reply(res, current.status, 'application/json', JSON.stringify(current.body));
      return;
    }
    if (!backend) {
      req.resume();
      reply(res, 502, 'text/plain; charset=utf-8', 'Bad Gateway');
      return;
    }
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: backendPort,
        method: req.method,
        path: req.url,
        headers: endToEnd(req.headers),
        agent: false,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, endToEnd(up.headers));
        up.pipe(res);
      },
    );
    upstream.once('error', () => {
      if (res.headersSent) res.destroy();
      else reply(res, 502, 'text/plain; charset=utf-8', 'Bad Gateway');
    });
    req.pipe(upstream);
  };

  // localhost : IPv4 d'abord, IPv6 en plus quand la machine l'a (le navigateur peut essayer ::1).
  const proxies: http.Server[] = [];
  const listen = (host: string, port: number) =>
    new Promise<number>((done, fail) => {
      const proxy = http.createServer(handle);
      proxy.once('error', fail);
      proxy.listen(port, host, () => {
        proxies.push(proxy);
        done((proxy.address() as AddressInfo).port);
      });
    });
  const proxyPort = await listen('127.0.0.1', opts.port ?? 0);
  await listen('::1', proxyPort).catch(() => {});

  const url = `http://localhost:${proxyPort}`;
  const dataDir = join(
    E2E_DATA_DIR,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`,
  );
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, '.appsport-volume'), '');
  const publicDir = opts.publicDir ?? DEFAULT_PUBLIC_DIR;
  let env = mergeEnv(
    {
      ...process.env,
      APP_ORIGIN: url,
      PORT: String(backendPort),
      HOST: '127.0.0.1',
      APPSPORT_DATA_DIR: dataDir,
      APPSPORT_PUBLIC_DIR: publicDir,
      APPSPORT_CONTENT_DIR: join(REPO_ROOT, 'data'),
      APP_VERSION: 'e2e',
    },
    opts.env,
  );

  const releaseHeld = () => {
    for (const socket of held) socket.destroy();
    held.clear();
  };
  const stop = async () => {
    const running = backend;
    backend = null;
    if (running) await stopBackend(running);
  };
  const closeProxies = async () => {
    releaseHeld();
    await Promise.all(
      proxies.map(
        (proxy) =>
          new Promise<void>((done) => {
            proxy.close(() => done());
            proxy.closeAllConnections();
          }),
      ),
    );
  };

  try {
    const init = await runCli(['init'], env);
    if (init.code !== 0) throw new Error(`init a échoué (code ${init.code}) : ${init.stderr}`);
    backend = await startBackend(backendPort, env, log);
  } catch (error) {
    await closeProxies();
    throw error;
  }

  return {
    url,
    dataDir,
    publicDir,
    stop,
    async restart(extra) {
      await stop();
      env = mergeEnv(env, extra);
      backend = await startBackend(backendPort, env, log);
    },
    async close() {
      await stop();
      await closeProxies();
    },
    cli: (args) => runCli(args, env),
    setFault(f) {
      fault = f;
      if (f === null) releaseHeld();
    },
  };
}

/**
 * `admin:bootstrap --birth-date <date>` : lien et code de l'invitation administrateur. Code de sortie non
 * nul : erreur avec stderr (jamais stdout, qui porte le code).
 */
export async function bootstrapAdmin(
  s: E2EServer,
  birthDate = '1990-01-01',
): Promise<{ code: string; link: string }> {
  const r = await s.cli(['admin:bootstrap', '--birth-date', birthDate]);
  if (r.code !== 0) throw new Error(`admin:bootstrap a échoué (code ${r.code}) : ${r.stderr}`);
  const link = /^Lien : (.+)$/m.exec(r.stdout)?.[1]?.trim();
  const code = /^Code : (.+)$/m.exec(r.stdout)?.[1]?.trim();
  if (!link || !code)
    throw new Error('admin:bootstrap : lignes « Lien : » et « Code : » absentes de la sortie');
  return { code, link };
}
