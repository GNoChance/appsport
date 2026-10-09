// @vitest-environment node
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parentWatchImport, REPO_ROOT, relay } from '../../e2e/support/server';

const SERVER_TS = resolve(import.meta.dirname, '../../e2e/support/server.ts');
const SETTLE_MS = 3000;

const servers: http.Server[] = [];
const cleanups: (() => void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((done) => {
          server.close(() => done());
          server.closeAllConnections();
        }),
    ),
  );
});

async function listen(handler: http.RequestListener): Promise<number> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return (server.address() as AddressInfo).port;
}

function within<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`${what} : rien après ${SETTLE_MS} ms`)), SETTLE_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        done(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        fail(error);
      },
    );
  });
}

describe('proxy E2E : relais', () => {
  it('un serveur coupé en plein corps termine la réponse relayée (pas de réponse pendante)', async () => {
    const backendPort = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('début');
      setTimeout(() => res.socket?.destroy(), 50);
    });
    const proxyPort = await listen((req, res) => relay(req, res, backendPort));

    const ended = new Promise<boolean>((done) => {
      const req = http.get({ host: '127.0.0.1', port: proxyPort, path: '/', agent: false }, (res) => {
        res.resume();
        res.once('close', () => done(res.complete));
        res.once('error', () => {});
      });
      req.once('error', () => done(false));
    });

    expect(await within(ended, 'réponse relayée')).toBe(false);
  });

  it('un client parti en pleine réponse coupe la requête vers le serveur', async () => {
    let backendClosed!: () => void;
    const closed = new Promise<void>((done) => {
      backendClosed = done;
    });
    const backendPort = await listen((_req, res) => {
      res.once('close', () => backendClosed());
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('début');
    });
    const proxyPort = await listen((req, res) => relay(req, res, backendPort));

    const req = http.get({ host: '127.0.0.1', port: proxyPort, path: '/', agent: false }, (res) => {
      res.once('data', () => req.destroy());
      res.once('error', () => {});
    });
    req.once('error', () => {});

    await within(closed, 'requête amont');
  });
});

/**
 * « Worker » Playwright simulé : lance un serveur E2E, écrit ses PID et son dossier de données, puis
 * `process.exit(0)` dès qu'il lit une ligne (sortie sans `close()`), ou meurt tué net.
 */
function startWorker(): Promise<{ worker: ChildProcess; pids: number[]; dataDir: string }> {
  const publicDir = mkdtempSync(join(tmpdir(), 'appsport-e2e-public-'));
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>appsport</title>');
  cleanups.push(() => rmSync(publicDir, { recursive: true, force: true }));
  const code = [
    `import { livePids, startE2EServer } from ${JSON.stringify(pathToFileURL(SERVER_TS).href)};`,
    `const server = await startE2EServer({ publicDir: ${JSON.stringify(publicDir)} });`,
    'console.log(JSON.stringify({ pids: livePids(), dataDir: server.dataDir }));',
    "process.stdin.once('data', () => process.exit(0));",
  ].join('\n');
  const worker = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    cwd: join(REPO_ROOT, 'apps', 'server'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  cleanups.push(() => worker.kill('SIGKILL'));
  let stdout = '';
  let stderr = '';
  worker.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  return new Promise((done, fail) => {
    worker.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      const line = stdout.split('\n').find((l) => l.startsWith('{'));
      if (!line) return;
      const { pids, dataDir } = JSON.parse(line) as { pids: number[]; dataDir: string };
      cleanups.push(() => {
        for (const pid of pids) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
        }
        rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      });
      done({ worker, pids, dataDir });
    });
    worker.once('exit', (exitCode) => fail(new Error(`worker sorti (${exitCode}) :\n${stderr}`)));
  });
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function allGone(pids: number[], timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pids.some(alive)) return [];
    await new Promise((r) => setTimeout(r, 100));
  }
  return pids.filter(alive);
}

describe('serveur E2E : filet contre les orphelins', () => {
  it('un worker qui sort sans close() emporte son serveur', { timeout: 60_000 }, async () => {
    const { worker, pids } = await startWorker();
    expect(pids).toHaveLength(1);
    expect(pids.every(alive)).toBe(true);

    worker.stdin?.write('exit\n');

    expect(await allGone(pids, 5000)).toEqual([]);
  });

  it('le module de surveillance fait sortir un processus dont le parent a disparu', async () => {
    const gone = spawn(process.execPath, ['-e', '']);
    const deadPid = await new Promise<number>((done) => gone.once('exit', () => done(gone.pid ?? 0)));
    const orphan = spawn(process.execPath, [
      '--import',
      parentWatchImport(deadPid),
      '-e',
      'setInterval(() => {}, 1000)',
    ]);
    cleanups.push(() => orphan.kill('SIGKILL'));
    const watched = spawn(process.execPath, [
      '--import',
      parentWatchImport(process.pid),
      '-e',
      'setInterval(() => {}, 1000)',
    ]);
    cleanups.push(() => watched.kill('SIGKILL'));

    const exited = new Promise<number | null>((done) => orphan.once('exit', (exitCode) => done(exitCode)));
    expect(await within(exited, 'sortie de l’orphelin')).toBe(1);
    expect(watched.exitCode).toBeNull();
  });

  it('un worker tué net (SIGKILL / TerminateProcess) emporte son serveur', { timeout: 60_000 }, async () => {
    const { worker, pids } = await startWorker();
    expect(pids).toHaveLength(1);

    worker.kill('SIGKILL');

    expect(await allGone(pids, 5000)).toEqual([]);
  });
});
