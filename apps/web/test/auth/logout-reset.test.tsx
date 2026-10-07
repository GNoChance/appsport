import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogoutDialog } from '../../src/features/auth/LogoutDialog';
import { PASSWORD_MESSAGES, pendingWarning } from '../../src/features/auth/messages';
import { ResetPage } from '../../src/features/auth/ResetPage';
import { getMeta } from '../../src/local-db/meta';
import { click, fill, openUrl } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { seedOutbox } from '../support/seed';

const reply = (body?: unknown, status = 200) => ({ status, body });
const callsTo = (api: FakeApi, path: string) => api.calls.filter((c) => c.path === path);
const lea = makeMe({ id: 'u-1', username: 'lea' });

afterEach(() => openUrl('/'));

describe('LogoutDialog (R-AUTH-9, R-SYN-14)', () => {
  async function renderDialog(mode: 'current' | 'all', pending: number, open = true) {
    const db = createTestLocalDb();
    if (pending > 0) await seedOutbox(db, 'u-1', pending);
    const api = createFakeApi()
      .on('POST', '/api/auth/logout', reply(undefined, 204))
      .on('POST', '/api/auth/logout-all', reply(undefined, 204));
    const onClose = vi.fn();
    const view = await renderWithServices(<LogoutDialog mode={mode} open={open} onClose={onClose} />, {
      me: lea,
      api,
      db,
      path: '/profile',
    });
    return { ...view, api, db, onClose };
  }

  it('avec 3 éléments en attente : avertissement, export, Annuler, « Se déconnecter quand même »', async () => {
    const { api, db, onClose } = await renderDialog('current', 3);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(pendingWarning(3, 'lea'));
    const exportLink = within(dialog).getByRole('link', { name: 'Exporter mes données' });
    expect(exportLink.getAttribute('href')).toBe('/profile/privacy');
    expect(within(dialog).queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.calls).toHaveLength(0);
    expect(await db.outbox.count()).toBe(3);
  });

  it('confirmation : POST /api/auth/logout {}, file vidée, profil local effacé, écran de connexion', async () => {
    const { api, db, location } = await renderDialog('current', 3);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se déconnecter quand même' }));
    await waitFor(() => expect(location()).toBe('/login'));
    expect(callsTo(api, '/api/auth/logout')).toHaveLength(1);
    expect(callsTo(api, '/api/auth/logout')[0]?.body).toEqual({});
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'me')).toBeUndefined();
    expect(await getMeta(db, 'userId')).toBeUndefined();
  });

  it('sans élément en attente : « Se déconnecter de cet appareil ? » et « Se déconnecter »', async () => {
    const { api, location } = await renderDialog('current', 0);
    const dialog = await screen.findByRole('dialog', { name: 'Se déconnecter de cet appareil ?' });
    expect(within(dialog).queryByRole('link', { name: 'Exporter mes données' })).toBeNull();
    expect(dialog.textContent).not.toContain('non envoy');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(location()).toBe('/login'));
    expect(callsTo(api, '/api/auth/logout')).toHaveLength(1);
  });

  it('mode « all » : POST /api/auth/logout-all', async () => {
    const { api, location } = await renderDialog('all', 0);
    const dialog = await screen.findByRole('dialog', { name: 'Déconnecter tous les appareils ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Déconnecter tous les appareils' }));
    await waitFor(() => expect(location()).toBe('/login'));
    expect(callsTo(api, '/api/auth/logout-all')).toHaveLength(1);
    expect(callsTo(api, '/api/auth/logout')).toHaveLength(0);
  });

  it('mode « all » avec des éléments en attente : même avertissement', async () => {
    const { api } = await renderDialog('all', 1);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(pendingWarning(1, 'lea'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se déconnecter quand même' }));
    await waitFor(() => expect(callsTo(api, '/api/auth/logout-all')).toHaveLength(1));
  });

  it('hors ligne : « Nécessite le réseau », file et profil intacts, dialogue ouvert', async () => {
    const { api, db, location } = await renderDialog('current', 3);
    api.setOffline('reject');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se déconnecter quand même' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(await db.outbox.count()).toBe(3);
    expect((await getMeta(db, 'me'))?.username).toBe('lea');
    expect(location()).toBe('/profile');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it("fermé : rien à l'écran", async () => {
    await renderDialog('current', 2, false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ResetPage (R-RST-1, R-RST-3)', () => {
  const CHECK = '/api/auth/reset/check';
  const RESET = '/api/auth/reset';
  const CODE = 'ABCDEFGHJKMNPQRS';
  const PHRASE = 'cheval agrafe batterie correcte';
  const memberCheck = reply({ username: 'lea', role: 'member' });

  async function renderReset(o: { url?: string; api?: FakeApi } = {}) {
    openUrl(o.url ?? '/reset#abcd-efgh-jkmn-pqrs');
    const api = o.api ?? createFakeApi().on('POST', CHECK, memberCheck).on('POST', RESET, reply(lea));
    const view = await renderWithServices(<ResetPage />, { me: null, api, path: '/reset' });
    return { ...view, api };
  }
  const alertText = async () => (await screen.findByRole('alert')).textContent;

  it('lien : vérification du fragment, fragment effacé, nouveau mot de passe pour le pseudo', async () => {
    const { api, location } = await renderReset();
    const password = (await screen.findByLabelText('Nouveau mot de passe pour lea')) as HTMLInputElement;
    expect(callsTo(api, CHECK)).toHaveLength(1);
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: CODE });
    expect(window.location.hash).toBe('');
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('new-password');
    expect(document.body.textContent).toContain('4 mots');
    fill('Nouveau mot de passe pour lea', PHRASE);
    fill('Confirmation', PHRASE);
    click('Changer le mot de passe');
    await waitFor(() => expect(location()).toBe('/'));
    expect(callsTo(api, RESET)).toHaveLength(1);
    expect(callsTo(api, RESET)[0]?.body).toEqual({ code: CODE, newPassword: PHRASE });
  });

  it('admin : 13 caractères refusés sans requête, 14 acceptés', async () => {
    const api = createFakeApi()
      .on('POST', CHECK, reply({ username: 'boss', role: 'admin' }))
      .on('POST', RESET, reply(makeMe({ id: 'u-3', username: 'boss', role: 'admin' })));
    const { location } = await renderReset({ api });
    await screen.findByLabelText('Nouveau mot de passe pour boss');
    fill('Nouveau mot de passe pour boss', 'abcdefghijklm');
    fill('Confirmation', 'abcdefghijklm');
    click('Changer le mot de passe');
    expect(await alertText()).toBe('14 caractères au moins.');
    expect(callsTo(api, RESET)).toHaveLength(0);
    fill('Nouveau mot de passe pour boss', 'abcdefghijklmn');
    fill('Confirmation', 'abcdefghijklmn');
    click('Changer le mot de passe');
    await waitFor(() => expect(location()).toBe('/'));
    expect(callsTo(api, RESET)[0]?.body).toEqual({ code: CODE, newPassword: 'abcdefghijklmn' });
  });

  it('contrôles locaux : 11 caractères, confirmation, pseudo contenu', async () => {
    const { api } = await renderReset();
    await screen.findByLabelText('Nouveau mot de passe pour lea');
    fill('Nouveau mot de passe pour lea', 'a1b2c3d4e5f');
    fill('Confirmation', 'a1b2c3d4e5f');
    click('Changer le mot de passe');
    expect(await alertText()).toBe('12 caractères au moins.');
    fill('Nouveau mot de passe pour lea', PHRASE);
    fill('Confirmation', 'autre chose entièrement');
    click('Changer le mot de passe');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Les deux mots de passe ne correspondent pas.'),
    );
    fill('Nouveau mot de passe pour lea', 'bonjour lea 123456');
    fill('Confirmation', 'bonjour lea 123456');
    click('Changer le mot de passe');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(PASSWORD_MESSAGES.contains_username),
    );
    expect(callsTo(api, RESET)).toHaveLength(0);
  });

  const INVALID = "Ce lien n'est plus valable. Demande un nouveau lien à l'administrateur.";

  it("reset_invalid à la vérification : message, saisie d'un autre code possible", async () => {
    const api = createFakeApi().on('POST', CHECK, reply({ error: 'reset_invalid' }, 400));
    await renderReset({ api });
    expect(await alertText()).toBe(INVALID);
    expect(screen.getByLabelText('Lien ou code de réinitialisation')).toBeTruthy();
  });

  it('reset_invalid à la validation : message, formulaire gardé', async () => {
    const { api } = await renderReset();
    await screen.findByLabelText('Nouveau mot de passe pour lea');
    api.on('POST', RESET, reply({ error: 'reset_invalid' }, 400));
    fill('Nouveau mot de passe pour lea', PHRASE);
    fill('Confirmation', PHRASE);
    click('Changer le mot de passe');
    expect(await alertText()).toBe(INVALID);
    expect((screen.getByLabelText('Nouveau mot de passe pour lea') as HTMLInputElement).value).toBe(PHRASE);
  });

  it('password_rejected du serveur : motif lu dans le corps', async () => {
    const { api } = await renderReset();
    await screen.findByLabelText('Nouveau mot de passe pour lea');
    api.on('POST', RESET, reply({ error: 'password_rejected', reason: 'common' }, 400));
    fill('Nouveau mot de passe pour lea', PHRASE);
    fill('Confirmation', PHRASE);
    click('Changer le mot de passe');
    expect(await alertText()).toBe(PASSWORD_MESSAGES.common);
  });

  it("429 à la vérification : « Trop d'essais depuis cet appareil. »", async () => {
    const api = createFakeApi().on('POST', CHECK, reply({ error: 'rate_limited', retryAfterS: 30 }, 429));
    await renderReset({ api });
    expect(await alertText()).toBe("Trop d'essais depuis cet appareil.");
  });

  it('sans fragment : champ « Lien ou code de réinitialisation », code incomplet sans requête, puis code valide', async () => {
    const { api } = await renderReset({ url: '/reset' });
    fill('Lien ou code de réinitialisation', 'ABC');
    click('Suivant');
    expect(await screen.findByText('Code incomplet : il faut 16 caractères.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
    fill('Lien ou code de réinitialisation', 'https://appsport.exemple.ts.net/reset#abcd-efgh-jkmn-pqrs');
    click('Suivant');
    await screen.findByLabelText('Nouveau mot de passe pour lea');
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: CODE });
  });

  it("route /reset de l'appli, sans session", async () => {
    await renderApp({ path: '/reset', me: null });
    expect(await screen.findByLabelText('Lien ou code de réinitialisation')).toBeTruthy();
    expect(screen.queryByText('Page introuvable')).toBeNull();
  });
});
