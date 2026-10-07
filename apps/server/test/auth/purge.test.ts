import { afterEach, describe, expect, it } from 'vitest';
import { authPurgeJob } from '../../src/auth/purge';
import { DAILY_JOBS } from '../../src/jobs/registry';
import { createLogger } from '../../src/logger';
import { createTestContext, insertFixtureRow, type TestContext } from '../support';

const NOW = '2026-10-06T10:00:00.000Z';
const LIM = '2026-09-06T10:00:00.000Z';
const LIM1 = '2026-09-06T10:00:00.001Z';
const FAR = '2027-10-06T10:00:00.000Z';

let ctx: TestContext;
afterEach(() => ctx?.close());

const ids = async (table: 'session' | 'invitation' | 'passwordReset'): Promise<string[]> =>
  (await ctx.deps.db.selectFrom(table).select('id').execute()).map((r) => r.id).sort();

describe('authPurgeJob (03 §7)', () => {
  it('est enregistré dans DAILY_JOBS sous le nom auth-purge', () => {
    expect(DAILY_JOBS).toContain(authPurgeJob);
    expect(authPurgeJob.name).toBe('auth-purge');
  });

  it('sessions : bornes exactes', async () => {
    ctx = await createTestContext();
    const { db } = ctx.deps;
    const u = await insertFixtureRow(db, 'user');
    const mk = async (v: Record<string, unknown>) =>
      (await insertFixtureRow(db, 'session', { userId: u.id, expiresAt: FAR, ...v })).id as string;
    await mk({ revokedAt: LIM, revokedReason: 'logout' }); // purgée
    const revokedLim1 = await mk({ revokedAt: LIM1, revokedReason: 'logout' });
    await mk({ lastSeenAt: '2026-06-07T10:00:00.000Z' }); // inactive depuis plus de 120 jours : purgée
    await mk({ lastSeenAt: '2026-06-08T10:00:00.000Z' }); // borne exacte : purgée
    const idleKept = await mk({ lastSeenAt: '2026-06-08T10:00:00.001Z' });
    const active = await mk({});
    await mk({ expiresAt: LIM }); // purgée
    const expiredKept = await mk({ expiresAt: LIM1 });
    const delKept = await mk({
      userId: null,
      revokedAt: '2026-01-01T00:00:00.000Z',
      revokedReason: 'account_deleted',
      expiresAt: '2026-10-06T10:00:00.001Z',
    });
    await mk({
      userId: null,
      revokedAt: '2026-10-01T00:00:00.000Z',
      revokedReason: 'account_deleted',
      expiresAt: NOW,
    });
    await authPurgeJob.run(ctx.deps);
    expect(await ids('session')).toEqual([revokedLim1, idleKept, active, expiredKept, delKept].sort());
  });

  it("invitations : date de naissance effacée à l'expiration, suppression 30 jours après", async () => {
    ctx = await createTestContext();
    const { db } = ctx.deps;
    const mk = async (v: Record<string, unknown>) =>
      (await insertFixtureRow(db, 'invitation', { birthDate: '2010-01-01', expiresAt: FAR, ...v }))
        .id as string;
    const expired = await mk({ expiresAt: '2026-10-06T09:00:00.000Z' });
    const pending = await mk({});
    await mk({ usedAt: LIM }); // purgée
    const usedLim1 = await mk({ usedAt: LIM1 });
    await mk({ revokedAt: '2026-09-01T10:00:00.000Z' }); // purgée
    await mk({ revokedAt: LIM }); // borne exacte : purgée
    await authPurgeJob.run(ctx.deps);
    expect(await ids('invitation')).toEqual([expired, pending, usedLim1].sort());
    const rows = await db.selectFrom('invitation').select(['id', 'birthDate']).execute();
    const birth = Object.fromEntries(rows.map((r) => [r.id, r.birthDate]));
    expect(birth[expired]).toBeNull();
    expect(birth[pending]).toBe('2010-01-01');
    expect(birth[usedLim1]).toBe('2010-01-01');
  });

  it('réinitialisations : bornes exactes', async () => {
    ctx = await createTestContext();
    const { db } = ctx.deps;
    const u = await insertFixtureRow(db, 'user');
    const mk = async (v: Record<string, unknown>) =>
      (await insertFixtureRow(db, 'password_reset', { userId: u.id, expiresAt: FAR, ...v })).id as string;
    await mk({ usedAt: LIM }); // purgé
    const cancelled = await mk({ cancelledAt: LIM1 });
    await mk({ expiresAt: '2026-09-05T10:00:00.000Z' }); // purgé
    const pending = await mk({});
    await authPurgeJob.run(ctx.deps);
    expect(await ids('passwordReset')).toEqual([cancelled, pending].sort());
  });

  it('journal de sécurité : 12 mois calendaires', async () => {
    ctx = await createTestContext();
    const { db } = ctx.deps;
    await insertFixtureRow(db, 'security_event', { at: '2025-10-06T09:59:59.999Z' });
    const edge = await insertFixtureRow(db, 'security_event', { at: '2025-10-06T10:00:00.000Z' });
    await authPurgeJob.run(ctx.deps);
    const left = (await db.selectFrom('securityEvent').select('id').execute()).map((r) => r.id);
    expect(left).toEqual([edge.id]);
  });

  it('journalise le nombre de lignes traitées', async () => {
    const lines: string[] = [];
    ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
    const u = await insertFixtureRow(ctx.deps.db, 'user');
    await insertFixtureRow(ctx.deps.db, 'password_reset', { userId: u.id, usedAt: LIM });
    await authPurgeJob.run(ctx.deps);
    const line = lines.find((l) => l.includes('auth purge'));
    expect(line).toBeDefined();
    expect(JSON.parse(line as string)).toMatchObject({ job: 'auth-purge', count: 1 });
  });
});
