import type { MemberSummary } from '@appsport/contracts';
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
const LINK = `https://appsport.example/reset#${CODE}`;

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

async function renderMembers(o: { api?: FakeApi; members?: MemberSummary[] } = {}) {
  const api = o.api ?? createFakeApi();
  api.on('GET', '/api/admin/members', { status: 200, body: o.members ?? [BASTIEN, LEA] });
  const rendered = await renderWithServices(<MembersPage />, { api, me: ADMIN });
  await screen.findByRole('row', { name: 'lea' });
  return rendered;
}

const row = (name: string) => within(screen.getByRole('row', { name }));
const dialog = () => within(screen.getByRole('dialog'));
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);
const memberLoads = (api: FakeApi) => sent(api, 'GET', '/api/admin/members').length;

/** Ouvre l'action `action` sur la ligne de `username`. */
function open(username: string, action: string) {
  fireEvent.click(row(username).getByRole('button', { name: action }));
  return dialog();
}

function confirmButton(name: string): HTMLButtonElement {
  return dialog().getByRole('button', { name }) as HTMLButtonElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MembersPage : tableau des membres (02 §6, P-ADM-1)', () => {
  it('une ligne par membre, nommée par le pseudo : rôle, statut, mineur, connexion, onboarding, accords', async () => {
    await renderMembers();
    expect(screen.getByRole('heading', { level: 1, name: 'Membres' })).toBeTruthy();
    const lea = screen.getByRole('row', { name: 'lea' });
    expect(within(lea).getByRole('rowheader').textContent).toContain('lea');
    expect(within(lea).getByText('mineur')).toBeTruthy();
    // Rôle, statut, dernière connexion, onboarding, accord santé, accord coach, puis les actions :
    // aucune autre donnée de la personne (C1 à C3).
    const cells = within(lea)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells.slice(0, -1)).toEqual([
      'membre',
      'actif',
      'Jamais connecté',
      'Onboarding en cours',
      'oui',
      'non',
    ]);
    const bastien = within(screen.getByRole('row', { name: 'bastien' }))
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(bastien.slice(0, -1)).toEqual([
      'admin',
      'actif',
      '06/10/2026 à 10:30',
      'Onboarding terminé',
      'non',
      'oui',
    ]);
    expect(row('bastien').queryByText('mineur')).toBeNull();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Pseudo',
      'Rôle',
      'Statut',
      'Dernière connexion',
      'Onboarding',
      'Accord santé',
      'Accord coach',
      'Actions',
    ]);
  });

  it('membre désactivé : statut « désactivé », « Réactiver » au lieu de « Désactiver »', async () => {
    await renderMembers({ members: [BASTIEN, { ...LEA, status: 'disabled' }] });
    expect(row('lea').getByText('désactivé')).toBeTruthy();
    expect(row('lea').queryByRole('button', { name: 'Désactiver' })).toBeNull();
    expect(row('lea').getByRole('button', { name: 'Réactiver' })).toBeTruthy();
    expect(row('lea').getByRole('button', { name: 'Promouvoir administrateur' })).toBeTruthy();
    expect(row('bastien').getByRole('button', { name: 'Rétrograder' })).toBeTruthy();
  });

  it('liste illisible hors ligne : « Nécessite le réseau » puis « Réessayer »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<MembersPage />, { api, me: ADMIN });
    expect(await screen.findByText('Nécessite le réseau')).toBeTruthy();
    api.setOffline(false);
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN, LEA] });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('row', { name: 'lea' })).toBeTruthy();
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

  it('routes admin et navigation Membres · Invitations · Salles · État du serveur', async () => {
    const api = createFakeApi()
      .on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] })
      .on('GET', '/api/admin/invitations', { status: 200, body: [] })
      .on('GET', '/api/gyms', { status: 200, body: [] })
      .on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'dev', opsStatus: null } });
    await renderApp({ path: '/admin/members', me: ADMIN, api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Membres' })).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: 'Administration' }));
    const links = nav.getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Membres', '/admin/members'],
      ['Invitations', '/admin/invitations'],
      ['Salles', '/admin/gyms'],
      ['État du serveur', '/admin/health'],
    ]);
    expect(nav.getByRole('link', { name: 'Membres' }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('link', { name: 'Salles' }).getAttribute('aria-current')).toBeNull();
    for (const [name, title] of [
      ['Invitations', 'Invitations'],
      ['Salles', 'Salles'],
      ['État du serveur', 'État du serveur'],
    ] as const) {
      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'Administration' })).getByRole('link', { name }),
      );
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
    }
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

  it('« Désactiver » → { status: disabled } ; « Réactiver » → { status: active }', async () => {
    let lea = LEA;
    const api = createFakeApi()
      .on('GET', '/api/admin/members', () => ({ status: 200, body: [BASTIEN, lea] }))
      .on('POST', '/api/admin/members/:id/status', (req) => {
        lea = { ...lea, status: (req.body as { status: MemberSummary['status'] }).status };
        return { status: 204 };
      });
    await renderWithServices(<MembersPage />, { api, me: ADMIN });
    await screen.findByRole('row', { name: 'lea' });
    open('lea', 'Désactiver');
    fireEvent.click(confirmButton('Désactiver'));
    expect(await row('lea').findByRole('button', { name: 'Réactiver' })).toBeTruthy();
    expect(row('lea').getByText('désactivé')).toBeTruthy();
    open('lea', 'Réactiver');
    fireEvent.click(confirmButton('Réactiver'));
    expect(await row('lea').findByRole('button', { name: 'Désactiver' })).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/members/u-2/status')).toEqual([
      { status: 'disabled' },
      { status: 'active' },
    ]);
  });

  it('« Annuler » ferme sans requête et rend le focus au bouton d’origine', async () => {
    const api = createFakeApi();
    await renderMembers({ api });
    const trigger = row('lea').getByRole('button', { name: 'Désactiver' });
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

  it('se rétrograder soi-même (un autre admin reste) : profil relu, « Page introuvable », plus de tableau', async () => {
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
    await screen.findByRole('row', { name: 'bastien' });
    open('bastien', 'Rétrograder');
    fill('Ton mot de passe', PASSWORD);
    fireEvent.click(confirmButton('Rétrograder'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText("Cette action n'est pas autorisée.")).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
    expect(sent(api, 'POST', '/api/admin/members/u-1/role')).toEqual([
      { role: 'member', password: PASSWORD },
    ]);
    // Plus de droits : la liste n'est pas relue (elle serait refusée).
    expect(memberLoads(api)).toBe(1);
  });

  it('droits retirés ailleurs : liste refusée (403) → tableau retiré et profil relu', async () => {
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
    await screen.findByRole('row', { name: 'lea' });
    open('lea', 'Fermer les sessions');
    fireEvent.click(confirmButton('Fermer les sessions'));
    expect(await screen.findByText("Cette action n'est pas autorisée.")).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
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

  it('400 under_min_age → « appsport est réservé aux 16 ans et plus »', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/birth-date', {
      status: 400,
      body: { error: 'under_min_age' },
    });
    await renderMembers({ api });
    open('lea', 'Corriger la date de naissance');
    fill('Date de naissance', '2015-02-01');
    fireEvent.click(confirmButton('Enregistrer'));
    expect(await dialog().findByText('appsport est réservé aux 16 ans et plus')).toBeTruthy();
  });
});

describe('MembersPage : suppression (R-SUP-2, P-AUT-5, P-DRT-3)', () => {
  it('« Supprimer définitivement » désactivé tant que le pseudo ou le mot de passe manquent', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', { status: 204 });
    await renderMembers({ api });
    open('lea', 'Supprimer');
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
    await until(() => screen.queryByRole('row', { name: 'lea' }) === null);
    expect(sent(api, 'POST', '/api/admin/members/u-2/delete')).toEqual([
      { confirmUsername: 'lea', password: PASSWORD },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('après la suppression, le focus passe au tableau (le bouton a disparu avec la ligne)', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', { status: 204 });
    await renderMembers({ api });
    row('lea').getByRole('button', { name: 'Supprimer' }).focus();
    open('lea', 'Supprimer');
    fill('Tape le pseudo pour confirmer', 'LEA ');
    fill('Ton mot de passe', PASSWORD);
    api.on('GET', '/api/admin/members', { status: 200, body: [BASTIEN] });
    fireEvent.click(confirmButton('Supprimer définitivement'));
    await until(() => screen.queryByRole('dialog') === null);
    // Saisie tolérante comme le serveur (casse, espaces autour) ; la saisie part telle quelle, sans les espaces.
    expect(sent(api, 'POST', '/api/admin/members/u-2/delete')).toEqual([
      { confirmUsername: 'LEA', password: PASSWORD },
    ]);
    await until(() => document.activeElement === screen.getByRole('region', { name: 'Membres du cercle' }));
  });

  it('401 invalid_credentials → « Mot de passe incorrect. », dialogue gardé', async () => {
    const api = createFakeApi().on('POST', '/api/admin/members/:id/delete', {
      status: 401,
      body: { error: 'invalid_credentials' },
    });
    await renderMembers({ api });
    open('lea', 'Supprimer');
    fill('Tape le pseudo pour confirmer', 'lea');
    fill('Ton mot de passe', 'faux');
    fireEvent.click(confirmButton('Supprimer définitivement'));
    expect(await dialog().findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(memberLoads(api)).toBe(1);
    expect(screen.getByRole('row', { name: 'lea' })).toBeTruthy();
  });
});
