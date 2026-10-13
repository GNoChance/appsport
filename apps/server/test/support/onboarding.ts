import type { TestContext } from './context';
import { insertFixtureRow } from './factories';

/** Profil muscle, aucune expérience, 3 j de 45 min, étape « health », lieu maison principal, puis fin de l'onboarding. */
export async function completeOnboarding(
  ctx: TestContext,
  user: { id: string; cookie: string },
): Promise<{ placeId: string }> {
  const patch = await ctx.request('/api/me/training-profile', {
    method: 'PATCH',
    cookie: user.cookie,
    json: {
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      onboardingStep: 'health',
    },
  });
  if (patch.status !== 200) throw new Error(`Profil refusé (${patch.status})`);
  const place = await insertFixtureRow(ctx.deps.db, 'place', {
    ownerId: user.id,
    kind: 'home',
    isPrimary: 1,
  });
  const done = await ctx.request('/api/me/onboarding/complete', {
    method: 'POST',
    cookie: user.cookie,
    json: {},
  });
  if (done.status !== 200) throw new Error(`Fin de l'onboarding refusée (${done.status})`);
  return { placeId: place.id as string };
}
