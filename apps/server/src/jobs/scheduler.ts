import type { AppDeps } from '../deps';

export interface DailyJob {
  name: string;
  run(deps: AppDeps): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Un passage au démarrage puis toutes les 24 h ; l'échec d'un job est journalisé sans son message. */
export function startDailyJobs(deps: AppDeps, jobs: DailyJob[]): { stop(): void } {
  const runAll = async (): Promise<void> => {
    for (const job of jobs) {
      try {
        await job.run(deps);
      } catch (error) {
        deps.logger.error('job_failed', {
          job: job.name,
          event: error instanceof Error ? error.name : 'Error',
        });
      }
    }
  };
  void runAll();
  const timer = setInterval(() => void runAll(), DAY_MS);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
