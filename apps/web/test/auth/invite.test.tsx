import { fireEvent, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvitePage } from '../../src/features/auth/InvitePage';
import { PASSWORD_MESSAGES, USERNAME_MESSAGES } from '../../src/features/auth/messages';
import {
  ANDROID_UA,
  click,
  fill,
  IPHONE_UA,
  openUrl,
  stubDisplayMode,
  stubUserAgent,
  WINDOWS_UA,
} from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { makeMe, renderApp, renderWithServices } from '../support/render';

const CODE = 'ABCDEFGHJKMNPQR0';
const OTHER_CODE = 'ABCDEFGHJKMNPQRS';
const LINK = '/invite#abcd-efgh-jkmn-pqrO';
const PHRASE = 'cheval agrafe batterie correcte';
const ASK = "Demande un nouveau code à l'administrateur.";
const CHECK = '/api/invitations/check';
const ACCEPT = '/api/invitations/accept';

const reply = (body: unknown, status = 200) => ({ status, body });
const memberCheck = reply({ birthDate: '2008-03-01', role: 'member' });
const callsTo = (api: FakeApi, path: string) => api.calls.filter((c) => c.path === path);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  openUrl('/');
});

async function renderInvite(
  o: { url?: string; standalone?: boolean; api?: FakeApi; userAgent?: string } = {},
) {
  stubDisplayMode(o.standalone ?? true);
  if (o.userAgent) stubUserAgent(o.userAgent);
  openUrl(o.url ?? '/invite');
  const api = o.api ?? createFakeApi().on('POST', CHECK, memberCheck);
  const view = await renderWithServices(<InvitePage />, { me: null, api });
  return { ...view, api };
}

/** Formulaire de création affiché, case de lecture cochée. */
async function renderForm(role: 'member' | 'admin' = 'member') {
  const api = createFakeApi().on('POST', CHECK, reply({ birthDate: '2008-03-01', role }));
  const view = await renderInvite({ url: LINK, api });
  await screen.findByLabelText('Date de naissance');
  fireEvent.click(screen.getByLabelText("J'ai lu la page Confidentialité et règles"));
  return view;
}

const submitWith = (username: string, password: string, confirm = password) => {
  fill('Pseudo', username);
  fill('Mot de passe', password);
  fill('Confirmation', confirm);
  click('Créer mon compte');
};

describe('accueil (03 §13.1, R-ARR-1)', () => {
  it('porteur, rappel « pas un service médical », lien vers Confidentialité', async () => {
    await renderInvite();
    const text = document.body.textContent ?? '';
    expect(text).toContain(
      "appsport est un outil de suivi entre proches, hébergé chez l'administrateur. Ce n'est pas un service médical.",
    );
    expect(screen.getByRole('link', { name: 'Confidentialité et règles' }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it("route /invite de l'appli, sans session", async () => {
    stubDisplayMode(true);
    openUrl('/invite');
    await renderApp({ path: '/invite', me: null });
    await screen.findByLabelText("Lien ou code d'invitation");
    expect(screen.queryByText('Page introuvable')).toBeNull();
  });
});

describe("lien d'invitation dans l'appli installée (R-ARR-1, R-INV-4)", () => {
  it('vérifie le code du fragment, efface le fragment, affiche la date de naissance en lecture seule', async () => {
    const { api } = await renderInvite({ url: LINK });
    await screen.findByLabelText('Date de naissance');
    expect(callsTo(api, CHECK)).toHaveLength(1);
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: CODE });
    expect(callsTo(api, CHECK)[0]?.query.toString()).toBe('');
    expect(callsTo(api, CHECK)[0]?.method).toBe('POST');
    expect(window.location.hash).toBe('');
    const birth = screen.getByLabelText('Date de naissance') as HTMLInputElement;
    expect(birth.readOnly).toBe(true);
    expect(birth.value).toBe('01/03/2008');
    expect(screen.getByText("Renseignée par l'administrateur. Une erreur ? Préviens-le.")).toBeTruthy();
    expect(document.body.textContent).toContain('4 mots');
    // Le code n'est plus saisissable ni lisible une fois vérifié.
    expect(screen.queryByLabelText("Lien ou code d'invitation")).toBeNull();
  });

  it("« Créer mon compte » désactivé tant que la page Confidentialité n'est pas lue", async () => {
    await renderInvite({ url: LINK });
    await screen.findByLabelText('Date de naissance');
    const submit = screen.getByRole('button', { name: 'Créer mon compte' }) as HTMLButtonElement;
    const box = screen.getByLabelText("J'ai lu la page Confidentialité et règles") as HTMLInputElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(box);
    expect(submit.disabled).toBe(false);
    fireEvent.click(box);
    expect(submit.disabled).toBe(true);
  });

  it("création : accept avec la version du texte, puis l'onboarding", async () => {
    const { api, location, db } = await renderForm();
    api.on('POST', ACCEPT, reply(makeMe({ id: 'u-9', username: 'lea', onboardingCompletedAt: null })));
    submitWith('lea', PHRASE);
    await waitFor(() => expect(location()).toBe('/onboarding'));
    expect(callsTo(api, ACCEPT)).toHaveLength(1);
    expect(callsTo(api, ACCEPT)[0]?.body).toEqual({
      code: CODE,
      username: 'lea',
      password: PHRASE,
      termsVersion: '1.0',
    });
    expect((await db.meta.get('userId'))?.value).toBe('u-9');
  });

  it("invitation d'amorçage (admin) : 13 caractères refusés sans requête, 14 acceptés", async () => {
    const { api, location } = await renderForm('admin');
    api.on('POST', ACCEPT, reply(makeMe({ id: 'u-9', role: 'admin', onboardingCompletedAt: null })));
    submitWith('boss', 'abcdefghijklm');
    expect((await screen.findByRole('alert')).textContent).toBe('14 caractères au moins.');
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
    submitWith('boss', 'abcdefghijklmn');
    await waitFor(() => expect(location()).toBe('/onboarding'));
    expect(callsTo(api, ACCEPT)[0]?.body).toMatchObject({ password: 'abcdefghijklmn' });
  });

  it("sous StrictMode (appli réelle) : une seule vérification, le formulaire s'affiche, fragment effacé", async () => {
    stubDisplayMode(true);
    openUrl(LINK);
    const api = createFakeApi().on('POST', CHECK, memberCheck);
    await renderWithServices(
      <StrictMode>
        <InvitePage />
      </StrictMode>,
      { me: null, api },
    );
    await screen.findByLabelText('Date de naissance');
    expect(callsTo(api, CHECK)).toHaveLength(1);
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: CODE });
    expect(window.location.hash).toBe('');
  });

  it("429 au contrôle du code : « Trop d'essais depuis cet appareil. »", async () => {
    const api = createFakeApi().on('POST', CHECK, reply({ error: 'rate_limited', retryAfterS: 600 }, 429));
    await renderInvite({ url: LINK, api });
    expect((await screen.findByRole('alert')).textContent).toBe("Trop d'essais depuis cet appareil.");
    expect(screen.queryByLabelText('Date de naissance')).toBeNull();
  });
});

describe("navigateur : aide à l'installation (R-ARR-2, 02 §15 n°5)", () => {
  const browser = (userAgent: string) =>
    renderInvite({ url: '/invite#abcd-efgh-jkmn-pqrs', standalone: false, userAgent });
  const bodyText = () => document.body.textContent ?? '';

  it('iPhone : consigne iOS, code en clair avec « Copier », ni formulaire ni requête', async () => {
    const { api } = await browser(IPHONE_UA);
    expect(bodyText()).toContain("Sur l'écran d'accueil");
    expect(bodyText()).not.toContain("Installer l'application");
    expect(screen.getByText('ABCD-EFGH-JKMN-PQRS')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copier' })).toBeTruthy();
    expect(screen.queryByLabelText('Pseudo')).toBeNull();
    expect(screen.queryByLabelText("Lien ou code d'invitation")).toBeNull();
    expect(api.calls).toHaveLength(0);
    expect(window.location.hash).toBe('');
  });

  it('Android : consigne Android', async () => {
    await browser(ANDROID_UA);
    expect(bodyText()).toContain("Installer l'application");
    expect(bodyText()).not.toContain("Sur l'écran d'accueil");
  });

  it('autre système : les deux consignes', async () => {
    await browser(WINDOWS_UA);
    expect(bodyText()).toContain("Sur l'écran d'accueil");
    expect(bodyText()).toContain("Installer l'application");
  });

  it('sans fragment : consigne et « Continuer dans ce navigateur », sans code ni champ', async () => {
    const { api } = await renderInvite({ standalone: false, userAgent: IPHONE_UA });
    expect(bodyText()).toContain("Sur l'écran d'accueil");
    expect(screen.queryByRole('button', { name: 'Copier' })).toBeNull();
    expect(screen.queryByLabelText("Lien ou code d'invitation")).toBeNull();
    expect(api.calls).toHaveLength(0);
  });

  it('« Continuer dans ce navigateur » : avertissement, puis la vérification du code et le formulaire', async () => {
    const { api } = await browser(IPHONE_UA);
    const warning = "Attention : sur téléphone, tes données ne seront pas dans l'appli installée.";
    expect(screen.getByText(warning).closest('[role="status"]')).not.toBeNull();
    click('Continuer dans ce navigateur');
    await screen.findByLabelText('Date de naissance');
    expect(screen.getByText(warning)).toBeTruthy();
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: OTHER_CODE });
    expect(screen.queryByRole('button', { name: 'Continuer dans ce navigateur' })).toBeNull();
  });

  it('sans fragment, « Continuer dans ce navigateur » ouvre la saisie du code', async () => {
    await renderInvite({ standalone: false, userAgent: WINDOWS_UA });
    click('Continuer dans ce navigateur');
    expect(await screen.findByLabelText("Lien ou code d'invitation")).toBeTruthy();
  });

  it("l'appli installée n'affiche ni aide ni avertissement", async () => {
    await renderInvite({ userAgent: IPHONE_UA });
    expect(bodyText()).not.toContain("Sur l'écran d'accueil");
    expect(bodyText()).not.toContain("tes données ne seront pas dans l'appli installée");
  });
});

describe('saisie du code (R-INV-5, 02 §15 n°3)', () => {
  const field = () => screen.getByLabelText("Lien ou code d'invitation");

  it('code trop court : « Code incomplet », aucune requête', async () => {
    const { api } = await renderInvite();
    fill("Lien ou code d'invitation", 'ABC');
    click('Suivant');
    expect(await screen.findByText('Code incomplet : il faut 16 caractères.')).toBeTruthy();
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(api.calls).toHaveLength(0);
  });

  it('code en minuscules, espaces et confusions de lecture', async () => {
    const { api } = await renderInvite();
    fill("Lien ou code d'invitation", 'abcd efgh jkmn pqrs');
    click('Suivant');
    await screen.findByLabelText('Date de naissance');
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: OTHER_CODE });
  });

  it('lien complet collé', async () => {
    const { api } = await renderInvite();
    fill("Lien ou code d'invitation", 'https://appsport.exemple.ts.net/invite#abcd-efgh-jkmn-pqrs');
    click('Suivant');
    await screen.findByLabelText('Date de naissance');
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: OTHER_CODE });
  });

  it('fragment illisible : « Code incomplet » et saisie, aucune requête', async () => {
    const { api } = await renderInvite({ url: '/invite#abc' });
    expect(await screen.findByText('Code incomplet : il faut 16 caractères.')).toBeTruthy();
    expect(field()).toBeTruthy();
    expect(api.calls).toHaveLength(0);
    expect(window.location.hash).toBe('');
  });

  it.each([
    ['invitation_expired', 'Cette invitation a expiré.'],
    ['invitation_used', 'Cette invitation a déjà été utilisée.'],
    ['invitation_revoked', 'Cette invitation a été révoquée.'],
    ['invitation_unknown', 'Ce code est inconnu.'],
  ])(
    "%s : « %s » suivi de la demande à l'administrateur, nouvelle saisie possible",
    async (error, message) => {
      const api = createFakeApi().on('POST', CHECK, reply({ error }, 400));
      await renderInvite({ url: LINK, api });
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe(`${message} ${ASK}`);
      expect(field()).toBeTruthy();
    },
  );

  it('après une erreur, un autre code peut être essayé', async () => {
    const api = createFakeApi().on('POST', CHECK, reply({ error: 'invitation_unknown' }, 400));
    await renderInvite({ url: LINK, api });
    await screen.findByRole('alert');
    api.on('POST', CHECK, memberCheck);
    fill("Lien ou code d'invitation", 'abcd-efgh-jkmn-pqrs');
    click('Suivant');
    await screen.findByLabelText('Date de naissance');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('création du compte : contrôles locaux et erreurs du serveur (R-CPT-1, R-MDP-1 à R-MDP-3)', () => {
  const alertText = async () => (await screen.findByRole('alert')).textContent;

  it('11 caractères : « 12 caractères au moins. », aucune requête', async () => {
    const { api } = await renderForm();
    submitWith('lea', 'a1b2c3d4e5f');
    expect(await alertText()).toBe('12 caractères au moins.');
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it('confirmation différente', async () => {
    const { api } = await renderForm();
    submitWith('lea', PHRASE, 'cheval agrafe batterie');
    expect(await alertText()).toBe('Les deux mots de passe ne correspondent pas.');
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it('mot de passe contenant le pseudo', async () => {
    const { api } = await renderForm();
    submitWith('lea', 'bonjour lea 123456');
    expect(await alertText()).toBe(PASSWORD_MESSAGES.contains_username);
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it.each([
    ['ab', USERNAME_MESSAGES.length],
    ['a'.repeat(25), USERNAME_MESSAGES.length],
    ['Admin', USERNAME_MESSAGES.reserved],
    ['le a', USERNAME_MESSAGES.characters],
    ['léa$', USERNAME_MESSAGES.characters],
  ])('pseudo %j refusé sans requête', async (username, message) => {
    const { api } = await renderForm();
    submitWith(username, PHRASE);
    expect(await alertText()).toBe(message);
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it('409 username_taken : message, formulaire gardé', async () => {
    const { api } = await renderForm();
    api.on('POST', ACCEPT, reply({ error: 'username_taken' }, 409));
    submitWith('lea', PHRASE);
    expect(await alertText()).toBe('Ce pseudo est déjà pris.');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('lea');
    expect((screen.getByLabelText('Mot de passe') as HTMLInputElement).value).toBe(PHRASE);
    expect((screen.getByRole('button', { name: 'Créer mon compte' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('password_rejected et username_invalid du serveur lisent le motif', async () => {
    const { api } = await renderForm();
    api.on('POST', ACCEPT, reply({ error: 'password_rejected', reason: 'common' }, 400));
    submitWith('lea', PHRASE);
    expect(await alertText()).toBe(PASSWORD_MESSAGES.common);
    api.on('POST', ACCEPT, reply({ error: 'username_invalid', reason: 'reserved' }, 400));
    click('Créer mon compte');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(USERNAME_MESSAGES.reserved));
  });

  it("invitation utilisée entre-temps : message d'invitation", async () => {
    const { api } = await renderForm();
    api.on('POST', ACCEPT, reply({ error: 'invitation_used' }, 400));
    submitWith('lea', PHRASE);
    expect(await alertText()).toBe(`Cette invitation a déjà été utilisée. ${ASK}`);
  });

  it('hors ligne : « Nécessite le réseau », formulaire gardé', async () => {
    const { api } = await renderForm();
    api.setOffline('reject');
    submitWith('lea', PHRASE);
    expect(await alertText()).toBe('Nécessite le réseau');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('lea');
  });

  it("champs nommés pour les lecteurs d'écran et les gestionnaires de mots de passe", async () => {
    await renderForm();
    const password = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('new-password');
    expect((screen.getByLabelText('Confirmation') as HTMLInputElement).type).toBe('password');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).autocomplete).toBe('username');
    expect(screen.getByText(/Astuce : une phrase de 4 mots ou plus/)).toBeTruthy();
  });
});
