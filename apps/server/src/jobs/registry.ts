import { authPurgeJob } from '../auth/purge';
import type { DailyJob } from './scheduler';

/** Jobs quotidiens ; les jobs des tâches suivantes s'ajoutent ici. */
export const DAILY_JOBS: DailyJob[] = [authPurgeJob];
