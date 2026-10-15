import type { MeResponse } from '@rune/contracts';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pendingWarning } from '../../src/features/auth/messages';
import { settle } from '../support/auth';
import { createFakeApi, createFakeSyncEngine, type FakeApi, type FakeSyncEngine } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { seedPrimaryGym, seedProfile } from '../support/onboarding';
import { makeMe, renderApp } from '../support/render';
import { seedMirror, seedOutbox } from '../support/seed';
import { until } from '../support/wait';

const consented = (o: Partial<MeResponse> = {}): MeResponse =>
  makeMe({
    consents: {
      health: { active: true, textVersion: '1.0', at: '2026-10-01T10:00:00.000Z' },
      aiCoach: { active: false, textVersion: null, at: null },
    },
    ...o,
  });

const knee = {
  id: 'l-1',
  ownerId: 'u-1',
  bodyArea: 'knee',
  side: 'left',
  severity: 'mild',
  note: null,
  active: true,
};

async function renderHub(
  o: {
    me?: MeResponse;
    sync?: FakeSyncEngine;
    api?: FakeApi;
    pending?: number;
    /** Champs du profil d'entraînement (coach Le Skald sauf `coach: null`) ; objectif et disponibilité par défaut. */
    profile?: Parameters<typeof seedProfile>[1];
    /** Limitation « Genou » quand l'accord santé est donné ; vrai par défaut. */
    limitation?: boolean;
  } = {},
) {
  const me = o.me ?? makeMe();
  const db = createTestLocalDb();
  await seedProfile(
    db,
    o.profile ?? { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 },
  );
  await seedPrimaryGym(db);
  if (me.consents.health.active && o.limitation !== false) await seedMirror(db, 'limitation', [knee]);
  if (o.pending) await seedOutbox(db, 'u-1', o.pending);
  const view = await renderApp({ path: '/profile', me, db, api: o.api, sync: o.sync });
  await screen.findByRole('heading', { level: 1, name: 'Profil' });
  return view;
}

/** Groupe de lignes nommé par son petit titre (h2). */
const group = (title: string) => {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section');
  if (!section) throw new Error(`aucun groupe ${title}`);
  return within(section);
};
/** Libellé de chaque lien d'un groupe, dans l'ordre (le lien est nommé par son libellé seul). */
const rowLabels = (title: string) =>
  group(title)
    .getAllByRole('link')
    .map((a) => document.getElementById(a.getAttribute('aria-labelledby') ?? '')?.textContent);
/** Texte qui décrit une ligne (valeur, badge), via aria-describedby. */
const description = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
/** Lien de l'écran (le pied de page de la coquille a aussi « Aide » et « Confidentialité et règles »). */
const link = (name: string) => within(screen.getByRole('main')).getByRole('link', { name });
/**
 * Valeur de la ligne `name`, attendue (chaque valeur vient de sa propre lecture sur l'appareil) : une valeur
 * fausse échoue sur l'égalité qui suit, pas sur l'attente.
 */
async function rowValue(name: string): Promise<string> {
  await until(() => description(link(name)) !== '');
  return description(link(name));
}
/** Petits titres des groupes de l'écran, dans l'ordre. */
const groupTitles = () =>
  within(screen.getByRole('main'))
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent);

describe('ProfileHub (spec refonte §5, maquette C01)', () => {
  it('en-tête : initiale, pseudo, rôle et rang E', async () => {
    await renderHub({ me: makeMe({ role: 'admin' }) });
    const account = screen.getByRole('region', { name: 'Ton compte' });
    expect(within(account).getByText('lea')).toBeTruthy();
    expect(within(account).getByText('Admin')).toBeTruthy();
    expect(within(account).getByRole('img', { name: 'Rang E' })).toBeTruthy();
  });

  it('membre : rôle « Membre »', async () => {
    await renderHub();
    expect(within(screen.getByRole('region', { name: 'Ton compte' })).getByText('Membre')).toBeTruthy();
  });

  it('groupes et lignes : Entraînement, Compte et appli, chacun vers sa page', async () => {
    await renderHub();
    expect(groupTitles()).toEqual(['Entraînement', 'Compte et appli']);
    expect(rowLabels('Entraînement')).toEqual(['Mon profil', 'Mon coach', 'Mes lieux', 'Santé']);
    expect(rowLabels('Compte et appli')).toEqual(['Confidentialité et données', 'Réglages', 'Aide']);
    const href = (name: string) => link(name).getAttribute('href');
    expect(href('Mon profil')).toBe('/profile/edit');
    expect(href('Mon coach')).toBe('/profile/coach');
    expect(href('Mes lieux')).toBe('/places');
    expect(href('Santé')).toBe('/profile/health');
    expect(href('Confidentialité et données')).toBe('/profile/privacy');
    expect(href('Réglages')).toBe('/settings');
    expect(href('Aide')).toBe('/help');
  });

  it('valeurs des lignes : profil, coach, lieu principal, accord santé et limitations', async () => {
    await renderHub({ me: consented() });
    expect(await rowValue('Mes lieux')).toBe('Basic Fit');
    expect(await rowValue('Mon profil')).toBe('Prendre du muscle · 3 séances de 45 min');
    expect(await rowValue('Mon coach')).toBe('Le Skald · entraînement et nutrition');
    expect(await rowValue('Santé')).toBe('Accord donné · 1 limitation');
    expect(description(link('Confidentialité et données'))).toBe('Accords, export, suppression');
    expect(description(link('Réglages'))).toBe('Apparence, synchronisation');
    expect(description(link('Aide'))).toBe("En cas d'urgence : 15 ou 112");
  });

  it('profil vide (rien répondu, pas de coach) : ni valeur sur « Mon profil » ni sur « Mon coach »', async () => {
    await renderHub({ profile: { coach: null } });
    expect(await rowValue('Mes lieux')).toBe('Basic Fit');
    expect(await rowValue('Santé')).toBe('Accord non donné');
    await settle();
    expect(link('Mon profil').hasAttribute('aria-describedby')).toBe(false);
    expect(link('Mon coach').hasAttribute('aria-describedby')).toBe(false);
  });

  it('objectif seul : « Prendre du muscle », sans disponibilité inventée', async () => {
    await renderHub({ profile: { goal: 'muscle' } });
    expect(await rowValue('Mon profil')).toBe('Prendre du muscle');
  });

  it('accord santé sans limitation : « Accord donné » seul', async () => {
    await renderHub({ me: consented(), limitation: false });
    expect(await rowValue('Santé')).toBe('Accord donné');
  });

  it('sans accord santé : « Accord non donné »', async () => {
    await renderHub();
    await until(() => description(link('Santé')) === 'Accord non donné');
  });

  it('Administration, dans le groupe Cercle, pour un admin seulement', async () => {
    const admin = await renderHub({ me: makeMe({ role: 'admin' }) });
    expect(groupTitles()).toEqual(['Entraînement', 'Compte et appli', 'Cercle']);
    expect(rowLabels('Cercle')).toEqual(['Administration']);
    expect(link('Administration').getAttribute('href')).toBe('/admin/members');
    expect(description(link('Administration'))).toBe('Membres, invitations, salles');
    admin.unmount();
    await renderHub();
    expect(screen.queryByRole('heading', { level: 2, name: 'Cercle' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });

  it('badge sur « Réglages » quand la synchro a des refus, et seulement alors', async () => {
    const sync = createFakeSyncEngine();
    await renderHub({ sync });
    expect(description(link('Réglages'))).toBe('Apparence, synchronisation');
    act(() => sync.set({ rejected: 2 }));
    expect(description(link('Réglages'))).toBe('Apparence, synchronisation 2 refusés');
    act(() => sync.set({ rejected: 1 }));
    expect(description(link('Réglages'))).toBe('Apparence, synchronisation 1 refusé');
    act(() => sync.set({ rejected: 0 }));
    expect(description(link('Réglages'))).toBe('Apparence, synchronisation');
  });

  it('« Se déconnecter » : une seule ligne, à part, après les groupes', async () => {
    await renderHub({ me: makeMe({ role: 'admin' }) });
    const logout = screen.getAllByRole('button', { name: 'Se déconnecter' });
    expect(logout).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Pages du profil' });
    expect(nav.contains(logout[0] as HTMLElement)).toBe(false);
    expect(
      nav.compareDocumentPosition(logout[0] as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeNull();
  });
});

describe('ProfileHub › déconnexion (spec refonte §10.4, maquette C06)', () => {
  const logoutApi = () =>
    createFakeApi()
      .on('POST', '/api/auth/logout', { status: 204 })
      .on('POST', '/api/auth/logout-all', { status: 204 });
  const logoutCalls = (api: FakeApi) =>
    api.calls.filter((c) => c.path.startsWith('/api/auth/logout')).map((c) => c.path);

  it('la feuille propose « Cet appareil » (choisi) et « Tous mes appareils »', async () => {
    await renderHub({ api: logoutApi() });
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Se déconnecter' }));
    const current = sheet.getByRole('radio', { name: 'Cet appareil' }) as HTMLInputElement;
    const all = sheet.getByRole('radio', { name: 'Tous mes appareils' }) as HTMLInputElement;
    expect(current.checked).toBe(true);
    expect(all.checked).toBe(false);
    expect(description(current)).toBe(
      'Les données de cet appareil seront effacées. Tu les retrouveras en te reconnectant.',
    );
    expect(description(all)).toBe(
      'Toutes tes sessions seront fermées, sur tous tes appareils, y compris celui-ci.',
    );
  });

  it('« Cet appareil » puis « Se déconnecter » → POST /api/auth/logout, écran de connexion', async () => {
    const api = logoutApi();
    await renderHub({ api });
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Se déconnecter' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
    expect(logoutCalls(api)).toEqual(['/api/auth/logout']);
  });

  it('« Tous mes appareils » puis « Déconnecter tous les appareils » → POST /api/auth/logout-all', async () => {
    const api = logoutApi();
    await renderHub({ api });
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Se déconnecter' }));
    fireEvent.click(sheet.getByRole('radio', { name: 'Tous mes appareils' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Déconnecter tous les appareils' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
    expect(logoutCalls(api)).toEqual(['/api/auth/logout-all']);
  });

  it("données non envoyées : l'avertissement reste, avec l'export, et « Se déconnecter quand même »", async () => {
    const api = logoutApi();
    await renderHub({ api, pending: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Se déconnecter' });
    const sheet = within(dialog);
    expect(dialog.textContent).toContain('Données non envoyées');
    expect(dialog.textContent).toContain(pendingWarning(2, 'lea'));
    expect(sheet.getByRole('link', { name: 'Exporter mes données' }).getAttribute('href')).toBe(
      '/profile/privacy',
    );
    fireEvent.click(sheet.getByRole('radio', { name: 'Tous mes appareils' }));
    expect(dialog.textContent).toContain(pendingWarning(2, 'lea'));
    fireEvent.click(sheet.getByRole('button', { name: 'Se déconnecter quand même' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
    expect(logoutCalls(api)).toEqual(['/api/auth/logout-all']);
  });

  it('« Annuler » : rien envoyé, le focus revient à « Se déconnecter »', async () => {
    const api = logoutApi();
    await renderHub({ api });
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Se déconnecter' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Annuler' }));
    await until(() => screen.queryByRole('dialog') === null);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(logoutCalls(api)).toEqual([]);
  });
});

describe('routes de l’espace Profil', () => {
  it('/profile/edit : Mon profil, avec Retour vers le hub', async () => {
    await renderApp({ path: '/profile/edit' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon profil' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/profile');
  });

  it('/profile/coach : Mon coach, avec Retour vers le hub', async () => {
    const db = createTestLocalDb();
    await seedProfile(db);
    await renderApp({ path: '/profile/coach', db });
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon coach' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/profile');
  });

  it('les adresses existantes restent : Santé, Confidentialité, Réglages', async () => {
    const health = await renderApp({ path: '/profile/health' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Santé' })).toBeTruthy();
    health.unmount();
    const privacy = await renderApp({ path: '/profile/privacy' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Confidentialité' })).toBeTruthy();
    privacy.unmount();
    await renderApp({ path: '/settings' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Réglages' })).toBeTruthy();
  });

  it('mot de passe à changer : /profile mène à Mon profil, seule page servie', async () => {
    const forced = makeMe({ role: 'admin', mustChangePassword: true });
    const { location } = await renderApp({ path: '/profile', me: forced });
    await until(() => location() === '/profile/edit');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon profil' })).toBeTruthy();
  });
});
