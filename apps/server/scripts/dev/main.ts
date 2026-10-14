import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DB_FILE, SENTINEL_FILE } from '../../src/config';
import {
  DEV_MARKER_FILE,
  DevError,
  type DevSettings,
  devSettings,
  invitationLinkFrom,
  PROXY_PORT,
  planDataDir,
  portBusyMessage,
  usersFromDbStats,
} from './plan';
import { isPortBusy } from './ports';
import { type Command, type DevChild, interruptTree, killTree, runCapture, spawnPrefixed } from './processes';
import { createServerWatch, parseServerStatus } from './server-status';
import { supervise } from './supervisor';

// `pnpm dev` : base et premier admin au premier lancement, puis le serveur (tsx watch) et le web (Vite)
// ensemble, sorties préfixées ; Ctrl+C, l'échec du premier démarrage du serveur ou l'arrêt du web arrête tout.

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = join(SERVER_DIR, '..', '..');
const WEB_DIR = join(REPO_ROOT, 'apps', 'web');
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
    // Seulement avec la dérogation RUNE_DEV_ANY_PORT (tests) : sinon devSettings refuse ce port.
    log(`Attention : le proxy /api de Vite vise le port ${PROXY_PORT}, pas ${settings.serverPort}.`);
  }
  const serverEnv: NodeJS.ProcessEnv = { ...process.env, ...settings.serverEnv };
  const { dataDir } = settings;
  mkdirSync(dataDir, { recursive: true });
  const plan = planDataDir(
    {
      sentinelExists: existsSync(join(dataDir, SENTINEL_FILE)),
      dbExists: existsSync(join(dataDir, DB_FILE)),
      devMarkerExists: existsSync(join(dataDir, DEV_MARKER_FILE)),
    },
    dataDir,
  );
  if (plan.kind === 'refused') throw new DevError(plan.message);
  if (plan.kind === 'init') {
    if (plan.writeSentinel) writeFileSync(join(dataDir, SENTINEL_FILE), '');
    if (plan.writeDevMarker) writeFileSync(join(dataDir, DEV_MARKER_FILE), '');
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

  // Premier signal : arrêt poli ; un second (Ctrl+C répété pendant le délai) : tout est tué tout de suite.
  // Le gestionnaire reste en place, sinon le second signal tuerait le script et laisserait les enfants.
  const { promise: stop, resolve: requestStop } = Promise.withResolvers<void>();
  const { promise: force, resolve: requestForce } = Promise.withResolvers<void>();
  let signals = 0;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      signals += 1;
      if (signals === 1) requestStop();
      else requestForce();
    });
  }

  const color: NodeJS.ProcessEnv =
    process.stdout.isTTY && process.env.FORCE_COLOR === undefined ? { FORCE_COLOR: '1' } : {};
  // `tsx watch` survit à l'arrêt du serveur : les lignes de service de `server-entry.ts` disent s'il a démarré.
  const failedAtStart = Promise.withResolvers<number>();
  const watchServer = createServerWatch();
  const watcher = spawnPrefixed(
    'serveur',
    {
      args: [TSX_CLI, 'watch', '--clear-screen=false', 'scripts/dev/server-entry.ts'],
      cwd: SERVER_DIR,
      env: { ...serverEnv, ...color },
    },
    (line) => {
      const status = parseServerStatus(line);
      if (status === null) return true;
      const event = watchServer(status);
      if (event === 'failed-at-start' && status.kind === 'exit') failedAtStart.resolve(status.code);
      if (event === 'crashed') {
        log(
          "Le serveur s'est arrêté en erreur : il redémarrera à la prochaine modification. Le web reste lancé.",
        );
      }
      if (event === 'restarted') log('Le serveur est reparti.');
      return false;
    },
  );
  const server: DevChild = {
    ...watcher,
    // Échec au premier démarrage : rien ne le relancera sans modification, tout s'arrête.
    exited: Promise.race([
      watcher.exited,
      failedAtStart.promise.then(async (code) => {
        fail("Le serveur n'a pas pu démarrer : il faut corriger l'erreur ci-dessus, puis relancer pnpm dev.");
        await killTree(watcher);
        return code;
      }),
    ]),
  };
  const web = spawnPrefixed('web', {
    args: [VITE_BIN, '--configLoader', 'runner', '--port', String(settings.webPort), '--strictPort'],
    cwd: WEB_DIR,
    env: { ...process.env, ...color },
  });
  log(`Serveur : http://localhost:${settings.serverPort}  ·  Web : http://localhost:${settings.webPort}`);
  log(`Processus : serveur ${String(server.pid)}, web ${String(web.pid)}`);
  if (link) {
    log('Premier lancement : il faut créer le compte administrateur.');
    log('Ouvre ce lien dans le navigateur (valable 24 h) :');
    log(`  ${link}`);
    log(
      "Tant que ce compte n'existe pas, chaque lancement donne un nouveau lien et l'ancien ne marche plus.",
    );
  }

  return supervise([server, web], {
    stop,
    force,
    graceMs: GRACE_MS,
    interrupt: interruptTree,
    killTree,
    log,
  });
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
