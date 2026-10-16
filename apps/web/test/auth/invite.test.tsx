import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvitePage } from '../../src/features/auth/InvitePage';
import { PASSWORD_MESSAGES, USERNAME_MESSAGES } from '../../src/features/auth/messages';
import { OWNER_FIRST_NAME } from '../../src/features/public/privacy-content';
import {
  ANDROID_UA,
  click,
  fill,
  fragmentCleared,
  IPHONE_UA,
  openUrl,
  settle,
  stubDisplayMode,
  stubUserAgent,
  WINDOWS_UA,
} from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { seedOutbox } from '../support/seed';
import { until } from '../support/wait';

const CODE = 'ABCDEFGHJKMNPQR0';
const OTHER_CODE = 'ABCDEFGHJKMNPQRS';
const LINK = '/invite#abcd-efgh-jkmn-pqrO';
const PHRASE = 'cheval agrafe batterie correcte';
const ASK = "Demande un nouveau code à l'administrateur.";
const CHECK = '/api/invitations/check';
const ACCEPT = '/api/invitations/accept';
const WELCOME = `Rune est un outil de suivi entre proches, hébergé chez ${OWNER_FIRST_NAME}. Ce n'est pas un service médical.`;
const INCOMPLETE = 'Code incomplet : il faut 16 caractères.';

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
  const historyLength = openUrl(o.url ?? '/invite');
  const api = o.api ?? createFakeApi().on('POST', CHECK, memberCheck);
  const view = await renderWithServices(<InvitePage />, { me: null, api });
  return { ...view, api, historyLength };
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

/** Textes qui décrivent un champ (aide, erreur), via aria-describedby. */
const description = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

/**
 * Refus (local ou du serveur) lié au champ `label` (aria-invalid, description), focus sur le champ, pas
 * d'alerte. Le focus suit le rendu de l'erreur (effet) : après une réponse du serveur, il est attendu.
 */
async function expectFieldError(label: string, message: string) {
  const field = screen.getByLabelText(label);
  await until(() => field.getAttribute('aria-invalid') === 'true');
  expect(description(field)).toContain(message);
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect(screen.queryByRole('alert')).toBeNull();
}

describe('accueil (03 §13.1, R-ARR-1)', () => {
  it('titre « Bienvenue sur Rune », porteur, rappel « pas un service médical », lien vers Confidentialité', async () => {
    await renderInvite();
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenue sur Rune' })).toBeTruthy();
    expect(document.body.textContent).toContain(WELCOME);
    // Maquette A02 : le rappel et le lien dans une carte « À propos de Rune » ; le lien annonce le nouvel onglet.
    const about = screen.getByRole('region', { name: 'À propos de Rune' });
    expect(about.textContent).toContain(WELCOME);
    const privacy = within(about).getByRole('link', { name: 'Confidentialité et règles (nouvel onglet)' });
    expect(privacy.getAttribute('href')).toBe('/privacy');
    expect(privacy.getAttribute('target')).toBe('_blank');
  });

  it('maquette A02 : Retour vers la connexion, aide du champ du code, « Pas de code ? »', async () => {
    await renderInvite();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/login');
    expect(description(screen.getByLabelText("Lien ou code d'invitation"))).toBe(
      'Colle le lien reçu, ou tape les 16 caractères du code. Les tirets sont facultatifs.',
    );
    expect(
      screen.getByText("Pas de code ? Demande à l'administrateur le lien complet ou le code."),
    ).toBeTruthy();
  });

  it('maquette A03 : « Crée ton compte » a aussi son Retour vers la connexion', async () => {
    await renderInvite({ url: LINK });
    await screen.findByRole('heading', { level: 1, name: 'Crée ton compte' });
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/login');
  });

  it("« Crée ton compte » ouvert d'emblée par un lien : le rappel reste affiché, avec un lien vers Confidentialité", async () => {
    await renderInvite({ url: LINK });
    await screen.findByLabelText('Date de naissance');
    expect(document.body.textContent).toContain(WELCOME);
    // Le lien de la case « J'ai lu la page… » annonce son nouvel onglet, comme celui de l'accueil (A02).
    const link = screen.getByRole('link', { name: 'Confidentialité et règles (nouvel onglet)' });
    expect(link.getAttribute('href')).toBe('/privacy');
    expect(link.getAttribute('target')).toBe('_blank');
    // La case garde son nom : c'est le lien, pas elle, qui ouvre un onglet.
    expect(screen.getByRole('checkbox', { name: "J'ai lu la page Confidentialité et règles" })).toBeTruthy();
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
    const { api, historyLength } = await renderInvite({ url: LINK });
    await screen.findByLabelText('Date de naissance');
    expect(callsTo(api, CHECK)).toHaveLength(1);
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: CODE });
    expect(callsTo(api, CHECK)[0]?.query.toString()).toBe('');
    expect(callsTo(api, CHECK)[0]?.method).toBe('POST');
    expect(fragmentCleared(historyLength)).toBe(true);
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
    expect(callsTo(api, ACCEPT)[0]?.method).toBe('POST');
    expect(callsTo(api, ACCEPT)[0]?.query.toString()).toBe('');
    expect(callsTo(api, ACCEPT)[0]?.body).toEqual({
      code: CODE,
      username: 'lea',
      password: PHRASE,
      termsVersion: '1.0',
    });
    expect((await db.meta.get('userId'))?.value).toBe('u-9');
  });

  it("création dans l'appli : l'onboarding sans passer par /login (garde de l'appli)", async () => {
    stubDisplayMode(true);
    openUrl(LINK);
    const api = createFakeApi()
      .on('POST', CHECK, memberCheck)
      .on('POST', ACCEPT, reply(makeMe({ id: 'u-9', username: 'lea', onboardingCompletedAt: null })));
    const { location, visits } = await renderApp({ path: '/invite', me: null, api });
    await screen.findByLabelText('Date de naissance');
    fireEvent.click(screen.getByLabelText("J'ai lu la page Confidentialité et règles"));
    const mark = visits().length;
    submitWith('lea', PHRASE);
    await until(() => location() === '/onboarding');
    await settle();
    expect(visits().slice(mark)).toEqual(['/onboarding']);
  });

  it("invitation d'amorçage (admin) : 13 caractères refusés sans requête, 14 acceptés", async () => {
    const { api, location } = await renderForm('admin');
    api.on('POST', ACCEPT, reply(makeMe({ id: 'u-9', role: 'admin', onboardingCompletedAt: null })));
    submitWith('boss', 'abcdefghijklm');
    await expectFieldError('Mot de passe', '14 caractères au moins.');
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
    submitWith('boss', 'abcdefghijklmn');
    await waitFor(() => expect(location()).toBe('/onboarding'));
    expect(callsTo(api, ACCEPT)[0]?.body).toMatchObject({ password: 'abcdefghijklmn' });
  });

  it("sous StrictMode (appli réelle) : une seule vérification, le formulaire s'affiche, fragment effacé", async () => {
    stubDisplayMode(true);
    const historyLength = openUrl(LINK);
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
    expect(fragmentCleared(historyLength)).toBe(true);
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
    const { api, historyLength } = await browser(IPHONE_UA);
    expect(bodyText()).toContain("Sur l'écran d'accueil");
    expect(bodyText()).not.toContain("Installer l'application");
    expect(screen.getByText('ABCD-EFGH-JKMN-PQRS')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copier' })).toBeTruthy();
    expect(screen.queryByLabelText('Pseudo')).toBeNull();
    expect(screen.queryByLabelText("Lien ou code d'invitation")).toBeNull();
    expect(api.calls).toHaveLength(0);
    expect(fragmentCleared(historyLength)).toBe(true);
  });

  it('lien tronqué (#abc) : « Code incomplet » annoncé, rien à copier, aucune requête', async () => {
    const { api, historyLength } = await renderInvite({
      url: '/invite#abc',
      standalone: false,
      userAgent: IPHONE_UA,
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(INCOMPLETE);
    expect(alert.textContent).toContain("Demande à l'administrateur le lien complet ou le code.");
    expect(screen.queryByRole('button', { name: 'Copier' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuer dans ce navigateur' })).toBeTruthy();
    expect(api.calls).toHaveLength(0);
    expect(fragmentCleared(historyLength)).toBe(true);
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
    fill("Lien ou code d'invitation", 'https://rune.exemple.ts.net/invite#abcd-efgh-jkmn-pqrs');
    click('Suivant');
    await screen.findByLabelText('Date de naissance');
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: OTHER_CODE });
  });

  it('fragment illisible : « Code incomplet » et saisie, aucune requête', async () => {
    const { api, historyLength } = await renderInvite({ url: '/invite#abc' });
    expect(await screen.findByText(INCOMPLETE)).toBeTruthy();
    expect(field()).toBeTruthy();
    expect(api.calls).toHaveLength(0);
    expect(fragmentCleared(historyLength)).toBe(true);
  });

  it('lien reçu page déjà ouverte (hashchange) : une vérification, fragment effacé', async () => {
    const { api } = await renderInvite();
    await screen.findByLabelText("Lien ou code d'invitation");
    window.location.hash = '#abcd-efgh-jkmn-pqrs';
    await screen.findByLabelText('Date de naissance');
    await settle();
    expect(callsTo(api, CHECK)).toHaveLength(1);
    expect(callsTo(api, CHECK)[0]?.body).toEqual({ code: OTHER_CODE });
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('#');
  });

  it('lien tronqué reçu page déjà ouverte : « Code incomplet », aucune requête, fragment effacé', async () => {
    const { api } = await renderInvite();
    await screen.findByLabelText("Lien ou code d'invitation");
    window.location.hash = '#abc';
    expect(await screen.findByText(INCOMPLETE)).toBeTruthy();
    await settle();
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

describe('création du compte sur un appareil qui garde des données non envoyées (P-AUT-6, R-AUTH-8)', () => {
  /** Appareil de lea (session perdue ou non), `n` éléments à elle en attente ; formulaire prêt. */
  async function renderFormWithPending(n: number) {
    stubDisplayMode(true);
    openUrl(LINK);
    const api = createFakeApi()
      .on('POST', CHECK, memberCheck)
      .on('POST', ACCEPT, reply(makeMe({ id: 'u-9', username: 'max', onboardingCompletedAt: null })));
    const view = await renderWithServices(<InvitePage />, {
      me: makeMe({ id: 'u-1', username: 'lea' }),
      api,
    });
    if (n > 0) await seedOutbox(view.db, 'u-1', n);
    await screen.findByLabelText('Date de naissance');
    fireEvent.click(screen.getByLabelText("J'ai lu la page Confidentialité et règles"));
    return { ...view, api };
  }

  it('avertit avant toute requête ; Annuler : rien envoyé, file et formulaire gardés', async () => {
    const { api, db, location } = await renderFormWithPending(2);
    submitWith('max', PHRASE);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('2 éléments non envoyés de lea seront effacés de cet appareil');
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Créer mon compte' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
    expect(await db.outbox.count()).toBe(2);
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('max');
    expect(location()).toBe('/');
  });

  it('Continuer : compte créé, file de lea effacée, onboarding', async () => {
    const { api, db, location } = await renderFormWithPending(1);
    submitWith('max', PHRASE);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('1 élément non envoyé de lea sera effacé de cet appareil');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(location()).toBe('/onboarding'));
    expect(callsTo(api, ACCEPT)).toHaveLength(1);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.meta.get('userId'))?.value).toBe('u-9');
  });

  it("rien en attente : pas d'avertissement", async () => {
    const { api, location } = await renderFormWithPending(0);
    submitWith('max', PHRASE);
    await waitFor(() => expect(location()).toBe('/onboarding'));
    expect(callsTo(api, ACCEPT)).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('création du compte : contrôles locaux et erreurs du serveur (R-CPT-1, R-MDP-1 à R-MDP-3)', () => {
  const alertText = async () => (await screen.findByRole('alert')).textContent;

  it('11 caractères : « 12 caractères au moins. » sous le mot de passe (maquette A03), aucune requête', async () => {
    const { api } = await renderForm();
    submitWith('lea', 'a1b2c3d4e5f');
    await expectFieldError('Mot de passe', '12 caractères au moins.');
    // L'erreur d'abord, puis l'astuce, comme dans la maquette ; la confirmation n'est pas en cause.
    expect(description(screen.getByLabelText('Mot de passe'))).toMatch(/^12 caractères au moins\. Astuce/);
    expect(screen.getByLabelText('Confirmation').getAttribute('aria-invalid')).toBeNull();
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it('confirmation différente : erreur sous la confirmation', async () => {
    const { api } = await renderForm();
    submitWith('lea', PHRASE, 'cheval agrafe batterie');
    await expectFieldError('Confirmation', 'Les deux mots de passe ne correspondent pas.');
    expect(screen.getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBeNull();
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it('mot de passe contenant le pseudo', async () => {
    const { api } = await renderForm();
    submitWith('lea', 'bonjour lea 123456');
    await expectFieldError('Mot de passe', PASSWORD_MESSAGES.contains_username);
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it.each([
    ['ab', USERNAME_MESSAGES.length],
    ['a'.repeat(25), USERNAME_MESSAGES.length],
    ['Admin', USERNAME_MESSAGES.reserved],
    ['le a', USERNAME_MESSAGES.characters],
    ['léa$', USERNAME_MESSAGES.characters],
  ])('pseudo %j refusé sans requête, erreur sous le pseudo', async (username, message) => {
    const { api } = await renderForm();
    submitWith(username, PHRASE);
    await expectFieldError('Pseudo', message);
    expect(screen.getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBeNull();
    expect(callsTo(api, ACCEPT)).toHaveLength(0);
  });

  it('erreur corrigée : le compte est créé', async () => {
    const { api, location } = await renderForm();
    api.on('POST', ACCEPT, reply(makeMe({ id: 'u-9', username: 'lea', onboardingCompletedAt: null })));
    submitWith('lea', 'a1b2c3d4e5f');
    await expectFieldError('Mot de passe', '12 caractères au moins.');
    submitWith('lea', PHRASE);
    await waitFor(() => expect(location()).toBe('/onboarding'));
    expect(callsTo(api, ACCEPT)).toHaveLength(1);
  });

  it("saisie après un refus : seule l'erreur du champ repris part, sans déplacer le focus", async () => {
    await renderForm();
    submitWith('ab', PHRASE);
    await expectFieldError('Pseudo', USERNAME_MESSAGES.length);
    // Saisie dans un autre champ : l'erreur du pseudo reste, et le focus reste là où l'on tape.
    const password = screen.getByLabelText('Mot de passe');
    password.focus();
    fill('Mot de passe', `${PHRASE} solide`);
    await settle();
    expect(screen.getByLabelText('Pseudo').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(password);
    // Le pseudo repris : son erreur part dès la saisie, avant tout nouvel envoi.
    fill('Pseudo', 'abc');
    expect(screen.getByLabelText('Pseudo').getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(USERNAME_MESSAGES.length)).toBeNull();
    expect(document.activeElement).toBe(password);
  });

  it('mot de passe ou confirmation repris après un refus : leur erreur part dès la saisie', async () => {
    await renderForm();
    submitWith('lea', PHRASE, 'cheval agrafe batterie');
    await expectFieldError('Confirmation', 'Les deux mots de passe ne correspondent pas.');
    fill('Confirmation', PHRASE);
    expect(screen.getByLabelText('Confirmation').getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('Les deux mots de passe ne correspondent pas.')).toBeNull();
    submitWith('lea', 'a1b2c3d4e5f');
    await expectFieldError('Mot de passe', '12 caractères au moins.');
    // La confirmation reprise ne corrige pas le mot de passe : son erreur reste.
    fill('Confirmation', 'a1b2c3d4e5f6');
    expect(screen.getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBe('true');
    fill('Mot de passe', 'a1b2c3d4e5f6');
    expect(screen.getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('12 caractères au moins.')).toBeNull();
  });

  it('409 username_taken : erreur sous le pseudo (maquette A03), formulaire gardé', async () => {
    const { api } = await renderForm();
    api.on('POST', ACCEPT, reply({ error: 'username_taken' }, 409));
    submitWith('lea', PHRASE);
    await expectFieldError('Pseudo', 'Ce pseudo est déjà pris.');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('lea');
    expect((screen.getByLabelText('Mot de passe') as HTMLInputElement).value).toBe(PHRASE);
    expect((screen.getByRole('button', { name: 'Créer mon compte' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('password_rejected et username_invalid du serveur : le motif sous le champ en cause', async () => {
    const { api } = await renderForm();
    // « common » : la liste des mots de passe courants reste au serveur.
    api.on('POST', ACCEPT, reply({ error: 'password_rejected', reason: 'common' }, 400));
    submitWith('lea', PHRASE);
    await expectFieldError('Mot de passe', PASSWORD_MESSAGES.common);
    expect(screen.getByLabelText('Pseudo').getAttribute('aria-invalid')).toBeNull();
    api.on('POST', ACCEPT, reply({ error: 'username_invalid', reason: 'reserved' }, 400));
    click('Créer mon compte');
    await expectFieldError('Pseudo', USERNAME_MESSAGES.reserved);
    expect(screen.getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBeNull();
    // Motif inconnu : le message commun, toujours sous le mot de passe.
    api.on('POST', ACCEPT, reply({ error: 'password_rejected' }, 400));
    click('Créer mon compte');
    await expectFieldError('Mot de passe', 'Ce mot de passe ne convient pas.');
    expect(callsTo(api, ACCEPT)).toHaveLength(3);
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

  // Le formulaire reste affiché après un refus du serveur : une erreur locale corrigée ne doit pas y traîner.
  // Corrigée dans son champ, ou depuis un autre (un autre pseudo, que le mot de passe ne contient plus).
  it.each([
    ['12 caractères au moins.', 'a1b2c3d4e5f', () => submitWith('lea', PHRASE)],
    [
      PASSWORD_MESSAGES.contains_username,
      'bonjour lea 123456',
      () => {
        fill('Pseudo', 'max');
        click('Créer mon compte');
      },
    ],
  ] as const)(
    'erreur « %s » corrigée puis refus du serveur : le mot de passe redevient valide, seule l’alerte reste',
    async (message, refused, correct) => {
      const { api } = await renderForm();
      api.setOffline('reject');
      submitWith('lea', refused);
      await expectFieldError('Mot de passe', message);
      correct();
      expect(await alertText()).toBe('Nécessite le réseau');
      const password = screen.getByLabelText('Mot de passe');
      expect(password.getAttribute('aria-invalid')).toBeNull();
      expect(description(password)).not.toContain(message);
      expect(screen.queryByText(message)).toBeNull();
    },
  );

  it("champs nommés pour les lecteurs d'écran et les gestionnaires de mots de passe", async () => {
    await renderForm();
    const password = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('new-password');
    const confirm = screen.getByLabelText('Confirmation') as HTMLInputElement;
    expect(confirm.type).toBe('password');
    expect(confirm.autocomplete).toBe('new-password');
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).autocomplete).toBe('username');
    expect(screen.getByText(/Astuce : une phrase de 4 mots ou plus/)).toBeTruthy();
  });
});
