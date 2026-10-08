import { EXPORT_FORMAT, type MeResponse } from '@appsport/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { getMeta } from '../../src/local-db/meta';
import { downloadJson, exportFileName } from '../../src/ui/download';
import { fill, settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { makeMe, renderApp } from '../support/render';
import { seedOutbox } from '../support/seed';
import { until } from '../support/wait';

const EXPORT = '/api/me/export';
const DELETE = '/api/me/delete';
const PASSWORD = 'cheval agrafe batterie correcte';
const EXPORTED = {
  format: EXPORT_FORMAT,
  exportedAt: '2026-10-06T12:00:00.000Z',
  account: { id: 'u-1', username: 'lea' },
  tables: { place: [] },
  gyms: [],
  gymHistory: [],
};
const DELETE_LIST =
  "Ton compte, ton profil, tes lieux, tes données de santé et l'historique de tes accords seront supprimés. Les salles restent : tu y apparaîtras comme « ancien membre ». Le journal de sécurité est gardé 12 mois et les sauvegardes 30 jours au plus.";
const ANTHROPIC =
  "Si tu as utilisé le coach, appsport ne peut pas faire effacer tes échanges chez Anthropic : ils y sont effacés sous 30 jours, ou gardés jusqu'à 2 ans si ses filtres de sécurité en ont signalé un.";

interface Click {
  download: string;
  href: string;
  connected: boolean;
}

let clicks: Click[] = [];
let blobs: Blob[] = [];
let createUrl: MockInstance<typeof URL.createObjectURL>;
let revokeUrl: MockInstance<typeof URL.revokeObjectURL>;

beforeEach(() => {
  clicks = [];
  blobs = [];
  createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return `blob:test/${blobs.length}`;
  });
  revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({
      download: this.download,
      href: this.getAttribute('href') ?? '',
      connected: this.isConnected,
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const calls = (api: FakeApi, path: string) => api.calls.filter((c) => c.path === path);

/**
 * État final, pas seulement le passage : une fois tout retombé, l'écran est toujours « Ce compte a
 * été supprimé », sans détour par l'accueil ni départ après l'adresse visée (P-DRT-4).
 */
async function expectAccountDeletedScreen(location: () => string, visits: () => string[]) {
  await settle();
  expect(location()).toBe('/login?reason=account_deleted');
  expect(visits()).not.toContain('/');
  expect(visits().at(-1)).toBe('/login?reason=account_deleted');
  expect(screen.getByText('Ce compte a été supprimé')).toBeTruthy();
}

describe('download.ts', () => {
  it('exportFileName : date civile de Paris (AAAA-MM-JJ)', () => {
    expect(exportFileName(Date.parse('2026-10-06T12:00:00.000Z'))).toBe('appsport-export-2026-10-06.json');
    // 22 h 30 UTC = 00 h 30 à Paris le lendemain.
    expect(exportFileName(Date.parse('2026-10-06T22:30:00.000Z'))).toBe('appsport-export-2026-10-07.json');
  });

  it('downloadJson : Blob JSON indenté, <a download> cliqué une fois puis retiré, URL révoquée ensuite', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    downloadJson('fichier.json', { a: 1, b: [true] });
    expect(clicks).toEqual([{ download: 'fichier.json', href: 'blob:test/1', connected: true }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(blobs[0]?.type).toBe('application/json');
    expect(await blobs[0]?.text()).toBe(JSON.stringify({ a: 1, b: [true] }, null, 2));
    // Révoquée trop tôt, Safari annule le téléchargement : 40 s après le clic, pas avant.
    expect(revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(39_999);
    expect(revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:test/1');
  });
});

async function renderPrivacy(o: { me?: MeResponse; api?: FakeApi; pending?: number } = {}) {
  const db = createTestLocalDb();
  if (o.pending) await seedOutbox(db, 'u-1', o.pending);
  const view = await renderApp({ path: '/profile/privacy', me: o.me, db, api: o.api });
  await screen.findByRole('heading', { level: 1, name: 'Confidentialité' });
  return view;
}

describe('ExportButton (R-EXP-1, P-DRT-1)', () => {
  it('2 ops en attente : avertissement sans requête ; « Exporter quand même » → téléchargement', async () => {
    const api = createFakeApi().on('GET', EXPORT, { status: 200, body: EXPORTED });
    await renderPrivacy({ api, pending: 2 });
    fireEvent.click(button('Télécharger mes données'));
    const warning = await screen.findByText(
      "2 éléments ne sont pas encore envoyés au serveur : ils ne figureront pas dans l'export.",
    );
    expect(warning.closest('[role="status"]')).toBeTruthy();
    await settle();
    expect(calls(api, EXPORT)).toHaveLength(0);
    expect(clicks).toHaveLength(0);
    fireEvent.click(button('Exporter quand même'));
    await until(() => clicks.length === 1);
    expect(clicks[0]).toMatchObject({ download: 'appsport-export-2026-10-06.json', href: 'blob:test/1' });
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await blobs[0]?.text()) ?? '')).toEqual(EXPORTED);
    expect(calls(api, EXPORT)).toHaveLength(1);
    await until(() => screen.queryByText(/ne figureront pas dans l'export/) === null);
  });

  it('1 op en attente : message au singulier', async () => {
    await renderPrivacy({ pending: 1 });
    fireEvent.click(button('Télécharger mes données'));
    expect(
      await screen.findByText(
        "1 élément n'est pas encore envoyé au serveur : il ne figurera pas dans l'export.",
      ),
    ).toBeTruthy();
  });

  it('file illisible : avertissement, rien ne part avant « Exporter quand même »', async () => {
    const api = createFakeApi().on('GET', EXPORT, { status: 200, body: EXPORTED });
    const { db } = await renderPrivacy({ api, pending: 1 });
    vi.spyOn(db.outbox, 'where').mockImplementation(() => {
      throw new Error('IndexedDB indisponible');
    });
    fireEvent.click(button('Télécharger mes données'));
    const warning = await screen.findByText(
      "Impossible de vérifier les éléments non envoyés : ils pourraient manquer dans l'export.",
    );
    expect(warning.closest('[role="status"]')).toBeTruthy();
    await settle();
    expect(calls(api, EXPORT)).toHaveLength(0);
    expect(clicks).toHaveLength(0);
    fireEvent.click(button('Exporter quand même'));
    await until(() => clicks.length === 1);
    expect(clicks[0]?.download).toBe('appsport-export-2026-10-06.json');
    expect(calls(api, EXPORT)).toHaveLength(1);
  });

  it('file vide : téléchargement au premier clic', async () => {
    const api = createFakeApi().on('GET', EXPORT, { status: 200, body: EXPORTED });
    await renderPrivacy({ api });
    fireEvent.click(button('Télécharger mes données'));
    await until(() => clicks.length === 1);
    expect(clicks[0]?.download).toBe('appsport-export-2026-10-06.json');
    expect(createUrl).toHaveBeenCalledTimes(1);
  });

  it('hors ligne : « Nécessite le réseau », aucun téléchargement', async () => {
    const api = createFakeApi();
    await renderPrivacy({ api });
    api.setOffline('reject');
    fireEvent.click(button('Télécharger mes données'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(clicks).toHaveLength(0);
  });
});

describe('DeleteAccountDialog (R-SUP-1, R-SUP-4, R-SUP-5, P-DRT-3, P-DRT-6)', () => {
  async function openDelete() {
    fireEvent.click(button('Supprimer mon compte'));
    return within(await screen.findByRole('dialog', { name: 'Supprimer ton compte ?' }));
  }

  it("liste, mention Anthropic, export d'abord ; « Supprimer définitivement » désactivé sans mot de passe", async () => {
    await renderPrivacy();
    const dialog = await openDelete();
    expect(dialog.getByText(DELETE_LIST)).toBeTruthy();
    expect(dialog.getByText(ANTHROPIC)).toBeTruthy();
    expect(dialog.getByRole('button', { name: "Télécharger mes données d'abord" })).toBeTruthy();
    const confirm = dialog.getByRole('button', { name: 'Supprimer définitivement' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fill('Mot de passe', PASSWORD);
    expect(confirm.disabled).toBe(false);
  });

  it("« Télécharger mes données d'abord » télécharge l'export depuis le dialogue", async () => {
    const api = createFakeApi().on('GET', EXPORT, { status: 200, body: EXPORTED });
    await renderPrivacy({ api });
    const dialog = await openDelete();
    fireEvent.click(dialog.getByRole('button', { name: "Télécharger mes données d'abord" }));
    await until(() => clicks.length === 1);
    expect(clicks[0]?.download).toBe('appsport-export-2026-10-06.json');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('POST /api/me/delete { password } → base vidée, /login?reason=account_deleted, « Ce compte a été supprimé »', async () => {
    const api = createFakeApi().on('POST', DELETE, { status: 204 });
    const { db, location, visits } = await renderPrivacy({ api, pending: 2 });
    const dialog = await openDelete();
    fill('Mot de passe', PASSWORD);
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer définitivement' }));
    await waitFor(() => expect(location()).toBe('/login?reason=account_deleted'));
    expect(calls(api, DELETE).map((c) => [c.method, c.body])).toEqual([['POST', { password: PASSWORD }]]);
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'me')).toBeUndefined();
    await expectAccountDeletedScreen(location, visits);
  });

  it("409 last_admin → « Tu es le dernier administrateur : nomme d'abord un autre administrateur. », rien effacé", async () => {
    const api = createFakeApi().on('POST', DELETE, { status: 409, body: { error: 'last_admin' } });
    const { db, location } = await renderPrivacy({ api, me: makeMe({ role: 'admin' }), pending: 1 });
    const dialog = await openDelete();
    fill('Mot de passe', PASSWORD);
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer définitivement' }));
    expect((await dialog.findByRole('alert')).textContent).toBe(
      "Tu es le dernier administrateur : nomme d'abord un autre administrateur.",
    );
    expect(await db.outbox.count()).toBe(1);
    expect(await getMeta(db, 'me')).toBeDefined();
    expect(location()).toBe('/profile/privacy');
  });

  it('hors ligne → « Nécessite le réseau » : rien effacé, file gardée, pas de navigation, moteur relancé', async () => {
    const api = createFakeApi().on('POST', DELETE, { status: 204 });
    const { db, location, sync } = await renderPrivacy({ api, pending: 2 });
    const dialog = await openDelete();
    api.setOffline('reject');
    fill('Mot de passe', PASSWORD);
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer définitivement' }));
    expect((await dialog.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    await settle();
    expect(await db.outbox.count()).toBe(2);
    expect(await getMeta(db, 'me')).toBeDefined();
    expect(location()).toBe('/profile/privacy');
    expect(screen.getByRole('dialog', { name: 'Supprimer ton compte ?' })).toBeTruthy();
    expect(sync.started).toBe(true);
  });

  it('401 → « Mot de passe incorrect. », rien effacé', async () => {
    const api = createFakeApi().on('POST', DELETE, { status: 401, body: { error: 'invalid_credentials' } });
    const { db } = await renderPrivacy({ api });
    const dialog = await openDelete();
    fill('Mot de passe', 'mauvais mot de passe');
    fireEvent.click(dialog.getByRole('button', { name: 'Supprimer définitivement' }));
    expect((await dialog.findByRole('alert')).textContent).toBe('Mot de passe incorrect.');
    expect(await getMeta(db, 'me')).toBeDefined();
  });

  it('saisie du mot de passe : le focus reste dans le champ', async () => {
    await renderPrivacy();
    await openDelete();
    const field = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    field.focus();
    fill('Mot de passe', 'c');
    fill('Mot de passe', 'ch');
    await settle();
    expect(document.activeElement).toBe(field);
  });
});

describe('compte supprimé depuis un autre appareil (P-DRT-4, 03 §17 n°9)', () => {
  it('GET /api/me → 410 account_deleted : base vidée, file comprise, puis connexion', async () => {
    const api = createFakeApi().on('GET', '/api/me', { status: 410, body: { error: 'account_deleted' } });
    const db = createTestLocalDb();
    await seedOutbox(db, 'u-1', 2);
    const { location, visits } = await renderApp({ path: '/profile/privacy', db, api });
    await waitFor(() => expect(location()).toBe('/login?reason=account_deleted'));
    expect(await db.outbox.count()).toBe(0);
    expect(await getMeta(db, 'me')).toBeUndefined();
    await expectAccountDeletedScreen(location, visits);
  });

  it('GET /api/me → 410 watermark_expired : rien effacé', async () => {
    const api = createFakeApi().on('GET', '/api/me', { status: 410, body: { error: 'watermark_expired' } });
    const db = createTestLocalDb();
    await seedOutbox(db, 'u-1', 2);
    const { location } = await renderApp({ path: '/profile/privacy', db, api });
    await screen.findByRole('heading', { level: 1, name: 'Confidentialité' });
    await until(() => calls(api, '/api/me').length === 1);
    await settle();
    expect(await db.outbox.count()).toBe(2);
    expect(await getMeta(db, 'me')).toBeDefined();
    expect(location()).toBe('/profile/privacy');
  });
});
