import { authPurgeJob } from '../auth/purge';
import { syncPurgeJob } from '../sync/purge';
import type { DailyJob } from './scheduler';

/** Jobs quotidiens ; les jobs des tâches suivantes s'ajoutent ici. */
export const DAILY_JOBS: DailyJob[] = [authPurgeJob, syncPurgeJob];
