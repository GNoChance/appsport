import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CivilDate } from '@rune/contracts';
import { usernameKey } from '@rune/domain';
import { CamelCasePlugin, Kysely } from 'kysely';
import { z } from 'zod';
import { bootstrapAdminInvitation } from './auth/bootstrap';
import { createPasswordReset } from './auth/password-reset';
import { type AppConfig, dataDirFrom, loadConfig } from './config';
import { migrate } from './db/migrate';
import { MIGRATIONS, type Migration } from './db/migrations/index';
import { openDatabase } from './db/open';
import type { Database } from './db/schema';
import { initServerMeta } from './db/server-meta';
import { NodeSqliteDialect } from './db/sqlite-dialect';
import { type AppDeps, createAppDeps, cryptoIds, systemClock } from './deps';
import { HttpError } from './http/errors';
import { createLogger } from './logger';
import { listActiveWorkoutSessions } from './ops/active-sessions';
import { dbStats } from './ops/db-stats';
import { restoreSnapshot } from './ops/restore';
import { assertSnapshotTag, pruneSnapshots, takeSnapshot } from './ops/snapshot';
import {
  canonicalInstant,
  collectPrivacyEvents,
  hasActiveAdmin,
  PrivacyEventList,
  reapplyPrivacyEvents,
} from './privacy/reapply';
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
      ctx.err('Rune est réservé aux 16 ans et plus.');
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

/**
 * Lecture seule, sans garde, pragma ni migration : la source peut être un instantané ou une base
 * portant une migration inconnue ; elle n'est jamais modifiée (ni date, ni passage en WAL).
 */
async function runPrivacyCollect(args: string[], ctx: CliContext): Promise<number> {
  const { flags } = parseFlags(args);
  const since = z.iso.datetime().transform(canonicalInstant).safeParse(flags.since);
  if (!since.success) {
    ctx.err('Date --since invalide (format ISO 8601 attendu)');
    return 1;
  }
  const out = flags.out;
  if (!out) {
    ctx.err('Option --out obligatoire');
    return 1;
  }
  const source = flags.source || loadConfig(ctx.env).dbPath;
  const sqlite = new DatabaseSync(source, { readOnly: true });
  let events: PrivacyEventList['events'];
  try {
    const db = new Kysely<Database>({
      dialect: new NodeSqliteDialect({ database: sqlite }),
      plugins: [new CamelCasePlugin()],
    });
    events = await collectPrivacyEvents(db, since.data);
  } finally {
    sqlite.close();
  }
  const list: PrivacyEventList = {
    since: since.data,
    collectedAt: systemClock.now().toISOString(),
    source,
    events,
  };
  writeFileSync(out, JSON.stringify(list, null, 2));
  ctx.out(`${events.length} événement(s) écrit(s) dans ${out}`);
  return 0;
}

function readPrivacyList(path: string | undefined): PrivacyEventList | null {
  if (!path) return null;
  try {
    const parsed = PrivacyEventList.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function runPrivacyReapply(args: string[], ctx: CliContext): Promise<number> {
  const list = readPrivacyList(parseFlags(args).positional[0]);
  if (!list) {
    ctx.err('Fichier de réapplication invalide');
    return 1;
  }
  const { result, adminActive } = await withAppDeps(ctx, async (deps) => ({
    result: await reapplyPrivacyEvents(deps, list),
    adminActive: await hasActiveAdmin(deps.db),
  }));
  ctx.out(
    `Réapplication terminée : ${result.accountsDeleted} compte(s) supprimé(s), ${result.consentsWithdrawn} accord(s) santé retiré(s).`,
  );
  if (!adminActive) ctx.out('Aucun administrateur actif : lancer admin:bootstrap');
  return 0;
}

/** Volume chiffré non monté : ni instantané ni restauration (message sur stderr). */
function sentinelMissing(config: AppConfig, ctx: CliContext): boolean {
  if (existsSync(config.sentinelPath)) return false;
  ctx.err(`Volume de données absent : sentinelle ${config.sentinelPath} introuvable.`);
  return true;
}

/**
 * Copie à chaud, sans migration (un `pre-vX.Y.Z` est pris par l'ancienne version), puis élagage. L'élagage
 * passe même si l'instantané échoue (base absente, disque plein) : rien ne doit rester plus de 30 jours
 * (R-OPS-10, R-OPS-16), y compris des données supprimées ou retirées depuis.
 */
async function runSnapshot(args: string[], ctx: CliContext): Promise<number> {
  const tag = parseFlags(args).flags.tag ?? '';
  assertSnapshotTag(tag);
  const config = loadConfig(ctx.env);
  if (sentinelMissing(config, ctx)) return 1;
  const dataDir = resolve(config.dataDir);
  let path: string;
  try {
    assertStartupPreconditions(config);
    const { sqlite } = openDatabase(config.dbPath);
    try {
      path = await takeSnapshot({ sqlite, dataDir, clock: systemClock }, tag);
    } finally {
      sqlite.close();
    }
  } finally {
    await pruneSnapshots(dataDir, systemClock.now());
  }
  ctx.out(`Instantané écrit : ${path}`);
  return 0;
}

/** Service arrêté ; la sentinelle suffit : sur une machine neuve, il n'y a pas encore de base (P4 (b)). */
async function runRestore(args: string[], ctx: CliContext): Promise<number> {
  const file = parseFlags(args).positional[0];
  if (!file) {
    ctx.err('Instantané manquant : utilise restore <fichier.db>.');
    return 1;
  }
  const config = loadConfig(ctx.env);
  if (sentinelMissing(config, ctx)) return 1;
  const result = await restoreSnapshot({
    dataDir: resolve(config.dataDir),
    snapshotPath: resolve(file),
    ids: cryptoIds(),
    clock: systemClock,
  });
  if (result.replacedDir) ctx.out(`Base remplacée conservée 30 jours dans ${result.replacedDir}.`);
  ctx.out(`Restauration terminée. Nouvelle époque : ${result.epoch} (epoch_base_rev ${result.baseRev}).`);
  ctx.out('Lancez maintenant privacy:reapply, avant de redémarrer le service.');
  return 0;
}

/**
 * Lecture seule, sans garde ni migration (le service tourne) : une ligne `<pseudo>\t<startedAt>` par séance
 * en cours, lue par rune-update avant de demander confirmation (R-DEP-3).
 */
async function runSessionsActive(args: string[], ctx: CliContext): Promise<number> {
  const hours = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(parseFlags(args).flags.hours ?? '3');
  if (!hours.success) {
    ctx.err("Option --hours invalide : nombre entier d'heures attendu.");
    return 1;
  }
  const sqlite = new DatabaseSync(loadConfig(ctx.env).dbPath, { readOnly: true });
  try {
    for (const s of listActiveWorkoutSessions(sqlite, systemClock.now(), hours.data)) {
      ctx.out(`${s.username}\t${s.startedAt}`);
    }
  } finally {
    sqlite.close();
  }
  return 0;
}

/**
 * Une ligne JSON (DbStats), code 0 même si l'intégrité est KO. Lu par rune-restore-test sur la copie
 * restaurée (docker run sans env_file : ni APP_ORIGIN ni loadConfig) et sur la base réelle (service en marche) :
 * lecture seule, sans garde, withAppDeps ni migration ; une migration cassante inconnue ne gêne pas.
 */
async function runDbStats(_args: string[], ctx: CliContext): Promise<number> {
  const dbPath = join(dataDirFrom(ctx.env), 'rune.db');
  if (!existsSync(dbPath)) {
    ctx.err(`Base introuvable : ${dbPath}.`);
    return 1;
  }
  const sqlite = new DatabaseSync(dbPath, { readOnly: true });
  try {
    ctx.out(JSON.stringify(dbStats(sqlite)));
  } finally {
    sqlite.close();
  }
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
  'privacy:collect': {
    usage:
      "privacy:collect --since <ISO> [--source <fichier.db>] --out <fichier.json> : liste les suppressions de compte et retraits d'accord postérieurs à --since",
    run: runPrivacyCollect,
  },
  'privacy:reapply': {
    usage:
      'privacy:reapply <fichier.json> : réapplique après une restauration la liste écrite par privacy:collect',
    run: runPrivacyReapply,
  },
  snapshot: {
    usage:
      'snapshot --tag daily|pre-vX.Y.Z : copie cohérente à chaud dans snapshots/, puis élagage (3 par type, 30 jours au plus)',
    run: runSnapshot,
  },
  restore: {
    usage:
      'restore <fichier.db> : service arrêté, remplace la base (gardée 30 jours) et ouvre une nouvelle époque ; puis privacy:reapply',
    run: runRestore,
  },
  'sessions:active': {
    usage: 'sessions:active [--hours N] : séances en cours démarrées depuis moins de N heures (3 par défaut)',
    run: runSessionsActive,
  },
  init: {
    usage: "init : crée la base d'un volume neuf (sentinelle requise) et fixe l'époque du serveur",
    run: (_args, ctx) => runInit(loadConfig(ctx.env), ctx),
  },
  'db:stats': {
    usage:
      'db:stats : intégrité, comptes, compteur de synchro et dernière écriture de la base, en une ligne JSON (lecture seule)',
    run: runDbStats,
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
