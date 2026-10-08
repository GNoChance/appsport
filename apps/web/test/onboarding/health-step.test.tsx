import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, type MeResponse } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HealthStep } from '../../src/features/onboarding/HealthStep';
import { HEALTH_WARNING_TEXT } from '../../src/ui';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, newcomer, seedProfile, serveProfile, writes } from '../support/onboarding';
import { renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const CAUTIOUS = 'Je préfère une progression plus prudente';
const SELF_CHECK = "Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer";
const SEE_DOCTOR = 'Nous te recommandons de consulter un médecin avant de commencer.';
const SCREENING_INCOMPLETE = 'Réponds aux 4 questions ou efface tes réponses avant de continuer.';
const DRAFT_INCOMPLETE = 'Termine ou efface la limitation en cours avant de continuer.';
const NOT_HEALTH_DATA = "Réglage d'entraînement, pas une donnée de santé : enregistré même sans accord.";
const SCREENING = 'PUT /api/me/health-screening';
const PATCH = 'PATCH /api/me/training-profile';
const consenting = (o: Partial<MeResponse> = {}) =>
  newcomer({
    consents: {
      health: { active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' },
      aiCoach: { active: false, textVersion: null, at: null },
    },
    ...o,
  });

async function renderHealth(me: MeResponse = newcomer(), profile: Parameters<typeof seedProfile>[1] = {}) {
  const db = createTestLocalDb();
  const api = createFakeApi();
  await seedProfile(db, {
    goal: 'muscle',
    experience: 'none',
    daysPerWeek: 3,
    sessionMinutes: 45,
    ...profile,
  });
  const server = serveProfile(api, db, me);
  const onNext = vi.fn();
  const rendered = await renderWithServices(<HealthStep mode="onboarding" onNext={onNext} />, {
    me,
    db,
    api,
  });
  await screen.findByRole('switch', { name: CAUTIOUS });
  return { ...rendered, ...server, onNext };
}

const toggle = () => screen.getByRole('switch', { name: CAUTIOUS }) as HTMLInputElement;
const question = (i: number) =>
  within(screen.getByRole('group', { name: HEALTH_QUESTIONNAIRE.questions[i] }));
const answer = (i: number, label: 'Oui' | 'Non') =>
  fireEvent.click(question(i).getByRole('radio', { name: label }));
const describedBy = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent);

describe('HealthStep sans accord santé (E7, P-CST-1, P-CST-2)', () => {
  it('texte de l’accord, case décochée, « J’accepte et je renseigne » désactivé', async () => {
    await renderHealth();
    expect(screen.getByText(HEALTH_CONSENT_TEXT.text)).toBeTruthy();
    // L'explication vise le questionnaire et les limitations, pas le mode prudent (C1).
    expect(
      screen.getByText(/^Tes réponses au questionnaire et tes limitations sont des données de santé\./),
    ).toBeTruthy();
    expect(screen.queryByText(/Les réponses de cet écran/)).toBeNull();
    const box = screen.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(button("J'accepte et je renseigne").disabled).toBe(true);
    fireEvent.click(box);
    expect(button("J'accepte et je renseigne").disabled).toBe(false);
  });

  it('« Passer » : les 4 questions en auto-vérification, aucune requête', async () => {
    const { api } = await renderHealth();
    fireEvent.click(button('Passer'));
    await screen.findByText(new RegExp(SELF_CHECK));
    for (const q of HEALTH_QUESTIONNAIRE.questions) expect(screen.getByText(q)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enregistrer mes réponses' })).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it('mode prudent : rien à la bascule, enregistré avec l’étape au clic sur « Suivant » (R-ONB-2)', async () => {
    const t = await renderHealth();
    expect(toggle().checked).toBe(false);
    fireEvent.click(toggle());
    expect(toggle().checked).toBe(true);
    expect(t.api.calls).toEqual([]);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ cautiousMode: true, onboardingStep: 'health' }]);
  });

  it('« Suivant » sans changement : seulement l’étape', async () => {
    const t = await renderHealth();
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ onboardingStep: 'health' }]);
  });

  it('mode prudent : présenté comme un réglage enregistré même sans accord (P-CST-2)', async () => {
    await renderHealth();
    expect(screen.getByText(NOT_HEALTH_DATA)).toBeTruthy();
    expect(describedBy(toggle())).toContain(NOT_HEALTH_DATA);
  });

  it('mode prudent enregistré : interrupteur coché ; le décocher envoie cautiousMode: false', async () => {
    const t = await renderHealth(newcomer(), { cautiousMode: true });
    await until(() => toggle().checked);
    fireEvent.click(toggle());
    expect(toggle().checked).toBe(false);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ cautiousMode: false, onboardingStep: 'health' }]);
  });

  it('accord donné : POST du consentement, puis le questionnaire enregistré', async () => {
    const t = await renderHealth();
    t.api.on('POST', '/api/me/consents', { status: 200, body: consenting() });
    fireEvent.click(screen.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }));
    fireEvent.click(button("J'accepte et je renseigne"));
    await screen.findByRole('button', { name: 'Enregistrer mes réponses' });
    expect(t.api.calls.find((c) => c.path === '/api/me/consents')?.body).toEqual({
      type: 'health',
      textVersion: '1.0',
    });
  });
});

describe('HealthStep avec accord santé', () => {
  it('Oui à la 1re question : PUT des réponses, recommandation de consulter', async () => {
    const t = await renderHealth(consenting());
    let body: unknown;
    t.api.on('PUT', '/api/me/health-screening', (req) => {
      body = req.body;
      return { status: 200, body: { caution: true } };
    });
    expect(button('Enregistrer mes réponses').disabled).toBe(true);
    fireEvent.click(question(0).getByRole('radio', { name: 'Oui' }));
    for (const i of [1, 2, 3]) fireEvent.click(question(i).getByRole('radio', { name: 'Non' }));
    fireEvent.click(button('Enregistrer mes réponses'));
    await screen.findByText('Réponses enregistrées.');
    expect(screen.getByText(SEE_DOCTOR)).toBeTruthy();
    expect(body).toEqual({ answers: [true, false, false, false], questionnaireVersion: '1.0' });
  });

  it('un seul « Oui » affiche tout de suite la recommandation, sans requête (E7.2)', async () => {
    const t = await renderHealth(consenting());
    expect(screen.queryByText(SEE_DOCTOR)).toBeNull();
    answer(2, 'Oui');
    expect(screen.getByText(SEE_DOCTOR)).toBeTruthy();
    expect(t.api.calls).toEqual([]);
    answer(2, 'Non');
    expect(screen.queryByText(SEE_DOCTOR)).toBeNull();
  });

  it('réponses non enregistrées : « Suivant » envoie le PUT puis le PATCH (R-ONB-2, R-CST-7)', async () => {
    const t = await renderHealth(consenting());
    let body: unknown;
    t.api.on('PUT', '/api/me/health-screening', (req) => {
      body = req.body;
      return { status: 200, body: { caution: true } };
    });
    answer(0, 'Oui');
    for (const i of [1, 2, 3]) answer(i, 'Non');
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual([SCREENING, PATCH]);
    expect(body).toEqual({ answers: [true, false, false, false], questionnaireVersion: '1.0' });
    expect(t.patches).toEqual([{ onboardingStep: 'health' }]);
  });

  it('réponses déjà enregistrées : « Suivant » ne renvoie pas le questionnaire', async () => {
    const t = await renderHealth(consenting());
    t.api.on('PUT', '/api/me/health-screening', { status: 200, body: { caution: false } });
    for (const i of [0, 1, 2, 3]) answer(i, 'Non');
    fireEvent.click(button('Enregistrer mes réponses'));
    await screen.findByText('Réponses enregistrées.');
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual([SCREENING, PATCH]);
  });

  it('hors ligne : le « Oui » affiche la recommandation ; « Suivant » → « Nécessite le réseau »', async () => {
    const t = await renderHealth(consenting());
    t.api.setOffline('reject');
    answer(0, 'Oui');
    expect(screen.getByText(SEE_DOCTOR)).toBeTruthy();
    for (const i of [1, 2, 3]) answer(i, 'Non');
    fireEvent.click(button('Suivant'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(t.onNext).not.toHaveBeenCalled();
    expect(t.patches).toEqual([]);
    expect(screen.getByText(SEE_DOCTOR)).toBeTruthy();
  });

  it('réponses incomplètes : « Suivant » s’arrête avec un message ; « Effacer mes réponses » débloque', async () => {
    const t = await renderHealth(consenting());
    answer(0, 'Oui');
    fireEvent.click(button('Suivant'));
    expect((await screen.findByRole('alert')).textContent).toBe(SCREENING_INCOMPLETE);
    expect(t.api.calls).toEqual([]);
    fireEvent.click(button('Effacer mes réponses'));
    expect(screen.queryByText(SCREENING_INCOMPLETE)).toBeNull();
    expect(screen.queryAllByRole('radio', { checked: true })).toEqual([]);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual([PATCH]);
  });

  it('limitations : « aucun diagnostic », « Aucune », ajout avec note de 200 caractères au plus', async () => {
    const t = await renderHealth(consenting());
    let body: unknown;
    t.api.on('POST', '/api/me/limitations', async (req) => {
      body = req.body;
      await seedMirror(t.db, 'limitation', [
        {
          id: 'l-1',
          ownerId: 'u-1',
          bodyArea: 'knee',
          side: 'left',
          severity: 'mild',
          note: 'entorse ancienne',
          active: true,
        },
      ]);
      return { status: 201, body: { id: 'l-1' } };
    });
    expect(screen.getByText(/aucun diagnostic n'est nécessaire/)).toBeTruthy();
    await screen.findByText('Aucune');
    expect(button('Ajouter une limitation').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'knee' } });
    fireEvent.change(screen.getByLabelText('Côté'), { target: { value: 'left' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Légère' }));
    const note = screen.getByLabelText('Note') as HTMLInputElement;
    expect(note.maxLength).toBe(200);
    fireEvent.change(note, { target: { value: 'entorse ancienne' } });
    fireEvent.click(button('Ajouter une limitation'));
    await screen.findByText('Genou · Gauche · Légère');
    expect(body).toEqual({ bodyArea: 'knee', side: 'left', severity: 'mild', note: 'entorse ancienne' });
    expect(screen.queryByText('Aucune')).toBeNull();
    expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('');
  });

  it('limitation existante : « Supprimer » → DELETE', async () => {
    const db = createTestLocalDb();
    await seedMirror(db, 'limitation', [
      {
        id: 'l-1',
        ownerId: 'u-1',
        bodyArea: 'hip',
        side: 'both',
        severity: 'severe',
        note: null,
        active: true,
      },
    ]);
    const api = createFakeApi().on('DELETE', '/api/me/limitations/:id', { status: 204 });
    await renderWithServices(<HealthStep mode="onboarding" onNext={() => {}} />, {
      me: consenting(),
      db,
      api,
    });
    await screen.findByText("Hanche · Les deux · Forte : m'empêche certains mouvements");
    fireEvent.click(button('Supprimer'));
    await until(() => api.calls.some((c) => c.method === 'DELETE'));
    expect(api.calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/me/limitations/l-1');
  });

  it('limitation remplie sans « Ajouter » : « Suivant » l’envoie, puis l’étape (R-ONB-2)', async () => {
    const t = await renderHealth(consenting());
    let body: unknown;
    t.api.on('POST', '/api/me/limitations', (req) => {
      body = req.body;
      return { status: 201, body: { id: 'l-1' } };
    });
    await screen.findByText('Aucune');
    fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'knee' } });
    fireEvent.change(screen.getByLabelText('Côté'), { target: { value: 'left' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Légère' }));
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual(['POST /api/me/limitations', PATCH]);
    expect(body).toEqual({ bodyArea: 'knee', side: 'left', severity: 'mild', note: null });
  });

  it('limitation incomplète : « Suivant » s’arrête avec un message ; « Effacer la saisie » débloque', async () => {
    const t = await renderHealth(consenting());
    await screen.findByText('Aucune');
    fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'knee' } });
    fireEvent.click(button('Suivant'));
    expect((await screen.findByRole('alert')).textContent).toBe(DRAFT_INCOMPLETE);
    expect(t.api.calls).toEqual([]);
    fireEvent.click(button('Effacer la saisie'));
    expect((screen.getByLabelText('Zone') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByText(DRAFT_INCOMPLETE)).toBeNull();
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual([PATCH]);
  });
});

describe('HealthStep pour un mineur (R-CST-7)', () => {
  it('mode prudent coché, désactivé et imposé ; avertissement santé ; « Suivant » actif sans réponse', async () => {
    const t = await renderHealth(newcomer({ ageBand: 'minor', cautious: true }));
    expect(toggle().checked).toBe(true);
    expect(toggle().disabled).toBe(true);
    expect(screen.getByText("Imposé jusqu'à 18 ans")).toBeTruthy();
    expect(screen.getByText(HEALTH_WARNING_TEXT)).toBeTruthy();
    expect(button('Suivant').disabled).toBe(false);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ onboardingStep: 'health' }]);
  });
});
