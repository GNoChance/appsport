import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, createUserAndLogin, insertFixtureRow, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

const patch = (cookie: string, json: unknown) =>
  ctx.request('/api/me/training-profile', { method: 'PATCH', cookie, json });
const complete = (cookie: string) =>
  ctx.request('/api/me/onboarding/complete', { method: 'POST', cookie, json: {} });

describe('POST /api/me/onboarding/complete', () => {
  it('409 avec la première étape incomplète (R-ONB-1)', async () => {
    ctx = await createTestContext({ now: '2026-10-06T10:00:00.000Z' });
    const u = await createUserAndLogin(ctx);
    const res = await complete(u.cookie);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'onboarding_incomplete', step: 'goal' });

    await patch(u.cookie, {
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      onboardingStep: 'sport',
    });
    expect(await (await complete(u.cookie)).json()).toEqual({
      error: 'onboarding_incomplete',
      step: 'place_kind',
    });

    await insertFixtureRow(ctx.deps.db, 'place', { ownerId: u.id, kind: 'home', isPrimary: 1 });
    await patch(u.cookie, { onboardingStep: 'availability' });
    expect(await (await complete(u.cookie)).json()).toEqual({
      error: 'onboarding_incomplete',
      step: 'health',
    });
  });

  it('pose onboardingCompletedAt une seule fois', async () => {
    ctx = await createTestContext({ now: '2026-10-06T10:00:00.000Z' });
    const u = await createUserAndLogin(ctx);
    await patch(u.cookie, {
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      onboardingStep: 'health',
    });
    await insertFixtureRow(ctx.deps.db, 'place', { ownerId: u.id, kind: 'home', isPrimary: 1 });
    const first = await complete(u.cookie);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ onboardingCompletedAt: '2026-10-06T10:00:00.000Z' });
    ctx.clock.set('2026-10-06T10:01:00.000Z');
    const second = await complete(u.cookie);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ onboardingCompletedAt: '2026-10-06T10:00:00.000Z' });
  });

  it('401 sans session', async () => {
    ctx = await createTestContext();
    expect((await ctx.request('/api/me/onboarding/complete', { method: 'POST', json: {} })).status).toBe(401);
  });
});
