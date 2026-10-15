import type { MemberSummary } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembersPage } from '../../src/features/admin/MembersPage';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi, type FakeReply } from '../support/fake-api';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const ADMIN = makeMe({ id: 'u-1', username: 'bastien', role: 'admin' });
const PASSWORD = 'mon mot de passe admin';
const CODE = 'ABCD-EFGH-JKMN-PQRS';
const LINK = `https://rune.example/reset#${CODE}`;

/** Connecté à 10:30 (Paris) le jour du test : 3 h 30 avant l'horloge injectée (DEFAULT_NOW, 14:00 à Paris). */
const BASTIEN: MemberSummary = {
  id: 'u-1',
  username: 'bastien',
  role: 'admin',
  status: 'active',
  isMinor: false,
  lastLoginAt: '2026-10-06T08:30:00.000Z',
  onboardingCompleted: true,
  consents: { health: false, aiCoach: true },
  activeSessions: 2,
};
/** Mineure jamais connectée, onboarding en cours, accord santé donné. */
const LEA: MemberSummary = {
  id: 'u-2',
  username: 'lea',
  role: 'member',
  status: 'active',
  isMinor: true,
  lastLoginAt: null,
  onboardingCompleted: false,
  consents: { health: true, aiCoach: false },
  activeSessions: 1,
};

async function renderMembers(o: { api?: FakeApi; members?: MemberSummary[]; now?: number } = {}) {
  const api = o.api ?? createFakeApi();
  api.on('GET', '/api/admin/members', { status: 200, body: o.members ?? [BASTIEN, LEA] });
  const rendered = await renderWithServices(<MembersPage />, {
    api,
    me: ADMIN,
    ...(o.now === undefined ? {} : { now: o.now }),
  });
  await screen.findByRole('article', { name: 'lea' });
  return rendered;
}

const card = (name: string) => within(screen.getByRole('article', { name }));
const dialog = () => within(screen.getByRole('dialog'));
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);
const memberLoads = (api: FakeApi) => sent(api, 'GET', '/api/admin/members').length;
/** Noms des boutons de `root`, dans l'ordre : `aria-label`, sinon l'élément qui le nomme, sinon son texte. */
const buttonNames = (root: HTMLElement) =>
  within(root)
    .getAllByRole('button')
    .map((b) => {
      const labelledBy = b.getAttribute('aria-labelledby');
      return (
        b.getAttribute('aria-label') ??
        (labelledBy ? document.getElementById(labelledBy)?.textContent : b.textContent)
      );
    });

/** Ouvre la feuille « Actions pour <pseudo> » (nommée par le pseudo). */
function openSheet(username: string) {
  fireEvent.click(screen.getByRole('button', { name: `Actions pour ${username}` }));
  return screen.getByRole('dialog', { name: username });
}

/** Choisit `action` dans la feuille de `username` : la feuille se ferme, le dialogue de l'action s'ouvre. */
function open(username: string, action: string) {
  fireEvent.click(within(openSheet(username)).getByRole('button', { name: action }));
  return dialog();
}

function confirmButton(name: string): HTMLButtonElement {
  return dialog().getByRole('button', { name }) as HTMLButtonElement;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('MembersPage : une carte par membre (02 §6, P-ADM-1, spec refonte §10.5)', () => {
  it('une carte (article) par membre, nommée par le pseudo : badges de rôle, de statut et « Mineur », dernière connexion relative, accords et onboarding', async () => {
    await renderMembers();
    expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Membres du cercle' })).toBeTruthy();
    expect(screen.getByText('2 membres')).toBeTruthy();
    expect(
      screen.getAllByRole('article').map((a) => within(a).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['bastien', 'lea']);
    expect(screen.queryByRole('table')).toBeNull();

    const bastien = card('bastien');
    expect(bastien.getByText('Admin')).toBeTruthy();
    expect(bastien.getByText('Actif')).toBeTruthy();
    expect(bastien.queryByText('Mineur')).toBeNull();
    expect(bastien.getByText('Dernière connexion : il y a 3 h')).toBeTruthy();
    expect(bastien.getAllByRole('term').map((t) => t.textContent)).toEqual([
      'Accord santé',
      'Accord coach',
      'Onboarding',
    ]);
    expect(bastien.getAllByRole('definition').map((d) => d.textContent)).toEqual(['Non', 'Oui', 'Terminé']);

    const lea = card('lea');
    expect(lea.queryByText('Admin')).toBeNull();
    expect(lea.getByText('Actif')).toBeTruthy();
    expect(lea.getByText('Mineur')).toBeTruthy();
    expect(lea.getByText('Jamais connecté')).toBeTruthy();
    expect(lea.getAllByRole('definition').map((d) => d.textContent)).toEqual(['Oui', 'Non', 'En cours']);
  });

  it('rien d’autre que ce que renvoie /api/admin : aucune donnée C1 à C3 de la personne sur sa carte', async () => {
    await renderMembers();
    // Initiale de l'avatar (décorative), pseudo, badges, connexion, accords et onboarding : rien de plus.
    expect(screen.getByRole('article', { name: 'lea' }).textContent).toBe(
      'LleaActifMineurJamais connectéAccord santéOuiAccord coachNonOnboardingEn cours',
    );
    expect(screen.getByRole('article', { name: 'bastien' }).textContent).toBe(
      'BbastienAdminActifDernière connexion : il y a 3 hAccord santéNonAccord coachOuiOnboardingTerminé',
    );
  });

  it('dernière connexion relative à l’horloge injectée : « il y a 2 j », « à l’instant »', async () => {
    await renderMembers({
      now: Date.parse('2026-10-08T09:00:00.000Z'),
      members: [BASTIEN, { ...LEA, lastLoginAt: '2026-10-08T08:59:30.000Z' }],
    });
    expect(card('bastien').getByText('Dernière connexion : il y a 2 j')).toBeTruthy();
    expect(card('lea').getByText("Dernière connexion : à l'instant")).toBeTruthy();
  });

  it('membre désactivé : badge « Désactivé », compté dans l’en-tête', async () => {
    await renderMembers({ members: [BASTIEN, { ...LEA, status: 'disabled' }] });
    expect(card('lea').getByText('Désactivé')).toBeTruthy();
    expect(card('lea').queryByText('Actif')).toBeNull();
    expect(screen.getByText('2 membres · 1 désactivé')).toBeTruthy();
  });

  it('« Actions pour lea » : un bouton de 44 px par carte qui annonce une fenêtre', async () => {
    await renderMembers();
    const more = card('lea').getByRole('button', { name: 'Actions pour lea' });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    // Aucune action ne reste sur la carte : tout passe par la feuille.
    expect(buttonNames(screen.getByRole('article', { name: 'lea' }))).toEqual(['Actions pour lea']);
  });

  it('lecture en cours : « Chargement… » annoncé poliment, puis les cartes', async () => {
    const reply = Promise.withResolvers<void>();
    const api = createFakeApi().on('GET', '/api/admin/members', async () => {
      await reply.promise;
      return { status: 200, body: [BASTIEN, LEA] };
    });
    await renderWithServices(<MembersPage />, { api, me: ADMIN });
    expect((await screen.findByText('Chargement…')).getAttribute('role')).toBe('status');
    reply.resolve();
    expect(await screen.findByRole('article', { name: 'lea' })).toBeTruthy();
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('liste illisible hors ligne : « Nécessite le réseau » puis « Réessayer »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<MembersPage />, { api, me: ADMIN });
    expect(await screen.findByText('Nécessite le réseau')).toBeTruthy();
    expect(screen.queryByText('Chargement…')).toBeNull();
    api.setOffline(false);
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN, LEA] });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('article', { name: 'lea' })).toBeTruthy();
    expect(screen.queryByText('Nécessite le réseau')).toBeNull();
  });

  it('un membre sur /admin/members : « Page introuvable », aucune requête /api/admin', async () => {
    const { api } = await renderApp({ path: '/admin/members', me: makeMe({ role: 'member' }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
    await settle();
    expect(api.calls.filter((c) => c.path.startsWith('/api/admin'))).toEqual([]);
  });

  it.each(['/Admin/members', '/ADMIN/health', '/admin/Invitations'])(
    'un membre sur %s (casse différente, que wouter accepte) : « Page introuvable », aucune requête admin',
    async (path) => {
      const { api } = await renderApp({ path, me: makeMe({ role: 'member' }) });
      expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
      await settle();
      expect(api.calls.filter((c) => c.path.toLowerCase().startsWith('/api/admin'))).toEqual([]);
    },
  );

  it('sous-navigation Membres · Invitations · Salles · Serveur ; titre « Administration » et Retour vers le Profil', async () => {
    const api = createFakeApi()
      .on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] })
      .on('GET', '/api/admin/invitations', { status: 200, body: [] })
      .on('GET', '/api/gyms', { status: 200, body: [] })
      .on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'dev', opsStatus: null } });
    await renderApp({ path: '/admin/members', me: ADMIN, api });
    expect(await screen.findByRole('heading', { level: 2, name: 'Membres du cercle' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/profile');
    const nav = () => within(screen.getByRole('navigation', { name: 'Administration' }));
    expect(
      nav()
        .getAllByRole('link')
        .map((l) => [l.textContent, l.getAttribute('href')]),
    ).toEqual([
      ['Membres', '/admin/members'],
      ['Invitations', '/admin/invitations'],
      ['Salles', '/admin/gyms'],
      ['Serveur', '/admin/health'],
    ]);
    expect(nav().getByRole('link', { name: 'Membres' }).getAttribute('aria-current')).toBe('page');
    expect(nav().getByRole('link', { name: 'Salles' }).getAttribute('aria-current')).toBeNull();
    for (const [name, landmark] of [
      ['Invitations', 'Nouvelle invitation'],
      ['Salles', 'Salles'],
      ['Serveur', 'Résumé'],
      ['Membres', 'Membres du cercle'],
    ] as const) {
      fireEvent.click(nav().getByRole('link', { name }));
      expect(await screen.findByRole('region', { name: landmark })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeTruthy();
      const current = nav()
        .getAllByRole('link')
        .filter((l) => l.getAttribute('aria-current') === 'page')
        .map((l) => l.textContent);
      expect(current).toEqual([name]);
    }
  });
});

describe('MembersPage : feuille des actions (spec refonte §10.5)', () => {
  it('« Actions pour lea » ouvre une feuille nommée par le pseudo : résumé, actions, puis « Actions sensibles » en dernier', async () => {
    await renderMembers();
    const sheet = openSheet('lea');
    expect(within(sheet).getByText('Membre · Actif · 1 session ouverte')).toBeTruthy();
    expect(buttonNames(sheet)).toEqual([
      'Fermer',
      'Lien de réinitialisation',
      'Fermer les sessions',
      'Promouvoir administrateur',
      'Corriger la date de naissance',
      'Désactiver',
      'Supprimer le compte',
    ]);
    const sensitive = within(sheet).getByRole('region', { name: 'Actions sensibles' });
    expect(buttonNames(sensitive)).toEqual(['Désactiver', 'Supprimer le compte']);
    // Le groupe sensible ferme la feuille : rien ne le suit, pas même une barre d'actions.
    expect(sensitive.nextElementSibling).toBeNull();
    expect(sensitive.parentElement?.nextElementSibling ?? null).toBeNull();
    expect(
      within(sensitive).getByRole('button', { name: 'Désactiver' }).getAttribute('aria-describedby'),
    ).toBe(within(sensitive).getByText('Plus de connexion, données conservées').id);
    expect(
      within(sensitive).getByRole('button', { name: 'Supprimer le compte' }).getAttribute('aria-describedby'),
    ).toBe(within(sensitive).getByText('Définitif, seulement à sa demande').id);
  });

  it('administrateur avec deux sessions : « Rétrograder », résumé au pluriel', async () => {
    await renderMembers();
    const sheet = openSheet('bastien');
    expect(within(sheet).getByText('Admin · Actif · 2 sessions ouvertes')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Rétrograder' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Promouvoir administrateur' })).toBeNull();
  });

  it('membre désactivé : il garde « Réactiver » ; « Désactiver » disparaît des actions sensibles', async () => {
    await renderMembers({ members: [BASTIEN, { ...LEA, status: 'disabled', activeSessions: 0 }] });
    const sheet = openSheet('lea');
    expect(within(sheet).getByText('Membre · Désactivé · aucune session ouverte')).toBeTruthy();
    expect(buttonNames(sheet)).toEqual([
      'Fermer',
      'Réactiver',
      'Lien de réinitialisation',
      'Fermer les sessions',
      'Promouvoir administrateur',
      'Corriger la date de naissance',
      'Supprimer le compte',
    ]);
    const sensitive = within(sheet).getByRole('region', { name: 'Actions sensibles' });
    expect(buttonNames(sensitive)).toEqual(['Supprimer le compte']);
  });

  it('« Fermer » et Échap ferment la feuille sans requête ; le focus revient à « Actions pour lea »', async () => {
    const api = createFakeApi();
    await renderMembers({ api });
    const trigger = screen.getByRole('button', { name: 'Actions pour lea' });
    trigger.focus();
    openSheet('lea');
    fireEvent.click(dialog().getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await until(() => document.activeElement === trigger);
    openSheet('lea');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await until(() => document.activeElement === trigger);
    expect(api.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  it('choisir une action ferme la feuille et ouvre sa confirmation, seule à l’écran', async () => {
    await renderMembers();
    open('lea', 'Désactiver');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Désactiver lea' })).toBeTruthy();
  });
});

describe('MembersPage : lien de réinitialisation (R-RST-1 à R-RST-4)', () => {
  it('« Générer » : lien et code affichés une fois, « Copier », puis effacés après « J’ai transmis le lien »', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', {
      status: 200,
      body: { code: CODE, link: LINK, expiresAt: '2026-10-07T12:00:00.000Z' },
    });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await renderMembers({ api });
    const d = open('lea', 'Lien de réinitialisation');
    expect(screen.getByRole('dialog', { name: 'Générer un lien de réinitialisation' })).toBeTruthy();
    fireEvent.click(d.getByRole('button', { name: 'Générer' }));
    expect(await dialog().findByText(CODE)).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/members/u-2/reset-link')).toEqual([{}]);
    expect(dialog().getByText(LINK)).toBeTruthy();
    expect(dialog().getByText('Ce code ne sera plus affiché.')).toBeTruthy();
    expect(dialog().getByText("Valable jusqu'au 07/10/2026 à 14:00.")).toBeTruthy();
    fireEvent.click(dialog().getByRole('button', { name: 'Copier' }));
    await until(() => writeText.mock.calls.length === 1);
    expect(writeText).toHaveBeenCalledWith(LINK);
    await until(() => memberLoads(api) === 2);
    fireEvent.click(dialog().getByRole('button', { name: "J'ai transmis le lien" }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(CODE)).toBeNull();
    expect(screen.queryByText(LINK)).toBeNull();
    // Rouvert : rien de l'ancien lien, il faut en générer un nouveau.
    open('lea', 'Lien de réinitialisation');
    expect(dialog().queryByText(CODE)).toBeNull();
    expect(dialog().getByRole('button', { name: 'Générer' })).toBeTruthy();
  });

  it.each(['refusé', 'absent'] as const)(
    'presse-papiers %s : « Copie impossible », consigne de sélection ; lien et code restent affichés',
    async (mode) => {
      if (mode === 'absent')
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      else
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
          new DOMException('refusé', 'NotAllowedError'),
        );
      const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', {
        status: 200,
        body: { code: CODE, link: LINK, expiresAt: '2026-10-07T12:00:00.000Z' },
      });
      await renderMembers({ api });
      fireEvent.click(open('lea', 'Lien de réinitialisation').getByRole('button', { name: 'Générer' }));
      await dialog().findByText(CODE);
      fireEvent.click(dialog().getByRole('button', { name: 'Copier' }));
      expect(await dialog().findByRole('button', { name: 'Copie impossible' })).toBeTruthy();
      expect((await dialog().findByRole('alert')).textContent).toBe(
        'Copie impossible : sélectionne le lien et copie-le.',
      );
      expect(dialog().getByText(LINK)).toBeTruthy();
      expect(dialog().getByText(CODE)).toBeTruthy();
    },
  );

  it('lien et code ni gardés ni journalisés : rien en stockage du navigateur, en base locale ni en console', async () => {
    localStorage.clear();
    sessionStorage.clear();
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', {
      status: 200,
      body: { code: CODE, link: LINK, expiresAt: '2026-10-07T12:00:00.000Z' },
    });
    const { db } = await renderMembers({ api });
    fireEvent.click(open('lea', 'Lien de réinitialisation').getByRole('button', { name: 'Générer' }));
    await dialog().findByText(CODE);
    await until(() => memberLoads(api) === 2);
    fireEvent.click(dialog().getByRole('button', { name: "J'ai transmis le lien" }));
    expect(screen.queryByText(CODE)).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())))).not.toContain(CODE);
    expect(logs.flatMap((spy) => spy.mock.calls.flat().map(String)).join(' ')).not.toContain(CODE);
  });

  it('Échap après la génération efface aussi le code', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', {
      status: 200,
      body: { code: CODE, link: LINK, expiresAt: '2026-10-07T12:00:00.000Z' },
    });
    await renderMembers({ api });
    fireEvent.click(open('lea', 'Lien de réinitialisation').getByRole('button', { name: 'Générer' }));
    await dialog().findByText(CODE);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(CODE)).toBeNull();
  });

  it('double clic sur « Générer » : une seule requête, rien ne ferme pendant l’envoi', async () => {
    const reply = Promise.withResolvers<void>();
    const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', async () => {
      await reply.promise;
      return { status: 200, body: { code: CODE, link: LINK, expiresAt: '2026-10-07T12:00:00.000Z' } };
    });
    await renderMembers({ api });
    open('lea', 'Lien de réinitialisation');
    fireEvent.click(confirmButton('Générer'));
    fireEvent.click(confirmButton('Générer'));
    await until(() => sent(api, 'POST', '/api/admin/members/u-2/reset-link').length > 0);
    await settle();
    expect(sent(api, 'POST', '/api/admin/members/u-2/reset-link')).toHaveLength(1);
    expect(confirmButton('Générer').disabled).toBe(true);
    expect(confirmButton('Annuler').disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    reply.resolve();
    expect(await dialog().findByText(CODE)).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/members/u-2/reset-link')).toHaveLength(1);
  });

  it('403 reset_self_forbidden : commande admin:reset indiquée', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', {
      status: 403,
      body: { error: 'reset_self_forbidden' },
    });
    await renderMembers({ api });
    fireEvent.click(open('bastien', 'Lien de réinitialisation').getByRole('button', { name: 'Générer' }));
    expect(
      await dialog().findByText('Pour toi-même, utilise la commande admin:reset sur le serveur.'),
    ).toBeTruthy();
    expect(memberLoads(api)).toBe(1);
  });

  it('hors ligne : « Nécessite le réseau », rien n’est affiché', async () => {
    const api = createFakeApi();
    await renderMembers({ api });
    api.setOffline('reject');
    fireEvent.click(open('lea', 'Lien de réinitialisation').getByRole('button', { name: 'Générer' }));
    expect(await dialog().findByText('Nécessite le réseau')).toBeTruthy();
    expect(dialog().queryByText('Ce code ne sera plus affiché.')).toBeNull();
  });
});

describe('MembersPage : membre changé entre-temps (02 §6)', () => {
  it.each([
    [
      'Fermer les sessions',
      404,
      'not_found',
      'Fermer les sessions',
      'revoke-sessions',
      'Élément introuvable.',
    ],
    [
      'Supprimer le compte',
      400,
      'validation',
      'Supprimer définitivement',
      'delete',
      'Certaines valeurs ne sont pas valides.',
    ],
  ] as const)(
    '« %s » refusé (%i %s) : message gardé dans le dialogue, liste relue',
    async (action, status, code, confirm, route, message) => {
      const api = createFakeApi().on('POST', `/api/admin/members/:id/${route}`, {
        status,
        body: { error: code },
      });
      await renderMembers({ api });
      // Supprimée ou renommée ailleurs : la liste relue ne contient plus « lea ».
      api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN, { ...LEA, username: 'lea2' }] });
      open('lea', action);
      if (route === 'delete') {
        fill('Tape le pseudo pour confirmer', 'lea');
        fill('Ton mot de passe', PASSWORD);
      }
      fireEvent.click(confirmButton(confirm));
      expect(await dialog().findByText(message)).toBeTruthy();
      expect(await screen.findByRole('article', { name: 'lea2' })).toBeTruthy();
      expect(memberLoads(api)).toBe(2);
      expect(screen.getByRole('dialog')).toBeTruthy();
    },
  );

  it('lien de réinitialisation, membre supprimé entre-temps (404) : liste relue', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/reset-link', {
      status: 404,
      body: { error: 'not_found' },
    });
    await renderMembers({ api });
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] });
    fireEvent.click(open('lea', 'Lien de réinitialisation').getByRole('button', { name: 'Générer' }));
    expect(await dialog().findByText('Élément introuvable.')).toBeTruthy();
    await until(() => screen.queryByRole('article', { name: 'lea' }) === null);
    expect(memberLoads(api)).toBe(2);
  });

  it('autre refus (409 last_admin) : la liste n’est pas relue', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/status', {
      status: 409,
      body: { error: 'last_admin' },
    });
    await renderMembers({ api });
    open('bastien', 'Désactiver');
    fireEvent.click(confirmButton('Désactiver'));
    expect(await dialog().findByText('Il doit rester au moins un administrateur actif.')).toBeTruthy();
    await settle();
    expect(memberLoads(api)).toBe(1);
  });
});

describe('MembersPage : sessions et statut (R-AUTH-7, R-ADM-1, R-ROLE-2)', () => {
  it('« Fermer les sessions » → POST revoke-sessions {} puis liste rechargée', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/revoke-sessions', { status: 204 });
    await renderMembers({ api });
    const d = open('lea', 'Fermer les sessions');
    expect(d.getByText(/1 session ouverte/)).toBeTruthy();
    fireEvent.click(confirmButton('Fermer les sessions'));
    await until(() => screen.queryByRole('dialog') === null);
    expect(memberLoads(api)).toBe(2);
    expect(sent(api, 'POST', '/api/admin/members/u-2/revoke-sessions')).toEqual([{}]);
  });

  it('« Désactiver » → { status: disabled } ; le membre désactivé garde « Réactiver » → { status: active }', async () => {
    let lea = LEA;
    const api = createFakeApi()
      .on('GET', '/api/admin/members', () => ({ status: 200, body: [BASTIEN, lea] }))
      .on('POST', '/api/admin/members/:id/status', (req) => {
        lea = { ...lea, status: (req.body as { status: MemberSummary['status'] }).status };
        return { status: 204 };
      });
    await renderWithServices(<MembersPage />, { api, me: ADMIN });
    await screen.findByRole('article', { name: 'lea' });
    open('lea', 'Désactiver');
    fireEvent.click(confirmButton('Désactiver'));
    expect(await card('lea').findByText('Désactivé')).toBeTruthy();
    await until(() => screen.queryByRole('dialog') === null);
    open('lea', 'Réactiver');
    fireEvent.click(confirmButton('Réactiver'));
    expect(await card('lea').findByText('Actif')).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/members/u-2/status')).toEqual([
      { status: 'disabled' },
      { status: 'active' },
    ]);
  });

  it('« Annuler » ferme sans requête et rend le focus à « Actions pour lea »', async () => {
    const api = createFakeApi();
    await renderMembers({ api });
    const trigger = screen.getByRole('button', { name: 'Actions pour lea' });
    trigger.focus();
    open('lea', 'Désactiver');
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.click(confirmButton('Annuler'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    await until(() => document.activeElement === trigger);
  });
});

describe('MembersPage : rôle (R-ROLE-2, P-AUT-5)', () => {
  it('même action ouverte sur un autre membre : dialogue neuf, mot de passe saisi oublié', async () => {
    await renderMembers();
    open('lea', 'Promouvoir administrateur');
    fill('Ton mot de passe', PASSWORD);
    // Le fond reste dans le DOM : un clic (ou un clavier sorti du dialogue) ouvre l'action d'un autre.
    open('bastien', 'Rétrograder');
    expect(screen.getByRole('dialog', { name: 'Rétrograder bastien' })).toBeTruthy();
    expect((dialog().getByLabelText('Ton mot de passe') as HTMLInputElement).value).toBe('');
    expect(confirmButton('Rétrograder').disabled).toBe(true);
  });

  it('« Promouvoir administrateur » exige « Ton mot de passe » → POST role { role, password }', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/role', { status: 204 });
    await renderMembers({ api });
    open('lea', 'Promouvoir administrateur');
    expect(confirmButton('Promouvoir administrateur').disabled).toBe(true);
    fill('Ton mot de passe', PASSWORD);
    expect(confirmButton('Promouvoir administrateur').disabled).toBe(false);
    fireEvent.click(confirmButton('Promouvoir administrateur'));
    await until(() => screen.queryByRole('dialog') === null);
    expect(memberLoads(api)).toBe(2);
    expect(sent(api, 'POST', '/api/admin/members/u-2/role')).toEqual([{ role: 'admin', password: PASSWORD }]);
  });

  it('« Rétrograder » le dernier admin : 409 last_admin → message, dialogue gardé', async () => {
    const reply: FakeReply = { status: 409, body: { error: 'last_admin' } };
    const api = createFakeApi().on('POST', '/api/admin/members/:id/role', reply);
    await renderMembers({ api });
    open('bastien', 'Rétrograder');
    fill('Ton mot de passe', PASSWORD);
    fireEvent.click(confirmButton('Rétrograder'));
    expect(await dialog().findByText('Il doit rester au moins un administrateur actif.')).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/members/u-1/role')).toEqual([
      { role: 'member', password: PASSWORD },
    ]);
    expect(memberLoads(api)).toBe(1);
  });

  it('se rétrograder soi-même (un autre admin reste) : profil relu, « Page introuvable », plus de cartes', async () => {
    let role: 'admin' | 'member' = 'admin';
    const api = createFakeApi()
      .on('GET', '/api/me', () => ({ status: 200, body: { ...ADMIN, role } }))
      .on('GET', '/api/admin/members', () =>
        role === 'admin'
          ? { status: 200, body: [BASTIEN, { ...LEA, role: 'admin' }] }
          : { status: 403, body: { error: 'forbidden' } },
      )
      .on('POST', '/api/admin/members/:id/role', () => {
        role = 'member';
        return { status: 204 };
      });
    await renderApp({ path: '/admin/members', me: ADMIN, api });
    await screen.findByRole('article', { name: 'bastien' });
    open('bastien', 'Rétrograder');
    fill('Ton mot de passe', PASSWORD);
    fireEvent.click(confirmButton('Rétrograder'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText("Cette action n'est pas autorisée.")).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
    expect(sent(api, 'POST', '/api/admin/members/u-1/role')).toEqual([
      { role: 'member', password: PASSWORD },
    ]);
    // Plus de droits : la liste n'est pas relue (elle serait refusée).
    expect(memberLoads(api)).toBe(1);
  });

  it('droits retirés ailleurs : liste refusée (403) → cartes retirées et profil relu', async () => {
    let forbidden = false;
    const api = createFakeApi()
      .on('GET', '/api/admin/members', () =>
        forbidden ? { status: 403, body: { error: 'forbidden' } } : { status: 200, body: [BASTIEN, LEA] },
      )
      .on('POST', '/api/admin/members/:id/revoke-sessions', () => {
        // Un autre admin vient de rétrograder bastien.
        forbidden = true;
        return { status: 204 };
      });
    await renderWithServices(<MembersPage />, { api, me: ADMIN });
    await screen.findByRole('article', { name: 'lea' });
    open('lea', 'Fermer les sessions');
    fireEvent.click(confirmButton('Fermer les sessions'));
    expect(await screen.findByText("Cette action n'est pas autorisée.")).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
    await until(() => api.calls.some((c) => c.method === 'GET' && c.path === '/api/me'));
  });

  it('401 invalid_credentials → « Mot de passe incorrect. » ; 429 rate_limited → attente en minutes', async () => {
    let reply: FakeReply = { status: 401, body: { error: 'invalid_credentials' } };
    const api = createFakeApi().on('POST', '/api/admin/members/:id/role', () => reply);
    await renderMembers({ api });
    open('lea', 'Promouvoir administrateur');
    fill('Ton mot de passe', 'faux');
    fireEvent.click(confirmButton('Promouvoir administrateur'));
    expect(await dialog().findByText('Mot de passe incorrect.')).toBeTruthy();
    reply = { status: 429, body: { error: 'rate_limited', retryAfterS: 90 } };
    fireEvent.click(confirmButton('Promouvoir administrateur'));
    expect(await dialog().findByText('Trop de tentatives. Réessaie dans 2 min.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('MembersPage : date de naissance (R-AGE-4)', () => {
  it('« Corriger la date de naissance » → POST birth-date { birthDate }', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/birth-date', { status: 204 });
    await renderMembers({ api });
    open('lea', 'Corriger la date de naissance');
    expect(confirmButton('Enregistrer').disabled).toBe(true);
    fill('Date de naissance', '2009-02-01');
    fireEvent.click(confirmButton('Enregistrer'));
    await until(() => screen.queryByRole('dialog') === null);
    expect(memberLoads(api)).toBe(2);
    expect(sent(api, 'POST', '/api/admin/members/u-2/birth-date')).toEqual([{ birthDate: '2009-02-01' }]);
  });

  it('400 under_min_age → « Rune est réservé aux 16 ans et plus »', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/birth-date', {
      status: 400,
      body: { error: 'under_min_age' },
    });
    await renderMembers({ api });
    open('lea', 'Corriger la date de naissance');
    fill('Date de naissance', '2015-02-01');
    fireEvent.click(confirmButton('Enregistrer'));
    expect(await dialog().findByText('Rune est réservé aux 16 ans et plus')).toBeTruthy();
  });
});

describe('MembersPage : suppression (R-SUP-2, P-AUT-5, P-DRT-3)', () => {
  it('« Supprimer définitivement » désactivé tant que le pseudo ou le mot de passe manquent', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', { status: 204 });
    await renderMembers({ api });
    open('lea', 'Supprimer le compte');
    expect(screen.getByRole('dialog', { name: 'Supprimer le compte de lea' })).toBeTruthy();
    const confirm = () => confirmButton('Supprimer définitivement');
    expect(confirm().disabled).toBe(true);
    fill('Tape le pseudo pour confirmer', 'le');
    fill('Ton mot de passe', PASSWORD);
    expect(confirm().disabled).toBe(true);
    fill('Tape le pseudo pour confirmer', 'lea');
    fill('Ton mot de passe', '');
    expect(confirm().disabled).toBe(true);
    fill('Ton mot de passe', PASSWORD);
    expect(confirm().disabled).toBe(false);
    // La liste relue ne contient plus lea.
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] });
    fireEvent.click(confirm());
    await until(() => screen.queryByRole('article', { name: 'lea' }) === null);
    expect(sent(api, 'POST', '/api/admin/members/u-2/delete')).toEqual([
      { confirmUsername: 'lea', password: PASSWORD },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('1 membre')).toBeTruthy();
  });

  it('après la suppression, le focus passe au titre « Membres du cercle » (la carte et son bouton ont disparu)', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', { status: 204 });
    await renderMembers({ api });
    screen.getByRole('button', { name: 'Actions pour lea' }).focus();
    open('lea', 'Supprimer le compte');
    fill('Tape le pseudo pour confirmer', 'LEA ');
    fill('Ton mot de passe', PASSWORD);
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] });
    fireEvent.click(confirmButton('Supprimer définitivement'));
    await until(() => screen.queryByRole('dialog') === null);
    // Saisie tolérante comme le serveur (casse, espaces autour) ; la saisie part telle quelle, sans les espaces.
    expect(sent(api, 'POST', '/api/admin/members/u-2/delete')).toEqual([
      { confirmUsername: 'LEA', password: PASSWORD },
    ]);
    await until(
      () => document.activeElement === screen.getByRole('heading', { level: 2, name: 'Membres du cercle' }),
    );
  });

  it('401 invalid_credentials → « Mot de passe incorrect. », dialogue gardé', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', {
      status: 401,
      body: { error: 'invalid_credentials' },
    });
    await renderMembers({ api });
    open('lea', 'Supprimer le compte');
    fill('Tape le pseudo pour confirmer', 'lea');
    fill('Ton mot de passe', 'faux');
    fireEvent.click(confirmButton('Supprimer définitivement'));
    expect(await dialog().findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(memberLoads(api)).toBe(1);
    expect(screen.getByRole('article', { name: 'lea' })).toBeTruthy();
  });

  it('envoi en cours : un second envoi ne part pas, boutons désactivés, Échap ne ferme pas ; la réponse ferme', async () => {
    const reply = Promise.withResolvers<void>();
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', async () => {
      await reply.promise;
      return { status: 204 };
    });
    await renderMembers({ api });
    open('lea', 'Supprimer le compte');
    fill('Tape le pseudo pour confirmer', 'lea');
    fill('Ton mot de passe', PASSWORD);
    // Deux envois du formulaire (Entrée deux fois, double clic) : le bouton désactivé n'y suffit pas.
    const form = screen.getByRole('dialog').querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await until(() => sent(api, 'POST', '/api/admin/members/u-2/delete').length > 0);
    await settle();
    expect(sent(api, 'POST', '/api/admin/members/u-2/delete')).toHaveLength(1);
    expect(confirmButton('Supprimer définitivement').disabled).toBe(true);
    expect(confirmButton('Annuler').disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] });
    reply.resolve();
    await until(() => screen.queryByRole('dialog') === null);
    expect(sent(api, 'POST', '/api/admin/members/u-2/delete')).toHaveLength(1);
    expect(screen.queryByRole('article', { name: 'lea' })).toBeNull();
  });
});
