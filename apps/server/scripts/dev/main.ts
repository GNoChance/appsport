import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DB_FILE, SENTINEL_FILE } from '../../src/config';
import {
  DevError,
  type DevSettings,
  devSettings,
  invitationLinkFrom,
  planDataDir,
  portBusyMessage,
  usersFromDbStats,
} from './plan';
import { isPortBusy } from './ports';
import { type Command, interruptTree, killTree, runCapture, spawnPrefixed } from './processes';
import { supervise } from './supervisor';

// `pnpm dev` : base et premier admin au premier lancement, puis le serveur (tsx watch) et le web (Vite)
// ensemble, sorties préfixées ; Ctrl+C ou l'arrêt de l'un arrête tout.

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = join(SERVER_DIR, '..', '..');
const WEB_DIR = join(REPO_ROOT, 'apps', 'web');
/** Port visé par le proxy `/api` et `/illustrations` de `apps/web/vite.config.ts`. */
const PROXY_PORT = 3000;
const GRACE_MS = 5000;

const log = (line: string): void => {
  process.stdout.write(`[dev] ${line}\n`);
};
const fail = (line: string): void => {
  process.stderr.write(`[dev] ${line}\n`);
};

const serverRequire = createRequire(join(SERVER_DIR, 'package.json'));
const TSX_LOADER = pathToFileURL(serverRequire.resolve('tsx')).href;
const TSX_CLI = serverRequire.resolve('tsx/cli');
const VITE_BIN = join(
  dirname(createRequire(join(WEB_DIR, 'package.json')).resolve('vite/package.json')),
  'bin',
  'vite.js',
);

/** Commande de la CLI du serveur (`src/main.ts <commande>`), sortie capturée. */
async function serverCli(env: NodeJS.ProcessEnv, args: string[]): Promise<string> {
  const cmd: Command = { args: ['--import', TSX_LOADER, 'src/main.ts', ...args], cwd: SERVER_DIR, env };
  const { code, stdout, stderr } = await runCapture(cmd);
  if (code !== 0) throw new DevError(`${args[0]} a échoué (code ${String(code)}) : ${stderr.trim()}`);
  return stdout;
}

async function prepare(): Promise<{
  settings: DevSettings;
  serverEnv: NodeJS.ProcessEnv;
  link: string | null;
}> {
  const settings = devSettings(process.env, {
    homeDir: homedir(),
    repoRoot: REPO_ROOT,
    webDistExists: existsSync(join(WEB_DIR, 'dist')),
  });
  for (const [port, role] of [
    [settings.serverPort, 'serveur'],
    [settings.webPort, 'web'],
  ] as const) {
    if (await isPortBusy(port)) throw new DevError(portBusyMessage(port, role));
  }
  if (settings.serverPort !== PROXY_PORT) {
    log(`Attention : le proxy /api de Vite vise le port ${PROXY_PORT}, pas ${settings.serverPort}.`);
  }
  const serverEnv: NodeJS.ProcessEnv = { ...process.env, ...settings.serverEnv };
  const { dataDir } = settings;
  mkdirSync(dataDir, { recursive: true });
  const plan = planDataDir(
    {
      sentinelExists: existsSync(join(dataDir, SENTINEL_FILE)),
      dbExists: existsSync(join(dataDir, DB_FILE)),
    },
    dataDir,
  );
  if (plan.kind === 'refused') throw new DevError(plan.message);
  if (plan.kind === 'init') {
    if (plan.writeSentinel) writeFileSync(join(dataDir, SENTINEL_FILE), '');
    for (const line of (await serverCli(serverEnv, ['init'])).trim().split(/\r?\n/)) log(line);
  }
  log(`Données de dev : ${dataDir}`);
  if (settings.emptyPublicDir) mkdirSync(settings.emptyPublicDir, { recursive: true });
  const users = usersFromDbStats(await serverCli(serverEnv, ['db:stats']));
  const link =
    users === 0
      ? invitationLinkFrom(
          await serverCli(serverEnv, ['admin:bootstrap', '--birth-date', settings.birthDate]),
        )
      : null;
  return { settings, serverEnv, link };
}

async function main(): Promise<number> {
  let prepared: Awaited<ReturnType<typeof prepare>>;
  try {
    prepared = await prepare();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const { settings, serverEnv, link } = prepared;

  const { promise: stop, resolve: requestStop } = Promise.withResolvers<void>();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(signal, () => requestStop());

  const color: NodeJS.ProcessEnv =
    process.stdout.isTTY && process.env.FORCE_COLOR === undefined ? { FORCE_COLOR: '1' } : {};
  const server = spawnPrefixed('serveur', {
    args: [TSX_CLI, 'watch', '--clear-screen=false', 'src/main.ts'],
    cwd: SERVER_DIR,
    env: { ...serverEnv, ...color },
  });
  const web = spawnPrefixed('web', {
    args: [VITE_BIN, '--configLoader', 'runner', '--port', String(settings.webPort), '--strictPort'],
    cwd: WEB_DIR,
    env: { ...process.env, ...color },
  });
  log(`Serveur : http://localhost:${settings.serverPort}  ·  Web : http://localhost:${settings.webPort}`);
  if (link) {
    log('Premier lancement : il faut créer le compte administrateur.');
    log('Ouvre ce lien dans le navigateur (valable 24 h) :');
    log(`  ${link}`);
    log(
      "Tant que ce compte n'existe pas, chaque lancement donne un nouveau lien et l'ancien ne marche plus.",
    );
  }

  return supervise([server, web], { stop, graceMs: GRACE_MS, interrupt: interruptTree, killTree, log });
}

main().then(
  (code) => {
    process.exitCode = code;
    // Filet : rien ne doit retenir le processus une fois les enfants arrêtés.
    setTimeout(() => process.exit(code), 1000).unref();
  },
  (error: unknown) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
