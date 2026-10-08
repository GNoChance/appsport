import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_COMPLETED_EVENT } from '../../src/app-events';
import { CreateAccountForm } from '../../src/features/auth/CreateAccountForm';
import { reposFor } from '../../src/repos';
import { installPersistOnOnboarding } from '../../src/sw/persist';
import { click, fill, settle, stubDisplayMode } from '../support/auth';
import { createFakeApi } from '../support/fake-api';
import { makeMe, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const completed = () => window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETED_EVENT));

function fakeStatus() {
  return { requestPersistentStorage: vi.fn(async () => true) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('installPersistOnOnboarding (R-SYN-31)', () => {
  it('fin de l’onboarding dans l’appli installée → une demande', () => {
    const status = fakeStatus();
    const dispose = installPersistOnOnboarding(status, { standalone: () => true });
    completed();
    expect(status.requestPersistentStorage).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('dans un onglet de navigateur → aucune demande', () => {
    const status = fakeStatus();
    const dispose = installPersistOnOnboarding(status, { standalone: () => false });
    completed();
    expect(status.requestPersistentStorage).not.toHaveBeenCalled();
    dispose();
  });

  it('après la fonction rendue → plus aucune demande', () => {
    const status = fakeStatus();
    installPersistOnOnboarding(status, { standalone: () => true })();
    completed();
    expect(status.requestPersistentStorage).not.toHaveBeenCalled();
  });

  it('par défaut : isStandalone() de la fenêtre', () => {
    const status = fakeStatus();
    stubDisplayMode(true);
    const installed = installPersistOnOnboarding(status);
    completed();
    installed();
    stubDisplayMode(false);
    const browser = installPersistOnOnboarding(status);
    completed();
    browser();
    expect(status.requestPersistentStorage).toHaveBeenCalledTimes(1);
  });

  it('fenêtre fournie : seul son événement compte', () => {
    const status = fakeStatus();
    const win = new EventTarget() as unknown as Window;
    const dispose = installPersistOnOnboarding(status, { win, standalone: () => true });
    completed();
    expect(status.requestPersistentStorage).not.toHaveBeenCalled();
    win.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETED_EVENT));
    expect(status.requestPersistentStorage).toHaveBeenCalledTimes(1);
    dispose();
  });
});

describe('CreateAccountForm : stockage persistant à la création (R-CPT-2)', () => {
  const PHRASE = 'cheval agrafe batterie correcte';

  async function createAccount(standalone: boolean) {
    stubDisplayMode(standalone);
    const api = createFakeApi().on('POST', '/api/invitations/accept', {
      status: 200,
      body: makeMe({ id: 'u-9', username: 'lea', onboardingCompletedAt: null }),
    });
    const onCreated = vi.fn();
    const view = await renderWithServices(
      <CreateAccountForm code="ABCDEFGHJKMNPQR0" birthDate="2008-03-01" role="member" onCreated={onCreated} />,
      { me: null, api },
    );
    const request = vi.spyOn(reposFor(view.services).status, 'requestPersistentStorage');
    fill('Pseudo', 'lea');
    fill('Mot de passe', PHRASE);
    fill('Confirmation', PHRASE);
    fireEvent.click(screen.getByLabelText("J'ai lu la page Confidentialité et règles"));
    click('Créer mon compte');
    await until(() => onCreated.mock.calls.length === 1);
    await settle();
    return request;
  }

  it('appli installée → une demande', async () => {
    const request = await createAccount(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('onglet de navigateur → aucune demande', async () => {
    const request = await createAccount(false);
    expect(request).not.toHaveBeenCalled();
  });
});
