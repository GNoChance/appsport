import { entityRules, HEALTH_CONSENT_TEXT, mirroredTables, snakeToCamel } from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { grantConsent } from '../../src/privacy/consent';
import { deleteAccount } from '../../src/privacy/delete-account';
import {
  createTestContext,
  createUser,
  createUserAndLogin,
  insertFixtureRow,
  syncPull,
  type TestContext,
} from '../support';

// R-SYN-21 : aucune ligne C1 à C3 d'un autre utilisateur ne sort du pull, y compris pour un admin.
type Pulled = { entity: string; rev: number; row: Record<string, unknown> };

let ctx: TestContext;
afterEach(() => ctx?.close());

/** Tables miroirs liées à un utilisateur (hors `user`, présent par compte). */
const OWNED = mirroredTables().filter((t) => entityRules[t]?.ownerColumn && t !== 'user');
const SECRET_KEYS = Object.values(entityRules).flatMap((r) => r.secretColumns.map(snakeToCamel));

const witnessesOf = (tag: string) => ({
  limitation: { note: `TEMOIN-${tag}-note` },
  place: { name: `TEMOIN-${tag}-lieu` },
  training_profile: { sportCode: 'other', sportOtherLabel: `TEMOIN-${tag}-sport` },
  sync_rejection: { entity: `TEMOIN-${tag}-rejet` },
});

/** Une ligne par table liée, consentement santé accordé. */
async function seedUser(userId: string, tag: string): Promise<string[]> {
  await ctx.deps.db
    .transaction()
    .execute((trx) => grantConsent(trx, ctx.deps, userId, 'health', HEALTH_CONSENT_TEXT.version, null));
  const witnesses = witnessesOf(tag);
  for (const table of OWNED) {
    const extra = (witnesses as Record<string, Record<string, unknown>>)[table] ?? {};
    await insertFixtureRow(ctx.deps.db, table, { ownerId: userId, ...extra });
  }
  return Object.values(witnesses).flatMap((w) =>
    Object.values(w).filter((v) => String(v).startsWith('TEMOIN')),
  );
}

async function pullAll(cookie: string, since?: string): Promise<{ rows: Pulled[]; watermark: string }> {
  const rows: Pulled[] = [];
  let watermark = since;
  for (;;) {
    const res = await syncPull(ctx, cookie, watermark ? { since: watermark } : {});
    expect(res.status).toBe(200);
    rows.push(...res.body.rows);
    watermark = res.body.nextWatermark;
    if (!res.body.hasMore) return { rows, watermark: watermark as string };
  }
}

describe.each(['member', 'admin'] as const)('pull : test de fuite (session %s)', (role) => {
  it("aucune ligne ni valeur de l'autre utilisateur, aucune colonne secrète", async () => {
    ctx = await createTestContext();
    const a = await createUserAndLogin(ctx, { role });
    const b = await createUser(ctx);
    const own = await seedUser(a.id, 'A');
    const others = await seedUser(b.id, 'B');
    const gym = await insertFixtureRow(ctx.deps.db, 'gym');
    await insertFixtureRow(ctx.deps.db, 'gym_equipment', { gymId: gym.id });

    const { rows } = await pullAll(a.cookie);
    const dump = JSON.stringify(rows);
    expect(new Set(rows.map((r) => r.entity))).toEqual(new Set(mirroredTables()));
    for (const r of rows) expect(mirroredTables()).toContain(r.entity);
    for (const w of own) expect(dump).toContain(w);
    expect(dump).not.toContain(b.id);
    for (const w of others) expect(dump).not.toContain(w);
    for (const r of rows) for (const key of SECRET_KEYS) expect(r.row).not.toHaveProperty(key);
  });

  it("après la suppression d'un compte, aucun pull ne contient son id", async () => {
    ctx = await createTestContext();
    const a = await createUserAndLogin(ctx, { role });
    const b = await createUser(ctx);
    await seedUser(a.id, 'A');
    await seedUser(b.id, 'B');
    const gym = await insertFixtureRow(ctx.deps.db, 'gym', { createdBy: b.id, updatedBy: b.id });
    await insertFixtureRow(ctx.deps.db, 'gym_equipment', { gymId: gym.id, addedBy: b.id });
    const before = await pullAll(a.cookie);

    await ctx.deps.db
      .transaction()
      .execute((trx) => deleteAccount(trx, ctx.deps, b.id, { actorId: b.id, ip: null }));

    const full = await pullAll(a.cookie);
    expect(JSON.stringify(full.rows)).not.toContain(b.id);
    const delta = await pullAll(a.cookie, before.watermark);
    expect(delta.rows.find((r) => r.entity === 'gym')?.row).toMatchObject({
      createdBy: null,
      updatedBy: null,
    });
    expect(delta.rows.find((r) => r.entity === 'gym_equipment')?.row).toMatchObject({ addedBy: null });
    expect(JSON.stringify(delta.rows)).not.toContain(b.id);
  });
});
