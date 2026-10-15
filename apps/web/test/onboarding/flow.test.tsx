import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstIncompleteStep } from '@rune/domain';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shownStep } from '../../src/features/onboarding/OnboardingFlow';
import { createRepos } from '../../src/repos';
import { settle } from '../support/auth';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';
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

const ONBOARDING_CSS = resolve(import.meta.dirname, '../../src/features/onboarding/onboarding.module.css');

/** Onboarding dans l'appli (garde comprise), base et faux serveur fournis par le test. */
async function openFlow(me = newcomer()) {
  const db = createTestLocalDb();
  const api = createFakeApi();
  const server = serveProfile(api, db, me);
  return { db, api, me, server, render: () => renderApp({ path: '/onboarding', me, db, api }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const progress = () => screen.getByText(/^Étape \d sur 9$/).textContent;
/** Le titre de l'écran, nommé avec l'indicateur d'étape, a le focus. */
const hasFocus = (name: string) =>
  screen.queryByRole('heading', { level: 2, name }) === document.activeElement;

describe('OnboardingFlow (R-ONB-1, R-ONB-2)', () => {
  it("départ 'coach', « Étape 1 sur 9 », hors de la coquille de l'appli", async () => {
    const { render } = await openFlow();
    const { location } = await render();
    await until(() => currentStep() === 'coach');
    expect(progress()).toBe('Étape 1 sur 9');
    expect(location()).toBe('/onboarding');
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    // La marque ne mène pas hors de l'onboarding (la garde y ramènerait en perdant l'écran).
    expect(screen.getByText('Rune')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Rune' })).toBeNull();
  });

  it('en-tête des maquettes B01–B08 : la marque Rune, décorative, ouvre la ligne « Étape n sur 9 »', async () => {
    const { render } = await openFlow();
    await render();
    const title = await screen.findByRole('heading', { level: 2, name: 'Étape 1 sur 9 Choisis ton coach' });
    // La ligne qui nomme le titre commence par la marque, masquée : le nom reste « Étape n sur 9 <titre> ».
    const row = document.getElementById(title.getAttribute('aria-labelledby')?.split(' ')[0] ?? '');
    const mark = row?.firstElementChild;
    expect(mark?.tagName.toLowerCase()).toBe('svg');
    expect(mark?.getAttribute('viewBox')).toBe('0 0 512 512');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(row?.textContent).toBe('Étape 1 sur 9');
  });

  it('changement d’écran : le titre, nommé avec « Étape n sur 9 », reçoit le focus ; pas au premier affichage', async () => {
    const t = await openFlow();
    // Coach déjà choisi : reprise à l'objectif.
    await seedProfile(t.db);
    await t.render();
    await screen.findByRole('heading', { level: 2, name: 'Étape 2 sur 9 Objectif' });
    expect(document.activeElement).toBe(document.body);
    choose('Prendre du muscle');
    fireEvent.click(button('Continuer'));
    await until(() => hasFocus('Étape 3 sur 9 Autre sport'));
    fireEvent.click(button('Retour'));
    await until(() => hasFocus('Étape 2 sur 9 Objectif'));
    fireEvent.click(button('Retour'));
    await until(() => hasFocus('Étape 1 sur 9 Choisis ton coach'));
  });

  it('changement d’écran : le suivant entre par la droite, le retour par la gauche ; rien à la reprise', async () => {
    const animate = vi.spyOn(Element.prototype, 'animate');
    /** Entrée jouée en dernier sur l'écran affiché (`data-step`), ou null. */
    const entrance = () => {
      const i = animate.mock.contexts.lastIndexOf(screen.getByTestId('onboarding-step'));
      return i < 0 ? null : (animate.mock.calls[i]?.[0] as { transform?: string[] });
    };
    const t = await openFlow();
    await seedProfile(t.db);
    await t.render();
    await until(() => currentStep() === 'goal');
    expect(entrance()).toBeNull();
    await screen.findByRole('radio', { name: 'Prendre du muscle' });
    choose('Prendre du muscle');
    fireEvent.click(button('Continuer'));
    await until(() => currentStep() === 'sport');
    expect(entrance()?.transform).toEqual(['translateX(48px)', 'none']);
    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }));
    await until(() => currentStep() === 'goal');
    expect(entrance()?.transform).toEqual(['translateX(-48px)', 'none']);
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
    expect(progress()).toBe('Étape 6 sur 9');
  });

  it("santé validée : reprise à 'ready'", async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'health' }));
    await seedProfile(t.db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
    await seedPrimaryGym(t.db);
    await t.render();
    await until(() => currentStep() === 'ready');
    expect(progress()).toBe('Étape 9 sur 9');
  });

  it('nouvel appareil : la reprise est recalculée quand la première synchro arrive', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'place' }));
    const { sync } = await t.render();
    // Miroir vide : pas de coach connu, l'étape coach d'abord.
    await until(() => currentStep() === 'coach');
    await seedProfile(t.db, { goal: 'muscle' });
    await seedPrimaryGym(t.db);
    sync.set({ lastPullOkAt: '2026-10-06T12:00:00.000Z' });
    await until(() => currentStep() === 'experience');
    expect(progress()).toBe('Étape 6 sur 9');
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

  it('« Prendre du muscle » + « Continuer » → PATCH, puis « Autre sport » en 3 sur 9 ; « Retour » garde la réponse', async () => {
    const t = await openFlow();
    await seedProfile(t.db);
    await t.render();
    await until(() => currentStep() === 'goal');
    await screen.findByRole('radio', { name: 'Prendre du muscle' });
    expect(button('Continuer').disabled).toBe(true);
    choose('Prendre du muscle');
    expect(t.server.patches).toEqual([]);
    fireEvent.click(button('Continuer'));
    await until(() => currentStep() === 'sport');
    expect(t.server.patches).toEqual([{ goal: 'muscle', onboardingStep: 'goal' }]);
    expect(progress()).toBe('Étape 3 sur 9');

    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }));
    await until(() => currentStep() === 'goal');
    await until(() => isChecked('Prendre du muscle'));
    expect(progress()).toBe('Étape 2 sur 9');
    expect(t.server.patches).toHaveLength(1);
  });

  it('« Non » au sport enregistré, puis « Retour » depuis le lieu : « Non » toujours coché', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'goal' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await t.render();
    await until(() => currentStep() === 'sport');
    await screen.findByRole('radio', { name: 'Non' });
    choose('Non');
    fireEvent.click(button('Continuer'));
    await until(() => currentStep() === 'place_kind');
    expect(t.server.patches).toEqual([{ sportCode: null, sportOtherLabel: null, onboardingStep: 'sport' }]);
    fireEvent.click(button('Retour'));
    await until(() => currentStep() === 'sport');
    await until(() => isChecked('Non'));
    expect(button('Continuer').disabled).toBe(false);
  });

  it('sport enregistré, puis « Retour » depuis le lieu : « Oui » et le sport toujours cochés', async () => {
    const t = await openFlow(newcomer({ onboardingStep: 'goal' }));
    await seedProfile(t.db, { goal: 'muscle' });
    await t.render();
    await until(() => currentStep() === 'sport');
    await screen.findByRole('radio', { name: 'Oui' });
    choose('Oui');
    choose('Course à pied');
    fireEvent.click(button('Continuer'));
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
    expect(progress()).toBe('Étape 4 sur 9');
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
    fireEvent.click(button('Continuer'));
    await until(() => currentStep() === 'experience');
    expect(writes(t.api)).toEqual(['PATCH /api/me/training-profile']);
    expect(t.server.patches).toEqual([{ onboardingStep: 'place' }]);
  });

  it('hors ligne : « Nécessite le réseau » en alerte, on reste sur l’objectif', async () => {
    const t = await openFlow();
    await seedProfile(t.db);
    await t.render();
    await until(() => currentStep() === 'goal');
    await screen.findByRole('radio', { name: 'Gagner en force' });
    t.api.setOffline('reject');
    choose('Gagner en force');
    fireEvent.click(button('Continuer'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(currentStep()).toBe('goal');
    expect(t.server.patches).toEqual([]);
  });

  it('barre « Retour » / « Continuer » collée en bas (maquettes B01–B08) : l’erreur de l’écran y reste visible', async () => {
    const t = await openFlow();
    await seedProfile(t.db);
    await t.render();
    await until(() => currentStep() === 'goal');
    await screen.findByRole('radio', { name: 'Gagner en force' });
    t.api.setOffline('reject');
    choose('Gagner en force');
    fireEvent.click(button('Continuer'));
    const alert = await screen.findByRole('alert');
    // Le bloc de l'écran qui porte l'erreur porte aussi les deux boutons : collé en bas, il la garde à l'écran.
    const bar = [...screen.getByTestId('onboarding-step').children].find((c) => c.contains(alert));
    expect(bar?.contains(button('Continuer'))).toBe(true);
    expect(bar?.contains(button('Retour'))).toBe(true);
    const css = parseCssBlocks(readFileSync(ONBOARDING_CSS, 'utf8'));
    const sticky = declarationsOf(css, '.flow .bar');
    expect(sticky?.get('position')).toBe('sticky');
    expect(sticky?.get('bottom')).toBe('0');
    // Un champ qui prend le focus défile au-dessus de la barre, jamais dessous (WCAG 2.4.11).
    expect(declarationsOf(css, ':global(html):has(.flow)')?.get('scroll-padding-bottom')).toBeTruthy();
  });
});
