### Task 1: Monorepo, outillage et CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `.node-version`, `.github/workflows/ci.yml`
- Create: `packages/contracts/{package.json, tsconfig.json, src/index.ts, src/constants.ts}`, `packages/domain/{package.json, tsconfig.json, src/index.ts}`, `apps/server/{package.json, tsconfig.json}`, `apps/web/{package.json, tsconfig.json}`
- Modify: `.gitignore` (+ `.e2e-data/`, `apps/*/dist/`, `test-results/`, `playwright-report/`)
- Test: `apps/server/test/smoke.test.ts`, `apps/web/test/smoke.test.ts`, `apps/server/test/repo/dependencies.test.ts`

**Interfaces:**
- Consumes : rien.
- Produces : paquets `@appsport/contracts`, `@appsport/domain`, `@appsport/server`, `@appsport/web` ; `constants.ts` minimal (`export const MIN_AGE = 16;`) ; projets Vitest `contracts`, `domain`, `server`, `web` ; scripts racine `lint`, `typecheck`, `test`, `test:e2e`.

**Spec:** 01 §2 (stack et versions), 01 §4 (dépôt), R-TST-1, R-TST-2.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/smoke.test.ts
it('résout @appsport/contracts depuis le serveur', () => { expect(MIN_AGE).toBe(16); });
// apps/web/test/smoke.test.ts : même assertion + expect(typeof document.createElement).toBe('function') (happy-dom)
// apps/server/test/repo/dependencies.test.ts : clés @appsport/* des quatre package.json
expect(appsportDeps('packages/contracts')).toEqual([]);
expect(appsportDeps('packages/domain')).toEqual(['@appsport/contracts']);
expect(appsportDeps('apps/server')).toEqual(['@appsport/contracts', '@appsport/domain']);
expect(appsportDeps('apps/web', 'dependencies')).toEqual(['@appsport/contracts', '@appsport/domain']);
expect(appsportDeps('apps/web', 'devDependencies')).toEqual(['@appsport/server']);
expect(rootPkg.packageManager.startsWith('pnpm@10.')).toBe(true); expect(rootPkg.engines.node).toBe('>=24.7');
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test` → échec (« No projects matched » ou `ERR_PNPM_NO_SCRIPT`, puis « Failed to resolve import "@appsport/contracts" »).

- [ ] **Step 3: Implement**

- Scripts racine : `lint: "biome check ."`, `typecheck: "pnpm -r --workspace-concurrency=1 typecheck"`, `test: "vitest run"`, `test:e2e: "pnpm --filter @appsport/web test:e2e"`. Scripts de paquet : `typecheck: "tsc --noEmit -p tsconfig.json"`, `test: "vitest run --root ../.. --project <nom>"`. `pnpm-workspace.yaml` : `packages: ['packages/*', 'apps/*']`, `onlyBuiltDependencies: [better-sqlite3, esbuild]`.
- `tsconfig.base.json` : options des Global Constraints + `target`/`lib` `ES2024`, `isolatedModules`, `resolveJsonModule`, `skipLibCheck` ; web ajoute `DOM`, `DOM.Iterable`, `jsx: "react-jsx"`, `include` `e2e` et `*.ts`. Exports : contracts et domain `"."` → `./src/index.ts` ; server : Interfaces partagées §0.
- `biome.json` : 2 espaces, LF, `lineWidth: 110`, quotes simples, `recommended`. `vitest.config.ts` : `passWithNoTests`, 4 projets (web en `happy-dom`, inclut `src/**/*.test.{ts,tsx}`), sans globals.
- `ci.yml` : `push` sur `main` et `pull_request` ; jobs `lint`, `typecheck`, `typecheck-ts6` (`continue-on-error: true`, `pnpm -r --workspace-concurrency=1 exec pnpm dlx --package=typescript@^6 tsc --noEmit -p tsconfig.json`), `test` ; setup-node avec `node-version-file: .node-version`, `pnpm install --frozen-lockfile`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm install` crée `pnpm-lock.yaml` ; `pnpm test` → `Test Files  3 passed` ; `pnpm --filter @appsport/server test -- smoke` → `Test Files  1 passed` ; `pnpm lint` et `pnpm typecheck` → code 0.

- [ ] **Step 5: Commit**

`git commit -m "chore(ci): monorepo pnpm, outillage TypeScript/Biome/Vitest et CI"`

---

### Task 2: Domaine de base (constantes, UUIDv7, âge, profil prudent)

**Files:**
- Modify: `packages/contracts/src/constants.ts` (version complète), `packages/domain/src/index.ts`, `packages/domain/package.json` (devDependency `fast-check@^4`)
- Create: `packages/domain/src/{ids.ts, age.ts, cautious.ts}`
- Test: `packages/domain/test/{ids,age,cautious,purity}.test.ts`, `packages/contracts/test/constants.test.ts`

**Interfaces:**
- Consumes : Task 1.
- Produces : `constants.ts` (dont `PROTOCOL_HEADER`, `EPOCH_HEADER`), `ids.ts`, `age.ts`, `cautious.ts` — signatures : Interfaces partagées §1.

**Spec:** R-AGE-1, R-AGE-2, R-CST-7, R-SYN-2, R-VER-1, 09 §0.2, 02 §15 n°10, 03 §17 n°5.

- [ ] **Step 1: Write the failing test**

```ts
// constants.test.ts
expect({ MIN_AGE, ADULT_AGE, PARIS_TZ, PRIVACY_POLICY_VERSION, SYNC_PROTOCOL, MIN_PROTOCOL, PROTOCOL_HEADER, EPOCH_HEADER }).toEqual({ MIN_AGE: 16,
  ADULT_AGE: 18, PARIS_TZ: 'Europe/Paris', PRIVACY_POLICY_VERSION: '1.0', SYNC_PROTOCOL: 1, MIN_PROTOCOL: 1,
  PROTOCOL_HEADER: 'X-Appsport-Protocol', EPOCH_HEADER: 'X-Appsport-Epoch' });
expect(MIN_PROTOCOL).toBeGreaterThanOrEqual(SYNC_PROTOCOL - 1); // R-VER-1
// ids.test.ts
it('vecteur de la RFC 9562', () => expect(createUuidV7(0x017f22e279b0, Uint8Array.of(0x0c,0xc3,0x18,0xc4,0xdc,0x0c,0x0c,0x07,0x39,0x8f))).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c07398f'));
it('RangeError : aléa < 10 octets, horodatage hors [0, 2^48)', () => { /* createUuidV7(0, new Uint8Array(9)), (-1, …), (2 ** 48, …) */ });
it('isUuidV7 : minuscules, version 7, variante 10xx', () => {
  expect(isUuidV7('017f22e2-79b0-7cc3-98c4-dc0c0c07398f')).toBe(true);
  for (const s of ['017F22E2-79B0-7CC3-98C4-DC0C0C07398F', '017f22e2-79b0-4cc3-98c4-dc0c0c07398f', '017f22e2-79b0-7cc3-c8c4-dc0c0c07398f', 'user:1']) expect(isUuidV7(s)).toBe(false);
});
it('createMonotonicUuidV7 strictement croissant quand l\'horloge recule', () => { /* horloge [1000, 999, 999, 500, 1000, 1001], 5000 ids : croissants, tous isUuidV7 */ });
it('propriété fast-check : toute suite d\'horloges (0..2^40, 1..300 valeurs) → ids uniques et croissants', () => {});
// age.test.ts (02 §15 n°10)
expect(ageOn('2000-06-15', '2018-06-14')).toBe(17); expect(ageOn('2000-06-15', '2018-06-15')).toBe(18);
expect(ageOn('2008-02-29', '2026-02-28')).toBe(17); expect(ageOn('2008-02-29', '2026-03-01')).toBe(18); expect(ageOn('2008-02-29', '2028-02-29')).toBe(20);
expect(ageOn('2010-10-07', '2026-10-06')).toBe(15);
expect(() => ageOn('2008-02-30', '2026-01-01')).toThrow(RangeError); expect(() => ageOn('2008-2-3', '2026-01-01')).toThrow(RangeError);
expect(parisDate(new Date('2026-03-31T22:30:00Z'))).toBe('2026-04-01'); expect(parisDate(new Date('2026-03-31T21:30:00Z'))).toBe('2026-03-31');
expect(parisDate(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02');
expect(ageBandOn('2008-04-01', '2026-03-31')).toBe('minor'); expect(ageBandOn('2008-04-01', '2026-04-01')).toBe('adult');
expect(ageBandOn('2010-10-06', '2026-10-06')).toBe('minor');
// cautious.test.ts : it.each sur les 24 cas (2 × 2 × 2 × 3) ; attendu = ageBand === 'minor' || cautiousMode || (healthConsentActive && caution === true)
//   cas nommés R-CST-7 : { adult, false, false, caution: true } → false ; { minor, false, false, null } → true
// purity.test.ts : aucun .ts de packages/domain/src ne contient /\bDate\.now\s*\(/, /\bMath\.random\s*\(/, /new Date\(\s*\)/, /from ['"]node:/
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/domain test` → « Failed to resolve import "../src/ids" » ; `pnpm --filter @appsport/contracts test -- constants` → `ADULT_AGE` vaut `undefined`.

- [ ] **Step 3: Implement**

`isUuidV7` : `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`. `parisDate` : `Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TZ, … })`. Octets de `createUuidV7` : 0-5 = `unixMs` 48 bits gros-boutiste ; 6 = `0x70 | (r[0] & 0x0f)` ; 7 = `r[1]` ; 8 = `0x80 | (r[2] & 0x3f)` ; 9-15 = `r[3..9]`. Monotonie (RFC 9562 méthode 1, compteur sur `rand_a`) :
```ts
let lastMs = -1; let seq = 0;
return () => {
  const t = Math.floor(now());
  if (t > lastMs) { lastMs = t; const r = random(2); seq = ((r[0]! & 0x07) << 8) | r[1]!; }
  else { seq += 1; if (seq > 0xfff) { lastMs += 1; seq = 0; } }
  return createUuidV7(lastMs, Uint8Array.of(seq >> 8, seq & 0xff, ...random(8)));
};
```

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/domain test` → `Test Files  4 passed` ; contracts vert ; `pnpm typecheck` et `pnpm lint` passent.

- [ ] **Step 5: Commit**

`git commit -m "feat(socle): constantes partagées, UUIDv7 monotones, âge à Paris et profil prudent"`

---

### Task 3: Adaptateur Kysely pour `node:sqlite`

**Files:**
- Create: `apps/server/src/db/sqlite-dialect.ts`, `apps/server/src/db/open.ts`, `apps/server/src/db/schema.ts` (squelette : `export interface Database {}` et `DbExecutor`)
- Modify: `apps/server/package.json` (`kysely@~0.29` ; dev `better-sqlite3`, `@types/better-sqlite3`)
- Test: `apps/server/test/db/adapter.test.ts`

**Interfaces:**
- Consumes : Task 1.
- Produces : `NodeSqliteDialect`, `openDatabase`, `Database` (squelette), `DbExecutor` — Interfaces partagées §2.

**Spec:** 01 §2 (WAL, `synchronous=FULL`, `foreign_keys=ON`, `busy_timeout`, adaptateur remplaçable par better-sqlite3), 01 §9.1.4, Review Focus 1.

- [ ] **Step 1: Write the failing test**

`describe.each` sur deux fabriques (`openDatabase(':memory:').db.withTables<TestDb>()` et `new Kysely({ dialect: new SqliteDialect({ database: new BetterSqlite3(':memory:') }), plugins: [new CamelCasePlugin()] })`), table `item (id INTEGER PRIMARY KEY, item_name TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0) STRICT` :
```ts
it('CRUD avec CamelCasePlugin', /* insertId 1n ; update de 2 lignes → numUpdatedRows 2n ; select → { id: 1, itemName: 'a', qty: 3 } ; delete → numDeletedRows 1n */);
it('RETURNING renvoie les lignes', /* → [{ id: 1, itemName: 'r' }] */);
it('une transaction qui lève est annulée et la connexion libérée', /* names() → [] puis ['après'] */);
it('un savepoint annulé ne perd pas le reste de la transaction', /* garde, jete (rollbackToSavepoint), garde2 (release) → ['garde','garde2'] */);
it('Review Focus 1 : deux transactions concurrentes sérialisées ; l\'échec de l\'une n\'annule pas l\'autre', async () => {
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const res = await Promise.allSettled([
    db.transaction().execute(async (trx) => { await trx.insertInto('item').values({ itemName: 'a' }).execute(); await tick(); throw new Error('échec voulu'); }),
    db.transaction().execute(async (trx) => { await trx.insertInto('item').values({ itemName: 'b' }).execute(); await tick(); }) ]);
  expect(res.map((r) => r.status)).toEqual(['rejected', 'fulfilled']); expect(await names()).toEqual(['b']);
});
it('Review Focus 1 : une requête hors transaction attend la transaction ouverte et survit à son rollback', /* 'dedans' annulé, 'dehors' → ['dehors'] */);
// describe('openDatabase') sur un fichier temporaire
expect(pragma('journal_mode')).toBe('wal'); expect(pragma('synchronous')).toBe(2); expect(pragma('foreign_keys')).toBe(1); expect(pragma('busy_timeout')).toBe(5000);
// ':memory:' accepté ; fermer sqlite avant rmSync (Windows)
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- adapter` → « Failed to resolve import "../../src/db/open" ».

- [ ] **Step 3: Implement**

- Driver à **une seule connexion** protégée par un mutex (file de promesses). `beginTransaction` → `BEGIN IMMEDIATE` **[décision plan]** (évite `SQLITE_BUSY` quand la CLI écrit en parallèle) ; savepoints comme le `SqliteDriver` de Kysely ; `destroy` ne ferme pas la base.
- `executeQuery` : `stmt.columns().length > 0` → `stmt.all`, sinon `stmt.run` (`numAffectedRows`, `insertId` en `BigInt`). Aucune conversion de booléens.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- adapter` → tous les cas verts pour `node:sqlite` et `better-sqlite3`.

- [ ] **Step 5: Commit**

`git commit -m "feat(db): adaptateur Kysely pour node:sqlite, sérialisé et testé contre better-sqlite3"`

---

### Task 4a: Migrations, compteur de révisions et support de test

**Files:**
- Create: `apps/server/src/db/{migrate.ts, server-meta.ts, rev.ts, migrations/index.ts}`, `apps/server/src/deps.ts` (`Clock`, `IdGen`, `systemClock`, `cryptoIds` ; complété en Task 6)
- Modify: `apps/server/src/db/schema.ts` (`tableKey`)
- Create: `apps/server/test/support/{clock.ts, ids.ts, index.ts}`
- Test: `apps/server/test/db/{migrate,rev}.test.ts`, `apps/server/test/support/support.test.ts`

**Interfaces:**
- Consumes : Task 3 (`openDatabase`, `DbExecutor`) ; Task 2 (`createMonotonicUuidV7`, `isUuidV7`).
- Produces : Interfaces partagées §2 (`deps.ts` : `Clock`, `IdGen`, `systemClock`, `cryptoIds` ; `db/migrations/index.ts` (avec `MIGRATIONS = []` jusqu'à la Task 4b), `db/migrate.ts`, `db/server-meta.ts`, `db/rev.ts`, `tableKey` ; support `clock.ts`, `ids.ts`).

**Spec:** R-VER-6, R-VER-7, R-SYN-1, R-SYN-3, R-SYN-25.

- [ ] **Step 1: Write the failing test**

```ts
// support.test.ts
const c = new FakeClock(); expect(c.now().toISOString()).toBe('2026-10-06T10:00:00.000Z');
c.advance(1500); expect(c.now().toISOString()).toBe('2026-10-06T10:00:01.500Z');
// seqIds(1) deux fois → mêmes 50 ids, tous isUuidV7, triés ; seqIds(2) ≠ seqIds(1) ; randomBytes(16) de longueur 16
// migrate.test.ts (migration de test m1 = '0001_t', qui crée server_meta ; remplacée par MIGRATIONS en Task 4b)
expect(await migrate(db, [m1], clock)).toEqual({ applied: ['0001_t'], unknownNonBreaking: [] });
expect(await migrate(db, [m1], clock)).toEqual({ applied: [], unknownNonBreaking: [] });
expect(await db.selectFrom('schemaMigrations').selectAll().execute()).toEqual([{ id: '0001_t', breaking: 0, appliedAt: '2026-10-06T10:00:00.000Z' }]);
it('un échec annule toute la série', /* [m1, 0002_fail qui crée la table x puis lève] → rejects { name: 'MigrationError', code: 'migration_failed' } ; ni la table de m1 ni x ; schema_migrations vide */);
it('migration inconnue cassante → unknown_breaking_migration (R-VER-7)', /* ligne ('0099_future', 1) */);
it('migrations inconnues non cassantes permises', /* ligne ('0002_future', 0) → { applied: [], unknownNonBreaking: ['0002_future'] } */);
// rev.test.ts
const meta = await initServerMeta(db, seqIds(1)); expect(isUuidV7(meta.serverEpoch)).toBe(true);
expect(meta).toMatchObject({ epochBaseRev: 0, syncCounter: 0, tombstonePurgeRev: 0, catalogVersion: null, catalogUpdatedAt: null });
expect(await getServerMeta(db)).toEqual(meta);
await expect(getServerMeta(emptyDb)).rejects.toThrow('server_meta absent');
expect([await nextRev(db), await nextRev(db), await nextRev(db)]).toEqual([1, 2, 3]); /* puis un nextRev dans une transaction annulée */ expect(await nextRev(db)).toBe(4);
expect(await writeStamp(db, { clock: new FakeClock() }, 'u1')).toEqual({ rev: 1, updatedAt: '2026-10-06T10:00:00.000Z', updatedBy: 'u1' });
expect(tableKey('training_profile')).toBe('trainingProfile');
```
(`rev.test.ts` utilise aussi m1 ; la Task 4b bascule les deux fichiers sur `MIGRATIONS`, où `applied` vaut `['0001_socle']`.)

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- db/ support` → « Failed to resolve import "../../src/db/migrate" » et `../support`.

- [ ] **Step 3: Implement**

`migrate` : crée hors transaction `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, breaking INTEGER NOT NULL CHECK (breaking IN (0,1)), applied_at TEXT NOT NULL) STRICT` ; une ligne inconnue avec `breaking = 1` → `MigrationError('unknown_breaking_migration')` sans rien appliquer ; applique les migrations manquantes dans **une seule** transaction ; toute erreur → `MigrationError('migration_failed')` (message français avec l'`id`, `cause`).

`seqIds(seed = 1)` : horloge partant de `2026-10-06T10:00:00.000Z` (+1 ms par appel), aléa mulberry32(`seed`), ids par `createMonotonicUuidV7`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- db/ support` vert ; `pnpm typecheck` passe.

- [ ] **Step 5: Commit**

`git commit -m "feat(db): migrations transactionnelles, compteur de révisions et horloge de test"`

---

### Task 4b: Schéma STRICT des 18 tables du socle

**Files:**
- Create: `apps/server/src/db/migrations/0001_socle.ts` ; Modify: `apps/server/src/db/migrations/index.ts` (`MIGRATIONS = [{ id: '0001_socle', breaking: false, up }]`), `apps/server/src/db/schema.ts` (version complète), `apps/server/test/db/{migrate,rev}.test.ts` (sur `MIGRATIONS`)
- Test: `apps/server/test/db/schema.test.ts`, `apps/server/test/__snapshots__/schema.sql` (généré)

**Interfaces:**
- Consumes : Task 4a.
- Produces : `Database` et les 18 interfaces `XxxTable`, `MIGRATIONS` — Interfaces partagées §2.

**Spec:** 09 §0 et §1, 01 §9.1.4, Global Constraints « Ajouts au modèle » (1) à (5).

- [ ] **Step 1: Write the failing test**

```ts
// schema.test.ts
it('instantané de sqlite_schema', /* toMatchFileSnapshot('../__snapshots__/schema.sql') */);
it('18 tables, toutes STRICT', /* pragma_table_list : 18 lignes, strict === 1 */);
```
Contraintes vérifiées une à une dans `schema.test.ts` (refus = `/CHECK constraint failed|UNIQUE constraint failed|FOREIGN KEY constraint failed/`) :

| Cas | Attendu |
|---|---|
| `server_meta.id = 2` ; `user.role = 'root'` ; `user.onboarding_step = 'nope'` | refusé |
| `user.onboarding_step` NULL ; `training_profile` avec `goal`, `experience`, `days_per_week`, `session_minutes` NULL | accepté |
| `training_profile.id ≠ owner_id` ; `days_per_week = 5` ; `session_minutes = 50` | refusé |
| `health_screening` / `limitation` sans contenu, `deleted_at` NULL ; `limitation.body_area = 'tete'` | refusé |
| `health_screening` sans contenu, `deleted_at` renseigné | accepté |
| `place` : deux principaux non supprimés pour un `owner_id` ; deux lieux non supprimés sur un `gym_id` ; `kind='gym'` sans `gym_id`, avec `load_settings` ou avec `name` | refusé |
| `place` : deux principaux dont un supprimé | accepté |
| `gym` doublon `(name_key, city_key)` ; `gym.name` d'un caractère ; `gym_equipment.id` ou `home_equipment.id` non conforme ; `invitation.note` de 61 caractères ; `session.must_change_password = 2` | refusé |
| suppression d'un `user` | cascade sur `training_profile`, `place`, `consent_event`, `password_reset` ; `session.user_id` et `gym_history.author_id` à NULL |
| `PRAGMA foreign_key_check` à la fin | vide |

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- db/schema` → `toHaveLength(18)` échoue (0 table) et `no such table: user`.

- [ ] **Step 3: Implement**

DDL de `0001_socle` (`sql.raw`, chaque table `STRICT`). Gabarit **+SYNC** : `owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT REFERENCES user(id) ON DELETE SET NULL, deleted_at TEXT`. « Booléen » = `INTEGER NOT NULL CHECK (x IN (0,1))`.

| Table | Colonnes (ordre du DDL) |
|---|---|
| `server_meta` | `id INTEGER PRIMARY KEY CHECK (id = 1)`, `server_epoch TEXT NOT NULL`, `epoch_base_rev INTEGER NOT NULL DEFAULT 0`, `sync_counter INTEGER NOT NULL DEFAULT 0`, `tombstone_purge_rev INTEGER NOT NULL DEFAULT 0`, `catalog_version TEXT`, `catalog_updated_at TEXT` |
| `applied_op` | `op_id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE`, `entity TEXT NOT NULL`, `row_id TEXT NOT NULL`, `status TEXT NOT NULL CHECK (status IN ('applied','applied_partial','duplicate','rejected'))`, `assigned_rev INTEGER`, `applied_at TEXT NOT NULL` |
| `sync_rejection` | `id TEXT PRIMARY KEY`, +SYNC, `op_id TEXT NOT NULL`, `entity TEXT NOT NULL`, `row_id TEXT NOT NULL`, `code TEXT NOT NULL CHECK (code IN ('validation','forbidden','parent_rejected','stale_revision','unknown_entity','protocol'))`, `detail_json TEXT CHECK (json_valid(detail_json))`, `dismissed_at TEXT` |
| `user` | `id TEXT PRIMARY KEY`, `username TEXT NOT NULL`, `username_key TEXT NOT NULL UNIQUE`, `password_hash TEXT NOT NULL`, `role TEXT NOT NULL CHECK (role IN ('admin','member'))`, `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))`, `birth_date TEXT NOT NULL`, `terms_version TEXT`, `terms_accepted_at TEXT`, `last_login_at TEXT`, `password_changed_at TEXT`, `onboarding_step TEXT CHECK (onboarding_step IN ('goal','sport','place_kind','place','experience','availability','health','ready'))`, `onboarding_completed_at TEXT`, `invitation_id TEXT REFERENCES invitation(id) ON DELETE SET NULL`, `rev INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `updated_by TEXT REFERENCES user(id) ON DELETE SET NULL` |
| `invitation` | `id TEXT PRIMARY KEY`, `code_hash TEXT NOT NULL UNIQUE`, `note TEXT CHECK (length(note) <= 60)`, `birth_date TEXT`, `is_admin_bootstrap` booléen `DEFAULT 0`, `created_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `used_at TEXT`, `used_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `revoked_at TEXT` |
| `password_reset` | `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE`, `code_hash TEXT NOT NULL UNIQUE`, `created_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `used_at TEXT`, `cancelled_at TEXT` |
| `session` | `id TEXT PRIMARY KEY`, `token_hash TEXT NOT NULL UNIQUE`, `user_id TEXT REFERENCES user(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `last_seen_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `must_change_password` booléen `DEFAULT 0`, `revoked_at TEXT`, `revoked_reason TEXT CHECK (revoked_reason IN ('logout','logout_all','password_change','password_reset','admin','account_deleted'))` |
| `consent_event` | `id TEXT PRIMARY KEY`, `owner_id` (FK cascade), `type TEXT NOT NULL CHECK (type IN ('health','ai_coach'))`, `action TEXT NOT NULL CHECK (action IN ('grant','withdraw'))`, `text_version TEXT NOT NULL`, `rev`, `created_at`, `updated_at`, `updated_by` (+SYNC **sans** `deleted_at`) |
| `security_event` | `id TEXT PRIMARY KEY`, `at TEXT NOT NULL`, `type TEXT NOT NULL`, `actor_id TEXT`, `target_id TEXT` (sans FK), `tailnet_ip TEXT`, `outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','blocked'))`, `details TEXT CHECK (json_valid(details))` |
| `training_profile` | `id TEXT PRIMARY KEY`, +SYNC, `goal TEXT CHECK (goal IN ('muscle','strength','fat_loss','fitness','sport_support'))`, `experience TEXT CHECK (experience IN ('none','lt_6_months','6_to_24_months','gt_24_months'))`, `days_per_week INTEGER CHECK (days_per_week BETWEEN 2 AND 4)`, `session_minutes INTEGER CHECK (session_minutes IN (30,45,60,75,90))`, `sport_code TEXT`, `sport_other_label TEXT CHECK (length(sport_other_label) <= 40)`, `cautious_mode` booléen `DEFAULT 0`, `CHECK (id = owner_id)` |
| `health_screening` | `id TEXT PRIMARY KEY`, +SYNC, `caution INTEGER CHECK (caution IN (0,1))`, `questionnaire_version TEXT`, `answered_at TEXT`, `CHECK (id = owner_id)`, `CHECK (deleted_at IS NOT NULL OR (caution IS NOT NULL AND questionnaire_version IS NOT NULL AND answered_at IS NOT NULL))` |
| `limitation` | `id TEXT PRIMARY KEY`, +SYNC, `body_area TEXT CHECK (body_area IN ('shoulder','elbow','wrist_hand','neck','upper_back','lower_back','hip','knee','ankle_foot','other'))`, `side TEXT CHECK (side IN ('left','right','both','not_applicable'))`, `severity TEXT CHECK (severity IN ('mild','severe'))`, `note TEXT CHECK (length(note) <= 200)`, `active INTEGER CHECK (active IN (0,1))`, `CHECK (deleted_at IS NOT NULL OR (body_area IS NOT NULL AND side IS NOT NULL AND severity IS NOT NULL AND active IS NOT NULL))` |
| `gym` | `id TEXT PRIMARY KEY`, `name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60)`, `name_key TEXT NOT NULL`, `city TEXT NOT NULL CHECK (length(city) BETWEEN 2 AND 60)`, `city_key TEXT NOT NULL`, `load_settings TEXT NOT NULL CHECK (json_valid(load_settings))`, `created_by`, `updated_by` (`TEXT REFERENCES user(id) ON DELETE SET NULL`), `rev INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT`, `UNIQUE (name_key, city_key)` |
| `gym_equipment` | `id TEXT PRIMARY KEY`, `gym_id TEXT NOT NULL REFERENCES gym(id) ON DELETE CASCADE`, `equipment_code TEXT NOT NULL`, `added_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `rev INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT`, `CHECK (id = gym_id \|\| ':' \|\| equipment_code)` |
| `gym_history` | `id TEXT PRIMARY KEY`, `gym_id TEXT NOT NULL REFERENCES gym(id) ON DELETE CASCADE`, `author_id TEXT REFERENCES user(id) ON DELETE SET NULL`, `at TEXT NOT NULL`, `action TEXT NOT NULL CHECK (action IN ('create','update_info','add_equipment','remove_equipment','update_load_settings'))`, `detail TEXT NOT NULL CHECK (json_valid(detail))` |
| `place` | `id TEXT PRIMARY KEY`, +SYNC, `kind TEXT NOT NULL CHECK (kind IN ('gym','home'))`, `gym_id TEXT REFERENCES gym(id)`, `name TEXT CHECK (length(name) <= 30)`, `is_primary` et `visible_at_gym` booléens `DEFAULT 0`, `load_settings TEXT CHECK (json_valid(load_settings))`, `CHECK (kind = 'home' OR load_settings IS NULL)`, `CHECK ((kind = 'gym') = (gym_id IS NOT NULL))`, `CHECK (kind = 'home' OR name IS NULL)` |
| `home_equipment` | `id TEXT PRIMARY KEY`, `place_id TEXT NOT NULL REFERENCES place(id) ON DELETE CASCADE`, `equipment_code TEXT NOT NULL`, +SYNC, `CHECK (id = place_id \|\| ':' \|\| equipment_code)` |

Index : `<t>_rev_idx (rev)` pour `user`, `gym`, `gym_equipment` et les 7 tables à `owner_id` ; `<t>_owner_rev_idx (owner_id, rev)` pour `sync_rejection`, `consent_event`, `training_profile`, `health_screening`, `limitation`, `place`, `home_equipment` ; `applied_op_user_applied_idx (user_id, applied_at)` ; `consent_event_owner_type_created_idx (owner_id, type, created_at)` ; `security_event_at_idx (at)` ; `password_reset_user_idx (user_id)` ; `session_user_idx (user_id)` ; `gym_equipment_gym_idx (gym_id)` ; `gym_history_gym_at_idx (gym_id, at)` ; `place_gym_idx (gym_id)` ; `home_equipment_place_idx (place_id)` ; `CREATE UNIQUE INDEX place_owner_gym_uq ON place(owner_id, gym_id) WHERE deleted_at IS NULL` ; `CREATE UNIQUE INDEX place_owner_primary_uq ON place(owner_id) WHERE is_primary = 1 AND deleted_at IS NULL`.

`schema.ts` : une interface `XxxTable` par table (camelCase ; `DEFAULT` → `Generated<T>` ; booléens `number`, JSON `string`).

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- db/` écrit `__snapshots__/schema.sql` ; le relire (18 tables, index du tableau) ; relancer → vert ; `pnpm typecheck` passe.

- [ ] **Step 5: Commit**

`git commit -m "feat(db): schéma STRICT des 18 tables du socle"`

---

### Task 5: Registre `entityRules` et fabriques de test

**Files:**
- Create: `packages/contracts/src/{case.ts, entity-rules.ts}`, `apps/server/test/support/factories.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/server/src/db/schema.ts` (`tableKey` délègue à `snakeToCamel`), `apps/server/test/support/index.ts`
- Test: `packages/contracts/test/{case,entity-rules}.test.ts`, `apps/server/test/db/entity-rules.test.ts`

**Interfaces:**
- Consumes : Tasks 4a et 4b (`openDatabase`, `migrate`, `MIGRATIONS`, `Database`, `tableKey`, `seqIds`) ; Task 2.
- Produces : Interfaces partagées §1 (`case.ts`, `entity-rules.ts` avec les valeurs des 18 tables) et §2 (support `factories.ts`).

**Spec:** R-SYN-4, R-REG-1, P-CAT-1, P-CAT-2, 03 §17 n°2, 09 §0.4 et §0.5.

- [ ] **Step 1: Write the failing test**

```ts
// case.test.ts
expect(snakeToCamel('training_profile')).toBe('trainingProfile'); expect(camelToSnake('usernameKey')).toBe('username_key');
expect(rowToCamel({ owner_id: 'u', deleted_at: null })).toEqual({ ownerId: 'u', deletedAt: null });
for (const [t, r] of Object.entries(entityRules)) for (const c of [t, ...r.columns]) expect(camelToSnake(snakeToCamel(c))).toBe(c);
// entity-rules.test.ts (contracts)
// 18 clés triées ; pick(t) = [category, syncClass, ownerColumn, exported, onUserDelete].join('/') égal aux valeurs des Interfaces partagées §1 pour les 18 tables
expect(entityRules.sync_rejection!.clientWritable).toEqual(['dismissed_at']); expect(entityRules.user!.secretColumns).toEqual(['password_hash']);
expect(mirroredTables()).toEqual(['consent_event','gym','gym_equipment','health_screening','home_equipment','limitation','place','sync_rejection','training_profile','user']);
// invariants : clientWritable vide hors J ; clientWritable, c2Columns, secretColumns, ownerColumn ⊂ columns ; tables à owner_id ⊃ SYNC_COLUMNS (consent_event sans deleted_at) ; J/D/E ⊃ 'rev'
// entity-rules.test.ts (serveur, base :memory: migrée) — P-CAT-2, R-REG-1
it('chaque table et chaque colonne de sqlite_schema est déclarée, et inversement', /* pragma_table_info */);
it('toute table C1–C3 liée à un utilisateur est exportée et supprimée', () => { /* onUserDelete ∈ {cascade, anonymize} ; exported || onUserDelete === 'anonymize' (session) */ });
it('secretColumns = toutes les colonnes *_hash', () => expect(declared).toEqual(['invitation.code_hash','password_reset.code_hash','session.token_hash','user.password_hash']));
it.each(Object.keys(entityRules))('insertFixtureRow(%s) insère une ligne valide', async (table) => {
  const row = await insertFixtureRow(db, table);
  expect(Object.keys(row).sort()).toEqual(entityRules[table]!.columns.map(snakeToCamel).sort());
  expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});
it('insertFixtureRow applique les valeurs fournies', /* place { ownerId: user.id, kind: 'home', name: 'Maison' } */);
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test` et `pnpm --filter @appsport/server test -- entity-rules` → « Failed to resolve import "../src/case" ».

- [ ] **Step 3: Implement**

`columns` = colonnes exactes du DDL de la Task 4b (plus `schema_migrations` : `id`, `breaking`, `applied_at`) ; `c2Columns` vaut `[]` partout au socle (tables C2 entièrement C2). `insertFixtureRow` : une fabrique par table ; parents créés par récursion (`ownerId` → `user`, `gymId` → `gym`, `placeId` → `place` maison) ; ids de `seqIds(999)` ; clés déterministes (`training_profile.id = ownerId`, `health_screening.id = ownerId`, `gym_equipment.id = gymId + ':dumbbells'`, `home_equipment.id = placeId + ':chair'`) ; défauts `rev: 1`, horodatages `'2026-10-06T10:00:00.000Z'`, `user` (`user<n>`, `passwordHash: '$argon2id$fixture'`, `member`, `birthDate: '1990-01-01'`), `gym` (`Salle <n>`, `Lyon`, `loadSettings: '{}'`), `place` (`home`, `Maison`, `'{}'`) ; renvoie la ligne relue.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/contracts test` vert ; `pnpm --filter @appsport/server test -- entity-rules` vert (18 cas) ; `pnpm test` vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(db): registre entityRules des 18 tables, conversion de casse et fabriques de lignes de test"`

---

### Task 6: Serveur Hono, sécurité HTTP et `/api/health`

**Files:**
- Create: `packages/contracts/src/api/{errors.ts, health.ts}` ; Modify: `packages/contracts/src/index.ts`, `packages/contracts/package.json` (`zod@^4`)
- Create: `apps/server/src/{config.ts, app-env.ts, app.ts, routes.ts, logger.ts}`, `apps/server/src/http/{errors.ts, validate.ts, security-headers.ts, origin-guard.ts, request-log.ts, client-ip.ts, epoch-header.ts}`, `apps/server/src/health/routes.ts`
- Modify: `apps/server/src/deps.ts` (+ `Argon2Params`, `ARGON2_PARAMS`, `AppDeps`, `createAppDeps`), `apps/server/package.json` (`hono@~4.13`, `@hono/node-server@~2.1`, `zod@^4`)
- Create: `apps/server/test/support/context.ts` ; Modify: `apps/server/test/support/index.ts`
- Test: `packages/contracts/test/errors.test.ts`, `apps/server/test/{config,logger}.test.ts`, `apps/server/test/http/{security-headers,origin-guard,request-log,errors,client-ip}.test.ts`, `apps/server/test/health/health.test.ts`

**Interfaces:**
- Consumes : Tasks 4a et 4b (`Clock`, `IdGen`, `systemClock`, `cryptoIds`, `getServerMeta`, `migrate`, `MIGRATIONS`, `initServerMeta`, `FakeClock`, `seqIds`, `Migration`) ; Task 3 ; Task 5 (`entityRules`) ; Task 2.
- Produces : Interfaces partagées §1 (`api/errors.ts`, `api/health.ts`) et §2 (`deps.ts` sauf `syncHooks`, `config.ts`, `app-env.ts`, `app.ts`, `routes.ts`, `http/*`, `health/routes.ts`, `logger.ts`, support `context.ts` avec `dbPath`).

**Spec:** 01 §3 et 08 §4 (points 2, 3, 6), R-VER-3, R-SYN-25, P-AUT-4, P-AUT-7, P-AUT-9, P-LOG-2, P-LOG-4, Global Constraints « Format d'erreur API », « En-têtes HTTP », « CSRF », « Cookie de session », « Configuration serveur ».

- [ ] **Step 1: Write the failing test**

```ts
// errors.test.ts : chaque code de ApiErrorCode.options a le statut des groupes des Interfaces partagées §1 (33 codes)
expect(ApiErrorBody.parse({ error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 })).toEqual({ error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 });
// config.test.ts
expect(() => loadConfig({})).toThrow(ConfigError);
expect(() => loadConfig({ APP_ORIGIN: 'https://appsport.x.ts.net/chemin' })).toThrow(ConfigError);
expect(() => loadConfig({ APP_ORIGIN: 'http://appsport.x.ts.net' })).toThrow(ConfigError);   // http seulement pour localhost / 127.0.0.1
expect(loadConfig({ APP_ORIGIN: 'https://appsport.x.ts.net' })).toMatchObject({ appOrigin: 'https://appsport.x.ts.net', version: 'dev', port: 3000,
  host: '0.0.0.0', dataDir: '/data', publicDir: '/app/public', contentDir: '/app/data', swKillSwitch: false, coachModel: 'claude-opus-5-5',
  anthropicApiKey: null, argon2: { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 }, sessionCookieName: '__Host-session', secureCookie: true });
// dbPath = join('/data', 'appsport.db') ; sentinelPath = join('/data', '.appsport-volume')
expect(loadConfig({ APP_ORIGIN: 'http://localhost:5173' })).toMatchObject({ sessionCookieName: 'dev-session', secureCookie: false });
expect(loadConfig({ APP_ORIGIN: 'https://a.ts.net', SW_KILL_SWITCH: '1', PORT: '8080', APP_VERSION: 'v1.2.3', ANTHROPIC_API_KEY: '' }))
  .toMatchObject({ swKillSwitch: true, port: 8080, version: 'v1.2.3', anthropicApiKey: null });
// logger.test.ts : info('x', { requestId: 'r1', secret: 'TEMOIN' }) → JSON { level: 'info', msg: 'x', requestId: 'r1', time } ; ni 'secret' ni 'TEMOIN'
// security-headers.test.ts : sur GET /api/health, un 404 /api/inexistant et une route qui lève (500)
expect(pick(res.headers)).toEqual({ 'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' });
// X-Appsport-Epoch = serverEpoch sur /api/health et un 404 /api/… ; absent de GET /privacy
```
`origin-guard.test.ts` (routes de test `POST`/`DELETE /api/test/echo`, `GET /api/test/whoami`) :

| Requête | Attendu |
|---|---|
| POST, `Origin: https://evil.example` ; POST sans `Origin` | `403 {"error":"origin_mismatch"}` |
| POST, bonne origine, `Content-Type: text/plain` | `415 {"error":"unsupported_media_type"}` |
| POST `application/json; charset=utf-8` ; DELETE sans corps ; GET d'origine étrangère | 200 ; 204 ; 200 |
| `Tailscale-User-Login: admin@exemple` sur `/api/test/whoami` | `{ user: null }` (P-AUT-7) ; aucun fichier de `apps/server/src` ne contient `/tailscale-user/i` |

```ts
// request-log.test.ts : POST /api/test/items/123?q=TEMOIN_QS, cookie dev-session=TEMOIN_COOKIE, corps { pain: 'TEMOIN_C2' }
expect(line).toMatchObject({ msg: 'request', method: 'POST', route: '/api/test/items/:id', status: 200 }); // durationMs numérique, requestId non vide
// le journal ne contient ni TEMOIN_QS, ni TEMOIN_COOKIE, ni TEMOIN_C2, ni 123
// errors.test.ts
// httpError('gym_duplicate', { gymId: 'g1' }) → 409 {"error":"gym_duplicate","gymId":"g1"} ; new Error('boom TEMOIN') → 500 {"error":"internal"}, ni 'boom' ni pile, journal sans TEMOIN
// parseJson : JSON invalide → 400 {"error":"validation"} ; { n: 'x' } contre z.object({ n: z.number() }) → issues[0] = { path: 'n', message: expect.any(String) }
// client-ip.test.ts : XFF '100.64.0.7' → '100.64.0.7' ; '100.64.0.7, 10.0.0.1' → '100.64.0.7' ; sans en-tête → null ;
//   pair TCP '100.64.0.9' (app.request(url, init, { incoming: { socket: { remoteAddress } } })) → XFF ignoré, '100.64.0.9'
// health.test.ts
expect(body).toEqual({ status: 'ok', version: 'dev', db: 'ok', protocol: 1, minProtocol: 1, epoch: meta.serverEpoch, swKill: false });
// createTestContext({ config: { swKillSwitch: true, version: 'v1.0.0' } }) → { swKill: true, version: 'v1.0.0' }
// après ctx.deps.sqlite.close() : 503 { status: 'error', db: 'error', epoch: null }
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- http/ health config logger` et `pnpm --filter @appsport/contracts test -- errors` → « Failed to resolve import "../../src/app" », « ./context », « ../src/api/errors ».

- [ ] **Step 3: Implement**

- Ordre des middlewares de `createApp` : Interfaces partagées §2 ; `epochHeader` lit `getServerMeta` à chaque requête (sans cache, pour suivre un changement d'époque) et omet l'en-tête en cas d'erreur ; `securityHeaders` pose ses en-têtes après `next()` (donc aussi sur 404 et `onError`) ; `notFound` → `404 {"error":"not_found"}`.
- Journal : `logger.info('request', { requestId, method, route: routePath(c, -1), status, durationMs })` ; erreur non `HttpError` → `logger.error('unhandled_error', { requestId, code: 'internal', event: err.name })`.
- `createTestContext` : `openDatabase(opts.dbPath ?? ':memory:')`, config `APP_ORIGIN: 'https://appsport.test.ts.net'` + `argon2: TEST_ARGON2`, logger muet ; `request()` pose `Origin` par défaut sur POST/PUT/PATCH/DELETE (`origin: null` le retire), `json` → `Content-Type: application/json`, `ip` → `X-Forwarded-For`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- http/ health config logger` vert ; `pnpm test`, `pnpm typecheck`, `pnpm lint` passent.

- [ ] **Step 5: Commit**

`git commit -m "feat(socle): serveur Hono, en-têtes de sécurité, CSRF, journaux sans données et /api/health"`

---

### Task 7: Démarrage, CLI de base et tâches planifiées

**Files:**
- Create: `apps/server/src/{main.ts, cli.ts, startup-guard.ts, startup.ts}`, `apps/server/src/jobs/{scheduler.ts, registry.ts}`
- Modify: `apps/server/package.json` (devDependency `tsx`)
- Test: `apps/server/test/cli/init.test.ts`, `apps/server/test/startup.test.ts`, `apps/server/test/jobs/scheduler.test.ts`

**Interfaces:**
- Consumes : Task 6 (`loadConfig`, `AppConfig`, `createApp`, `createAppDeps`, `AppDeps`, `createLogger`, `HealthResponse`) ; Tasks 4a et 4b ; Task 3 ; Task 2 (`isUuidV7`).
- Produces : Interfaces partagées §2 (`startup-guard.ts`, `startup.ts`, `jobs/*`, `main.ts`, `cli.ts` avec `init` et `db:check`).

**Spec:** R-DEP-5, R-OPS-3, R-VER-7, R-SYN-25, 08 §4 points 5 et 7, Global Constraints « Garde de démarrage ».

- [ ] **Step 1: Write the failing test**

Dossier temporaire neuf par test ; `env = { APP_ORIGIN: 'http://localhost:3999', APPSPORT_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' }`.
```ts
// cli/init.test.ts
it('init exige la sentinelle', /* runCli(['init']) → 1 ; err /sentinelle/i ; readdirSync(dir) → [] */);
it('init crée la base, migre, initialise l\'époque ; un second init est refusé', async () => {
  writeFileSync(join(dir, '.appsport-volume'), '');
  expect(await runCli(['init'], env, o, e)).toBe(0);
  expect(out).toContain(`Époque du serveur : ${meta.serverEpoch}`);   // isUuidV7(meta.serverEpoch)
  expect(await runCli(['init'], env, o, e)).toBe(1); expect(err.join('\n')).toMatch(/existe déjà/);
});
it('db:check sur une base saine', /* → 0, out.at(-1) === 'OK' */);
it('db:check sans base → 1, aucun fichier créé', /* readdirSync(dir) → ['.appsport-volume'] */);
it('commande inconnue → 1', /* err /Commande inconnue : nope/ et liste les usages (/init/) */);
expect(parseFlags(['alice', '--birth-date', '2000-01-01'])).toEqual({ positional: ['alice'], flags: { 'birth-date': '2000-01-01' } });
// startup.test.ts
it('sans sentinelle → StartupError no_sentinel', () => {});
it('sentinelle sans base → no_database ; startServer rejette et ne crée aucun fichier', () => {});
it('tâches de démarrage avant l\'écoute, /api/health 200, arrêt en moins de 9 s', async () => {
  const s = await startServer(env, { startupTasks: [{ name: 't', run: async () => { calls.push('startup'); } }], dailyJobs: [{ name: 'j', run: async () => { calls.push('job'); } }] });
  expect(calls[0]).toBe('startup'); expect((await fetch(`http://127.0.0.1:${s.port}/api/health`)).status).toBe(200);
  const t0 = performance.now(); await s.close(); expect(performance.now() - t0).toBeLessThan(9000);
});
it('migration inconnue cassante → { name: \'MigrationError\', code: \'unknown_breaking_migration\' }', () => {});
it('migrations inconnues non cassantes → démarre et journalise unknown_migration', () => {});
it('main([\'nope\']) → 1', () => {});
// jobs/scheduler.test.ts (vi.useFakeTimers sur setInterval/clearInterval)
it('chaque job au démarrage puis toutes les 24 h ; stop() arrête', /* a appelé 1 fois, 2 fois après 24 h, toujours 2 après stop */);
it('isole l\'échec d\'un job et le journalise sans son message', /* ligne { level: 'error', job: 'boom' } ; journal sans 'TEMOIN' ; job suivant exécuté */);
expect(STARTUP_TASKS).toEqual([]); expect(DAILY_JOBS).toEqual([]);
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- cli/ startup jobs/` → « Failed to resolve import "../../src/cli" ».

- [ ] **Step 3: Implement**

Textes exacts :
- `StartupError('no_sentinel')` : « Volume de données absent : fichier sentinelle <chemin> introuvable. Le volume chiffré est-il déverrouillé ? » ; `StartupError('no_database')` : « Base introuvable : <chemin>. Lancez « server.mjs init » sur un volume neuf, ou restaurez une sauvegarde. »
- `init` : « Fichier sentinelle absent : <chemin> ; init refusé. » ; « La base existe déjà : <chemin> ; init refusé. » ; succès : `Base initialisée : <dbPath>` puis `Époque du serveur : <epoch>`.
- `db:check` : garde, `PRAGMA integrity_check` = `[{ integrity_check: 'ok' }]` et `foreign_key_check` vide → `OK` ; sinon `Base corrompue : …`, code 1.
- `runCli` : commande inconnue ou absente → `Commande inconnue : <cmd>` puis `  <usage>` par commande, code 1 ; exception d'une commande → message sur `err`, code 1.

`startServer` : `loadConfig` → garde → `openDatabase` → `migrate` (`logger.warn('unknown_migration', { migration })`) → `createAppDeps` → tâches de démarrage → `serve` → `startDailyJobs`. `main` : `SIGTERM`/`SIGINT` → `setTimeout(() => process.exit(1), 9000).unref()` puis `close()` ; point d'entrée `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)` (valable sous `tsx` et dans le bundle). Échec d'un job → `logger.error('job_failed', { job, event: err.name })`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- cli/ startup jobs/` vert ; `pnpm test`, `pnpm typecheck`, `pnpm lint` passent.

- [ ] **Step 5: Commit**

`git commit -m "feat(ops): garde de démarrage, CLI init et db:check, arrêt propre et tâches quotidiennes"`
