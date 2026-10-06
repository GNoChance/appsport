### Task 20: Contrats du protocole de synchro et push serveur

**Files:**
- Create: `packages/contracts/src/sync.ts` ; Modify: `packages/contracts/src/index.ts`
- Create: `apps/server/src/sync/{hooks.ts, push.ts, routes.ts}`, `apps/server/test/support/sync-fixtures.ts`
- Modify: `apps/server/src/deps.ts` (`AppDeps.syncHooks`, défaut `SYNC_HOOKS` dans `createAppDeps`), `apps/server/src/routes.ts` (`app.route('/api/sync', syncRoutes(deps))`), `apps/server/test/support/index.ts`
- Test: `packages/contracts/test/sync.test.ts`, `apps/server/test/sync/{push,push-c2}.test.ts`

**Interfaces:**
- Consumes : T5 (`entityRules`, `EntityRule`, `snakeToCamel`, `camelToSnake`) ; T2 (`SYNC_PROTOCOL`, `MIN_PROTOCOL`, `PROTOCOL_HEADER`) ; T6 ; T4a (`writeStamp`, `Migration`) ; T9 (`requireUser`) ; T10 (`isHealthConsentActive`, `createUserAndLogin`) ; T19 (`grantConsent`, dans le test).
- Produces : Interfaces partagées §5 (`sync.ts` sauf `COLUMN_CODECS` ; `hooks.ts` ; `OpRejection`, `applyPush`, `syncRoutes`) et §2 (support `SYNC_FIXTURE_MIGRATION`, `SYNC_FIXTURE_RULES`, `SYNC_FIXTURE_HOOKS`, `createSyncTestContext`, `PROTOCOL_HEADERS`, `makeOp`, `syncPush`, `dumpDatabase`). `makeOp` : `clientTs '2026-10-06T10:00:00.000Z'`, `attempts 0`, `opId` de `seqIds(7000)`.

**Spec:** 01 R-SYN-3, R-SYN-9, R-SYN-11, R-SYN-15 à R-SYN-18 ; 03 P-CST-2, P-CST-4, P-LOG-2 ; 09 §0.6 ; Review Focus 3 (serveur).

- [ ] **Step 1: Write the failing test**

DDL des tables de test (`SYNC_FIXTURE_MIGRATION`, id `9001_sync_fixtures`, `breaking: false`, toutes `STRICT`, index `(rev)` et `(owner_id, rev)`, colonnes +SYNC de la Task 4b) :
```sql
CREATE TABLE fixture_note (id TEXT PRIMARY KEY, /* +SYNC */, title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100), body TEXT) STRICT;
CREATE TABLE fixture_note_item (id TEXT PRIMARY KEY, /* +SYNC */, note_id TEXT NOT NULL REFERENCES fixture_note(id),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 100), pain_note TEXT) STRICT;
CREATE TABLE fixture_c2_log (id TEXT PRIMARY KEY, /* +SYNC */, value INTEGER, CHECK (deleted_at IS NOT NULL OR value IS NOT NULL)) STRICT;
```
Règles (`SYNC_FIXTURE_RULES`) : `fixture_note` C1/J/owner_id, clientWritable `['title','body']` ; `fixture_note_item` C1/J/owner_id, clientWritable `['note_id','label','pain_note']`, c2Columns `['pain_note']` ; `fixture_c2_log` C2/J/owner_id, clientWritable `['value']` ; toutes `exported: true`, `onUserDelete: 'cascade'`.
```ts
// sync.test.ts
expect(SyncOp.safeParse({ ...op, kind: 'upsert' }).success).toBe(false); expect(SyncOp.safeParse({ ...op, opId: 'not-a-uuid' }).success).toBe(false);
// PushRequest : 200 ops acceptées, 201 refusées
expect(encodeWatermark('0199b9a0-0000-7000-8000-0000000000e1', 42)).toBe('0199b9a0-0000-7000-8000-0000000000e1:42');
expect(decodeWatermark('0199b9a0-0000-7000-8000-0000000000e1:42')).toEqual({ epoch: '0199b9a0-0000-7000-8000-0000000000e1', rev: 42 });
for (const bad of ['abc', ':3', 'e:-1', 'e:1.5', 'e:', '']) expect(decodeWatermark(bad)).toBeNull();
expect([SYNC_PUSH_MAX, SYNC_PULL_LIMIT, SYNC_TIMEOUT_MS, EPOCH_RESEND_DAYS, TOMBSTONE_TTL_DAYS, APPLIED_OP_TTL_MONTHS]).toEqual([200, 500, 4000, 60, 90, 12]);
expect([SYNC_RETRY_MIN_MS, SYNC_RETRY_MAX_MS, SYNC_INTERVAL_MS, SYNC_DEBOUNCE_MS, COACH_FLUSH_MS]).toEqual([2000, 300000, 60000, 2000, 4000]);
// push.test.ts — note(u, fields = { title: 'n' }) = makeOp create fixture_note
// 201 ops → 400 { error: 'validation' } ; 200 ops → toutes 'applied'
// opId déjà vu → { opId, status: 'duplicate', rev: <rev du premier> }, une seule ligne applied_op
// kind 'upsert' → { status: 'rejected', code: 'validation' } et sync_rejection { owner_id: a.id, entity: 'fixture_note', row_id, code: 'validation', dismissed_at: null }, rev > 0
// training_profile (non J) et 'nope' → unknown_entity ; create sur sync_rejection (allowedKinds) → forbidden ; userId ≠ session → forbidden
// patch de la ligne d'un autre → forbidden, ligne intacte ; ownerId, rev, updatedBy, createdAt envoyés → ignorés (owner_id de la session, created_at '2026-10-06T10:00:00.000Z')
// create répété sur le même id → les deux 'applied', même rev, premier contenu gardé
// create + patch { title } + patch { body } → revs croissants, ligne { title: 't2', body: 'b3' }
// create + delete + patch → patch { status: 'applied', rev: <rev du delete> }, ligne { title: 'a', deleted_at: '2026-10-06T10:00:00.000Z' } ; patch d'une ligne absente → validation
// [n1, title '' (CHECK SQLite), n2] → ['applied','rejected','applied'], code 'validation' (point de sauvegarde)
// enfant d'un parent rejeté → parent_rejected, deux lignes sync_rejection
// detail_json : clés exactement ['fieldNames','kind','reason'], fieldNames ['body','title'], jamais 'VALEUR-SECRETE'
// applied_op { user_id, entity, row_id, status: 'applied', assigned_rev } ; patch dismissedAt sur son sync_rejection → applied ; protocol 99 → code 'protocol'
// push-c2.test.ts (Review Focus 3, serveur) — WITNESS = 'TEMOIN-C2-7f3a', WITNESS_N = 987654, logger capturé
// sans consentement : item { painNote: WITNESS } → { status: 'applied_partial', droppedFields: ['painNote'] }, rev > 0, pain_note NULL
// sans consentement : fixture_c2_log → { opId, status: 'applied_partial', dropped: true }, aucune ligne, applied_op { status: 'applied_partial', assigned_rev: null }
// avec grantConsent : même item → applied, pain_note = WITNESS
// sans consentement : 0 ligne sync_rejection ; ni WITNESS ni '987654' dans dumpDatabase ni dans le journal
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- sync` puis `pnpm --filter @appsport/server test -- sync/push` → `Cannot find module './sync'`, `createSyncTestContext is not exported`.

- [ ] **Step 3: Implement**

`POST /push` : `requireUser`, `parseJson(c, PushEnvelope)`, `200 { results: await applyPush(…) }`. Tout le lot dans une transaction, un point de sauvegarde par opération (rollback + release en cas de rejet). Valeurs écrites : booléen → 0/1, objet ou tableau → `JSON.stringify`. Ordre par opération (R-SYN-16) :
```ts
// consent = isHealthConsentActive(trx, user.id) (une fois par lot) ; rejectedRows = Set<`${entity}:${id}`>
// 0. applied_op(opId) existe : même user → { status: 'duplicate', rev: assignedRev ?? undefined } ; autre user → rejected forbidden sans écriture
// 1. SyncOp.safeParse échoue → OpRejection('validation','schema') ; 2. protocol ∉ [MIN_PROTOCOL, SYNC_PROTOCOL] → ('protocol','protocol')
// 3. règle absente ou syncClass ≠ 'J' → ('unknown_entity','not_journal') ; 4. kind hors allowedKinds → ('forbidden','kind_not_allowed')
// 5. op.userId ≠ session → ('forbidden','user_mismatch') ; 6. ligne existante d'un autre propriétaire → ('forbidden','owner_mismatch')
// 7. hooks.parent et kind ∈ {create, restore_upsert} : parent rejeté dans le lot, absent ou d'un autre → ('parent_rejected','parent_rejected')
// 8. !consent && category C2 && kind ≠ delete → { status: 'applied_partial', dropped: true }, AUCUNE écriture
// 9. champs gardés = clientWritable (les autres ignorés en silence) ; !consent → c2Columns à null, droppedFields
// 10. create : existant → applied avec son rev, sans écriture ; sinon INSERT (ownerId session, stamp). patch : absent → ('validation','row_missing') ;
//     supprimé → applied avec son rev ; sinon UPDATE + stamp. delete : absent → applied sans rev ; supprimé → applied avec son rev ; sinon deletedAt + stamp.
//     restore_upsert → ('validation','not_supported') jusqu'à la Task 22
// 11. afterApply ; 12. applied_op { status: droppedFields.length ? 'applied_partial' : 'applied', assignedRev }
// Rejet (OpRejection, ou err.code === 'ERR_SQLITE_ERROR' → 'validation'/'sql_constraint' ; autre erreur → 500) : rejectedRows.add ;
//   sync_rejection { ownerId: session, opId, entity, rowId, code, detailJson: { kind, fieldNames: clés triées, reason } } ; applied_op 'rejected' ;
//   logger.warn('sync op rejected', { event: 'sync_rejected', code }). Fin : commit, logger.info('sync push', { event: 'sync_push', count }). Aucune valeur journalisée.
```

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes → vert ; `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 5: Commit**

`git commit -m "feat(synchro): protocole v1 et push serveur avec points de sauvegarde"`

---

### Task 21: Pull serveur, garde de protocole et test de fuite

**Files:**
- Modify: `packages/contracts/src/sync.ts` (`ColumnCodec`, `COLUMN_CODECS`), `apps/server/src/sync/routes.ts` (garde + `GET /pull`), `apps/server/test/support/sync-fixtures.ts` (`syncPull`)
- Create: `apps/server/src/sync/{pull.ts, protocol-guard.ts}`
- Test: `apps/server/test/sync/{pull,pull-leak,protocol-guard,codecs}.test.ts`

**Interfaces:**
- Consumes : T20 ; T4a (`getServerMeta`) ; T5 (`insertFixtureRow`, `mirroredTables`, `snakeToCamel`) ; T10 ; T19 (`grantConsent`) ; T14 (`HEALTH_CONSENT_TEXT`).
- Produces : Interfaces partagées §5 (`ColumnCodec`, `COLUMN_CODECS`, `buildPull`, `protocolGuard`) et §2 (support `syncPull`). Valeur exacte :
```ts
export const COLUMN_CODECS = { training_profile: { cautious_mode: 'boolean' }, health_screening: { caution: 'boolean' }, limitation: { active: 'boolean' },
  gym: { load_settings: 'json' }, place: { is_primary: 'boolean', visible_at_gym: 'boolean', load_settings: 'json' }, sync_rejection: { detail_json: 'json' } };
```

**Spec:** 01 R-SYN-20, R-SYN-21, R-SYN-23, R-VER-1, R-VER-2 ; 03 §17 n°1 ; 09 §0 ; Global Constraints « Ajouts au modèle » (1).

- [ ] **Step 1: Write the failing test**

```ts
// protocol-guard.test.ts
it.each([undefined, '0', '2', 'abc', '1.5'])('X-Appsport-Protocol=%s → 426 avant toute authentification', async (v) => {
  // GET /api/sync/pull et POST /api/sync/push sans cookie
  expect(res.status).toBe(426); expect(await res.json()).toEqual({ error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 });
});
// protocole 1 sans session → 401 unauthenticated
// pull.test.ts
// 3 notes → lignes triées par rev ; sans since : { hasMore: false, nextWatermark: `${serverEpoch}:${syncCounter}` }
// 5 notes, limit=2 → 2 lignes, hasMore true, nextWatermark `${epoch}:${rows[1].rev}` ; reprise au watermark → les 2 suivantes
// 600 notes → 500 lignes par défaut, hasMore true ; limit=501 → { error: 'validation' }
// jamais un groupe de même rev coupé (3 notes dont 2 au même rev, limit=2 → 3 lignes)
// tombstone incluse avec deletedAt ; ligne user : la sienne seulement, sans passwordHash ; training_profile.cautiousMode === true ; chaque row a deletedAt
// salle créée par b → gym et gym_equipment présents, loadSettings objet ; aucun place de b
// since d'une autre époque → 410 { error: 'watermark_expired' } ; tombstone_purge_rev = 10 : since `${epoch}:5` → 410, `${epoch}:10` → 200
// since 'abc' → 400 validation ; server_meta.catalog_version 'abc' → catalogVersion 'abc'
// pull-leak.test.ts (membre et admin) : une ligne de l'autre utilisateur dans chaque table J/D/E liée (consentement accordé pour les tables C2) ;
//   le pull ne contient jamais son id ; aucune ligne ne porte une secretColumn ; chaque entity ∈ mirroredTables()
// codecs.test.ts : chaque colonne `IN (0,1)` des tables miroirs a le codec 'boolean', chaque `json_valid(x)` le codec 'json'
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- sync/pull sync/protocol-guard sync/codecs` → `syncPull is not exported`, 404 au lieu de 426.

- [ ] **Step 3: Implement**

`protocolGuard` : `/^\d+$/` dans `[MIN_PROTOCOL, SYNC_PROTOCOL]`, déclaré par `use('*')` avant toute route du routeur. `buildPull` dans une seule transaction (instantané cohérent) :
- `since` illisible → `validation` ; époque ≠ `serverEpoch` ou `rev < tombstonePurgeRev` → `watermark_expired` ;
- tables `J/D/E` du registre : filtre `ownerColumn = user.id` ; `ownerColumn` nul et C0 → toutes les lignes (`gym`, `gym_equipment`) ; sinon exclue ;
- par table `rev > sinceRev ORDER BY rev LIMIT limit + 1`, fusion triée, `limit` premières ; si une ligne écartée a le même `rev` que la dernière gardée, ajouter toutes les lignes de ce `rev` ;
- `nextWatermark = encodeWatermark(epoch, hasMore ? lastRev : max(sinceRev, syncCounter))` ;
- ligne : camelCase, sans `secretColumns`, codecs (`boolean` → `v === 1`, `json` → `JSON.parse`), `deletedAt: null` si la colonne manque.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- sync` → vert (T20 compris).

- [ ] **Step 5: Commit**

`git commit -m "feat(synchro): pull paginé, garde de protocole 426 et test de fuite"`

---

### Task 22: Époque du serveur, restore_upsert et purge des tombstones

**Files:**
- Create: `apps/server/src/sync/{epoch.ts, restore-upsert.ts, purge.ts}`
- Modify: `apps/server/src/sync/push.ts` (`restore_upsert` → `applyRestoreUpsert`, `deletedAt` admis en plus de `clientWritable`), `apps/server/src/jobs/registry.ts` (`syncPurgeJob`)
- Test: `apps/server/test/sync/{epoch,restore-upsert,purge}.test.ts`

**Interfaces:**
- Consumes : T20, T21 ; T4a (`getServerMeta`, `writeStamp`) ; T6 (`IdGen`, `createApp`) ; T7 (`DailyJob`, `DAILY_JOBS`).
- Produces : Interfaces partagées §5 (`rotateServerEpoch`, `RestoreUpsertOutcome`, `applyRestoreUpsert`, `syncPurgeJob`).

**Spec:** 01 R-SYN-23, R-SYN-25, R-SYN-26, R-SYN-27 ; 09 §0.6 ; 03 §7 ; Review Focus 2 (serveur, trois branches).

- [ ] **Step 1: Write the failing test**

```ts
// epoch.test.ts
expect(r.epoch).not.toBe(before.serverEpoch); expect(isUuidV7(r.epoch)).toBe(true);
expect(after).toMatchObject({ serverEpoch: r.epoch, epochBaseRev: before.syncCounter, syncCounter: before.syncCounter }); expect(r.baseRev).toBe(before.syncCounter);
expect((await createApp(ctx.deps).request('/api/health')).headers.get('X-Appsport-Epoch')).toBe(epoch);
// watermark de l'ancienne époque → 410 watermark_expired
// restore-upsert.test.ts (Review Focus 2, R-SYN-27) — ru(u, id, fields, serverRevSeen) = makeOp restore_upsert fixture_note
// absente → insérée (tombstone comprise : deleted_at '2026-09-01T00:00:00.000Z')
// présente, rev ≤ epoch_base_rev, serverRevSeen > rev → remplacée ('client'), nouveau rev > baseRev
// présente, rev ≤ epoch_base_rev, serverRevSeen ≤ rev ou null → laissée ('sauvegarde'), { status: 'applied', rev: r1 }
// présente et modifiée après la restauration (rev > epoch_base_rev) → laissée même avec serverRevSeen 1 000 000 :
expect(r.body.results[0]).toEqual({ opId: expect.any(String), status: 'applied', rev: rp }); // title 'apres-restauration'
// sur sync_rejection → forbidden ; table C2 sans consentement → applied_partial dropped ; ligne d'un autre → forbidden
// purge.test.ts (horloge '2026-10-06T10:00:00.000Z')
// tombstone du 2026-07-07T10:00 → supprimée, du 2026-07-09T10:00 → gardée ; gym et place supprimées le 2026-01-01 → gardées ; tombstonePurgeRev = rev supprimé
// enfant et parent tous deux à 91 j → supprimés sans erreur de FK ; tombstone_purge_rev ne diminue jamais (1000 reste 1000)
// applied_op du 2025-10-05T10:00 → supprimée, du 2025-11-06T10:00 → gardée ; après purge, watermark `${epoch}:${oldRev - 1}` → 410
expect(DAILY_JOBS).toContain(syncPurgeJob);
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- sync/epoch sync/restore-upsert sync/purge` → modules introuvables ; `restore_upsert` → rejected validation.

- [ ] **Step 3: Implement**

- `rotateServerEpoch` : `UPDATE server_meta SET server_epoch = ?, epoch_base_rev = sync_counter WHERE id = 1 RETURNING …`.
- `restore_upsert` suit les étapes 1 à 9 de la Task 20, puis `applyRestoreUpsert` : absente → INSERT (`inserted`) ; `existing.rev <= epochBaseRev && serverRevSeen != null && serverRevSeen > existing.rev` → UPDATE de tous les champs fournis, `deletedAt` compris (`replaced`) ; sinon `{ outcome: 'kept', rev: existing.rev }` sans écriture.
- `syncPurgeJob` (une transaction) : tables J/D/E avec `deleted_at`, hors `gym` et `place`, enfants avant parents (tri topologique par `PRAGMA foreign_key_list`) ; `DELETE … WHERE deleted_at < now − 90 j RETURNING rev` ; `tombstone_purge_rev = max(actuel, max des rev supprimés)` ; `applied_op` antérieures à `now − 12 mois calendaires` ; `logger.info('sync purge', { job: 'sync-purge', count })`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- sync` → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(synchro): époque serveur, restore_upsert et purge des tombstones"`

---

### Task 23: Catalogue minimal servi par ETag

**Files:**
- Create: `packages/contracts/src/catalog.ts`, `apps/server/src/catalog/{loader.ts, routes.ts}`, `data/programs/.gitkeep`, `data/exercises/.gitkeep`, `data/illustrations/files/.gitkeep`, `data/illustrations/manifest.json` (exactement `[]` + saut de ligne), `data/LICENSE`
- Modify: `packages/contracts/src/index.ts`, `apps/server/src/startup.ts` (`CATALOG_STARTUP_TASK`), `apps/server/src/routes.ts` (`/api/catalog`)
- Test: `packages/contracts/test/catalog.test.ts`, `apps/server/test/catalog/{loader,routes}.test.ts`

**Interfaces:**
- Consumes : T6 (`AppConfig.contentDir`, `Logger`) ; T7 (`StartupTask`, `STARTUP_TASKS`) ; T9 (`requireUser`) ; T4a (`getServerMeta`).
- Produces : Interfaces partagées §5 (`ILLUSTRATION_FILE_RE`, `IllustrationRef`, `CatalogBundle`, `CatalogLoadError`, `loadCatalog`, `getLoadedCatalog`, `CATALOG_STARTUP_TASK`, `catalogRoutes`).

**Spec:** 01 R-SYN-32, R-VER-7 ; 04 §10 (réduit au manifeste et à `data/programs/*.json`), 04 §11 (ETag = `catalog_version`) ; 09 §0.6 (classe C).

- [ ] **Step 1: Write the failing test**

```ts
// catalog.test.ts
expect(IllustrationRef.safeParse({ id: 'squat', file: 'squat.0a1b2c3d.svg' }).success).toBe(true);
expect(IllustrationRef.safeParse({ id: 'squat', file: 'squat.svg' }).success).toBe(false);
// loader.test.ts — dossier data/ du dépôt :
expect(b).toMatchObject({ exercises: [], illustrations: [], programTemplates: [], adviceSheets: [] });
expect(b.version).toBe(createHash('sha256').update('{"adviceSheets":[],"exercises":[],"illustrations":[],"programTemplates":[]}').digest('hex'));
expect((await getServerMeta(ctx.deps.db)).catalogVersion).toBe(b.version);
// manifeste + programs/b.json, a.json → programTemplates ids ['a','b'] ; réordonner les clés de b.json ne change pas la version
// contenu modifié à '2026-10-07T08:00:00.000Z' → nouvelle version, catalogUpdatedAt '2026-10-07T08:00:00.000Z' ; contenu identique → aucune écriture
// manifeste { file: 'pas-bon' } ou JSON illisible → CatalogLoadError, server_meta inchangé
// CATALOG_STARTUP_TASK.run résout sans erreur et journalise 'catalog_invalid' ; STARTUP_TASKS le contient
// routes.test.ts : sans session → 401 ; avec session → 200, version = catalogVersion, ETag `"${version}"`, Cache-Control 'no-cache' ;
//   If-None-Match identique ou 'W/"<v>"' → 304 sans corps ; '"autre"' → 200 ; catalogue invalide jamais chargé → 500 { error: 'internal' }
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- catalog` et `pnpm --filter @appsport/server test -- catalog` → modules introuvables.

- [ ] **Step 3: Implement**

`loadCatalog` : manifeste (`z.array(IllustrationRef)`, absent → `[]`), `programs/*.json` triés par nom (contenu brut), `exercises` et `adviceSheets` vides ; version = sha256 hex de la sérialisation canonique (clés triées récursivement, sans espaces) de `{ adviceSheets, exercises, illustrations, programTemplates }` ; `server_meta` mis à jour seulement si la version change ; cache `WeakMap` par `deps`. `If-None-Match` découpé sur les virgules, préfixe `W/` retiré. `data/LICENSE` : « Textes du catalogue : © les auteurs d'appsport, usage privé. Illustrations : chaque fichier de `illustrations/files/` reste sous la licence indiquée dans `illustrations/manifest.json` (créateurs, source, licence, modifications). »

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(synchro): catalogue minimal servi par ETag"`

---

### Task 24: privacy:collect et privacy:reapply

**Files:**
- Create: `apps/server/src/privacy/reapply.ts`
- Modify: `apps/server/src/cli.ts` (`privacy:collect`, `privacy:reapply`), `apps/server/test/support/sync-fixtures.ts` (`snapshotDb`, `restoreInPlace`)
- Test: `apps/server/test/privacy/reapply.test.ts`, `apps/server/test/cli/privacy-cli.test.ts`

**Interfaces:**
- Consumes : T13 (`deleteAccount`) ; T19 (`withdrawHealthConsent`) ; T10 (`isHealthConsentActive`) ; T22 (`rotateServerEpoch`) ; T7 (`runCli`, `withAppDeps`, `parseFlags`) ; T3 ; T20 (`syncPush`, `makeOp`, `createSyncTestContext`, `dumpDatabase`) ; routes de T13 et T19 ; T14.
- Produces : Interfaces partagées §5 (`PrivacyEventList`, `collectPrivacyEvents`, `reapplyPrivacyEvents`), §2 (support `snapshotDb` par `backup` de `node:sqlite`, `restoreInPlace`) et commandes CLI `privacy:collect --since <ISO> [--source <fichier.db>] --out <fichier.json>`, `privacy:reapply <fichier.json>`.

**Spec:** 03 §8 étapes 1 à 4, §17 n°10, P-DRT-3, P-DRT-4, P-CST-3 ; 02 R-SUP-6 ; 08 P4 (a) étapes 1-2 ; Review Focus 4 (volet `privacy:reapply`).

- [ ] **Step 1: Write the failing test**

```ts
// reapply.test.ts (03 §17 n°10) — x, y, z ; z supprimé avant S (hors liste) ; y : consentement, questionnaire, limitation note 'TEMOIN-C2-genou'
// snapshotDb(ctx, S) ; since = now ; +60 s ; x supprimé (204) ; y retire son consentement (200)
expect(events).toEqual([{ type: 'account_deleted', at: expect.any(String), targetId: x.id },
                        { type: 'consent_revoked', at: expect.any(String), targetId: y.id, consentType: 'health' }]);
// restoreInPlace(ctx, S) → dumpDatabase contient 'TEMOIN-C2-genou'
expect(await reapplyPrivacyEvents(ctx.deps, { since, collectedAt, source: 'test', events })).toEqual({ accountsDeleted: 1, consentsWithdrawn: 1 });
// x absent de user ; GET /api/me avec l'ancien cookie de x → 410 { error: 'account_deleted' } ; push rejoué de x → 410 account_deleted
// 'TEMOIN-C2-genou' absent de dumpDatabase ; health_screening de y { caution: null, deleted_at: <non nul> }
// second appel → { accountsDeleted: 0, consentsWithdrawn: 0 } ; événements antérieurs à since et autres types ignorés ; consent_revoked ai_coach ignoré
// privacy-cli.test.ts : après init, deux security_event (account_deleted u-x, consent_revoked u-y { consentType: 'health' }) ;
//   privacy:collect --since 2026-10-06T00:00:00.000Z [--source copie.db] --out l.json → 0, targetIds ['u-x','u-y']
expect(lines).toContain('Réapplication terminée : 0 compte(s) supprimé(s), 0 accord(s) santé retiré(s).');
// --since invalide, --out manquant, fichier de liste invalide → code 1
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- privacy/reapply cli/privacy-cli` → `privacy/reapply` introuvable ; `Commande inconnue`.

- [ ] **Step 3: Implement**

`collectPrivacyEvents` : `security_event` de type `account_deleted` ou `consent_revoked`, `outcome = 'success'`, `at > since`, `ORDER BY at, id` ; `consentType` lu dans `details`. `reapplyPrivacyEvents` : une transaction, dans l'ordre ; compte existant → `deleteAccount(trx, deps, id, { actorId: null, ip: null })` ; `health` actif → `withdrawHealthConsent` ; `ai_coach` ignoré (aucun accord coach avant la brique 4). `restoreInPlace` : `foreign_keys=OFF`, `ATTACH … AS snap`, recopie table par table, `DETACH`, `foreign_keys=ON`, puis `rotateServerEpoch`. Messages CLI : « Date --since invalide (format ISO 8601 attendu) » ; « Option --out obligatoire » ; « Fichier de réapplication invalide » ; succès de `collect` : `<n> événement(s) écrit(s) dans <fichier>` (liste en `JSON.stringify(list, null, 2)`, `source` = chemin lu).

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert.

- [ ] **Step 5: Commit**

`git commit -m "feat(privacy): privacy:collect et privacy:reapply après restauration"`

---

### Task 25: Base locale Dexie et outbox

**Files:**
- Modify: `apps/web/package.json` (`dexie` 4.x ; dev `fake-indexeddb` 6.x, `@appsport/server: workspace:*`)
- Create: `apps/web/src/local-db/{db.ts, meta.ts, wipe.ts, consent.ts}`, `apps/web/src/sync/{outbox.ts, protocol-converters.ts}`, `apps/web/test/support/local-db.ts`, `apps/web/test/fixtures/local-db/v1/dump.json`
- Test: `apps/web/test/local-db/{db,wipe,frozen-v1}.test.ts`, `apps/web/test/sync/{outbox,protocol-converters}.test.ts`

**Interfaces:**
- Consumes : T5 (`entityRules`, `mirroredTables`, `camelToSnake`, `snakeToCamel`) ; T20 (`SyncOp`) ; T2 (`SYNC_PROTOCOL`) ; T10 (`MeResponse`) ; `SYNC_FIXTURE_RULES` (`@appsport/server/testing`).
- Produces : Interfaces partagées §5 (`local-db/*`, `sync/outbox.ts`, `sync/protocol-converters.ts`, support `FIXTURE_MIRRORS`, `createTestLocalDb`, `createFixtureLocalDb`, `loadFrozenLocalDb`, `dumpLocalDb`).

**Spec:** 01 R-SYN-9, R-SYN-11 à R-SYN-14, R-VER-4, R-VER-5 ; 03 P-CST-2, P-CST-3 étape 4, P-AUT-6 ; 09 §7 ; 01 §9.1.4 ; Review Focus 3 (client).

- [ ] **Step 1: Write the failing test**

`dump.json` (figé, jamais modifié une fois commité) : `localDbVersion: 1`, `protocol: 1`, `stores` = copie de `STORE_SCHEMAS` v1 ; `meta` (`deviceId`, `userId` `0199b9a0-0000-7000-8000-0000000000aa`, `watermark` `0199b9a0-0000-7000-8000-0000000000e1:42`, `serverEpoch`, `protocol`) ; deux ops `patch` `sync_rejection` `{ dismissedAt }` (opId `…000001` attempts 2, `…000002` attempts 0) ; une ligne `sync_rejection` (rev 41, `detailJson` objet) et une ligne `training_profile` (rev 40, `cautiousMode: false`), chacune avec `serverRevSeen`.
```ts
// db.test.ts
expect(Object.keys(STORE_SCHEMAS).filter((s) => !NON_MIRROR_STORES.includes(s)).sort()).toEqual(mirroredTables(entityRules));
// chaque champ indexé d'un miroir est une colonne du registre (camelCase) ; createAppDb() → name 'appsport', verno LOCAL_DB_VERSION ;
// mirror('nope') lève ; setMeta/getMeta aller-retour, clé absente → undefined
// outbox.test.ts — createFixtureLocalDb(), ctx = { userId: 'u1', now: () => '2026-10-06T10:00:00.000Z', newOpId, healthConsentActive: true, rules: SYNC_FIXTURE_RULES }
expect(await db.mirror('fixture_note').get('n1')).toEqual({ id: 'n1', ownerId: 'u1', title: 't', serverRevSeen: null, deletedAt: null, updatedAt: '2026-10-06T10:00:00.000Z' });
expect(await db.outbox.get(op.opId)).toEqual({ ...op, userId: 'u1', protocol: 1, attempts: 0, clientTs: '2026-10-06T10:00:00.000Z' });
// opId en double → ni ligne ni op (transaction) ; opId 'pas-un-uuid' → exception, rien d'écrit ; champ hors clientWritable ou entité non J → exception
// sans consentement : item { painNote: 'TEMOIN' } → op.fields { noteId: 'n1', label: 'x' } ; fixture_c2_log → HealthConsentRequiredError, rien d'écrit
// patch fusionne, delete pose deletedAt ; pendingCount par userId (2 ops u1, 1 op u2 → 2 et 1)
// wipe.test.ts
// wipeUserData({ keepOutbox: true }) : miroirs et USER_META_KEYS vidés ; outbox, deadletter, deviceId et catalogue gardés ; keepOutbox false → outbox et deadletter vidés aussi
// clearMirrors : miroirs seuls ; localHealthConsentActive : aucun → false, grant → true, grant puis withdraw → false
// purgeHealthData (Review Focus 3) : miroirs health_screening, limitation (note W), fixture_c2_log (W), fixture_note_item (painNote W) ;
//   outbox : create fixture_c2_log { value: W }, patch item { painNote: W, label: 'x' }, patch item { painNote: W } ; deadletter fixture_c2_log (detail W)
expect(await purgeHealthData(db, SYNC_FIXTURE_RULES)).toEqual({ rowsCleared: 4, opsRemoved: 2, opsStripped: 1 });
expect(await dumpLocalDb(db)).not.toContain(W); expect((await db.outbox.toArray()).map((o) => o.fields)).toEqual([{ label: 'x' }]);
// frozen-v1.test.ts (R-VER-5) : loadFrozenLocalDb(1) puis createAppDb → verno LOCAL_DB_VERSION ; outbox = dump.outbox.map(convertOutboxOp) ;
//   miroirs identiques au dump ; getMeta watermark '0199b9a0-0000-7000-8000-0000000000e1:42'
// protocol-converters.test.ts : OUTBOX_CONVERTERS[p] défini pour 1 ≤ p < SYNC_PROTOCOL ; convertOutboxOp(op v1).protocol === SYNC_PROTOCOL ;
//   cible 3 sans maillon → throw /v2/
```
(`dumpLocalDb(db)` = JSON de toutes les tables Dexie, défini dans `test/support/local-db.ts`.)

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- local-db sync/outbox sync/protocol-converters` → modules introuvables.

- [ ] **Step 3: Implement**

- `AppDb` : `version(LOCAL_DB_VERSION).stores({ ...STORE_SCHEMAS, ...extraMirrors })` ; les versions suivantes ajouteront `.upgrade(tx => tx.table('outbox').toCollection().modify(op => Object.assign(op, convertOutboxOp(op))))`.
- `writeLocal` : erreurs `entity_not_journal`, `field_not_writable:<clé>`, `HealthConsentRequiredError` (table C2 sans consentement), clés C2 retirées sans consentement ; `SyncOp.parse` ; une transaction `rw` sur l'outbox et le miroir (create → `put` avec `ownerId`, `serverRevSeen: null`, `deletedAt: null`, `updatedAt` ; patch → fusion, ligne absente → `row_missing` ; delete → `deletedAt`).
- `purgeHealthData` (une transaction) : miroirs C2 vidés, `c2Columns` (camelCase) à null ailleurs ; ops sur une table C2 supprimées, clés C2 retirées des autres (un `patch` vidé est supprimé) ; deadletter des tables C2 supprimée ; `rowsCleared` = lignes supprimées + lignes mises à null.
- `localHealthConsentActive` : dernier `consent_event` `health` par l'index `[type+createdAt]`, `action === 'grant'`.
- `convertOutboxOp` : maillon absent → `outbox converter missing: v<p> → v<p+1>`.

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(synchro): base locale Dexie, outbox transactionnelle et jeu figé v1"`

---

### Task 26: Moteur de synchro client

**Files:**
- Create: `apps/web/src/sync/{transport.ts, apply-pull.ts, engine.ts, triggers.ts, catalog.ts}`
- Test: `apps/web/test/sync/{transport,apply-pull,engine,engine-epoch,catalog,triggers}.test.ts`

**Interfaces:**
- Consumes : T25 ; T20/T21 (`PushResponse`, `PullResponse`, `PulledRow`, `SyncOp`, constantes) ; T2 (`PROTOCOL_HEADER`, `EPOCH_HEADER`, `createMonotonicUuidV7`) ; T6 (`HealthResponse`) ; T23 (`CatalogBundle`).
- Produces : Interfaces partagées §5 (`transport.ts`, `engine.ts` avec `retryDelayMs`, `apply-pull.ts`, `catalog.ts`, `triggers.ts`) et comportements client fixés.

**Spec:** 01 R-SYN-9, R-SYN-12, R-SYN-13, R-SYN-18, R-SYN-22 à R-SYN-24, R-SYN-26, R-SYN-29, R-SYN-30, R-SYN-32, R-VER-2 ; 03 P-DRT-4, P-CST-3 étape 4, P-CST-4 ; 04 §11 ; Review Focus 2 (ordre client) et 3 (client).

- [ ] **Step 1: Write the failing test**

Fichiers en `// @vitest-environment node` (sauf `triggers.test.ts`) ; faux transport local renvoyant `X-Appsport-Epoch: E1` ; `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout','setInterval','clearInterval'] })` (jamais `setImmediate` ni `queueMicrotask`, utilisés par fake-indexeddb).
```ts
// transport.test.ts : transport muet → OfflineError à 4000 ms ; TypeError → OfflineError ; 500 renvoyée telle quelle
// apply-pull.test.ts : ligne écrite avec serverRevSeen = rev ; rebase R-SYN-22 :
await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: { id: 'n1', ownerId: 'u1', title: 'serveur', body: 'b', deletedAt: null, rev: 9, updatedAt: '2026-10-06T11:00:00.000Z' } }]);
expect(await db.mirror('fixture_note').get('n1')).toMatchObject({ title: 'serveur', body: 'local', serverRevSeen: 9 });   // patch local { body: 'local' } en attente
// delete en attente → deletedAt gardé ; tombstone serveur sans contenu remplace la copie ; entité sans miroir ignorée
// engine.test.ts (meta.userId 'u1', serverEpoch 'E1', rules SYNC_FIXTURE_RULES)
expect(paths).toEqual(['GET /api/health', 'POST /api/sync/push', 'POST /api/sync/push', 'POST /api/sync/push', 'GET /api/sync/pull']);   // 450 ops
expect(sent.map((o) => o.length)).toEqual([200, 200, 50]);   // triées par opId ; en-tête X-Appsport-Protocol '1'
// ops d'un autre userId jamais envoyées (P-AUT-6) ; op retirée seulement après accusé, serverRevSeen = rev ; op sans résultat gardée
// rejected → deadletter { opId, userId, entity, id, code, detail: { kind, fieldNames }, receivedAt }, retirée de l'outbox
// applied_partial dropped → copie locale supprimée ; droppedFields ['painNote'] → champ local null ; 'TEMOIN-C2-7f3a' absent de toutes les tables
// 401 → 'unauthenticated', outbox intacte, aucune reprise programmée ; 410 account_deleted → outbox, deadletter, miroirs vides, meta.userId absente,
//   onAccountDeleted appelé une fois, syncNow suivant sans requête ; 410 watermark_expired → miroirs vidés, outbox gardée, second pull sans since ;
//   410 { error: 'gone' } → rien d'effacé ; 426 → 'protocol_unsupported', outbox intacte
// délai 4 s → 'offline', syncNow ne rejette pas ; reprises à +2 s puis +4 s
expect([1, 2, 3, 8, 9, 20].map(retryDelayMs)).toEqual([2000, 4000, 8000, 256000, 300000, 300000]);
// pull : watermark, lastPullOkAt, serverCatalogVersion mis à jour, hasMore enchaîne ; consent_event health/withdraw tiré → purgeHealthData
// flushBefore(4000) rend la main en 4 s au plus ; deux syncNow concurrents → deux cycles successifs ; pending et rejected tenus à jour, subscribe notifié
// engine-epoch.test.ts (Review Focus 2) — miroir : n10 (updatedAt −10 j, serverRevSeen 5), n70 (−70 j), tombstone t5 (−5 j), un sync_rejection ; outbox : 1 patch ;
//   health { epoch: 'E2' }
// 1er push = restore_upsert de { n10, t5 } (ensemble) : n10 { serverRevSeen: 5, fields: { title, deletedAt: null } }, t5 deletedAt non nul ; 2e push = ['patch'] ;
// puis pull sans since, après le 2e push ; meta.serverEpoch 'E2'
// restore_upsert interrompu (hors ligne) → époque locale E1, outbox intacte, tout rejoué au cycle suivant ; sans consentement local : tables C2 exclues, c2Columns retirées
// première prise de contact (serverEpoch absent) → époque enregistrée sans restore_upsert
// catalog.test.ts : If-None-Match "<catalogVersion>" ; 304 → 'unchanged' ; 200 → 4 stores remplacés, catalogVersion = serverCatalogVersion = version → 'updated' ;
//   SW contrôleur → postMessage({ type: 'SYNC_ILLUSTRATIONS', files }) ; après un pull où serverCatalogVersion ≠ catalogVersion, GET /api/catalog
// triggers.test.ts (happy-dom) : visible → syncNow('foreground') ; 'online' → syncNow('online') ; toutes les 60 s 'interval' si visible et pending > 0 ;
//   vi.spyOn(navigator, 'onLine', 'get') jamais appelé ; trois 'set_logged' en 1 s → un cycle à +2000 ms ; la fonction rendue retire écouteurs et intervalle
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- sync/transport sync/apply-pull sync/engine sync/catalog sync/triggers` → modules introuvables.

- [ ] **Step 3: Implement**

`applyPulledRows` : une transaction ; `merged = { ...row, serverRevSeen: rev }`, puis les ops en attente sur `[entity+id]` rejouées dans l'ordre des `opId` (`create`/`patch`/`restore_upsert` → `Object.assign(fields)`, `delete` → `deletedAt = clientTs`). Un seul cycle en vol (un `syncNow` pendant un cycle en programme un seul autre) ; rien si `account_deleted`, `stop()` ou `meta.userId` absente. Cycle, dans l'ordre :
```ts
// 1. GET /api/health : OfflineError → 'offline', failures++, reprise retryDelayMs (après start()) ; 5xx → failures++, reprise ; succès → 'online', failures = 0
// 2. Époque : meta.serverEpoch absente → l'enregistrer. Différente : pause ; lignes des tables J (sauf sync_rejection) de l'utilisateur dont
//    updatedAt ≥ now − EPOCH_RESEND_DAYS (tables C2 exclues et c2Columns retirées sans consentement local) → restore_upsert
//    { fields: clientWritable présents + deletedAt, serverRevSeen } par lots de 200, jamais écrits dans l'outbox ; un échec arrête le cycle
//    SANS changer meta.serverEpoch ; sinon setMeta(serverEpoch), deleteMeta(watermark), reprise
// 3. Push : lots de 200 ops de l'utilisateur triées par opId (attempts++ avant envoi) ; applied | applied_partial | duplicate → retirée de l'outbox,
//    serverRevSeen = rev, droppedFields → null, dropped → copie supprimée ; rejected → deadletter puis retirée
// 4. Pull : depuis meta.watermark jusqu'à hasMore false ; watermark, serverCatalogVersion ; consent_event health tiré et consentement local inactif
//    → purgeHealthData ; fin → lastPullOkAt
// 5. serverCatalogVersion ≠ catalogVersion → refreshCatalog (erreur avalée)
// À toute étape : 401/403 → 'unauthenticated' sans reprise ; 410 account_deleted → wipeUserData({ keepOutbox: false }), 'account_deleted', onAccountDeleted ;
//   410 watermark_expired → clearMirrors, deleteMeta(watermark), un seul pull complet ; autre 410 → fin sans effacer ; 426 → 'protocol_unsupported' ;
//   X-Appsport-Epoch ≠ époque connue → fin du cycle et nouveau cycle immédiat
```
`pullNow` = cycle sans l'étape 3 ; `flushBefore(ms)` = `Promise.race(syncNow('coach'), délai)` sans rejet ; `rejected` = `opId` distincts de la deadletter de l'utilisateur et des `sync_rejection` non ignorés ni supprimés. `refreshCatalog` : éléments de `exercises`, `programTemplates`, `adviceSheets` validés par `z.looseObject({ id: z.string() })` ; autre statut → `Error('catalog_http_<status>')`. Triggers : `set_logged` regroupé par `SYNC_DEBOUNCE_MS`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/web test -- sync` → vert ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(synchro): moteur client (push, pull, époque, reprises, catalogue)"`

---

### Task 27: Convergence sur deux appareils et scénarios ciblés

**Files:**
- Create: `apps/web/test/support/{in-process-transport.ts, lossy-transport.ts}`
- Modify: `apps/web/package.json` (dev `fast-check` 4.x), `apps/server/test/support/index.ts` (réexporte `createLogger` et `grantConsent`)
- Test: `apps/web/test/sync/{convergence,scenarios}.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consumes : `@appsport/server/testing` (`createSyncTestContext`, `SYNC_FIXTURE_RULES`, `createUserAndLogin`, `snapshotDb`, `restoreInPlace`, `dumpDatabase`, `createLogger`, `grantConsent`) ; T25 ; T26.
- Produces : Interfaces partagées §5 (`inProcessTransport` : ajoute `cookie` et `origin = appOrigin`, journalise `{ method, path, body }` ; `LossyOptions`, `lossyTransport`).

**Spec:** 01 §9.1.2, R-SYN-9, R-SYN-12, R-SYN-26, R-SYN-27 ; 03 §17 n°3 et n°11, P-AUT-6, P-CST-4 ; Review Focus 2 et 3 (bout en bout).

- [ ] **Step 1: Write the failing test**

```ts
// convergence.test.ts — commandes fast-check createNote (titre '' ou 1..20), patchNote, deleteNote, createItem, sync sur l'appareil 0 ou 1
it.each([{ seed: 20261006, dropRate: 0.3, dupRate: 0.2, maxDelayMs: 3, reorder: false }, { seed: 7, dropRate: 0.2, dupRate: 0.4, maxDelayMs: 3, reorder: true }])
  ('deux appareils convergent malgré pertes, doublons, retards et réordonnancements (%o)', /* numRuns 25, seed fixée, 120 s */);
// après heal() et jusqu'à 10 tours de syncNow puis pullNow : miroirs fixture_note (title, body, deletedAt) et fixture_note_item (noteId, label, deletedAt)
// identiques au serveur ; pendingCount 0 ; items serveur = items créés hors rejets ; sync_rejection identiques ; chaque opId de deadletter a sa ligne sync_rejection
// scenarios.test.ts
// 401 puis reconnexion du même utilisateur : 3 notes, 'unauthenticated', pendingCount 3 ; bon cookie + syncNow('set_logged') → pendingCount 0, 3 notes au serveur
// outbox de A jamais envoyée sous la session de B (03 §17 n°11) : aucune op de A dans les push, 0 fixture_note au serveur, pendingCount(A) 2
// changement d'époque avec appareil en retard (R-SYN-26/27) : A et B sur E1 ; n1 'avant' ; snapshotDb(S) ; A patche n1 'apres-S' et crée n2 ; B tire ;
//   restoreInPlace(S) → E2 ; B patche hors ligne n1 body 'B-hors-ligne' ; A rejoue (n1 'apres-S', n2 réinséré) puis patche n1 'final-A' ;
//   B : pendingCount 1 avant l'envoi, puis
expect(seq).toEqual(['GET /api/health', 'POST /api/sync/push:restore_upsert', 'POST /api/sync/push:patch', 'GET /api/sync/pull']);   // pull sans since
expect(n1).toEqual({ title: 'final-A', body: 'B-hors-ligne' });   // n2 présent ; miroirs de A et B identiques au serveur
// retrait du consentement pendant que B a des ops C2 en attente (Review Focus 3) : B hors ligne crée item { painNote: 'TEMOIN-C2-7f3a' } et
//   fixture_c2_log { value: 987654 } ; A retire le consentement ; B.syncNow → 0 sync_rejection ; aucun témoin dans dumpDatabase, le journal,
//   ni aucune table Dexie de A et B ; deadletter de B vide ; fixture_c2_log de B vide
// variante : B tire le retrait avant de pousser → aucun témoin dans le journal des requêtes de B
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/web test -- sync/convergence sync/scenarios` → `in-process-transport` introuvable.

- [ ] **Step 3: Implement**

`lossyTransport` (mulberry32(`seed`)), à chaque appel : retard réel `rand() * maxDelayMs` ; si `reorder` et un doublon attend, rejeu tardif sur `inner` (réponse ignorée, `replayedLate++`) ; perte (`dropRate`) : une fois sur deux `TypeError('lossy: request dropped')` sans appel, sinon appel puis `TypeError('lossy: response dropped')` (`dropped++`) ; doublon (`dupRate`) : mis en attente si `reorder`, sinon deux appels et première réponse (`duplicated++`) ; sinon `inner.fetch`. `heal()` remet les taux et le délai à 0 et vide la file. Si une propriété échoue, corriger le code de production (T20 à T26), jamais le test, avec un commit `fix(synchro): …`.

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert (graines fixées) ; puis `pnpm test` complet.

- [ ] **Step 5: Commit**

`git commit -m "test(synchro): convergence deux appareils et scénarios d'époque et de consentement"`
