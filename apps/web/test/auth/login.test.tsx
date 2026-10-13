import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteMeta, getMeta } from '../../src/local-db/meta';
import type { SyncEngine } from '../../src/sync/engine';
import { click, fill, lostSessionApi, openUrl, settle } from '../support/auth';
import { createFakeApi, createFakeSyncEngine, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { makeMe, type RenderAppOptions, renderApp } from '../support/render';
import { seedOutbox } from '../support/seed';
import { until } from '../support/wait';

const LOGIN = '/api/auth/login';
const EXPIRED = 'Ta session a expiré. Reconnecte-toi.';
const DELETED = 'Ce compte a été supprimé';
const reply = (body: unknown, status = 200) => ({ status, body });
const loginCalls = (api: FakeApi) => api.calls.filter((c) => c.path === LOGIN);
/** Écran de connexion dans l'appli, garde comprise : une session en cache n'y reste que perdue. */
const renderLogin = (opts: RenderAppOptions = {}) => renderApp({ path: '/login', ...opts });
const lostSession = () => createFakeSyncEngine({ connection: 'unauthenticated' });
const lea = makeMe({ id: 'u-1', username: 'lea' });
const max = makeMe({ id: 'u-2', username: 'max' });

let engine: SyncEngine | null = null;
afterEach(() => {
  engine?.stop();
  engine = null;
  openUrl('/');
});

const signIn = (username: string, password = 'mot de passe correct') => {
  fill('Pseudo', username);
  fill('Mot de passe', password);
  click('Se connecter');
};

describe('connexion (R-AUTH-1, R-AUTH-5)', () => {
  it('Pseudo, Mot de passe, Se connecter → POST /api/auth/login puis accueil', async () => {
    const api = createFakeApi().on('POST', LOGIN, reply(lea));
    const { location, visits } = await renderLogin({ me: null, api });
    const password = (await screen.findByLabelText('Mot de passe')) as HTMLInputElement;
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('current-password');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).autocomplete).toBe('username');
    const mark = visits().length;
    signIn('lea', 'cheval agrafe batterie correcte');
    await screen.findByText('Bonjour lea');
    expect(location()).toBe('/');
    expect(visits().slice(mark)).toEqual(['/']);
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
    expect(
      (await screen.findByRole('link', { name: "J'ai un code d'invitation" })).getAttribute('href'),
    ).toBe('/invite');
    expect(screen.getByRole('link', { name: "J'ai un lien de réinitialisation" }).getAttribute('href')).toBe(
      '/reset',
    );
  });

  it("route /login de l'appli sans session : le formulaire dans le cadre public", async () => {
    await renderLogin({ me: null });
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(screen.queryByText('Page introuvable')).toBeNull();
  });
});

describe('autre pseudo sur un appareil qui a des données non envoyées (R-AUTH-8, P-AUT-6)', () => {
  /** Session de `owner` perdue, `n` éléments à lui en attente ; la connexion répond `max`. */
  async function renderWithPending(n = 2, owner = lea) {
    const api = createFakeApi().on('POST', LOGIN, reply(max));
    const view = await renderLogin({ me: owner, api, sync: lostSession() });
    await seedOutbox(view.db, owner.id, n);
    await screen.findByRole('button', { name: 'Se connecter' });
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
    await screen.findByText('Bonjour max');
    expect(location()).toBe('/');
    expect(await db.outbox.count()).toBe(0);
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

  it("même pseudo, casse et forme Unicode différentes des deux côtés : pas d'avertissement, file gardée", async () => {
    const owner = makeMe({ id: 'u-1', username: 'Léa' });
    const { api, db, location } = await renderWithPending(2, owner);
    api.on('POST', LOGIN, reply(owner));
    // Majuscules et accent décomposé (E + U+0301) : même clé NFKC puis minuscules que « Léa ».
    signIn('LÉA');
    await screen.findByText('Bonjour Léa');
    expect(location()).toBe('/');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await db.outbox.count()).toBe(2);
    expect(await getMeta(db, 'userId')).toBe('u-1');
  });

  it("autre pseudo sans rien en attente : pas d'avertissement", async () => {
    const api = createFakeApi().on('POST', LOGIN, reply(max));
    const { location } = await renderLogin({ me: lea, api, sync: lostSession() });
    signIn('max');
    await screen.findByText('Bonjour max');
    expect(location()).toBe('/');
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

describe('session perdue et compte supprimé : bandeaux (R-AUTH-8, P-DRT-4)', () => {
  it('?reason=account_deleted : « Ce compte a été supprimé »', async () => {
    await renderLogin({ me: null, path: '/login?reason=account_deleted' });
    expect(await screen.findByText(DELETED)).toBeTruthy();
  });

  it('autre raison ou aucune : pas de message', async () => {
    await renderLogin({ me: null, path: '/login?reason=autre' });
    await screen.findByRole('button', { name: 'Se connecter' });
    expect(screen.queryByText(DELETED)).toBeNull();
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('connexion « unauthenticated » : « Ta session a expiré. Reconnecte-toi. »', async () => {
    await renderLogin({ me: lea, sync: lostSession() });
    expect(await screen.findByText(EXPIRED)).toBeTruthy();
  });
});

describe("session perdue, garde de l'appli et moteur réel (R-SYN-12, R-AUTH-8, P-DRT-4)", () => {
  /** L'appli s'ouvre sur l'accueil avec une session que le serveur refuse ; la garde mène à /login. */
  async function launchWithLostSession(lost: 'unauthenticated' | 'account_deleted', pending = 0) {
    const api = lostSessionApi(lost);
    const db = createTestLocalDb();
    if (pending > 0) await seedOutbox(db, lea.id, pending);
    const view = await renderApp({ path: '/', me: lea, api, db, realSync: true });
    engine = view.engine;
    view.engine.start();
    await screen.findByText(lost === 'unauthenticated' ? EXPIRED : DELETED);
    // Navigations du lancement (garde, moteur, client API) terminées.
    await settle();
    expect(view.location()).toMatch(/^\/login/);
    return { ...view, api };
  }

  it('401 puis connexion réussie : accueil, sans retour à /login ni bandeau', async () => {
    const { api, location, visits } = await launchWithLostSession('unauthenticated');
    api.on('POST', LOGIN, () => {
      api.open();
      return reply(lea);
    });
    const mark = visits().length;
    signIn('lea');
    await screen.findByText('Bonjour lea');
    const real = engine as SyncEngine;
    await until(() => real.getState().connection === 'online' && !real.getState().syncing);
    expect(visits().slice(mark)).toEqual(['/']);
    expect(location()).toBe('/');
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).toBeNull();
  });

  it("compte supprimé puis connexion d'un autre compte : accueil, sans retour à /login ni bandeau", async () => {
    const { api, db, location, visits } = await launchWithLostSession('account_deleted');
    api.on('POST', LOGIN, () => {
      api.open();
      return reply(max);
    });
    const mark = visits().length;
    signIn('max');
    await screen.findByText('Bonjour max');
    const real = engine as SyncEngine;
    await until(() => real.getState().connection === 'online' && !real.getState().syncing);
    expect(visits().slice(mark)).toEqual(['/']);
    expect(location()).toBe('/');
    expect(screen.queryByText(DELETED)).toBeNull();
    expect(await getMeta(db, 'userId')).toBe('u-2');
  });

  it('pendant la session perdue, /login reste stable : premier plan, réseau, avertissement, échec', async () => {
    const { api, db, location, visits } = await launchWithLostSession('unauthenticated', 2);
    const healthCalls = () => api.calls.filter((c) => c.path === '/api/health').length;
    const health = healthCalls();
    const mark = visits().length;

    // Avertissement P-AUT-6 ouvert, puis retour au premier plan et réseau retrouvé.
    signIn('max');
    const dialog = await screen.findByRole('dialog');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(screen.getByRole('dialog')).toBe(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    // Identifiants refusés : le moteur relancé après la requête ne repart pas.
    api.on('POST', LOGIN, reply({ error: 'invalid_credentials' }, 401));
    signIn('lea', 'mauvais mot de passe');
    expect((await screen.findByRole('alert')).textContent).toBe('Pseudo ou mot de passe incorrect');
    await settle();
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();

    expect(screen.getByRole('alert').textContent).toBe('Pseudo ou mot de passe incorrect');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('lea');
    expect(screen.getByText(EXPIRED)).toBeTruthy();
    expect(location()).toBe('/login');
    expect(visits().slice(mark)).toEqual([]);
    expect(healthCalls()).toBe(health);
    expect(await db.outbox.count()).toBe(2);
  });
});
