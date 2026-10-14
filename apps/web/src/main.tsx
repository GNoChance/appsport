import './ui/theme/tokens.css';
import './ui/theme/fonts.css';
import { createMonotonicUuidV7 } from '@rune/domain';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { navigate } from 'wouter/use-browser-location';
import { App } from './App';
import { createApiClient } from './api/client';
import { type AppServices, handleAccountDeleted, ServicesProvider } from './app-services';
import { bootApp } from './boot';
import { createAppDb } from './local-db/db';
import { reposFor } from './repos';
import { probeHealth } from './sw/kill-switch';
import { installPersistOnOnboarding } from './sw/persist';
import { bootServiceWorker } from './sw/register';
import { getSwStatus } from './sw/sw-client';
import { createSyncEngine } from './sync/engine';
import { browserTransport } from './sync/transport';
import { BootSplash } from './ui/BootSplash';
import { applyTheme, readThemeChoice } from './ui/theme/theme';

// Thème gardé sur l'appareil, posé avant tout rendu (spec refonte §4) ; Auto suit la media query CSS.
applyTheme(readThemeChoice());

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const go = (to: string) => navigate(to, { replace: true });

const db = createAppDb();
const transport = browserTransport();
const newOpId = createMonotonicUuidV7(Date.now, randomBytes);
const sync = createSyncEngine({
  db,
  transport,
  newOpId,
  onAccountDeleted: () => go('/login?reason=account_deleted'),
});
const api = createApiClient(transport, {
  onUnauthenticated: () => void sync.syncNow('manual'),
  onAccountDeleted: () => void handleAccountDeleted(db, go),
});
// Vite en développement n'enregistre pas de SW : coquille et illustrations réputées en cache.
const swStatus: AppServices['swStatus'] = import.meta.env.DEV
  ? async () => ({ type: 'STATUS', buildHash: 'dev', shellCached: true, illustrationsMissing: 0 })
  : () => getSwStatus();
const services: AppServices = { db, api, sync, transport, now: Date.now, newOpId, swStatus };
const repos = reposFor(services);

bootApp(services);
// R-SYN-31 : stockage persistant demandé à la fin de l'onboarding, dans l'appli installée.
installPersistOnOnboarding(repos.status);

const root = document.getElementById('root');
if (!root) throw new Error('#root absent de index.html');
createRoot(root).render(
  <StrictMode>
    <Router>
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>
    </Router>
    {/* Logo qui se dessine au premier affichage de la session, par-dessus l'écran sans le retarder. */}
    <BootSplash />
  </StrictMode>,
);

// Production seulement (Vite en développement ne sert pas de SW) ; non attendu : le premier rendu n'attend
// jamais. Sonde /api/health : interrupteur d'urgence (R-PWA-6), sinon enregistrement du SW.
if (import.meta.env.PROD) {
  void bootServiceWorker({ db, status: repos.status, sync, fetchHealth: () => probeHealth(transport) });
}
