import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, type MeResponse } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppDb } from '../../src/local-db/db';
import { settle } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { button, seedProfile, serveProfile } from '../support/onboarding';
import { makeMe, renderApp } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const CAUTIOUS = 'Je préfère une progression plus prudente';
const SELF_CHECK = "Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer.";
const LIMITATION = 'Genou · Gauche · Légère';
const SEVERE = "Forte : m'empêche certains mouvements";
const SCREENING_PATH = '/api/me/health-screening';
const SAVED = 'Réponses enregistrées.';
const SCREENING_TITLE = "Questionnaire d'alerte";
const LIMITATION_PATH = '/api/me/limitations/l-1';

const consented = (o: Partial<MeResponse> = {}): MeResponse =>
  makeMe({
    consents: {
      health: { active: true, textVersion: '1.0', at: '2026-10-01T10:00:00.000Z' },
      aiCoach: { active: false, textVersion: null, at: null },
    },
    ...o,
  });

/** Limitation l-2 « Épaule · Droite · Légère ». */
const SHOULDER = 'Épaule · Droite · Légère';
const shoulder = (o: Record<string, unknown> = {}) => ({
  id: 'l-2',
  ownerId: 'u-1',
  bodyArea: 'shoulder',
  side: 'right',
  severity: 'mild',
  note: null,
  active: true,
  ...o,
});
const knee = (o: Record<string, unknown> = {}) => ({
  id: 'l-1',
  ownerId: 'u-1',
  bodyArea: 'knee',
  side: 'left',
  severity: 'mild',
  note: null,
  active: true,
  ...o,
});

async function seedScreening(db: AppDb, answeredAt: string): Promise<void> {
  await seedMirror(db, 'health_screening', [
    { id: 'u-1', ownerId: 'u-1', caution: false, questionnaireVersion: '1.0', answeredAt },
  ]);
}

async function renderHealth(
  o: { me?: MeResponse; api?: FakeApi; cautiousMode?: boolean; screening?: boolean } = {},
) {
  const me = o.me ?? consented();
  const db = createTestLocalDb();
  const api = o.api ?? createFakeApi();
  await seedProfile(db, {
    goal: 'muscle',
    experience: 'none',
    daysPerWeek: 3,
    sessionMinutes: 45,
    cautiousMode: o.cautiousMode ?? true,
  });
  if (me.consents.health.active) {
    // Réponse du 03/10, accord du 01/10 : la date affichée est bien celle du questionnaire.
    if (o.screening !== false) await seedScreening(db, '2026-10-03T10:00:00.000Z');
    await seedMirror(db, 'limitation', [knee()]);
  }
  const server = serveProfile(api, db, me);
  const view = await renderApp({ path: '/profile/health', me, db, api });
  await screen.findByRole('heading', { level: 1, name: 'Santé' });
  return { ...view, ...server };
}

/** Élément de la liste des limitations portant `label`. */
const limitationItem = (label: string) => {
  const li = screen.getByText(label).closest('li');
  if (!li) throw new Error(`aucune limitation ${label}`);
  return within(li);
};
const editButton = (label: string) =>
  limitationItem(label).getByRole('button', { name: 'Modifier' }) as HTMLButtonElement;
/** Section nommée par son titre (h2). */
const section = (title: string) => {
  const el = screen.getByRole('heading', { level: 2, name: title }).closest('section');
  if (!el) throw new Error(`aucune section ${title}`);
  return el;
};

const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);
const question = (i: number) =>
  within(screen.getByRole('group', { name: HEALTH_QUESTIONNAIRE.questions[i] }));
const editForm = () => within(screen.getByRole('form', { name: `Modifier : ${LIMITATION}` }));

describe('HealthSection sans accord (E7, P-CST-1, P-CST-2)', () => {
  it("accord proposé (case décochée) et auto-vérification ; l'accord donné ouvre le questionnaire enregistré", async () => {
    const api = createFakeApi().on('POST', '/api/me/consents', { status: 200, body: consented() });
    await renderHealth({ me: makeMe(), api });
    const box = screen.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(SELF_CHECK)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Oui' })).toBeNull();
    // L'auto-vérification a sa propre section, distincte de l'accord (P-CST-2, glossaire).
    expect(section('Accord santé').contains(box)).toBe(true);
    expect(section('Accord santé').contains(screen.getByText(SELF_CHECK))).toBe(false);
    expect(section(SCREENING_TITLE).contains(screen.getByText(SELF_CHECK))).toBe(true);
    fireEvent.click(box);
    fireEvent.click(button("J'accepte et je renseigne"));
    await screen.findByRole('group', { name: HEALTH_QUESTIONNAIRE.questions[0] });
    expect(sent(api, 'POST', '/api/me/consents')).toEqual([{ type: 'health', textVersion: '1.0' }]);
    expect(button('Enregistrer mes réponses')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Limitations' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text })).toBeNull();
  });
});

describe('HealthSection avec accord (E7, P-DRT-2)', () => {
  it("dernière réponse (date du questionnaire, pas de l'accord), indicateur et limitations « Genou · Gauche · Légère »", async () => {
    await renderHealth();
    expect(await screen.findByText('Dernière réponse le 03/10/2026')).toBeTruthy();
    expect(screen.getByText('Indicateur de prudence : inactif')).toBeTruthy();
    expect(section(SCREENING_TITLE).textContent).toContain('Dernière réponse le 03/10/2026');
    expect(await screen.findByText(LIMITATION)).toBeTruthy();
    // Questionnaire déjà répondu : les questions attendent « Répondre de nouveau ».
    expect(screen.queryByRole('group', { name: HEALTH_QUESTIONNAIRE.questions[0] })).toBeNull();
  });

  it('« Répondre de nouveau » → PUT /api/me/health-screening { answers, questionnaireVersion }', async () => {
    const api = createFakeApi().on('PUT', SCREENING_PATH, { status: 200, body: { caution: false } });
    await renderHealth({ api });
    fireEvent.click(await screen.findByRole('button', { name: 'Répondre de nouveau' }));
    for (let i = 0; i < 4; i++) fireEvent.click(question(i).getByRole('radio', { name: 'Non' }));
    fireEvent.click(button('Enregistrer mes réponses'));
    await until(() => sent(api, 'PUT', SCREENING_PATH).length === 1);
    expect(sent(api, 'PUT', SCREENING_PATH)).toEqual([
      { answers: [false, false, false, false], questionnaireVersion: '1.0' },
    ]);
    const again = await screen.findByRole('button', { name: 'Répondre de nouveau' });
    // Enregistré : confirmation annoncée dans le résumé, focus sur « Répondre de nouveau ».
    expect(within(section(SCREENING_TITLE)).getByRole('status').textContent).toBe(SAVED);
    await until(() => document.activeElement === again);
    fireEvent.click(again);
    expect(screen.queryByText(SAVED)).toBeNull();
    fireEvent.click(button('Annuler'));
    await until(() => document.activeElement === button('Répondre de nouveau'));
    expect(screen.queryByText(SAVED)).toBeNull();
  });

  it("premier questionnaire relu avant la fin de l'envoi : le focus va quand même à « Répondre de nouveau »", async () => {
    const api = createFakeApi();
    const { db } = await renderHealth({ api, screening: false });
    // Comme un pull pendant l'envoi : la ligne arrive dans le miroir et l'écran la relit (rendu et
    // effets passés) avant la réponse.
    api.on('PUT', SCREENING_PATH, async () => {
      await seedScreening(db, '2026-10-06T12:00:00.000Z');
      await until(() => screen.queryByRole('button', { name: 'Enregistrer mes réponses' }) === null);
      await settle();
      return { status: 200, body: { caution: false } };
    });
    await screen.findByRole('group', { name: HEALTH_QUESTIONNAIRE.questions[0] });
    for (let i = 0; i < 4; i++) fireEvent.click(question(i).getByRole('radio', { name: 'Non' }));
    const save = button('Enregistrer mes réponses');
    save.focus();
    fireEvent.click(save);
    const again = await screen.findByRole('button', { name: 'Répondre de nouveau' });
    await until(() => document.activeElement === again);
    expect((await within(section(SCREENING_TITLE)).findByRole('status')).textContent).toBe(SAVED);
    expect(screen.getByText('Dernière réponse le 06/10/2026')).toBeTruthy();
  });

  it('« Supprimer » → DELETE /api/me/limitations/l-1 {}', async () => {
    const api = createFakeApi().on('DELETE', LIMITATION_PATH, { status: 204 });
    await renderHealth({ api });
    await screen.findByText(LIMITATION);
    fireEvent.click(button('Supprimer'));
    await until(() => sent(api, 'DELETE', LIMITATION_PATH).length === 1);
    expect(sent(api, 'DELETE', LIMITATION_PATH)).toEqual([{}]);
  });

  it('« Modifier » → PATCH /api/me/limitations/l-1 avec les seuls champs changés', async () => {
    const api = createFakeApi().on('PATCH', LIMITATION_PATH, { status: 204 });
    await renderHealth({ api });
    await screen.findByText(LIMITATION);
    fireEvent.click(button('Modifier'));
    const form = editForm();
    expect((form.getByLabelText('Zone') as HTMLSelectElement).value).toBe('knee');
    expect((form.getByLabelText('Côté') as HTMLSelectElement).value).toBe('left');
    expect((form.getByRole('radio', { name: 'Légère' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(form.getByRole('radio', { name: SEVERE }));
    fireEvent.click(form.getByRole('button', { name: 'Enregistrer' }));
    await until(() => screen.queryByRole('form', { name: `Modifier : ${LIMITATION}` }) === null);
    expect(sent(api, 'PATCH', LIMITATION_PATH)).toEqual([{ severity: 'severe' }]);
    await until(() => document.activeElement === button('Modifier'));
  });

  it("« Modifier » : seuls les champs changés depuis l'ouverture partent, même après une relecture", async () => {
    const api = createFakeApi().on('PATCH', LIMITATION_PATH, { status: 204 });
    const { db } = await renderHealth({ api });
    await screen.findByText(LIMITATION);
    fireEvent.click(button('Modifier'));
    // Un autre appareil passe la gêne à « Forte » pendant la saisie.
    await seedMirror(db, 'limitation', [knee({ severity: 'severe' })]);
    await settle();
    fireEvent.change(editForm().getByLabelText('Côté'), { target: { value: 'right' } });
    fireEvent.click(editForm().getByRole('button', { name: 'Enregistrer' }));
    await until(() => sent(api, 'PATCH', LIMITATION_PATH).length === 1);
    expect(sent(api, 'PATCH', LIMITATION_PATH)).toEqual([{ side: 'right' }]);
  });

  it('« Modifier » puis « Enregistrer » sans changement : aucune requête', async () => {
    const { api } = await renderHealth();
    await screen.findByText(LIMITATION);
    fireEvent.click(button('Modifier'));
    fireEvent.click(editForm().getByRole('button', { name: 'Enregistrer' }));
    await until(() => screen.queryByRole('form', { name: `Modifier : ${LIMITATION}` }) === null);
    expect(sent(api, 'PATCH', LIMITATION_PATH)).toEqual([]);
  });

  it("« Modifier » ouvert ou en cours d'envoi : les autres « Modifier » attendent, aucun autre formulaire n'est fermé", async () => {
    const pending: (() => void)[] = [];
    const api = createFakeApi().on(
      'PATCH',
      LIMITATION_PATH,
      () =>
        new Promise((resolve) => {
          pending.push(() => resolve({ status: 204 }));
        }),
    );
    const { db } = await renderHealth({ api });
    await seedMirror(db, 'limitation', [shoulder()]);
    await screen.findByText(SHOULDER);
    fireEvent.click(editButton(LIMITATION));
    expect(editButton(SHOULDER).disabled).toBe(true);
    fireEvent.click(editForm().getByRole('radio', { name: SEVERE }));
    fireEvent.click(editForm().getByRole('button', { name: 'Enregistrer' }));
    await until(() => pending.length === 1);
    expect(editButton(SHOULDER).disabled).toBe(true);
    pending[0]?.();
    await until(() => screen.queryByRole('form', { name: `Modifier : ${LIMITATION}` }) === null);
    await until(() => document.activeElement === editButton(LIMITATION));
    expect(editButton(SHOULDER).disabled).toBe(false);
  });

  it('limitation en cours de modification supprimée ailleurs : les autres « Modifier » se libèrent', async () => {
    const { db } = await renderHealth();
    await seedMirror(db, 'limitation', [shoulder()]);
    await screen.findByText(SHOULDER);
    fireEvent.click(editButton(LIMITATION));
    expect(editButton(SHOULDER).disabled).toBe(true);
    await seedMirror(db, 'limitation', [knee({ deletedAt: '2026-10-06T11:00:00.000Z' })]);
    await until(() => screen.queryByRole('form', { name: `Modifier : ${LIMITATION}` }) === null);
    await until(() => !editButton(SHOULDER).disabled);
    expect(screen.queryByText(LIMITATION)).toBeNull();
  });

  it('403 health_consent_required → « Cette action demande ton accord santé. »', async () => {
    const api = createFakeApi().on('PATCH', LIMITATION_PATH, {
      status: 403,
      body: { error: 'health_consent_required' },
    });
    await renderHealth({ api });
    await screen.findByText(LIMITATION);
    fireEvent.click(button('Modifier'));
    fireEvent.click(editForm().getByRole('radio', { name: SEVERE }));
    fireEvent.click(editForm().getByRole('button', { name: 'Enregistrer' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Cette action demande ton accord santé.');
    expect(screen.getByRole('form', { name: `Modifier : ${LIMITATION}` })).toBeTruthy();
  });
});

describe('HealthSection › mode prudent (E7.5, R-CST-7)', () => {
  it('CautiousModeToggle → PATCH /api/me/training-profile { cautiousMode: false }', async () => {
    const t = await renderHealth({ cautiousMode: true });
    const toggle = (await screen.findByRole('switch', { name: CAUTIOUS })) as HTMLInputElement;
    await until(() => toggle.checked);
    fireEvent.click(toggle);
    await until(() => t.patches.length === 1);
    expect(t.patches).toEqual([{ cautiousMode: false }]);
  });

  it('mineur : interrupteur imposé et désactivé', async () => {
    await renderHealth({ me: consented({ ageBand: 'minor', birthDate: '2009-01-01' }), cautiousMode: false });
    const toggle = (await screen.findByRole('switch', { name: CAUTIOUS })) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.checked).toBe(true);
  });
});
