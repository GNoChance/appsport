import { existsSync, renameSync, rmSync } from 'node:fs';
import { CivilDate } from '@appsport/contracts';
import { usernameKey } from '@appsport/domain';
import { bootstrapAdminInvitation } from './auth/bootstrap';
import { createPasswordReset } from './auth/password-reset';
import { type AppConfig, loadConfig } from './config';
import { migrate } from './db/migrate';
import { MIGRATIONS, type Migration } from './db/migrations/index';
import { openDatabase } from './db/open';
import { initServerMeta } from './db/server-meta';
import { type AppDeps, createAppDeps, cryptoIds, systemClock } from './deps';
import { HttpError } from './http/errors';
import { createLogger } from './logger';
import { openMigrated } from './startup';
import { assertStartupPreconditions } from './startup-guard';

export interface CliContext {
  env: Record<string, string | undefined>;
  out(line: string): void;
  err(line: string): void;
}

export interface CliCommand {
  usage: string;
  run(args: string[], ctx: CliContext): Promise<number>;
}

export function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = args[i + 1] ?? '';
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

/** Garde de démarrage et migrations, puis `fn` ; la base est toujours refermée. */
export async function withAppDeps<T>(ctx: CliContext, fn: (deps: AppDeps) => Promise<T>): Promise<T> {
  const config = loadConfig(ctx.env);
  assertStartupPreconditions(config);
  const logger = createLogger();
  const { sqlite, db } = await openMigrated(config, logger);
  try {
    return await fn(createAppDeps({ sqlite, db, config, logger }));
  } finally {
    sqlite.close();
  }
}

/** Construit la base sous un nom temporaire puis la renomme : jamais de base partielle. */
export async function runInit(
  config: AppConfig,
  ctx: CliContext,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  if (!existsSync(config.sentinelPath)) {
    ctx.err(`Fichier sentinelle absent : ${config.sentinelPath} ; init refusé.`);
    return 1;
  }
  if (existsSync(config.dbPath)) {
    ctx.err(`La base existe déjà : ${config.dbPath} ; init refusé.`);
    return 1;
  }
  const tmpPath = `${config.dbPath}.init-tmp`;
  const removeTmp = (): void => {
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${tmpPath}${suffix}`, { force: true });
  };
  removeTmp();
  const { sqlite, db } = openDatabase(tmpPath);
  let epoch: string;
  try {
    await migrate(db, migrations, systemClock);
    epoch = (await initServerMeta(db, { ids: cryptoIds(), clock: systemClock })).serverEpoch;
  } catch (error) {
    sqlite.close();
    removeTmp();
    throw error;
  }
  sqlite.close();
  renameSync(tmpPath, config.dbPath);
  ctx.out(`Base initialisée : ${config.dbPath}`);
  ctx.out(`Époque du serveur : ${epoch}`);
  return 0;
}

async function runAdminBootstrap(args: string[], ctx: CliContext): Promise<number> {
  const date = CivilDate.safeParse(parseFlags(args).flags['birth-date']);
  if (!date.success) {
    ctx.err('Date de naissance invalide : utilise --birth-date AAAA-MM-JJ.');
    return 1;
  }
  try {
    const { code, link } = await withAppDeps(ctx, (deps) => bootstrapAdminInvitation(deps, date.data));
    ctx.out('Invitation administrateur (valable 24 h)');
    ctx.out(`Lien : ${link}`);
    ctx.out(`Code : ${code}`);
    return 0;
  } catch (error) {
    if (error instanceof HttpError && error.code === 'under_min_age') {
      ctx.err('appsport est réservé aux 16 ans et plus.');
      return 1;
    }
    if (error instanceof HttpError && error.code === 'conflict') {
      ctx.err('Un administrateur existe déjà : utilise admin:reset <pseudo>.');
      return 1;
    }
    throw error;
  }
}

async function runAdminReset(args: string[], ctx: CliContext): Promise<number> {
  const username = parseFlags(args).positional[0];
  if (!username) {
    ctx.err('Pseudo manquant : utilise admin:reset <pseudo>.');
    return 1;
  }
  const created = await withAppDeps(ctx, async (deps) => {
    const user = await deps.db
      .selectFrom('user')
      .select(['id', 'username'])
      .where('usernameKey', '=', usernameKey(username))
      .executeTakeFirst();
    if (!user) return null;
    const link = await deps.db
      .transaction()
      .execute((trx) => createPasswordReset(trx, deps, user.id, { actorId: null, ip: null }));
    return { ...link, username: user.username };
  });
  if (!created) {
    ctx.err(`Pseudo inconnu : ${username}`);
    return 1;
  }
  ctx.out(`Lien de réinitialisation pour ${created.username} (valable 24 h)`);
  ctx.out(`Lien : ${created.link}`);
  ctx.out(`Code : ${created.code}`);
  return 0;
}

export const COMMANDS: Record<string, CliCommand> = {
  'admin:bootstrap': {
    usage:
      "admin:bootstrap --birth-date AAAA-MM-JJ : crée l'invitation du premier administrateur (valable 24 h)",
    run: runAdminBootstrap,
  },
  'admin:reset': {
    usage: 'admin:reset <pseudo> : crée un lien de réinitialisation du mot de passe (valable 24 h)',
    run: runAdminReset,
  },
  init: {
    usage: "init : crée la base d'un volume neuf (sentinelle requise) et fixe l'époque du serveur",
    run: (_args, ctx) => runInit(loadConfig(ctx.env), ctx),
  },
  'db:check': {
    usage: "db:check : vérifie l'intégrité de la base (integrity_check et foreign_key_check)",
    run: (_args, ctx) =>
      withAppDeps(ctx, async ({ sqlite }) => {
        const integrity = sqlite.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
        const foreign = sqlite.prepare('PRAGMA foreign_key_check').all();
        const integrityOk = integrity.length === 1 && integrity[0]?.integrity_check === 'ok';
        if (integrityOk && foreign.length === 0) {
          ctx.out('OK');
          return 0;
        }
        const problems = [
          ...(integrityOk ? [] : integrity.map((r) => r.integrity_check)),
          ...(foreign.length > 0 ? [`${foreign.length} clé(s) étrangère(s) invalide(s)`] : []),
        ];
        ctx.err(`Base corrompue : ${problems.join(' ; ')}`);
        return 1;
      }),
  },
};

export async function runCli(
  argv: string[],
  env: Record<string, string | undefined>,
  out: (line: string) => void = (line) => console.log(line),
  err: (line: string) => void = (line) => console.error(line),
): Promise<number> {
  const [name, ...args] = argv;
  const command = name !== undefined && Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (!command) {
    err(`Commande inconnue : ${name ?? ''}`);
    for (const c of Object.values(COMMANDS)) err(`  ${c.usage}`);
    return 1;
  }
  try {
    return await command.run(args, { env, out, err });
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
