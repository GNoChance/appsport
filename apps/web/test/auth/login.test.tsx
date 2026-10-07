import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LoginPage } from '../../src/features/auth/LoginPage';
import { deleteMeta, getMeta } from '../../src/local-db/meta';
import { click, fill, openUrl } from '../support/auth';
import { createFakeApi, createFakeSyncEngine, type FakeApi } from '../support/fake-api';
import { makeMe, type RenderAppOptions, renderApp, renderWithServices } from '../support/render';
import { seedOutbox } from '../support/seed';

const LOGIN = '/api/auth/login';
const reply = (body: unknown, status = 200) => ({ status, body });
const loginCalls = (api: FakeApi) => api.calls.filter((c) => c.path === LOGIN);
const renderLogin = (opts: RenderAppOptions = {}) =>
  renderWithServices(<LoginPage />, { path: '/login', ...opts });
const lea = makeMe({ id: 'u-1', username: 'lea' });
const max = makeMe({ id: 'u-2', username: 'max' });

afterEach(() => openUrl('/'));

const signIn = (username: string, password = 'mot de passe correct') => {
  fill('Pseudo', username);
  fill('Mot de passe', password);
  click('Se connecter');
};

describe('connexion (R-AUTH-1, R-AUTH-5)', () => {
  it('Pseudo, Mot de passe, Se connecter → POST /api/auth/login puis accueil', async () => {
    const api = createFakeApi().on('POST', LOGIN, reply(lea));
    const { location } = await renderLogin({ me: null, api });
    const password = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('current-password');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).autocomplete).toBe('username');
    signIn('lea', 'cheval agrafe batterie correcte');
    await waitFor(() => expect(location()).toBe('/'));
    expect(loginCalls(api)[0]?.body).toEqual({
      username: 'lea',
      password: 'cheval agrafe batterie correcte',
    });
  });

  it('401 invalid_credentials : message unique, formulaire gardé', async () => {
    const api = createFakeApi().on('POST', LOGIN, reply({ error: 'invalid_credentials' }, 401));
    const { location } = await renderLogin({ me: null, api });
    signIn('lea');
    expect((await screen.findByRole('alert')).textContent).toBe('Pseudo ou mot de passe incorrect');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('lea');
    expect(location()).toBe('/login');
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
  });

  it('403 account_disabled', async () => {
    const api = createFakeApi().on('POST', LOGIN, reply({ error: 'account_disabled' }, 403));
    await renderLogin({ me: null, api });
    signIn('lea');
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Compte désactivé, contacte l'administrateur",
    );
  });

  it('429 rate_limited : minutes arrondies au supérieur (R-AUTH-2)', async () => {
    const api = createFakeApi().on('POST', LOGIN, reply({ error: 'rate_limited', retryAfterS: 61 }, 429));
    await renderLogin({ me: null, api });
    signIn('lea');
    expect((await screen.findByRole('alert')).textContent).toBe('Trop de tentatives. Réessaie dans 2 min.');
  });

  it('hors ligne : « Nécessite le réseau »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderLogin({ me: null, api });
    signIn('lea');
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
  });

  it("liens vers la saisie d'un code d'invitation et d'un lien de réinitialisation", async () => {
    await renderLogin({ me: null });
    expect(screen.getByRole('link', { name: "J'ai un code d'invitation" }).getAttribute('href')).toBe(
      '/invite',
    );
    expect(screen.getByRole('link', { name: "J'ai un lien de réinitialisation" }).getAttribute('href')).toBe(
      '/reset',
    );
  });
});

describe('autre pseudo sur un appareil qui a des données non envoyées (R-AUTH-8, P-AUT-6)', () => {
  async function renderWithPending(n = 2) {
    const api = createFakeApi().on('POST', LOGIN, reply(max));
    const view = await renderLogin({ me: lea, api });
    await seedOutbox(view.db, 'u-1', n);
    return { ...view, api };
  }

  it('avertit avant toute requête ; Annuler : aucune requête, file gardée', async () => {
    const { api, db, location } = await renderWithPending();
    signIn('max');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('2 éléments non envoyés de lea seront effacés de cet appareil');
    expect(loginCalls(api)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(loginCalls(api)).toHaveLength(0);
    expect(await db.outbox.count()).toBe(2);
    expect(location()).toBe('/login');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('max');
  });

  it('Continuer : connexion, accueil, file effacée', async () => {
    const { api, db, location } = await renderWithPending();
    signIn('max');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(location()).toBe('/'));
    await waitFor(async () => expect(await db.outbox.count()).toBe(0));
    expect(loginCalls(api)).toHaveLength(1);
    expect(await getMeta(db, 'userId')).toBe('u-2');
  });

  it('Continuer puis identifiants refusés : la file reste', async () => {
    const { api, db } = await renderWithPending();
    api.on('POST', LOGIN, reply({ error: 'invalid_credentials' }, 401));
    signIn('max');
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuer' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Pseudo ou mot de passe incorrect');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await db.outbox.count()).toBe(2);
  });

  it('1 seul élément : forme du singulier', async () => {
    await renderWithPending(1);
    signIn('max');
    expect((await screen.findByRole('dialog')).textContent).toContain(
      '1 élément non envoyé de lea sera effacé de cet appareil',
    );
  });

  it("même pseudo en casse différente : pas d'avertissement, file gardée", async () => {
    const { api, db, location } = await renderWithPending();
    api.on('POST', LOGIN, reply(lea));
    signIn('LEA');
    await waitFor(() => expect(location()).toBe('/'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await db.outbox.count()).toBe(2);
    expect(await getMeta(db, 'userId')).toBe('u-1');
  });

  it("autre pseudo sans rien en attente : pas d'avertissement", async () => {
    const api = createFakeApi().on('POST', LOGIN, reply(max));
    const { location } = await renderLogin({ me: lea, api });
    signIn('max');
    await waitFor(() => expect(location()).toBe('/'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("propriétaire sans nom connu : l'avertissement garde un nom lisible", async () => {
    const { db } = await renderWithPending();
    await deleteMeta(db, 'me');
    signIn('max');
    expect((await screen.findByRole('dialog')).textContent).toContain(
      "2 éléments non envoyés de l'ancien compte seront effacés de cet appareil",
    );
  });
});

describe('session perdue et compte supprimé (R-AUTH-8, P-DRT-4)', () => {
  it('?reason=account_deleted : « Ce compte a été supprimé »', async () => {
    await renderLogin({ me: null, path: '/login?reason=account_deleted' });
    expect(screen.getByText('Ce compte a été supprimé')).toBeTruthy();
  });

  it('autre raison ou aucune : pas de message', async () => {
    await renderLogin({ me: null, path: '/login?reason=autre' });
    expect(screen.queryByText('Ce compte a été supprimé')).toBeNull();
    expect(screen.queryByText('Ta session a expiré. Reconnecte-toi.')).toBeNull();
  });

  it('connexion « unauthenticated » : « Ta session a expiré. Reconnecte-toi. »', async () => {
    const sync = createFakeSyncEngine({ connection: 'unauthenticated' });
    await renderLogin({ me: lea, sync });
    expect(screen.getByText('Ta session a expiré. Reconnecte-toi.')).toBeTruthy();
  });

  it("après un compte supprimé : une nouvelle session s'ouvre et le moteur repart", async () => {
    const api = createFakeApi().on('POST', LOGIN, reply(max));
    const sync = createFakeSyncEngine({ connection: 'account_deleted' });
    const { location, db } = await renderLogin({
      me: null,
      sync,
      api,
      path: '/login?reason=account_deleted',
    });
    expect(screen.getByText('Ce compte a été supprimé')).toBeTruthy();
    signIn('max');
    await waitFor(() => expect(location()).toBe('/'));
    expect(sync.started).toBe(true);
    expect(sync.triggers).toContain('manual');
    expect(await getMeta(db, 'userId')).toBe('u-2');
  });
});

describe("route /login de l'appli", () => {
  it('sans session : le formulaire dans le cadre public', async () => {
    await renderApp({ path: '/login', me: null });
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(screen.queryByText('Page introuvable')).toBeNull();
  });
});
