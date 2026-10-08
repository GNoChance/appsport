import type { MeResponse } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfilePage } from '../../src/features/profile/ProfilePage';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, choose, isChecked, seedProfile, serveProfile } from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
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

  it('pseudo invalide : message local, aucune requête', async () => {
    const { api } = await renderProfile();
    fill('Pseudo', 'le');
    fireEvent.click(button('Enregistrer le pseudo'));
    expect((await screen.findByRole('alert')).textContent).toBe('3 à 24 caractères.');
    expect(calls(api, 'PATCH', '/api/me')).toHaveLength(0);
  });

  it('hors ligne : alerte « Nécessite le réseau »', async () => {
    const { api } = await renderProfile();
    api.setOffline('reject');
    fill('Pseudo', 'leo');
    fireEvent.click(button('Enregistrer le pseudo'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
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

  it('confirmation différente : message local, aucune requête', async () => {
    const { api } = await renderProfile();
    changePassword(OLD_PASSWORD, NEW_PASSWORD, 'autre chose encore');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Les deux mots de passe ne correspondent pas.',
    );
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
    expect(screen.queryByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeNull();

    changePassword();
    await until(() => screen.queryByText(FORCED_BANNER) === null);
    expect(screen.getByText(CHANGED)).toBeTruthy();
    expect(heading('Compte')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 2, name: 'Entraînement' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lieux' })).toBeTruthy();
    expect(sync.triggers).toContain('manual');
  });

  it('administrateur : 13 caractères refusés localement (R-MDP-1)', async () => {
    const { api } = await renderProfile({ me: makeMe({ role: 'admin' }) });
    changePassword(OLD_PASSWORD, 'cheval agrafe', 'cheval agrafe');
    expect((await screen.findByRole('alert')).textContent).toBe('14 caractères au moins.');
    expect(calls(api, 'POST', '/api/auth/password')).toHaveLength(0);
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

  it('mode prudent → PATCH { cautiousMode: true }', async () => {
    const t = await renderProfile();
    fireEvent.click(await screen.findByRole('switch', { name: CAUTIOUS }));
    await until(() => t.patches.length === 1);
    expect(t.patches).toEqual([{ cautiousMode: true }]);
    await until(() => (screen.getByRole('switch', { name: CAUTIOUS }) as HTMLInputElement).checked);
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
