import { INVITATION_NOTE_MAX, type InvitationSummary } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvitationsPage } from '../../src/features/admin/InvitationsPage';
import { buildInvitationShareMessage } from '../../src/features/admin/share-message';
import uiStyles from '../../src/ui/ui.module.css';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const ADMIN = makeMe({ id: 'u-1', username: 'bastien', role: 'admin' });
const CODE = 'ABCD-EFGH-JKMN-PQRS';

const invitation = (o: Partial<InvitationSummary> & { id: string }): InvitationSummary => ({
  note: null,
  createdAt: '2026-10-06T10:00:00.000Z',
  expiresAt: '2026-10-13T10:00:00.000Z',
  state: 'pending',
  usedByUsername: null,
  ...o,
});

const LIST: InvitationSummary[] = [
  invitation({ id: 'i-1', note: 'pour Léa' }),
  invitation({ id: 'i-2', note: 'pour Max', state: 'used', usedByUsername: 'lea' }),
  invitation({ id: 'i-3', state: 'revoked' }),
  invitation({ id: 'i-4', state: 'expired', createdAt: '2026-09-20T10:00:00.000Z' }),
  invitation({ id: 'i-5', state: 'used' }),
];

async function renderInvitations(o: { api?: FakeApi; list?: InvitationSummary[] } = {}) {
  const api = o.api ?? createFakeApi();
  api.on('GET', '/api/admin/invitations', { status: 200, body: o.list ?? LIST });
  const rendered = await renderWithServices(<InvitationsPage />, { api, me: ADMIN });
  await screen.findByRole('list', { name: 'Invitations envoyées' });
  return rendered;
}

const items = () =>
  within(screen.getByRole('list', { name: 'Invitations envoyées' })).getAllByRole('listitem');
const item = (i: number) => {
  const li = items()[i];
  if (!li) throw new Error(`invitation ${i} absente`);
  return within(li);
};
const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);
const loads = (api: FakeApi) => sent(api, 'GET', '/api/admin/invitations').length;
/** Description d'un élément : les textes visés par `aria-describedby`, dans l'ordre, séparés par « · ». */
const description = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `(${id} absent)`)
    .join(' · ');

function createdApi(): { api: FakeApi; link: string } {
  const link = `${window.location.origin}/invite#${CODE}`;
  const api = createFakeApi().on('POST', '/api/admin/invitations', {
    status: 201,
    body: { invitation: invitation({ id: 'i-9', note: 'pour Léa' }), code: CODE, link },
  });
  return { api, link };
}

function create(birthDate: string, note?: string) {
  fill('Date de naissance', birthDate);
  if (note !== undefined) fill('Note (facultative)', note);
  fireEvent.click(screen.getByRole('button', { name: "Créer l'invitation" }));
}

/** Presse-papiers refusé (permission) ou absent (contexte non sécurisé, vieux navigateur). */
function breakClipboard(mode: 'refusé' | 'absent'): void {
  if (mode === 'absent')
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  else
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('refusé', 'NotAllowedError'),
    );
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('buildInvitationShareMessage (R-INV-9)', () => {
  it('trois étapes, puis le lien sur la dernière ligne', () => {
    const origin = 'https://rune.example';
    expect(buildInvitationShareMessage(origin, `${origin}/invite#${CODE}`, CODE)).toBe(
      [
        '1. Installe Tailscale et accepte le partage.',
        "2. Ouvre https://rune.example et installe l'appli.",
        `3. Dans l'appli, colle ce lien ou tape le code ${CODE} (valable 7 jours).`,
        `https://rune.example/invite#${CODE}`,
      ].join('\n'),
    );
  });
});

describe('InvitationsPage : liste (R-INV-7)', () => {
  it('cartes : note, badge d’état, dates et pseudo créé ; « Révoquer » sur une invitation en attente seulement', async () => {
    await renderInvitations();
    expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeTruthy();
    expect(screen.getByText('1 en attente')).toBeTruthy();
    expect(items()).toHaveLength(5);
    // Note, badge, puis les dates (et le pseudo créé) : rien d'autre, jamais la date de naissance.
    expect(items().map((li) => li.textContent)).toEqual([
      'pour LéaEn attenteCréée le 06/10/2026Expire le 13/10/2026Révoquer',
      'pour MaxUtiliséeCréée le 06/10/2026Utilisée par lea',
      'Sans noteRévoquéeCréée le 06/10/2026',
      'Sans noteExpiréeCréée le 20/09/2026',
      'Sans noteUtiliséeCréée le 06/10/2026Utilisée par un ancien membre',
    ]);
    const revoke = item(0).getByRole('button', { name: 'Révoquer' });
    expect(description(revoke)).toBe('pour Léa · Créée le 06/10/2026 · Expire le 13/10/2026');
    for (const i of [1, 2, 3, 4]) expect(item(i).queryByRole('button', { name: 'Révoquer' })).toBeNull();
  });

  it('deux invitations « Sans note » en attente : chaque « Révoquer » est décrit aussi par ses dates', async () => {
    await renderInvitations({
      list: [
        invitation({ id: 'i-1' }),
        invitation({
          id: 'i-2',
          createdAt: '2026-10-08T10:00:00.000Z',
          expiresAt: '2026-10-15T10:00:00.000Z',
        }),
      ],
    });
    expect([0, 1].map((i) => description(item(i).getByRole('button', { name: 'Révoquer' })))).toEqual([
      'Sans note · Créée le 06/10/2026 · Expire le 13/10/2026',
      'Sans note · Créée le 08/10/2026 · Expire le 15/10/2026',
    ]);
  });

  it('aucune invitation en attente : pas de compte dans l’en-tête', async () => {
    await renderInvitations({ list: LIST.slice(1) });
    expect(screen.queryByText(/en attente/)).toBeNull();
  });

  it('lecture en cours : « Chargement… » plutôt qu’une liste vide', async () => {
    const reply = Promise.withResolvers<void>();
    const api = createFakeApi().on('GET', '/api/admin/invitations', async () => {
      await reply.promise;
      return { status: 200, body: [] };
    });
    await renderWithServices(<InvitationsPage />, { api, me: ADMIN });
    expect((await screen.findByText('Chargement…')).getAttribute('role')).toBe('status');
    reply.resolve();
    expect(await screen.findByText("Aucune invitation pour l'instant.")).toBeTruthy();
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('aucune invitation : état vide de la boîte à outils, « Aucune invitation pour l’instant. » et une phrase', async () => {
    const api = createFakeApi().on('GET', '/api/admin/invitations', { status: 200, body: [] });
    await renderWithServices(<InvitationsPage />, { api, me: ADMIN });
    // Spec refonte §6 (états et listes) : icône décorative dans son cercle, titre, une phrase.
    const empty = (await screen.findByText("Aucune invitation pour l'instant.")).parentElement as HTMLElement;
    expect(empty.classList.contains(uiStyles.empty as string)).toBe(true);
    expect(within(empty).getByText('Chaque invitation créée apparaît ici, avec son état.')).toBeTruthy();
    expect(empty.querySelector('[aria-hidden="true"] > svg')).not.toBeNull();
    expect(screen.queryByRole('list', { name: 'Invitations envoyées' })).toBeNull();
  });

  it('invitation utilisée entre-temps (409 conflict) : message, liste relue avec le nouvel état', async () => {
    const api = createFakeApi().on('POST', '/api/admin/invitations/:id/revoke', {
      status: 409,
      body: { error: 'conflict' },
    });
    await renderInvitations({ api });
    api.on('GET', '/api/admin/invitations', {
      status: 200,
      body: [invitation({ id: 'i-1', note: 'pour Léa', state: 'used', usedByUsername: 'lea' })],
    });
    fireEvent.click(item(0).getByRole('button', { name: 'Révoquer' }));
    const d = within(screen.getByRole('dialog', { name: "Révoquer l'invitation" }));
    fireEvent.click(d.getByRole('button', { name: 'Révoquer' }));
    expect(await d.findByText("L'élément a changé entre-temps : la liste est relue.")).toBeTruthy();
    expect(await screen.findByText('Utilisée par lea')).toBeTruthy();
    expect(loads(api)).toBe(2);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('« Révoquer » (confirmé) → POST …/i-1/revoke {} puis liste rechargée', async () => {
    const api = createFakeApi().on('POST', '/api/admin/invitations/:id/revoke', { status: 204 });
    await renderInvitations({ api });
    fireEvent.click(item(0).getByRole('button', { name: 'Révoquer' }));
    const d = within(screen.getByRole('dialog', { name: "Révoquer l'invitation" }));
    fireEvent.click(d.getByRole('button', { name: 'Révoquer' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(loads(api)).toBe(2);
    expect(sent(api, 'POST', '/api/admin/invitations/i-1/revoke')).toEqual([{}]);
  });

  it('liste illisible hors ligne : « Nécessite le réseau » et « Réessayer »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<InvitationsPage />, { api, me: ADMIN });
    expect(await screen.findByText('Nécessite le réseau')).toBeTruthy();
    api.setOffline(false);
    api.on('GET', '/api/admin/invitations', { status: 200, body: LIST });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('list', { name: 'Invitations envoyées' })).toBeTruthy();
  });
});

describe('InvitationsPage : création (R-INV-1 à R-INV-3, R-INV-9)', () => {
  it('date de naissance et note → POST { birthDate, note } ; code, lien et message de partage affichés une fois', async () => {
    const { api, link } = createdApi();
    await renderInvitations({ api });
    expect((screen.getByLabelText('Note (facultative)') as HTMLInputElement).maxLength).toBe(
      INVITATION_NOTE_MAX,
    );
    create('2009-05-01', 'pour Léa');
    expect(await screen.findAllByText(CODE)).toHaveLength(3);
    expect(sent(api, 'POST', '/api/admin/invitations')).toEqual([
      { birthDate: '2009-05-01', note: 'pour Léa' },
    ]);
    // Fenêtre du Système (maquette E04) : note et échéance, code, message à envoyer (le lien en dernière ligne).
    const panel = within(screen.getByRole('group', { name: 'Invitation créée.' }));
    expect(panel.getByText("pour Léa · valable jusqu'au 13/10/2026 à 12:00.")).toBeTruthy();
    // Le code dans sa case, puis deux fois dans le message (3e étape et lien).
    expect(panel.getAllByText(CODE)).toHaveLength(3);
    expect(panel.getByText('Ce code ne sera plus affiché.')).toBeTruthy();
    const message = screen.getByTestId('share-message');
    expect(panel.getByRole('figure', { name: 'Message à envoyer' }).contains(message)).toBe(true);
    expect(message.textContent).toBe(buildInvitationShareMessage(window.location.origin, link, CODE));
    expect(message.textContent?.split('\n').at(-1)).toBe(link);
    // Dans le message, le code reste d'un seul tenant (maquette E04) : un élément à lui, que la ligne ne coupe pas.
    expect(
      within(message)
        .getAllByText(CODE)
        .map((el) => el.tagName),
    ).toEqual(['SPAN', 'SPAN']);
    await until(() => loads(api) === 2);
    fireEvent.click(screen.getByRole('button', { name: "J'ai noté le code" }));
    expect(screen.queryByText(CODE)).toBeNull();
    expect(document.body.textContent).not.toContain(CODE);
    expect(screen.queryByTestId('share-message')).toBeNull();
    // Le formulaire revient, vide, pour l'invitation suivante ; le focus passe à son titre.
    expect((screen.getByLabelText('Date de naissance') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Note (facultative)') as HTMLInputElement).value).toBe('');
    await until(
      () => document.activeElement === screen.getByRole('heading', { level: 2, name: 'Nouvelle invitation' }),
    );
  });

  it('sans note : « Valable jusqu’au … » seul', async () => {
    const link = `${window.location.origin}/invite#${CODE}`;
    const api = createFakeApi().on('POST', '/api/admin/invitations', {
      status: 201,
      body: { invitation: invitation({ id: 'i-9' }), code: CODE, link },
    });
    await renderInvitations({ api });
    create('2009-05-01');
    expect(await screen.findByText("Valable jusqu'au 13/10/2026 à 12:00.")).toBeTruthy();
  });

  it('double envoi du formulaire pendant la création : une seule invitation', async () => {
    const reply = Promise.withResolvers<void>();
    const link = `${window.location.origin}/invite#${CODE}`;
    const api = createFakeApi().on('POST', '/api/admin/invitations', async () => {
      await reply.promise;
      return { status: 201, body: { invitation: invitation({ id: 'i-9' }), code: CODE, link } };
    });
    await renderInvitations({ api });
    fill('Date de naissance', '2009-05-01');
    const submit = screen.getByRole('button', { name: "Créer l'invitation" }) as HTMLButtonElement;
    const form = submit.closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await until(() => sent(api, 'POST', '/api/admin/invitations').length > 0);
    await settle();
    expect(sent(api, 'POST', '/api/admin/invitations')).toHaveLength(1);
    expect(submit.disabled).toBe(true);
    reply.resolve();
    expect(await screen.findAllByText(CODE)).toHaveLength(3);
    expect(sent(api, 'POST', '/api/admin/invitations')).toHaveLength(1);
  });

  it('code affiché : le formulaire lui laisse la place jusqu’à « J’ai noté le code » (aucune création ne l’écrase)', async () => {
    const { api } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01', 'pour Léa');
    await screen.findAllByText(CODE);
    // Maquette E04 : la fenêtre du code remplace « Nouvelle invitation » ; une autre création ne peut pas partir.
    expect(screen.queryByRole('heading', { name: 'Nouvelle invitation' })).toBeNull();
    expect(screen.queryByRole('button', { name: "Créer l'invitation" })).toBeNull();
    expect(screen.queryByLabelText('Date de naissance')).toBeNull();
    // Le focus passe au titre de la fenêtre (le bouton « Créer l'invitation » a disparu) : le lecteur d'écran
    // dit « Invitation créée. », puis lit l'échéance avant le code (R-INV-3).
    const panel = within(screen.getByRole('group', { name: 'Invitation créée.' }));
    expect(document.activeElement).toBe(panel.getByRole('heading', { level: 2, name: 'Invitation créée.' }));
    // La liste reste dessous.
    expect(screen.getByRole('list', { name: 'Invitations envoyées' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "J'ai noté le code" }));
    expect(screen.getByRole('button', { name: "Créer l'invitation" })).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/invitations')).toHaveLength(1);
  });

  it('code jamais revu après avoir quitté la page : Membres puis Invitations, plus de code', async () => {
    const { api, link } = createdApi();
    api
      .on('GET', '/api/admin/invitations', { status: 200, body: LIST })
      .on('GET', '/api/admin/members', { status: 200, body: [] });
    await renderApp({ path: '/admin/invitations', me: ADMIN, api });
    await screen.findByRole('list', { name: 'Invitations envoyées' });
    create('2009-05-01', 'pour Léa');
    await screen.findAllByText(CODE);
    const nav = () => within(screen.getByRole('navigation', { name: 'Administration' }));
    fireEvent.click(nav().getByRole('link', { name: 'Membres' }));
    await screen.findByRole('heading', { level: 2, name: 'Membres du cercle' });
    fireEvent.click(nav().getByRole('link', { name: 'Invitations' }));
    await screen.findByRole('list', { name: 'Invitations envoyées' });
    expect(screen.queryByText(CODE)).toBeNull();
    expect(document.body.textContent).not.toContain(CODE);
    expect(screen.queryByTestId('share-message')).toBeNull();
    expect(document.body.textContent).not.toContain(link);
    expect(screen.getByRole('button', { name: "Créer l'invitation" })).toBeTruthy();
  });

  it('code ni gardé ni journalisé : absent après remontage, rien en stockage du navigateur, en base locale ni en console', async () => {
    localStorage.clear();
    sessionStorage.clear();
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const { api, link } = createdApi();
    const { unmount, db } = await renderInvitations({ api });
    create('2009-05-01', 'pour Léa');
    await screen.findAllByText(CODE);
    await until(() => loads(api) === 2);
    unmount();
    await renderWithServices(<InvitationsPage />, { api, me: ADMIN, db });
    await screen.findByRole('list', { name: 'Invitations envoyées' });
    expect(screen.queryByText(CODE)).toBeNull();
    expect(document.body.textContent).not.toContain(CODE);
    expect(document.body.textContent).not.toContain(link);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())))).not.toContain(CODE);
    expect(logs.flatMap((spy) => spy.mock.calls.flat().map(String)).join(' ')).not.toContain(CODE);
  });

  it('note vide : seule la date part', async () => {
    const { api } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01', '   ');
    await screen.findAllByText(CODE);
    expect(sent(api, 'POST', '/api/admin/invitations')).toEqual([{ birthDate: '2009-05-01' }]);
  });

  it('sans date de naissance : message lié au champ, aucun envoi', async () => {
    const { api } = createdApi();
    await renderInvitations({ api });
    fireEvent.click(screen.getByRole('button', { name: "Créer l'invitation" }));
    const field = screen.getByLabelText('Date de naissance');
    expect(screen.getByText('Saisis la date de naissance.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(sent(api, 'POST', '/api/admin/invitations')).toEqual([]);
  });

  it('« Partager » → navigator.share({ text: message })', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    const { api, link } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01', 'pour Léa');
    fireEvent.click(await screen.findByRole('button', { name: 'Partager' }));
    await until(() => share.mock.calls.length === 1);
    expect(share).toHaveBeenCalledWith({
      text: buildInvitationShareMessage(window.location.origin, link, CODE),
    });
  });

  it('partage annulé : aucun message d’erreur', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('annulé', 'AbortError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    const { api } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01');
    fireEvent.click(await screen.findByRole('button', { name: 'Partager' }));
    await until(() => share.mock.calls.length === 1);
    // Le refus du partage arrive après le clic : on le laisse aboutir avant de regarder.
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText(CODE)).toHaveLength(3);
  });

  it('partage refusé (autre qu’une annulation) : « Partage impossible : copie le message. », message gardé', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('refusé', 'NotAllowedError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    const { api, link } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01');
    fireEvent.click(await screen.findByRole('button', { name: 'Partager' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Partage impossible : copie le message.');
    expect(screen.getByTestId('share-message').textContent).toBe(
      buildInvitationShareMessage(window.location.origin, link, CODE),
    );
    expect(screen.getByRole('button', { name: 'Copier le message' })).toBeTruthy();
  });

  it('sans navigator.share : « Copier le message » copie le message', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { api, link } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01');
    await screen.findAllByText(CODE);
    expect(screen.queryByRole('button', { name: 'Partager' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le message' }));
    await until(() => writeText.mock.calls.length === 1);
    expect(writeText).toHaveBeenCalledWith(buildInvitationShareMessage(window.location.origin, link, CODE));
  });

  it.each(['refusé', 'absent'] as const)(
    'presse-papiers %s : « Copie impossible », consigne de sélection ; code, lien et message restent affichés',
    async (mode) => {
      breakClipboard(mode);
      const { api, link } = createdApi();
      await renderInvitations({ api });
      create('2009-05-01');
      await screen.findAllByText(CODE);
      fireEvent.click(screen.getByRole('button', { name: 'Copier le message' }));
      expect(await screen.findByRole('button', { name: 'Copie impossible' })).toBeTruthy();
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Copie impossible : sélectionne le message et copie-le.',
      );
      expect(screen.getByTestId('share-message').textContent).toBe(
        buildInvitationShareMessage(window.location.origin, link, CODE),
      );
      expect(screen.getAllByText(CODE)).toHaveLength(3);
    },
  );

  it('400 under_min_age → « Rune est réservé aux 16 ans et plus », aucun code', async () => {
    const api = createFakeApi().on('POST', '/api/admin/invitations', {
      status: 400,
      body: { error: 'under_min_age' },
    });
    await renderInvitations({ api });
    create('2015-05-01');
    expect(await screen.findByText('Rune est réservé aux 16 ans et plus')).toBeTruthy();
    expect(screen.queryByText('Ce code ne sera plus affiché.')).toBeNull();
    expect((screen.getByLabelText('Date de naissance') as HTMLInputElement).value).toBe('2015-05-01');
  });

  it('hors ligne : « Nécessite le réseau »', async () => {
    const api = createFakeApi();
    await renderInvitations({ api });
    api.setOffline('reject');
    create('2009-05-01');
    expect(await screen.findByText('Nécessite le réseau')).toBeTruthy();
  });
});
