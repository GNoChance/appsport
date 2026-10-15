import type { MeResponse } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pendingWarning } from '../../src/features/auth/messages';
import { ProfilePage } from '../../src/features/profile/ProfilePage';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, choose, isChecked, PROFILE_PATH, seedProfile, serveProfile } from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { seedOutbox } from '../support/seed';
import { until } from '../support/wait';

const TRAINING = { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 } as const;
const FORCED_BANNER =
  'Ton mot de passe doit être changé avant de continuer (14 caractères au moins pour un administrateur).';
const CHANGED = 'Mot de passe changé. Tes autres appareils ont été déconnectés.';
const CAUTIOUS = 'Je préfère une progression plus prudente';
const OLD_PASSWORD = 'ancien mot de passe ok';
const NEW_PASSWORD = 'cheval agrafe batterie correcte';

async function renderProfile(
  o: { me?: MeResponse; api?: FakeApi; profile?: Parameters<typeof seedProfile>[1] } = {},
) {
  const me = o.me ?? makeMe();
  const db = createTestLocalDb();
  const api = o.api ?? createFakeApi();
  await seedProfile(db, { ...TRAINING, ...o.profile });
  const server = serveProfile(api, db, me);
  const rendered = await renderWithServices(<ProfilePage />, { me, db, api, path: '/profile/edit' });
  await screen.findByRole('heading', { level: 1, name: 'Mon profil' });
  return { ...rendered, ...server };
}

const calls = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path);
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });
/** Textes qui décrivent un élément (aide, erreur, valeur d'une ligne), via aria-describedby. */
const description = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

/** Erreur locale liée au champ `label` (aria-invalid, description), focus sur le champ, pas d'alerte. */
async function expectFieldError(label: string, message: string) {
  const field = input(label);
  await until(() => field.getAttribute('aria-invalid') === 'true');
  expect(description(field)).toContain(message);
  expect(document.activeElement).toBe(field);
  expect(screen.queryByRole('alert')).toBeNull();
}

/** La ligne « Changer le mot de passe » ouvre le formulaire. */
async function openPassword() {
  fireEvent.click(await screen.findByRole('button', { name: 'Changer le mot de passe' }));
  await screen.findByLabelText('Mot de passe actuel');
}

function changePassword(current = OLD_PASSWORD, next = NEW_PASSWORD, confirm = next) {
  fill('Mot de passe actuel', current);
  fill('Nouveau mot de passe', next);
  fill('Confirmation', confirm);
  fireEvent.click(button('Changer le mot de passe'));
}

/**
 * Lignes qui ouvrent un formulaire, avec leur libellé visible : le nom dit l'action et reprend le libellé
 * (WCAG 2.5.3), comme les anciens boutons « Modifier … » de l'Entraînement.
 */
const ROWS = [
  ["Modifier l'objectif", 'Objectif'],
  ['Modifier le sport', 'Sport'],
  ['Modifier le niveau', 'Niveau'],
  ['Modifier la disponibilité', 'Disponibilité'],
  ['Modifier le pseudo', 'Pseudo'],
] as const;
const ROW_NAMES = ROWS.map(([name]) => name);

/** La ligne « Pseudo » (« Modifier le pseudo ») ouvre le formulaire du pseudo. */
async function openUsername() {
  fireEvent.click(await screen.findByRole('button', { name: 'Modifier le pseudo' }));
  await screen.findByRole('textbox', { name: 'Pseudo' });
}

describe('ProfilePage › Compte (02 §11, R-CPT-3, maquette C02)', () => {
  it('lignes : pseudo, date de naissance en lecture seule avec sa raison, mot de passe', async () => {
    await renderProfile();
    expect(description(button('Modifier le pseudo'))).toBe('lea');
    expect(screen.getByText('Date de naissance')).toBeTruthy();
    expect(screen.getByText('01/01/1990')).toBeTruthy();
    expect(screen.getByText("Seul l'administrateur peut la corriger.")).toBeTruthy();
    // La date ne se modifie pas ici : ni champ ni bouton, ni lien, sur sa ligne quel que soit son nom.
    const birthRow = screen.getByText('Date de naissance').closest('li');
    if (!birthRow) throw new Error('aucune ligne Date de naissance');
    expect(within(birthRow).queryByRole('textbox')).toBeNull();
    expect(within(birthRow).queryByRole('button')).toBeNull();
    expect(within(birthRow).queryByRole('link')).toBeNull();
    expect(description(button('Changer le mot de passe'))).toBe('Tes autres appareils seront déconnectés.');
  });

  it('maquette C02 : réponses et compte en petit libellé sur leur valeur en gras ; le mot de passe reste une action', async () => {
    await renderProfile();
    await screen.findByText('Prendre du muscle');
    for (const name of ROW_NAMES) expect(button(name).getAttribute('data-emphasis'), name).toBe('value');
    // Le libellé visible reste le mot court de la maquette, dans le nom de la ligne.
    for (const [name, label] of ROWS) expect(button(name).textContent, name).toContain(label);
    const birth = screen.getByText('Date de naissance').closest('[data-emphasis]');
    expect(birth?.getAttribute('data-emphasis')).toBe('value');
    expect(button('Changer le mot de passe').hasAttribute('data-emphasis')).toBe(false);
  });

  it('le pseudo se modifie depuis sa ligne : champ prérempli, « Enregistrer le pseudo » désactivé', async () => {
    await renderProfile();
    expect(screen.queryByRole('textbox', { name: 'Pseudo' })).toBeNull();
    await openUsername();
    expect(input('Pseudo').value).toBe('lea');
    expect(button('Enregistrer le pseudo').disabled).toBe(true);
  });

  it('« Enregistrer le pseudo » → PATCH /api/me { username }, « Pseudo enregistré. », retour à la ligne', async () => {
    const api = createFakeApi().on('PATCH', '/api/me', { status: 200, body: makeMe({ username: 'leo' }) });
    const { sync } = await renderProfile({ api });
    await openUsername();
    fill('Pseudo', 'leo');
    fireEvent.click(button('Enregistrer le pseudo'));
    await screen.findByText('Pseudo enregistré.');
    expect(calls(api, 'PATCH', '/api/me').map((c) => c.body)).toEqual([{ username: 'leo' }]);
    expect(sync.pullCount).toBe(1);
    expect(screen.queryByRole('textbox', { name: 'Pseudo' })).toBeNull();
    await until(() => document.activeElement === button('Modifier le pseudo'));
    await until(() => description(button('Modifier le pseudo')) === 'leo');
  });

  it('« Annuler » : rien envoyé, la ligne reprend le focus', async () => {
    const { api } = await renderProfile();
    await openUsername();
    fill('Pseudo', 'leo');
    fireEvent.click(button('Annuler'));
    await until(() => document.activeElement === button('Modifier le pseudo'));
    expect(calls(api, 'PATCH', '/api/me')).toHaveLength(0);
    expect(screen.queryByText('Pseudo enregistré.')).toBeNull();
  });

  it('pseudo invalide : message local lié au champ, aucune requête', async () => {
    const { api } = await renderProfile();
    await openUsername();
    fill('Pseudo', 'le');
    fireEvent.click(button('Enregistrer le pseudo'));
    await expectFieldError('Pseudo', '3 à 24 caractères.');
    expect(calls(api, 'PATCH', '/api/me')).toHaveLength(0);
  });

  it('hors ligne : alerte « Nécessite le réseau », saisie gardée', async () => {
    const { api } = await renderProfile();
    api.setOffline('reject');
    await openUsername();
    fill('Pseudo', 'leo');
    fireEvent.click(button('Enregistrer le pseudo'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(input('Pseudo').value).toBe('leo');
  });

  it('409 username_taken : « Ce pseudo est déjà pris. »', async () => {
    const api = createFakeApi().on('PATCH', '/api/me', { status: 409, body: { error: 'username_taken' } });
    await renderProfile({ api });
    await openUsername();
    fill('Pseudo', 'max');
    fireEvent.click(button('Enregistrer le pseudo'));
    expect((await screen.findByRole('alert')).textContent).toBe('Ce pseudo est déjà pris.');
  });

  it('la déconnexion est dans le hub du Profil, pas ici', async () => {
    await renderProfile();
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeNull();
  });
});

describe('ProfilePage › Mot de passe (R-MDP-6)', () => {
  it('aucun champ de mot de passe avant « Changer le mot de passe »', async () => {
    await renderProfile();
    await screen.findByRole('button', { name: 'Changer le mot de passe' });
    expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
    expect(screen.queryByLabelText('Nouveau mot de passe')).toBeNull();
    expect(screen.queryByLabelText('Confirmation')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    await openPassword();
    expect(input('Mot de passe actuel').type).toBe('password');
    expect(input('Nouveau mot de passe').type).toBe('password');
    expect(input('Confirmation').type).toBe('password');
  });

  it('« Changer le mot de passe » → POST /api/auth/password, message, formulaire refermé', async () => {
    const api = createFakeApi()
      .on('POST', '/api/auth/password', { status: 204 })
      .on('GET', '/api/me', { status: 200, body: makeMe() });
    await renderProfile({ api });
    await openPassword();
    changePassword();
    await screen.findByText(CHANGED);
    expect(calls(api, 'POST', '/api/auth/password').map((c) => c.body)).toEqual([
      { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD },
    ]);
    expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
    await until(() => document.activeElement === button('Changer le mot de passe'));
  });

  it('« Annuler » referme le formulaire sans requête ; rouvert, il repart vide', async () => {
    const { api } = await renderProfile();
    await openPassword();
    fill('Mot de passe actuel', OLD_PASSWORD);
    fireEvent.click(button('Annuler'));
    await until(() => document.activeElement === button('Changer le mot de passe'));
    expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
    await openPassword();
    expect(input('Mot de passe actuel').value).toBe('');
  });

  it('401 invalid_credentials : « Mot de passe actuel incorrect. », formulaire gardé', async () => {
    const api = createFakeApi().on('POST', '/api/auth/password', {
      status: 401,
      body: { error: 'invalid_credentials' },
    });
    await renderProfile({ api });
    await openPassword();
    changePassword('mauvais mot de passe');
    expect((await screen.findByRole('alert')).textContent).toBe('Mot de passe actuel incorrect.');
    expect(input('Mot de passe actuel').value).toBe('mauvais mot de passe');
  });

  it('confirmation différente : message local lié à « Confirmation », aucune requête', async () => {
    const { api } = await renderProfile();
    await openPassword();
    changePassword(OLD_PASSWORD, NEW_PASSWORD, 'autre chose encore');
    await expectFieldError('Confirmation', 'Les deux mots de passe ne correspondent pas.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
  });

  it('mot de passe actuel vide : message local lié au champ, aucune requête', async () => {
    const { api } = await renderProfile();
    await openPassword();
    changePassword('');
    await expectFieldError('Mot de passe actuel', 'Saisis ton mot de passe actuel.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
  });

  it('administrateur : 13 caractères refusés localement (R-MDP-1)', async () => {
    const { api } = await renderProfile({ me: makeMe({ role: 'admin' }) });
    await openPassword();
    changePassword(OLD_PASSWORD, 'cheval agrafe', 'cheval agrafe');
    await expectFieldError('Nouveau mot de passe', '14 caractères au moins.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
  });

  it('mustChangePassword (R-MDP-1) : bandeau et seuls les champs du mot de passe ; après le changement, tout réapparaît', async () => {
    const admin = makeMe({ role: 'admin', mustChangePassword: true });
    const api = createFakeApi()
      .on('POST', '/api/auth/password', { status: 204 })
      .on('GET', '/api/me', { status: 200, body: { ...admin, mustChangePassword: false } });
    const { sync } = await renderProfile({ me: admin, api });
    expect(screen.getByText(FORCED_BANNER)).toBeTruthy();
    expect(heading('Mot de passe')).toBeTruthy();
    // Champs affichés d'emblée : pas de ligne à toucher, pas d'« Annuler ».
    expect(input('Mot de passe actuel')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    expect(heading('Compte')).toBeNull();
    expect(heading('Entraînement')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Modifier le pseudo' })).toBeNull();
    // Le hub renverrait ici : pas de Retour.
    expect(screen.queryByRole('link', { name: 'Retour' })).toBeNull();
    expect(button('Se déconnecter')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeNull();

    changePassword();
    await until(() => screen.queryByText(FORCED_BANNER) === null);
    expect(await screen.findByText(CHANGED)).toBeTruthy();
    expect(heading('Compte')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 2, name: 'Entraînement' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/profile');
    // La déconnexion retourne au hub.
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    await until(() => document.activeElement === button('Changer le mot de passe'));
    expect(sync.triggers).toContain('manual');
  });

  it('mustChangePassword : GET /api/me en échec après le changement réussi, le bandeau disparaît quand même', async () => {
    const admin = makeMe({ role: 'admin', mustChangePassword: true });
    const api = createFakeApi();
    // Le réseau tombe juste après la réponse du serveur.
    api.on('POST', '/api/auth/password', () => {
      api.setOffline('reject');
      return { status: 204 };
    });
    await renderProfile({ me: admin, api });
    changePassword();
    await until(() => screen.queryByText(FORCED_BANNER) === null);
    expect(await screen.findByText(CHANGED)).toBeTruthy();
    expect(calls(api, 'GET', '/api/me')).toHaveLength(1);
    expect(heading('Compte')).toBeTruthy();
  });
});

describe('ProfilePage › mot de passe à changer : se déconnecter (R-MDP-1, R-AUTH-9)', () => {
  const forced = makeMe({ role: 'admin', mustChangePassword: true });
  const logoutApi = () =>
    createFakeApi()
      .on('POST', '/api/auth/logout', { status: 204 })
      .on('POST', '/api/auth/logout-all', { status: 204 });
  const logoutCalls = (api: FakeApi) => api.calls.filter((c) => c.path.startsWith('/api/auth/logout'));

  it('« Se déconnecter » sous le formulaire, cet appareil seulement → POST /api/auth/logout, données effacées', async () => {
    const api = logoutApi();
    const { db, location } = await renderProfile({ me: forced, api });
    const logout = button('Se déconnecter');
    const following = button('Changer le mot de passe').compareDocumentPosition(logout);
    expect(following & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(logout);
    const dialog = within(await screen.findByRole('dialog', { name: 'Se déconnecter' }));
    // Pas de choix « Tous mes appareils » : le serveur n'accepte que cet appareil dans cet état.
    expect(dialog.queryByRole('radio')).toBeNull();
    expect(dialog.queryByText('Tous mes appareils')).toBeNull();
    expect(
      dialog.getByText('Les données de cet appareil seront effacées. Tu les retrouveras en te reconnectant.'),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Se déconnecter' }));
    await until(() => location() === '/login');
    expect(logoutCalls(api).map((c) => [c.method, c.path, c.body])).toEqual([
      ['POST', '/api/auth/logout', {}],
    ]);
    expect(await getMeta(db, 'me')).toBeUndefined();
    expect(await getMeta(db, 'userId')).toBeUndefined();
    expect(await db.mirror('training_profile').count()).toBe(0);
  });

  it('données non envoyées : même avertissement, « Se déconnecter quand même » → file effacée', async () => {
    const api = logoutApi();
    const { db, location } = await renderProfile({ me: forced, api });
    await seedOutbox(db, 'u-1', 2);
    fireEvent.click(button('Se déconnecter'));
    const dialog = await screen.findByRole('dialog', { name: 'Se déconnecter' });
    expect(dialog.textContent).toContain('Données non envoyées');
    expect(dialog.textContent).toContain(pendingWarning(2, 'lea'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se déconnecter quand même' }));
    await until(() => location() === '/login');
    expect(logoutCalls(api).map((c) => c.path)).toEqual(['/api/auth/logout']);
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'me')).toBeUndefined();
  });

  it('« Annuler » : rien envoyé, le focus revient à « Se déconnecter »', async () => {
    const api = logoutApi();
    const { location } = await renderProfile({ me: forced, api });
    fireEvent.click(button('Se déconnecter'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await until(() => screen.queryByRole('dialog') === null);
    await until(() => document.activeElement === button('Se déconnecter'));
    expect(logoutCalls(api)).toHaveLength(0);
    expect(location()).toBe('/profile/edit');
  });

  it('dialogue ouvert : une relecture du compte ne reprend pas le focus', async () => {
    const { db } = await renderProfile({ me: forced, api: logoutApi() });
    fireEvent.click(button('Se déconnecter'));
    const cancel = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' });
    cancel.focus();
    await setMeta(db, 'me', { ...forced });
    await settle();
    expect(document.activeElement).toBe(cancel);
  });

  it("dans l'appli : la garde laisse l'écran de connexion s'afficher après la déconnexion", async () => {
    const api = logoutApi();
    await renderApp({ path: '/profile', me: forced, api });
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
    expect(logoutCalls(api).map((c) => c.path)).toEqual(['/api/auth/logout']);
  });
});

describe('ProfilePage › Entraînement (R-ONB-3)', () => {
  it('lignes : objectif, sport, niveau, disponibilité, chacune avec sa valeur', async () => {
    await renderProfile();
    await screen.findByText('Prendre du muscle');
    expect(description(button("Modifier l'objectif"))).toBe('Prendre du muscle');
    expect(description(button('Modifier le sport'))).toBe('Aucun');
    expect(description(button('Modifier le niveau'))).toBe('Jamais');
    expect(description(button('Modifier la disponibilité'))).toBe('3 séances de 45 min');
  });

  it("« Modifier l'objectif » → GoalStep en édition → PATCH { goal } puis retour aux lignes", async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: "Modifier l'objectif" }));
    await until(() => isChecked('Prendre du muscle'));
    choose('Gagner en force');
    fireEvent.click(button('Enregistrer'));
    await screen.findByRole('button', { name: "Modifier l'objectif" });
    expect(t.patches).toEqual([{ goal: 'strength' }]);
    expect(await screen.findByText('Gagner en force')).toBeTruthy();
  });

  it('objectif sportif sans sport : le sport est demandé, puis un seul PATCH', async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: "Modifier l'objectif" }));
    await until(() => isChecked('Prendre du muscle'));
    choose('Me renforcer pour mon sport');
    fireEvent.click(button('Suivant'));
    await screen.findByRole('radio', { name: 'Course à pied' });
    expect(t.patches).toEqual([]);
    choose('Course à pied');
    fireEvent.click(button('Enregistrer'));
    await screen.findByRole('button', { name: "Modifier l'objectif" });
    expect(t.patches).toEqual([{ goal: 'sport_support', sportCode: 'running', sportOtherLabel: null }]);
  });

  it("objectif sportif sans sport : le focus va au titre du sport, puis revient à l'objectif avec « Retour »", async () => {
    await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: "Modifier l'objectif" }));
    await until(() => isChecked('Prendre du muscle'));
    choose('Me renforcer pour mon sport');
    fireEvent.click(button('Suivant'));
    await screen.findByRole('radio', { name: 'Course à pied' });
    expect(document.activeElement?.textContent).toBe('Autre sport');
    fireEvent.click(button('Retour'));
    await screen.findByRole('radio', { name: 'Me renforcer pour mon sport' });
    expect(document.activeElement?.textContent).toBe('Objectif');
  });

  it('« Modifier le sport » → SportStep en édition → PATCH { sportCode, sportOtherLabel }', async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le sport' }));
    await until(() => isChecked('Non'));
    choose('Oui');
    choose('Course à pied');
    fireEvent.click(button('Enregistrer'));
    await screen.findByRole('button', { name: 'Modifier le sport' });
    expect(t.patches).toEqual([{ sportCode: 'running', sportOtherLabel: null }]);
    expect(await screen.findByText('Course à pied')).toBeTruthy();
  });

  it('« Modifier le niveau » → PATCH { experience }', async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le niveau' }));
    await until(() => isChecked('Jamais'));
    choose('Moins de 6 mois');
    fireEvent.click(button('Enregistrer'));
    await screen.findByRole('button', { name: 'Modifier le niveau' });
    expect(t.patches).toEqual([{ experience: 'lt_6_months' }]);
  });

  it('« Modifier la disponibilité » → PATCH { daysPerWeek, sessionMinutes }', async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la disponibilité' }));
    await until(() => isChecked('3'));
    choose('4');
    choose('60 min');
    fireEvent.click(button('Enregistrer'));
    await screen.findByRole('button', { name: 'Modifier la disponibilité' });
    expect(t.patches).toEqual([{ daysPerWeek: 4, sessionMinutes: 60 }]);
    expect(await screen.findByText('4 séances de 60 min')).toBeTruthy();
  });

  it("« Retour » dans un écran d'édition : rien n'est envoyé, le focus revient à la ligne", async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le niveau' }));
    await until(() => isChecked('Jamais'));
    expect(document.activeElement?.textContent).toBe('Niveau');
    fireEvent.click(button('Retour'));
    const back = await screen.findByRole('button', { name: 'Modifier le niveau' });
    await until(() => document.activeElement === back);
    expect(t.patches).toEqual([]);
  });

  it('mode prudent → PATCH { cautiousMode: true } ; le miroir relu fait foi', async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('switch', { name: CAUTIOUS }));
    await until(() => t.patches.length === 1);
    expect(t.patches).toEqual([{ cautiousMode: true }]);
    const toggle = () => screen.getByRole('switch', { name: CAUTIOUS }) as HTMLInputElement;
    await settle(); // réponse reçue, miroir écrit par le faux serveur
    expect(toggle().checked).toBe(true);
    // Un autre appareil remet le mode prudent à non : la relecture du profil le montre.
    await seedProfile(t.db, { ...TRAINING, cautiousMode: false });
    await until(() => !toggle().checked);
  });

  it("mode prudent : l'interrupteur est désactivé pendant l'envoi, pas de deuxième PATCH", async () => {
    const { api } = await renderProfile();
    const toggle = (await screen.findByRole('switch', { name: CAUTIOUS })) as HTMLInputElement;
    api.setOffline('hang');
    fireEvent.click(toggle);
    await until(() => calls(api, 'PATCH', PROFILE_PATH).length === 1);
    expect(toggle.disabled).toBe(true);
    fireEvent.click(toggle);
    await settle();
    expect(calls(api, 'PATCH', PROFILE_PATH)).toHaveLength(1);
  });

  it("mode prudent hors ligne : « Nécessite le réseau », l'interrupteur revient", async () => {
    const { api } = await renderProfile();
    api.setOffline('reject');
    const toggle = (await screen.findByRole('switch', { name: CAUTIOUS })) as HTMLInputElement;
    fireEvent.click(toggle);
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    await settle();
    expect((screen.getByRole('switch', { name: CAUTIOUS }) as HTMLInputElement).checked).toBe(false);
  });

  it('mineur : mode prudent imposé (R-AGE, P-MIN)', async () => {
    await renderProfile({ me: makeMe({ ageBand: 'minor' }) });
    const toggle = (await screen.findByRole('switch', { name: CAUTIOUS })) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(true);
  });
});

describe('ProfilePage › route', () => {
  it('/profile/edit rend Mon profil dans la coquille, onglet Profil actif', async () => {
    await renderApp({ path: '/profile/edit' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon profil' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Profil' }).getAttribute('aria-current')).toBe('page');
  });
});
