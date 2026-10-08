import { HEALTH_CONSENT_TEXT, type MeResponse } from '@appsport/contracts';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppDb } from '../../src/local-db/db';
import { getMeta } from '../../src/local-db/meta';
import { fill, settle } from '../support/auth';
import { createFakeApi, createFakeSyncEngine, type FakeApi, type FakeSyncEngine } from '../support/fake-api';
import { createTestLocalDb, dumpLocalDb } from '../support/local-db';
import { newcomer } from '../support/onboarding';
import { makeMe, renderApp } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const WITHDRAWN = 'Accord retiré. Tes données de santé ont été effacées.';
const WITNESS = 'TEMOIN-C2';
const WITHDRAW = '/api/me/consents/withdraw';
const GATE = "Le texte de l'accord santé a changé";

const consented = (textVersion: string | null = '1.0', active = true): MeResponse =>
  makeMe({
    consents: {
      health: { active, textVersion, at: active ? '2026-10-01T10:00:00.000Z' : null },
      aiCoach: { active: false, textVersion: null, at: null },
    },
  });

/** Questionnaire et limitation portant la valeur témoin. */
async function seedHealth(db: AppDb): Promise<void> {
  await seedMirror(db, 'health_screening', [
    {
      id: 'u-1',
      ownerId: 'u-1',
      caution: true,
      questionnaireVersion: '1.0',
      answeredAt: '2026-10-01T10:00:00.000Z',
    },
  ]);
  await seedMirror(db, 'limitation', [
    {
      id: 'l-1',
      ownerId: 'u-1',
      bodyArea: 'knee',
      side: 'left',
      severity: 'mild',
      note: WITNESS,
      active: true,
    },
  ]);
}

async function renderPrivacy(o: { me?: MeResponse; api?: FakeApi } = {}) {
  const db = createTestLocalDb();
  await seedHealth(db);
  const view = await renderApp({ path: '/profile/privacy', me: o.me ?? consented(), db, api: o.api });
  await screen.findByRole('heading', { level: 1, name: 'Confidentialité' });
  return view;
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
/** Valeur d'une ligne de la liste des accords (`dt` → `dd`). */
const consentValue = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

async function openWithdraw() {
  fireEvent.click(button('Retirer mon accord santé'));
  return within(await screen.findByRole('dialog'));
}

describe('PrivacySettingsPage (02 §11, R-CST-5, 03 §13)', () => {
  it('version en vigueur, lien vers la page, accords santé et coach', async () => {
    await renderPrivacy();
    expect(screen.getByText('Version en vigueur : 1.0')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Lire la page Confidentialité et règles' }).getAttribute('href'),
    ).toBe('/privacy');
    expect(consentValue('Accord santé')).toBe('Donné le 01/10/2026');
    expect(consentValue('Accord coach')).toBe('Non donné');
    expect(button('Télécharger mes données')).toBeTruthy();
    expect(button('Supprimer mon compte')).toBeTruthy();
  });

  it('sans accord santé : « Non donné », pas de retrait, lien vers Santé', async () => {
    await renderPrivacy({ me: makeMe() });
    expect(consentValue('Accord santé')).toBe('Non donné');
    expect(screen.queryByRole('button', { name: 'Retirer mon accord santé' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Donner mon accord santé' }).getAttribute('href')).toBe(
      '/profile/health',
    );
  });
});

describe('ConsentWithdrawDialog (R-CST-5, P-CST-3, P-AUT-5)', () => {
  it("liste ce qui sera effacé, propose l'export, « Retirer mon accord » désactivé sans mot de passe", async () => {
    await renderPrivacy();
    const dialog = await openWithdraw();
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).toContain('indicateur de prudence');
    expect(text).toContain('limitations et zones sensibles');
    expect(text).toContain('Le mode prudent est conservé.');
    expect(
      dialog.getByText(
        "Seront effacés : ton indicateur de prudence (questionnaire), tes limitations et zones sensibles, et toute donnée de santé enregistrée par l'appli (douleurs, pesées, suivi nutritionnel). Le mode prudent est conservé.",
      ),
    ).toBeTruthy();
    expect(dialog.getByRole('button', { name: "Télécharger mes données d'abord" })).toBeTruthy();
    const confirm = dialog.getByRole('button', { name: 'Retirer mon accord' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fill('Mot de passe', 'cheval agrafe batterie correcte');
    expect(confirm.disabled).toBe(false);
  });

  it('saisie du mot de passe : le focus reste dans le champ', async () => {
    await renderPrivacy();
    await openWithdraw();
    const field = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    field.focus();
    fill('Mot de passe', 'c');
    fill('Mot de passe', 'ch');
    await settle();
    expect(document.activeElement).toBe(field);
  });

  it('POST withdraw { type, password } → 200 MeResponse : message, meta.me à jour, aucune valeur C2 en local', async () => {
    const api = createFakeApi().on('POST', WITHDRAW, { status: 200, body: consented(null, false) });
    const { db, sync } = await renderPrivacy({ api });
    expect(await dumpLocalDb(db)).toContain(WITNESS);
    const dialog = await openWithdraw();
    fill('Mot de passe', 'cheval agrafe batterie correcte');
    fireEvent.click(dialog.getByRole('button', { name: 'Retirer mon accord' }));
    expect(await screen.findByText(WITHDRAWN)).toBeTruthy();
    expect(api.calls.filter((c) => c.path === WITHDRAW).map((c) => [c.method, c.body])).toEqual([
      ['POST', { type: 'health', password: 'cheval agrafe batterie correcte' }],
    ]);
    expect((await getMeta(db, 'me'))?.consents.health.active).toBe(false);
    expect(await dumpLocalDb(db)).not.toContain(WITNESS);
    expect(sync.pullCount).toBe(1);
    fireEvent.click(button('Fermer'));
    await until(() => screen.queryByRole('dialog') === null);
    expect(consentValue('Accord santé')).toBe('Non donné');
    // Le bouton « Retirer mon accord santé » a disparu : le focus va au titre des accords.
    await until(() => document.activeElement === screen.getByRole('heading', { level: 2, name: 'Accords' }));
  });

  it('401 → « Mot de passe incorrect. », miroir intact', async () => {
    const api = createFakeApi().on('POST', WITHDRAW, { status: 401, body: { error: 'invalid_credentials' } });
    const { db } = await renderPrivacy({ api });
    const dialog = await openWithdraw();
    fill('Mot de passe', 'mauvais mot de passe');
    fireEvent.click(dialog.getByRole('button', { name: 'Retirer mon accord' }));
    expect((await dialog.findByRole('alert')).textContent).toBe('Mot de passe incorrect.');
    expect(await dumpLocalDb(db)).toContain(WITNESS);
    expect((await getMeta(db, 'me'))?.consents.health.active).toBe(true);
  });

  it('hors ligne → « Nécessite le réseau », rien purgé', async () => {
    const api = createFakeApi();
    const { db } = await renderPrivacy({ api });
    const dialog = await openWithdraw();
    api.setOffline('reject');
    fill('Mot de passe', 'cheval agrafe batterie correcte');
    fireEvent.click(dialog.getByRole('button', { name: 'Retirer mon accord' }));
    expect((await dialog.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(await dumpLocalDb(db)).toContain(WITNESS);
  });

  it('« Annuler » ferme sans requête', async () => {
    const { api } = await renderPrivacy();
    const dialog = await openWithdraw();
    fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(api.calls.filter((c) => c.path === WITHDRAW)).toHaveLength(0);
  });
});

describe('HealthReconsentGate (R-CST-6, P-CST-1)', () => {
  async function renderGate(me: MeResponse, api = createFakeApi(), path = '/', sync?: FakeSyncEngine) {
    const db = createTestLocalDb();
    await seedHealth(db);
    return renderApp({ path, me, db, api, sync });
  }

  it("hors ligne à l'ouverture : pas de porte, l'appli reste utilisable ; elle se lève une fois en ligne", async () => {
    const sync = createFakeSyncEngine({ connection: 'offline' });
    await renderGate(consented('0.9'), createFakeApi(), '/profile/health', sync);
    await screen.findByRole('heading', { level: 1, name: 'Santé' });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ajouter une limitation' })).toBeTruthy();
    act(() => sync.set({ connection: 'unknown' }));
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => sync.set({ connection: 'online' }));
    expect(await screen.findByRole('dialog', { name: GATE })).toBeTruthy();
  });

  it('porte levée puis réseau perdu : elle reste, « Nécessite le réseau » affiché et ses deux boutons désactivés', async () => {
    const sync = createFakeSyncEngine();
    await renderGate(consented('0.9'), createFakeApi(), '/', sync);
    const gate = within(await screen.findByRole('dialog', { name: GATE }));
    fireEvent.click(gate.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }));
    act(() => sync.set({ connection: 'offline' }));
    await settle();
    expect(screen.getByRole('dialog', { name: GATE })).toBeTruthy();
    expect(gate.getByRole('status').textContent).toBe('Nécessite le réseau');
    const disabled = () =>
      gate.getAllByRole('button').map((b) => [b.textContent, (b as HTMLButtonElement).disabled]);
    expect(disabled()).toEqual([
      ['Je refuse', true],
      ["J'accepte", true],
    ]);
    act(() => sync.set({ connection: 'online' }));
    await settle();
    expect(gate.queryByRole('status')).toBeNull();
    expect(disabled()).toEqual([
      ['Je refuse', false],
      ["J'accepte", false],
    ]);
  });

  it("« J'accepte » sans réseau (requête échouée) : « Nécessite le réseau » dans la porte, qui reste, accord inchangé", async () => {
    const api = createFakeApi().on('POST', '/api/me/consents', { status: 200, body: consented('1.0') });
    const { db } = await renderGate(consented('0.9'), api);
    const gate = within(await screen.findByRole('dialog', { name: GATE }));
    api.setOffline('reject');
    fireEvent.click(gate.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }));
    fireEvent.click(gate.getByRole('button', { name: "J'accepte" }));
    expect((await gate.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    await settle();
    expect(screen.getByRole('dialog', { name: GATE })).toBeTruthy();
    expect((await getMeta(db, 'me'))?.consents.health.textVersion).toBe('0.9');
  });

  it('modale pour de vrai : le reste de la page est inerte et caché tant que la porte est là', async () => {
    const api = createFakeApi().on('POST', '/api/me/consents', { status: 200, body: consented('1.0') });
    await renderGate(consented('0.9'), api, '/profile/health');
    const gate = within(await screen.findByRole('dialog', { name: GATE }));
    expect(screen.getByText('Ajouter une limitation').closest('[inert]')).not.toBeNull();
    expect(screen.getByText('Accueil').closest('[inert][aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajouter une limitation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Répondre de nouveau' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    fireEvent.click(gate.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }));
    fireEvent.click(gate.getByRole('button', { name: "J'accepte" }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(screen.getByText('Ajouter une limitation').closest('[inert]')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ajouter une limitation' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy();
  });

  it("textVersion '0.9' → « Le texte de l'accord santé a changé », texte en vigueur, case décochée, sans fermeture", async () => {
    await renderGate(consented('0.9'));
    const gate = await screen.findByRole('dialog', { name: GATE });
    const box = within(gate).getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect((within(gate).getByRole('button', { name: "J'accepte" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      within(gate)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Je refuse', "J'accepte"]);
    fireEvent.keyDown(document, { key: 'Escape' });
    await settle();
    expect(screen.getByRole('dialog', { name: GATE })).toBe(gate);
  });

  it("« J'accepte » → POST /api/me/consents { type: 'health', textVersion: '1.0' }, la porte se lève", async () => {
    const api = createFakeApi().on('POST', '/api/me/consents', { status: 200, body: consented('1.0') });
    await renderGate(consented('0.9'), api);
    const gate = within(await screen.findByRole('dialog', { name: GATE }));
    fireEvent.click(gate.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }));
    fireEvent.click(gate.getByRole('button', { name: "J'accepte" }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(api.calls.filter((c) => c.path === '/api/me/consents').map((c) => c.body)).toEqual([
      { type: 'health', textVersion: '1.0' },
    ]);
  });

  it('« Je refuse » → ConsentWithdrawDialog ; fermé sans retrait, la porte réapparaît', async () => {
    await renderGate(consented('0.9'));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: GATE })).getByRole('button', { name: 'Je refuse' }),
    );
    const withdraw = within(await screen.findByRole('dialog', { name: "Retirer l'accord santé" }));
    expect(screen.queryByRole('dialog', { name: GATE })).toBeNull();
    expect(withdraw.getByLabelText('Mot de passe')).toBeTruthy();
    fireEvent.click(withdraw.getByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('dialog', { name: GATE })).toBeTruthy();
  });

  it('« Je refuse » puis retrait avec le mot de passe : message, puis plus de porte', async () => {
    const api = createFakeApi().on('POST', WITHDRAW, { status: 200, body: consented(null, false) });
    const { db } = await renderGate(consented('0.9'), api);
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: GATE })).getByRole('button', { name: 'Je refuse' }),
    );
    const withdraw = within(await screen.findByRole('dialog', { name: "Retirer l'accord santé" }));
    fill('Mot de passe', 'cheval agrafe batterie correcte');
    fireEvent.click(withdraw.getByRole('button', { name: 'Retirer mon accord' }));
    expect(await screen.findByText(WITHDRAWN)).toBeTruthy();
    expect(await dumpLocalDb(db)).not.toContain(WITNESS);
    fireEvent.click(button('Fermer'));
    await until(() => screen.queryByRole('dialog') === null);
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['1.0', true],
    ['0.9', false],
  ] as const)("textVersion '%s', actif %s → aucune porte", async (version, active) => {
    await renderGate(consented(version, active));
    await screen.findByRole('heading', { level: 1 });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("pas de porte pendant l'onboarding", async () => {
    await renderGate(newcomer({ consents: consented('0.9').consents }), createFakeApi(), '/onboarding');
    await screen.findByTestId('onboarding-step');
    await settle();
    expect(screen.queryByRole('dialog', { name: GATE })).toBeNull();
  });

  it('la porte apparaît sur toute page connectée, Confidentialité comprise', async () => {
    await renderGate(consented('0.9'), createFakeApi(), '/profile/privacy');
    expect(await screen.findByRole('dialog', { name: GATE })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
  });
});
