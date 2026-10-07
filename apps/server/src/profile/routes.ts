import {
  type Experience,
  type Goal,
  ONBOARDING_STEPS,
  SPORT_OTHER_LABEL_MAX,
  TrainingProfilePatch,
} from '@appsport/contracts';
import { ageBandOn, availableGoals, firstIncompleteStep, parisDate } from '@appsport/domain';
import { Hono } from 'hono';
import type { AppEnv, SessionUser } from '../app-env';
import { buildMe } from '../auth/me';
import { requireUser } from '../auth/session';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';
import { parseJson } from '../http/validate';

interface ProfileState {
  goal: Goal | null;
  experience: Experience | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  sportCode: string | null;
  sportOtherLabel: string | null;
  cautiousMode: number;
}

const EMPTY_PROFILE: ProfileState = {
  goal: null,
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  sportCode: null,
  sportOtherLabel: null,
  cautiousMode: 0,
};

const stepIndex = (step: string | null): number =>
  step === null ? -1 : ONBOARDING_STEPS.indexOf(step as (typeof ONBOARDING_STEPS)[number]);

const invalid = (field: string) => httpError('validation', { field });

async function patchProfile(
  trx: DbExecutor,
  deps: AppDeps,
  sessionUser: SessionUser,
  patch: TrainingProfilePatch,
): Promise<void> {
  const userId = sessionUser.id;
  const user = await trx
    .selectFrom('user')
    .select(['birthDate', 'onboardingStep', 'onboardingCompletedAt'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  const row = await trx
    .selectFrom('trainingProfile')
    .select(Object.keys(EMPTY_PROFILE) as (keyof ProfileState)[])
    .where('id', '=', userId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  const current: ProfileState = row ?? EMPTY_PROFILE;

  const merged: ProfileState = {
    goal: patch.goal ?? current.goal,
    experience: patch.experience ?? current.experience,
    daysPerWeek: patch.daysPerWeek ?? current.daysPerWeek,
    sessionMinutes: patch.sessionMinutes ?? current.sessionMinutes,
    sportCode: patch.sportCode === undefined ? current.sportCode : patch.sportCode,
    sportOtherLabel: patch.sportOtherLabel === undefined ? current.sportOtherLabel : patch.sportOtherLabel,
    cautiousMode: patch.cautiousMode === undefined ? current.cautiousMode : patch.cautiousMode ? 1 : 0,
  };

  const ageBand = ageBandOn(user.birthDate, parisDate(deps.clock.now()));
  if (patch.goal !== undefined && !availableGoals(ageBand).includes(patch.goal)) throw invalid('goal');

  if (merged.sportCode === 'other') {
    if (merged.sportOtherLabel === null || merged.sportOtherLabel.length > SPORT_OTHER_LABEL_MAX) {
      throw invalid('sportOtherLabel');
    }
  } else {
    if (patch.sportOtherLabel != null) throw invalid('sportOtherLabel');
    merged.sportOtherLabel = null;
  }

  const writtenStep = patch.onboardingStep ?? user.onboardingStep;
  const sportRequired = user.onboardingCompletedAt !== null || stepIndex(writtenStep) >= stepIndex('sport');
  if (merged.goal === 'sport_support' && merged.sportCode === null && sportRequired)
    throw invalid('sportCode');

  if (!row) {
    const stamp = await writeStamp(trx, deps, userId);
    await trx
      .insertInto('trainingProfile')
      .values({ id: userId, ownerId: userId, createdAt: stamp.updatedAt, ...merged, ...stamp })
      .execute();
  } else {
    const changed: Partial<ProfileState> = {};
    for (const key of Object.keys(EMPTY_PROFILE) as (keyof ProfileState)[]) {
      if (merged[key] !== current[key]) Object.assign(changed, { [key]: merged[key] });
    }
    if (Object.keys(changed).length > 0) {
      const stamp = await writeStamp(trx, deps, userId);
      await trx
        .updateTable('trainingProfile')
        .set({ ...changed, ...stamp })
        .where('id', '=', userId)
        .execute();
    }
  }

  if (
    user.onboardingCompletedAt === null &&
    patch.onboardingStep !== undefined &&
    patch.onboardingStep !== user.onboardingStep
  ) {
    const stamp = await writeStamp(trx, deps, userId);
    await trx
      .updateTable('user')
      .set({ onboardingStep: patch.onboardingStep, ...stamp })
      .where('id', '=', userId)
      .execute();
  }
}

async function completeOnboarding(trx: DbExecutor, deps: AppDeps, userId: string): Promise<void> {
  const user = await trx
    .selectFrom('user')
    .select(['onboardingStep', 'onboardingCompletedAt'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  if (user.onboardingCompletedAt !== null) return;
  const profile = await trx
    .selectFrom('trainingProfile')
    .select(['goal', 'experience', 'daysPerWeek', 'sessionMinutes'])
    .where('id', '=', userId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  const primary = await trx
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .where('isPrimary', '=', 1)
    .executeTakeFirst();
  const step = firstIncompleteStep({
    goal: profile?.goal ?? null,
    experience: profile?.experience ?? null,
    daysPerWeek: profile?.daysPerWeek ?? null,
    sessionMinutes: profile?.sessionMinutes ?? null,
    hasPrimaryPlace: primary !== undefined,
    lastValidatedStep: user.onboardingStep,
  });
  if (step !== 'ready') throw httpError('onboarding_incomplete', { step });
  const stamp = await writeStamp(trx, deps, userId);
  await trx
    .updateTable('user')
    .set({ onboardingCompletedAt: stamp.updatedAt, ...stamp })
    .where('id', '=', userId)
    .execute();
}

export function profileRoutes(deps: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.patch('/training-profile', requireUser, async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    const body = await parseJson(c, TrainingProfilePatch);
    await deps.db.transaction().execute((trx) => patchProfile(trx, deps, user, body));
    return c.json(await buildMe(deps.db, deps, user.id, { mustChangePassword: user.mustChangePassword }));
  });

  routes.post('/onboarding/complete', requireUser, async (c) => {
    const user = c.get('user');
    if (!user) throw httpError('unauthenticated');
    await deps.db.transaction().execute((trx) => completeOnboarding(trx, deps, user.id));
    return c.json(await buildMe(deps.db, deps, user.id, { mustChangePassword: user.mustChangePassword }));
  });

  return routes;
}
