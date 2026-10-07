import type { MeResponse } from '@appsport/contracts';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { useMeState, useSyncState } from './app-services';
import { HomePage } from './features/home/HomePage';
import { CreditsPage } from './features/public/CreditsPage';
import { HelpPage } from './features/public/HelpPage';
import { NotFound } from './features/public/NotFound';
import { PrivacyPage } from './features/public/PrivacyPage';
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

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/');

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
      <Route component={NotFound} />
    </Switch>
  );
}

export function App() {
  const [path] = useLocation();
  const { loaded, me } = useMeState();
  const { connection } = useSyncState();
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
    case 'render':
      return PUBLIC_PATHS.includes(normalizePath(path)) ? (
        <PublicShell>
          <PublicRoutes />
        </PublicShell>
      ) : (
        <AppShell>
          <ConnectedRoutes />
        </AppShell>
      );
  }
}
