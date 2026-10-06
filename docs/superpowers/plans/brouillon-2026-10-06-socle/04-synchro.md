### Task 20: Contrats du protocole de synchro et push serveur

**Files:**
- Create: `packages/contracts/src/sync.ts`
- Modify: `packages/contracts/src/index.ts` (ajouter `export * from './sync';`)
- Test: `packages/contracts/test/sync.test.ts`
- Create: `apps/server/src/sync/hooks.ts`, `apps/server/src/sync/push.ts`, `apps/server/src/sync/routes.ts`
- Modify: `apps/server/src/deps.ts` (ajouter `syncHooks: SyncHooksMap` à `AppDeps`), puis chaque endroit qui construit un `AppDeps` (`apps/server/src/main.ts`, `apps/server/src/cli.ts`, `apps/server/test/support/context.ts` ; `pnpm typecheck` les signale tous) : `syncHooks: SYNC_HOOKS` (dans `createTestContext` : `opts.deps?.syncHooks ?? SYNC_HOOKS`)
- Modify: `apps/server/src/routes.ts` (une ligne : `app.route('/api/sync', syncRoutes(deps));`)
- Create: `apps/server/test/support/sync-fixtures.ts` ; Modify: `apps/server/test/support/index.ts` (`export * from './sync-fixtures';`)
- Test: `apps/server/test/sync/push.test.ts`, `apps/server/test/sync/push-c2.test.ts`

**Interfaces:**
- Consumes :
  - `entityRules`, `EntityRule`, `EntityRulesMap`, `snakeToCamel`, `camelToSnake` (T5) ; `SYNC_PROTOCOL`, `MIN_PROTOCOL` (T2) ;
  - `AppDeps`, `AppEnv`, `SessionUser`, `httpError`, `parseJson`, `Logger` (T6) ;
  - `writeStamp(trx, deps, actorId)`, `DbExecutor`, `Database`, `Migration` (T4) ;
  - `requireUser` (T9) ; `isHealthConsentActive(db, userId)` (T10) ; `createUserAndLogin`, `createTestContext`, `seqIds`, `TestContext` (T6/T10) ; `grantConsent` (T19, dans le test seulement).
- Produces (`packages/contracts/src/sync.ts`, valeurs exactes) :
  ```ts
  export const SYNC_PUSH_MAX = 200; export const SYNC_PULL_LIMIT = 500; export const SYNC_TIMEOUT_MS = 4000;
  export const EPOCH_RESEND_DAYS = 60; export const TOMBSTONE_TTL_DAYS = 90; export const APPLIED_OP_TTL_MONTHS = 12;
  export const SYNC_RETRY_MIN_MS = 2000; export const SYNC_RETRY_MAX_MS = 300_000;   // [décision plan] noms des constantes de R-SYN-30
  export const SYNC_INTERVAL_MS = 60_000; export const SYNC_DEBOUNCE_MS = 2000; export const COACH_FLUSH_MS = 4000; // R-SYN-29
  export const PROTOCOL_HEADER = 'X-Appsport-Protocol'; export const EPOCH_HEADER = 'X-Appsport-Epoch';
  export const UuidV7 = z.uuid({ version: 'v7' }); export type UuidV7 = z.infer<typeof UuidV7>;
  export const OpKind = z.enum(['create', 'patch', 'delete', 'restore_upsert']); export type OpKind = z.infer<typeof OpKind>;
  export const SyncOp = z.object({ opId: UuidV7, userId: z.string().min(1), entity: z.string().min(1), id: z.string().min(1).max(200),
    kind: OpKind, fields: z.record(z.string(), z.unknown()), clientTs: z.iso.datetime(), protocol: z.number().int().min(1),
    attempts: z.number().int().min(0), serverRevSeen: z.number().int().nullable().optional() });
  export type SyncOp = z.infer<typeof SyncOp>;
  export const RejectionCode = z.enum(['validation', 'forbidden', 'parent_rejected', 'stale_revision', 'unknown_entity', 'protocol']);
  export const PushRequest = z.object({ ops: z.array(SyncOp).max(SYNC_PUSH_MAX) });          // utilisé par le client
  export const PushEnvelope = z.object({ ops: z.array(z.looseObject({ opId: z.string().min(1) })).max(SYNC_PUSH_MAX) }); // utilisé par la route
  export const PushResult = z.object({ opId: z.string(), status: z.enum(['applied', 'applied_partial', 'duplicate', 'rejected']),
    rev: z.number().int().optional(), code: RejectionCode.optional(), droppedFields: z.array(z.string()).optional(), dropped: z.boolean().optional() });
  export const PushResponse = z.object({ results: z.array(PushResult) });
  export const PulledRow = z.object({ entity: z.string(), rev: z.number().int(), row: z.record(z.string(), z.unknown()) });
  export const PullResponse = z.object({ rows: z.array(PulledRow), nextWatermark: z.string(), hasMore: z.boolean(), catalogVersion: z.string().nullable() });
  export const PullQuery = z.object({ since: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(SYNC_PULL_LIMIT).default(SYNC_PULL_LIMIT) });
  export function encodeWatermark(epoch: string, rev: number): string;               // `${epoch}:${rev}`
  export function decodeWatermark(w: string): { epoch: string; rev: number } | null;  // coupe au dernier ':' ; epoch non vide ; rev /^\d+$/
  ```
  (chaque schéma est aussi exporté comme type du même nom.)
- Produces (serveur) :
  ```ts
  // apps/server/src/sync/hooks.ts
  export interface HookCtx { trx: Transaction<Database>; deps: AppDeps; userId: string; op: SyncOp }
  export interface EntitySyncHooks { allowedKinds?: readonly SyncOp['kind'][]; parent?: { entity: string; column: string }; afterApply?(ctx: HookCtx): Promise<void> }
  export type SyncHooksMap = Readonly<Record<string, EntitySyncHooks>>;
  export const SYNC_HOOKS: SyncHooksMap = { sync_rejection: { allowedKinds: ['patch'] } };
  // apps/server/src/sync/push.ts
  export class OpRejection extends Error { constructor(readonly code: RejectionCode, readonly reason: string) }
  export async function applyPush(deps: AppDeps, user: SessionUser, ops: readonly unknown[]): Promise<PushResult[]>; // accepte aussi SyncOp[]
  // apps/server/src/sync/routes.ts
  export function syncRoutes(deps: AppDeps): Hono<AppEnv>;   // POST /push
  ```
- Produces (`apps/server/test/support/sync-fixtures.ts`, exporté par `@appsport/server/testing`) :
  ```ts
  export const SYNC_FIXTURE_MIGRATION: Migration;   // id '9001_sync_fixtures', breaking: false
  export const SYNC_FIXTURE_RULES: EntityRulesMap;  // { ...entityRules, fixture_note, fixture_note_item, fixture_c2_log }
  export const SYNC_FIXTURE_HOOKS: SyncHooksMap;    // { ...SYNC_HOOKS, fixture_note_item: { parent: { entity: 'fixture_note', column: 'note_id' } } }
  export async function createSyncTestContext(opts?: Parameters<typeof createTestContext>[0]): Promise<TestContext>;
  export const PROTOCOL_HEADERS: Record<string, string>;  // { 'X-Appsport-Protocol': String(SYNC_PROTOCOL) }
  export function makeOp(o: { userId: string; entity: string; id: string; kind: SyncOp['kind']; fields?: Record<string, unknown>;
    opId?: string; serverRevSeen?: number | null; protocol?: number }): SyncOp; // clientTs '2026-10-06T10:00:00.000Z', attempts 0, opId de seqIds(7000)
  export async function syncPush(ctx: TestContext, cookie: string, ops: unknown[]): Promise<{ status: number; body: any }>;
  export function dumpDatabase(sqlite: DatabaseSync): string;  // JSON de toutes les lignes de toutes les tables (recherche de valeurs témoins)
  ```

**Spec:** 01 R-SYN-3, R-SYN-9, R-SYN-11 (validation Zod), R-SYN-15, R-SYN-16, R-SYN-17, R-SYN-18 (côté serveur) ; 03 P-CST-2, P-CST-4, P-LOG-2 ; 09 §0.6 (classe J) ; Review Focus 3 (serveur).

- [ ] **Step 1: Write the failing test**

DDL exact des tables de test (dans `SYNC_FIXTURE_MIGRATION.up`, via `sql` brut), toutes `STRICT`, avec index `(rev)` et `(owner_id, rev)` :
```sql
CREATE TABLE fixture_note (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, rev INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT REFERENCES user(id) ON DELETE SET NULL, deleted_at TEXT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100), body TEXT) STRICT;
CREATE TABLE fixture_note_item (/* mêmes 7 colonnes +SYNC */, note_id TEXT NOT NULL REFERENCES fixture_note(id),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 100), pain_note TEXT) STRICT;
CREATE TABLE fixture_c2_log (/* mêmes 7 colonnes +SYNC */, value INTEGER, CHECK (deleted_at IS NOT NULL OR value IS NOT NULL)) STRICT;
```
Règles : `fixture_note` C1/J/owner_id, `clientWritable ['title','body']`, `c2Columns []` ; `fixture_note_item` C1/J/owner_id, `clientWritable ['note_id','label','pain_note']`, `c2Columns ['pain_note']` ; `fixture_c2_log` C2/J/owner_id, `clientWritable ['value']` ; toutes `exported: true`, `onUserDelete: 'cascade'`, `secretColumns []`, `columns` = liste SQL complète.

`packages/contracts/test/sync.test.ts` :
```ts
it('SyncOp accepte une opération valide et refuse un kind inconnu', () => {
  const op = { opId: '0199b9a1-0000-7000-8000-000000000001', userId: 'u', entity: 'fixture_note', id: 'n1', kind: 'create',
    fields: { title: 't' }, clientTs: '2026-10-06T10:00:00.000Z', protocol: 1, attempts: 0 };
  expect(SyncOp.safeParse(op).success).toBe(true);
  expect(SyncOp.safeParse({ ...op, kind: 'upsert' }).success).toBe(false);
  expect(SyncOp.safeParse({ ...op, opId: 'not-a-uuid' }).success).toBe(false);
});
it('PushRequest refuse 201 opérations', () => { /* 200 → success true ; 201 → success false */ });
it('encodeWatermark / decodeWatermark font l’aller-retour', () => {
  expect(encodeWatermark('0199b9a0-0000-7000-8000-0000000000e1', 42)).toBe('0199b9a0-0000-7000-8000-0000000000e1:42');
  expect(decodeWatermark('0199b9a0-0000-7000-8000-0000000000e1:42')).toEqual({ epoch: '0199b9a0-0000-7000-8000-0000000000e1', rev: 42 });
  for (const bad of ['abc', ':3', 'e:-1', 'e:1.5', 'e:', '']) expect(decodeWatermark(bad)).toBeNull();
});
it('constantes de la spec', () => {
  expect([SYNC_PUSH_MAX, SYNC_PULL_LIMIT, SYNC_TIMEOUT_MS, EPOCH_RESEND_DAYS, TOMBSTONE_TTL_DAYS, APPLIED_OP_TTL_MONTHS])
    .toEqual([200, 500, 4000, 60, 90, 12]);
  expect([SYNC_RETRY_MIN_MS, SYNC_RETRY_MAX_MS, SYNC_INTERVAL_MS, SYNC_DEBOUNCE_MS, COACH_FLUSH_MS]).toEqual([2000, 300000, 60000, 2000, 4000]);
});
```
`apps/server/test/sync/push.test.ts` (prélude commun : `ctx = await createSyncTestContext()`, `a`/`b = await createUserAndLogin(ctx)`, `ids = seqIds(500)`, `row(table, id)` = `ctx.deps.sqlite.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(id)`, `count(sql)`) :
```ts
const note = (u, fields: Record<string, unknown> = { title: 'n' }, id = ids.uuidv7()) =>
  makeOp({ userId: u.id, entity: 'fixture_note', id, kind: 'create', fields });

it('refuse un lot de plus de 200 opérations (400 validation)', async () => {
  const r = await syncPush(ctx, a.cookie, Array.from({ length: 201 }, () => note(a)));
  expect(r.status).toBe(400); expect(r.body.error).toBe('validation');
});
it('accepte 200 opérations', async () => {
  const r = await syncPush(ctx, a.cookie, Array.from({ length: 200 }, () => note(a)));
  expect(r.status).toBe(200); expect(r.body.results.every((x) => x.status === 'applied')).toBe(true);
});
it('opId déjà vu → duplicate avec le même rev, une seule ligne applied_op', async () => {
  const op = note(a); const r1 = await syncPush(ctx, a.cookie, [op]); const r2 = await syncPush(ctx, a.cookie, [op]);
  expect(r2.body.results[0]).toEqual({ opId: op.opId, status: 'duplicate', rev: r1.body.results[0].rev });
  expect(count(`SELECT count(*) c FROM applied_op WHERE op_id = '${op.opId}'`)).toBe(1);
});
it('schéma invalide → rejected validation et ligne sync_rejection du propriétaire', async () => {
  const op = { ...note(a), kind: 'upsert' };
  const r = await syncPush(ctx, a.cookie, [op]);
  expect(r.body.results[0]).toEqual({ opId: op.opId, status: 'rejected', code: 'validation' });
  const rej = ctx.deps.sqlite.prepare('SELECT * FROM sync_rejection WHERE op_id = ?').get(op.opId) as any;
  expect(rej).toMatchObject({ owner_id: a.id, entity: 'fixture_note', row_id: op.id, code: 'validation', dismissed_at: null });
  expect(rej.rev).toBeGreaterThan(0);
});
it('entité non J ou inconnue → unknown_entity', async () => {
  const r = await syncPush(ctx, a.cookie, [makeOp({ userId: a.id, entity: 'training_profile', id: a.id, kind: 'patch', fields: { goal: 'muscle' } }),
                                           makeOp({ userId: a.id, entity: 'nope', id: 'x', kind: 'create' })]);
  expect(r.body.results.map((x) => x.code)).toEqual(['unknown_entity', 'unknown_entity']);
});
it('kind interdit par allowedKinds → forbidden', async () => {
  const r = await syncPush(ctx, a.cookie, [makeOp({ userId: a.id, entity: 'sync_rejection', id: ids.uuidv7(), kind: 'create', fields: {} })]);
  expect(r.body.results[0]).toMatchObject({ status: 'rejected', code: 'forbidden' });
});
it('userId de l’opération différent de la session → forbidden', async () => {
  const r = await syncPush(ctx, b.cookie, [note(a)]);
  expect(r.body.results[0]).toMatchObject({ status: 'rejected', code: 'forbidden' });
});
it('modifier la ligne d’un autre propriétaire → forbidden, ligne intacte', async () => {
  const op = note(a, { title: 'a' }); await syncPush(ctx, a.cookie, [op]);
  const r = await syncPush(ctx, b.cookie, [makeOp({ userId: b.id, entity: 'fixture_note', id: op.id, kind: 'patch', fields: { title: 'pirate' } })]);
  expect(r.body.results[0].code).toBe('forbidden'); expect(row('fixture_note', op.id)).toMatchObject({ title: 'a', owner_id: a.id });
});
it('colonnes hors clientWritable ignorées ; owner_id pris de la session', async () => {
  const op = note(a, { title: 't', ownerId: b.id, rev: 999, updatedBy: b.id, createdAt: '2000-01-01T00:00:00.000Z' });
  const r = await syncPush(ctx, a.cookie, [op]);
  expect(r.body.results[0].status).toBe('applied');
  expect(row('fixture_note', op.id)).toMatchObject({ owner_id: a.id, updated_by: a.id, rev: r.body.results[0].rev, created_at: '2026-10-06T10:00:00.000Z' });
});
it('create idempotent par id', async () => {
  const id = ids.uuidv7(); const r = await syncPush(ctx, a.cookie, [note(a, { title: 'premier' }, id), note(a, { title: 'second' }, id)]);
  expect(r.body.results.map((x) => x.status)).toEqual(['applied', 'applied']);
  expect(r.body.results[1].rev).toBe(r.body.results[0].rev); expect(row('fixture_note', id)).toMatchObject({ title: 'premier' });
});
it('patch champ par champ, la dernière arrivée gagne', async () => {
  const op = note(a, { title: 'a', body: 'b' });
  const p1 = makeOp({ userId: a.id, entity: 'fixture_note', id: op.id, kind: 'patch', fields: { title: 't2' } });
  const p2 = makeOp({ userId: a.id, entity: 'fixture_note', id: op.id, kind: 'patch', fields: { body: 'b3' } });
  const r = await syncPush(ctx, a.cookie, [op, p1, p2]);
  const revs = r.body.results.map((x) => x.rev); expect(revs[0] < revs[1] && revs[1] < revs[2]).toBe(true);
  expect(row('fixture_note', op.id)).toMatchObject({ title: 't2', body: 'b3', rev: revs[2] });
});
it('delete pose une tombstone ; un patch ultérieur est applied sans effet', async () => {
  const op = note(a, { title: 'a' });
  const del = makeOp({ userId: a.id, entity: 'fixture_note', id: op.id, kind: 'delete' });
  const p = makeOp({ userId: a.id, entity: 'fixture_note', id: op.id, kind: 'patch', fields: { title: 'zombie' } });
  const r = await syncPush(ctx, a.cookie, [op, del, p]);
  expect(r.body.results[2]).toEqual({ opId: p.opId, status: 'applied', rev: r.body.results[1].rev });
  expect(row('fixture_note', op.id)).toMatchObject({ title: 'a', deleted_at: '2026-10-06T10:00:00.000Z', rev: r.body.results[1].rev });
});
it('patch d’une ligne absente → rejected validation', async () => { /* code 'validation' */ });
it('un rejet n’annule pas les autres opérations du lot (savepoint)', async () => {
  const n1 = note(a), n2 = note(a); const bad = note(a, { title: '' });          // CHECK length → erreur SQLite
  const r = await syncPush(ctx, a.cookie, [n1, bad, n2]);
  expect(r.body.results.map((x) => x.status)).toEqual(['applied', 'rejected', 'applied']);
  expect(r.body.results[1].code).toBe('validation'); expect(row('fixture_note', n1.id)).toBeDefined(); expect(row('fixture_note', n2.id)).toBeDefined();
  expect(row('fixture_note', bad.id)).toBeUndefined();
});
it('enfant d’un parent rejeté → parent_rejected, deux lignes sync_rejection', async () => {
  const bad = note(a, { title: '' });
  const item = makeOp({ userId: a.id, entity: 'fixture_note_item', id: ids.uuidv7(), kind: 'create', fields: { noteId: bad.id, label: 'x' } });
  const r = await syncPush(ctx, a.cookie, [bad, item]);
  expect(r.body.results[1]).toMatchObject({ status: 'rejected', code: 'parent_rejected' });
  expect(count(`SELECT count(*) c FROM sync_rejection WHERE owner_id = '${a.id}'`)).toBe(2);
});
it('detail_json ne contient que kind, fieldNames et reason, jamais de valeur', async () => {
  const bad = note(a, { title: '', body: 'VALEUR-SECRETE' }); await syncPush(ctx, a.cookie, [bad]);
  const rej = ctx.deps.sqlite.prepare('SELECT detail_json FROM sync_rejection WHERE op_id = ?').get(bad.opId) as any;
  const detail = JSON.parse(rej.detail_json);
  expect(Object.keys(detail).sort()).toEqual(['fieldNames', 'kind', 'reason']); expect(detail.fieldNames).toEqual(['body', 'title']);
  expect(rej.detail_json).not.toContain('VALEUR-SECRETE');
});
it('applied_op enregistre statut et assigned_rev', async () => {
  const op = note(a); const r = await syncPush(ctx, a.cookie, [op]);
  expect(ctx.deps.sqlite.prepare('SELECT * FROM applied_op WHERE op_id = ?').get(op.opId))
    .toMatchObject({ user_id: a.id, entity: 'fixture_note', row_id: op.id, status: 'applied', assigned_rev: r.body.results[0].rev });
});
it('le propriétaire peut écrire dismissed_at d’un rejet', async () => { /* patch sync_rejection { dismissedAt: '2026-10-06T11:00:00.000Z' } → applied, colonne posée */ });
it('protocole d’opération hors plage → rejected protocol', async () => {
  const r = await syncPush(ctx, a.cookie, [makeOp({ userId: a.id, entity: 'fixture_note', id: ids.uuidv7(), kind: 'create', fields: { title: 't' }, protocol: 99 })]);
  expect(r.body.results[0].code).toBe('protocol');
});
```
`apps/server/test/sync/push-c2.test.ts` (Review Focus 3, serveur ; contexte créé avec `createSyncTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } })`) :
```ts
const WITNESS = 'TEMOIN-C2-7f3a'; const WITNESS_N = 987654;
it('sans consentement : colonne C2 mise à NULL, applied_partial + droppedFields', async () => {
  const n = note(a); const item = makeOp({ userId: a.id, entity: 'fixture_note_item', id: ids.uuidv7(), kind: 'create',
    fields: { noteId: n.id, label: 'x', painNote: WITNESS } });
  const r = await syncPush(ctx, a.cookie, [n, item]);
  expect(r.body.results[1]).toMatchObject({ status: 'applied_partial', droppedFields: ['painNote'] });
  expect(r.body.results[1].rev).toBeGreaterThan(0); expect(row('fixture_note_item', item.id)).toMatchObject({ label: 'x', pain_note: null });
});
it('sans consentement : ligne de table C2 écartée sans écriture (dropped: true)', async () => {
  const log = makeOp({ userId: a.id, entity: 'fixture_c2_log', id: ids.uuidv7(), kind: 'create', fields: { value: WITNESS_N } });
  const r = await syncPush(ctx, a.cookie, [log]);
  expect(r.body.results[0]).toEqual({ opId: log.opId, status: 'applied_partial', dropped: true });
  expect(row('fixture_c2_log', log.id)).toBeUndefined();
  expect(ctx.deps.sqlite.prepare('SELECT status, assigned_rev FROM applied_op WHERE op_id = ?').get(log.opId)).toEqual({ status: 'applied_partial', assigned_rev: null });
});
it('avec consentement : la valeur C2 est enregistrée (applied)', async () => {
  await grantConsent(ctx.deps.db, ctx.deps, a.id, 'health', HEALTH_CONSENT_TEXT.version, null);
  /* même item → status 'applied', pain_note = WITNESS */
});
it('aucune trace de la valeur témoin : ni table, ni sync_rejection, ni journal', async () => {
  /* pousser l'item et le log ci-dessus sans consentement */
  expect(count('SELECT count(*) c FROM sync_rejection')).toBe(0);
  const dump = dumpDatabase(ctx.deps.sqlite); expect(dump).not.toContain(WITNESS); expect(dump).not.toContain(String(WITNESS_N));
  expect(lines.join('\n')).not.toContain(WITNESS); expect(lines.join('\n')).not.toContain(String(WITNESS_N));
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- sync` puis `pnpm --filter @appsport/server test -- sync/push`
Attendu : échec à l'import (`Cannot find module './sync'`, `createSyncTestContext is not exported`).

- [ ] **Step 3: Implement**

- `packages/contracts/src/sync.ts` : exactement les déclarations de « Produces ».
- `apps/server/src/sync/hooks.ts` : types et `SYNC_HOOKS` ci-dessus.
- `apps/server/src/sync/routes.ts` : `syncRoutes(deps)` = `new Hono<AppEnv>()` ; `POST /push` : `requireUser`, `parseJson(c, PushEnvelope)`, réponse `200 { results: await applyPush(deps, c.get('user')!, body.ops) }`.
- `apps/server/src/sync/push.ts` : tout le lot dans une transaction contrôlée (`deps.db.startTransaction().execute()`), un point de sauvegarde par opération (`trx.savepoint('op')`, puis `releaseSavepoint('op')` ou `rollbackToSavepoint('op')` + `releaseSavepoint('op')`). Accès aux tables dynamiques par `trx as unknown as Kysely<any>`, noms de table SQL et colonnes en camelCase (le `CamelCasePlugin` convertit). Valeurs écrites : `boolean` → 0/1, objet ou tableau → `JSON.stringify`, le reste tel quel. Algorithme par opération (ordre R-SYN-16, à respecter) :
```ts
// consent = await isHealthConsentActive(trx, user.id)  (une fois par lot) ; rejectedRows = new Set<string>()  // `${entity}:${id}`
// 0. prior = applied_op(opId) : même user → { status: 'duplicate', rev: prior.assignedRev ?? undefined } ; autre user → rejected forbidden (sans écriture). continue.
// 1. SyncOp.safeParse(raw) échoue                    → OpRejection('validation', 'schema')
// 2. op.protocol ∉ [MIN_PROTOCOL, SYNC_PROTOCOL]     → OpRejection('protocol', 'protocol')
// 3. rule = deps.entityRules[op.entity] ; absente ou rule.syncClass !== 'J' → OpRejection('unknown_entity', 'not_journal')
// 4. hooks = deps.syncHooks[op.entity] ; hooks?.allowedKinds && !includes(op.kind) → OpRejection('forbidden', 'kind_not_allowed')
// 5. op.userId !== user.id                            → OpRejection('forbidden', 'user_mismatch')
// 6. existing = SELECT * WHERE id = op.id ; existing && existing.ownerId !== user.id → OpRejection('forbidden', 'owner_mismatch')
// 7. hooks?.parent && kind ∈ {create, restore_upsert} : parentId = fields[snakeToCamel(parent.column)] ;
//    rejectedRows.has(`${parent.entity}:${parentId}`) || parent absent || parent.ownerId !== user.id → OpRejection('parent_rejected', 'parent_rejected')
// 8. !consent && rule.category === 'C2' && kind !== 'delete' → résultat { status: 'applied_partial', dropped: true }, AUCUNE écriture
// 9. fields = clés k dont camelToSnake(k) ∈ rule.clientWritable (les autres sont ignorées en silence) ;
//    !consent : pour k dont camelToSnake(k) ∈ rule.c2Columns → fields[k] = null, droppedFields.push(k)
// 10. create : existing → résultat applied, rev = existing.rev, sans écriture ; sinon INSERT { id, ownerId: user.id, ...stamp, createdAt: stamp.updatedAt, deletedAt: null, ...fields }
//     patch : !existing → OpRejection('validation', 'row_missing') ; existing.deletedAt → applied, rev = existing.rev, sans écriture ; sinon UPDATE fields + stamp
//     delete : !existing → applied sans rev ; existing.deletedAt → applied, rev = existing.rev ; sinon UPDATE deletedAt = stamp.updatedAt + stamp
//     restore_upsert : OpRejection('validation', 'not_supported') — remplacé par T22
//     (stamp = await writeStamp(trx, deps, user.id) ; rev, updatedAt, updatedBy)
// 11. hooks?.afterApply?.({ trx, deps, userId: user.id, op })
// 12. status = droppedFields.length ? 'applied_partial' : 'applied' ; INSERT applied_op { opId, userId, entity, rowId: op.id, status, assignedRev: rev ?? null, appliedAt: now }
// Rejet (OpRejection, ou erreur dont err.code === 'ERR_SQLITE_ERROR' → code 'validation', reason 'sql_constraint' ; toute autre erreur est relancée → 500) :
//   rollback du point de sauvegarde ; rejectedRows.add(`${entity}:${id}`) si connus ;
//   INSERT sync_rejection { id: deps.ids.uuidv7(), ownerId: user.id, ...stamp, createdAt, opId, entity: String(raw.entity ?? ''), rowId: String(raw.id ?? ''),
//     code, detailJson: JSON.stringify({ kind: String(raw.kind ?? ''), fieldNames: Object.keys(raw.fields ?? {}).sort(), reason }), dismissedAt: null }
//   INSERT applied_op { ..., status: 'rejected', assignedRev: null } ; deps.logger.warn('sync op rejected', { event: 'sync_rejected', code })
// Fin : commit ; deps.logger.info('sync push', { event: 'sync_push', count: ops.length }). Aucune valeur de champ n'est journalisée.
```
- `sync-fixtures.ts` : `createSyncTestContext(opts)` = `createTestContext({ ...opts, extraMigrations: [SYNC_FIXTURE_MIGRATION, ...(opts?.extraMigrations ?? [])], entityRules: SYNC_FIXTURE_RULES, deps: { syncHooks: SYNC_FIXTURE_HOOKS, ...opts?.deps } })` ; `syncPush` = `ctx.request('/api/sync/push', { method: 'POST', json: { ops }, cookie, headers: PROTOCOL_HEADERS })` puis `{ status, body: await res.json() }` ; `dumpDatabase` parcourt `sqlite_schema` (`type = 'table'`, sans `sqlite_%`) et sérialise `SELECT *` de chaque table.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/contracts test -- sync` et `pnpm --filter @appsport/server test -- sync/push` → tous verts ; puis `pnpm typecheck` et `pnpm lint` sans erreur.

- [ ] **Step 5: Commit**

`git add packages/contracts apps/server && git commit -m "feat(synchro): protocole v1 et push serveur avec points de sauvegarde"`

---

### Task 21: Pull serveur, garde de protocole et test de fuite

**Files:**
- Modify: `packages/contracts/src/sync.ts` (ajout de `ColumnCodec`, `COLUMN_CODECS`)
- Create: `apps/server/src/sync/pull.ts`, `apps/server/src/sync/protocol-guard.ts`
- Modify: `apps/server/src/sync/routes.ts` (garde sur tout le routeur + `GET /pull`)
- Modify: `apps/server/test/support/sync-fixtures.ts` (ajout de `syncPull`)
- Test: `apps/server/test/sync/pull.test.ts`, `apps/server/test/sync/pull-leak.test.ts`, `apps/server/test/sync/protocol-guard.test.ts`, `apps/server/test/sync/codecs.test.ts`

**Interfaces:**
- Consumes : T20 (`syncRoutes`, `PullQuery`, `PullResponse`, `encodeWatermark`, `decodeWatermark`, `PROTOCOL_HEADER`, `createSyncTestContext`, `makeOp`, `syncPush`) ; `getServerMeta` (T4) ; `insertFixtureRow` (T5, clés en camelCase) ; `createUser`, `createUserAndLogin` (T10) ; `grantConsent` (T19) ; `HEALTH_CONSENT_TEXT` (T14) ; `mirroredTables`, `snakeToCamel` (T5).
- Produces :
  ```ts
  // packages/contracts/src/sync.ts
  export type ColumnCodec = 'boolean' | 'json';
  export const COLUMN_CODECS: Readonly<Record<string, Readonly<Record<string, ColumnCodec>>>> = {
    training_profile: { cautious_mode: 'boolean' }, health_screening: { caution: 'boolean' }, limitation: { active: 'boolean' },
    gym: { load_settings: 'json' }, place: { is_primary: 'boolean', visible_at_gym: 'boolean', load_settings: 'json' },
    sync_rejection: { detail_json: 'json' } };
  // apps/server/src/sync/pull.ts
  export async function buildPull(deps: AppDeps, user: SessionUser, since: string | null, limit: number): Promise<PullResponse>; // throw httpError('watermark_expired')
  // apps/server/src/sync/protocol-guard.ts
  export const protocolGuard: MiddlewareHandler<AppEnv>;
  // apps/server/test/support/sync-fixtures.ts
  export async function syncPull(ctx: TestContext, cookie: string, q?: { since?: string; limit?: number }): Promise<{ status: number; body: any; headers: Headers }>;
  ```
  Route : `GET /api/sync/pull?since=&limit=` → `PullResponse`.

**Spec:** 01 R-SYN-20, R-SYN-21, R-SYN-23 (410), R-VER-1, R-VER-2 ; 03 §17 n°1 ; 09 §0 (booléens à la frontière) ; décision plan `tombstone_purge_rev`.

- [ ] **Step 1: Write the failing test**

`protocol-guard.test.ts` :
```ts
it.each([undefined, '0', '2', 'abc', '1.5'])('X-Appsport-Protocol=%s → 426 avant toute authentification', async (v) => {
  const ctx = await createSyncTestContext();
  for (const [method, path] of [['GET', '/api/sync/pull'], ['POST', '/api/sync/push']] as const) {
    const res = await ctx.request(path, { method, json: method === 'POST' ? { ops: [] } : undefined, headers: v === undefined ? {} : { 'X-Appsport-Protocol': v } });
    expect(res.status).toBe(426);
    expect(await res.json()).toEqual({ error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 });
  }
});
it('X-Appsport-Protocol=1 sans session → 401 unauthenticated (la garde laisse passer)', async () => { /* status 401 */ });
```
`pull.test.ts` :
```ts
it('lignes triées par rev ; sans since, nextWatermark = epoch:sync_counter et hasMore = false', async () => {
  await syncPush(ctx, a.cookie, [note(a), note(a), note(a)]);
  const { status, body } = await syncPull(ctx, a.cookie); const meta = await getServerMeta(ctx.deps.db);
  expect(status).toBe(200); const revs = body.rows.map((r) => r.rev); expect(revs).toEqual([...revs].sort((x, y) => x - y));
  expect(body.rows.filter((r) => r.entity === 'fixture_note')).toHaveLength(3);
  expect(body).toMatchObject({ hasMore: false, nextWatermark: `${meta.serverEpoch}:${meta.syncCounter}` });
});
it('limit pagine avec hasMore et reprend au watermark', async () => {
  /* 5 notes ; pull limit=2 → 2 lignes, hasMore true, nextWatermark = `${epoch}:${rows[1].rev}` ; pull since=nextWatermark&limit=2 → les 2 suivantes */
});
it('limit par défaut 500, limit 501 → 400 validation', async () => {
  for (let i = 0; i < 3; i++) await syncPush(ctx, a.cookie, Array.from({ length: 200 }, () => note(a)));
  const p = await syncPull(ctx, a.cookie); expect(p.body.rows).toHaveLength(500); expect(p.body.hasMore).toBe(true);
  expect((await syncPull(ctx, a.cookie, { limit: 501 })).body.error).toBe('validation');
});
it('ne coupe jamais un groupe de lignes de même rev', async () => {
  /* 3 notes ; UPDATE fixture_note SET rev = <rev de la 2e> WHERE id = <3e> ; pull limit=2 → 3 lignes fixture_note */
});
it('tombstones incluses avec deletedAt', async () => { /* create + delete → row.deletedAt === '2026-10-06T10:00:00.000Z' */ });
it('ligne user : la sienne seulement, sans passwordHash ; booléens convertis', async () => {
  await ctx.request('/api/me/training-profile', { method: 'PATCH', json: { cautiousMode: true }, cookie: a.cookie });
  const rows = (await syncPull(ctx, a.cookie)).body.rows;
  const users = rows.filter((r) => r.entity === 'user'); expect(users).toHaveLength(1); expect(users[0].row.id).toBe(a.id);
  expect(users[0].row).not.toHaveProperty('passwordHash');
  expect(rows.find((r) => r.entity === 'training_profile').row.cautiousMode).toBe(true);
  for (const r of rows) expect(r.row).toHaveProperty('deletedAt');
});
it('toutes les salles et leur matériel, pas les lieux des autres', async () => {
  await ctx.request('/api/gyms', { method: 'POST', cookie: b.cookie, json: { name: 'Basic Fit', city: 'Lyon', equipment: ['dumbbells'], isPrimary: true } });
  const rows = (await syncPull(ctx, a.cookie)).body.rows;
  expect(rows.some((r) => r.entity === 'gym')).toBe(true); expect(rows.some((r) => r.entity === 'gym_equipment')).toBe(true);
  expect(rows.some((r) => r.entity === 'place')).toBe(false);
  expect(typeof rows.find((r) => r.entity === 'gym').row.loadSettings).toBe('object');
});
it('watermark d’une autre époque → 410 watermark_expired', async () => {
  const r = await syncPull(ctx, a.cookie, { since: '0199b9a0-0000-7000-8000-0000000000ff:3' });
  expect(r.status).toBe(410); expect(r.body).toEqual({ error: 'watermark_expired' });
});
it('rev < tombstone_purge_rev → 410 ; rev = tombstone_purge_rev → 200', async () => {
  ctx.deps.sqlite.exec('UPDATE server_meta SET tombstone_purge_rev = 10'); const { serverEpoch } = await getServerMeta(ctx.deps.db);
  expect((await syncPull(ctx, a.cookie, { since: `${serverEpoch}:5` })).status).toBe(410);
  expect((await syncPull(ctx, a.cookie, { since: `${serverEpoch}:10` })).status).toBe(200);
});
it('since mal formé → 400 validation', async () => { /* since 'abc' */ });
it('catalogVersion = server_meta.catalog_version', async () => {
  ctx.deps.sqlite.exec("UPDATE server_meta SET catalog_version = 'abc'"); expect((await syncPull(ctx, a.cookie)).body.catalogVersion).toBe('abc');
});
```
`pull-leak.test.ts` (généré depuis le registre ; contexte `createTestContext()`) :
```ts
it.each(['member', 'admin'] as const)('aucune ligne d’un autre utilisateur ne sort du pull (session %s)', async (role) => {
  const reader = await createUserAndLogin(ctx, { role }); const other = await createUser(ctx);
  await grantConsent(ctx.deps.db, ctx.deps, other.id, 'health', HEALTH_CONSENT_TEXT.version, null);
  const owned = Object.entries(entityRules).filter(([, r]) => ['J', 'D', 'E'].includes(r.syncClass) && (r.ownerColumn === 'owner_id' || r.ownerColumn === 'user_id'));
  for (const [table, r] of owned) {
    const col = r.ownerColumn!;
    const n = (ctx.deps.sqlite.prepare(`SELECT count(*) c FROM ${table} WHERE ${col} = ?`).get(other.id) as any).c;
    if (n === 0) await insertFixtureRow(ctx.deps.db, table, { [snakeToCamel(col)]: other.id });
    expect((ctx.deps.sqlite.prepare(`SELECT count(*) c FROM ${table} WHERE ${col} = ?`).get(other.id) as any).c).toBeGreaterThan(0);
  }
  const { body } = await syncPull(ctx, reader.cookie, {});
  expect(JSON.stringify(body)).not.toContain(other.id);
  const secrets = Object.values(entityRules).flatMap((r) => r.secretColumns.map(snakeToCamel));
  for (const pr of body.rows) { for (const s of secrets) expect(pr.row).not.toHaveProperty(s); expect(mirroredTables()).toContain(pr.entity); }
});
```
`codecs.test.ts` :
```ts
it('chaque colonne booléenne ou JSON des tables miroirs a un codec', async () => {
  const ctx = await createTestContext();
  for (const t of mirroredTables()) {
    const ddl = (ctx.deps.sqlite.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").get(t) as any).sql as string;
    const bools = [...ddl.matchAll(/\b(\w+)\s+IN\s*\(\s*0\s*,\s*1\s*\)/g)].map((m) => m[1]);
    const jsons = [...ddl.matchAll(/json_valid\(\s*(\w+)\s*\)/g)].map((m) => m[1]);
    for (const c of bools) expect(COLUMN_CODECS[t]?.[c], `${t}.${c}`).toBe('boolean');
    for (const c of jsons) expect(COLUMN_CODECS[t]?.[c], `${t}.${c}`).toBe('json');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- sync/pull sync/protocol-guard sync/codecs`
Attendu : `syncPull is not exported`, `COLUMN_CODECS` indéfini, statuts 404 au lieu de 426.

- [ ] **Step 3: Implement**

- `protocolGuard` : lit `PROTOCOL_HEADER` ; doit correspondre à `/^\d+$/` et être dans `[MIN_PROTOCOL, SYNC_PROTOCOL]`, sinon `throw httpError('protocol_unsupported', { serverProtocol: SYNC_PROTOCOL, minProtocol: MIN_PROTOCOL })`. Dans `syncRoutes`, `app.use('*', protocolGuard)` est déclaré avant toute route, donc avant `requireUser`.
- `GET /pull` : `requireUser`, `parseQuery(c, PullQuery)`, `c.json(await buildPull(deps, user, q.since ?? null, q.limit))`.
- `buildPull` : tout se lit dans une seule transaction Kysely, ce qui donne un instantané cohérent grâce à la connexion unique et au mutex.
  - **Contrôle du watermark** : `meta = getServerMeta(trx)`. Si `since` est non nul, `decodeWatermark(since)` ; un résultat `null` donne `httpError('validation')`. Si `epoch !== meta.serverEpoch` ou `rev < meta.tombstonePurgeRev`, lever `httpError('watermark_expired')`. Sans `since`, `sinceRev = 0`.
  - **Tables du périmètre** : les tables de `deps.entityRules` dont `syncClass ∈ {J, D, E}`.
    - `ownerColumn` non nul : filtre `ownerColumn = user.id` (pour `user`, c'est `id`).
    - `ownerColumn` nul et `category === 'C0'` : toutes les lignes (`gym`, `gym_equipment`).
    - Sinon, la table est exclue.
  - **Lecture et tri** : pour chaque table, `rev > sinceRev ORDER BY rev LIMIT limit + 1`. Fusionner les résultats, trier par `rev` et garder les `limit` premières lignes.
  - **Groupe de même rev** : si une ligne non gardée a le même `rev` que la dernière ligne gardée, relire dans chaque table les lignes `rev = lastRev` et les ajouter toutes.
  - **Pagination** : `hasMore` vaut vrai s'il reste une ligne de `rev > lastRev`. `nextWatermark = encodeWatermark(epoch, hasMore ? lastRev : Math.max(sinceRev, meta.syncCounter))`.
  - **Format d'une ligne** : clés en camelCase. Retirer `secretColumns` (passées par `snakeToCamel`). Appliquer `COLUMN_CODECS` : `boolean` donne `v === 1`, `json` donne `JSON.parse` si la valeur n'est pas nulle. `deletedAt` vaut `null` quand la table n'a pas la colonne. Résultat : `{ entity, rev, row }`.
  - `catalogVersion = meta.catalogVersion`.
- `syncPull` : `GET /api/sync/pull` avec `since` et `limit` encodés par `URLSearchParams`, et `PROTOCOL_HEADERS`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- sync` → tous les tests `sync/*` sont verts, y compris ceux de T20 (ils envoient déjà `PROTOCOL_HEADERS`).

- [ ] **Step 5: Commit**

`git add packages/contracts apps/server && git commit -m "feat(synchro): pull paginé, garde de protocole 426 et test de fuite"`

---

### Task 22: Époque du serveur, restore_upsert et purge des tombstones

**Files:**
- Create: `apps/server/src/sync/epoch.ts`, `apps/server/src/sync/restore-upsert.ts`, `apps/server/src/sync/purge.ts`
- Modify: `apps/server/src/sync/push.ts` (branche `restore_upsert` → `applyRestoreUpsert` ; `deletedAt` admis en plus de `clientWritable` pour ce kind)
- Modify: `apps/server/src/jobs/registry.ts` (ajouter `syncPurgeJob` à `DAILY_JOBS`)
- Test: `apps/server/test/sync/epoch.test.ts`, `apps/server/test/sync/restore-upsert.test.ts`, `apps/server/test/sync/purge.test.ts`

**Interfaces:**
- Consumes : T20 (`applyPush`, `OpRejection`, `HookCtx`, `makeOp`, `syncPush`), T21 (`syncPull`), `getServerMeta`, `writeStamp`, `DbExecutor` (T4), `IdGen`, `createApp` (T6), `DailyJob`, `DAILY_JOBS` (T7), `TOMBSTONE_TTL_DAYS`, `APPLIED_OP_TTL_MONTHS`.
- Produces :
  ```ts
  // apps/server/src/sync/epoch.ts
  export async function rotateServerEpoch(db: DbExecutor, ids: IdGen): Promise<{ epoch: string; baseRev: number }>; // epoch = ids.uuidv7(), baseRev = sync_counter
  // apps/server/src/sync/restore-upsert.ts
  export type RestoreUpsertOutcome = { outcome: 'inserted' | 'replaced' | 'kept'; rev: number };
  export async function applyRestoreUpsert(ctx: HookCtx, rule: EntityRule, fields: Record<string, unknown> /* camelCase, filtrées, avec deletedAt */): Promise<RestoreUpsertOutcome>;
  // apps/server/src/sync/purge.ts
  export const syncPurgeJob: DailyJob;   // name 'sync-purge'
  ```

**Spec:** 01 R-SYN-23, R-SYN-25, R-SYN-26 (serveur), R-SYN-27 ; 09 §0.6 ; 03 §7 (tombstones 90 j) ; décision plan `tombstone_purge_rev` ; Review Focus 2 (serveur, trois branches).

- [ ] **Step 1: Write the failing test**

`epoch.test.ts` :
```ts
it('rotateServerEpoch change l’époque et pose epoch_base_rev = sync_counter', async () => {
  await syncPush(ctx, a.cookie, [note(a), note(a)]); const before = await getServerMeta(ctx.deps.db);
  const r = await rotateServerEpoch(ctx.deps.db, ctx.deps.ids); const after = await getServerMeta(ctx.deps.db);
  expect(r.epoch).not.toBe(before.serverEpoch); expect(isUuidV7(r.epoch)).toBe(true);
  expect(after).toMatchObject({ serverEpoch: r.epoch, epochBaseRev: before.syncCounter, syncCounter: before.syncCounter });
  expect(r.baseRev).toBe(before.syncCounter);
});
it('X-Appsport-Epoch suit la nouvelle époque', async () => {
  const { epoch } = await rotateServerEpoch(ctx.deps.db, ctx.deps.ids);
  expect((await createApp(ctx.deps).request('/api/health')).headers.get('X-Appsport-Epoch')).toBe(epoch);
});
it('un watermark de l’ancienne époque reçoit 410 watermark_expired', async () => { /* pull → nextWatermark ; rotate ; pull since → 410 */ });
```
`restore-upsert.test.ts` (`ru(u, id, fields, serverRevSeen)` = `makeOp({ userId: u.id, entity: 'fixture_note', id, kind: 'restore_upsert', fields, serverRevSeen })`) :
```ts
it('ligne absente → insérée (tombstone comprise)', async () => {
  const id = ids.uuidv7(), gone = ids.uuidv7();
  const r = await syncPush(ctx, a.cookie, [ru(a, id, { title: 'r', body: null, deletedAt: null }, 3),
                                           ru(a, gone, { title: 'g', deletedAt: '2026-09-01T00:00:00.000Z' }, 4)]);
  expect(r.body.results.map((x) => x.status)).toEqual(['applied', 'applied']);
  expect(row('fixture_note', id)).toMatchObject({ title: 'r', owner_id: a.id });
  expect(row('fixture_note', gone)).toMatchObject({ deleted_at: '2026-09-01T00:00:00.000Z' });
});
it('présente, rev ≤ epoch_base_rev et serverRevSeen > rev → remplacée', async () => {
  const op = note(a, { title: 'sauvegarde' }); const r1 = (await syncPush(ctx, a.cookie, [op])).body.results[0].rev;
  const { baseRev } = await rotateServerEpoch(ctx.deps.db, ctx.deps.ids);
  const r = await syncPush(ctx, a.cookie, [ru(a, op.id, { title: 'client', body: null, deletedAt: null }, r1 + 100)]);
  expect(r.body.results[0].rev).toBeGreaterThan(baseRev); expect(row('fixture_note', op.id)).toMatchObject({ title: 'client' });
});
it('présente, rev ≤ epoch_base_rev mais serverRevSeen ≤ rev (ou null) → laissée', async () => {
  /* serverRevSeen = r1 puis null → title 'sauvegarde', results[0] = { status: 'applied', rev: r1 } */
});
it('présente et modifiée après la restauration (rev > epoch_base_rev) → laissée, même avec serverRevSeen élevé', async () => {
  const op = note(a, { title: 'sauvegarde' }); await syncPush(ctx, a.cookie, [op]); await rotateServerEpoch(ctx.deps.db, ctx.deps.ids);
  const p = makeOp({ userId: a.id, entity: 'fixture_note', id: op.id, kind: 'patch', fields: { title: 'apres-restauration' } });
  const rp = (await syncPush(ctx, a.cookie, [p])).body.results[0].rev;
  const r = await syncPush(ctx, a.cookie, [ru(a, op.id, { title: 'appareil-en-retard', deletedAt: null }, 1_000_000)]);
  expect(r.body.results[0]).toEqual({ opId: expect.any(String), status: 'applied', rev: rp });
  expect(row('fixture_note', op.id)).toMatchObject({ title: 'apres-restauration' });
});
it('restore_upsert sur sync_rejection → rejected forbidden', async () => { /* code 'forbidden' */ });
it('restore_upsert sur une table C2 sans consentement → applied_partial dropped', async () => { /* fixture_c2_log, pas de ligne */ });
it('restore_upsert d’une ligne d’un autre propriétaire → forbidden', async () => { /* ligne de a, op de b */ });
```
`purge.test.ts` (horloge `2026-10-06T10:00:00.000Z` ; tombstones posées par `UPDATE ... SET deleted_at = ?`) :
```ts
it('supprime les tombstones de plus de 90 j, garde celles de 89 j, gym et place', async () => {
  const old = note(a), young = note(a); await syncPush(ctx, a.cookie, [old, young]);
  setDeleted('fixture_note', old.id, '2026-07-07T10:00:00.000Z'); setDeleted('fixture_note', young.id, '2026-07-09T10:00:00.000Z');
  /* + une gym et une place de a avec deleted_at '2026-01-01T00:00:00.000Z' (insertFixtureRow) */
  const oldRev = row('fixture_note', old.id).rev;
  await syncPurgeJob.run(ctx.deps);
  expect(row('fixture_note', old.id)).toBeUndefined(); expect(row('fixture_note', young.id)).toBeDefined();
  /* gym et place toujours présentes */
  expect((await getServerMeta(ctx.deps.db)).tombstonePurgeRev).toBe(oldRev);
});
it('purge enfants et parents sans erreur de clé étrangère', async () => { /* note + item, deux tombstones de 91 j → les deux supprimées */ });
it('tombstone_purge_rev ne diminue jamais', async () => { /* posé à 1000 puis purge d'une ligne de rev 5 → reste 1000 */ });
it('purge applied_op au-delà de 12 mois', async () => {
  /* applied_at '2025-10-05T10:00:00.000Z' → supprimée ; '2025-11-06T10:00:00.000Z' → gardée */
});
it('après purge, un watermark antérieur reçoit 410', async () => { /* since `${epoch}:${oldRev - 1}` → 410 watermark_expired */ });
it('syncPurgeJob est inscrit dans DAILY_JOBS', () => { expect(DAILY_JOBS).toContain(syncPurgeJob); });
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- sync/epoch sync/restore-upsert sync/purge`
Attendu : modules introuvables ; `restore_upsert` → `rejected validation`.

- [ ] **Step 3: Implement**

- `rotateServerEpoch` : un seul `UPDATE server_meta SET server_epoch = ?, epoch_base_rev = sync_counter WHERE id = 1 RETURNING ...`.
- **push.ts** : pour `kind === 'restore_upsert'`, les champs gardés sont `clientWritable ∪ {deleted_at}`. L'ordre R-SYN-16 reste le même, avec les étapes 1 à 9 de T20 (garde C2 et parent compris). Ensuite `applyRestoreUpsert` est appelé et son `rev` est renvoyé avec le statut `applied` (ou `applied_partial` si `droppedFields` n'est pas vide).
- **applyRestoreUpsert** : `meta = getServerMeta(ctx.trx)` et `existing = SELECT WHERE id`.
  - Ligne absente : INSERT avec `ownerId = ctx.userId` et le stamp (`writeStamp`). Résultat `inserted`.
  - `existing.rev <= meta.epochBaseRev && op.serverRevSeen != null && op.serverRevSeen > existing.rev` : UPDATE de tous les champs fournis, `deletedAt` compris, avec un nouveau stamp. Résultat `replaced`.
  - Sinon : aucune écriture. Résultat `{ outcome: 'kept', rev: existing.rev }`.
- **syncPurgeJob.run(deps)** :
  - `cutoff = now − TOMBSTONE_TTL_DAYS j`, au format ISO.
  - **Tables concernées** : `syncClass ∈ {J, D, E}`, présence de la colonne `deleted_at`, et ni `gym` ni `place`.
  - **Ordre** : les tables qui référencent viennent avant les tables référencées. Le tri topologique se fait par `PRAGMA foreign_key_list(<table>)`.
  - **Suppression** : `DELETE ... WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING rev`. On garde le maximum des `rev` supprimés, puis `tombstone_purge_rev = max(tombstone_purge_rev, ce maximum)`.
  - **applied_op** : `DELETE FROM applied_op WHERE applied_at < <now − 12 mois calendaires>` (`setUTCMonth(getUTCMonth() − APPLIED_OP_TTL_MONTHS)`).
  - Le tout se fait dans une seule transaction, puis `deps.logger.info('sync purge', { job: 'sync-purge', count })`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- sync` → vert (y compris T20 et T21).

- [ ] **Step 5: Commit**

`git add apps/server && git commit -m "feat(synchro): époque serveur, restore_upsert et purge des tombstones"`

---

### Task 23: Catalogue minimal servi par ETag

**Files:**
- Create: `packages/contracts/src/catalog.ts` ; Modify: `packages/contracts/src/index.ts` (`export * from './catalog';`)
- Test: `packages/contracts/test/catalog.test.ts`
- Create: `apps/server/src/catalog/loader.ts`, `apps/server/src/catalog/routes.ts`
- Modify: `apps/server/src/startup.ts` (ajouter `CATALOG_STARTUP_TASK` à `STARTUP_TASKS`), `apps/server/src/routes.ts` (une ligne : `app.route('/api/catalog', catalogRoutes(deps));`)
- Create: `data/programs/.gitkeep`, `data/exercises/.gitkeep`, `data/illustrations/files/.gitkeep`, `data/illustrations/manifest.json` (contenu exact `[]` + saut de ligne), `data/LICENSE`
- Test: `apps/server/test/catalog/loader.test.ts`, `apps/server/test/catalog/routes.test.ts`

**Interfaces:**
- Consumes : `AppDeps`, `AppConfig.contentDir`, `Logger` (T6) ; `StartupTask`, `STARTUP_TASKS` (T7) ; `requireUser` (T9) ; `getServerMeta` (T4) ; `createTestContext`, `createUserAndLogin`.
- Produces :
  ```ts
  // packages/contracts/src/catalog.ts
  export const IllustrationRef = z.object({ id: z.string().min(1), file: z.string().regex(/^[a-z0-9][a-z0-9-]*\.[0-9a-f]{8}\.(svg|png|webp|jpg)$/) });
  export const CatalogBundle = z.object({ version: z.string(), exercises: z.array(z.unknown()), illustrations: z.array(IllustrationRef),
    programTemplates: z.array(z.unknown()), adviceSheets: z.array(z.unknown()) });
  // apps/server/src/catalog/loader.ts
  export class CatalogLoadError extends Error {}
  export async function loadCatalog(deps: AppDeps): Promise<CatalogBundle>;   // lit contentDir, met en cache par deps, met à jour server_meta
  export function getLoadedCatalog(deps: AppDeps): CatalogBundle | null;        // cache WeakMap<AppDeps, CatalogBundle>
  export const CATALOG_STARTUP_TASK: StartupTask;                              // name 'catalog' ; erreur journalisée, démarrage maintenu
  // apps/server/src/catalog/routes.ts
  export function catalogRoutes(deps: AppDeps): Hono<AppEnv>;                  // GET /
  ```

**Spec:** 01 R-SYN-32 (texte du catalogue), R-VER-7 (chargeur après migrations) ; 04 §10 (chargeur, comportement réduit au socle : manifeste et `data/programs/*.json`), 04 §11 (`GET /api/catalog`, ETag = `catalog_version`) ; 09 §0.6 (classe C).

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/catalog.test.ts` :
```ts
it('IllustrationRef exige <id>.<hash8>.<ext>', () => {
  expect(IllustrationRef.safeParse({ id: 'squat', file: 'squat.0a1b2c3d.svg' }).success).toBe(true);
  expect(IllustrationRef.safeParse({ id: 'squat', file: 'squat.svg' }).success).toBe(false);
});
```
`loader.test.ts` (dossier temporaire `mkdtempSync(join(tmpdir(), 'appsport-catalog-'))`, contexte `createTestContext({ config: { contentDir: dir } })`) :
```ts
it('dossier data/ du dépôt : bundle vide et version = sha256 de la forme canonique', async () => {
  const ctx = await createTestContext({ config: { contentDir: resolve(__dirname, '../../../../data') } });
  const b = await loadCatalog(ctx.deps);
  expect(b).toMatchObject({ exercises: [], illustrations: [], programTemplates: [], adviceSheets: [] });
  expect(b.version).toBe(createHash('sha256').update('{"adviceSheets":[],"exercises":[],"illustrations":[],"programTemplates":[]}').digest('hex'));
  expect((await getServerMeta(ctx.deps.db)).catalogVersion).toBe(b.version);
});
it('lit le manifeste et programs/*.json triés par nom ; l’ordre des clés ne change pas la version', async () => {
  write('illustrations/manifest.json', [{ id: 'squat', file: 'squat.0a1b2c3d.svg' }]);
  write('programs/b.json', { id: 'b', z: 1, a: 2 }); write('programs/a.json', { id: 'a' });
  const v1 = (await loadCatalog(ctx.deps)); expect(v1.programTemplates.map((p: any) => p.id)).toEqual(['a', 'b']);
  write('programs/b.json', { a: 2, z: 1, id: 'b' }); expect((await loadCatalog(ctx.deps)).version).toBe(v1.version);
});
it('contenu modifié → nouvelle version et catalog_updated_at = maintenant', async () => {
  /* ajouter programs/c.json ; ctx.clock.set('2026-10-07T08:00:00.000Z') → version différente ; catalogUpdatedAt '2026-10-07T08:00:00.000Z' */
});
it('contenu identique → aucune écriture de server_meta', async () => { /* catalogUpdatedAt inchangé après une 2e horloge */ });
it('fichier invalide → CatalogLoadError, server_meta inchangé', async () => {
  write('illustrations/manifest.json', [{ id: 'x', file: 'pas-bon' }]);
  await expect(loadCatalog(ctx.deps)).rejects.toBeInstanceOf(CatalogLoadError);
  /* JSON illisible dans programs/ → même résultat */
});
it('CATALOG_STARTUP_TASK journalise l’erreur sans interrompre le démarrage', async () => {
  /* logger capturé ; await expect(CATALOG_STARTUP_TASK.run(deps)).resolves.toBeUndefined() ; une ligne contient "catalog_invalid" */
  expect(STARTUP_TASKS).toContain(CATALOG_STARTUP_TASK);
});
```
`routes.test.ts` :
```ts
it('GET /api/catalog sans session → 401', async () => { expect((await ctx.request('/api/catalog')).status).toBe(401); });
it('GET /api/catalog → 200 + ETag "<version>" + Cache-Control no-cache', async () => {
  const res = await ctx.request('/api/catalog', { cookie: u.cookie }); const body = await res.json();
  expect(res.status).toBe(200); expect(CatalogBundle.parse(body).version).toBe((await getServerMeta(ctx.deps.db)).catalogVersion);
  expect(res.headers.get('ETag')).toBe(`"${body.version}"`); expect(res.headers.get('Cache-Control')).toBe('no-cache');
});
it('If-None-Match identique → 304 sans corps', async () => {
  /* 304, ETag présent, texte vide ; If-None-Match 'W/"<v>"' → 304 aussi ; '"autre"' → 200 */
});
it('catalogue invalide → 500 internal', async () => { /* manifeste invalide, aucun chargement réussi → { error: 'internal' } */ });
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- catalog` et `pnpm --filter @appsport/server test -- catalog`
Attendu : modules `./catalog` et `catalog/loader` introuvables.

- [ ] **Step 3: Implement**

- **loadCatalog** :
  - Lit `join(contentDir, 'illustrations', 'manifest.json')`, validé par `z.array(IllustrationRef)`. Fichier absent : `[]`.
  - Lit `join(contentDir, 'programs', '*.json')`, triés par nom de fichier, chacun par `JSON.parse` (contenu brut ; la brique 3 le validera). Dossier absent : `[]`.
  - `exercises: []` et `adviceSheets: []` dans le socle.
  - **Version** : `sha256 hex` de la sérialisation canonique de `{ adviceSheets, exercises, illustrations, programTemplates }`. Clés d'objets triées récursivement, `JSON.stringify` sans espaces, tableaux dans leur ordre. Fonction locale non exportée `canonicalJson(value: unknown): string`.
  - **Erreurs** : JSON illisible ou Zod en échec lève `CatalogLoadError`, sans aucune écriture.
  - **Mise à jour** : si la version diffère de `server_meta.catalog_version`, mettre à jour `catalog_version` et `catalog_updated_at = clock.now().toISOString()` dans une transaction.
  - Mettre le bundle en cache (`WeakMap` indexée par `deps`).
- `CATALOG_STARTUP_TASK.run` : `try { await loadCatalog(deps) } catch (e) { deps.logger.error('catalog load failed', { event: 'catalog_load_failed', code: 'catalog_invalid' }) }`.
- **GET /api/catalog** :
  - `requireUser`, puis `bundle = getLoadedCatalog(deps) ?? await loadCatalog(deps)`. Un `CatalogLoadError` donne `httpError('internal')`.
  - `ETag: "<version>"` et `Cache-Control: no-cache`.
  - `If-None-Match` est découpé sur les virgules et le préfixe `W/` est retiré. Si l'une des valeurs vaut `"<version>"`, la réponse est `304`.
- `data/LICENSE` (français) : « Textes du catalogue : © les auteurs d'appsport, usage privé. Illustrations : chaque fichier de `illustrations/files/` reste sous la licence indiquée dans `illustrations/manifest.json` (créateurs, source, licence, modifications). »

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/contracts test -- catalog` et `pnpm --filter @appsport/server test -- catalog` → vert.

- [ ] **Step 5: Commit**

`git add packages/contracts apps/server data && git commit -m "feat(synchro): catalogue minimal servi par ETag"`

---

### Task 24: privacy:collect et privacy:reapply

**Files:**
- Create: `apps/server/src/privacy/reapply.ts`
- Modify: `apps/server/src/cli.ts` (commandes `privacy:collect` et `privacy:reapply`)
- Modify: `apps/server/test/support/sync-fixtures.ts` (ajout de `snapshotDb` et `restoreInPlace`)
- Test: `apps/server/test/privacy/reapply.test.ts`, `apps/server/test/cli/privacy-cli.test.ts`

**Interfaces:**
- Consumes : `deleteAccount(trx, deps, userId, actor)` (T13) ; `withdrawHealthConsent(trx, deps, userId, actor)` (T19) ; `isHealthConsentActive` (T10) ; `rotateServerEpoch` (T22) ; `runCli`, `openDatabase` (T7/T3) ; `insertFixtureRow` (T5) ; `syncPush`, `makeOp`, `createSyncTestContext` (T20) ; routes `POST /api/me/delete` (T13), `POST /api/me/consents`, `POST /api/me/consents/withdraw`, `PUT /api/me/health-screening`, `POST /api/me/limitations` (T19) ; `HEALTH_CONSENT_TEXT`, `HEALTH_QUESTIONNAIRE` (T14).
- Produces :
  ```ts
  // apps/server/src/privacy/reapply.ts
  export const PrivacyEventList = z.object({ since: z.iso.datetime(), collectedAt: z.iso.datetime(), source: z.string(),
    events: z.array(z.object({ type: z.enum(['account_deleted', 'consent_revoked']), at: z.string(), targetId: z.string(),
      consentType: z.enum(['health', 'ai_coach']).optional() })) });
  export type PrivacyEventList = z.infer<typeof PrivacyEventList>;
  export async function collectPrivacyEvents(db: DbExecutor, since: string): Promise<PrivacyEventList['events']>;
  export async function reapplyPrivacyEvents(deps: AppDeps, list: PrivacyEventList): Promise<{ accountsDeleted: number; consentsWithdrawn: number }>;
  // apps/server/test/support/sync-fixtures.ts
  export async function snapshotDb(ctx: TestContext, path: string): Promise<void>;   // node:sqlite backup(ctx.deps.sqlite, path)
  export async function restoreInPlace(ctx: TestContext, snapshotPath: string): Promise<{ epoch: string; baseRev: number }>; // copie les tables puis rotateServerEpoch
  ```
  CLI : `privacy:collect --since <ISO> [--source <fichier.db>] --out <fichier.json>` ; `privacy:reapply <fichier.json>`. Codes de sortie : 0 en cas de succès, 1 en cas d'erreur, avec le message en français sur stderr.

**Spec:** 03 §8 (étapes 1 à 4), 03 §17 n°10, P-DRT-3, P-DRT-4, P-CST-3 ; 02 R-SUP-6 ; 08 P4 (a) étapes 1-2 ; Review Focus 4 (volet `privacy:reapply`).

- [ ] **Step 1: Write the failing test**

`reapply.test.ts` (scénario 03 §17 n°10 ; `ctx = await createSyncTestContext()`, horloge `2026-10-06T10:00:00.000Z`, dossier temporaire `dir`) :
```ts
it('restauration antérieure + reapply : ni le compte ni les données C2 ne réapparaissent', async () => {
  const x = await createUserAndLogin(ctx); const y = await createUserAndLogin(ctx); const z = await createUserAndLogin(ctx);
  await ctx.request('/api/me/delete', { method: 'POST', cookie: z.cookie, json: { password: z.password } });   // avant S : hors liste
  await ctx.request('/api/me/consents', { method: 'POST', cookie: y.cookie, json: { type: 'health', textVersion: HEALTH_CONSENT_TEXT.version } });
  await ctx.request('/api/me/health-screening', { method: 'PUT', cookie: y.cookie, json: { answers: [true, false, false, false], questionnaireVersion: HEALTH_QUESTIONNAIRE.version } });
  await ctx.request('/api/me/limitations', { method: 'POST', cookie: y.cookie, json: { bodyArea: 'knee', side: 'left', severity: 'mild', note: 'TEMOIN-C2-genou' } });
  const S = join(dir, 'S.db'); await snapshotDb(ctx, S); const since = ctx.clock.now().toISOString();
  ctx.clock.advance(60_000);
  expect((await ctx.request('/api/me/delete', { method: 'POST', cookie: x.cookie, json: { password: x.password } })).status).toBe(204);
  expect((await ctx.request('/api/me/consents/withdraw', { method: 'POST', cookie: y.cookie, json: { type: 'health', password: y.password } })).status).toBe(204);
  const events = await collectPrivacyEvents(ctx.deps.db, since);
  expect(events).toEqual([{ type: 'account_deleted', at: expect.any(String), targetId: x.id },
                          { type: 'consent_revoked', at: expect.any(String), targetId: y.id, consentType: 'health' }]);
  await restoreInPlace(ctx, S);
  expect(dumpDatabase(ctx.deps.sqlite)).toContain('TEMOIN-C2-genou');           // la sauvegarde contenait la donnée
  const res = await reapplyPrivacyEvents(ctx.deps, { since, collectedAt: ctx.clock.now().toISOString(), source: 'test', events });
  expect(res).toEqual({ accountsDeleted: 1, consentsWithdrawn: 1 });
  expect(ctx.deps.sqlite.prepare('SELECT count(*) c FROM user WHERE id = ?').get(x.id)).toEqual({ c: 0 });
  expect(ctx.deps.sqlite.prepare('SELECT count(*) c FROM session WHERE user_id IS NULL AND revoked_reason = ?').get('account_deleted'))
    .toEqual({ c: expect.any(Number) });
  const me = await ctx.request('/api/me', { cookie: x.cookie });
  expect(me.status).toBe(410); expect(await me.json()).toEqual({ error: 'account_deleted' });
  expect(dumpDatabase(ctx.deps.sqlite)).not.toContain('TEMOIN-C2-genou');
  expect(ctx.deps.sqlite.prepare('SELECT caution, deleted_at FROM health_screening WHERE id = ?').get(y.id))
    .toEqual({ caution: null, deleted_at: expect.any(String) });
  const push = await syncPush(ctx, x.cookie, [makeOp({ userId: x.id, entity: 'fixture_note', id: seqIds(900).uuidv7(), kind: 'create', fields: { title: 'rejoue' } })]);
  expect(push.status).toBe(410); expect(push.body).toEqual({ error: 'account_deleted' });
});
it('reapply est idempotent', async () => { /* 2e appel avec la même liste → { accountsDeleted: 0, consentsWithdrawn: 0 } */ });
it('collect ignore les événements antérieurs à since et ceux d’autres types', async () => { /* login_succeeded, account_deleted à since − 1 s → absents */ });
it('consent_revoked ai_coach est ignoré dans le socle', async () => { /* liste avec consentType 'ai_coach' → { 0, 0 } */ });
```
`privacy-cli.test.ts` (dossier `dir` avec sentinelle `.appsport-volume`, `env = { APP_ORIGIN: 'https://appsport.test.ts.net', APPSPORT_DATA_DIR: dir }`, sorties capturées) :
```ts
it('privacy:collect écrit une PrivacyEventList ; --source lit une copie', async () => {
  expect(await runCli(['init'], env, out)).toBe(0);
  const h = openDatabase(join(dir, 'appsport.db'));
  await insertFixtureRow(h.db, 'security_event', { type: 'account_deleted', at: '2026-10-06T12:00:00.000Z', targetId: 'u-x', outcome: 'success' });
  await insertFixtureRow(h.db, 'security_event', { type: 'consent_revoked', at: '2026-10-06T12:01:00.000Z', targetId: 'u-y', outcome: 'success', details: JSON.stringify({ consentType: 'health' }) });
  h.sqlite.close(); copyFileSync(join(dir, 'appsport.db'), join(dir, 'copie.db'));
  for (const extra of [[], ['--source', join(dir, 'copie.db')]]) {
    expect(await runCli(['privacy:collect', '--since', '2026-10-06T00:00:00.000Z', ...extra, '--out', join(dir, 'l.json')], env, out)).toBe(0);
    const list = PrivacyEventList.parse(JSON.parse(readFileSync(join(dir, 'l.json'), 'utf8')));
    expect(list.events.map((e) => e.targetId)).toEqual(['u-x', 'u-y']);
  }
});
it('privacy:reapply affiche le résumé', async () => {
  expect(await runCli(['privacy:reapply', join(dir, 'l.json')], env, (l) => lines.push(l))).toBe(0);
  expect(lines).toContain('Réapplication terminée : 0 compte(s) supprimé(s), 0 accord(s) santé retiré(s).');
});
it('erreurs → code 1 : --since invalide, --out manquant, fichier de liste invalide', async () => { /* trois appels → 1 */ });
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- privacy/reapply cli/privacy-cli`
Attendu : `privacy/reapply` introuvable ; `runCli` renvoie 1 (« commande inconnue »).

- [ ] **Step 3: Implement**

- **collectPrivacyEvents** :
  - Sélection : `security_event WHERE type IN ('account_deleted','consent_revoked') AND outcome = 'success' AND at > since ORDER BY at, id`.
  - Champs : `targetId = target_id` ; `consentType` vient de `JSON.parse(details).consentType`, pour `consent_revoked` seulement.
- **reapplyPrivacyEvents** : une seule transaction `deps.db.transaction().execute(trx => ...)`, qui traite les événements dans l'ordre.
  - `account_deleted` : si le compte existe, `deleteAccount(trx, deps, targetId, { actorId: null, ip: null })` et `accountsDeleted++`.
  - `consent_revoked` avec `health` : si le compte existe et que `isHealthConsentActive(trx, targetId)`, `withdrawHealthConsent(trx, deps, targetId, { actorId: null, ip: null })` et `consentsWithdrawn++`.
  - `ai_coach` : ignoré. Aucun accord coach n'existe avant la brique 4.
  - Une erreur annule tout.
- **CLI** :
  - Ouverture de la base et construction des `AppDeps` par le même chemin que `admin:bootstrap`. Pour `--source`, `openDatabase(source)`.
  - `--since` non conforme à `z.iso.datetime()` donne le message « Date --since invalide (format ISO 8601 attendu) ».
  - `--out` manquant donne « Option --out obligatoire ».
  - L'écriture de `PrivacyEventList` se fait par `JSON.stringify(list, null, 2)`. Le champ `source` contient le chemin lu. Message de fin : `<n> événement(s) écrit(s) dans <fichier>`.
  - `privacy:reapply` : un fichier illisible ou un `PrivacyEventList` invalide donne « Fichier de réapplication invalide ». Sinon, la ligne exacte ci-dessus.
- **snapshotDb** : `import { backup } from 'node:sqlite'` puis `await backup(ctx.deps.sqlite, path)`.
- **restoreInPlace** : il opère sur `ctx.deps.sqlite`.
  1. `PRAGMA foreign_keys=OFF`, puis `ATTACH DATABASE ? AS snap`.
  2. `BEGIN`.
  3. Pour chaque table de `main.sqlite_schema` (`type='table'`, sans `sqlite_%`) : `DELETE FROM main."t"; INSERT INTO main."t" SELECT * FROM snap."t"`.
  4. `COMMIT`, `DETACH`, puis `PRAGMA foreign_keys=ON`.
  5. Retour de `rotateServerEpoch(ctx.deps.db, ctx.deps.ids)`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- privacy/reapply cli/privacy-cli` → vert.

- [ ] **Step 5: Commit**

`git add apps/server && git commit -m "feat(privacy): privacy:collect et privacy:reapply après restauration"`

---

### Task 25: Base locale Dexie et outbox

**Files:**
- Modify: `apps/web/package.json` (dépendance `dexie` 4.x ; devDependencies `fake-indexeddb` 6.x et `@appsport/server: workspace:*`, si elles sont absentes)
- Create: `apps/web/src/local-db/db.ts`, `apps/web/src/local-db/meta.ts`, `apps/web/src/local-db/wipe.ts`, `apps/web/src/local-db/consent.ts`
- Create: `apps/web/src/sync/outbox.ts`, `apps/web/src/sync/protocol-converters.ts`
- Create: `apps/web/test/support/local-db.ts`, `apps/web/test/fixtures/local-db/v1/dump.json`
- Test: `apps/web/test/local-db/db.test.ts`, `apps/web/test/local-db/wipe.test.ts`, `apps/web/test/local-db/frozen-v1.test.ts`, `apps/web/test/sync/outbox.test.ts`, `apps/web/test/sync/protocol-converters.test.ts`

**Interfaces:**
- Consumes : `entityRules`, `mirroredTables`, `EntityRulesMap`, `camelToSnake` (T5) ; `SyncOp`, `SYNC_PROTOCOL` (T20/T2) ; `MeResponse` (T10) ; `SYNC_FIXTURE_RULES` (`@appsport/server/testing`, T20).
- Produces : signatures du §6 de l'ossature (`LOCAL_DB_NAME`, `LOCAL_DB_VERSION`, `OutboxOp`, `DeadletterEntry`, `MirrorRow`, `STORE_SCHEMAS`, `AppDb`, `createAppDb`, `MetaValues`, `getMeta`, `setMeta`, `wipeUserData`, `LocalChange`, `writeLocal`, `pendingCount`), plus :
  ```ts
  // local-db/db.ts
  export const NON_MIRROR_STORES: readonly string[];   // ['meta','outbox','deadletter','exercises','illustrations','programTemplates','adviceSheets']
  export function mirrorStoreNames(db: AppDb): string[]; // db.tables hors NON_MIRROR_STORES (inclut extraMirrors)
  // local-db/meta.ts
  export async function deleteMeta(db: AppDb, k: keyof MetaValues): Promise<void>;
  export const USER_META_KEYS: readonly (keyof MetaValues)[]; // ['userId','watermark','serverEpoch','lastPullOkAt','activeSessionId','me']
  // local-db/wipe.ts
  export async function clearMirrors(db: AppDb): Promise<void>;                       // vide tous les miroirs (410 watermark_expired)
  export async function purgeHealthData(db: AppDb, rules?: EntityRulesMap): Promise<void>; // P-CST-3 étape 4
  // local-db/consent.ts
  export async function localHealthConsentActive(db: AppDb): Promise<boolean>;        // dernier consent_event health du miroir = grant
  // sync/outbox.ts
  export class HealthConsentRequiredError extends Error {}
  // sync/protocol-converters.ts
  export const OUTBOX_CONVERTERS: Readonly<Record<number, (op: OutboxOp) => OutboxOp>>;  // clé n = convertit vn → vn+1 ; {} en v1
  export function convertOutboxOp(op: OutboxOp, target?: number /* SYNC_PROTOCOL */): OutboxOp; // throw si un maillon manque
  // test/support/local-db.ts
  export const FIXTURE_MIRRORS: Record<string, string>;   // { fixture_note: 'id', fixture_note_item: 'id, noteId', fixture_c2_log: 'id' }
  export function createTestLocalDb(name?: string): AppDb;      // fake-indexeddb, nom unique par défaut
  export function createFixtureLocalDb(name?: string): AppDb;   // + FIXTURE_MIRRORS
  export async function loadFrozenLocalDb(version: number, name: string): Promise<void>;
  ```

**Spec:** 01 R-SYN-9 (client), R-SYN-11, R-SYN-12, R-SYN-13 (champ `serverRevSeen`), R-SYN-14 (support de `wipeUserData`), R-VER-4, R-VER-5 ; 03 P-CST-2, P-CST-3 étape 4, P-AUT-6 (étiquetage) ; 09 §7 ; 01 §9.1.4 (cohérence Zod, registre et Dexie).

- [ ] **Step 1: Write the failing test**

`apps/web/test/fixtures/local-db/v1/dump.json` (figé, ne jamais modifier une fois commité). `stores` contient la copie exacte de `STORE_SCHEMAS` v1, et `data` le contenu ci-dessous :
```json
{ "localDbVersion": 1, "protocol": 1, "stores": { "…": "copie de STORE_SCHEMAS v1" },
  "data": {
    "meta": [ { "key": "deviceId", "value": "0199b9a0-0000-7000-8000-000000000001" }, { "key": "userId", "value": "0199b9a0-0000-7000-8000-0000000000aa" },
              { "key": "watermark", "value": "0199b9a0-0000-7000-8000-0000000000e1:42" }, { "key": "serverEpoch", "value": "0199b9a0-0000-7000-8000-0000000000e1" },
              { "key": "protocol", "value": 1 } ],
    "outbox": [
      { "opId": "0199b9a1-0000-7000-8000-000000000001", "userId": "0199b9a0-0000-7000-8000-0000000000aa", "entity": "sync_rejection",
        "id": "0199b9a0-0000-7000-8000-0000000000b1", "kind": "patch", "fields": { "dismissedAt": "2026-10-06T09:00:00.000Z" },
        "clientTs": "2026-10-06T09:00:00.000Z", "protocol": 1, "attempts": 2 },
      { "opId": "0199b9a1-0000-7000-8000-000000000002", "userId": "0199b9a0-0000-7000-8000-0000000000aa", "entity": "sync_rejection",
        "id": "0199b9a0-0000-7000-8000-0000000000b2", "kind": "patch", "fields": { "dismissedAt": "2026-10-06T09:05:00.000Z" },
        "clientTs": "2026-10-06T09:05:00.000Z", "protocol": 1, "attempts": 0 } ],
    "sync_rejection": [ { "id": "0199b9a0-0000-7000-8000-0000000000b1", "ownerId": "0199b9a0-0000-7000-8000-0000000000aa", "rev": 41, "opId": "0199b9a1-0000-7000-8000-0000000000f1",
        "entity": "fixture_note", "rowId": "n1", "code": "validation", "detailJson": { "kind": "create", "fieldNames": ["title"], "reason": "sql_constraint" },
        "dismissedAt": "2026-10-06T09:00:00.000Z", "createdAt": "2026-10-05T10:00:00.000Z", "updatedAt": "2026-10-05T10:00:00.000Z",
        "updatedBy": "0199b9a0-0000-7000-8000-0000000000aa", "deletedAt": null, "serverRevSeen": 41 } ],
    "training_profile": [ { "id": "0199b9a0-0000-7000-8000-0000000000aa", "ownerId": "0199b9a0-0000-7000-8000-0000000000aa", "rev": 40, "goal": "muscle",
        "experience": "none", "daysPerWeek": 3, "sessionMinutes": 60, "sportCode": null, "sportOtherLabel": null, "cautiousMode": false,
        "createdAt": "2026-10-01T10:00:00.000Z", "updatedAt": "2026-10-01T10:00:00.000Z", "updatedBy": "0199b9a0-0000-7000-8000-0000000000aa",
        "deletedAt": null, "serverRevSeen": 40 } ] } }
```
`db.test.ts` :
```ts
it('les stores miroirs sont exactement mirroredTables(entityRules)', () => {
  const mirrors = Object.keys(STORE_SCHEMAS).filter((s) => !NON_MIRROR_STORES.includes(s)).sort();
  expect(mirrors).toEqual(mirroredTables(entityRules));
});
it('chaque colonne indexée d’un miroir existe dans le registre (camelCase)', () => {
  for (const t of mirroredTables()) for (const idx of STORE_SCHEMAS[t]!.split(',').map((s) => s.trim()).flatMap((s) => s.replace(/[[\]]/g, '').split('+')))
    expect(entityRules[t]!.columns.map(snakeToCamel), `${t}.${idx}`).toContain(idx);
});
it('createAppDb ouvre la version LOCAL_DB_VERSION sous le nom appsport', async () => {
  const db = createAppDb(); await db.open(); expect(db.name).toBe(LOCAL_DB_NAME); expect(db.verno).toBe(LOCAL_DB_VERSION); db.close(); await Dexie.delete(LOCAL_DB_NAME);
});
it('mirror(entity) lève une erreur pour une table inconnue', () => { expect(() => createTestLocalDb().mirror('nope')).toThrow(); });
it('setMeta / getMeta font l’aller-retour', async () => { /* setMeta(db, 'watermark', 'e:1') → getMeta === 'e:1' ; clé absente → undefined */ });
```
`outbox.test.ts` (base `createFixtureLocalDb()`, `ctx = { userId: 'u1', now: () => '2026-10-06T10:00:00.000Z', newOpId: seq, healthConsentActive: true, rules: SYNC_FIXTURE_RULES }`) :
```ts
it('writeLocal écrit la ligne et l’opération dans la même transaction', async () => {
  const op = await writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 't' } }, ctx);
  expect(await db.mirror('fixture_note').get('n1')).toEqual({ id: 'n1', ownerId: 'u1', title: 't', serverRevSeen: null, deletedAt: null, updatedAt: '2026-10-06T10:00:00.000Z' });
  expect(await db.outbox.get(op.opId)).toEqual({ ...op, userId: 'u1', protocol: 1, attempts: 0, clientTs: '2026-10-06T10:00:00.000Z' });
});
it('échec simulé (opId en double) → ni ligne ni opération', async () => {
  const fixed = () => '0199b9a1-0000-7000-8000-000000000009';
  await writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 'a' } }, { ...ctx, newOpId: fixed });
  await expect(writeLocal(db, { entity: 'fixture_note', id: 'n2', kind: 'create', fields: { title: 'b' } }, { ...ctx, newOpId: fixed })).rejects.toThrow();
  expect(await db.mirror('fixture_note').get('n2')).toBeUndefined(); expect(await db.outbox.count()).toBe(1);
});
it('opération invalide (Zod) → exception, rien d’écrit', async () => {
  await expect(writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 't' } }, { ...ctx, newOpId: () => 'pas-un-uuid' })).rejects.toThrow();
  expect(await db.outbox.count()).toBe(0); expect(await db.mirror('fixture_note').count()).toBe(0);
});
it('champ hors clientWritable ou entité non J → exception', async () => { /* fields { ownerId } ; entity 'training_profile' */ });
it('sans consentement : c2Columns retirées ; table C2 jamais écrite', async () => {
  const c = { ...ctx, healthConsentActive: false };
  const op = await writeLocal(db, { entity: 'fixture_note_item', id: 'i1', kind: 'create', fields: { noteId: 'n1', label: 'x', painNote: 'TEMOIN' } }, c);
  expect(op.fields).toEqual({ noteId: 'n1', label: 'x' }); expect(await db.mirror('fixture_note_item').get('i1')).not.toHaveProperty('painNote');
  await expect(writeLocal(db, { entity: 'fixture_c2_log', id: 'l1', kind: 'create', fields: { value: 1 } }, c)).rejects.toBeInstanceOf(HealthConsentRequiredError);
  expect(await db.mirror('fixture_c2_log').count()).toBe(0); expect(JSON.stringify(await db.outbox.toArray())).not.toContain('TEMOIN');
});
it('patch fusionne, delete pose deletedAt', async () => { /* create puis patch { body } puis delete → ligne { title, body, deletedAt: now } ; 3 ops */ });
it('outbox étiquetée par userId ; pendingCount compte par utilisateur', async () => {
  /* 2 ops u1 + 1 op u2 → pendingCount(db,'u1') === 2, pendingCount(db,'u2') === 1 */
});
```
`wipe.test.ts` :
```ts
it('wipeUserData(keepOutbox: true) vide miroirs et meta utilisateur, garde outbox, deadletter, deviceId et catalogue', async () => { /* … */ });
it('wipeUserData(keepOutbox: false) vide aussi outbox et deadletter', async () => { /* … */ });
it('clearMirrors vide les miroirs et rien d’autre', async () => { /* outbox, meta et exercises intacts */ });
it('purgeHealthData : tables C2 vidées, c2Columns à null, ops C2 retirées de l’outbox', async () => {
  /* miroir fixture_c2_log 1 ligne ; item { painNote: 'TEMOIN' } ; outbox : create fixture_c2_log + create item avec painNote */
  await purgeHealthData(db, SYNC_FIXTURE_RULES);
  expect(await db.mirror('fixture_c2_log').count()).toBe(0); expect((await db.mirror('fixture_note_item').get('i1'))!.painNote).toBeNull();
  const ops = await db.outbox.toArray(); expect(ops.map((o) => o.entity)).toEqual(['fixture_note_item']); expect(ops[0]!.fields).not.toHaveProperty('painNote');
});
it('localHealthConsentActive suit le dernier événement health du miroir', async () => { /* aucun → false ; grant → true ; grant puis withdraw → false */ });
```
`frozen-v1.test.ts` (R-VER-5) :
```ts
it('la base figée v1 se rouvre avec LOCAL_DB_VERSION et l’outbox se relit à l’identique', async () => {
  await loadFrozenLocalDb(1, 'frozen-v1');
  const dump = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/local-db/v1/dump.json'), 'utf8'));
  const db = createAppDb('frozen-v1'); await db.open(); expect(db.verno).toBe(LOCAL_DB_VERSION);
  expect(await db.outbox.orderBy('opId').toArray()).toEqual(dump.data.outbox.map((op) => convertOutboxOp(op)));
  for (const store of ['sync_rejection', 'training_profile']) expect(await db.mirror(store).toArray()).toEqual(dump.data[store]);
  expect(await getMeta(db, 'watermark')).toBe('0199b9a0-0000-7000-8000-0000000000e1:42');
});
```
`protocol-converters.test.ts` :
```ts
it('la chaîne de convertisseurs couvre toutes les versions depuis la v1', () => {
  for (let p = 1; p < SYNC_PROTOCOL; p++) expect(OUTBOX_CONVERTERS[p], `convertisseur v${p} → v${p + 1}`).toBeTypeOf('function');
});
it('convertOutboxOp amène une op v1 au protocole courant', () => {
  const op = { /* op v1 du dump */ protocol: 1 } as OutboxOp; expect(convertOutboxOp(op).protocol).toBe(SYNC_PROTOCOL);
});
it('convertOutboxOp lève une erreur si un maillon manque', () => { expect(() => convertOutboxOp({ ...op, protocol: 1 }, 3)).toThrow(/v2/); });
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- local-db sync/outbox sync/protocol-converters`
Attendu : modules `src/local-db/*` introuvables.

- [ ] **Step 3: Implement**

- **AppDb** (`class AppDb extends Dexie`) :
  - Constructeur : `this.version(LOCAL_DB_VERSION).stores({ ...STORE_SCHEMAS, ...extraMirrors })`. Les versions suivantes ajouteront `.upgrade(tx => tx.table('outbox').toCollection().modify(op => Object.assign(op, convertOutboxOp(op))))`.
  - `mirror(entity)` renvoie `this.table(entity)`, qui lève une erreur Dexie si la table est inconnue.
  - `createAppDb(name = LOCAL_DB_NAME, opts)`.
- **writeLocal** : `rules = ctx.rules ?? entityRules` et `rule = rules[change.entity]`.
  - **Contrôles** :
    - `rule?.syncClass !== 'J'` lève `Error('entity_not_journal')` ;
    - une clé de `fields` dont `camelToSnake` n'est pas dans `clientWritable` lève `Error('field_not_writable:<clé>')` ;
    - `!healthConsentActive && rule.category === 'C2'` lève `HealthConsentRequiredError` ;
    - sinon, sans consentement, les clés C2 sont retirées.
  - **Opération** : `op = SyncOp.parse({ opId: newOpId(), userId, entity, id, kind, fields, clientTs: now(), protocol: SYNC_PROTOCOL, attempts: 0 })`.
  - **Transaction** `db.transaction('rw', db.outbox, db.mirror(entity), ...)` :
    - `create` : `put({ ...fields, id, ownerId: userId, serverRevSeen: null, deletedAt: null, updatedAt: now })` ;
    - `patch` : fusion avec la ligne existante et `updatedAt`. Une ligne absente lève `Error('row_missing')` ;
    - `delete` : `deletedAt = updatedAt = now` ;
    - puis `outbox.add(op)`.
- **wipeUserData** : vide `mirrorStoreNames(db)` et supprime les `USER_META_KEYS`. Si `!keepOutbox`, vide aussi `outbox` (toutes les opérations) et `deadletter`.
- **purgeHealthData** : une transaction sur les miroirs et l'outbox.
  - Les miroirs des tables `category === 'C2'` sont vidés (`clear`).
  - Dans les autres miroirs, les champs `c2Columns` (en camelCase) passent à `null`.
  - Les opérations sur une table C2 sont supprimées de l'outbox. Dans les autres, les clés C2 sont retirées de `fields`.
- **localHealthConsentActive** : `mirror('consent_event').where('[type+createdAt]').between(['health', Dexie.minKey], ['health', Dexie.maxKey]).last()`, puis `action === 'grant'`.
- **convertOutboxOp** : applique `OUTBOX_CONVERTERS[p]` pour `p` allant de `op.protocol` à `target − 1`. Un maillon absent lève `Error('outbox converter missing: v<p> → v<p+1>')`.
- **test/support/local-db.ts** : `import 'fake-indexeddb/auto'`, avec un compteur de noms uniques `test-db-<n>`. `loadFrozenLocalDb` lit `test/fixtures/local-db/v<version>/dump.json`, ouvre `new Dexie(name)` avec `version(dump.localDbVersion).stores(dump.stores)`, fait un `bulkPut` de chaque store, puis `close()`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- local-db sync/outbox sync/protocol-converters` → vert ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(synchro): base locale Dexie, outbox transactionnelle et jeu figé v1"`

---

### Task 26: Moteur de synchro client

**Files:**
- Create: `apps/web/src/sync/transport.ts`, `apps/web/src/sync/apply-pull.ts`, `apps/web/src/sync/engine.ts`, `apps/web/src/sync/triggers.ts`, `apps/web/src/sync/catalog.ts`
- Test: `apps/web/test/sync/transport.test.ts`, `apps/web/test/sync/apply-pull.test.ts`, `apps/web/test/sync/engine.test.ts`, `apps/web/test/sync/engine-epoch.test.ts`, `apps/web/test/sync/catalog.test.ts`, `apps/web/test/sync/triggers.test.ts`

**Interfaces:**
- Consumes : T25 (tout `local-db/*`, `writeLocal`, `pendingCount`, `clearMirrors`, `purgeHealthData`, `localHealthConsentActive`, `createFixtureLocalDb`) ; T20/T21 (`PushResponse`, `PullResponse`, `PulledRow`, `SyncOp`, `PROTOCOL_HEADER`, `EPOCH_HEADER`, `SYNC_*`, `EPOCH_RESEND_DAYS`, `COACH_FLUSH_MS`) ; `HealthResponse` (T6) ; `CatalogBundle` (T23) ; `createMonotonicUuidV7` (T2) ; `SYNC_FIXTURE_RULES` (T20).
- Produces : signatures du §6 de l'ossature (`SyncTransport`, `browserTransport`, `fetchWithTimeout`, `OfflineError`, `ConnectionState`, `SyncTrigger`, `SyncState`, `SyncEngine`, `createSyncEngine`, `applyPulledRows`, `refreshCatalog`), plus :
  ```ts
  // sync/engine.ts
  export function retryDelayMs(failures: number): number;   // min(SYNC_RETRY_MIN_MS * 2 ** (failures - 1), SYNC_RETRY_MAX_MS)
  // sync/triggers.ts
  export function installSyncTriggers(engine: SyncEngine, env?: { doc?: Document; win?: Window }): () => void; // renvoie la désinstallation
  ```

**Spec:** 01 R-SYN-9 (client), R-SYN-12, R-SYN-13, R-SYN-18 (deadletter), R-SYN-22, R-SYN-23 (client), R-SYN-24, R-SYN-26, R-SYN-29, R-SYN-30, R-SYN-32 (texte), R-VER-2 (client) ; 03 P-DRT-4, P-CST-3 étape 4, P-CST-4 ; 04 §11 (ETag) ; Review Focus 2 (ordre client) et 3 (client).

- [ ] **Step 1: Write the failing test**

Fichiers en `// @vitest-environment node`, sauf `triggers.test.ts` (happy-dom). Faux transport local à chaque fichier : `fake(handler)` renvoie `{ fetch, calls: { path, method, body }[] }`, et les réponses portent `X-Appsport-Epoch: E1`. Minuteurs : `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })` ; ne jamais simuler `setImmediate` ni `queueMicrotask`, qu'utilise fake-indexeddb.

`transport.test.ts` :
```ts
it('fetchWithTimeout : délai de 4 s → OfflineError', async () => {
  const t = { fetch: (_p, init) => new Promise<Response>((_, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')))) };
  const p = fetchWithTimeout(t, '/api/health', {}); vi.advanceTimersByTime(4000); await expect(p).rejects.toBeInstanceOf(OfflineError);
});
it('toute erreur réseau (TypeError) → OfflineError ; une réponse 500 est renvoyée telle quelle', async () => { /* … */ });
```
`apply-pull.test.ts` :
```ts
it('écrit la ligne serveur avec serverRevSeen = rev', async () => { /* row → miroir { ...row, serverRevSeen: 7 } */ });
it('rebase R-SYN-22 : ligne serveur puis patchs locaux en attente rejoués', async () => {
  await writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 'a', body: 'b' } }, ctx);
  await writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'patch', fields: { body: 'local' } }, ctx);
  await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: { id: 'n1', ownerId: 'u1', title: 'serveur', body: 'b', deletedAt: null, rev: 9, updatedAt: '2026-10-06T11:00:00.000Z' } }]);
  expect(await db.mirror('fixture_note').get('n1')).toMatchObject({ title: 'serveur', body: 'local', serverRevSeen: 9 });
});
it('un delete en attente garde la ligne supprimée localement', async () => { /* deletedAt reste posé */ });
it('une tombstone serveur sans contenu remplace la copie locale', async () => { /* fixture_c2_log { id, deletedAt, value: null } */ });
it('une entité sans miroir est ignorée', async () => { /* entity 'future_table' → pas d'erreur */ });
```
`engine.test.ts` (base `createFixtureLocalDb()`, `meta.userId = 'u1'`, `meta.serverEpoch = 'E1'`, `rules: SYNC_FIXTURE_RULES`) :
```ts
it('cycle : health puis push puis pull ; envoie dans l’ordre des opId, 200 au plus par lot', async () => {
  /* 450 ops u1 dans l'outbox */ await engine.syncNow('manual');
  expect(calls.map((c) => `${c.method} ${c.path.split('?')[0]}`)).toEqual(['GET /api/health', 'POST /api/sync/push', 'POST /api/sync/push', 'POST /api/sync/push', 'GET /api/sync/pull']);
  const sent = calls.filter((c) => c.path === '/api/sync/push').map((c) => c.body.ops);
  expect(sent.map((o) => o.length)).toEqual([200, 200, 50]); const flat = sent.flat().map((o) => o.opId); expect(flat).toEqual([...flat].sort());
  expect(calls[1].headers['X-Appsport-Protocol']).toBe('1');
});
it('n’envoie jamais les opérations d’un autre userId (P-AUT-6)', async () => { /* ops u2 présentes → aucune dans les corps envoyés ; toujours dans l'outbox */ });
it('une op ne quitte l’outbox qu’après accusé, serverRevSeen enregistré', async () => {
  /* push renvoie applied rev 12 pour op1, et rien pour op2 → op1 retirée, miroir serverRevSeen 12 ; op2 gardée */
});
it('rejected → deadletter { opId, userId, entity, id, code, detail: { kind, fieldNames }, receivedAt }, retirée de l’outbox', async () => { /* … */ });
it('applied_partial dropped → copie locale supprimée ; droppedFields → champs locaux à null', async () => {
  /* item painNote 'TEMOIN-C2-7f3a' → droppedFields ['painNote'] ; log → dropped: true */
  expect(await db.mirror('fixture_c2_log').get(logId)).toBeUndefined(); expect((await db.mirror('fixture_note_item').get(itemId))!.painNote).toBeNull();
  for (const t of db.tables) expect(JSON.stringify(await t.toArray())).not.toContain('TEMOIN-C2-7f3a');
});
it('401 → unauthenticated, outbox intacte, aucune reprise programmée', async () => { /* getState().connection === 'unauthenticated' ; vi.getTimerCount() === 0 après start() + stop() du minuteur d'intervalle */ });
it('410 account_deleted → wipe complet + onAccountDeleted, état account_deleted', async () => {
  /* outbox, deadletter et miroirs vides ; meta.userId absente ; callback appelé 1 fois ; syncNow suivant → aucun appel */
});
it('410 watermark_expired → miroirs vidés, outbox gardée, pull complet sans since', async () => {
  /* 1er pull ?since=E1:5 → 410 {error:'watermark_expired'} ; 2e pull sans since → 200 ; outbox inchangée */
});
it('410 avec un autre code n’efface rien', async () => { /* {error:'gone'} → miroirs et outbox intacts */ });
it('426 → protocol_unsupported, outbox intacte', async () => { /* … */ });
it('délai de 4 s → offline, syncNow ne rejette pas ; reprises à 2 s, 4 s, 8 s', async () => {
  engine.start(); /* transport qui ne répond jamais */ await vi.advanceTimersByTimeAsync(4000);
  expect(engine.getState().connection).toBe('offline');
  /* compter les GET /api/health : +1 à 4000 + 2000, +1 encore après 4000 + 4000 */
});
it('retryDelayMs', () => {
  expect([1, 2, 3, 8, 9, 20].map(retryDelayMs)).toEqual([2000, 4000, 8000, 256000, 300000, 300000]);
});
it('chaque pull met à jour watermark, lastPullOkAt et serverCatalogVersion ; hasMore enchaîne les pages', async () => { /* … */ });
it('pull qui apporte consent_event health/withdraw → purgeHealthData', async () => { /* ops C2 retirées de l'outbox */ });
it('flushBefore(4000) rend la main en 4 s au plus, sans exception', async () => { /* transport bloqué → résolu à 4000 ms */ });
it('syncNow concurrent : un seul cycle en vol, un second enchaîné', async () => { /* 2 appels → 2 GET /api/health, jamais simultanés */ });
it('état : pending et rejected tenus à jour, subscribe notifié', async () => {
  /* rejected = |opIds deadletter(u1) ∪ opIds sync_rejection non ignorés et non supprimés| */
});
```
`engine-epoch.test.ts` (Review Focus 2, client) :
```ts
it('nouvelle époque : pause, restore_upsert des lignes J de moins de 60 j (sauf sync_rejection), reprise, puis pull complet', async () => {
  // miroir : n10 (updatedAt il y a 10 j, serverRevSeen 5), n70 (il y a 70 j), tombstone t5 (il y a 5 j), une ligne sync_rejection ; outbox : 1 patch en attente
  // health renvoie { epoch: 'E2' } ; meta.serverEpoch = 'E1'
  await engine.syncNow('launch');
  const pushes = calls.filter((c) => c.path === '/api/sync/push');
  expect(pushes[0].body.ops.map((o) => [o.kind, o.id])).toEqual([['restore_upsert', 'n10'], ['restore_upsert', 't5']].sort(...)); // ordre libre, comparer en ensemble
  expect(pushes[0].body.ops.find((o) => o.id === 'n10')).toMatchObject({ serverRevSeen: 5, fields: { title: expect.any(String), deletedAt: null } });
  expect(pushes[0].body.ops.find((o) => o.id === 't5').fields.deletedAt).not.toBeNull();
  expect(pushes[1].body.ops.map((o) => o.kind)).toEqual(['patch']);
  const pull = calls.find((c) => c.path.startsWith('/api/sync/pull')); expect(pull.path).not.toContain('since=');
  expect(calls.indexOf(pull)).toBeGreaterThan(calls.indexOf(pushes[1]));
  expect(await getMeta(db, 'serverEpoch')).toBe('E2');
});
it('restore_upsert interrompu (hors ligne) : l’époque locale reste E1, l’outbox est intacte et tout est rejoué au cycle suivant', async () => { /* … */ });
it('restore_upsert sans consentement local : tables C2 exclues, c2Columns retirées', async () => { /* … */ });
it('première prise de contact (serverEpoch absent) : enregistre l’époque sans restore_upsert', async () => { /* … */ });
```
`catalog.test.ts` :
```ts
it('envoie If-None-Match "<catalogVersion>" ; 304 → unchanged', async () => { /* … */ });
it('200 → stores du catalogue remplacés en entier, catalogVersion = serverCatalogVersion = version → updated', async () => { /* … */ });
it('un SW contrôle la page → postMessage { type: "SYNC_ILLUSTRATIONS", files }', async () => {
  /* globalThis.navigator.serviceWorker = { controller: { postMessage: spy } } → spy appelé avec les fichiers du bundle */
});
it('après un pull où serverCatalogVersion ≠ catalogVersion, le moteur appelle /api/catalog', async () => { /* … */ });
```
`triggers.test.ts` (happy-dom) :
```ts
it('visibilitychange vers visible → syncNow("foreground") ; événement online → syncNow("online")', () => { /* moteur espion */ });
it('toutes les 60 s : syncNow("interval") seulement si visible et pending > 0', async () => { /* advanceTimersByTime(60000) × 3 */ });
it('l’état de connexion ne lit jamais navigator.onLine', async () => {
  const spy = vi.spyOn(navigator, 'onLine', 'get'); /* cycle complet en ligne puis hors ligne */ expect(spy).not.toHaveBeenCalled();
});
it('set_logged regroupe les appels à 2 s', async () => { /* 3 appels en 1 s → un seul cycle à +2000 ms */ });
it('la fonction renvoyée retire les écouteurs et l’intervalle', () => { /* … */ });
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- sync/transport sync/apply-pull sync/engine sync/catalog sync/triggers`
Attendu : modules introuvables.

- [ ] **Step 3: Implement**

- `browserTransport(baseUrl = '')` : `fetch(baseUrl + path, { ...init, credentials: 'same-origin' })`. `fetchWithTimeout` : `AbortController` et `setTimeout(timeoutMs = SYNC_TIMEOUT_MS)`. Toute exception de `t.fetch` est convertie en `OfflineError`.
- **applyPulledRows** : une transaction `rw` sur l'outbox et les miroirs présents. Pour chaque ligne dont le store existe :
  - `merged = { ...row, serverRevSeen: rev }` ;
  - puis, pour chaque opération en attente sur `[entity+id]`, dans l'ordre des `opId` :
    - `create`, `patch` ou `restore_upsert` : `Object.assign(merged, fields)` ;
    - `delete` : `merged.deletedAt = op.clientTs` ;
  - enfin `put(merged)`.
- **Moteur** (`createSyncEngine`) :
  - **Dépendances** : `now` (par défaut `Date.now`), `newOpId` (par défaut `createMonotonicUuidV7(now, n => crypto.getRandomValues(new Uint8Array(n)))`) et `rules` (par défaut `entityRules`).
  - **Concurrence** : un seul cycle en vol. Un `syncNow` pendant un cycle programme un seul cycle supplémentaire.
  - **Arrêts** : `connection === 'account_deleted'`, `stop()` appelé ou `meta.userId` absent, alors `syncNow` ne fait rien.
  - Les en-têtes `X-Appsport-Protocol: SYNC_PROTOCOL` et `Content-Type: application/json` sont envoyés sur `/api/sync/*`.
  - **Cycle**, à suivre dans l'ordre :
```ts
// 1. GET /api/health (fetchWithTimeout) → HealthResponse ; OfflineError → connection 'offline', failures++, reprise programmée (si start()), fin.
//    5xx → failures++, reprise, fin (connection inchangée). Succès → connection 'online', failures = 0.
// 2. Époque : e = health.epoch. Si meta.serverEpoch absente → setMeta(serverEpoch, e). Si différente :
//    a. paused = true ; consent = await localHealthConsentActive(db)
//    b. lignes = miroirs des tables rules[t].syncClass === 'J' && t !== 'sync_rejection', ownerId === userId, updatedAt >= iso(now − EPOCH_RESEND_DAYS j)
//       (exclure les tables C2 et retirer les c2Columns si !consent) ;
//       ops = { opId: newOpId(), userId, entity, id, kind: 'restore_upsert', fields: clientWritable (camelCase) présents + deletedAt,
//               clientTs, protocol: SYNC_PROTOCOL, attempts: 0, serverRevSeen: ligne.serverRevSeen } — jamais écrites dans l'outbox
//    c. envoi par lots de SYNC_PUSH_MAX ; traitement des résultats comme en 3 (sans toucher l'outbox) ; un échec arrête le cycle SANS changer meta.serverEpoch
//    d. setMeta(serverEpoch, e) ; deleteMeta(watermark) ; paused = false
// 3. Push : tant que l'outbox de userId n'est pas vide : 200 ops triées par opId (attempts++ avant l'envoi) → POST /api/sync/push.
//    applied | applied_partial | duplicate → outbox.delete(opId) ; rev → miroir.serverRevSeen = rev ; droppedFields → champs locaux à null ;
//    dropped → miroir.delete(id) ; rejected → deadletter.put({ opId, userId, entity, id, code, detail: { kind, fieldNames: Object.keys(fields).sort() }, receivedAt }) + outbox.delete.
// 4. Pull : since = meta.watermark ; boucle GET /api/sync/pull?since=&limit=500 jusqu'à hasMore = false : applyPulledRows ;
//    setMeta(watermark, nextWatermark) ; catalogVersion non nul → setMeta(serverCatalogVersion) ; si le lot contient un consent_event
//    type health et que localHealthConsentActive est faux → purgeHealthData(db, rules). Fin → setMeta(lastPullOkAt, iso(now())).
// 5. Si serverCatalogVersion !== catalogVersion → refreshCatalog(db, transport) (erreur avalée, réessayée au cycle suivant).
// Statuts, à toute étape : 401 ou 403 → 'unauthenticated' (pause, aucune reprise programmée) ; 410 → lire body.error :
//   'account_deleted' → wipeUserData({ keepOutbox: false }), connection 'account_deleted', onAccountDeleted?.() ;
//   'watermark_expired' → clearMirrors(db), deleteMeta(watermark), un seul nouveau pull complet ; autre code → rien n'est effacé, fin du cycle ;
//   426 → 'protocol_unsupported', fin ; en-tête X-Appsport-Epoch d'une réponse ≠ époque connue → fin du cycle et nouveau cycle immédiat.
```
  - **Reprises** : `retryDelayMs(failures)`, seulement après `start()`. `stop()` les annule.
  - `start()` lance `syncNow('launch')`.
  - `pullNow()` exécute le cycle sans l'étape 3. `flushBefore(ms)` fait un `Promise.race` entre `syncNow('coach')` et un délai de `ms`, sans jamais rejeter.
  - **État** : `pending = pendingCount(db, userId)`. `rejected` est le nombre d'`opId` distincts dans la deadletter de l'utilisateur et dans les lignes `sync_rejection` qui ont `dismissedAt` et `deletedAt` nuls. `serverEpoch` et `lastPullOkAt` viennent de meta. `subscribe` est notifié à chaque changement.
- **triggers** : écoute `visibilitychange` (passage à `visible` donne `foreground`) et `online`. Un `setInterval` de `SYNC_INTERVAL_MS` appelle `syncNow('interval')` si la page est visible et `getState().pending > 0`. Le déclencheur `set_logged` est regroupé par un minuteur de `SYNC_DEBOUNCE_MS`, via un `syncNow` enveloppé. `navigator.onLine` n'est jamais lu.
- **refreshCatalog** :
  - Envoie `GET /api/catalog` avec `If-None-Match: "<catalogVersion>"` si la version locale existe.
  - `304` : `'unchanged'`.
  - `200` : `CatalogBundle.parse`, et chaque élément de `exercises`, `programTemplates` et `adviceSheets` doit valider `z.looseObject({ id: z.string() })`. Dans une transaction, les 4 stores du catalogue sont vidés puis remplis par `bulkPut`, et `setMeta(catalogVersion)` et `setMeta(serverCatalogVersion)` reçoivent `version`. Si `navigator.serviceWorker?.controller` existe, `postMessage({ type: 'SYNC_ILLUSTRATIONS', files: illustrations.map(i => i.file) })`. Résultat `'updated'`.
  - Autre statut : `Error('catalog_http_<status>')`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- sync` → vert ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(synchro): moteur client (push, pull, époque, reprises, catalogue)"`

---

### Task 27: Convergence sur deux appareils et scénarios ciblés

**Files:**
- Create: `apps/web/test/support/in-process-transport.ts`, `apps/web/test/support/lossy-transport.ts`
- Test: `apps/web/test/sync/convergence.test.ts`, `apps/web/test/sync/scenarios.test.ts` (les deux en `// @vitest-environment node`)
- Modify: `apps/web/package.json` (devDependency `fast-check` 4.x si absente)

**Interfaces:**
- Consumes : `createSyncTestContext`, `SYNC_FIXTURE_RULES`, `createUserAndLogin`, `snapshotDb`, `restoreInPlace`, `dumpDatabase`, `createLogger`, `grantConsent` (via `@appsport/server/testing` et `@appsport/server`) ; T25 (`createFixtureLocalDb`, `writeLocal`, `setMeta`, `pendingCount`, `localHealthConsentActive`) ; T26 (`createSyncEngine`, `SyncTransport`).
- Produces :
  ```ts
  // apps/web/test/support/in-process-transport.ts
  export function inProcessTransport(ctx: TestContext, getCookie: () => string): SyncTransport & { log: { method: string; path: string; body: unknown }[] };
  // apps/web/test/support/lossy-transport.ts
  export interface LossyOptions { seed: number; dropRate: number; dupRate: number; maxDelayMs: number; reorder: boolean }
  export function lossyTransport(inner: SyncTransport, opts: LossyOptions): SyncTransport & { heal(): void; stats: { dropped: number; duplicated: number; replayedLate: number } };
  ```

**Spec:** 01 §9.1.2 (convergence, aucune perte ni doublon, rejet visible, 401, 410, changement d'époque, retrait de consentement concurrent), R-SYN-12, R-SYN-26, R-SYN-27, R-SYN-9 ; 03 §17 n°3 et n°11, P-AUT-6, P-CST-4 ; Review Focus 2 et 3 (bout en bout).

- [ ] **Step 1: Write the failing test**

`convergence.test.ts` :
```ts
const cmd = (dev: fc.Arbitrary<0 | 1>) => fc.oneof(
  fc.record({ t: fc.constant('createNote'), dev, title: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 20 })) }),
  fc.record({ t: fc.constant('patchNote'), dev, pick: fc.nat(), title: fc.string({ minLength: 1, maxLength: 20 }) }),
  fc.record({ t: fc.constant('deleteNote'), dev, pick: fc.nat() }),
  fc.record({ t: fc.constant('createItem'), dev, pick: fc.nat(), label: fc.string({ minLength: 1, maxLength: 20 }) }),
  fc.record({ t: fc.constant('sync'), dev }));
it.each([
  { seed: 20261006, dropRate: 0.3, dupRate: 0.2, maxDelayMs: 3, reorder: false },
  { seed: 7, dropRate: 0.2, dupRate: 0.4, maxDelayMs: 3, reorder: true },
])('deux appareils convergent malgré pertes, doublons, retards et réordonnancements (%o)', async (opts) => {
  await fc.assert(fc.asyncProperty(fc.array(cmd(fc.constantFrom(0, 1)), { minLength: 5, maxLength: 40 }), async (cmds) => {
    const ctx = await createSyncTestContext(); const u = await createUserAndLogin(ctx);
    const devs = [0, 1].map((i) => { const db = createFixtureLocalDb(); const t = lossyTransport(inProcessTransport(ctx, () => u.cookie), { ...opts, seed: opts.seed + i });
      return { db, t, engine: createSyncEngine({ db, transport: t, rules: SYNC_FIXTURE_RULES }) }; });
    for (const d of devs) await setMeta(d.db, 'userId', u.id);
    const createdItems: string[] = [];
    /* exécuter cmds : writeLocal sur les notes non supprimées du miroir de l'appareil (pick % n) ; 'sync' → engine.syncNow('manual') */
    for (const d of devs) d.t.heal();
    for (let round = 0; round < 10; round++) { for (const d of devs) await d.engine.syncNow('manual');
      if ((await Promise.all(devs.map((d) => pendingCount(d.db, u.id)))).every((n) => n === 0)) break; }
    for (const d of devs) await d.engine.pullNow();
    const server = (t: string) => ctx.deps.sqlite.prepare(`SELECT * FROM ${t} WHERE owner_id = ?`).all(u.id) as any[];
    const shape = (rows: any[], cols: string[]) => Object.fromEntries(rows.map((r) => [r.id, cols.map((c) => r[c] ?? null)]));
    for (const d of devs) {
      expect(shape(await d.db.mirror('fixture_note').toArray(), ['title', 'body', 'deletedAt'])).toEqual(shape(server('fixture_note').map(rowToCamel), ['title', 'body', 'deletedAt']));
      expect(shape(await d.db.mirror('fixture_note_item').toArray(), ['noteId', 'label', 'deletedAt'])).toEqual(shape(server('fixture_note_item').map(rowToCamel), ['noteId', 'label', 'deletedAt']));
      expect(await pendingCount(d.db, u.id)).toBe(0);
    }
    const rejectedRowIds = new Set(server('sync_rejection').map((r) => r.row_id));
    expect(new Set(server('fixture_note_item').map((r) => r.id))).toEqual(new Set(createdItems.filter((id) => !rejectedRowIds.has(id))));
    const serverRejections = server('sync_rejection').map((r) => r.id).sort();
    for (const d of devs) expect((await d.db.mirror('sync_rejection').toArray()).map((r) => r.id).sort()).toEqual(serverRejections);
    const serverOpIds = new Set(server('sync_rejection').map((r) => r.op_id));
    for (const d of devs) for (const dl of await d.db.deadletter.toArray()) expect(serverOpIds.has(dl.opId)).toBe(true);
    ctx.close();
  }), { seed: opts.seed, numRuns: 25, endOnFailure: true });
}, 120_000);
```
`scenarios.test.ts` :
```ts
it('401 puis reconnexion du même utilisateur : outbox intacte puis vidée', async () => {
  let cookie = 'dev-session=invalide'; /* écrire 3 notes ; syncNow → connection 'unauthenticated', pendingCount 3 ;
  cookie = u.cookie ; syncNow('set_logged') → pendingCount 0, 3 fixture_note au serveur */
});
it('l’outbox de A n’est jamais envoyée sous la session de B (03 §17 n°11)', async () => {
  /* appareil : meta.userId = A, 2 ops A en attente ; puis meta.userId = B et cookie de B ; syncNow */
  expect(t.log.filter((r) => r.path === '/api/sync/push').flatMap((r) => (r.body as any).ops).some((o) => o.userId === a.id)).toBe(false);
  expect(ctx.deps.sqlite.prepare('SELECT count(*) c FROM fixture_note').get()).toEqual({ c: 0 }); expect(await pendingCount(db, a.id)).toBe(2);
});
it('changement d’époque avec appareil en retard : aucune perte, aucune régression (R-SYN-26/27)', async () => {
  // A et B (même utilisateur) synchronisés sur E1. A crée n1 « avant » → sync ; B sync.
  // snapshotDb(ctx, S). A patche n1 title « apres-S » et crée n2 → sync ; B pull (B voit « apres-S », serverRevSeen r2).
  // restoreInPlace(ctx, S) → E2 (n1 « avant », n2 absent). B patche localement n1 body « B-hors-ligne » (en attente).
  // A sync : restore_upsert remplace n1 par « apres-S » et réinsère n2 ; puis A patche n1 title « final-A » → sync (rev > epoch_base_rev).
  // B sync : avant l'envoi, pendingCount(B) === 1 ; ordre des requêtes de B :
  expect(seq).toEqual(['GET /api/health', 'POST /api/sync/push:restore_upsert', 'POST /api/sync/push:patch', 'GET /api/sync/pull']);
  expect(pullOfB.path).not.toContain('since=');
  const n1 = ctx.deps.sqlite.prepare('SELECT title, body FROM fixture_note WHERE id = ?').get(n1Id);
  expect(n1).toEqual({ title: 'final-A', body: 'B-hors-ligne' }); /* n2 présent ; après A.pullNow(), miroirs de A et B identiques au serveur */
});
it('retrait du consentement santé pendant que B a des opérations C2 en attente : aucune valeur témoin nulle part', async () => {
  const lines: string[] = [];
  const ctx = await createSyncTestContext({ deps: { logger: createLogger((l) => lines.push(l)) } });
  // u avec consentement (POST /api/me/consents) ; A et B synchronisés (consent_event grant dans les miroirs).
  // B hors ligne : note n, item { painNote: 'TEMOIN-C2-7f3a' }, fixture_c2_log { value: 987654 } (healthConsentActive: true).
  // A : POST /api/me/consents/withdraw { type: 'health', password } puis A.pullNow().
  // B.syncNow : push → item applied_partial ['painNote'], log applied_partial dropped:true ; pull → purgeHealthData.
  expect(ctx.deps.sqlite.prepare('SELECT count(*) c FROM sync_rejection').get()).toEqual({ c: 0 });
  const dump = dumpDatabase(ctx.deps.sqlite);
  for (const w of ['TEMOIN-C2-7f3a', '987654']) {
    expect(dump).not.toContain(w); expect(lines.join('\n')).not.toContain(w);
    for (const db of [dbA, dbB]) for (const t of db.tables) expect(JSON.stringify(await t.toArray())).not.toContain(w);
  }
  expect(await dbB.deadletter.count()).toBe(0); expect(await dbB.mirror('fixture_c2_log').count()).toBe(0);
});
it('variante : B tire le retrait avant de pousser → ses ops C2 sont purgées avant l’envoi', async () => {
  /* B.pullNow() d'abord, puis B.syncNow() */
  expect(JSON.stringify(tB.log)).not.toContain('TEMOIN-C2-7f3a'); expect(JSON.stringify(tB.log)).not.toContain('987654');
});
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- sync/convergence sync/scenarios`
Attendu : `in-process-transport` et `lossy-transport` introuvables.

- [ ] **Step 3: Implement**

- `inProcessTransport` :
  - `fetch(path, init)` : `headers = new Headers(init.headers)`, `headers.set('cookie', getCookie())` et `headers.set('origin', ctx.deps.config.appOrigin)`.
  - Renvoie `ctx.app.request(path, { ...init, headers })`.
  - Ajoute `{ method, path, body: JSON.parse(init.body ?? 'null') }` à `log`.
- `lossyTransport` : générateur `mulberry32(seed)`, local au fichier. À chaque appel, dans cet ordre :
  1. **Retard** : `await` d'un délai réel de `rand() * maxDelayMs` ms.
  2. **Rejeu tardif** : si `reorder` et qu'une requête dupliquée attend, elle est d'abord rejouée sur `inner`, réponse ignorée (`stats.replayedLate++`).
  3. **Perte** : avec la probabilité `dropRate`, une fois sur deux on lève `TypeError('lossy: request dropped')` sans appeler `inner`. L'autre fois on appelle `inner` puis on lève `TypeError('lossy: response dropped')` (`stats.dropped++`).
  4. **Doublon** : avec la probabilité `dupRate`, si `reorder`, la requête est mise en attente pour un rejeu tardif. Sinon, `inner` est appelé deux fois et la première réponse est renvoyée (`stats.duplicated++`).
  5. Sinon, `inner.fetch`.
  - `heal()` remet `dropRate`, `dupRate` et `maxDelayMs` à 0, et vide la file des rejeux.
  - Le corps est relu par `init.body` (une chaîne), ce qui permet de le renvoyer.
- Si une propriété échoue, corriger le code de production (T20 à T26) et jamais le test. Chaque correction fait l'objet d'un commit `fix(synchro): …`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- sync/convergence sync/scenarios` → vert (graines fixées, résultat reproductible) ; puis `pnpm test` complet vert.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "test(synchro): convergence deux appareils et scénarios d'époque et de consentement"`