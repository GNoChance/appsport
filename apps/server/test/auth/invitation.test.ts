import { afterEach, describe, expect, it } from 'vitest';
import { hashSecret } from '../../src/auth/secret';
import { createLogger } from '../../src/logger';
import { createTestContext, createUser, login, type TestContext } from '../support';

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
const ORIGIN = 'https://appsport.test.ts.net';
const PASSWORD = 'tortue verte du jardin';

let ctx: TestContext;
afterEach(() => ctx.close());

async function setup(opts: Parameters<typeof createTestContext>[0] = {}) {
  ctx = await createTestContext(opts);
  const admin = await createUser(ctx, { username: 'porteur', role: 'admin' });
  const cookie = await login(ctx, admin.username, admin.password);
  return { admin, cookie };
}

const create = (cookie: string, json: unknown) =>
  ctx.request('/api/admin/invitations', { method: 'POST', json, cookie });
const check = (code: string, ip = '100.64.0.7') =>
  ctx.request('/api/invitations/check', { method: 'POST', json: { code }, ip });
const accept = (code: string, username: string, password: string, extra: object = {}, ip = '100.64.0.7') =>
  ctx.request('/api/invitations/accept', {
    method: 'POST',
    json: { code, username, password, termsVersion: '1.0', ...extra },
    ip,
  });
const canonical = (code: string): string => code.replaceAll('-', '');
const invitationRow = (code: string) =>
  ctx.deps.db
    .selectFrom('invitation')
    .selectAll()
    .where('codeHash', '=', hashSecret(canonical(code)))
    .executeTakeFirstOrThrow();

interface Created {
  code: string;
  link: string;
  invitation: { id: string; state: string };
}
async function created(cookie: string, json: object = { birthDate: '2001-05-04' }): Promise<Created> {
  const res = await create(cookie, json);
  expect(res.status).toBe(201);
  return (await res.json()) as Created;
}
const listing = async (cookie: string) =>
  (await (await ctx.request('/api/admin/invitations', { cookie })).json()) as {
    id: string;
    state: string;
    usedByUsername: string | null;
  }[];
const eventsOf = (type: string) =>
  ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', type).execute();

describe('POST /api/admin/invitations', () => {
  it('crée une invitation : code, lien, empreinte seule, journal', async () => {
    const { admin, cookie } = await setup();
    const r = await created(cookie, { birthDate: '2001-05-04', note: 'pour Léa' });
    expect(r.code).toMatch(CODE_RE);
    expect(r.link).toBe(`${ORIGIN}/invite#${r.code}`);
    expect(r.invitation).toMatchObject({
      note: 'pour Léa',
      state: 'pending',
      usedByUsername: null,
      expiresAt: '2026-10-13T10:00:00.000Z',
    });
    const row = await invitationRow(r.code);
    expect(row).toMatchObject({ birthDate: '2001-05-04', createdBy: admin.id, isAdminBootstrap: 0 });
    expect(JSON.stringify(row)).not.toContain(canonical(r.code));
    expect(JSON.stringify(await listing(cookie))).not.toContain(canonical(r.code));
    const events = await eventsOf('invitation_created');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: admin.id, outcome: 'success' });
  });

  it('refuse un invité de moins de 16 ans', async () => {
    const { cookie } = await setup();
    const under = await create(cookie, { birthDate: '2010-10-07' });
    expect(under.status).toBe(400);
    expect(await under.json()).toEqual({ error: 'under_min_age' });
    expect((await create(cookie, { birthDate: '2010-10-06' })).status).toBe(201);
  });

  it('compte l âge à la date de Paris (02 §15 n°1)', async () => {
    const { cookie } = await setup({ now: '2026-10-05T22:30:00.000Z' });
    expect((await create(cookie, { birthDate: '2010-10-06' })).status).toBe(201);
  });

  it('borne la note à 60 caractères et exige un administrateur', async () => {
    const { cookie } = await setup();
    expect((await create(cookie, { birthDate: '2001-05-04', note: 'a'.repeat(61) })).status).toBe(400);
    expect((await create(cookie, { birthDate: '2001-05-04', note: 'a'.repeat(60) })).status).toBe(201);
    const member = await createUser(ctx, { username: 'membre' });
    const memberCookie = await login(ctx, member.username, member.password);
    const res = await create(memberCookie, { birthDate: '2001-05-04' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });
});

describe('révocation et états', () => {
  it('révoque (204), efface la date, journalise ; la seconde révocation donne 409', async () => {
    const { cookie } = await setup();
    const r = await created(cookie);
    const url = `/api/admin/invitations/${r.invitation.id}/revoke`;
    expect((await ctx.request(url, { method: 'POST', json: {}, cookie })).status).toBe(204);
    expect((await invitationRow(r.code)).birthDate).toBeNull();
    expect((await ctx.request(url, { method: 'POST', json: {}, cookie })).status).toBe(409);
    const unknown = await ctx.request('/api/admin/invitations/inconnue/revoke', {
      method: 'POST',
      json: {},
      cookie,
    });
    expect(unknown.status).toBe(404);
    expect(await eventsOf('invitation_revoked')).toHaveLength(1);
    expect((await listing(cookie)).map((i) => i.state)).toEqual(['revoked']);
  });

  it('utilisée : used avec le pseudo ; +7 jours : expired', async () => {
    const { cookie } = await setup();
    const used = await created(cookie);
    const lapsed = await created(cookie, { birthDate: '2001-05-04', note: 'expire' });
    expect((await accept(used.code, 'lea', PASSWORD)).status).toBe(201);
    ctx.clock.advance(7 * 86_400_000);
    const byId = new Map((await listing(cookie)).map((i) => [i.id, i]));
    expect(byId.get(used.invitation.id)).toMatchObject({ state: 'used', usedByUsername: 'lea' });
    expect(byId.get(lapsed.invitation.id)?.state).toBe('expired');
    expect((await invitationRow(used.code)).birthDate).toBeNull();
    expect((await invitationRow(lapsed.code)).birthDate).toBe('2001-05-04');
  });
});

describe('POST /api/invitations/check', () => {
  it('accepte minuscules, espaces et lien complet', async () => {
    const { cookie } = await setup();
    const r = await created(cookie);
    for (const input of [r.code.toLowerCase(), r.link, r.code.replaceAll('-', ' ')]) {
      const res = await check(input);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ birthDate: '2001-05-04', role: 'member' });
    }
  });

  it('refuse code inconnu, mal formé, révoqué, utilisé, expiré', async () => {
    const { cookie } = await setup();
    const revoked = await created(cookie);
    await ctx.request(`/api/admin/invitations/${revoked.invitation.id}/revoke`, {
      method: 'POST',
      json: {},
      cookie,
    });
    const used = await created(cookie);
    await accept(used.code, 'lea', PASSWORD);
    const expired = await created(cookie);
    const cases: [string, string][] = [
      ['AAAA-AAAA-AAAA-AAAA', 'invitation_unknown'],
      ['pas un code', 'invitation_unknown'],
      [revoked.code, 'invitation_revoked'],
      [used.code, 'invitation_used'],
    ];
    for (const [code, error] of cases) {
      const res = await check(code);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
    ctx.clock.advance(7 * 86_400_000);
    const res = await check(expired.code);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invitation_expired' });
  });
});

describe('POST /api/invitations/accept', () => {
  it('crée le compte, ouvre la session et journalise (R-CPT-2)', async () => {
    const { cookie } = await setup();
    const r = await created(cookie);
    const res = await accept(r.code, 'Éloïse_2', PASSWORD);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      username: 'Éloïse_2',
      role: 'member',
      birthDate: '2001-05-04',
      termsVersion: '1.0',
      onboardingCompletedAt: null,
    });
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=/);
    const user = await ctx.deps.db
      .selectFrom('user')
      .selectAll()
      .where('username', '=', 'Éloïse_2')
      .executeTakeFirstOrThrow();
    const row = await invitationRow(r.code);
    expect(user).toMatchObject({
      invitationId: row.id,
      termsAcceptedAt: '2026-10-06T10:00:00.000Z',
      status: 'active',
      lastLoginAt: '2026-10-06T10:00:00.000Z',
      passwordChangedAt: '2026-10-06T10:00:00.000Z',
    });
    expect(row).toMatchObject({ usedBy: user.id, usedAt: '2026-10-06T10:00:00.000Z', birthDate: null });
    const [ev] = await eventsOf('invitation_used');
    expect(ev).toMatchObject({ actorId: user.id, targetId: user.id, outcome: 'success' });
    expect(JSON.parse(ev?.details ?? '{}')).toEqual({ invitationId: row.id });
  });

  it("un échec de validation ne consomme pas l'invitation (02 §15 n°2)", async () => {
    const { cookie } = await setup();
    const r = await created(cookie);
    const cases: [string, string, object, object][] = [
      ['lea', 'court', {}, { error: 'password_rejected', reason: 'too_short' }],
      ['Admin', PASSWORD, {}, { error: 'username_invalid', reason: 'reserved' }],
      ['porteur', PASSWORD, {}, { error: 'username_taken' }],
      ['lea', PASSWORD, { termsVersion: '0.9' }, { error: 'validation' }],
    ];
    for (const [username, password, extra, body] of cases) {
      const res = await accept(r.code, username, password, extra);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await res.json()).toMatchObject(body);
    }
    expect((await invitationRow(r.code)).usedAt).toBeNull();
    expect((await accept(r.code, 'lea', PASSWORD)).status).toBe(201);
    const again = await accept(r.code, 'leo', PASSWORD);
    expect(await again.json()).toEqual({ error: 'invitation_used' });
  });
});

describe('limiteur de codes (02 §15 n°3)', () => {
  it('19 check + 1 accept, la 21e vérification est refusée ; autre IP et +1 h passent', async () => {
    const { cookie } = await setup();
    const r = await created(cookie);
    const bad = 'AAAA-AAAA-AAAA-AAAA';
    for (let i = 0; i < 19; i += 1) expect((await check(bad)).status).toBe(400);
    expect((await accept(r.code, 'lea', 'court')).status).toBe(400);
    const blocked = await check(bad);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: 'rate_limited' });
    expect((await check(bad, '100.64.0.8')).status).toBe(400);
    ctx.clock.advance(3_600_000);
    expect((await check(bad)).status).toBe(400);
  });
});

describe('confidentialité des codes (02 §15 n°4)', () => {
  it("ni le code, ni le canonique, ni l'empreinte dans les journaux", async () => {
    const lines: string[] = [];
    const { cookie } = await setup({ deps: { logger: createLogger((l) => lines.push(l)) } });
    const r = await created(cookie);
    await check(r.code);
    await accept(r.code, 'lea', PASSWORD);
    const events = await ctx.deps.db.selectFrom('securityEvent').selectAll().execute();
    const haystack = JSON.stringify(events) + lines.join('\n');
    for (const secret of [r.code, canonical(r.code), hashSecret(canonical(r.code))]) {
      expect(haystack).not.toContain(secret);
    }
  });
});
