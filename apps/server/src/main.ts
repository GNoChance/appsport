import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { runCli } from './cli';
import { loadConfig } from './config';
import { type AppDeps, createAppDeps } from './deps';
import { DAILY_JOBS } from './jobs/registry';
import { type DailyJob, startDailyJobs } from './jobs/scheduler';
import { createLogger, type Logger } from './logger';
import { openMigrated, STARTUP_TASKS, type StartupTask } from './startup';
import { assertStartupPreconditions } from './startup-guard';

export interface RunningServer {
  port: number;
  deps: AppDeps;
  close(): Promise<void>;
}

export async function startServer(
  env: Record<string, string | undefined>,
  opts: { startupTasks?: StartupTask[]; dailyJobs?: DailyJob[]; logger?: Logger } = {},
): Promise<RunningServer> {
  const config = loadConfig(env);
  assertStartupPreconditions(config);
  const logger = opts.logger ?? createLogger();
  const { sqlite, db } = await openMigrated(config, logger);
  try {
    const deps = createAppDeps({ sqlite, db, config, logger });
    for (const task of opts.startupTasks ?? STARTUP_TASKS) await task.run(deps);
    const app = createApp(deps);
    const listening = await new Promise<{ server: ReturnType<typeof serve>; port: number }>(
      (resolve, reject) => {
        const server = serve(
          { fetch: app.fetch, port: config.port, hostname: config.host },
          (info: AddressInfo) => resolve({ server, port: info.port }),
        );
        server.once('error', reject);
      },
    );
    const jobs = startDailyJobs(deps, opts.dailyJobs ?? DAILY_JOBS);
    return {
      port: listening.port,
      deps,
      close: async () => {
        jobs.stop();
        await new Promise<void>((resolve) => {
          listening.server.close(() => resolve());
          if ('closeIdleConnections' in listening.server) listening.server.closeIdleConnections();
        });
        sqlite.close();
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export async function main(argv: string[]): Promise<number> {
  if (argv.length > 0) return runCli(argv, process.env);
  const running = await startServer(process.env);
  return new Promise<number>((resolve) => {
    const stop = (): void => {
      setTimeout(() => process.exit(1), 9000).unref();
      void running.close().then(() => resolve(0));
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
