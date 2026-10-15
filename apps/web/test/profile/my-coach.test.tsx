import type { CoachId } from '@rune/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COACHES, coachText } from '../../src/features/coach/coach-lines';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { PROFILE_PATH, seedProfile, serveProfile } from '../support/onboarding';
import { makeMe, renderApp } from '../support/render';
import { until } from '../support/wait';

const LATER =
  "Pour l'instant, ton coach parle avec des messages préparés à l'avance. La vraie conversation arrivera plus tard.";

async function renderCoach(o: { api?: FakeApi; coach?: CoachId } = {}) {
  const me = makeMe();
  const db = createTestLocalDb();
  const api = o.api ?? createFakeApi();
  await seedProfile(db, {
    goal: 'muscle',
    experience: 'none',
    daysPerWeek: 3,
    sessionMinutes: 45,
    coach: o.coach ?? 'skald',
  });
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
});
