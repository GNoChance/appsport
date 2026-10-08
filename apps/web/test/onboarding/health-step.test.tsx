import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, type MeResponse } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HealthStep } from '../../src/features/onboarding/HealthStep';
import { HEALTH_WARNING_TEXT } from '../../src/ui';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, newcomer, seedProfile, serveProfile } from '../support/onboarding';
import { renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const CAUTIOUS = 'Je préfère une progression plus prudente';
const SELF_CHECK = "Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer";
const consenting = (o: Partial<MeResponse> = {}) =>
  newcomer({
    consents: {
      health: { active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' },
      aiCoach: { active: false, textVersion: null, at: null },
    },
    ...o,
  });

async function renderHealth(me: MeResponse = newcomer()) {
  const db = createTestLocalDb();
  const api = createFakeApi();
  await seedProfile(db, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45 });
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

describe('HealthStep sans accord santé (E7, P-CST-1, P-CST-2)', () => {
  it('texte de l’accord, case décochée, « J’accepte et je renseigne » désactivé', async () => {
    await renderHealth();
    expect(screen.getByText(HEALTH_CONSENT_TEXT.text)).toBeTruthy();
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
    await screen.findByText('Nous te recommandons de consulter un médecin avant de commencer.');
    expect(body).toEqual({ answers: [true, false, false, false], questionnaireVersion: '1.0' });
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
