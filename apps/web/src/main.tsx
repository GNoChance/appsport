import { createMonotonicUuidV7 } from '@appsport/domain';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { navigate } from 'wouter/use-browser-location';
import { App } from './App';
import { createApiClient } from './api/client';
import { type AppServices, handleAccountDeleted, ServicesProvider } from './app-services';
import { bootApp } from './boot';
import { createAppDb } from './local-db/db';
import { createSyncEngine } from './sync/engine';
import { browserTransport } from './sync/transport';

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
const services: AppServices = { db, api, sync, transport, now: Date.now, newOpId };

bootApp(services);

const root = document.getElementById('root');
if (!root) throw new Error('#root absent de index.html');
createRoot(root).render(
  <StrictMode>
    <Router>
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>
    </Router>
  </StrictMode>,
);
