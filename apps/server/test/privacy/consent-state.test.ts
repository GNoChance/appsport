import { afterEach, describe, expect, it } from 'vitest';
import { getConsentState, isHealthConsentActive } from '../../src/privacy/consent-state';
import { createTestContext, createUser, insertFixtureRow, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

describe('état du consentement (R-CST-1)', () => {
  it('sans événement : inactif pour health et aiCoach', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx);
    const none = { active: false, textVersion: null, at: null };
    expect(await getConsentState(ctx.deps.db, u.id)).toEqual({ health: none, aiCoach: none });
    expect(await isHealthConsentActive(ctx.deps.db, u.id)).toBe(false);
  });

  it('un grant active, puis un retrait au même instant désactive', async () => {
    ctx = await createTestContext();
    const u = await createUser(ctx);
    await insertFixtureRow(ctx.deps.db, 'consent_event', {
      ownerId: u.id,
      type: 'health',
      action: 'grant',
      textVersion: '1.0',
      rev: 5,
      createdAt: '2026-10-06T10:00:00.000Z',
    });
    const state = await getConsentState(ctx.deps.db, u.id);
    expect(state.health).toEqual({ active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' });
    expect(state.aiCoach.active).toBe(false);
    expect(await isHealthConsentActive(ctx.deps.db, u.id)).toBe(true);
    await insertFixtureRow(ctx.deps.db, 'consent_event', {
      ownerId: u.id,
      type: 'health',
      action: 'withdraw',
      textVersion: '1.0',
      rev: 6,
      createdAt: '2026-10-06T10:00:00.000Z',
    });
    expect((await getConsentState(ctx.deps.db, u.id)).health.active).toBe(false);
    expect(await isHealthConsentActive(ctx.deps.db, u.id)).toBe(false);
  });
});
