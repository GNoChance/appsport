import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { MIGRATIONS } from '../../src/db/migrations/index';
import { openDatabase } from '../../src/db/open';
import { FakeClock } from '../support';
import { dumpSchema } from './schema-dump';

const REFUS = /CHECK constraint failed|UNIQUE constraint failed|FOREIGN KEY constraint failed/;
const S = "1, '2026-10-06T10:00:00.000Z', '2026-10-06T10:00:00.000Z'";
const x = (n: number) => 'x'.repeat(n);

describe('schéma du socle', () => {
  let h: ReturnType<typeof openDatabase>;
  const run = (q: string) => h.sqlite.exec(q);
  const ok = (q: string) => expect(() => run(q)).not.toThrow();
  const bad = (q: string) => expect(() => run(q)).toThrow(REFUS);
  const count = (q: string) => (h.sqlite.prepare(q).get() as { n: number }).n;

  const place = (id: string, owner: string, cols: string, vals: string) =>
    `INSERT INTO place (id, owner_id, rev, created_at, updated_at, ${cols}) VALUES ('${id}', '${owner}', ${S}, ${vals})`;
  const gym = (id: string, name: string, key = id) =>
    `INSERT INTO gym (id, name, name_key, city, city_key, load_settings, rev, created_at, updated_at) VALUES ('${id}', '${name}', '${key}', 'Paris', '${key}', '{}', ${S})`;
  const profile = (cols: string, vals: string, id = 'u1') =>
    `INSERT INTO training_profile (id, owner_id, rev, created_at, updated_at, ${cols}) VALUES ('${id}', 'u1', ${S}, ${vals})`;
  const consent = (action: string) =>
    `INSERT INTO consent_event (id, owner_id, type, action, text_version, rev, created_at, updated_at) VALUES ('c-${action}', 'u1', 'health', '${action}', 'v1', ${S})`;
  const session = (id: string, cols: string, vals: string) =>
    `INSERT INTO session (id, token_hash, created_at, last_seen_at, expires_at, ${cols}) VALUES ('${id}', 't-${id}', 'x', 'x', 'x', ${vals})`;
  const limitation = (area: string | null, note: string | null) =>
    `INSERT INTO limitation (id, owner_id, rev, created_at, updated_at, body_area, side, severity, active, note) VALUES ('l1', 'u1', ${S}, ${area ? `'${area}'` : 'NULL'}, 'left', 'mild', 1, ${note ? `'${note}'` : 'NULL'})`;

  beforeEach(async () => {
    h = openDatabase(':memory:');
    await migrate(h.db, MIGRATIONS, new FakeClock());
    run(`INSERT INTO user (id, username, username_key, password_hash, role, birth_date, rev, created_at, updated_at) VALUES
      ('u1', 'U1', 'u1', 'h', 'member', '1990-01-01', ${S}), ('u2', 'U2', 'u2', 'h', 'member', '1990-01-01', ${S})`);
  });
  afterEach(() => h.sqlite.close());

  it('instantané de sqlite_schema', async () => {
    await expect(dumpSchema(h.sqlite)).toMatchFileSnapshot('../__snapshots__/schema.sql');
  });

  it('18 tables, toutes STRICT', () => {
    const rows = h.sqlite
      .prepare(
        "SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string; strict: number }[];
    expect(rows).toHaveLength(18);
    expect(rows.every((r) => r.strict === 1)).toBe(true);
  });

  it('server_meta, user et training_profile', () => {
    const meta = (id: number) =>
      `INSERT INTO server_meta (id, server_epoch, epoch_started_at) VALUES (${id}, 'e', 'x')`;
    ok(meta(1));
    bad(meta(2));
    bad("UPDATE user SET role = 'root' WHERE id = 'u1'");
    bad("UPDATE user SET onboarding_step = 'nope' WHERE id = 'u1'");
    ok("UPDATE user SET onboarding_step = NULL WHERE id = 'u1'");
    ok(profile('goal, experience, days_per_week, session_minutes', 'NULL, NULL, NULL, NULL'));
    run('DELETE FROM training_profile');
    bad(profile('goal', 'NULL', 'autre'));
    bad(profile('days_per_week', '5'));
    bad(profile('session_minutes', '50'));
    bad(profile('sport_other_label', `'${x(41)}'`));
    ok(profile('sport_other_label', `'${x(40)}'`));
  });

  it('health_screening et limitation', () => {
    const hs = (del: string) =>
      `INSERT INTO health_screening (id, owner_id, rev, created_at, updated_at, deleted_at) VALUES ('u1', 'u1', ${S}, ${del})`;
    bad(hs('NULL'));
    ok(hs("'2026-10-06'"));
    bad(limitation(null, null));
    bad(limitation('tete', null));
    bad(limitation('knee', x(201)));
    ok(limitation('knee', x(200)));
  });

  it('place', () => {
    run(gym('g1', 'Salle un'));
    run(gym('g2', 'Salle deux'));
    ok(place('p1', 'u1', 'kind, is_primary', "'home', 1"));
    bad(place('p2', 'u1', 'kind, is_primary', "'home', 1"));
    ok(place('p3', 'u1', 'kind, is_primary, deleted_at', "'home', 1, 'x'"));
    ok(place('p4', 'u1', 'kind, gym_id', "'gym', 'g1'"));
    bad(place('p5', 'u1', 'kind, gym_id', "'gym', 'g1'"));
    ok(place('p6', 'u2', 'kind, gym_id', "'gym', 'g1'"));
    bad(place('p7', 'u1', 'kind', "'gym'"));
    bad(place('p8', 'u2', 'kind, gym_id, load_settings', "'gym', 'g2', '{}'"));
    bad(place('p9', 'u2', 'kind, gym_id, name', "'gym', 'g2', 'x'"));
    bad(place('pa', 'u2', 'kind, name', `'home', '${x(31)}'`));
    ok(place('pb', 'u2', 'kind, name', `'home', '${x(30)}'`));
  });

  it('gym, équipements, invitation, session et journaux', () => {
    ok(gym('g1', 'Salle un'));
    bad(gym('g2', 'Salle deux', 'g1'));
    bad(gym('g3', 'X'));
    const ge = (id: string) =>
      `INSERT INTO gym_equipment (id, gym_id, equipment_code, rev, created_at, updated_at) VALUES ('${id}', 'g1', 'barbell', ${S})`;
    bad(ge('g1:dumbbell'));
    ok(ge('g1:barbell'));
    ok(place('p1', 'u1', 'kind', "'home'"));
    const he = (id: string) =>
      `INSERT INTO home_equipment (id, place_id, equipment_code, owner_id, rev, created_at, updated_at) VALUES ('${id}', 'p1', 'bench', 'u1', ${S})`;
    bad(he('p1:other'));
    ok(he('p1:bench'));
    const inv = (n: number) =>
      `INSERT INTO invitation (id, code_hash, note, created_at, expires_at) VALUES ('i${n}', 'c${n}', '${x(n)}', 'x', 'x')`;
    bad(inv(61));
    ok(inv(60));
    bad(session('s1', 'must_change_password', '2'));
    bad(session('s2', 'revoked_reason', "'expired'"));
    ok(session('s3', 'revoked_reason', "'logout'"));
    bad(consent('revoke'));
    ok(consent('grant'));
    bad(
      `INSERT INTO sync_rejection (id, owner_id, rev, created_at, updated_at, op_id, entity, row_id, code) VALUES ('r', 'u1', ${S}, 'o', 'e', 'r', 'nope')`,
    );
    bad(
      "INSERT INTO applied_op (op_id, user_id, entity, row_id, status, applied_at) VALUES ('o', 'u1', 'e', 'r', 'nope', 'x')",
    );
    bad("INSERT INTO gym_history (id, gym_id, at, action, detail) VALUES ('h', 'g1', 'x', 'nope', '{}')");
  });

  it("suppression d'un user : cascades et SET NULL", () => {
    run(profile('goal', "'muscle'"));
    run(place('p1', 'u1', 'kind', "'home'"));
    run(consent('grant'));
    run(
      "INSERT INTO password_reset (id, user_id, code_hash, created_at, expires_at) VALUES ('pr', 'u1', 'h', 'x', 'x')",
    );
    run(session('s', 'user_id', "'u1'"));
    run(gym('g1', 'Salle un'));
    run(
      "INSERT INTO gym_history (id, gym_id, author_id, at, action, detail) VALUES ('h', 'g1', 'u1', 'x', 'create', '{}')",
    );
    run("DELETE FROM user WHERE id = 'u1'");
    for (const t of ['training_profile', 'place', 'consent_event', 'password_reset']) {
      expect(count(`SELECT count(*) AS n FROM ${t}`)).toBe(0);
    }
    expect(count("SELECT count(*) AS n FROM session WHERE id = 's' AND user_id IS NULL")).toBe(1);
    expect(count("SELECT count(*) AS n FROM gym_history WHERE id = 'h' AND author_id IS NULL")).toBe(1);
    expect(h.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
