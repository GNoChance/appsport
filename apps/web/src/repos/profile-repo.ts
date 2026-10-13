import {
  COACH_IDS,
  type CoachId,
  DAYS_PER_WEEK,
  EXPERIENCES,
  type Experience,
  GOALS,
  type Goal,
  MeResponse,
  SESSION_MINUTES,
  SPORT_CODES,
  type SportCode,
  type TrainingProfilePatch,
} from '@rune/contracts';
import type { firstIncompleteStep } from '@rune/domain';
import type { AppServices } from '../app-services';
import { getMeta, setMeta } from '../local-db/meta';
import { currentUserId, isLive, oneOf, ownedRows, sendThenPull, text } from './rows';

export interface TrainingProfileView {
  goal: Goal | null;
  experience: Experience | null;
  daysPerWeek: 2 | 3 | 4 | null;
  sessionMinutes: 30 | 45 | 60 | 75 | 90 | null;
  sportCode: SportCode | null;
  sportOtherLabel: string | null;
  cautiousMode: boolean;
  /** Null tant qu'aucun coach n'est choisi (première étape de l'onboarding). */
  coach: CoachId | null;
}

export interface ProfileRepo {
  get(): Promise<TrainingProfileView | null>;
  update(p: TrainingProfilePatch): Promise<MeResponse>;
  /** Choix ou changement du coach (classe E : hors ligne, « Nécessite le réseau »). */
  setCoach(coach: CoachId): Promise<void>;
  completeOnboarding(): Promise<MeResponse>;
  onboardingInput(): Promise<Parameters<typeof firstIncompleteStep>[0]>;
}

export function createProfileRepo(s: AppServices): ProfileRepo {
  const { db } = s;

  async function get(): Promise<TrainingProfileView | null> {
    const userId = await currentUserId(db);
    if (userId === null) return null;
    // id = owner_id pour training_profile.
    const row = await db.mirror('training_profile').get(userId);
    if (!row || !isLive(row)) return null;
    return {
      goal: oneOf(GOALS, row.goal),
      experience: oneOf(EXPERIENCES, row.experience),
      daysPerWeek: oneOf(DAYS_PER_WEEK, row.daysPerWeek),
      sessionMinutes: oneOf(SESSION_MINUTES, row.sessionMinutes),
      sportCode: oneOf(SPORT_CODES, row.sportCode),
      sportOtherLabel: text(row.sportOtherLabel),
      cautiousMode: row.cautiousMode === true,
      coach: oneOf(COACH_IDS, row.coach),
    };
  }

  const saveMe = (me: MeResponse) => setMeta(db, 'me', me);
  const update = (p: TrainingProfilePatch) =>
    sendThenPull(s, 'PATCH', '/api/me/training-profile', { body: p, schema: MeResponse, apply: saveMe });

  return {
    get,
    update,
    async setCoach(coach) {
      await update({ coach });
    },
    completeOnboarding: () =>
      sendThenPull(s, 'POST', '/api/me/onboarding/complete', { schema: MeResponse, apply: saveMe }),
    async onboardingInput() {
      const profile = await get();
      const places = await ownedRows(db, 'place', await currentUserId(db));
      return {
        goal: profile?.goal ?? null,
        experience: profile?.experience ?? null,
        daysPerWeek: profile?.daysPerWeek ?? null,
        sessionMinutes: profile?.sessionMinutes ?? null,
        hasPrimaryPlace: places.some((p) => p.isPrimary === true),
        lastValidatedStep: (await getMeta(db, 'me'))?.onboardingStep ?? null,
      };
    },
  };
}
