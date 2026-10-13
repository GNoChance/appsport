import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, createUser, login, type TestContext } from '../support';

let ctx: TestContext;
afterEach(() => ctx.close());

async function invite(): Promise<string> {
  ctx = await createTestContext();
  const admin = await createUser(ctx, { username: 'porteur', role: 'admin' });
  const cookie = await login(ctx, admin.username, admin.password);
  const res = await ctx.request('/api/admin/invitations', {
    method: 'POST',
    json: { birthDate: '2001-05-04' },
    cookie,
  });
  return ((await res.json()) as { code: string }).code;
}

const members = () =>
  ctx.deps.db.selectFrom('user').select('username').where('role', '=', 'member').execute();
const accept = (code: string, username: string, password: string) =>
  ctx.request('/api/invitations/accept', {
    method: 'POST',
    json: { code, username, password, termsVersion: '1.0' },
    ip: '100.64.0.7',
  });

describe('acceptations simultanées (R-INV-6, Review Focus 1)', () => {
  it('deux acceptations : un compte, 201 puis invitation_used', async () => {
    const code = await invite();
    const [a, b] = await Promise.all([
      accept(code, 'lea', 'tortue verte du jardin'),
      accept(code, 'leo', 'tortue verte du jardin'),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(await (a.status === 400 ? a : b).json()).toEqual({ error: 'invitation_used' });
    expect(await members()).toHaveLength(1);
  });

  it('cinq acceptations dont une au mot de passe refusé : exactement un compte', async () => {
    const code = await invite();
    const results = await Promise.all([
      accept(code, 'lea', 'tortue verte du jardin'),
      accept(code, 'leo', 'tortue verte du jardin'),
      accept(code, 'lou', 'court'),
      accept(code, 'luc', 'tortue verte du jardin'),
      accept(code, 'liv', 'tortue verte du jardin'),
    ]);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 400)).toHaveLength(4);
    expect(await members()).toHaveLength(1);
    const bodies = (await Promise.all(results.filter((r) => r.status === 400).map((r) => r.json()))) as {
      error: string;
    }[];
    expect(bodies.map((b) => b.error).sort()).toEqual([
      'invitation_used',
      'invitation_used',
      'invitation_used',
      'password_rejected',
    ]);
  });
});
