import type { MeResponse } from '@appsport/contracts';
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
  const rendered = await renderWithServices(<ProfilePage />, { me, db, api, path: '/profile' });
  await screen.findByRole('heading', { level: 1, name: 'Profil' });
  return { ...rendered, ...server };
}

const calls = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path);
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });
/** Textes qui décrivent un champ (aide, erreur), via aria-describedby. */
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

function changePassword(current = OLD_PASSWORD, next = NEW_PASSWORD, confirm = next) {
  fill('Mot de passe actuel', current);
  fill('Nouveau mot de passe', next);
  fill('Confirmation', confirm);
  fireEvent.click(button('Changer le mot de passe'));
}

describe('ProfilePage › Compte (02 §11, R-CPT-3)', () => {
  it('pseudo modifiable, date de naissance en lecture seule avec sa raison', async () => {
    await renderProfile();
    expect(input('Pseudo').value).toBe('lea');
    const birth = input('Date de naissance');
    expect(birth.readOnly).toBe(true);
    expect(birth.value).toBe('01/01/1990');
    expect(birth.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText("Seul l'administrateur peut la corriger.")).toBeTruthy();
  });

  it('« Enregistrer le pseudo » → PATCH /api/me { username } puis « Pseudo enregistré. »', async () => {
    const api = createFakeApi().on('PATCH', '/api/me', { status: 200, body: makeMe({ username: 'leo' }) });
    const { sync } = await renderProfile({ api });
    expect(button('Enregistrer le pseudo').disabled).toBe(true);
    fill('Pseudo', 'leo');
    fireEvent.click(button('Enregistrer le pseudo'));
    await screen.findByText('Pseudo enregistré.');
    expect(calls(api, 'PATCH', '/api/me').map((c) => c.body)).toEqual([{ username: 'leo' }]);
    expect(sync.pullCount).toBe(1);
  });

  it('pseudo invalide : message local lié au champ, aucune requête', async () => {
    const { api } = await renderProfile();
    fill('Pseudo', 'le');
    fireEvent.click(button('Enregistrer le pseudo'));
    await expectFieldError('Pseudo', '3 à 24 caractères.');
    expect(calls(api, 'PATCH', '/api/me')).toHaveLength(0);
  });

  it('hors ligne : alerte « Nécessite le réseau »', async () => {
    const { api } = await renderProfile();
    api.setOffline('reject');
    fill('Pseudo', 'leo');
    fireEvent.click(button('Enregistrer le pseudo'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(input('Pseudo').value).toBe('leo');
  });

  it('409 username_taken : « Ce pseudo est déjà pris. »', async () => {
    const api = createFakeApi().on('PATCH', '/api/me', { status: 409, body: { error: 'username_taken' } });
    await renderProfile({ api });
    fill('Pseudo', 'max');
    fireEvent.click(button('Enregistrer le pseudo'));
    expect((await screen.findByRole('alert')).textContent).toBe('Ce pseudo est déjà pris.');
  });

  it('« Déconnecter tous mes appareils » → LogoutDialog all → POST /api/auth/logout-all', async () => {
    const api = createFakeApi().on('POST', '/api/auth/logout-all', { status: 204 });
    await renderProfile({ api });
    fireEvent.click(button('Déconnecter tous mes appareils'));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Déconnecter tous les appareils ?' })).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Déconnecter tous les appareils' }));
    await until(() => calls(api, 'POST', '/api/auth/logout-all').length === 1);
  });

  it('« Se déconnecter » → LogoutDialog current → POST /api/auth/logout', async () => {
    const api = createFakeApi().on('POST', '/api/auth/logout', { status: 204 });
    await renderProfile({ api });
    fireEvent.click(button('Se déconnecter'));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Se déconnecter de cet appareil ?' })).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Se déconnecter' }));
    await until(() => calls(api, 'POST', '/api/auth/logout').length === 1);
  });
});

describe('ProfilePage › Mot de passe (R-MDP-6)', () => {
  it('« Changer le mot de passe » → POST /api/auth/password puis le message, champs vidés', async () => {
    const api = createFakeApi()
      .on('POST', '/api/auth/password', { status: 204 })
      .on('GET', '/api/me', { status: 200, body: makeMe() });
    await renderProfile({ api });
    changePassword();
    await screen.findByText(CHANGED);
    expect(calls(api, 'POST', '/api/auth/password').map((c) => c.body)).toEqual([
      { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD },
    ]);
    expect(input('Mot de passe actuel').value).toBe('');
    expect(input('Nouveau mot de passe').value).toBe('');
    expect(input('Confirmation').value).toBe('');
  });

  it('401 invalid_credentials : « Mot de passe actuel incorrect. »', async () => {
    const api = createFakeApi().on('POST', '/api/auth/password', {
      status: 401,
      body: { error: 'invalid_credentials' },
    });
    await renderProfile({ api });
    changePassword('mauvais mot de passe');
    expect((await screen.findByRole('alert')).textContent).toBe('Mot de passe actuel incorrect.');
  });

  it('confirmation différente : message local lié à « Confirmation », aucune requête', async () => {
    const { api } = await renderProfile();
    changePassword(OLD_PASSWORD, NEW_PASSWORD, 'autre chose encore');
    await expectFieldError('Confirmation', 'Les deux mots de passe ne correspondent pas.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
  });

  it('mot de passe actuel vide : message local lié au champ, aucune requête', async () => {
    const { api } = await renderProfile();
    changePassword('');
    await expectFieldError('Mot de passe actuel', 'Saisis ton mot de passe actuel.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
  });

  it('mustChangePassword (R-MDP-1) : bandeau et seule la section mot de passe ; après le changement, tout réapparaît', async () => {
    const admin = makeMe({ role: 'admin', mustChangePassword: true });
    const api = createFakeApi()
      .on('POST', '/api/auth/password', { status: 204 })
      .on('GET', '/api/me', { status: 200, body: { ...admin, mustChangePassword: false } });
    const { sync } = await renderProfile({ me: admin, api });
    expect(screen.getByText(FORCED_BANNER)).toBeTruthy();
    expect(heading('Mot de passe')).toBeTruthy();
    expect(heading('Compte')).toBeNull();
    expect(heading('Entraînement')).toBeNull();
    expect(screen.queryByLabelText('Pseudo')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lieux' })).toBeNull();
    expect(button('Se déconnecter')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeNull();

    changePassword();
    await until(() => screen.queryByText(FORCED_BANNER) === null);
    expect(await screen.findByText(CHANGED)).toBeTruthy();
    expect(heading('Compte')).toBeTruthy();
    // Un seul « Se déconnecter » : celui de « Compte », avec « Déconnecter tous mes appareils ».
    expect(screen.getAllByRole('button', { name: 'Se déconnecter' })).toHaveLength(1);
    expect(button('Déconnecter tous mes appareils')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 2, name: 'Entraînement' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lieux' })).toBeTruthy();
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

  it('administrateur : 13 caractères refusés localement (R-MDP-1)', async () => {
    const { api } = await renderProfile({ me: makeMe({ role: 'admin' }) });
    changePassword(OLD_PASSWORD, 'cheval agrafe', 'cheval agrafe');
    await expectFieldError('Nouveau mot de passe', '14 caractères au moins.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
  });
});

describe('ProfilePage › mot de passe à changer : se déconnecter (R-MDP-1, R-AUTH-9)', () => {
  const forced = makeMe({ role: 'admin', mustChangePassword: true });
  const logoutApi = () =>
    createFakeApi()
      .on('POST', '/api/auth/logout', { status: 204 })
      .on('POST', '/api/auth/logout-all', { status: 204 });
  const logoutCalls = (api: FakeApi) => api.calls.filter((c) => c.path.startsWith('/api/auth/logout'));

  it('« Se déconnecter » sous le formulaire → POST /api/auth/logout, données locales effacées, connexion', async () => {
    const api = logoutApi();
    const { db, location } = await renderProfile({ me: forced, api });
    const logout = button('Se déconnecter');
    const following = button('Changer le mot de passe').compareDocumentPosition(logout);
    expect(following & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeNull();
    fireEvent.click(logout);
    const dialog = within(await screen.findByRole('dialog', { name: 'Se déconnecter de cet appareil ?' }));
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
    const dialog = await screen.findByRole('dialog', { name: 'Données non envoyées' });
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
    expect(document.activeElement).toBe(button('Se déconnecter'));
    expect(logoutCalls(api)).toHaveLength(0);
    expect(location()).toBe('/profile');
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
  it('résumé : objectif, sport, niveau, disponibilité', async () => {
    await renderProfile();
    await screen.findByText('Prendre du muscle');
    expect(screen.getByText('Jamais')).toBeTruthy();
    expect(screen.getByText('3 séances de 45 min')).toBeTruthy();
    expect(screen.getByText('Aucun')).toBeTruthy();
  });

  it("« Modifier l'objectif » → GoalStep en édition → PATCH { goal } puis retour au résumé", async () => {
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

  it("« Retour » dans un écran d'édition : rien n'est envoyé, le focus revient au bouton", async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le niveau' }));
    await until(() => isChecked('Jamais'));
    expect(document.activeElement?.textContent).toBe('Niveau');
    fireEvent.click(button('Retour'));
    const back = await screen.findByRole('button', { name: 'Modifier le niveau' });
    expect(document.activeElement).toBe(back);
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

describe('ProfilePage › liens et route', () => {
  it('liens Lieux, Santé, Confidentialité et Réglages', async () => {
    await renderProfile();
    const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href('Lieux')).toBe('/profile/places');
    expect(href('Santé')).toBe('/profile/health');
    expect(href('Confidentialité')).toBe('/profile/privacy');
    expect(href('Réglages')).toBe('/settings');
  });

  it('/profile rend le Profil dans la coquille', async () => {
    await renderApp({ path: '/profile' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy();
  });
});
