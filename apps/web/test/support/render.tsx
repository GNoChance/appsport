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
}

export interface RenderAppResult extends RenderResult {
  services: AppServices;
  api: FakeApi;
  sync: FakeSyncEngine;
  db: AppDb;
  location(): string;
}

/** Rend `ui` avec des services de test, dans un routeur en mémoire (wouter). */
export async function renderWithServices(
  ui: ReactElement,
  opts: RenderAppOptions = {},
): Promise<RenderAppResult> {
  const api = opts.api ?? createFakeApi();
  const sync = opts.sync ?? createFakeSyncEngine();
  const db = opts.db ?? createTestLocalDb();
  const nowMs = opts.now ?? DEFAULT_NOW;
  const me = opts.me === undefined ? makeMe() : opts.me;
  if (me) {
    await setMeta(db, 'userId', me.id);
    await setMeta(db, 'me', me);
  }
  const memory = memoryLocation({ path: opts.path ?? '/', record: true });
  const services: AppServices = {
    db,
    api: createApiClient(api.transport, {
      onUnauthenticated: () => void sync.syncNow('manual'),
      onAccountDeleted: () => void handleAccountDeleted(db, memory.navigate),
    }),
    sync,
    transport: api.transport,
    now: () => nowMs,
    newOpId: createMonotonicUuidV7(
      () => nowMs,
      (n) => crypto.getRandomValues(new Uint8Array(n)),
    ),
  };
  const result = render(
    <Router hook={memory.hook} searchHook={memory.searchHook}>
      <ServicesProvider services={services}>{ui}</ServicesProvider>
    </Router>,
  );
  return {
    ...result,
    services,
    api,
    sync,
    db,
    location: () => memory.history.at(-1) ?? '',
  };
}

/** Rend l'appli entière (garde et routes) au chemin `path`. */
export function renderApp(opts: RenderAppOptions = {}): Promise<RenderAppResult> {
  return renderWithServices(<App />, opts);
}
