import type { MeResponse } from '@appsport/contracts';
import { useEffect, useRef } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { useMeState, useSyncState } from './app-services';
import { AdminGymsPage } from './features/admin/AdminGymsPage';
import { InvitationsPage } from './features/admin/InvitationsPage';
import { MembersPage } from './features/admin/MembersPage';
import { ServerHealthPage } from './features/admin/ServerHealthPage';
import { InvitePage } from './features/auth/InvitePage';
import { LoginPage } from './features/auth/LoginPage';
import { ResetPage } from './features/auth/ResetPage';
import { HomePage } from './features/home/HomePage';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { GymPage } from './features/places/GymPage';
import { PlaceDetail } from './features/places/PlaceDetail';
import { PlacesPage } from './features/places/PlacesPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { CreditsPage } from './features/public/CreditsPage';
import { HelpPage } from './features/public/HelpPage';
import { NotFound } from './features/public/NotFound';
import { PrivacyPage } from './features/public/PrivacyPage';
import { useRepos } from './repos';
import type { ConnectionState } from './sync/engine';
import { AppShell, PublicShell } from './ui';

/** Pages lisibles sans session (03 §13 : Confidentialité, Crédits, Aide) et parcours d'accès. */
export const PUBLIC_PATHS: readonly string[] = [
  '/login',
  '/invite',
  '/reset',
  '/privacy',
  '/credits',
  '/help',
];

export type GuardResult =
  | { kind: 'render' }
  | { kind: 'wait' }
  | { kind: 'redirect'; to: string }
  | { kind: 'not_found' };

const LOST_SESSION: readonly ConnectionState[] = ['unauthenticated', 'account_deleted'];

/** Sans tenir compte de la casse, comme les routes de wouter : `/Admin/members` est une page admin. */
const isAdminPath = (path: string) => {
  const p = path.toLowerCase();
  return p === '/admin' || p.startsWith('/admin/');
};

/** Chemin sans barre finale (`/privacy/` → `/privacy`), `/` gardé. */
export const normalizePath = (path: string): string => path.replace(/\/+$/, '') || '/';

/**
 * Garde des routes, dans l'ordre : chemin public ; base locale pas encore lue ; session absente ou
 * refusée par le serveur ; mot de passe à changer (R-MDP-1) ; onboarding ; rôle admin (R-ROLE-1).
 */
export function resolveGuard(i: {
  path: string;
  loaded: boolean;
  me: MeResponse | null;
  connection: ConnectionState;
}): GuardResult {
  const path = normalizePath(i.path);
  const sessionValid = i.me !== null && !LOST_SESSION.includes(i.connection);
  if (PUBLIC_PATHS.includes(path)) {
    return path === '/login' && sessionValid ? { kind: 'redirect', to: '/' } : { kind: 'render' };
  }
  if (!i.loaded) return { kind: 'wait' };
  if (!i.me || !sessionValid) return { kind: 'redirect', to: '/login' };
  if (i.me.mustChangePassword) {
    return path === '/profile' ? { kind: 'render' } : { kind: 'redirect', to: '/profile' };
  }
  const onboarded = i.me.onboardingCompletedAt !== null;
  if (!onboarded && path !== '/onboarding') return { kind: 'redirect', to: '/onboarding' };
  if (onboarded && path === '/onboarding') return { kind: 'redirect', to: '/' };
  if (isAdminPath(path) && i.me.role !== 'admin') return { kind: 'not_found' };
  return { kind: 'render' };
}

function PublicRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/invite" component={InvitePage} />
      <Route path="/reset" component={ResetPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/credits" component={CreditsPage} />
      <Route path="/help" component={HelpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ConnectedRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/profile/places" component={PlacesPage} />
      <Route path="/profile/places/:id" component={PlaceDetail} />
      <Route path="/gyms/:id" component={GymPage} />
      <Route path="/admin/members" component={MembersPage} />
      <Route path="/admin/invitations" component={InvitationsPage} />
      <Route path="/admin/gyms" component={AdminGymsPage} />
      <Route path="/admin/health" component={ServerHealthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export function App() {
  const [path] = useLocation();
  const { loaded, me } = useMeState();
  const { connection } = useSyncState();
  const repos = useRepos();
  const knownUser = loaded && me !== null;
  const refreshed = useRef(false);
  // Profil frais au lancement si l'appareil connaît une session (ageBand, consentements, mot de
  // passe à changer) ; hors ligne : cache. Sans session connue, aucune requête (pages publiques).
  useEffect(() => {
    if (!knownUser || refreshed.current) return;
    refreshed.current = true;
    repos.me.refresh().catch(() => {});
  }, [repos, knownUser]);
  const guard = resolveGuard({ path, loaded, me, connection });

  switch (guard.kind) {
    case 'wait':
      return null;
    case 'redirect':
      return <Redirect to={guard.to} replace />;
    case 'not_found':
      return (
        <AppShell>
          <NotFound />
        </AppShell>
      );
    case 'render': {
      const route = normalizePath(path);
      if (PUBLIC_PATHS.includes(route)) {
        return (
          <PublicShell>
            <PublicRoutes />
          </PublicShell>
        );
      }
      // L'onboarding n'a ni navigation de compte ni bandeau de mise à jour.
      if (route === '/onboarding') {
        return (
          <PublicShell homeLink={false}>
            <OnboardingFlow />
          </PublicShell>
        );
      }
      return (
        <AppShell>
          <ConnectedRoutes />
        </AppShell>
      );
    }
  }
}
