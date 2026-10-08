import { INVITATION_NOTE_MAX, type InvitationSummary } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvitationsPage } from '../../src/features/admin/InvitationsPage';
import { buildInvitationShareMessage } from '../../src/features/admin/share-message';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { makeMe, renderWithServices } from '../support/render';
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

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  vi.restoreAllMocks();
});

describe('buildInvitationShareMessage (R-INV-9)', () => {
  it('trois étapes, puis le lien sur la dernière ligne', () => {
    const origin = 'https://appsport.example';
    expect(buildInvitationShareMessage(origin, `${origin}/invite#${CODE}`, CODE)).toBe(
      [
        '1. Installe Tailscale et accepte le partage.',
        "2. Ouvre https://appsport.example et installe l'appli.",
        `3. Dans l'appli, colle ce lien ou tape le code ${CODE} (valable 7 jours).`,
        `https://appsport.example/invite#${CODE}`,
      ].join('\n'),
    );
  });
});

describe('InvitationsPage : liste (R-INV-7)', () => {
  it('note, date de création, état et pseudo créé ; « Révoquer » sur une invitation en attente seulement', async () => {
    await renderInvitations();
    expect(screen.getByRole('heading', { level: 1, name: 'Invitations' })).toBeTruthy();
    expect(items()).toHaveLength(5);
    expect(item(0).getByText('pour Léa')).toBeTruthy();
    expect(item(0).getByText('Créée le 06/10/2026')).toBeTruthy();
    expect(item(0).getByText('En attente (expire le 13/10/2026)')).toBeTruthy();
    expect(item(1).getByText('Utilisée par lea')).toBeTruthy();
    expect(item(2).getByText('Sans note')).toBeTruthy();
    expect(item(2).getByText('Révoquée')).toBeTruthy();
    expect(item(3).getByText('Expirée')).toBeTruthy();
    expect(item(3).getByText('Créée le 20/09/2026')).toBeTruthy();
    expect(item(4).getByText('Utilisée par un ancien membre')).toBeTruthy();
    expect(item(0).getByRole('button', { name: 'Révoquer' })).toBeTruthy();
    for (const i of [1, 2, 3, 4]) expect(item(i).queryByRole('button', { name: 'Révoquer' })).toBeNull();
  });

  it('aucune invitation : « Aucune invitation pour l’instant. »', async () => {
    const api = createFakeApi().on('GET', '/api/admin/invitations', { status: 200, body: [] });
    await renderWithServices(<InvitationsPage />, { api, me: ADMIN });
    expect(await screen.findByText("Aucune invitation pour l'instant.")).toBeTruthy();
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
    expect(await screen.findByText(CODE)).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/invitations')).toEqual([
      { birthDate: '2009-05-01', note: 'pour Léa' },
    ]);
    expect(screen.getByText(link)).toBeTruthy();
    expect(screen.getByText('Ce code ne sera plus affiché.')).toBeTruthy();
    expect(screen.getByTestId('share-message').textContent).toBe(
      buildInvitationShareMessage(window.location.origin, link, CODE),
    );
    await until(() => loads(api) === 2);
    // Le formulaire repart vide pour l'invitation suivante.
    expect((screen.getByLabelText('Date de naissance') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Note (facultative)') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: "J'ai noté le code" }));
    expect(screen.queryByText(CODE)).toBeNull();
    expect(screen.queryByText(link)).toBeNull();
    expect(screen.queryByTestId('share-message')).toBeNull();
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
    expect(await screen.findByText(CODE)).toBeTruthy();
    expect(sent(api, 'POST', '/api/admin/invitations')).toHaveLength(1);
  });

  it('note vide : seule la date part', async () => {
    const { api } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01', '   ');
    await screen.findByText(CODE);
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
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sans navigator.share : « Copier le message » copie le message', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { api, link } = createdApi();
    await renderInvitations({ api });
    create('2009-05-01');
    await screen.findByText(CODE);
    expect(screen.queryByRole('button', { name: 'Partager' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le message' }));
    await until(() => writeText.mock.calls.length === 1);
    expect(writeText).toHaveBeenCalledWith(buildInvitationShareMessage(window.location.origin, link, CODE));
  });

  it('400 under_min_age → « appsport est réservé aux 16 ans et plus », aucun code', async () => {
    const api = createFakeApi().on('POST', '/api/admin/invitations', {
      status: 400,
      body: { error: 'under_min_age' },
    });
    await renderInvitations({ api });
    create('2015-05-01');
    expect(await screen.findByText('appsport est réservé aux 16 ans et plus')).toBeTruthy();
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
