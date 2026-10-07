import type { MeResponse } from '@appsport/contracts';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type GuardResult, resolveGuard } from '../../src/App';
import type { ConnectionState } from '../../src/sync/engine';
import { createFakeSyncEngine } from '../support/fake-api';
import { makeMe, renderApp } from '../support/render';
import { until } from '../support/wait';

const notOnboarded = (o: Partial<MeResponse> = {}) =>
  makeMe({ onboardingCompletedAt: null, onboardingStep: 'goal', ...o });
const admin = (o: Partial<MeResponse> = {}) => makeMe({ role: 'admin', ...o });

type Row = [
  path: string,
  loaded: boolean,
  me: MeResponse | null,
  connection: ConnectionState,
  expected: GuardResult,
];
const RENDER: GuardResult = { kind: 'render' };
const to = (path: string): GuardResult => ({ kind: 'redirect', to: path });

const ROWS: Row[] = [
  ['/privacy', false, null, 'online', RENDER],
  ['/help', true, null, 'offline', RENDER],
  ['/invite', true, makeMe(), 'online', RENDER],
  ['/login', true, makeMe(), 'unauthenticated', RENDER],
  ['/profile', false, null, 'unknown', { kind: 'wait' }],
  ['/profile', true, null, 'online', to('/login')],
  ['/profile', true, makeMe(), 'unauthenticated', to('/login')],
  ['/profile', true, makeMe(), 'account_deleted', to('/login')],
  ['/', true, notOnboarded(), 'online', to('/onboarding')],
  ['/admin/members', true, admin({ onboardingCompletedAt: null }), 'online', to('/onboarding')],
  ['/onboarding', true, makeMe(), 'online', to('/')],
  ['/onboarding', true, notOnboarded(), 'online', RENDER],
  ['/profile', true, makeMe({ mustChangePassword: true }), 'online', RENDER],
  ['/', true, makeMe({ mustChangePassword: true }), 'online', to('/profile')],
  ['/login', true, makeMe(), 'online', to('/')],
  ['/admin/members', true, makeMe(), 'online', { kind: 'not_found' }],
  ['/admin/members', true, admin(), 'online', RENDER],
];

describe('resolveGuard', () => {
  it.each(ROWS)('%s, chargé %s, connexion %s', (path, loaded, me, connection, expected) => {
    expect(resolveGuard({ path, loaded, me, connection })).toEqual(expected);
  });
});

describe('App', () => {
  it('/privacy sans session', async () => {
    await renderApp({ path: '/privacy', me: null });
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Confidentialité et règles');
  });

  it('/profile sans session → /login', async () => {
    const { location } = await renderApp({ path: '/profile', me: null });
    await until(() => location() === '/login');
  });

  it('non onboardé sur / → /onboarding', async () => {
    const { location } = await renderApp({ path: '/', me: notOnboarded() });
    await until(() => location() === '/onboarding');
  });

  it('session refusée par le serveur → /login', async () => {
    const sync = createFakeSyncEngine({ connection: 'unauthenticated' });
    const { location } = await renderApp({ path: '/', sync });
    await until(() => location() === '/login');
  });

  it("lien 'Administration' pour un admin seulement", async () => {
    const first = await renderApp({ path: '/', me: admin() });
    const link = await screen.findByRole('link', { name: 'Administration' });
    expect(link.getAttribute('href')).toBe('/admin/members');
    first.unmount();
    await renderApp({ path: '/', me: makeMe() });
    await screen.findByText('Bonjour lea');
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });

  it('rappel annuel du mot de passe pour un admin', async () => {
    await renderApp({ path: '/', me: admin({ passwordReminderDue: true }) });
    expect((await screen.findByText(/Pense à changer ton mot de passe/)).textContent).toBe(
      'Pense à changer ton mot de passe (rappel annuel).',
    );
  });
});
