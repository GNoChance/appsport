import type { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { AppDeps } from './deps';
import { healthRoutes } from './health/routes';

/** Un routeur par ligne ; les routeurs des tâches suivantes s'ajoutent ici. */
export function mountRoutes(app: Hono<AppEnv>, deps: AppDeps): void {
  app.route('/', healthRoutes(deps));
}
