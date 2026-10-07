import type { Hono } from 'hono';
import { adminRoutes } from './admin/routes';
import type { AppEnv } from './app-env';
import { adminInvitationRoutes, invitationRoutes } from './auth/invitation-routes';
import { meRoutes } from './auth/me-routes';
import { authRoutes } from './auth/routes';
import type { AppDeps } from './deps';
import { healthRoutes } from './health/routes';
import { gymRoutes } from './places/gym-routes';
import { placeRoutes } from './places/place-routes';
import { consentRoutes } from './privacy/consent-routes';
import { profileRoutes } from './profile/routes';
import { syncRoutes } from './sync/routes';

/** Un routeur par ligne ; les routeurs des tâches suivantes s'ajoutent ici. */
export function mountRoutes(app: Hono<AppEnv>, deps: AppDeps): void {
  app.route('/', healthRoutes(deps));
  app.route('/api/auth', authRoutes(deps));
  app.route('/api/me', meRoutes(deps));
  app.route('/api/me', profileRoutes(deps));
  app.route('/api/me', consentRoutes(deps));
  app.route('/api/gyms', gymRoutes(deps));
  app.route('/api/places', placeRoutes(deps));
  app.route('/api/invitations', invitationRoutes(deps));
  app.route('/api/admin/invitations', adminInvitationRoutes(deps));
  app.route('/api/admin', adminRoutes(deps));
  app.route('/api/sync', syncRoutes(deps));
}
