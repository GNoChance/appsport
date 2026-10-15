import type { CoachId } from '@rune/contracts';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COACHES, coachText } from '../../src/features/coach/coach-lines';
import { settle } from '../support/auth';
import { createFakeApi, createFakeSyncEngine, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { PROFILE_PATH, seedProfile, serveProfile } from '../support/onboarding';
import { makeMe, renderApp } from '../support/render';
import { until } from '../support/wait';

const LATER =
  "Pour l'instant, ton coach parle avec des messages préparés à l'avance. La vraie conversation arrivera plus tard.";
const TRAINING = { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 } as const;
const NEW_SCRIBE = 'Le Scribe est ton nouveau coach.';

async function renderCoach(o: { api?: FakeApi; coach?: CoachId } = {}) {
  const me = makeMe();
  const db = createTestLocalDb();
  const api = o.api ?? createFakeApi();
  await seedProfile(db, { ...TRAINING, coach: o.coach ?? 'skald' });
  const server = serveProfile(api, db, me);
  const view = await renderApp({ path: '/profile/coach', me, db, api });
  await screen.findByRole('heading', { level: 1, name: 'Mon coach' });
  return { ...view, ...server };
}

const patches = (api: FakeApi) =>
  api.calls.filter((c) => c.method === 'PATCH' && c.path === PROFILE_PATH).map((c) => c.body);

async function openSheet() {
  fireEvent.click(await screen.findByRole('button', { name: 'Changer de coach' }));
  return within(await screen.findByRole('dialog', { name: 'Changer de coach' }));
}

type Sheet = Awaited<ReturnType<typeof openSheet>>;
/** Le radio du coach `name` est coché dans la feuille. */
const checked = (sheet: Sheet, name: string) =>
  (sheet.getByRole('radio', { name }) as HTMLInputElement).checked;

/** Choisit le Scribe dans la feuille, confirme et attend qu'elle se ferme. */
async function confirmScribe() {
  const sheet = await openSheet();
  fireEvent.click(sheet.getByRole('radio', { name: 'Le Scribe' }));
  fireEvent.click(sheet.getByRole('button', { name: 'Choisir le Scribe' }));
  await until(() => screen.queryByRole('dialog') === null);
}

describe('MyCoachPage (spec refonte §8, prototype « Mon coach »)', () => {
  it('les deux avatars du coach (entraînement et nutrition), son nom, son tempérament et un aperçu étiqueté', async () => {
    await renderCoach();
    expect(await screen.findByRole('img', { name: 'Le Skald' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Le Skald, mode nutrition' })).toBeTruthy();
    expect(screen.getByText('Entraînement')).toBeTruthy();
    expect(screen.getByText('Nutrition')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Le Skald' })).toBeTruthy();
    expect(screen.getByText(COACHES.skald.temper)).toBeTruthy();
    expect(screen.getByText(coachText('skald', 'sample', 'lea'))).toBeTruthy();
    expect(screen.getByText('Aperçu')).toBeTruthy();
  });

  it('dit que la vraie conversation arrivera plus tard', async () => {
    await renderCoach();
    expect(await screen.findByText(LATER)).toBeTruthy();
  });

  it('« Changer de coach » ouvre une feuille avec les 3 choix, le coach actuel coché', async () => {
    await renderCoach();
    const sheet = await openSheet();
    const radios = sheet.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect((sheet.getByRole('radio', { name: "L'Ombre" }) as HTMLInputElement).checked).toBe(false);
    expect((sheet.getByRole('radio', { name: 'Le Skald' }) as HTMLInputElement).checked).toBe(true);
    expect((sheet.getByRole('radio', { name: 'Le Scribe' }) as HTMLInputElement).checked).toBe(false);
    // Rien à confirmer tant que le choix est le coach actuel.
    expect(
      (sheet.getByRole('button', { name: 'Choisis un autre coach' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('confirmer appelle setCoach (PATCH { coach }), ferme la feuille et montre le nouveau coach', async () => {
    const { api } = await renderCoach();
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('radio', { name: 'Le Scribe' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Choisir le Scribe' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(patches(api)).toEqual([{ coach: 'scribe' }]);
    expect(await screen.findByRole('heading', { level: 2, name: 'Le Scribe' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Le Scribe, mode nutrition' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Le Scribe est ton nouveau coach.');
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Changer de coach' }));
  });

  it("« Choisir L'Ombre » : le nom du coach tel quel", async () => {
    const { api } = await renderCoach();
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('radio', { name: "L'Ombre" }));
    fireEvent.click(sheet.getByRole('button', { name: "Choisir L'Ombre" }));
    await until(() => patches(api).length === 1);
    expect(patches(api)).toEqual([{ coach: 'ombre' }]);
  });

  it("échec (hors ligne) : la feuille reste ouverte avec l'erreur, le coach ne change pas", async () => {
    const { api } = await renderCoach();
    api.setOffline('reject');
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('radio', { name: 'Le Scribe' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Choisir le Scribe' }));
    expect((await sheet.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(screen.getByRole('dialog', { name: 'Changer de coach' })).toBeTruthy();
    expect((sheet.getByRole('radio', { name: 'Le Scribe' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText('Le Scribe est ton nouveau coach.')).toBeNull();
  });

  it("pendant l'envoi : choix et boutons figés, Échap ne ferme pas", async () => {
    const { api } = await renderCoach();
    const sheet = await openSheet();
    api.setOffline('hang');
    fireEvent.click(sheet.getByRole('radio', { name: 'Le Scribe' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Choisir le Scribe' }));
    await until(() => (sheet.getByRole('radio', { name: "L'Ombre" }) as HTMLInputElement).disabled);
    expect((sheet.getByRole('button', { name: 'Choisir le Scribe' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((sheet.getByRole('button', { name: 'Annuler' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    await settle();
    expect(screen.getByRole('dialog', { name: 'Changer de coach' })).toBeTruthy();
  });

  it('« Annuler » ferme sans requête ; la réouverture repart du coach actuel', async () => {
    const { api } = await renderCoach();
    let sheet = await openSheet();
    fireEvent.click(sheet.getByRole('radio', { name: 'Le Scribe' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Annuler' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(patches(api)).toEqual([]);
    sheet = await openSheet();
    expect((sheet.getByRole('radio', { name: 'Le Skald' }) as HTMLInputElement).checked).toBe(true);
  });

  it("coach L'Ombre : son nom, ses deux avatars, et la feuille qui le coche", async () => {
    await renderCoach({ coach: 'ombre' });
    expect(await screen.findByRole('heading', { level: 2, name: "L'Ombre" })).toBeTruthy();
    expect(screen.getByRole('img', { name: "L'Ombre" })).toBeTruthy();
    expect(screen.getByRole('img', { name: "L'Ombre, mode nutrition" })).toBeTruthy();
    expect(screen.getByText(COACHES.ombre.temper)).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Le Skald' })).toBeNull();
    const sheet = await openSheet();
    expect(checked(sheet, "L'Ombre")).toBe(true);
    expect(checked(sheet, 'Le Skald')).toBe(false);
    expect(checked(sheet, 'Le Scribe')).toBe(false);
  });

  it('confirmé : le nouveau coach et son annonce, avant même que le profil soit relu', async () => {
    const { api } = await renderCoach();
    // Le serveur accepte sans que le miroir change : seul le choix confirmé peut montrer le Scribe.
    api.on('PATCH', PROFILE_PATH, { status: 200, body: makeMe() });
    await confirmScribe();
    expect(patches(api)).toEqual([{ coach: 'scribe' }]);
    expect(screen.getByRole('heading', { level: 2, name: 'Le Scribe' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Le Scribe, mode nutrition' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(NEW_SCRIBE);
  });
});

describe('MyCoachPage › coach relu après un pull', () => {
  it("l'annonce reste quand la relecture confirme le coach, et disparaît quand un autre appareil en choisit un autre", async () => {
    const { api, db } = await renderCoach();
    api.on('PATCH', PROFILE_PATH, { status: 200, body: makeMe() });
    await confirmScribe();
    // Le pull qui suit l'envoi relit le Scribe : l'annonce reste vraie.
    await seedProfile(db, { ...TRAINING, coach: 'scribe' });
    await settle();
    expect(screen.getByRole('heading', { level: 2, name: 'Le Scribe' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(NEW_SCRIBE);
    // Plus tard, un autre appareil choisit L'Ombre : le héros suit, l'annonce devenue fausse s'efface.
    await seedProfile(db, { ...TRAINING, coach: 'ombre' });
    expect(await screen.findByRole('heading', { level: 2, name: "L'Ombre" })).toBeTruthy();
    expect(screen.queryByText(NEW_SCRIBE)).toBeNull();
    // Revenu au Scribe ailleurs : l'ancienne annonce ne revient pas.
    await seedProfile(db, { ...TRAINING, coach: 'scribe' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Le Scribe' })).toBeTruthy();
    await settle();
    expect(screen.queryByText(NEW_SCRIBE)).toBeNull();
  });

  it('feuille ouverte quand un autre appareil change de coach : le coach relu est coché, rien à confirmer', async () => {
    const { db } = await renderCoach();
    const sheet = await openSheet();
    await seedProfile(db, { ...TRAINING, coach: 'ombre' });
    await until(() => checked(sheet, "L'Ombre"));
    expect(checked(sheet, 'Le Skald')).toBe(false);
    expect(sheet.queryByRole('button', { name: 'Choisir le Skald' })).toBeNull();
    expect(
      (sheet.getByRole('button', { name: 'Choisis un autre coach' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('feuille ouverte, un coach déjà choisi : la relecture ne le défait pas', async () => {
    const { db } = await renderCoach();
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('radio', { name: 'Le Scribe' }));
    await seedProfile(db, { ...TRAINING, coach: 'ombre' });
    await settle();
    expect(checked(sheet, 'Le Scribe')).toBe(true);
    expect(checked(sheet, "L'Ombre")).toBe(false);
    expect((sheet.getByRole('button', { name: 'Choisir le Scribe' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('nouvel appareil avant le premier pull : ni coach ni « Changer de coach », puis le coach tiré', async () => {
    const db = createTestLocalDb();
    const sync = createFakeSyncEngine();
    await renderApp({ path: '/profile/coach', db, sync });
    await screen.findByRole('heading', { level: 1, name: 'Mon coach' });
    await settle();
    // Un miroir vide ne dit pas « pas de coach » : rien n'est proposé sur cette base.
    expect(screen.queryByRole('button', { name: 'Changer de coach' })).toBeNull();
    expect(screen.queryByText('Choisis un coach')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    // Le premier pull apporte le profil (Le Skald) et réussit.
    await seedProfile(db);
    act(() => sync.set({ lastPullOkAt: '2026-10-15T08:00:00.000Z' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Le Skald' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Changer de coach' })).toBeTruthy();
  });
});
