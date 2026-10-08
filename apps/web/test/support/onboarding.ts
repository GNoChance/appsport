import { defaultLoadSettings, type MeResponse, type TrainingProfilePatch } from '@appsport/contracts';
import { fireEvent, screen } from '@testing-library/react';
import type { AppDb } from '../../src/local-db/db';
import type { FakeApi } from './fake-api';
import { makeMe } from './render';
import { seedMirror } from './seed';

export const PROFILE_PATH = '/api/me/training-profile';

/** Profil d'entraînement d'un nouveau compte : rien n'est encore répondu. */
export const EMPTY_PROFILE = {
  goal: null,
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  sportCode: null,
  sportOtherLabel: null,
  cautiousMode: false,
};

type ProfileFields = { [K in keyof typeof EMPTY_PROFILE]?: unknown };

/** Membre adulte dont l'onboarding n'est pas terminé (aucun écran validé par défaut). */
export function newcomer(o: Partial<MeResponse> = {}): MeResponse {
  return makeMe({ onboardingCompletedAt: null, onboardingStep: null, ...o });
}

export async function seedProfile(db: AppDb, fields: ProfileFields = {}, ownerId = 'u-1'): Promise<void> {
  await seedMirror(db, 'training_profile', [{ id: ownerId, ownerId, ...EMPTY_PROFILE, ...fields }]);
}

/** Salle « Basic Fit » à Lyon, lieu principal de `ownerId`. */
export async function seedPrimaryGym(db: AppDb, ownerId = 'u-1'): Promise<void> {
  await seedMirror(db, 'gym', [
    {
      id: 'g-1',
      name: 'Basic Fit',
      nameKey: 'basic fit',
      city: 'Lyon',
      cityKey: 'lyon',
      loadSettings: defaultLoadSettings('gym'),
    },
  ]);
  await seedMirror(db, 'place', [
    {
      id: 'p-1',
      ownerId,
      kind: 'gym',
      gymId: 'g-1',
      name: null,
      isPrimary: true,
      visibleAtGym: true,
      loadSettings: null,
    },
  ]);
}

/**
 * Faux serveur du profil d'entraînement : chaque PATCH est noté, ses champs sont écrits dans le
 * miroir `training_profile` (comme le pull qui suit l'envoi) et la réponse est `me` avec la
 * dernière étape validée.
 */
export function serveProfile(api: FakeApi, db: AppDb, me: MeResponse): { patches: TrainingProfilePatch[] } {
  const patches: TrainingProfilePatch[] = [];
  let current = me;
  api.on('PATCH', PROFILE_PATH, async (req) => {
    const body = req.body as TrainingProfilePatch;
    patches.push(body);
    const { onboardingStep, ...fields } = body;
    const row = await db.mirror('training_profile').get(me.id);
    await seedMirror(db, 'training_profile', [
      { ...EMPTY_PROFILE, ...row, ...fields, id: me.id, ownerId: me.id },
    ]);
    current = { ...current, onboardingStep: onboardingStep ?? current.onboardingStep };
    return { status: 200, body: current };
  });
  return { patches };
}

/** Requêtes d'écriture envoyées, dans l'ordre (`POST /api/places`…). */
export const writes = (api: FakeApi): string[] =>
  api.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);

export const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
export const checkbox = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
export const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

/** Radio coché, sans lever s'il n'est pas (encore) affiché. */
export const isChecked = (name: string): boolean =>
  (screen.queryByRole('radio', { name }) as HTMLInputElement | null)?.checked === true;

export function choose(name: string): void {
  fireEvent.click(radio(name));
}

/** Conteneur de l'écran courant (`data-step`). */
export const currentStep = (): string | null =>
  screen.queryByTestId('onboarding-step')?.getAttribute('data-step') ?? null;
