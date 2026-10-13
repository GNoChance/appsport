import { afterEach, describe, expect, it } from 'vitest';
import { logSecurityEvent } from '../../src/auth/security-log';
import { createLogger } from '../../src/logger';
import { createTestContext, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

const events = (c: TestContext) => c.deps.db.selectFrom('securityEvent').selectAll().execute();

describe('logSecurityEvent (P-LOG-1)', () => {
  it('écrit une ligne du journal avec les détails en JSON', async () => {
    ctx = await createTestContext();
    await logSecurityEvent(ctx.deps.db, ctx.deps, {
      type: 'login_succeeded',
      actorId: 'u1',
      targetId: 'u1',
      ip: '100.64.0.1',
      outcome: 'success',
      details: { role: 'admin' },
    });
    const [row] = await events(ctx);
    expect(row).toMatchObject({
      type: 'login_succeeded',
      actorId: 'u1',
      targetId: 'u1',
      tailnetIp: '100.64.0.1',
      outcome: 'success',
      at: '2026-10-06T10:00:00.000Z',
    });
    expect(JSON.parse(row?.details ?? 'null')).toEqual({ role: 'admin' });
  });

  it('laisse details à NULL sans détails', async () => {
    ctx = await createTestContext();
    await logSecurityEvent(ctx.deps.db, ctx.deps, {
      type: 'logout',
      actorId: 'u1',
      targetId: null,
      ip: null,
      outcome: 'success',
    });
    const [row] = await events(ctx);
    expect(row?.details).toBeNull();
    expect(row?.tailnetIp).toBeNull();
  });

  it('retire les clés interdites à l’exécution et le signale sans en journaliser la valeur', async () => {
    const lines: string[] = [];
    ctx = await createTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
    await logSecurityEvent(ctx.deps.db, ctx.deps, {
      type: 'invitation_created',
      actorId: 'u1',
      targetId: null,
      ip: null,
      outcome: 'success',
      details: { role: 'member', inviteCode: 'ABCD', tokenHash: 'x', newPassword: 'y' },
    });
    const [row] = await events(ctx);
    expect(JSON.parse(row?.details ?? 'null')).toEqual({ role: 'member' });
    const log = lines.join('\n');
    expect(log).toContain('security details dropped');
    expect(log).not.toContain('ABCD');
  });

  it('met details à NULL quand toutes les clés sont retirées', async () => {
    ctx = await createTestContext();
    await logSecurityEvent(ctx.deps.db, ctx.deps, {
      type: 'password_changed',
      actorId: 'u1',
      targetId: 'u1',
      ip: null,
      outcome: 'success',
      details: { password: 'z' },
    });
    expect((await events(ctx))[0]?.details).toBeNull();
  });
});
