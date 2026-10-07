import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, createUser, insertFixtureRow, login, type TestContext } from '../support';

// Planchers du nombre de routes énumérées : T18 monte MIN_ID_ROUTES à 4, T19 à 6.
const MIN_ADMIN_ROUTES = 10;
const MIN_ID_ROUTES = 0;

let ctx: TestContext;
afterEach(() => ctx?.close());

const WITNESSES = ['TEMOIN_TP', 'TEMOIN_HS', 'TEMOIN_LIM'];

interface Route {
  method: string;
  path: string;
}

function listRoutes(): Route[] {
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const r of ctx.app.routes) {
    if (r.method === 'ALL') continue;
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ method: r.method, path: r.path });
  }
  return out;
}

/** `:id` reçoit l'identifiant donné, tout autre paramètre reçoit « x ». */
const fill = (path: string, id: string): string =>
  path.replace(/:([A-Za-z]+)(\{[^}]*\})?/g, (_m, name: string) => (name === 'id' ? id : 'x'));

async function setup() {
  ctx = await createTestContext();
  const { db } = ctx.deps;
  const admin = await createUser(ctx, { username: 'porteur', role: 'admin', password: 'quatorze carac' });
  const b = await createUser(ctx, { username: 'brigitte' });
  const cookie = await login(ctx, 'porteur', admin.password);
  // consentement santé actif de l'admin : la garde C2 ne doit pas masquer le contrôle du propriétaire
  await insertFixtureRow(db, 'consent_event', { ownerId: admin.id, type: 'health', action: 'grant' });
  await insertFixtureRow(db, 'consent_event', { ownerId: b.id, type: 'health', action: 'grant' });

  const rowIds: string[] = [];
  const keep = (row: Record<string, unknown>) => {
    rowIds.push(row.id as string);
    return row;
  };
  keep(await insertFixtureRow(db, 'training_profile', { ownerId: b.id, sportOtherLabel: WITNESSES[0] }));
  keep(await insertFixtureRow(db, 'health_screening', { ownerId: b.id, questionnaireVersion: WITNESSES[1] }));
  keep(await insertFixtureRow(db, 'limitation', { ownerId: b.id, note: WITNESSES[2] }));
  keep(await insertFixtureRow(db, 'sync_rejection', { ownerId: b.id }));
  const place = keep(await insertFixtureRow(db, 'place', { ownerId: b.id }));
  keep(await insertFixtureRow(db, 'home_equipment', { ownerId: b.id, placeId: place.id }));
  return { admin, b, cookie, rowIds };
}

describe("isolation de l'administrateur (P-ADM-1, P-ADM-2, 02 §15 n°14)", () => {
  it("les routes /api/admin/* ne renvoient aucune donnée C1 à C3 d'un membre", async () => {
    const { b, cookie } = await setup();
    const admin = listRoutes().filter(
      (r) => r.path.startsWith('/api/admin/') && !r.path.endsWith('/members/:id/delete'),
    );
    expect(admin.length).toBeGreaterThanOrEqual(MIN_ADMIN_ROUTES);
    for (const r of admin) {
      const res = await ctx.request(fill(r.path, b.id), {
        method: r.method,
        cookie,
        ...(r.method === 'GET' ? {} : { json: {} }),
      });
      const body = await res.text();
      for (const w of WITNESSES) expect(body, `${r.method} ${r.path}`).not.toContain(w);
    }
  });

  it("chaque route à :id sous /api/me et /api/places répond 404 pour les lignes d'un autre membre", async () => {
    const { rowIds, cookie } = await setup();
    const owned = listRoutes().filter((r) => /^\/api\/(me|places)\//.test(r.path) && r.path.includes(':id'));
    expect(owned.length).toBeGreaterThanOrEqual(MIN_ID_ROUTES);
    for (const r of owned) {
      for (const id of rowIds) {
        const res = await ctx.request(fill(r.path, id), {
          method: r.method,
          cookie,
          ...(r.method === 'GET' ? {} : { json: {} }),
        });
        expect(res.status, `${r.method} ${r.path} ${id}`).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      }
    }
  });

  it.runIf(MIN_ID_ROUTES === 0)(
    "cas vide explicite : aucune route /api/(me|places) à :id n'existe encore (le plancher monte avec T18 et T19)",
    async () => {
      await setup();
      expect(
        listRoutes().filter((r) => /^\/api\/(me|places)\//.test(r.path) && r.path.includes(':id')),
      ).toEqual([]);
    },
  );
});
