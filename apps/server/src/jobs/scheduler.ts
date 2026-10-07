import type { AppDeps } from '../deps';

export interface DailyJob {
  name: string;
  run(deps: AppDeps): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Un passage au démarrage puis toutes les 24 h ; l'échec d'un job est journalisé sans son message. */
export function startDailyJobs(deps: AppDeps, jobs: DailyJob[]): { stop(): Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> = Promise.resolve();
  const runAll = async (): Promise<void> => {
    for (const job of jobs) {
      if (stopped) return;
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
  const launch = (): void => {
    inFlight = inFlight.then(runAll);
  };
  launch();
  const timer = setInterval(launch, DAY_MS);
  timer.unref();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      return inFlight;
    },
  };
}
