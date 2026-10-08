import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ONBOARDING_COMPLETED_EVENT } from '../../src/app-events';
import { setMeta } from '../../src/local-db/meta';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import {
  button,
  currentStep,
  newcomer,
  seedPrimaryGym,
  seedProfile,
  serveProfile,
} from '../support/onboarding';
import { DEFAULT_NOW, makeMe, renderApp } from '../support/render';
import { until } from '../support/wait';

const HOUR = 3_600_000;
const COMPLETE = '/api/me/onboarding/complete';

let events = 0;
const count = () => {
  events += 1;
};
afterEach(() => {
  window.removeEventListener(ONBOARDING_COMPLETED_EVENT, count);
  events = 0;
});

/** Onboarding repris à « C'est prêt » ; dernier pull il y a `pullAgoMs`. */
async function openReady(pullAgoMs: number) {
  const me = newcomer({ onboardingStep: 'health' });
  const db = createTestLocalDb();
  const api = createFakeApi().on('GET', '/api/catalog', { status: 304 });
  await seedProfile(db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
  await seedPrimaryGym(db);
  await setMeta(db, 'catalogVersion', 'cat-1');
  await setMeta(db, 'serverCatalogVersion', 'cat-1');
  await setMeta(db, 'lastPullOkAt', new Date(DEFAULT_NOW - pullAgoMs).toISOString());
  serveProfile(api, db, me);
  const rendered = await renderApp({ path: '/onboarding', me, db, api });
  await until(() => currentStep() === 'ready');
  return { ...rendered, api };
}

const indicatorState = () => screen.queryByTestId('offline-ready')?.getAttribute('data-state');

describe('ReadyStep (E8, R-SYN-33)', () => {
  it('récapitulatif, voyant vert, « Commencer » → fin de l’onboarding, événement, accueil', async () => {
    const { api, location } = await openReady(HOUR);
    api.on('POST', COMPLETE, { status: 200, body: makeMe() });
    window.addEventListener(ONBOARDING_COMPLETED_EVENT, count);
    for (const text of ['Prendre du muscle', '3 séances de 45 min', 'Basic Fit', 'Jamais']) {
      await screen.findByText(text);
    }
    await until(() => indicatorState() === 'ready');
    await until(() => !button('Commencer').disabled);
    fireEvent.click(button('Commencer'));
    await until(() => location() === '/');
    expect(api.calls.filter((c) => c.path === COMPLETE).map((c) => c.method)).toEqual(['POST']);
    await screen.findByText('Bonjour lea');
    expect(events).toBe(1);
  });

  it('dernier pull il y a 25 h : « Commencer » désactivé, « Réessayer » lance une synchro manuelle', async () => {
    const { sync, api } = await openReady(25 * HOUR);
    await until(() => indicatorState() === 'not-ready');
    expect(button('Commencer').disabled).toBe(true);
    fireEvent.click(button('Réessayer'));
    await until(() => sync.triggers.includes('manual'));
    expect(api.calls.some((c) => c.path === COMPLETE)).toBe(false);
  });

  it('409 onboarding_incomplete : retour au premier écran incomplet', async () => {
    const { api, location } = await openReady(HOUR);
    api.on('POST', COMPLETE, { status: 409, body: { error: 'onboarding_incomplete', step: 'availability' } });
    window.addEventListener(ONBOARDING_COMPLETED_EVENT, count);
    await until(() => indicatorState() === 'ready');
    await until(() => !button('Commencer').disabled);
    fireEvent.click(button('Commencer'));
    await until(() => currentStep() === 'availability');
    expect(location()).toBe('/onboarding');
    expect(events).toBe(0);
  });

  it('« Retour » ramène à la santé', async () => {
    await openReady(HOUR);
    fireEvent.click(button('Retour'));
    await until(() => currentStep() === 'health');
  });
});
