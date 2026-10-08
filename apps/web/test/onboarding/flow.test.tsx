import { firstIncompleteStep } from '@appsport/domain';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { shownStep } from '../../src/features/onboarding/OnboardingFlow';
import { createRepos } from '../../src/repos';
import { settle } from '../support/auth';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import {
  button,
  choose,
  currentStep,
  isChecked,
  newcomer,
  radio,
  seedPrimaryGym,
  seedProfile,
  serveProfile,
  writes,
} from '../support/onboarding';
import { createTestServices, renderApp } from '../support/render';
import { until } from '../support/wait';

/** Onboarding dans l'appli (garde comprise), base et faux serveur fournis par le test. */
async function openFlow(me = newcomer()) {
  const db = createTestLocalDb();
  const api = createFakeApi();
  const server = serveProfile(api, db, me);
  return { db, api, me, server, render: () => renderApp({ path: '/onboarding', me, db, api }) };
}

const progress = () => screen.getByText(/^Étape \d\/8$/).textContent;
/** Le titre de l'écran, nommé avec l'indicateur d'étape, a le focus. */
const hasFocus = (name: string) =>
  screen.queryByRole('heading', { level: 2, name }) === document.activeElement;

describe('OnboardingFlow (R-ONB-1, R-ONB-2)', () => {
  it("départ 'goal', « Étape 1/8 », hors de la coquille de l'appli", async () => {
    const { render } = await openFlow();
    const { location } = await render();
    await until(() => currentStep() === 'goal');
    expect(progress()).toBe('Étape 1/8');
    expect(location()).toBe('/onboarding');
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    // La marque ne mène pas hors de l'onboarding (la garde y ramènerait en perdant l'écran).
    expect(screen.getByText('appsport')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'appsport' })).toBeNull();
  });

  it('changement d’écran : le titre, nommé avec « Étape n/8 », reçoit le focus ; pas au premier affichage', async () => {
    const t = await openFlow();
    await t.render();
    await screen.findByRole('heading', { level: 2, name: 'Étape 1/8 Objectif' });
    expect(document.activeElement).toBe(document.body);
    choose('Prendre du muscle');
    fireEvent.click(button('Suivant'));
    await until(() => hasFocus('Étape 2/8 Autre sport'));
    fireEvent.click(button('Retour'));
    await until(() => hasFocus('Étape 1/8 Objectif'));
  });

  it('reprise au premier écran incomplet (firstIncompleteStep)', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'place' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await seedPrimaryGym(t.db);
    const { services } = await createTestServices({ db: t.db, me: t.me });
    const expected = firstIncompleteStep(await createRepos(services).profile.onboardingInput());
    expect(expected).toBe('experience');
    await t.render();
    await until(() => currentStep() === 'experience');
    expect(progress()).toBe('Étape 5/8');
  });

  it("santé validée : reprise à 'ready'", async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'health' }));
    await seedProfile(t.db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
    await seedPrimaryGym(t.db);
    await t.render();
    await until(() => currentStep() === 'ready');
    expect(progress()).toBe('Étape 8/8');
  });

  it('nouvel appareil : la reprise est recalculée quand la première synchro arrive', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'place' }));
    const { sync } = await t.render();
    await until(() => currentStep() === 'goal');
    await seedProfile(t.db, { goal: 'muscle' });
    await seedPrimaryGym(t.db);
    sync.set({ lastPullOkAt: '2026-10-06T12:00:00.000Z' });
    await until(() => currentStep() === 'experience');
    expect(progress()).toBe('Étape 5/8');
  });

  it('écran déjà changé par l’utilisateur : une synchro ne le déplace plus', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'goal' }));
    await seedProfile(t.db, { goal: 'muscle' });
    const { sync } = await t.render();
    await until(() => currentStep() === 'sport');
    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }));
    await until(() => currentStep() === 'goal');
    sync.set({ lastPullOkAt: '2026-10-06T12:00:00.000Z' });
    await settle();
    expect(currentStep()).toBe('goal');
  });

  it('« Prendre du muscle » + « Suivant » → PATCH, puis « Autre sport » en 2/8 ; « Retour » garde la réponse', async () => {
    const t = await openFlow();
    await t.render();
    await until(() => currentStep() === 'goal');
    await screen.findByRole('radio', { name: 'Prendre du muscle' });
    expect(button('Suivant').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
    choose('Prendre du muscle');
    expect(t.server.patches).toEqual([]);
    fireEvent.click(button('Suivant'));
    await until(() => currentStep() === 'sport');
    expect(t.server.patches).toEqual([{ goal: 'muscle', onboardingStep: 'goal' }]);
    expect(progress()).toBe('Étape 2/8');

    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }));
    await until(() => currentStep() === 'goal');
    await until(() => isChecked('Prendre du muscle'));
    expect(progress()).toBe('Étape 1/8');
    expect(t.server.patches).toHaveLength(1);
  });

  it('« Non » au sport enregistré, puis « Retour » depuis le lieu : « Non » toujours coché', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'goal' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await t.render();
    await until(() => currentStep() === 'sport');
    await screen.findByRole('radio', { name: 'Non' });
    choose('Non');
    fireEvent.click(button('Suivant'));
    await until(() => currentStep() === 'place_kind');
    expect(t.server.patches).toEqual([{ sportCode: null, sportOtherLabel: null, onboardingStep: 'sport' }]);
    fireEvent.click(button('Retour'));
    await until(() => currentStep() === 'sport');
    await until(() => isChecked('Non'));
    expect(button('Suivant').disabled).toBe(false);
  });

  it('sport enregistré, puis « Retour » depuis le lieu : « Oui » et le sport toujours cochés', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'goal' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await t.render();
    await until(() => currentStep() === 'sport');
    await screen.findByRole('radio', { name: 'Oui' });
    choose('Oui');
    choose('Course à pied');
    fireEvent.click(button('Suivant'));
    await until(() => currentStep() === 'place_kind');
    fireEvent.click(button('Retour'));
    await until(() => currentStep() === 'sport');
    await until(() => isChecked('Oui') && isChecked('Course à pied'));
  });

  it("reprise sans lieu principal : 'place_kind', aucun type coché (le choix n'est pas gardé)", async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'place_kind' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await t.render();
    await until(() => currentStep() === 'place_kind');
    expect(radio('À la salle').checked).toBe(false);
    expect(radio('À la maison').checked).toBe(false);
    expect(progress()).toBe('Étape 3/8');
  });

  it("shownStep : 'place' sans type de lieu connu → 'place_kind' ; avec un type → 'place'", () => {
    expect(shownStep({ step: 'place', kind: null })).toBe('place_kind');
    expect(shownStep({ step: 'place', kind: 'gym' })).toBe('place');
    expect(shownStep({ step: 'experience', kind: null })).toBe('experience');
  });

  it('retour depuis le niveau : le lieu principal existant est affiché, rien n’est recréé', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'place' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await seedPrimaryGym(t.db);
    await t.render();
    await until(() => currentStep() === 'experience');
    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }));
    await until(() => currentStep() === 'place');
    await screen.findByText('Ton lieu principal : Basic Fit');
    fireEvent.click(button('Suivant'));
    await until(() => currentStep() === 'experience');
    expect(writes(t.api)).toEqual(['PATCH /api/me/training-profile']);
    expect(t.server.patches).toEqual([{ onboardingStep: 'place' }]);
  });

  it('hors ligne : « Nécessite le réseau » en alerte, on reste sur l’objectif', async () => {
    const t = await openFlow();
    await t.render();
    await until(() => currentStep() === 'goal');
    await screen.findByRole('radio', { name: 'Gagner en force' });
    t.api.setOffline('reject');
    choose('Gagner en force');
    fireEvent.click(button('Suivant'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(currentStep()).toBe('goal');
    expect(t.server.patches).toEqual([]);
  });
});
