import type { MeResponse } from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import { type RenderResult, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { App } from '../../src/App';
import { createApiClient } from '../../src/api/client';
import { type AppServices, handleAccountDeleted, ServicesProvider } from '../../src/app-services';
import type { AppDb } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import type { SwStatus } from '../../src/sw/protocol';
import { createSyncEngine, type SyncEngine } from '../../src/sync/engine';
import { createFakeApi, createFakeSyncEngine, type FakeApi, type FakeSyncEngine } from './fake-api';
import { createTestLocalDb } from './local-db';

export const DEFAULT_NOW = Date.parse('2026-10-06T12:00:00.000Z');

/** Membre adulte actif, onboardé, sans consentement actif. */
export function makeMe(o: Partial<MeResponse> = {}): MeResponse {
  return {
    id: 'u-1',
    username: 'lea',
    role: 'member',
    status: 'active',
    birthDate: '1990-01-01',
    ageBand: 'adult',
    cautious: false,
    mustChangePassword: false,
    passwordReminderDue: false,
    onboardingStep: null,
    onboardingCompletedAt: '2026-10-01T10:00:00.000Z',
    termsVersion: '1.0',
    consents: {
      health: { active: false, textVersion: null, at: null },
      aiCoach: { active: false, textVersion: null, at: null },
    },
    ...o,
  };
}

export interface RenderAppOptions {
  path?: string;
  /** Utilisateur en session ; `null` : aucune session ; absent : `makeMe()`. */
  me?: MeResponse | null;
  api?: FakeApi;
  sync?: FakeSyncEngine;
  db?: AppDb;
  now?: number;
  /** Réponse du service worker ; absent : coquille et illustrations en cache. */
  swStatus?: SwStatus | null;
  /**
   * Moteur de synchro réel branché sur `api` (déclencheurs du document compris) au lieu du faux
   * `sync` ; le test le démarre (`engine.start()`, comme `bootApp`) et l'arrête.
   */
  realSync?: boolean;
}

export const DEFAULT_SW_STATUS: SwStatus = {
  type: 'STATUS',
  buildHash: 'test',
  shellCached: true,
  illustrationsMissing: 0,
};

export interface RenderAppResult extends RenderResult {
  services: AppServices;
  api: FakeApi;
  sync: FakeSyncEngine;
  /** Moteur en service : le faux `sync`, ou le moteur réel avec `realSync`. */
  engine: SyncEngine;
  db: AppDb;
  location(): string;
  /** Chaque adresse visitée, remplacements compris (l'historique de wouter les écrase). */
  visits(): string[];
}

export interface TestServices {
  services: AppServices;
  api: FakeApi;
  sync: FakeSyncEngine;
  engine: SyncEngine;
  db: AppDb;
  memory: ReturnType<typeof memoryLocation>;
  /** Adresses visitées depuis le chemin de départ, remplacements compris. */
  visits: string[];
}

/** Services de test sans rendu (dépôts testés seuls) ; `me` posé dans meta comme une session. */
export async function createTestServices(opts: RenderAppOptions = {}): Promise<TestServices> {
  const api = opts.api ?? createFakeApi();
  const sync = opts.sync ?? createFakeSyncEngine();
  const db = opts.db ?? createTestLocalDb();
  const nowMs = opts.now ?? DEFAULT_NOW;
  const me = opts.me === undefined ? makeMe() : opts.me;
  if (me) {
    await setMeta(db, 'userId', me.id);
    await setMeta(db, 'me', me);
  }
  const swStatus = opts.swStatus === undefined ? DEFAULT_SW_STATUS : opts.swStatus;
  const path = opts.path ?? '/';
  const memory = memoryLocation({ path, record: true });
  const visits = [path];
  const go = (to: string, replace = false) => {
    visits.push(to);
    memory.navigate(to, { replace });
  };
  // Comme main.tsx : le moteur réel renvoie vers la connexion après un 410 account_deleted.
  const engine: SyncEngine = opts.realSync
    ? createSyncEngine({
        db,
        transport: api.transport,
        now: () => nowMs,
        onAccountDeleted: () => go('/login?reason=account_deleted', true),
      })
    : sync;
  const services: AppServices = {
    db,
    api: createApiClient(api.transport, {
      onUnauthenticated: () => void engine.syncNow('manual'),
      onAccountDeleted: () => void handleAccountDeleted(db, (to) => go(to)),
    }),
    sync: engine,
    transport: api.transport,
    now: () => nowMs,
    newOpId: createMonotonicUuidV7(
      () => nowMs,
      (n) => crypto.getRandomValues(new Uint8Array(n)),
    ),
    swStatus: async () => swStatus,
  };
  return { services, api, sync, engine, db, memory, visits };
}

/** Rend `ui` avec des services de test, dans un routeur en mémoire (wouter). */
export async function renderWithServices(
  ui: ReactElement,
  opts: RenderAppOptions = {},
): Promise<RenderAppResult> {
  const { services, api, sync, engine, db, memory, visits } = await createTestServices(opts);
  const result = render(
    <Router
      hook={memory.hook}
      searchHook={memory.searchHook}
      aroundNav={(navigate, to, options) => {
        visits.push(to);
        navigate(to, options);
      }}
    >
      <ServicesProvider services={services}>{ui}</ServicesProvider>
    </Router>,
  );
  return {
    ...result,
    services,
    api,
    sync,
    engine,
    db,
    location: () => memory.history.at(-1) ?? '',
    visits: () => [...visits],
  };
}

/** Rend l'appli entière (garde et routes) au chemin `path`. */
export function renderApp(opts: RenderAppOptions = {}): Promise<RenderAppResult> {
  return renderWithServices(<App />, opts);
}
