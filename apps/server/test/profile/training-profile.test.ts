import { afterEach, describe, expect, it } from 'vitest';
import { completeOnboarding, createTestContext, createUserAndLogin, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

const patch = (cookie: string, json: unknown) =>
  ctx.request('/api/me/training-profile', { method: 'PATCH', cookie, json });
const profile = (id: string) =>
  ctx.deps.db.selectFrom('trainingProfile').selectAll().where('id', '=', id).executeTakeFirst();
const userRow = (id: string) =>
  ctx.deps.db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

describe('PATCH /api/me/training-profile', () => {
  it('crée la ligne puis fusionne les patchs', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    const rev0 = (await userRow(u.id)).rev;
    const res = await patch(u.cookie, { goal: 'muscle', onboardingStep: 'goal' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ onboardingStep: 'goal' });
    expect(await profile(u.id)).toMatchObject({
      id: u.id,
      ownerId: u.id,
      goal: 'muscle',
      experience: null,
      daysPerWeek: null,
      sessionMinutes: null,
      sportCode: null,
      sportOtherLabel: null,
      cautiousMode: 0,
      updatedBy: u.id,
      deletedAt: null,
    });
    const after = await userRow(u.id);
    expect(after.onboardingStep).toBe('goal');
    expect(after.rev).toBeGreaterThan(rev0);

    const rev1 = (await profile(u.id))?.rev ?? 0;
    expect(
      (await patch(u.cookie, { experience: 'lt_6_months', daysPerWeek: 3, sessionMinutes: 45 })).status,
    ).toBe(200);
    const merged = await profile(u.id);
    expect(merged).toMatchObject({
      goal: 'muscle',
      experience: 'lt_6_months',
      daysPerWeek: 3,
      sessionMinutes: 45,
    });
    expect(merged?.rev).toBeGreaterThan(rev1);
  });

  it('onboardingStep seul crée la ligne vide', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    expect((await patch(u.cookie, { onboardingStep: 'place_kind' })).status).toBe(200);
    expect(await profile(u.id)).toMatchObject({ goal: null, experience: null });
    expect((await userRow(u.id)).onboardingStep).toBe('place_kind');
  });

  it('même valeur renvoyée : pas de nouveau rev', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    await patch(u.cookie, { goal: 'muscle', onboardingStep: 'goal' });
    const before = { p: await profile(u.id), u: await userRow(u.id) };
    expect((await patch(u.cookie, { goal: 'muscle', onboardingStep: 'goal' })).status).toBe(200);
    expect(await profile(u.id)).toEqual(before.p);
    expect(await userRow(u.id)).toEqual(before.u);
  });

  it.each([
    [{ daysPerWeek: 5 }],
    [{ daysPerWeek: 1 }],
    [{ sessionMinutes: 50 }],
    [{ goal: 'cardio' }],
    [{ experience: 'expert' }],
    [{ sportCode: 'golf' }],
    [{ unknown: 1 }],
  ])('400 validation pour %o', async (body) => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    const res = await patch(u.cookie, body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation');
  });

  it('401 sans session', async () => {
    ctx = await createTestContext();
    const res = await ctx.request('/api/me/training-profile', { method: 'PATCH', json: { goal: 'muscle' } });
    expect(res.status).toBe(401);
  });

  it('fat_loss refusé aux mineurs seulement quand le patch porte goal (E1)', async () => {
    ctx = await createTestContext();
    const minor = await createUserAndLogin(ctx, { birthDate: '2009-10-07' });
    const refused = await patch(minor.cookie, { goal: 'fat_loss' });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ error: 'validation', field: 'goal' });

    const adult = await createUserAndLogin(ctx);
    expect((await patch(adult.cookie, { goal: 'fat_loss' })).status).toBe(200);
    await ctx.deps.db
      .updateTable('user')
      .set({ birthDate: '2009-10-07' })
      .where('id', '=', adult.id)
      .execute();
    expect((await patch(adult.cookie, { cautiousMode: true })).status).toBe(200);
    expect((await patch(adult.cookie, { goal: 'fat_loss' })).status).toBe(400);
  });

  it("sport_support exige un sport dès l'étape sport ou après l'onboarding (E2)", async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    expect((await patch(u.cookie, { goal: 'sport_support', onboardingStep: 'goal' })).status).toBe(200);
    const refused = await patch(u.cookie, { sportCode: null, onboardingStep: 'sport' });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: 'validation', field: 'sportCode' });
    expect((await patch(u.cookie, { sportCode: 'tennis', onboardingStep: 'sport' })).status).toBe(200);

    const v = await createUserAndLogin(ctx);
    await completeOnboarding(ctx, v);
    const late = await patch(v.cookie, { goal: 'sport_support' });
    expect(late.status).toBe(400);
    expect(await late.json()).toEqual({ error: 'validation', field: 'sportCode' });
    expect((await patch(v.cookie, { goal: 'sport_support', sportCode: 'tennis' })).status).toBe(200);
  });

  it('« Non » à la question du sport (goal muscle)', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    await patch(u.cookie, { goal: 'muscle', onboardingStep: 'goal' });
    expect(
      (await patch(u.cookie, { sportCode: null, sportOtherLabel: null, onboardingStep: 'sport' })).status,
    ).toBe(200);
  });

  it('sportOtherLabel', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    const outcome = async (res: Response) => ({ status: res.status, body: await res.json() });
    const refusal = { status: 400, body: { error: 'validation', field: 'sportOtherLabel' } };
    expect(
      await outcome(await patch(u.cookie, { sportCode: 'tennis', sportOtherLabel: 'Ultimate' })),
    ).toEqual(refusal);
    expect((await patch(u.cookie, { sportCode: 'other', sportOtherLabel: 'x'.repeat(41) })).status).toBe(400);
    expect(await outcome(await patch(u.cookie, { sportCode: 'other' }))).toEqual(refusal);
    expect((await patch(u.cookie, { sportCode: 'other', sportOtherLabel: 'Ultimate' })).status).toBe(200);
    expect((await patch(u.cookie, { sportOtherLabel: null })).status).toBe(400);
    expect((await patch(u.cookie, { sportCode: 'rugby' })).status).toBe(200);
    expect(await profile(u.id)).toMatchObject({ sportCode: 'rugby', sportOtherLabel: null });
  });

  it('cautiousMode (R-CST-7)', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    expect(await (await patch(u.cookie, { cautiousMode: true })).json()).toMatchObject({ cautious: true });
    expect(await (await patch(u.cookie, { cautiousMode: false })).json()).toMatchObject({ cautious: false });
    expect(await profile(u.id)).toMatchObject({ cautiousMode: 0 });
  });

  it('âge évalué à la date de Paris (R-AGE-5, R-AGE-6)', async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx, { birthDate: '2008-10-07' });
    const first = await patch(u.cookie, { goal: 'muscle' });
    expect(await first.json()).toMatchObject({ ageBand: 'minor', cautious: true });
    ctx.clock.set('2026-10-06T22:30:00.000Z');
    const res = await patch(u.cookie, { onboardingStep: 'goal' });
    expect(await res.json()).toMatchObject({ ageBand: 'adult', cautious: false });
    expect(await profile(u.id)).toMatchObject({ goal: 'muscle' });
    expect((await patch(u.cookie, { goal: 'fat_loss' })).status).toBe(200);
  });

  it("n'écrit plus onboarding_step une fois l'onboarding terminé (R-ONB-3)", async () => {
    ctx = await createTestContext();
    const u = await createUserAndLogin(ctx);
    await completeOnboarding(ctx, u);
    expect((await patch(u.cookie, { goal: 'strength', onboardingStep: 'goal' })).status).toBe(200);
    expect((await userRow(u.id)).onboardingStep).toBe('health');
    expect(await profile(u.id)).toMatchObject({ goal: 'strength' });
  });
});
