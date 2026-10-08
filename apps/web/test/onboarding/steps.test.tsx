import { EQUIPMENT, EQUIPMENT_LABELS, PRESETS, SPORTS } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilityStep } from '../../src/features/onboarding/AvailabilityStep';
import { ExperienceStep } from '../../src/features/onboarding/ExperienceStep';
import { GoalStep } from '../../src/features/onboarding/GoalStep';
import { PlaceKindStep } from '../../src/features/onboarding/PlaceKindStep';
import { PlaceStep } from '../../src/features/onboarding/PlaceStep';
import { SportStep } from '../../src/features/onboarding/SportStep';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import {
  button,
  checkbox,
  choose,
  currentStep,
  isChecked,
  newcomer,
  radio,
  seedPrimaryGym,
  seedProfile,
  serveProfile,
  writes,
} from '../support/onboarding';
import { makeMe, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const ADULT_GOALS = [
  'Prendre du muscle',
  'Gagner en force',
  'Perdre du gras',
  'Forme et santé',
  'Me renforcer pour mon sport',
];

/** Écran seul, avec un faux serveur du profil ; `profile` est écrit dans le miroir avant le rendu. */
async function renderStep(
  ui: (onNext: () => void) => ReactElement,
  o: { me?: ReturnType<typeof makeMe>; profile?: Parameters<typeof seedProfile>[1] } = {},
) {
  const me = o.me ?? newcomer();
  const db = createTestLocalDb();
  const api = createFakeApi();
  if (o.profile) await seedProfile(db, o.profile);
  const server = serveProfile(api, db, me);
  const onNext = vi.fn();
  const rendered = await renderWithServices(ui(onNext), { me, db, api });
  return { ...rendered, ...server, onNext };
}

const radioLabels = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('radio')
    .map((r) => r.closest('label')?.textContent);

describe('GoalStep (E1)', () => {
  it('mineur : pas de « Perdre du gras », 4 options (P-MIN, 02 §15 n°11)', async () => {
    await renderStep((onNext) => <GoalStep mode="onboarding" onNext={onNext} />, {
      me: newcomer({ ageBand: 'minor' }),
    });
    await screen.findByRole('radio', { name: 'Prendre du muscle' });
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByRole('radio', { name: 'Perdre du gras' })).toBeNull();
  });

  it('adulte : les 5 objectifs ; « Suivant » désactivé sans choix', async () => {
    await renderStep((onNext) => <GoalStep mode="onboarding" onNext={onNext} />);
    await screen.findByRole('radio', { name: 'Prendre du muscle' });
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(ADULT_GOALS);
    expect(button('Suivant').disabled).toBe(true);
  });

  it('édition : « Enregistrer » et PATCH { goal } sans onboardingStep', async () => {
    const t = await renderStep((onNext) => <GoalStep mode="edit" onNext={onNext} />, {
      me: makeMe(),
      profile: { goal: 'muscle' },
    });
    await until(() => isChecked('Prendre du muscle'));
    expect(screen.queryByRole('button', { name: 'Suivant' })).toBeNull();
    choose('Gagner en force');
    fireEvent.click(button('Enregistrer'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ goal: 'strength' }]);
  });

  it('édition sans sport : « Me renforcer pour mon sport » mène au sport, un seul PATCH', async () => {
    const t = await renderStep((onNext) => <GoalStep mode="edit" onNext={onNext} />, {
      me: makeMe(),
      profile: { goal: 'muscle' },
    });
    await until(() => isChecked('Prendre du muscle'));
    choose('Me renforcer pour mon sport');
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
    fireEvent.click(button('Suivant'));
    await screen.findByRole('radio', { name: 'Course à pied' });
    expect(t.patches).toEqual([]);
    choose('Course à pied');
    fireEvent.click(button('Enregistrer'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ goal: 'sport_support', sportCode: 'running', sportOtherLabel: null }]);
  });

  it('édition avec un sport enregistré : PATCH { goal: sport_support }', async () => {
    const t = await renderStep((onNext) => <GoalStep mode="edit" onNext={onNext} />, {
      me: makeMe(),
      profile: { goal: 'muscle', sportCode: 'tennis' },
    });
    await until(() => isChecked('Prendre du muscle'));
    choose('Me renforcer pour mon sport');
    fireEvent.click(button('Enregistrer'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ goal: 'sport_support' }]);
  });
});

describe('SportStep (E2)', () => {
  it('objectif sport : « Oui » imposé, « Non » désactivé, avec la raison', async () => {
    await renderStep((onNext) => <SportStep mode="onboarding" onNext={onNext} />, {
      profile: { goal: 'sport_support' },
    });
    await until(() => isChecked('Oui'));
    expect(radio('Non').disabled).toBe(true);
    expect(screen.getByText("Obligatoire avec l'objectif « Me renforcer pour mon sport ».")).toBeTruthy();
  });

  it('« Autre » + « Pétanque » : 15 sports, libellé de 40 caractères au plus', async () => {
    const t = await renderStep((onNext) => <SportStep mode="onboarding" onNext={onNext} />, {
      profile: { goal: 'muscle' },
    });
    await screen.findByRole('radio', { name: 'Oui' });
    choose('Oui');
    expect(radioLabels('Quel sport ?')).toEqual(SPORTS.map((s) => s.label));
    choose('Autre');
    expect(button('Suivant').disabled).toBe(true);
    const label = screen.getByLabelText('Ton sport') as HTMLInputElement;
    expect(label.maxLength).toBe(40);
    fireEvent.change(label, { target: { value: '   ' } });
    expect(button('Suivant').disabled).toBe(true);
    fireEvent.change(label, { target: { value: 'Pétanque' } });
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ sportCode: 'other', sportOtherLabel: 'Pétanque', onboardingStep: 'sport' }]);
  });

  it('« Non » → sport effacé', async () => {
    const t = await renderStep((onNext) => <SportStep mode="onboarding" onNext={onNext} />, {
      profile: { goal: 'muscle' },
    });
    await screen.findByRole('radio', { name: 'Non' });
    choose('Non');
    expect(screen.queryByRole('group', { name: 'Quel sport ?' })).toBeNull();
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ sportCode: null, sportOtherLabel: null, onboardingStep: 'sport' }]);
  });

  it('« Suivant » désactivé tant que la question n’a pas de réponse', async () => {
    await renderStep((onNext) => <SportStep mode="onboarding" onNext={onNext} />, {
      profile: { goal: 'muscle' },
    });
    await screen.findByRole('radio', { name: 'Non' });
    expect(radio('Non').checked).toBe(false);
    expect(radio('Oui').checked).toBe(false);
    expect(button('Suivant').disabled).toBe(true);
  });
});

function PlaceKindHarness(p: { onNext(): void }) {
  const [kind, setKind] = useState<'gym' | 'home' | null>(null);
  return <PlaceKindStep mode="onboarding" onNext={p.onNext} value={kind} onChange={setKind} />;
}

describe('PlaceKindStep (E3)', () => {
  it('« Où t’entraîneras-tu le plus souvent ? » : salle ou maison, puis PATCH de l’étape', async () => {
    const t = await renderStep((onNext) => <PlaceKindHarness onNext={onNext} />);
    expect(radioLabels("Où t'entraîneras-tu le plus souvent ?")).toEqual(['À la salle', 'À la maison']);
    expect(button('Suivant').disabled).toBe(true);
    choose('À la maison');
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ onboardingStep: 'place_kind' }]);
  });
});

describe('PlaceStep (E4)', () => {
  it('maison : nom « Maison », sans matériel par défaut, préréglage « Petit matériel », POST puis PATCH', async () => {
    const t = await renderStep((onNext) => <PlaceStep mode="onboarding" kind="home" onNext={onNext} />);
    t.api.on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    const name = (await screen.findByLabelText('Nom du lieu')) as HTMLInputElement;
    expect(name.value).toBe('Maison');
    expect(name.maxLength).toBe(30);
    expect(radioLabels('Ton matériel')).toEqual(['Sans matériel', 'Petit matériel', 'Home gym']);
    expect(radio('Sans matériel').checked).toBe(true);
    const household = within(screen.getByRole('group', { name: 'Objets du quotidien' }));
    expect(
      (household.getByRole('checkbox', { name: EQUIPMENT_LABELS.chair }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (household.getByRole('checkbox', { name: EQUIPMENT_LABELS.table }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(checkbox(EQUIPMENT_LABELS.dumbbells).checked).toBe(false);

    choose('Petit matériel');
    expect(checkbox(EQUIPMENT_LABELS.dumbbells).checked).toBe(true);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual(['POST /api/places', 'PATCH /api/me/training-profile']);
    expect(t.api.calls.find((c) => c.path === '/api/places')?.body).toEqual({
      kind: 'home',
      name: 'Maison',
      equipment: EQUIPMENT.filter((c) => PRESETS.home_small.equipment.includes(c)),
      isPrimary: true,
    });
    expect(t.patches).toEqual([{ onboardingStep: 'place' }]);
  });

  it('maison : changer de préréglage recoche la liste ; une case décochée reste décochée', async () => {
    await renderStep((onNext) => <PlaceStep mode="onboarding" kind="home" onNext={onNext} />);
    await screen.findByLabelText('Nom du lieu');
    fireEvent.click(checkbox(EQUIPMENT_LABELS.table));
    expect(checkbox(EQUIPMENT_LABELS.table).checked).toBe(false);
    choose('Home gym');
    expect(checkbox(EQUIPMENT_LABELS.table).checked).toBe(true);
    expect(checkbox(EQUIPMENT_LABELS.barbell).checked).toBe(true);
    choose('Sans matériel');
    expect(checkbox(EQUIPMENT_LABELS.barbell).checked).toBe(false);
  });

  it("maison : POST réussi puis PATCH hors ligne → « Suivant » renvoie seulement l'étape", async () => {
    const t = await renderStep((onNext) => <PlaceStep mode="onboarding" kind="home" onNext={onNext} />);
    // Le réseau tombe juste après la création du lieu : le PATCH qui suit échoue.
    t.api.on('POST', '/api/places', () => {
      t.api.setOffline('reject');
      return { status: 201, body: { id: 'p-1' } };
    });
    await screen.findByLabelText('Nom du lieu');
    fireEvent.click(button('Suivant'));
    expect((await screen.findByRole('alert')).textContent).toBe('Nécessite le réseau');
    expect(t.onNext).not.toHaveBeenCalled();
    t.api.setOffline(false);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(writes(t.api)).toEqual([
      'POST /api/places',
      'PATCH /api/me/training-profile',
      'PATCH /api/me/training-profile',
    ]);
  });

  it("salle : « Valider » du GymPicker → POST du lieu, PATCH de l'étape, puis le niveau", async () => {
    const me = newcomer({ onboardingStep: 'place_kind' });
    const db = createTestLocalDb();
    const api = createFakeApi()
      .on('GET', '/api/gyms', {
        status: 200,
        body: [{ id: 'g-1', name: 'Basic Fit', city: 'Lyon', visibleMemberCount: 2 }],
      })
      .on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    await seedProfile(db, { goal: 'muscle' });
    const server = serveProfile(api, db, me);
    await renderApp({ path: '/onboarding', me, db, api });
    await until(() => currentStep() === 'place_kind');
    choose('À la salle');
    fireEvent.click(button('Suivant'));
    await until(() => currentStep() === 'place');
    expect(screen.queryByRole('button', { name: 'Suivant' })).toBeNull();
    await screen.findByRole('radio', { name: 'Basic Fit · Lyon · 2 membres visibles' });
    choose('Basic Fit · Lyon · 2 membres visibles');
    fireEvent.click(button('Valider'));
    await until(() => currentStep() === 'experience');
    expect(server.patches).toEqual([{ onboardingStep: 'place_kind' }, { onboardingStep: 'place' }]);
    expect(api.calls.find((c) => c.path === '/api/places')?.body).toEqual({
      kind: 'gym',
      gymId: 'g-1',
      isPrimary: true,
      visibleAtGym: true,
    });
  });

  it('salle, mineur : case de visibilité décochée avec la raison ; « Valider » → visibleAtGym: false (P-MIN-6)', async () => {
    const me = newcomer({ ageBand: 'minor', onboardingStep: 'place_kind' });
    const db = createTestLocalDb();
    const api = createFakeApi()
      .on('GET', '/api/gyms', {
        status: 200,
        body: [{ id: 'g-1', name: 'Basic Fit', city: 'Lyon', visibleMemberCount: 2 }],
      })
      .on('POST', '/api/places', { status: 201, body: { id: 'p-1' } });
    await seedProfile(db, { goal: 'muscle' });
    serveProfile(api, db, me);
    await renderApp({ path: '/onboarding', me, db, api });
    await until(() => currentStep() === 'place_kind');
    choose('À la salle');
    fireEvent.click(button('Suivant'));
    await screen.findByRole('radio', { name: 'Basic Fit · Lyon · 2 membres visibles' });
    expect(checkbox('Apparaître dans « Qui va à cette salle »').checked).toBe(false);
    expect(screen.getByText('Désactivé par défaut pour les moins de 18 ans.')).toBeTruthy();
    choose('Basic Fit · Lyon · 2 membres visibles');
    fireEvent.click(button('Valider'));
    await until(() => currentStep() === 'experience');
    expect(api.calls.find((c) => c.path === '/api/places')?.body).toEqual({
      kind: 'gym',
      gymId: 'g-1',
      isPrimary: true,
      visibleAtGym: false,
    });
  });

  it('lieu principal existant : « Ton lieu principal : Basic Fit », aucun POST', async () => {
    const me = newcomer({ onboardingStep: 'place_kind' });
    const db = createTestLocalDb();
    const api = createFakeApi();
    await seedPrimaryGym(db);
    const server = serveProfile(api, db, me);
    const onNext = vi.fn();
    await renderWithServices(<PlaceStep mode="onboarding" kind="home" onNext={onNext} />, { me, db, api });
    await screen.findByText('Ton lieu principal : Basic Fit');
    expect(screen.queryByLabelText('Nom du lieu')).toBeNull();
    fireEvent.click(button('Suivant'));
    await until(() => onNext.mock.calls.length === 1);
    expect(writes(api)).toEqual(['PATCH /api/me/training-profile']);
    expect(server.patches).toEqual([{ onboardingStep: 'place' }]);
  });
});

describe('ExperienceStep (E5)', () => {
  it('question exacte ; « 6 mois à 2 ans » → PATCH', async () => {
    const t = await renderStep((onNext) => <ExperienceStep mode="onboarding" onNext={onNext} />);
    await screen.findByRole('radio', { name: 'Jamais' });
    const legend =
      'Depuis combien de temps fais-tu de la musculation régulièrement (au moins une fois par semaine) ?';
    expect(radioLabels(legend)).toEqual(['Jamais', 'Moins de 6 mois', '6 mois à 2 ans', 'Plus de 2 ans']);
    expect(button('Suivant').disabled).toBe(true);
    choose('6 mois à 2 ans');
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ experience: '6_to_24_months', onboardingStep: 'experience' }]);
  });

  it('niveau enregistré : coché, « Suivant » actif (R-ONB-2, R-ONB-3)', async () => {
    const t = await renderStep((onNext) => <ExperienceStep mode="onboarding" onNext={onNext} />, {
      me: newcomer({ onboardingStep: 'experience' }),
      profile: { experience: '6_to_24_months' },
    });
    await until(() => isChecked('6 mois à 2 ans'));
    expect(button('Suivant').disabled).toBe(false);
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ experience: '6_to_24_months', onboardingStep: 'experience' }]);
  });
});

describe('AvailabilityStep (E6)', () => {
  it('« 3 » (exact) et « 60 min » → PATCH ; les deux réponses sont exigées', async () => {
    const t = await renderStep((onNext) => <AvailabilityStep mode="onboarding" onNext={onNext} />);
    await screen.findByRole('radio', { name: '30 min' });
    expect(radioLabels('Séances par semaine')).toEqual(['2', '3', '4']);
    expect(radioLabels("Durée d'une séance")).toEqual(['30 min', '45 min', '60 min', '75 min', '90 min']);
    choose('3');
    expect(button('Suivant').disabled).toBe(true);
    choose('60 min');
    fireEvent.click(button('Suivant'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ daysPerWeek: 3, sessionMinutes: 60, onboardingStep: 'availability' }]);
  });

  it('édition : réponses enregistrées cochées, PATCH sans onboardingStep', async () => {
    const t = await renderStep((onNext) => <AvailabilityStep mode="edit" onNext={onNext} />, {
      me: makeMe(),
      profile: { daysPerWeek: 2, sessionMinutes: 45 },
    });
    await until(() => isChecked('2') && isChecked('45 min'));
    choose('4');
    fireEvent.click(button('Enregistrer'));
    await until(() => t.onNext.mock.calls.length === 1);
    expect(t.patches).toEqual([{ daysPerWeek: 4, sessionMinutes: 45 }]);
  });
});
