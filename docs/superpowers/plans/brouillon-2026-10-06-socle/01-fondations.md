### Task 1: Monorepo, outillage et CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `.node-version`
- Modify: `.gitignore` (ajouter `.e2e-data/`, `apps/*/dist/`, `test-results/`, `playwright-report/`)
- Create: `packages/contracts/{package.json, tsconfig.json, src/index.ts, src/constants.ts}`, `packages/domain/{package.json, tsconfig.json, src/index.ts}`
- Create: `apps/server/{package.json, tsconfig.json}`, `apps/web/{package.json, tsconfig.json}`
- Create: `.github/workflows/ci.yml`
- Test: `apps/server/test/smoke.test.ts`, `apps/web/test/smoke.test.ts`, `apps/server/test/repo/dependencies.test.ts`

**Interfaces:**
- Consumes : rien.
- Produces :
  - les paquets `@appsport/contracts`, `@appsport/domain`, `@appsport/server` et `@appsport/web` ;
  - `packages/contracts/src/constants.ts` minimal, avec `export const MIN_AGE = 16;` (complété en Task 2) ;
  - les projets Vitest `contracts`, `domain`, `server` et `web` ;
  - les scripts racine `lint`, `typecheck`, `test` et `test:e2e`.

**Spec:** 01 §2 (stack et versions), 01 §4 (dépôt), R-TST-1 (Biome, tsc, Vitest bloquants), R-TST-2 (tsc sous TS 6 non bloquant).

- [ ] **Step 1: Write the failing test**

`apps/server/test/smoke.test.ts` vérifie la résolution entre paquets du workspace :
```ts
import { describe, expect, it } from 'vitest';
import { MIN_AGE } from '@appsport/contracts';
describe('workspace', () => {
  it('résout @appsport/contracts depuis le serveur', () => { expect(MIN_AGE).toBe(16); });
});
```
`apps/web/test/smoke.test.ts` fait la même vérification, plus `expect(typeof document.createElement).toBe('function')` pour contrôler l'environnement happy-dom.

`apps/server/test/repo/dependencies.test.ts` lit les quatre `package.json` (chemins relatifs à `import.meta.dirname`) et vérifie le graphe de dépendances autorisé. On ne retient que les clés `@appsport/*` de `dependencies` et `devDependencies` :
```ts
expect(appsportDeps('packages/contracts')).toEqual([]);
expect(appsportDeps('packages/domain')).toEqual(['@appsport/contracts']);
expect(appsportDeps('apps/server')).toEqual(['@appsport/contracts', '@appsport/domain']);
expect(appsportDeps('apps/web', 'dependencies')).toEqual(['@appsport/contracts', '@appsport/domain']);
expect(appsportDeps('apps/web', 'devDependencies')).toEqual(['@appsport/server']);
```
Le test vérifie aussi que le `package.json` racine contient `packageManager` commençant par `pnpm@10.` et `engines.node === '>=24.7'`.

- [ ] **Step 2: Run test to verify it fails**

Commande : `pnpm test`

Échec attendu : avant la création des fichiers, la commande échoue (« No projects matched » ou `ERR_PNPM_NO_SCRIPT`). Une fois les manifestes posés mais `constants.ts` encore absent, l'import échoue avec « Failed to resolve import "@appsport/contracts" ».

- [ ] **Step 3: Implement**

**`package.json` racine**
- Contenu : `"name": "appsport"`, `"private": true`, `"type": "module"`.
- `"packageManager": "pnpm@10.34.6"`, ou la version exacte affichée par `pnpm --version` si elle commence par `10.`.
- `"engines": { "node": ">=24.7" }`.
- Scripts :
  - `"lint": "biome check ."`
  - `"typecheck": "pnpm -r --workspace-concurrency=1 typecheck"`
  - `"test": "vitest run"`
  - `"test:e2e": "pnpm --filter @appsport/web test:e2e"`
- devDependencies racine : `typescript@~7.0`, `@biomejs/biome@^2`, `vitest` (dernière majeure), `@types/node@^24`.

**`pnpm-workspace.yaml`**
```yaml
packages: ['packages/*', 'apps/*']
onlyBuiltDependencies: [better-sqlite3, esbuild]
```

**`.node-version`** : `24`.

**`tsconfig.base.json`** (`compilerOptions`)
- `target: "ES2024"`, `lib: ["ES2024"]`
- `module: "preserve"`, `moduleResolution: "bundler"`
- `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `noEmit: true`
- `isolatedModules: true`, `resolveJsonModule: true`, `skipLibCheck: true`

**tsconfig de chaque paquet**
- Chaque paquet a un `tsconfig.json` avec `"extends": "../../tsconfig.base.json"` et `"include": ["src", "test"]`.
- `apps/server` ajoute `"types": ["node"]`. `packages/domain` et `packages/contracts` ajoutent `"types": []`.
- `apps/web` ajoute :
  - `"lib": ["ES2024", "DOM", "DOM.Iterable"]` ;
  - `"jsx": "react-jsx"` ;
  - `"include": ["src", "test", "e2e", "*.ts"]`.

**Manifestes des paquets**
- Chaque `package.json` de paquet contient `"private": true` et `"type": "module"`.
- Scripts communs :
  - `"typecheck": "tsc --noEmit -p tsconfig.json"` ;
  - `"test": "vitest run --root ../.. --project <nom>"`, où `<nom>` vaut `contracts`, `domain`, `server` ou `web`.
- Exports :
  - `packages/contracts` et `packages/domain` : `"exports": { ".": "./src/index.ts" }` ;
  - `apps/server` : `"exports": { ".": "./src/main.ts", "./testing": "./test/support/index.ts" }`.
- Dépendances `workspace:*` :
  - domain → contracts ;
  - server → contracts et domain ;
  - web → contracts et domain en `dependencies`, server en `devDependencies`.
- `apps/web` a `happy-dom` en devDependency.

**Sources minimales**
- `packages/contracts/src/index.ts` : `export * from './constants';`.
- `packages/domain/src/index.ts` : `export {};`. Ce fichier sera remplacé par des réexportations en Task 2.

**`biome.json`** (Biome 2)
- `formatter` : `indentStyle: "space"`, `indentWidth: 2`, `lineEnding: "lf"`, `lineWidth: 110`.
- `javascript.formatter.quoteStyle: "single"`.
- `linter.rules.recommended: true`.
- `files.includes` : `["**", "!**/node_modules", "!**/dist", "!**/__snapshots__", "!docs", "!.e2e-data", "!test-results", "!playwright-report"]`.

**`vitest.config.ts`**
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { passWithNoTests: true, projects: [
  { test: { name: 'contracts', root: './packages/contracts', environment: 'node', include: ['test/**/*.test.ts'] } },
  { test: { name: 'domain', root: './packages/domain', environment: 'node', include: ['test/**/*.test.ts'] } },
  { test: { name: 'server', root: './apps/server', environment: 'node', include: ['test/**/*.test.ts'] } },
  { test: { name: 'web', root: './apps/web', environment: 'happy-dom', include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'] } },
] } });
```
Les tests importent `describe`, `it` et `expect` depuis `vitest` (pas de globals).

**`.github/workflows/ci.yml`**
- Déclencheurs : `on: { push: { branches: [main] }, pull_request: {} }`, avec `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
- Quatre jobs sur `ubuntu-latest` : `lint`, `typecheck`, `typecheck-ts6` (avec `continue-on-error: true`) et `test`.
- Étapes communes à chaque job :
  1. `actions/checkout@v4` ;
  2. `pnpm/action-setup@v4`, sans `version` (la version est lue dans `packageManager`) ;
  3. `actions/setup-node@v4`, avec `node-version-file: .node-version` et `cache: pnpm` ;
  4. `pnpm install --frozen-lockfile`.
- Dernière étape de chaque job :
  - `lint` : `pnpm lint` ;
  - `typecheck` : `pnpm typecheck` ;
  - `typecheck-ts6` : `pnpm -r --workspace-concurrency=1 exec pnpm dlx --package=typescript@^6 tsc --noEmit -p tsconfig.json` ;
  - `test` : `pnpm test`.

**Choix ouvert** : si pnpm transmet `--` tel quel au script `test` et que Vitest ignore alors le filtre, remplacer le script de paquet par `vitest run --root ../.. --project <nom> --` et vérifier de nouveau la commande filtrée du Step 4.

- [ ] **Step 4: Run test to verify it passes**

Commandes et résultats attendus :
- `pnpm install` réussit et produit `pnpm-lock.yaml`.
- `pnpm test` affiche `Test Files  3 passed`.
- `pnpm --filter @appsport/server test -- smoke` n'exécute que `smoke.test.ts` (`Test Files  1 passed`).
- `pnpm lint` ne signale aucune erreur.
- `pnpm typecheck` se termine avec le code 0.

- [ ] **Step 5: Commit**

```
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json vitest.config.ts .node-version .gitignore packages apps .github ; git commit -m "chore(ci): monorepo pnpm, outillage TypeScript/Biome/Vitest et CI"
```

---

### Task 2: Domaine de base (constantes, UUIDv7, âge, profil prudent)

**Files:**
- Modify: `packages/contracts/src/constants.ts` (version complète)
- Create: `packages/domain/src/ids.ts`, `packages/domain/src/age.ts`, `packages/domain/src/cautious.ts`
- Modify: `packages/domain/src/index.ts` (réexporte `./ids`, `./age`, `./cautious`), `packages/domain/package.json` (devDependency `fast-check@^4`)
- Test: `packages/domain/test/ids.test.ts`, `packages/domain/test/age.test.ts`, `packages/domain/test/cautious.test.ts`, `packages/domain/test/purity.test.ts`, `packages/contracts/test/constants.test.ts`

**Interfaces:**
- Consumes : Task 1 (paquets et projets Vitest).
- Produces :
```ts
// packages/contracts/src/constants.ts
export const MIN_AGE = 16; export const ADULT_AGE = 18;
export const PARIS_TZ = 'Europe/Paris';
export const PRIVACY_POLICY_VERSION = '1.0';
export const SYNC_PROTOCOL = 1; export const MIN_PROTOCOL = 1;
export type Role = 'admin' | 'member'; export type UserStatus = 'active' | 'disabled'; export type AgeBand = 'minor' | 'adult';
// packages/domain/src/ids.ts
export function createUuidV7(unixMs: number, random: Uint8Array): string;
export function createMonotonicUuidV7(now: () => number, random: (n: number) => Uint8Array): () => string;
export function isUuidV7(s: string): boolean;
// packages/domain/src/age.ts
export function parisDate(instant: Date): string;
export function ageOn(birthDate: string, today: string): number;
export function ageBandOn(birthDate: string, today: string): AgeBand;
// packages/domain/src/cautious.ts
export function computeCautious(i: { ageBand: AgeBand; cautiousMode: boolean; healthConsentActive: boolean; caution: boolean | null }): boolean;
```

**Spec:** R-AGE-1, R-AGE-2, R-CST-7, R-SYN-2, 09 §0.2, 02 §15 n°10, 03 §17 n°5 (passage à l'âge adulte sans tâche planifiée).

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/constants.test.ts` vérifie les valeurs exactes :
```ts
expect({ MIN_AGE, ADULT_AGE, PARIS_TZ, PRIVACY_POLICY_VERSION, SYNC_PROTOCOL, MIN_PROTOCOL })
  .toEqual({ MIN_AGE: 16, ADULT_AGE: 18, PARIS_TZ: 'Europe/Paris', PRIVACY_POLICY_VERSION: '1.0', SYNC_PROTOCOL: 1, MIN_PROTOCOL: 1 });
expect(MIN_PROTOCOL).toBeGreaterThanOrEqual(SYNC_PROTOCOL - 1); // R-VER-1
```

`packages/domain/test/ids.test.ts` :
```ts
it('reproduit le vecteur de la RFC 9562', () => {
  const r = Uint8Array.of(0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f);
  expect(createUuidV7(0x017f22e279b0, r)).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
});
it('refuse un aléa de moins de 10 octets et un horodatage hors [0, 2^48)', () => {
  expect(() => createUuidV7(0, new Uint8Array(9))).toThrow(RangeError);
  expect(() => createUuidV7(-1, new Uint8Array(10))).toThrow(RangeError);
  expect(() => createUuidV7(2 ** 48, new Uint8Array(10))).toThrow(RangeError);
});
it('isUuidV7 : minuscules, version 7, variante 10xx uniquement', () => {
  expect(isUuidV7('017f22e2-79b0-7cc3-98c4-dc0c0c07398f')).toBe(true);
  expect(isUuidV7('017F22E2-79B0-7CC3-98C4-DC0C0C07398F')).toBe(false); // [décision plan] minuscules seulement
  expect(isUuidV7('017f22e2-79b0-4cc3-98c4-dc0c0c07398f')).toBe(false); // v4
  expect(isUuidV7('017f22e2-79b0-7cc3-c8c4-dc0c0c07398f')).toBe(false); // variante
  expect(isUuidV7('user:1')).toBe(false);
});
it('createMonotonicUuidV7 reste strictement croissant quand l\'horloge recule', () => {
  const times = [1000, 999, 999, 500, 1000, 1001];
  let i = 0; let seed = 7;
  const gen = createMonotonicUuidV7(() => times[Math.min(i++, times.length - 1)]!, (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 31 + 11) % 256)));
  const ids = Array.from({ length: 5000 }, () => gen());
  for (let k = 1; k < ids.length; k++) expect(ids[k]! > ids[k - 1]!).toBe(true);
  expect(ids.every(isUuidV7)).toBe(true);
});
it('propriété : toute suite d\'horloges donne des identifiants uniques et croissants', () => {
  fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 2 ** 40 }), { minLength: 1, maxLength: 300 }), (clock) => { /* même vérification */ }));
});
```

`packages/domain/test/age.test.ts` (02 §15 n°10) :
```ts
expect(ageOn('2000-06-15', '2018-06-14')).toBe(17); // veille
expect(ageOn('2000-06-15', '2018-06-15')).toBe(18); // jour même
expect(ageOn('2008-02-29', '2026-02-28')).toBe(17); // année non bissextile : pas encore
expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
expect(ageOn('2008-02-29', '2028-02-29')).toBe(20); // année bissextile
expect(ageOn('2010-10-07', '2026-10-06')).toBe(15); // 15 ans et 364 jours
expect(() => ageOn('2008-02-30', '2026-01-01')).toThrow(RangeError);
expect(() => ageOn('2008-2-3', '2026-01-01')).toThrow(RangeError);
expect(parisDate(new Date('2026-03-31T22:30:00Z'))).toBe('2026-04-01'); // heure d'été, UTC+2
expect(parisDate(new Date('2026-03-31T21:30:00Z'))).toBe('2026-03-31');
expect(parisDate(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02'); // heure d'hiver, UTC+1
expect(ageBandOn('2008-04-01', parisDate(new Date('2026-03-31T21:30:00Z')))).toBe('minor');
expect(ageBandOn('2008-04-01', parisDate(new Date('2026-03-31T22:30:00Z')))).toBe('adult'); // 18 ans le 1er avril à Paris
expect(ageBandOn('2010-10-06', '2026-10-06')).toBe('minor'); // 16 ans
```

`packages/domain/test/cautious.test.ts` contient une table de vérité complète en `it.each`. On a 2 × 2 × 2 × 3 = 24 cas. Le résultat attendu est :
```
ageBand === 'minor' || cautiousMode || (healthConsentActive && caution === true)
```
Le test contient en plus deux cas nommés (R-CST-7) :
- `{ adult, cautiousMode: false, healthConsentActive: false, caution: true }` → `false` (indicateur ignoré sans consentement) ;
- `{ minor, false, false, null }` → `true`.

`packages/domain/test/purity.test.ts` lit récursivement tous les `.ts` de `packages/domain/src` avec `node:fs`. Il échoue si un fichier contient l'un de ces motifs :
- `/\bDate\.now\s*\(/`
- `/\bMath\.random\s*\(/`
- `/new Date\(\s*\)/`
- `/from ['"]node:/`

- [ ] **Step 2: Run test to verify it fails**

Commandes :
- `pnpm --filter @appsport/domain test`
- `pnpm --filter @appsport/contracts test -- constants`

Échec attendu : « Failed to resolve import "../src/ids" » (même message pour `age` et `cautious`). Côté contracts, `ADULT_AGE` vaut `undefined`.

- [ ] **Step 3: Implement**

**Fichiers et fonctions**
- `constants.ts` reprend exactement les déclarations de **Produces**.
- `isUuidV7` utilise `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`.
- `parisDate` utilise `new Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)`.
- `ageOn` :
  1. valide les deux dates (motif `YYYY-MM-DD` et date calendaire réelle), sinon lève `RangeError` ;
  2. calcule `années = Y(today) − Y(birth)` et retranche 1 si l'anniversaire de l'année n'est pas encore atteint ;
  3. pour une naissance au `02-29`, l'anniversaire d'une année non bissextile est le `03-01`.
- `ageBandOn` renvoie `'minor'` si `ageOn < ADULT_AGE`, sinon `'adult'`.

**Disposition des octets dans `createUuidV7`** (les 10 premiers octets de `random` sont utilisés)
- octets 0 à 5 : `unixMs` sur 48 bits, gros-boutiste ;
- octet 6 : `0x70 | (r[0] & 0x0f)` ;
- octet 7 : `r[1]` ;
- octet 8 : `0x80 | (r[2] & 0x3f)` ;
- octets 9 à 15 : `r[3..9]`.

La sortie est en hexadécimal minuscule, au format 8-4-4-4-12.

**Algorithme de `createMonotonicUuidV7`** (méthode 1 de la RFC 9562, compteur sur les 12 bits de `rand_a`) :
```ts
let lastMs = -1; let seq = 0;
return () => {
  const t = Math.floor(now());
  if (t > lastMs) { lastMs = t; const r = random(2); seq = ((r[0]! & 0x07) << 8) | r[1]!; } // 11 bits aléatoires : marge d'incrément
  else { seq += 1; if (seq > 0xfff) { lastMs += 1; seq = 0; } }                             // horloge figée ou en recul
  return createUuidV7(lastMs, Uint8Array.of(seq >> 8, seq & 0xff, ...random(8)));
};
```

- [ ] **Step 4: Run test to verify it passes**

Commandes et résultats attendus :
- `pnpm --filter @appsport/domain test` affiche `Test Files  4 passed`.
- `pnpm --filter @appsport/contracts test` est vert.
- `pnpm typecheck` et `pnpm lint` passent.

- [ ] **Step 5: Commit**

```
git add packages pnpm-lock.yaml ; git commit -m "feat(socle): constantes partagées, UUIDv7 monotones, âge à Paris et profil prudent"
```

---

### Task 3: Adaptateur Kysely pour `node:sqlite`

**Files:**
- Create: `apps/server/src/db/sqlite-dialect.ts`, `apps/server/src/db/open.ts`
- Create: `apps/server/src/db/schema.ts`, en version minimale complétée par la Task 4 : `export interface Database {}` et `export type DbExecutor = Kysely<Database> | Transaction<Database>;`
- Modify: `apps/server/package.json`
  - dépendances : `kysely@~0.29` ;
  - devDependencies : `better-sqlite3`, `@types/better-sqlite3`.
- Test: `apps/server/test/db/adapter.test.ts`

**Interfaces:**
- Consumes : Task 1.
- Produces :
```ts
// apps/server/src/db/sqlite-dialect.ts
export class NodeSqliteDialect implements Dialect { constructor(cfg: { database: DatabaseSync }) }
// apps/server/src/db/open.ts
export function openDatabase(path: string): { sqlite: DatabaseSync; db: Kysely<Database> };
// apps/server/src/db/schema.ts (squelette ; complété en Task 4)
export interface Database {}
export type DbExecutor = Kysely<Database> | Transaction<Database>;
```

**Spec:** 01 §2 (Base : WAL, `synchronous=FULL`, `foreign_keys=ON`, `busy_timeout` ; Accès SQL : adaptateur remplaçable par better-sqlite3), 01 §9.1.4 (tests de l'adaptateur rejoués sur better-sqlite3), Review Focus 1 (sérialisation sur l'unique connexion).

- [ ] **Step 1: Write the failing test**

`apps/server/test/db/adapter.test.ts`
```ts
type Item = { id: Generated<number>; itemName: string; qty: Generated<number> };
type TestDb = { item: Item };
const factories = {
  'node:sqlite': () => openDatabase(':memory:').db.withTables<TestDb>(),
  'better-sqlite3': () => new Kysely<TestDb>({ dialect: new SqliteDialect({ database: new BetterSqlite3(':memory:') }), plugins: [new CamelCasePlugin()] }),
};
describe.each(Object.entries(factories))('adaptateur %s', (_name, make) => {
  let db: Kysely<TestDb>;
  beforeEach(async () => { db = make(); await sql`CREATE TABLE item (id INTEGER PRIMARY KEY, item_name TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0) STRICT`.execute(db); });
  const names = async () => (await db.selectFrom('item').select('itemName').orderBy('id').execute()).map((r) => r.itemName);

  it('CRUD avec CamelCasePlugin, insertId et numAffectedRows', async () => {
    const ins = await db.insertInto('item').values({ itemName: 'a' }).executeTakeFirstOrThrow();
    expect(ins.insertId).toBe(1n);
    await db.insertInto('item').values({ itemName: 'b' }).execute();
    const upd = await db.updateTable('item').set({ qty: 3 }).executeTakeFirstOrThrow();
    expect(upd.numUpdatedRows).toBe(2n);
    expect(await db.selectFrom('item').selectAll().where('id', '=', 1).executeTakeFirst()).toEqual({ id: 1, itemName: 'a', qty: 3 });
    const del = await db.deleteFrom('item').where('itemName', '=', 'b').executeTakeFirstOrThrow();
    expect(del.numDeletedRows).toBe(1n);
  });
  it('RETURNING renvoie les lignes', async () => {
    expect(await db.insertInto('item').values({ itemName: 'r' }).returning(['id', 'itemName']).execute()).toEqual([{ id: 1, itemName: 'r' }]);
  });
  it('une transaction qui lève est annulée', async () => {
    await expect(db.transaction().execute(async (trx) => { await trx.insertInto('item').values({ itemName: 'x' }).execute(); throw new Error('échec voulu'); })).rejects.toThrow('échec voulu');
    expect(await names()).toEqual([]);
    await db.insertInto('item').values({ itemName: 'après' }).execute(); // la connexion est libérée
    expect(await names()).toEqual(['après']);
  });
  it('un savepoint annulé ne perd pas le reste de la transaction', async () => {
    const trx = await db.startTransaction().execute();
    await trx.insertInto('item').values({ itemName: 'garde' }).execute();
    const sp = await trx.savepoint('op1').execute();
    await sp.insertInto('item').values({ itemName: 'jete' }).execute();
    await sp.rollbackToSavepoint('op1').execute();
    const sp2 = await trx.savepoint('op2').execute();
    await sp2.insertInto('item').values({ itemName: 'garde2' }).execute();
    await sp2.releaseSavepoint('op2').execute();
    await trx.commit().execute();
    expect(await names()).toEqual(['garde', 'garde2']);
  });
  it('Review Focus 1 : deux transactions concurrentes sont sérialisées ; l\'échec de l\'une n\'annule pas l\'autre', async () => {
    const tick = () => new Promise((r) => setTimeout(r, 5));
    const res = await Promise.allSettled([
      db.transaction().execute(async (trx) => { await trx.insertInto('item').values({ itemName: 'a' }).execute(); await tick(); throw new Error('échec voulu'); }),
      db.transaction().execute(async (trx) => { await trx.insertInto('item').values({ itemName: 'b' }).execute(); await tick(); }),
    ]);
    expect(res.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(await names()).toEqual(['b']);
  });
  it('Review Focus 1 : une requête hors transaction attend la fin de la transaction ouverte et n\'est pas annulée avec elle', async () => {
    let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
    const t = db.transaction().execute(async (trx) => { await trx.insertInto('item').values({ itemName: 'dedans' }).execute(); await gate; throw new Error('annule'); });
    await new Promise((r) => setTimeout(r, 5));
    const outside = db.insertInto('item').values({ itemName: 'dehors' }).execute();
    release();
    await expect(t).rejects.toThrow('annule');
    await outside;
    expect(await names()).toEqual(['dehors']);
  });
});
describe('openDatabase', () => {
  it('applique les PRAGMA fixés sur un fichier', () => {
    // dossier temporaire (mkdtempSync(join(tmpdir(), 'appsport-'))), base 'a.db'
    const { sqlite } = openDatabase(join(dir, 'a.db'));
    const one = (p: string) => Object.values(sqlite.prepare(`PRAGMA ${p}`).get()!)[0];
    expect(one('journal_mode')).toBe('wal');
    expect(one('synchronous')).toBe(2); // FULL
    expect(one('foreign_keys')).toBe(1);
    expect(one('busy_timeout')).toBe(5000);
    sqlite.close(); // fermer avant rmSync (Windows)
  });
  it('accepte :memory:', () => { expect(() => openDatabase(':memory:').sqlite.close()).not.toThrow(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Commande : `pnpm --filter @appsport/server test -- adapter`

Échec attendu : « Failed to resolve import "../../src/db/open" ».

- [ ] **Step 3: Implement**

**`NodeSqliteDialect`**
- Il implémente `createDriver`, `createQueryCompiler` (`SqliteQueryCompiler`), `createAdapter` (`SqliteAdapter`) et `createIntrospector` (`SqliteIntrospector`).

**Le driver**
- Il garde **une seule connexion** et un mutex. `acquireConnection` attend la libération précédente, et `releaseConnection` libère le mutex. Une file de promesses suffit.
- Les transactions s'ouvrent par `beginTransaction` → `BEGIN IMMEDIATE` **[décision plan]**. Ce choix évite un `SQLITE_BUSY` à la montée en écriture quand la CLI écrit en parallèle via `docker compose exec`.
- `commitTransaction` → `COMMIT`, `rollbackTransaction` → `ROLLBACK`.
- `savepoint`, `rollbackToSavepoint` et `releaseSavepoint` sont implémentés comme dans le `SqliteDriver` de Kysely (`parseSavepointCommand` et `createQueryId`).
- `destroy` ne ferme pas la base : c'est l'appelant qui possède `sqlite`.

**La connexion**
- `executeQuery` fait `const stmt = database.prepare(sql)`.
- Si `stmt.columns().length > 0`, la requête lit des lignes (SELECT ou RETURNING) : on renvoie `{ rows: stmt.all(...parameters) }`.
- Sinon, `const r = stmt.run(...parameters)` et l'on renvoie `{ rows: [], numAffectedRows: BigInt(r.changes), insertId: BigInt(r.lastInsertRowid) }`.
- `streamQuery` itère sur `stmt.iterate()`.
- Aucune conversion de booléens : le code écrit 0 ou 1 lui-même.

**`openDatabase(path)`**
1. `new DatabaseSync(path)` ;
2. `exec` de `PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;` ;
3. `new Kysely<Database>({ dialect: new NodeSqliteDialect({ database: sqlite }), plugins: [new CamelCasePlugin()] })`.

- [ ] **Step 4: Run test to verify it passes**

Commande : `pnpm --filter @appsport/server test -- adapter`

Résultat attendu : tous les cas passent pour les deux adaptateurs (`node:sqlite` et `better-sqlite3`).

- [ ] **Step 5: Commit**

```
git add apps/server pnpm-lock.yaml ; git commit -m "feat(db): adaptateur Kysely pour node:sqlite, sérialisé et testé contre better-sqlite3"
```

---

### Task 4: Migrations et schéma du socle

**Files:**
- Modify: `apps/server/src/db/schema.ts` (version complète)
- Create:
  - `apps/server/src/db/migrate.ts`, `apps/server/src/db/server-meta.ts`, `apps/server/src/db/rev.ts` ;
  - `apps/server/src/db/migrations/index.ts`, `apps/server/src/db/migrations/0001_socle.ts` ;
  - `apps/server/src/deps.ts`, avec seulement `Clock`, `IdGen`, `systemClock` et `cryptoIds`. La Task 6 y ajoutera le reste.
- Create (test support): `apps/server/test/support/clock.ts`, `apps/server/test/support/ids.ts`, `apps/server/test/support/index.ts`
- Test: `apps/server/test/db/migrate.test.ts`, `apps/server/test/db/schema.test.ts`, `apps/server/test/db/rev.test.ts`, `apps/server/test/support/support.test.ts`, `apps/server/test/__snapshots__/schema.sql` (généré)

**Interfaces:**
- Consumes :
  - Task 3 : `openDatabase` et `DbExecutor` ;
  - Task 2 : `createMonotonicUuidV7` et `isUuidV7`.
- Produces :
```ts
// apps/server/src/deps.ts
export interface Clock { now(): Date }
export interface IdGen { uuidv7(): string; randomBytes(n: number): Uint8Array }
export const systemClock: Clock;            // { now: () => new Date() }
export function cryptoIds(): IdGen;          // createMonotonicUuidV7(() => Date.now(), n => node:crypto randomBytes)
// apps/server/src/db/schema.ts
export interface Database { serverMeta: ServerMetaTable; schemaMigrations: SchemaMigrationsTable; appliedOp: AppliedOpTable;
  syncRejection: SyncRejectionTable; user: UserTable; invitation: InvitationTable; passwordReset: PasswordResetTable;
  session: SessionTable; consentEvent: ConsentEventTable; securityEvent: SecurityEventTable; trainingProfile: TrainingProfileTable;
  healthScreening: HealthScreeningTable; limitation: LimitationTable; gym: GymTable; gymEquipment: GymEquipmentTable;
  gymHistory: GymHistoryTable; place: PlaceTable; homeEquipment: HomeEquipmentTable }
export type DbExecutor = Kysely<Database> | Transaction<Database>;
export function tableKey(sqlTable: string): keyof Database;   // 'training_profile' → 'trainingProfile'
// apps/server/src/db/migrations/index.ts
export interface Migration { id: string; breaking: boolean; up(db: Kysely<any>): Promise<void> }
export const MIGRATIONS: readonly Migration[];   // [{ id: '0001_socle', breaking: false, up }]
// apps/server/src/db/migrate.ts
export class MigrationError extends Error { code: 'migration_failed' | 'unknown_breaking_migration' }
export async function migrate(db: Kysely<any>, migrations: readonly Migration[], clock: Clock): Promise<{ applied: string[]; unknownNonBreaking: string[] }>;
// apps/server/src/db/server-meta.ts
export interface ServerMeta { serverEpoch: string; epochBaseRev: number; syncCounter: number; tombstonePurgeRev: number; catalogVersion: string | null; catalogUpdatedAt: string | null }
export async function getServerMeta(db: DbExecutor): Promise<ServerMeta>;
export async function initServerMeta(db: DbExecutor, ids: IdGen): Promise<ServerMeta>;
// apps/server/src/db/rev.ts
export async function nextRev(trx: DbExecutor): Promise<number>;
export async function writeStamp(trx: DbExecutor, deps: { clock: Clock }, actorId: string | null): Promise<{ rev: number; updatedAt: string; updatedBy: string | null }>; // accepte AppDeps
// apps/server/test/support (exporté par @appsport/server/testing)
export class FakeClock implements Clock { constructor(iso?: string); now(): Date; set(iso: string): void; advance(ms: number): void }
export function seqIds(seed?: number): IdGen;
```

**Spec:**
- R-VER-6 et R-VER-7 (migrations déclarées `breaking`, transaction unique, refus d'une migration inconnue cassante) ;
- R-SYN-1 et R-SYN-3 (colonnes +SYNC, `rev` global, heure serveur) ;
- 09 §0 (conventions STRICT, types) et 09 §1 (18 tables du socle) ;
- 01 §9.1.4 (instantané de `sqlite_schema`) ;
- Global Constraints, « Ajouts au modèle [décision plan] » (1) à (4).

- [ ] **Step 1: Write the failing test**

`apps/server/test/support/support.test.ts` :
```ts
it('FakeClock', () => { const c = new FakeClock(); expect(c.now().toISOString()).toBe('2026-10-06T10:00:00.000Z'); c.advance(1500); expect(c.now().toISOString()).toBe('2026-10-06T10:00:01.500Z'); c.set('2027-01-01T00:00:00.000Z'); expect(c.now().toISOString()).toBe('2027-01-01T00:00:00.000Z'); });
it('seqIds est déterministe, croissant et au format UUIDv7', () => {
  const a = seqIds(1), b = seqIds(1);
  const xs = Array.from({ length: 50 }, () => a.uuidv7());
  expect(Array.from({ length: 50 }, () => b.uuidv7())).toEqual(xs);
  expect(xs.every(isUuidV7)).toBe(true);
  expect([...xs].sort()).toEqual(xs);
  expect(seqIds(2).uuidv7()).not.toBe(seqIds(1).uuidv7());
  expect(a.randomBytes(16)).toHaveLength(16);
});
```

`apps/server/test/db/migrate.test.ts` :
```ts
const fresh = () => openDatabase(':memory:');
it('applique 0001_socle puis est idempotent', async () => {
  const { db } = fresh(); const clock = new FakeClock();
  expect(await migrate(db, MIGRATIONS, clock)).toEqual({ applied: ['0001_socle'], unknownNonBreaking: [] });
  expect(await migrate(db, MIGRATIONS, clock)).toEqual({ applied: [], unknownNonBreaking: [] });
  expect(await db.selectFrom('schemaMigrations').selectAll().execute()).toEqual([{ id: '0001_socle', breaking: 0, appliedAt: '2026-10-06T10:00:00.000Z' }]);
});
it('un échec annule toute la série et lève MigrationError(migration_failed)', async () => {
  const { db } = fresh();
  const failing: Migration = { id: '0002_fail', breaking: false, up: async (d) => { await sql`CREATE TABLE x (a TEXT) STRICT`.execute(d); throw new Error('boom'); } };
  await expect(migrate(db, [...MIGRATIONS, failing], new FakeClock())).rejects.toMatchObject({ name: 'MigrationError', code: 'migration_failed' });
  const tables = (await sql<{ name: string }>`SELECT name FROM sqlite_schema WHERE type='table'`.execute(db)).rows.map((r) => r.name);
  expect(tables).not.toContain('user'); expect(tables).not.toContain('x');
  expect(await db.selectFrom('schemaMigrations').selectAll().execute()).toEqual([]);
});
it('une migration inconnue cassante interdit le démarrage (R-VER-7)', async () => {
  const { db } = fresh(); await migrate(db, MIGRATIONS, new FakeClock());
  await db.insertInto('schemaMigrations').values({ id: '0099_future', breaking: 1, appliedAt: '2026-11-01T00:00:00.000Z' }).execute();
  await expect(migrate(db, MIGRATIONS, new FakeClock())).rejects.toMatchObject({ code: 'unknown_breaking_migration' });
});
it('des migrations inconnues non cassantes sont signalées mais permises (retour arrière sans restauration)', async () => {
  const { db } = fresh(); await migrate(db, MIGRATIONS, new FakeClock());
  await db.insertInto('schemaMigrations').values({ id: '0002_future', breaking: 0, appliedAt: '2026-11-01T00:00:00.000Z' }).execute();
  expect(await migrate(db, MIGRATIONS, new FakeClock())).toEqual({ applied: [], unknownNonBreaking: ['0002_future'] });
});
```

`apps/server/test/db/schema.test.ts` utilise une base migrée et un petit utilitaire `exec(sql)`. Ses assertions :
```ts
it('instantané de sqlite_schema', async () => {
  const rows = sqlite.prepare(`SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type, name`).all();
  await expect(rows.map((r) => `-- ${r.type} ${r.name}\n${r.sql};`).join('\n\n') + '\n').toMatchFileSnapshot('../__snapshots__/schema.sql');
});
it('18 tables, toutes STRICT', () => {
  const t = sqlite.prepare(`SELECT name, strict FROM pragma_table_list WHERE schema='main' AND type='table' AND name NOT LIKE 'sqlite_%'`).all();
  expect(t).toHaveLength(18); expect(t.every((r) => r.strict === 1)).toBe(true);
});
```
Les contraintes sont vérifiées une à une. Chaque refus attend `/CHECK constraint failed|UNIQUE constraint failed|FOREIGN KEY constraint failed/`.

| Cas | Attendu |
|---|---|
| Ligne `server_meta` avec `id = 2` | refusée |
| `user.role = 'root'` | refusé |
| `user.onboarding_step = 'nope'` | refusé |
| `user.onboarding_step` à NULL | accepté |
| `training_profile` avec `id ≠ owner_id` | refusé |
| `training_profile` avec `goal`, `experience`, `days_per_week` et `session_minutes` à NULL | accepté (décision plan 3) |
| `days_per_week = 5` | refusé |
| `session_minutes = 50` | refusé |
| `health_screening` sans contenu avec `deleted_at` NULL | refusé |
| `health_screening` sans contenu avec `deleted_at` renseigné | accepté (décision plan 2) |
| `limitation` : même règle, et `body_area = 'tete'` | refusé |
| `place` : deux `is_primary = 1` non supprimés pour un même `owner_id` | refusé |
| `place` : idem quand l'un des deux est supprimé | accepté |
| `place` : deux lieux non supprimés sur le même `gym_id` | refusé |
| `place` : `kind = 'gym'` sans `gym_id` | refusé |
| `place` : `kind = 'gym'` avec `load_settings` | refusé |
| `place` : `kind = 'gym'` avec `name` | refusé |
| `gym` : doublon `(name_key, city_key)` | refusé |
| `gym` : `name` d'un seul caractère | refusé |
| `gym_equipment.id` différent de `gym_id || ':' || equipment_code` | refusé |
| `home_equipment.id` différent de `place_id || ':' || equipment_code` | refusé |
| `invitation.note` de 61 caractères | refusé |
| Suppression d'un `user` | supprime en cascade ses `training_profile`, `place`, `consent_event` et `password_reset`, et met `session.user_id` et `gym_history.author_id` à NULL |
| `PRAGMA foreign_key_check` après tous ces cas | vide |

`apps/server/test/db/rev.test.ts` :
```ts
it('initServerMeta puis getServerMeta', async () => {
  const meta = await initServerMeta(db, seqIds(1));
  expect(isUuidV7(meta.serverEpoch)).toBe(true);
  expect(meta).toMatchObject({ epochBaseRev: 0, syncCounter: 0, tombstonePurgeRev: 0, catalogVersion: null, catalogUpdatedAt: null });
  expect(await getServerMeta(db)).toEqual(meta);
});
it('getServerMeta sans ligne lève une erreur', async () => { await expect(getServerMeta(db)).rejects.toThrow('server_meta absent'); });
it('nextRev est strictement croissant et annulé avec sa transaction', async () => {
  await initServerMeta(db, seqIds(1));
  expect([await nextRev(db), await nextRev(db), await nextRev(db)]).toEqual([1, 2, 3]);
  await expect(db.transaction().execute(async (trx) => { await nextRev(trx); throw new Error('x'); })).rejects.toThrow();
  expect(await nextRev(db)).toBe(4);
});
it('writeStamp renvoie l\'heure du FakeClock', async () => {
  await initServerMeta(db, seqIds(1));
  expect(await writeStamp(db, { clock: new FakeClock() }, 'u1')).toEqual({ rev: 1, updatedAt: '2026-10-06T10:00:00.000Z', updatedBy: 'u1' });
});
it('tableKey', () => { expect(tableKey('training_profile')).toBe('trainingProfile'); expect(tableKey('user')).toBe('user'); });
```

- [ ] **Step 2: Run test to verify it fails**

Commande : `pnpm --filter @appsport/server test -- db/ support`

Échec attendu : « Failed to resolve import "../../src/db/migrate" », et de même pour `../support`.

- [ ] **Step 3: Implement**

**`migrate(db, migrations, clock)`**
1. Hors transaction, crée la table de suivi si elle manque :
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, breaking INTEGER NOT NULL CHECK (breaking IN (0,1)), applied_at TEXT NOT NULL) STRICT
   ```
   Cette table n'est pas créée par 0001.
2. Lit les lignes de `schema_migrations`.
3. Une ligne absente de `migrations` avec `breaking = 1` lève `MigrationError('unknown_breaking_migration')` sans rien appliquer.
4. Dans **une seule** `db.transaction()`, applique dans l'ordre chaque migration connue non appliquée, puis insère sa ligne avec `applied_at = clock.now().toISOString()`.
5. Toute erreur pendant cette transaction est relevée comme `MigrationError('migration_failed')`, avec `cause` et un message en français qui contient l'`id` de la migration.

**`0001_socle.ts`**
- Exécute une liste de chaînes DDL, chacune par `sql.raw(s).execute(db)`.
- Chaque `CREATE TABLE` se termine par `STRICT`.
- Les dates sont en `TEXT`.

Gabarit **+SYNC**, dans cet ordre :
```sql
owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
rev INTEGER NOT NULL,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL,
updated_by TEXT REFERENCES user(id) ON DELETE SET NULL,
deleted_at TEXT
```

Colonnes de chaque table, dans l'ordre du DDL. Booléen signifie `INTEGER NOT NULL CHECK (x IN (0,1))`. Les colonnes sans `NOT NULL` sont nullables.

| Table | Colonnes |
|---|---|
| `server_meta` | `id INTEGER PRIMARY KEY CHECK (id = 1)`, `server_epoch TEXT NOT NULL`, `epoch_base_rev INTEGER NOT NULL DEFAULT 0`, `sync_counter INTEGER NOT NULL DEFAULT 0`, `tombstone_purge_rev INTEGER NOT NULL DEFAULT 0`, `catalog_version TEXT`, `catalog_updated_at TEXT` |
| `applied_op` | `op_id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE`, `entity TEXT NOT NULL`, `row_id TEXT NOT NULL`, `status TEXT NOT NULL CHECK (status IN ('applied','applied_partial','duplicate','rejected'))`, `assigned_rev INTEGER`, `applied_at TEXT NOT NULL` |
| `sync_rejection` | `id TEXT PRIMARY KEY`, +SYNC, `op_id TEXT NOT NULL`, `entity TEXT NOT NULL`, `row_id TEXT NOT NULL`, `code TEXT NOT NULL CHECK (code IN ('validation','forbidden','parent_rejected','stale_revision','unknown_entity','protocol'))`, `detail_json TEXT CHECK (json_valid(detail_json))`, `dismissed_at TEXT` |
| `user` | `id TEXT PRIMARY KEY`, `username TEXT NOT NULL`, `username_key TEXT NOT NULL UNIQUE`, `password_hash TEXT NOT NULL`, `role TEXT NOT NULL CHECK (role IN ('admin','member'))`, `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))`, `birth_date TEXT NOT NULL`, `terms_version TEXT`, `terms_accepted_at TEXT`, `last_login_at TEXT`, `password_changed_at TEXT`, `onboarding_step TEXT CHECK (onboarding_step IN ('goal','sport','place_kind','place','experience','availability','health','ready'))`, `onboarding_completed_at TEXT`, `invitation_id TEXT REFERENCES invitation(id) ON DELETE SET NULL`, `rev INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `updated_by TEXT REFERENCES user(id) ON DELETE SET NULL` |
| `invitation` | `id TEXT PRIMARY KEY`, `code_hash TEXT NOT NULL UNIQUE`, `note TEXT CHECK (length(note) <= 60)`, `birth_date TEXT`, `is_admin_bootstrap INTEGER NOT NULL DEFAULT 0 CHECK (…)`, `created_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `used_at TEXT`, `used_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `revoked_at TEXT` |
| `password_reset` | `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE`, `code_hash TEXT NOT NULL UNIQUE`, `created_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `used_at TEXT`, `cancelled_at TEXT` |
| `session` | `id TEXT PRIMARY KEY`, `token_hash TEXT NOT NULL UNIQUE`, `user_id TEXT REFERENCES user(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `last_seen_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `revoked_at TEXT`, `revoked_reason TEXT CHECK (revoked_reason IN ('logout','logout_all','password_change','password_reset','admin','account_deleted'))` |
| `consent_event` | `id TEXT PRIMARY KEY`, `owner_id` (FK cascade), `type TEXT NOT NULL CHECK (type IN ('health','ai_coach'))`, `action TEXT NOT NULL CHECK (action IN ('grant','withdraw'))`, `text_version TEXT NOT NULL`, `rev`, `created_at`, `updated_at`, `updated_by` (gabarit +SYNC **sans** `deleted_at`) |
| `security_event` | `id TEXT PRIMARY KEY`, `at TEXT NOT NULL`, `type TEXT NOT NULL`, `actor_id TEXT`, `target_id TEXT` (sans FK), `tailnet_ip TEXT`, `outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','blocked'))`, `details TEXT CHECK (json_valid(details))` |
| `training_profile` | `id TEXT PRIMARY KEY`, +SYNC, `goal TEXT CHECK (goal IN ('muscle','strength','fat_loss','fitness','sport_support'))`, `experience TEXT CHECK (experience IN ('none','lt_6_months','6_to_24_months','gt_24_months'))`, `days_per_week INTEGER CHECK (days_per_week BETWEEN 2 AND 4)`, `session_minutes INTEGER CHECK (session_minutes IN (30,45,60,75,90))`, `sport_code TEXT`, `sport_other_label TEXT CHECK (length(sport_other_label) <= 40)`, `cautious_mode` (booléen) `DEFAULT 0`, `CHECK (id = owner_id)` |
| `health_screening` | `id TEXT PRIMARY KEY`, +SYNC, `caution INTEGER CHECK (caution IN (0,1))`, `questionnaire_version TEXT`, `answered_at TEXT`, `CHECK (id = owner_id)`, `CHECK (deleted_at IS NOT NULL OR (caution IS NOT NULL AND questionnaire_version IS NOT NULL AND answered_at IS NOT NULL))` |
| `limitation` | `id TEXT PRIMARY KEY`, +SYNC, `body_area TEXT CHECK (body_area IN ('shoulder','elbow','wrist_hand','neck','upper_back','lower_back','hip','knee','ankle_foot','other'))`, `side TEXT CHECK (side IN ('left','right','both','not_applicable'))`, `severity TEXT CHECK (severity IN ('mild','severe'))`, `note TEXT CHECK (length(note) <= 200)`, `active INTEGER CHECK (active IN (0,1))`, `CHECK (deleted_at IS NOT NULL OR (body_area IS NOT NULL AND side IS NOT NULL AND severity IS NOT NULL AND active IS NOT NULL))` |
| `gym` | `id TEXT PRIMARY KEY`, `name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60)`, `name_key TEXT NOT NULL`, `city TEXT NOT NULL CHECK (length(city) BETWEEN 2 AND 60)`, `city_key TEXT NOT NULL`, `load_settings TEXT NOT NULL CHECK (json_valid(load_settings))`, `created_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `updated_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `rev INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT`, `UNIQUE (name_key, city_key)` |
| `gym_equipment` | `id TEXT PRIMARY KEY`, `gym_id TEXT NOT NULL REFERENCES gym(id) ON DELETE CASCADE`, `equipment_code TEXT NOT NULL`, `added_by TEXT REFERENCES user(id) ON DELETE SET NULL`, `rev INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT`, `CHECK (id = gym_id || ':' || equipment_code)` |
| `gym_history` | `id TEXT PRIMARY KEY`, `gym_id TEXT NOT NULL REFERENCES gym(id) ON DELETE CASCADE`, `author_id TEXT REFERENCES user(id) ON DELETE SET NULL`, `at TEXT NOT NULL`, `action TEXT NOT NULL CHECK (action IN ('create','update_info','add_equipment','remove_equipment','update_load_settings'))`, `detail TEXT NOT NULL CHECK (json_valid(detail))` |
| `place` | `id TEXT PRIMARY KEY`, +SYNC, `kind TEXT NOT NULL CHECK (kind IN ('gym','home'))`, `gym_id TEXT REFERENCES gym(id)`, `name TEXT CHECK (length(name) <= 30)`, `is_primary` (booléen) `DEFAULT 0`, `visible_at_gym` (booléen) `DEFAULT 0`, `load_settings TEXT CHECK (json_valid(load_settings))`, `CHECK (kind = 'home' OR load_settings IS NULL)`, `CHECK ((kind = 'gym') = (gym_id IS NOT NULL))`, `CHECK (kind = 'home' OR name IS NULL)` |
| `home_equipment` | `id TEXT PRIMARY KEY`, `place_id TEXT NOT NULL REFERENCES place(id) ON DELETE CASCADE`, `equipment_code TEXT NOT NULL`, +SYNC, `CHECK (id = place_id || ':' || equipment_code)` |

Index à créer :
- `<t>_rev_idx ON <t>(rev)` pour `user`, `gym`, `gym_equipment` et les 7 tables à `owner_id` ;
- `<t>_owner_rev_idx ON <t>(owner_id, rev)` pour `sync_rejection`, `consent_event`, `training_profile`, `health_screening`, `limitation`, `place` et `home_equipment` ;
- `applied_op_user_applied_idx (user_id, applied_at)` ;
- `consent_event_owner_type_created_idx (owner_id, type, created_at)` ;
- `security_event_at_idx (at)` ;
- `password_reset_user_idx (user_id)` et `session_user_idx (user_id)` ;
- `gym_equipment_gym_idx (gym_id)`, `gym_history_gym_at_idx (gym_id, at)`, `place_gym_idx (gym_id)` et `home_equipment_place_idx (place_id)` ;
- uniques partiels :
  - `CREATE UNIQUE INDEX place_owner_gym_uq ON place(owner_id, gym_id) WHERE deleted_at IS NULL` ;
  - `CREATE UNIQUE INDEX place_owner_primary_uq ON place(owner_id) WHERE is_primary = 1 AND deleted_at IS NULL`.

**`schema.ts`**
- Une interface `XxxTable` par table, avec chaque colonne en camelCase.
- `TEXT` donne `string` et `INTEGER` donne `number`. Une colonne nullable ajoute `| null`. Une colonne avec `DEFAULT` est typée `Generated<T>`.
- Les booléens restent `number` (0 ou 1) et le JSON reste `string`.
- `tableKey` convertit le snake_case en camelCase (`/_([a-z0-9])/g`). Cette conversion sera déléguée à `snakeToCamel` en Task 5.

**`server-meta.ts`**
- `initServerMeta` insère la ligne `id = 1` avec `server_epoch = ids.uuidv7()` et les compteurs à 0, puis renvoie `getServerMeta`.
- `getServerMeta` lève `new Error('server_meta absent')` si la ligne manque.

**`rev.ts`**
- `nextRev` exécute `UPDATE server_meta SET sync_counter = sync_counter + 1 WHERE id = 1 RETURNING sync_counter`.
- `writeStamp` renvoie `{ rev: await nextRev(trx), updatedAt: deps.clock.now().toISOString(), updatedBy: actorId }`.

**Support de test**
- `FakeClock` démarre par défaut à `'2026-10-06T10:00:00.000Z'` et `now()` renvoie une copie.
- `seqIds(seed = 1)` :
  - l'horloge démarre à `Date.parse('2026-10-06T10:00:00.000Z')` et avance d'1 ms par appel ;
  - l'aléa vient de mulberry32(`seed`) et sert aussi à `randomBytes` ;
  - les identifiants sont produits par `createMonotonicUuidV7`.
- `test/support/index.ts` fait `export * from './clock'` et `export * from './ids'`.

- [ ] **Step 4: Run test to verify it passes**

1. `pnpm --filter @appsport/server test -- db/ support` : le premier passage écrit `test/__snapshots__/schema.sql`.
2. Relire ce fichier : 18 tables et index conformes au tableau.
3. Relancer la commande : tout doit être vert.
4. `pnpm typecheck` doit passer.

- [ ] **Step 5: Commit**

```
git add apps/server ; git commit -m "feat(db): migrations transactionnelles, schéma STRICT des 18 tables du socle et compteur de révisions"
```

---

### Task 5: Registre `entityRules` et fabriques de test

**Files:**
- Create: `packages/contracts/src/case.ts`, `packages/contracts/src/entity-rules.ts`
- Modify:
  - `packages/contracts/src/index.ts`, qui réexporte `./case` et `./entity-rules` ;
  - `apps/server/src/db/schema.ts`, où `tableKey` délègue désormais à `snakeToCamel` ;
  - `apps/server/test/support/index.ts`, qui ajoute `export * from './factories'`.
- Create: `apps/server/test/support/factories.ts`
- Test: `packages/contracts/test/case.test.ts`, `packages/contracts/test/entity-rules.test.ts`, `apps/server/test/db/entity-rules.test.ts`

**Interfaces:**
- Consumes :
  - Task 4 : `openDatabase`, `migrate`, `MIGRATIONS`, `Database`, `tableKey`, `seqIds` ;
  - Task 2 : `createUuidV7`.
- Produces :
```ts
// packages/contracts/src/case.ts
export function snakeToCamel(key: string): string; export function camelToSnake(key: string): string;
export function rowToCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T;
// packages/contracts/src/entity-rules.ts
export type DataCategory = 'C0' | 'C1' | 'C2' | 'C3';
export type SyncClass = 'J' | 'D' | 'E' | 'C' | 'H';
export type OnUserDelete = 'cascade' | 'set_null' | 'anonymize' | 'keep' | 'not_linked';
export interface EntityRule { category: DataCategory; syncClass: SyncClass; ownerColumn: 'owner_id' | 'user_id' | 'id' | null;
  columns: readonly string[]; clientWritable: readonly string[]; c2Columns: readonly string[]; secretColumns: readonly string[];
  exported: boolean; onUserDelete: OnUserDelete }
export type EntityRulesMap = Readonly<Record<string, EntityRule>>;
export const SYNC_COLUMNS: readonly ['owner_id','rev','created_at','updated_at','updated_by','deleted_at'];
export const entityRules: EntityRulesMap;
export function mirroredTables(rules?: EntityRulesMap): string[];
// apps/server/test/support/factories.ts
export async function insertFixtureRow(db: Kysely<Database>, table: string, values?: Record<string, unknown>): Promise<Record<string, unknown>>;
```

**Spec:** R-SYN-4, R-REG-1, P-CAT-1, P-CAT-2, 03 §17 n°2, 09 §0.4 et §0.5 (catégories, secrets, registre unique).

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/case.test.ts` :
```ts
expect(snakeToCamel('training_profile')).toBe('trainingProfile');
expect(snakeToCamel('id')).toBe('id');
expect(camelToSnake('usernameKey')).toBe('username_key');
expect(rowToCamel({ owner_id: 'u', deleted_at: null })).toEqual({ ownerId: 'u', deletedAt: null });
for (const [t, r] of Object.entries(entityRules)) for (const c of [t, ...r.columns]) expect(camelToSnake(snakeToCamel(c))).toBe(c);
```

`packages/contracts/test/entity-rules.test.ts` :
```ts
it('valeurs fixées', () => {
  expect(Object.keys(entityRules).sort()).toEqual(['applied_op','consent_event','gym','gym_equipment','gym_history','health_screening','home_equipment',
    'invitation','limitation','password_reset','place','schema_migrations','security_event','server_meta','session','sync_rejection','training_profile','user']);
  const pick = (t: string) => { const r = entityRules[t]!; return [r.category, r.syncClass, r.ownerColumn, r.exported, r.onUserDelete].join('/'); };
  expect(pick('server_meta')).toBe('C0/H//false/not_linked');
  expect(pick('applied_op')).toBe('C0/H/user_id/false/cascade');
  expect(pick('sync_rejection')).toBe('C1/J/owner_id/true/cascade');
  expect(pick('user')).toBe('C0/E/id/true/cascade');
  expect(pick('invitation')).toBe('C0/H//false/set_null');
  expect(pick('password_reset')).toBe('C0/H/user_id/false/cascade');
  expect(pick('session')).toBe('C1/H/user_id/false/anonymize');
  expect(pick('security_event')).toBe('C0/H//false/keep');
  expect(pick('health_screening')).toBe('C2/E/owner_id/true/cascade');
  expect(pick('gym')).toBe('C0/E//false/set_null');
  expect(pick('gym_history')).toBe('C0/H//false/set_null');
  // et de même pour les 7 autres tables, selon le tableau du Step 3
  expect(entityRules.sync_rejection!.clientWritable).toEqual(['dismissed_at']);
  expect(entityRules.user!.secretColumns).toEqual(['password_hash']);
  expect(entityRules.session!.secretColumns).toEqual(['token_hash']);
});
it('mirroredTables : les 10 tables J/D/E, triées', () => {
  expect(mirroredTables()).toEqual(['consent_event','gym','gym_equipment','health_screening','home_equipment','limitation','place','sync_rejection','training_profile','user']);
});
it('invariants', () => {
  for (const [t, r] of Object.entries(entityRules)) {
    if (r.syncClass !== 'J') expect(r.clientWritable, t).toEqual([]);
    for (const c of [...r.clientWritable, ...r.c2Columns, ...r.secretColumns]) expect(r.columns, t).toContain(c);
    if (r.ownerColumn) expect(r.columns, t).toContain(r.ownerColumn);
    if (r.ownerColumn === 'owner_id') for (const c of SYNC_COLUMNS) if (!(t === 'consent_event' && c === 'deleted_at')) expect(r.columns, t).toContain(c);
    if (['J','D','E'].includes(r.syncClass)) expect(r.columns, t).toContain('rev');
  }
});
```

`apps/server/test/db/entity-rules.test.ts` s'exécute sur une base `:memory:` migrée avec `MIGRATIONS`. C'est le test de couverture P-CAT-2 et R-REG-1 :
```ts
const schema = (): Map<string, string[]> => /* sqlite_schema type='table' hors sqlite_% → noms des colonnes via pragma_table_info(name), ordre cid */;
it('chaque table et chaque colonne de sqlite_schema est déclarée, et inversement', () => {
  const s = schema();
  expect([...s.keys()].sort()).toEqual(Object.keys(entityRules).sort());
  for (const [t, cols] of s) expect([...entityRules[t]!.columns].sort(), t).toEqual([...cols].sort());
});
it('toute table C1–C3 liée à un utilisateur est couverte par l\'export et la suppression', () => {
  for (const [t, r] of Object.entries(entityRules)) if (['C1','C2','C3'].includes(r.category) && r.ownerColumn) {
    expect(['cascade','anonymize'], t).toContain(r.onUserDelete);
    expect(r.exported || r.onUserDelete === 'anonymize', t).toBe(true); // [décision plan] session : anonymisée, non exportée
  }
});
it('secretColumns = toutes les colonnes *_hash', () => {
  const hashes = [...schema()].flatMap(([t, cols]) => cols.filter((c) => c.endsWith('_hash')).map((c) => `${t}.${c}`)).sort();
  const declared = Object.entries(entityRules).flatMap(([t, r]) => r.secretColumns.map((c) => `${t}.${c}`)).sort();
  expect(declared).toEqual(hashes);
  expect(declared).toEqual(['invitation.code_hash','password_reset.code_hash','session.token_hash','user.password_hash']);
});
it.each(Object.keys(entityRules))('insertFixtureRow(%s) insère une ligne valide', async (table) => {
  const { db, sqlite } = openDatabase(':memory:'); await migrate(db, MIGRATIONS, new FakeClock());
  const row = await insertFixtureRow(db, table);
  expect(Object.keys(row).sort()).toEqual(entityRules[table]!.columns.map(snakeToCamel).sort()); // cohérence avec CamelCasePlugin
  expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect((sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n).toBeGreaterThanOrEqual(1);
});
it('insertFixtureRow applique les valeurs fournies (camelCase)', async () => {
  const user = await insertFixtureRow(db, 'user', { username: 'Léa' });
  const place = await insertFixtureRow(db, 'place', { ownerId: user.id, kind: 'home', name: 'Maison' });
  expect(place).toMatchObject({ ownerId: user.id, kind: 'home', name: 'Maison' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Commandes :
- `pnpm --filter @appsport/contracts test`
- `pnpm --filter @appsport/server test -- entity-rules`

Échec attendu : « Failed to resolve import "../src/case" » et « "entityRules" is not exported ».

- [ ] **Step 3: Implement**

`entity-rules.ts` contient les valeurs suivantes. Le registre ne contient aucune colonne C2 dans une table C1 au socle : `c2Columns` vaut `[]` partout. Les tables C2 sont entièrement C2.

| table | category / syncClass / ownerColumn / exported / onUserDelete | secretColumns | clientWritable |
|---|---|---|---|
| server_meta | C0 / H / null / false / not_linked | [] | [] |
| schema_migrations | C0 / H / null / false / not_linked | [] | [] |
| applied_op | C0 / H / user_id / false / cascade | [] | [] |
| sync_rejection | C1 / J / owner_id / true / cascade | [] | ['dismissed_at'] |
| user | C0 / E / id / true / cascade | ['password_hash'] | [] |
| invitation | C0 / H / null / false / set_null | ['code_hash'] | [] |
| password_reset | C0 / H / user_id / false / cascade | ['code_hash'] | [] |
| session | C1 / H / user_id / false / anonymize | ['token_hash'] | [] |
| consent_event | C1 / E / owner_id / true / cascade | [] | [] |
| security_event | C0 / H / null / false / keep | [] | [] |
| training_profile | C1 / E / owner_id / true / cascade | [] | [] |
| health_screening | C2 / E / owner_id / true / cascade | [] | [] |
| limitation | C2 / E / owner_id / true / cascade | [] | [] |
| gym | C0 / E / null / false / set_null | [] | [] |
| gym_equipment | C0 / E / null / false / set_null | [] | [] |
| gym_history | C0 / H / null / false / set_null | [] | [] |
| place | C1 / E / owner_id / true / cascade | [] | [] |
| home_equipment | C1 / E / owner_id / true / cascade | [] | [] |

**Colonnes et fonctions du registre**
- `columns` liste exactement les colonnes de la table créée par `apps/server/src/db/migrations/0001_socle.ts`, plus `schema_migrations` (`id`, `breaking`, `applied_at`, créée par `migrate.ts`), dans l'ordre du DDL.
- `SYNC_COLUMNS = ['owner_id','rev','created_at','updated_at','updated_by','deleted_at'] as const`.
- `mirroredTables(rules = entityRules)` filtre `syncClass ∈ {J, D, E}` et trie le résultat.

**`case.ts`**
- `snakeToCamel` remplace `_x` par `X` ; `camelToSnake` remplace `X` par `_x`.
- `rowToCamel` convertit les clés au premier niveau seulement.

**`insertFixtureRow(db, table, values = {})`**
- Le module contient un `switch` sur le nom SQL et une fabrique par table. Chaque fabrique produit des valeurs par défaut valides, auxquelles s'ajoutent les `values` (clés camelCase).
- Les parents manquants sont créés par appel récursif :
  - `ownerId` crée un `user` ;
  - `gymId` crée un `gym` ;
  - `placeId` crée un `place` de type `home`.
- Les identifiants viennent d'un `seqIds(999)` propre au module. Les règles de clé déterministe sont respectées : `training_profile.id = ownerId`, `health_screening.id = ownerId`, `gym_equipment.id = gymId + ':dumbbells'` et `home_equipment.id = placeId + ':chair'`.
- Autres valeurs par défaut :
  - `rev: 1` et horodatages `'2026-10-06T10:00:00.000Z'` ;
  - `server_meta` : `id: 1` ;
  - `schema_migrations` : `id: 'fixture_<n>'` ;
  - `user` : `username` et `usernameKey` = `user<n>`, `passwordHash: '$argon2id$fixture'`, `role: 'member'`, `birthDate: '1990-01-01'` ;
  - `gym` : `name: 'Salle <n>'`, `city: 'Lyon'`, les clés en minuscules, `loadSettings: '{}'` ;
  - `place` : `kind: 'home'`, `name: 'Maison'`, `loadSettings: '{}'`.
- L'insertion se fait avec `db.insertInto(tableKey(table) as any).values(...)`. La fabrique renvoie ensuite la ligne relue par `selectAll()` sur la clé primaire (`op_id` pour `applied_op`, `id` ailleurs).

- [ ] **Step 4: Run test to verify it passes**

Commandes et résultats attendus :
- `pnpm --filter @appsport/contracts test` est vert.
- `pnpm --filter @appsport/server test -- entity-rules` est vert (18 cas `insertFixtureRow`).
- `pnpm test` passe en entier.

- [ ] **Step 5: Commit**

```
git add packages/contracts apps/server ; git commit -m "feat(db): registre entityRules des 18 tables, conversion de casse et fabriques de lignes de test"
```

---

### Task 6: Serveur Hono, sécurité HTTP et `/api/health`

**Files:**
- Create (contracts) : `packages/contracts/src/api/errors.ts`, `packages/contracts/src/api/health.ts`
- Modify (contracts) :
  - `packages/contracts/src/index.ts`, qui réexporte `./api/errors` et `./api/health` ;
  - `packages/contracts/package.json`, avec la dépendance `zod@^4`.
- Create (serveur) :
  - `apps/server/src/config.ts`, `apps/server/src/app-env.ts`, `apps/server/src/app.ts`, `apps/server/src/routes.ts`, `apps/server/src/logger.ts` ;
  - `apps/server/src/http/errors.ts`, `apps/server/src/http/validate.ts`, `apps/server/src/http/security-headers.ts`, `apps/server/src/http/origin-guard.ts`, `apps/server/src/http/request-log.ts`, `apps/server/src/http/client-ip.ts`, `apps/server/src/http/epoch-header.ts` ;
  - `apps/server/src/health/routes.ts`.
- Modify (serveur) :
  - `apps/server/src/deps.ts`, qui ajoute `Argon2Params`, `AppDeps` et `createAppDeps` ;
  - `apps/server/package.json`, avec les dépendances `hono@~4.13`, `@hono/node-server@~2.1` et `zod@^4`.
- Create (support) : `apps/server/test/support/context.ts`
- Modify (support) : `apps/server/test/support/index.ts`, qui ajoute `export * from './context'`.
- Test :
  - `packages/contracts/test/errors.test.ts` ;
  - `apps/server/test/config.test.ts`, `apps/server/test/logger.test.ts` ;
  - `apps/server/test/http/security-headers.test.ts`, `apps/server/test/http/origin-guard.test.ts`, `apps/server/test/http/request-log.test.ts`, `apps/server/test/http/errors.test.ts`, `apps/server/test/http/client-ip.test.ts` ;
  - `apps/server/test/health/health.test.ts`.

**Interfaces:**
- Consumes :
  - Task 4 : `Clock`, `IdGen`, `systemClock`, `cryptoIds`, `getServerMeta`, `migrate`, `MIGRATIONS`, `initServerMeta`, `FakeClock`, `seqIds`, `Migration` ;
  - Task 3 : `openDatabase` ;
  - Task 5 : `entityRules`, `EntityRulesMap` ;
  - Task 2 : `SYNC_PROTOCOL`, `MIN_PROTOCOL`, `Role`.
- Produces :
```ts
// packages/contracts/src/api/errors.ts
export const ApiErrorCode = z.enum([...33 codes de l'ossature...]); export type ApiErrorCode = z.infer<typeof ApiErrorCode>;
export const ERROR_STATUS: Record<ApiErrorCode, number>;
export const ApiErrorBody = z.object({ error: ApiErrorCode }).passthrough(); export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
// packages/contracts/src/api/health.ts
export const HealthResponse = z.object({ status: z.enum(['ok','error']), version: z.string(), db: z.enum(['ok','error']),
  protocol: z.number().int(), minProtocol: z.number().int(), epoch: z.string().nullable(), swKill: z.boolean() }); export type HealthResponse = …;
// apps/server/src/deps.ts (ajouts)
export interface Argon2Params { memoryKiB: number; passes: number; parallelism: number; tagLength: number; saltLength: number }
export interface AppDeps { db: Kysely<Database>; sqlite: DatabaseSync; clock: Clock; ids: IdGen; config: AppConfig; logger: Logger; entityRules: EntityRulesMap }
export function createAppDeps(o: { sqlite: DatabaseSync; db: Kysely<Database>; config: AppConfig; clock?: Clock; ids?: IdGen; logger?: Logger; entityRules?: EntityRulesMap }): AppDeps;
// apps/server/src/config.ts
export interface AppConfig { appOrigin: string; version: string; port: number; host: string; dataDir: string; dbPath: string;
  sentinelPath: string; publicDir: string; contentDir: string; swKillSwitch: boolean; coachModel: string;
  anthropicApiKey: string | null; argon2: Argon2Params; sessionCookieName: '__Host-session' | 'dev-session'; secureCookie: boolean }
export const DEFAULT_ARGON2_PARAMS: Argon2Params; // { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 }
export class ConfigError extends Error {}
export function loadConfig(env: Record<string, string | undefined>): AppConfig;
// apps/server/src/app-env.ts
export interface SessionUser { id: string; username: string; role: Role; birthDate: string; mustChangePassword: boolean }
export type AppEnv = { Variables: { requestId: string; clientIp: string | null; user: SessionUser | null; sessionId: string | null } };
// apps/server/src/app.ts / routes.ts
export function createApp(deps: AppDeps): Hono<AppEnv>;
export function mountRoutes(app: Hono<AppEnv>, deps: AppDeps): void;
// apps/server/src/http/*
export class HttpError extends Error { readonly status: number; readonly code: ApiErrorCode; readonly extra?: Record<string, unknown>; constructor(status: number, code: ApiErrorCode, extra?: Record<string, unknown>) }
export function httpError(code: ApiErrorCode, extra?: Record<string, unknown>): HttpError;
export function errorHandler(logger: Logger): ErrorHandler<AppEnv>;
export async function parseJson<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T>;
export function parseQuery<T>(c: Context<AppEnv>, schema: z.ZodType<T>): T;
export function clientIp(c: Context<AppEnv>): string | null;
export const SECURITY_HEADERS: Readonly<Record<string, string>>;
export function securityHeaders(): MiddlewareHandler<AppEnv>;
export function originGuard(config: AppConfig): MiddlewareHandler<AppEnv>;
export function requestLog(logger: Logger): MiddlewareHandler<AppEnv>;
export function epochHeader(db: Kysely<Database>): MiddlewareHandler<AppEnv>;
export function healthRoutes(deps: AppDeps): Hono<AppEnv>;
// apps/server/src/logger.ts
export type LogFields = Partial<{ requestId: string; method: string; route: string; status: number; durationMs: number; event: string; code: string; count: number; migration: string; job: string }>;
export interface Logger { info(msg: string, f?: LogFields): void; warn(msg: string, f?: LogFields): void; error(msg: string, f?: LogFields): void }
export function createLogger(write?: (line: string) => void): Logger;
// apps/server/test/support/context.ts
export const TEST_ARGON2: Argon2Params; // { memoryKiB: 1024, passes: 1, parallelism: 1, tagLength: 32, saltLength: 16 }
export interface TestRequestInit { method?: string; json?: unknown; cookie?: string; origin?: string | null; ip?: string; headers?: Record<string, string> }
export interface TestContext { app: Hono<AppEnv>; deps: AppDeps; clock: FakeClock; request(path: string, init?: TestRequestInit): Promise<Response>; close(): void }
export async function createTestContext(opts?: { now?: string; config?: Partial<AppConfig>; extraMigrations?: Migration[]; entityRules?: EntityRulesMap; deps?: Partial<AppDeps> }): Promise<TestContext>;
```

**Spec:**
- 01 §3 et 08 §4 (contrat de l'image : point 2 configuration par l'environnement, point 3 `/api/health`, point 6 journaux) ;
- R-VER-3 et R-SYN-25 (en-tête `X-Appsport-Epoch`) ;
- P-AUT-4 (CSRF), P-AUT-7 (`Tailscale-User-*` ignorés), P-AUT-9 (en-têtes HTTP) ;
- P-LOG-2 (journaux techniques), P-LOG-4 (aucune ressource tierce : CSP `'self'`) ;
- Global Constraints « Format d'erreur API » et « Cookie de session ».

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/errors.test.ts`
- Chaque code de `ApiErrorCode.options` a un statut.
- Le test vérifie les groupes exacts :
  - 400 : `validation`, `password_rejected`, `username_invalid`, `under_min_age`, `invitation_expired`, `invitation_used`, `invitation_revoked`, `invitation_unknown`, `reset_invalid` ;
  - 401 : `unauthenticated`, `invalid_credentials` ;
  - 403 : `forbidden`, `origin_mismatch`, `account_disabled`, `password_change_required`, `health_consent_required`, `reset_self_forbidden` ;
  - 404 : `not_found` ;
  - 409 : `conflict`, `username_taken`, `last_admin`, `gym_duplicate`, `gym_in_use`, `place_exists`, `last_place`, `primary_required`, `onboarding_incomplete` ;
  - 410 : `account_deleted`, `watermark_expired` ;
  - 415 : `unsupported_media_type` ; 426 : `protocol_unsupported` ; 429 : `rate_limited` ; 500 : `internal`.
- `ApiErrorBody.parse({ error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 })` conserve les champs supplémentaires.

`apps/server/test/config.test.ts`
```ts
expect(() => loadConfig({})).toThrow(ConfigError);
expect(() => loadConfig({ APP_ORIGIN: 'https://appsport.x.ts.net/chemin' })).toThrow(ConfigError);
expect(() => loadConfig({ APP_ORIGIN: 'http://appsport.x.ts.net' })).toThrow(ConfigError); // http seulement pour localhost
const c = loadConfig({ APP_ORIGIN: 'https://appsport.x.ts.net' });
expect(c).toMatchObject({ appOrigin: 'https://appsport.x.ts.net', version: 'dev', port: 3000, host: '0.0.0.0', dataDir: '/data',
  publicDir: '/app/public', contentDir: '/app/data', swKillSwitch: false, coachModel: 'claude-opus-5-5', anthropicApiKey: null,
  argon2: { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 }, sessionCookieName: '__Host-session', secureCookie: true });
expect(c.dbPath).toBe(join('/data', 'appsport.db')); expect(c.sentinelPath).toBe(join('/data', '.appsport-volume'));
expect(loadConfig({ APP_ORIGIN: 'http://localhost:5173' })).toMatchObject({ sessionCookieName: 'dev-session', secureCookie: false });
expect(loadConfig({ APP_ORIGIN: 'https://a.ts.net', SW_KILL_SWITCH: '1', PORT: '8080', APP_VERSION: 'v1.2.3', ANTHROPIC_API_KEY: '' }))
  .toMatchObject({ swKillSwitch: true, port: 8080, version: 'v1.2.3', anthropicApiKey: null });
```

`apps/server/test/logger.test.ts`
- `createLogger((l) => lines.push(l))`, puis `info('x', { requestId: 'r1', secret: 'TEMOIN' } as any)`.
- La ligne est un JSON qui contient `level: 'info'`, `msg: 'x'`, `requestId: 'r1'` et `time` (ISO).
- `secret` est absent et la chaîne brute ne contient pas `TEMOIN`.

`apps/server/test/http/security-headers.test.ts` vérifie, sur `GET /api/health`, `GET /api/inexistant` (404) et une route de test qui lève (500), les valeurs exactes suivantes :
```ts
expect(Object.fromEntries(['strict-transport-security','content-security-policy','referrer-policy','x-content-type-options','permissions-policy'].map((h) => [h, res.headers.get(h)]))).toEqual({
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' });
```
Le même fichier vérifie :
- `X-Appsport-Epoch` est égal à `(await getServerMeta(db)).serverEpoch` sur `/api/health` et sur un 404 `/api/…` ;
- il est absent de `GET /privacy`.

`apps/server/test/http/origin-guard.test.ts` s'appuie sur des routes ajoutées au contexte : `ctx.app.post('/api/test/echo', (c) => c.json({ ok: true }))` et `ctx.app.delete('/api/test/echo', (c) => c.body(null, 204))`.

| Requête | Réponse attendue |
|---|---|
| POST avec `Origin: https://evil.example` | `403 {"error":"origin_mismatch"}` |
| POST sans `Origin` (`origin: null`) | 403 `origin_mismatch` |
| POST avec la bonne origine et `Content-Type: text/plain` | `415 {"error":"unsupported_media_type"}` |
| POST avec `application/json; charset=utf-8` | 200 |
| DELETE avec la bonne origine, sans corps | 204 |
| GET avec une origine étrangère | 200 (pas de contrôle sur GET) |
| En-tête `Tailscale-User-Login: admin@exemple` | `ctx.app.get('/api/test/whoami', (c) => c.json({ user: c.var.user }))` renvoie `{ user: null }` (P-AUT-7) |

Un dernier test parcourt `apps/server/src/**/*.ts` et vérifie qu'aucun fichier ne contient `/tailscale-user/i`.

`apps/server/test/http/request-log.test.ts`
- Le contexte est créé avec `deps: { logger: createLogger((l) => lines.push(l)) }` et une route `ctx.app.post('/api/test/items/:id', …)`.
- Requête : `/api/test/items/123?q=TEMOIN_QS`, cookie `dev-session=TEMOIN_COOKIE` et corps `{ pain: 'TEMOIN_C2' }`.
- La ligne de requête contient `{ msg: 'request', method: 'POST', route: '/api/test/items/:id', status: 200 }`, avec `durationMs` numérique et `requestId` non vide.
- `lines.join('\n')` ne contient ni `TEMOIN_QS`, ni `TEMOIN_COOKIE`, ni `TEMOIN_C2`, ni `123`.

`apps/server/test/http/errors.test.ts`
- Une route qui lève `httpError('gym_duplicate', { gymId: 'g1' })` donne `409 {"error":"gym_duplicate","gymId":"g1"}`.
- Une route qui lève `new Error('boom TEMOIN')` donne `500 {"error":"internal"}`. Le corps ne contient ni `boom` ni `at `, et le journal ne contient pas `TEMOIN`.
- `parseJson` avec un JSON invalide donne `400 {"error":"validation"}`.
- `parseJson` avec un schéma `z.object({ n: z.number() })` et `{ n: 'x' }` donne 400. `issues[0]` vaut `{ path: 'n', message: expect.any(String) }`.

`apps/server/test/http/client-ip.test.ts`
- Avec `ip: '100.64.0.7'` (le support écrit `X-Forwarded-For: 100.64.0.7`), `c.var.clientIp` vaut `'100.64.0.7'`.
- Avec `X-Forwarded-For: 100.64.0.7, 10.0.0.1`, il vaut `'100.64.0.7'`.
- Sans l'en-tête, il vaut `null`.
- Avec un pair TCP non loopback simulé (`c.env.incoming.socket.remoteAddress = '100.64.0.9'`, via `app.request(url, init, { incoming: { socket: { remoteAddress: '100.64.0.9' } } })`), l'en-tête est ignoré et la valeur est `'100.64.0.9'`.

`apps/server/test/health/health.test.ts`
```ts
const ctx = await createTestContext();
const res = await ctx.request('/api/health');
expect(res.status).toBe(200);
const body = HealthResponse.parse(await res.json());
expect(body).toEqual({ status: 'ok', version: 'dev', db: 'ok', protocol: 1, minProtocol: 1, epoch: (await getServerMeta(ctx.deps.db)).serverEpoch, swKill: false });
expect(Object.keys(body).sort()).toEqual(['db','epoch','minProtocol','protocol','status','swKill','version']); // aucune donnée personnelle
const k = await createTestContext({ config: { swKillSwitch: true, version: 'v1.0.0' } });
expect(await (await k.request('/api/health')).json()).toMatchObject({ swKill: true, version: 'v1.0.0' });
ctx.deps.sqlite.close();
const down = await ctx.request('/api/health');
expect(down.status).toBe(503);
expect(await down.json()).toMatchObject({ status: 'error', db: 'error', epoch: null });
```

- [ ] **Step 2: Run test to verify it fails**

Commandes :
- `pnpm --filter @appsport/server test -- http/ health config logger`
- `pnpm --filter @appsport/contracts test -- errors`

Échec attendu : « Failed to resolve import "../../src/app" », « "./context" » et « "../src/api/errors" ».

- [ ] **Step 3: Implement**

**`loadConfig`**
- Validation par un schéma Zod. En cas d'échec, lève `ConfigError` avec un message en français qui nomme les variables en cause, sans leurs valeurs.
- `APP_ORIGIN` est obligatoire et vérifie `new URL(v).origin === v`.
  - Une origine `https:` donne `__Host-session` et `secureCookie: true`.
  - Une origine `http:` n'est acceptée que pour l'hôte `localhost` ou `127.0.0.1` ; elle donne `dev-session` et `secureCookie: false`.
- `dbPath` et `sentinelPath` sont construits par `join` de `node:path` à partir de `dataDir`.
- Valeurs par défaut :
  - `APPSPORT_PUBLIC_DIR` = `/app/public` et `APPSPORT_CONTENT_DIR` = `/app/data` **[décision plan : l'image place `server.mjs`, `public/` et `data/` sous `/app`]** ;
  - `SW_KILL_SWITCH === '1'` donne `swKillSwitch: true` ;
  - une chaîne vide pour `ANTHROPIC_API_KEY` donne `null` ;
  - `argon2` vaut `DEFAULT_ARGON2_PARAMS`.

**`createApp(deps)`**
1. Middleware « contexte » : `c.set('requestId', deps.ids.uuidv7())`, `c.set('clientIp', clientIp(c))`, `user = null`, `sessionId = null`.
2. `requestLog(deps.logger)`.
3. `securityHeaders()`, qui pose `SECURITY_HEADERS` après `await next()` pour couvrir aussi les réponses `onError` et 404.
4. `app.use('/api/*', epochHeader(deps.db))`. Ce middleware lit `getServerMeta` à chaque requête, sans cache, pour suivre un changement d'époque dans le même processus. En cas d'erreur, il omet l'en-tête.
5. `originGuard(deps.config)`.
6. **Point d'insertion de la session**, que la Task 9 ajoutera : `app.use('*', sessionMiddleware(deps))`.
7. `mountRoutes(app, deps)`.
8. `app.notFound((c) => c.json({ error: 'not_found' }, 404))`.
9. `app.onError(errorHandler(deps.logger))`.

**`mountRoutes`**
- Contient seulement `app.route('/api/health', healthRoutes(deps));`.
- Chaque partie suivante y ajoute une ligne, et le montage statique de la PWA vient en dernier.

**`requestLog`**
- Après `await next()`, appelle `logger.info('request', { requestId, method, route: routePath(c, -1), status: c.res.status, durationMs })`.
- `routePath` vient de `hono/route`, et `durationMs` est mesuré par `performance.now()`, arrondi à l'entier.
- Le middleware n'écrit jamais l'URL, les en-têtes ni le corps.

**`errorHandler`**
- Une `HttpError` donne `c.json({ error: code, ...extra }, status)`.
- Toute autre erreur donne `logger.error('unhandled_error', { requestId, code: 'internal', event: err.name })` et `c.json({ error: 'internal' }, 500)`. Le message et la pile ne sont jamais écrits.

**`parseJson`**
- Un JSON invalide lève `httpError('validation')`.
- Un échec de schéma lève `httpError('validation', { issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })`.
- `parseQuery` valide `c.req.query()`.

**`clientIp`**
- Le pair TCP est lu dans `c.env?.incoming?.socket?.remoteAddress`.
- S'il est absent ou loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`), la fonction renvoie la première entrée de `X-Forwarded-For` (sans espaces), ou `null`. Sinon, elle renvoie le pair TCP.

**`healthRoutes`**
- `GET /` exécute `SELECT 1` puis `getServerMeta`.
- Si les deux réussissent : réponse 200 avec `{ status: 'ok', version, db: 'ok', protocol: SYNC_PROTOCOL, minProtocol: MIN_PROTOCOL, epoch, swKill }`.
- Toute exception donne une réponse 503 avec `{ status: 'error', db: 'error', epoch: null, … }`.
- Aucune session n'est requise.

**`createTestContext`**
1. `openDatabase(':memory:')`.
2. `migrate(db, [...MIGRATIONS, ...extraMigrations], clock)`.
3. `initServerMeta(db, ids)`, avec `clock = new FakeClock(opts.now)` et `ids = seqIds()`.
4. `config = { ...loadConfig({ APP_ORIGIN: 'https://appsport.test.ts.net' }), argon2: TEST_ARGON2, ...opts.config }`.
5. `deps = { ...createAppDeps({ sqlite, db, config, clock, ids, logger: createLogger(() => {}), entityRules: opts.entityRules }), ...opts.deps }`.
6. `app = createApp(deps)`.

La méthode `request(path, init)` :
- pour POST, PUT, PATCH et DELETE, pose par défaut `Origin = config.appOrigin` ; `origin: null` le retire ;
- `json` sérialise le corps et pose `Content-Type: application/json` ;
- `cookie` remplit l'en-tête `Cookie` ;
- `ip` remplit `X-Forwarded-For`.

`close()` ferme `sqlite` si la base est encore ouverte.

**`createAppDeps`** applique ces valeurs par défaut : `clock = systemClock`, `ids = cryptoIds()`, `logger = createLogger()` (sur stdout) et `entityRules` du registre.

- [ ] **Step 4: Run test to verify it passes**

Commandes et résultats attendus :
- `pnpm --filter @appsport/server test -- http/ health config logger` est vert.
- `pnpm --filter @appsport/contracts test` est vert.
- `pnpm test`, `pnpm typecheck` et `pnpm lint` passent.

- [ ] **Step 5: Commit**

```
git add packages/contracts apps/server pnpm-lock.yaml ; git commit -m "feat(socle): serveur Hono, en-têtes de sécurité, CSRF, journaux sans données et /api/health"
```

---

### Task 7: Démarrage, CLI de base et tâches planifiées

**Files:**
- Create: `apps/server/src/main.ts`, `apps/server/src/cli.ts`, `apps/server/src/startup-guard.ts`, `apps/server/src/startup.ts`, `apps/server/src/jobs/scheduler.ts`, `apps/server/src/jobs/registry.ts`
- Modify: `apps/server/package.json` (devDependency `tsx`)
- Test: `apps/server/test/cli/init.test.ts`, `apps/server/test/startup.test.ts`, `apps/server/test/jobs/scheduler.test.ts`

**Interfaces:**
- Consumes :
  - Task 6 : `loadConfig`, `AppConfig`, `createApp`, `createAppDeps`, `AppDeps`, `createLogger`, `HealthResponse` ;
  - Task 4 : `migrate`, `MIGRATIONS`, `MigrationError`, `initServerMeta`, `getServerMeta`, `systemClock`, `cryptoIds` ;
  - Task 3 : `openDatabase` ;
  - Task 2 : `isUuidV7`.
- Produces :
```ts
// apps/server/src/startup-guard.ts
export class StartupError extends Error { readonly code: 'no_sentinel' | 'no_database' }
export function assertStartupPreconditions(cfg: AppConfig, fs?: { existsSync(p: string): boolean }): void;
// apps/server/src/startup.ts
export interface StartupTask { name: string; run(deps: AppDeps): Promise<void> }
export const STARTUP_TASKS: StartupTask[];        // [] ; synchro T23 ajoute CATALOG_STARTUP_TASK
// apps/server/src/jobs/scheduler.ts / registry.ts
export interface DailyJob { name: string; run(deps: AppDeps): Promise<void> }
export function startDailyJobs(deps: AppDeps, jobs: DailyJob[]): { stop(): void };
export const DAILY_JOBS: DailyJob[];               // [] ; comptes T13 et synchro T22 ajoutent leurs jobs
// apps/server/src/main.ts
export interface RunningServer { port: number; deps: AppDeps; close(): Promise<void> }
export async function startServer(env: Record<string, string | undefined>, opts?: { startupTasks?: StartupTask[]; dailyJobs?: DailyJob[] }): Promise<RunningServer>;
export async function main(argv: string[]): Promise<number>;
// apps/server/src/cli.ts
export interface CliContext { env: Record<string, string | undefined>; out(line: string): void; err(line: string): void }
export interface CliCommand { usage: string; run(args: string[], ctx: CliContext): Promise<number> }
export const COMMANDS: Record<string, CliCommand>; // 'init', 'db:check' ; T11, T12, T24, T40 y ajoutent leurs entrées
export function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> };
export async function withAppDeps<T>(ctx: CliContext, fn: (deps: AppDeps) => Promise<T>): Promise<T>; // garde + migrate, puis ferme la base
export async function runCli(argv: string[], env: Record<string, string | undefined>, out?: (line: string) => void, err?: (line: string) => void): Promise<number>;
```

**Spec:**
- R-DEP-5 et R-OPS-3 : garde au démarrage, jamais de base vide ;
- R-VER-7 : migrations au démarrage, refus d'une migration inconnue cassante ;
- R-SYN-25 : `server_epoch` généré par `init` ;
- 08 §4, point 5 : CLI `init` et `db:check` ;
- 08 §4, point 7 : arrêt propre sur SIGTERM en moins de 10 s ;
- Global Constraints, « Garde de démarrage ».

- [ ] **Step 1: Write the failing test**

Chaque test travaille dans un dossier temporaire neuf (`mkdtempSync(join(tmpdir(), 'appsport-'))`), avec `env = { APP_ORIGIN: 'http://localhost:3999', APPSPORT_DATA_DIR: dir, HOST: '127.0.0.1', PORT: '0' }`. Les sorties sont capturées dans `out: string[]` et `err: string[]`.

`apps/server/test/cli/init.test.ts` :
```ts
it('init exige la sentinelle', async () => {
  expect(await runCli(['init'], env, o, e)).toBe(1);
  expect(err.join('\n')).toMatch(/sentinelle/i); expect(readdirSync(dir)).toEqual([]);
});
it('init crée la base, migre, initialise l\'époque et l\'affiche ; un second init est refusé', async () => {
  writeFileSync(join(dir, '.appsport-volume'), '');
  expect(await runCli(['init'], env, o, e)).toBe(0);
  const { sqlite, db } = openDatabase(join(dir, 'appsport.db'));
  const meta = await getServerMeta(db); sqlite.close();
  expect(isUuidV7(meta.serverEpoch)).toBe(true);
  expect(out).toContain(`Époque du serveur : ${meta.serverEpoch}`);
  expect(await runCli(['init'], env, o, e)).toBe(1);
  expect(err.join('\n')).toMatch(/existe déjà/);
});
it('db:check sur une base saine affiche OK', async () => { /* sentinelle + init */ expect(await runCli(['db:check'], env, o, e)).toBe(0); expect(out.at(-1)).toBe('OK'); });
it('db:check sans base → 1, sans créer de fichier', async () => { writeFileSync(join(dir, '.appsport-volume'), ''); expect(await runCli(['db:check'], env, o, e)).toBe(1); expect(readdirSync(dir)).toEqual(['.appsport-volume']); });
it('commande inconnue → 1 et usage', async () => { expect(await runCli(['nope'], env, o, e)).toBe(1); expect(err.join('\n')).toMatch(/Commande inconnue : nope/); expect(err.join('\n')).toMatch(/init/); });
it('parseFlags', () => { expect(parseFlags(['alice', '--birth-date', '2000-01-01'])).toEqual({ positional: ['alice'], flags: { 'birth-date': '2000-01-01' } }); });
```

`apps/server/test/startup.test.ts` :
```ts
it('sans sentinelle → StartupError(no_sentinel)', () => {
  expect(() => assertStartupPreconditions(loadConfig(env))).toThrow(expect.objectContaining({ code: 'no_sentinel' }));
});
it('sentinelle sans base → no_database, et startServer ne crée aucun fichier', async () => {
  writeFileSync(join(dir, '.appsport-volume'), '');
  expect(() => assertStartupPreconditions(loadConfig(env))).toThrow(expect.objectContaining({ code: 'no_database' }));
  await expect(startServer(env)).rejects.toMatchObject({ code: 'no_database' });
  expect(readdirSync(dir)).toEqual(['.appsport-volume']);
});
it('démarre, exécute les tâches de démarrage avant d\'écouter, répond sur /api/health et s\'arrête proprement', async () => {
  // sentinelle + runCli(['init'])
  const calls: string[] = [];
  const s = await startServer(env, { startupTasks: [{ name: 't', run: async () => { calls.push('startup'); } }], dailyJobs: [{ name: 'j', run: async () => { calls.push('job'); } }] });
  expect(calls[0]).toBe('startup');
  const res = await fetch(`http://127.0.0.1:${s.port}/api/health`);
  expect(res.status).toBe(200); expect(HealthResponse.parse(await res.json()).status).toBe('ok');
  const t0 = performance.now(); await s.close(); expect(performance.now() - t0).toBeLessThan(9000);
  await expect(fetch(`http://127.0.0.1:${s.port}/api/health`)).rejects.toThrow();
});
it('migration inconnue cassante → refus de démarrer (R-VER-7)', async () => {
  // init, puis INSERT INTO schema_migrations VALUES ('0099_future', 1, '2026-11-01T00:00:00.000Z') via openDatabase, puis fermeture
  await expect(startServer(env)).rejects.toMatchObject({ name: 'MigrationError', code: 'unknown_breaking_migration' });
});
it('migrations inconnues non cassantes → démarre et journalise un avertissement', async () => {
  // idem avec breaking = 0 ; startServer réussit ; close()
});
it('main([\'nope\']) renvoie 1', async () => { expect(await main(['nope'])).toBe(1); });
```

`apps/server/test/jobs/scheduler.test.ts` utilise `vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })` et un `createTestContext` dont le logger capture les lignes :
```ts
it('exécute chaque job au démarrage puis toutes les 24 h', async () => {
  const a = vi.fn(async () => {}), b = vi.fn(async () => {});
  const h = startDailyJobs(ctx.deps, [{ name: 'a', run: a }, { name: 'b', run: b }]);
  await vi.waitFor(() => expect(b).toHaveBeenCalledTimes(1));
  expect(a).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(24 * 3600 * 1000);
  expect(a).toHaveBeenCalledTimes(2);
  h.stop(); await vi.advanceTimersByTimeAsync(24 * 3600 * 1000); expect(a).toHaveBeenCalledTimes(2);
});
it('isole l\'échec d\'un job et le journalise sans son message', async () => {
  const ok = vi.fn(async () => {});
  startDailyJobs(ctx.deps, [{ name: 'boom', run: async () => { throw new Error('TEMOIN'); } }, { name: 'ok', run: ok }]).stop;
  await vi.waitFor(() => expect(ok).toHaveBeenCalledTimes(1));
  expect(lines.some((l) => JSON.parse(l).job === 'boom' && JSON.parse(l).level === 'error')).toBe(true);
  expect(lines.join('\n')).not.toContain('TEMOIN');
});
it('registres vides au socle', () => { expect(STARTUP_TASKS).toEqual([]); expect(DAILY_JOBS).toEqual([]); });
```

- [ ] **Step 2: Run test to verify it fails**

Commande : `pnpm --filter @appsport/server test -- cli/ startup jobs/`

Échec attendu : « Failed to resolve import "../../src/cli" », et de même pour `../src/main`.

- [ ] **Step 3: Implement**

**`assertStartupPreconditions(cfg, fs = node:fs)`**
- Sentinelle absente : lève `StartupError('no_sentinel')` avec le message « Volume de données absent : fichier sentinelle <chemin> introuvable. Le volume chiffré est-il déverrouillé ? ».
- Base absente : lève `StartupError('no_database')` avec le message « Base introuvable : <chemin>. Lancez « server.mjs init » sur un volume neuf, ou restaurez une sauvegarde. ».
- La fonction ne crée jamais rien.

**`startServer(env, opts)`**
1. `loadConfig(env)`.
2. `assertStartupPreconditions`.
3. `openDatabase(cfg.dbPath)`.
4. `migrate(db, MIGRATIONS, systemClock)`. En cas d'erreur, fermer la base puis relancer l'erreur. Chaque id de `unknownNonBreaking` donne `logger.warn('unknown_migration', { migration: id })`.
5. `deps = createAppDeps({ sqlite, db, config })`.
6. Exécuter dans l'ordre chaque tâche de `opts.startupTasks ?? STARTUP_TASKS`.
7. `serve({ fetch: createApp(deps).fetch, port: cfg.port, hostname: cfg.host })` (`@hono/node-server`). Attendre l'événement `listening` et lire le port réel avec `server.address()`.
8. `startDailyJobs(deps, opts.dailyJobs ?? DAILY_JOBS)`.
9. `logger.info('listening', { count: port })`.

La fonction `close()` :
- arrête les jobs ;
- appelle `server.close()`, puis `closeAllConnections()` si la méthode existe ;
- attend la fermeture, puis `sqlite.close()`.

**`main(argv)`**
- Avec `argv.length > 0`, renvoie `runCli(argv, process.env)`.
- Sinon :
  1. `startServer(process.env)` ;
  2. sur `SIGTERM` et `SIGINT` : `setTimeout(() => process.exit(1), 9000).unref()`, puis `await s.close()` ;
  3. résout `0` à la fermeture.
- En cas de `StartupError`, `ConfigError` ou `MigrationError`, écrit le message en français sur stderr et renvoie 1.
- En bas du fichier : `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });`. Ce garde fonctionne sous `tsx` comme dans le bundle `server.mjs`.

**`runCli`**
- `out` écrit par défaut sur stdout et `err` sur stderr.
- Commande inconnue, ou absence de commande : `err('Commande inconnue : <cmd>')` (rien après les deux-points si aucune commande), puis une ligne `  <usage>` par commande ; renvoie 1.
- Toute exception levée par une commande est affichée par `err(message)` et donne le code 1.

**Commandes du socle**
- `init`, usage `init` :
  1. sentinelle absente : `err('Fichier sentinelle absent : <chemin> ; init refusé.')`, code 1 ;
  2. base existante : `err('La base existe déjà : <chemin> ; init refusé.')`, code 1 ;
  3. sinon `openDatabase`, `migrate` puis `initServerMeta(db, cryptoIds())` ;
  4. `out('Base initialisée : <dbPath>')` puis `out('Époque du serveur : <epoch>')` ;
  5. fermeture de la base, code 0.
- `db:check`, usage `db:check` :
  1. `assertStartupPreconditions` ;
  2. ouverture de la base ;
  3. `PRAGMA integrity_check` doit renvoyer exactement `[{ integrity_check: 'ok' }]`, et `PRAGMA foreign_key_check` doit être vide ;
  4. si c'est le cas : `out('OK')`, code 0. Sinon : `err('Base corrompue : …')` avec les lignes fautives, code 1.
- `withAppDeps(ctx, fn)` enchaîne `loadConfig(ctx.env)`, la garde, l'ouverture, `migrate` et `createAppDeps`, puis exécute `fn` et ferme la base dans un `finally`.

**Tâches planifiées**
- `startDailyJobs` exécute les jobs en séquence, une fois immédiatement, puis toutes les `24 * 3600 * 1000` ms (`setInterval(...).unref()`).
- Chaque job tourne dans un `try/catch`. Un échec donne `logger.error('job_failed', { job: name, event: err.name })`.
- `stop()` appelle `clearInterval`.

- [ ] **Step 4: Run test to verify it passes**

Commandes et résultats attendus :
- `pnpm --filter @appsport/server test -- cli/ startup jobs/` est vert.
- `pnpm test`, `pnpm typecheck` et `pnpm lint` passent.
- Contrôle manuel facultatif : `pnpm --filter @appsport/server exec tsx src/main.ts db:check` sans `APP_ORIGIN` affiche une erreur `ConfigError` en français et renvoie le code 1.

- [ ] **Step 5: Commit**

```
git add apps/server pnpm-lock.yaml ; git commit -m "feat(ops): garde de démarrage, CLI init et db:check, arrêt propre et tâches quotidiennes"
```
