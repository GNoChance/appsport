# Brique 2 · Exercices — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le catalogue d'exercices de Rune : taxonomie et fiches, fonctions partagées, base et chargeur, relecture à plusieurs avec feu vert santé, outillage de rédaction et d'illustrations, onglet Exercices et fiche à onglets, puis les fiches étalons et le pilote.

**Architecture:** Tout le métier (taxonomie, schéma de fiche, faisabilité, chaînes, remplaçants, sensibilité, feu vert, blocages, files) vit en fonctions pures dans `packages/contracts` et `packages/domain`, appelées à l'identique par le serveur, les scripts et le web. Le serveur garde la base comme source de vérité (tables `exercise`, `illustration`, et trois tables de relecture en classe H) et reconstruit le bloc de `GET /api/catalog` à chaque écriture. Le web lit le catalogue depuis Dexie par un dépôt dédié ; la relecture est un écran en ligne seulement.

**Tech Stack:** TypeScript, Zod, fast-check, Hono, Kysely/node:sqlite, React 19, wouter, Dexie, CSS Modules, Vitest + Testing Library + happy-dom, Playwright (Chromium, WebKit), SDK Anthropic (scripts du poste de dev seulement).

**Spec:** `docs/superpowers/specs/2026-10-14-brique-2-exercices-design.md` (validée le 2026-10-14) et la section qu'elle complète, `docs/superpowers/specs/2026-10-06-appsport-design/04-exercices.md`. Lire les deux en entier avant toute tâche ; en cas d'écart, la spec de la brique 2 l'emporte sur 04 là où elle le déclare (tableau du §1). Maquettes validées : `.superpowers/brainstorm/2679-1791963547/content/{exercices-liste,exercices-fiche,relecture}.html` dans le dépôt principal `C:\Users\eliott.colin\appsport` (choix B, B, et la relecture telle quelle).

**Point de départ :** la branche `socle` une fois la refonte fusionnée (Tasks 0 à 16 du plan `2026-10-13-refonte-rune.md`). On compte notamment sur : la migration `0002_coach`, `TAB_ITEMS` et `TabBar` (refonte Task 5), `ProgressionPage` (Task 9), le hub Profil (Task 10), `BottomSheet`, `RankBadge`, `EmptyState`, `Switch`, `Chips`, `ListRow` (Tasks 3 et 4). Branche de travail : `brique-2`, depuis ce `socle`.

## Global Constraints

- Branche `brique-2`, un ou plusieurs commits par tâche, messages en français au format du dépôt (`feat(server): …`), trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` verts à la fin de chaque tâche ; `pnpm --filter @rune/web test:e2e` (Chromium et WebKit) vert pour toute tâche qui touche un parcours E2E.
- Contraintes du socle et de la refonte toujours valables : CSP `default-src 'self'` (aucun `dangerouslySetInnerHTML`, aucune ressource externe), format d'erreur API, 404 pour les données d'un autre, jamais de C1–C3 dans `/api/admin/*`, classes de synchro (spec 01), aucun accès Dexie depuis `features/`, `ui/` ou `App.tsx` (seulement `repos/`), tables STRICT avec CHECK, migrations transactionnelles, `entityRules` couvre chaque colonne.
- Textes : français, apostrophe droite `'`, tutoiement, voix du Système seulement aux moments clés ; aucun « appsport » hors `docs/superpowers` et `docs/research`.
- Accessibilité : cibles ≥ 44 × 44 px, contrastes ≥ 4,5:1 dans les 5 thèmes, rien porté par la couleur seule, `prefers-reduced-motion` respecté.
- Codes de taxonomie, tables, colonnes et slugs en anglais (kebab-case immuable pour les fiches) ; noms affichés en français (04 §2).
- Nouvelle dépendance : version exacte publiée depuis au moins deux semaines (`npm view <pkg> time`), et seulement si la tâche la nomme.
- Aucune donnée personnelle envoyée à l'API Claude ; la clé vit dans `.env.local` (ignoré par git), jamais dans un fichier versionné, un journal ou un rapport.
- Valeurs fixées par la spec, à reprendre telles quelles : `CATALOG_MAX_SHEETS = 300`, `SUBSTITUTE_LIMIT = 5`, `SENSITIVE_JOINTS = ['lower_back','knees','shoulders','neck']`, 9 groupes `MUSCLE_GROUPS` (spec §4.3), commentaires de 1 à 1000 caractères, entrées de `safety` ≤ 120 caractères, `batch` ∈ `A` | `B` | `E1`…`E99`.

## Review Focus

1. **Fiche publiée corrigée** : elle reste servie avec le nouveau contenu, `catalog_version` change, le téléphone la retélécharge, et elle entre dans « À revalider » si elle est sensible. Test dans la tâche 9.
2. **Mineur et chaîne** : en profil prudent, aucun écran (liste, recherche, variantes, URL directe) ne montre le contenu d'une fiche `not_for_minors`. Tests dans les tâches 13 et 14.
3. **Deux onglets admin ouverts** : deux enregistrements partis de la même révision donnent un 200 et un 409, et l'écran du second garde sa saisie à côté de la version courante. Tests dans les tâches 9 et 17.
4. **Relectrice qui perd son rôle en pleine session** : la requête suivante répond 403 ; l'écran affiche « Tu n'as plus accès à la relecture. » et revient au Profil, sans boucle. Tests dans les tâches 7 et 16.
5. **Catalogue vide ou pas encore téléchargé** : premier lancement hors ligne, l'onglet Exercices montre l'état « Connecte-toi une fois… », jamais 9 tuiles à 0. Test dans la tâche 14.

---

## Structure des fichiers

- `packages/contracts/src/taxonomy.ts` (complété) : codes, libellés, groupes. `packages/contracts/src/exercise.ts` : `ExerciseSheet`, statuts, parts, blocages. `packages/contracts/src/api/review.ts` : contrats de la relecture.
- `packages/domain/src/catalog/` : `equipment.ts`, `usable.ts`, `chains.ts`, `substitutes.ts`, `canonical.ts`, `review.ts` (sensibilité, feu vert, différentiel), `blockers.ts`, `queues.ts`, `validate.ts` (validateur du catalogue), `index.ts`.
- `apps/server/src/db/migrations/0003_catalog.ts`.
- `apps/server/src/catalog/` : `loader.ts` (refait), `bundle.ts` (bloc servi et version), `repo.ts` (lecture et écriture des fiches, révisions), `routes.ts` (servi aux membres).
- `apps/server/src/review/` : `guard.ts`, `routes.ts` (`/api/review/*`), `admin-routes.ts` (édition sous `/api/admin/exercises`).
- `apps/server/src/admin/reviewer-flags.ts`.
- `apps/server/src/ai/` : `client.ts` (`AiClient`), `fake.ts`.
- `scripts/` (nouveau, racine) : `data/validate.ts`, `data/pull.ts`, `exercises/draft.ts`, `exercises/prompt-v1.md`, `exercises/import-illustrations.ts`, `svg/check.ts`, `svg/sanitize.ts`.
- `apps/web/src/repos/catalog-repo.ts`, `apps/web/src/repos/review-repo.ts`.
- `apps/web/src/ui/Tabs.tsx`.
- `apps/web/src/features/exercises/` : `ExercisesHome.tsx`, `GroupList.tsx`, `ExerciseSheetPage.tsx`, `exercises.module.css`.
- `apps/web/src/features/review/` : `ReviewList.tsx`, `ReviewSheet.tsx`, `CommentSheet.tsx`, `ValidateSheet.tsx`, `EditSheetForm.tsx`, `HowToReview.tsx`, `ReviewHomeCard.tsx`, `review.module.css`.
- `docs/catalog/style-guide.md`, `data/glossary.json`, `data/exercises/*.json`.

---

### Task 1: Taxonomie complète et schéma de fiche

**Files:**
- Modify: `packages/contracts/src/taxonomy.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/api/errors.ts`, `packages/contracts/test/errors.test.ts`
- Create: `packages/contracts/src/exercise.ts`, `packages/contracts/test/exercise.test.ts`
- Test: `packages/contracts/test/taxonomy.test.ts`

**Interfaces:**
- Produces (taxonomy.ts) : `MOVEMENT_PATTERNS` (20 codes de 04 §3.4) + `MOVEMENT_PATTERN_LABELS`, `PATTERN_GROUPS` (5 groupes, 04 §3.4), `patternGroup(p): string`, `MUSCLES` (18) + `MUSCLE_LABELS`, `JOINTS` (8) + `JOINT_LABELS`, `EXERCISE_LEVELS = [1,2,3]`, `LOAD_MODES` (6), `SENSITIVE_JOINTS`, `MUSCLE_GROUPS: readonly {code, label, muscles}[]` (spec §4.3, dans cet ordre : chest, back, shoulders, arms, core, glutes, quads, hamstrings, calves), `maxExerciseLevel(experience): 1|2|3`, `SUBSTITUTE_LIMIT = 5`, `CATALOG_MAX_SHEETS = 300`, types `MovementPattern`, `Muscle`, `Joint`, `LoadMode`, `MuscleGroupCode`.
- Produces (exercise.ts) : `EXERCISE_STATUSES = ['draft','reviewed','published','retired']`, `BatchSchema` (`/^(A|B|E([1-9][0-9]?))$/`), `ExerciseSheetSchema` (Zod, champs et bornes de 04 §4 + `batch` ; `safety` : entrées ≤ 120 caractères), `DraftSheetSchema` (champs IA facultatifs, R-FIC-1), `type ExerciseSheet`, `CONTENT_EXCLUDED_KEYS` (spec §3.2), `COMMENT_PARTS` (15 valeurs, spec §3.3), `PUBLISH_BLOCKERS` dans l'ordre du tableau §3.6 (`incomplete`, `invalid_sheet`, `review_unchecked`, `minors_unconfirmed`, `open_comments`, `health_validation_missing`, `illustrations_missing`, `referenced_by_template`, `chain_break`, `catalog_full`), `type PublishBlocker`, `exerciseJsonSchema()` (via `z.toJSONSchema`).
- Produces (errors.ts) : codes `revision_conflict` 409, `transition_blocked` 422, `not_reviewable` 409, `self_health_flag` 403 (ajouter 422 à `ERROR_STATUS` s'il n'y est pas).

- [ ] **Step 1: Write the failing tests**

```ts
// taxonomy.test.ts
it('MUSCLE_GROUPS couvre chacun des 18 muscles une seule fois, dans l\'ordre de la refonte', () => {
  expect(MUSCLE_GROUPS.map((g) => g.code)).toEqual(['chest','back','shoulders','arms','core','glutes','quads','hamstrings','calves']);
  expect(MUSCLE_GROUPS.map((g) => g.label)).toEqual(['Pectoraux','Dos','Épaules','Bras','Abdos','Fessiers','Quadriceps','Ischios','Mollets']);
  expect(MUSCLE_GROUPS.flatMap((g) => g.muscles).sort()).toEqual([...MUSCLES].sort());
});
it('SENSITIVE_JOINTS est inclus dans JOINTS', () => expect(SENSITIVE_JOINTS.every((j) => JOINTS.includes(j))).toBe(true));
it('patternGroup rend son groupe ou le pattern lui-même', () => {
  expect(patternGroup('lunge')).toBe('lower_body');
  expect(patternGroup('calf_raise')).toBe('calf_raise');
});
// exercise.test.ts
it('refuse une entrée de sécurité de 121 caractères', () => expect(ExerciseSheetSchema.safeParse(sheet({ safety: ['x'.repeat(121)] })).success).toBe(false));
it('batch accepte A, B, E1, E99 et refuse E0, E100, C', () => { /* table de cas */ });
it('PUBLISH_BLOCKERS suit l\'ordre de la spec', () => expect(PUBLISH_BLOCKERS[0]).toBe('incomplete'));
// errors.test.ts : les 4 codes dans leurs groupes de statut
```

`sheet()` est une fabrique locale au test qui rend une fiche publiée valide (squat goblet, valeurs de la maquette de fiche).

- [ ] **Step 2: Run** `pnpm --filter @rune/contracts test` — FAIL (exports absents).
- [ ] **Step 3: Implement** les constantes, `ExerciseSheetSchema` (ordre des clés = ordre de 04 §4, utilisé ensuite par la forme canonique) et les codes d'erreur.
- [ ] **Step 4: Run** `pnpm --filter @rune/contracts test` puis `pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(contracts): taxonomie complète, schéma des fiches et codes de la relecture`.

### Task 2: Fonctions partagées du catalogue

**Files:**
- Create: `packages/domain/src/catalog/{equipment,usable,chains,substitutes,canonical,index}.ts`, `packages/domain/test/catalog/{equipment,usable,chains,substitutes,canonical}.test.ts`, `packages/domain/test/fixtures/catalog.ts`
- Modify: `packages/domain/src/index.ts`, `packages/domain/test/purity.test.ts` (lecture récursive de `src/`)

**Interfaces:**
- Consumes: Task 1.
- Produces : `expandEquipment(codes): Set<EquipmentCode>`, `feasible(ex, equipment: Set<EquipmentCode>): boolean`, `type CatalogContext = {catalog: ExerciseSheet[]; equipment: Set<EquipmentCode> | 'all'; maxLevel: 1|2|3; cautious: boolean}`, `isUsable(ex, ctx)`, `visibleWithoutPlace(ex, cautious)` (spec §4.1 « interrupteur coupé »), `buildChains(catalog): Map<string, ExerciseSheet[]>`, `chainRank(ex, chains): number | null`, `usableChainSteps(chainId, ctx)`, `substitutes(ex, ctx): ExerciseSheet[]`, `canonicalJson(sheet): string` (clés dans l'ordre de 04 §4, 2 espaces, LF final). `equipment: 'all'` vaut faisable partout (sans lieu principal).

- [ ] **Step 1: Write the failing tests** — tableaux de cas de 04 §13 critères 2 à 4 : `[[]]` toujours faisable ; plusieurs options ; `adjustable_bench` vaut `flat_bench` ; lieu vide ; `buildChains` donne les rangs 1 à n ; `usableChainSteps` s'arrête avant la première `not_for_minors` en profil prudent ; propriétés fast-check de `substitutes` (jamais l'exercice lui-même, jamais une fiche non publiée, non faisable, au-dessus de `maxLevel`, ou `not_for_minors` si `cautious` ; au plus 5 ; ordre stable quel que soit l'ordre d'entrée ; égalités départagées par `id` en ordre binaire) ; `canonicalJson` stable et identique après aller-retour `JSON.parse`. Le test de pureté échoue si un fichier de `src/catalog/` contient `Date.now(`.
- [ ] **Step 2: Run** `pnpm --filter @rune/domain test` — FAIL.
- [ ] **Step 3: Implement** selon 04 §6 (score de `substitutes` : 3 × principaux communs + 1 × secondaires communs − 2 × |écart de niveau| + 1 même `unilateral` + 1 même `load_mode`).
- [ ] **Step 4: Run** — PASS, sous Node ; ajouter `packages/domain/test/catalog/substitutes.test.ts` au projet web (happy-dom) par un import dans `apps/web/test/domain-parity.test.ts` qui rejoue les mêmes propriétés (04 §13 critère 3).
- [ ] **Step 5: Commit** `feat(domain): faisabilité, chaînes, remplaçants et forme canonique des fiches`.

### Task 3: Fonctions de la relecture

**Files:**
- Create: `packages/domain/src/catalog/{review,blockers,queues}.ts`, `packages/domain/test/catalog/{review,blockers,queues}.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces :
  - `contentOf(sheet): Record<string, unknown>` (sans `CONTENT_EXCLUDED_KEYS`) ; `contentDiff(a, b): string[]` (clés triées) ;
  - `isSensitive(sheet): boolean` ;
  - `type ReviewerState = {id: string; role: 'admin'|'member'; catalogReviewer: boolean; healthProfessional: boolean}` ; `isReviewer(u)`, `isHealthReviewer(u)` (spec §3.1 : santé = drapeau ∧ `catalogReviewer` ∧ `member`) ;
  - `type Validation = {reviewerId: string|null; revision: number; health: boolean}` ; `type RevisionRow = {revision: number; content: Record<string, unknown>; savedBy: string|null}` ;
  - `healthGreenLight(sheet, revisions: RevisionRow[], validations: Validation[], users: Map<string, ReviewerState>): boolean` (spec §3.2, conditions 1 à 3) ;
  - `transitionBlockers(input: {sheet; to; comments: {resolvedAt: string|null}[]; greenLight: boolean; reviewChecked: boolean; minorsConfirmed: boolean; manifestIds: Set<string>; templateRefs: Set<string>; catalog: ExerciseSheet[]}): PublishBlocker[]` (ordre fixe, tableau §3.6) ;
  - `reviewQueues(...)` qui rend les prédicats du §3.8 (`to_review`, `drafts`, `health_pending`, `revalidate`, `mine`, `readyToPublish`) et `progressByBatch(catalog): {batch: string; published: number; total: number}[]`.

- [ ] **Step 1: Write the failing tests** — `isSensitive` : niveau 2, niveau 3, `not_for_minors`, chacune des 4 articulations, une fiche non sensible ; `healthGreenLight` : validation sur N puis transitions sans changement de contenu → vrai ; contenu modifié → faux ; validation par l'auteur de la dernière modification de contenu → faux ; auteur au drapeau retiré → faux ; auteur supprimé (`reviewerId: null`) → faux ; admin au drapeau coché → faux ; `contentDiff` : `[]` sans changement, changement de `status` seul → `[]` ; `transitionBlockers` : un test par code, plus l'ordre quand plusieurs s'appliquent ; `catalog_full` à 300 fiches non retirées et pas à 299 ; files : une fiche publiée passée du niveau 1 au niveau 2 entre dans `revalidate` ; un `draft` n'est jamais dans `to_review`.
- [ ] **Step 2: Run** `pnpm --filter @rune/domain test catalog` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(domain): sensibilité, feu vert santé, blocages et files de relecture`.

### Task 4: Validateur du catalogue, style et glossaire

**Files:**
- Create: `packages/domain/src/catalog/validate.ts`, `packages/domain/test/catalog/validate.test.ts`, `scripts/data/validate.ts`, `scripts/tsconfig.json`, `docs/catalog/style-guide.md`, `data/glossary.json`
- Modify: `package.json` (scripts `data:validate`), `vitest.config.ts` (projet `scripts`, environnement node), `.github/workflows/ci.yml` (étape `pnpm data:validate`)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces : `validateCatalog(input: {sheets: {file: string; json: unknown}[]; manifest: IllustrationEntry[]; templates: unknown[]}): {ok: boolean; errors: {file: string; code: string; message: string}[]}` ; CLI `pnpm data:validate` (lit `data/`, sortie non nulle et une ligne par erreur si invalide).

- [ ] **Step 1: Write the failing tests** — un cas par refus de 04 §13 critère 1 (code hors taxonomie, `id` ≠ nom de fichier, alias en double après `normalize`, option de matériel en double ou incluse, modes de charge mélangés, pointeurs non réciproques, chaîne cyclique, ramifiée ou discontinue, membres sans muscle commun ou de groupes différents, niveau qui baisse, `reviewed`/`published` incomplète, illustration absente du manifeste ou d'empreinte différente, code de matériel inutilisé), plus : 301 fiches non retirées refusées et 300 acceptées ; une nouvelle fiche au statut autre que `draft` n'est pas refusée ici (c'est le chargeur qui décide, tâche 6) ; fichier non canonique refusé (`not_canonical`).
- [ ] **Step 2: Run** `pnpm vitest run --project domain catalog/validate` — FAIL.
- [ ] **Step 3: Implement** `validateCatalog` et le script ; écrire le guide de style (04 §8 étape 0, plus « une entrée de sécurité = 120 caractères au plus, dit quand s'arrêter, aucun vocabulaire médical ») et le glossaire (terme préféré, variantes refusées, équivalent anglais ; au moins : développé couché, charnière de hanche, dos neutre, RIR).
- [ ] **Step 4: Run** `pnpm data:validate` sur `data/` vide — sortie 0 ; R-EQ-5 (code inutilisé) n'est exigé qu'à partir de la première fiche publiée (`--strict` en CI une fois le lot A publié ; noter la règle dans le script).
- [ ] **Step 5: Commit** `feat(data): validateur du catalogue, guide de style et glossaire`.

### Task 5: Migration du catalogue et registre

**Files:**
- Create: `apps/server/src/db/migrations/0003_catalog.ts`, `apps/server/test/db/catalog-migration.test.ts`
- Modify: `apps/server/src/db/migrations/index.ts`, `packages/contracts/src/entity-rules.ts`, `packages/contracts/test/entity-rules.test.ts`, `apps/server/test/support/factories.ts`, `apps/server/test/__snapshots__/schema.sql`, `apps/server/test/db/{schema,upgrade,enum-consistency}.test.ts`, `apps/server/src/db/types.ts` (types Kysely)

**Interfaces:**
- Produces : tables `exercise` et `illustration` (colonnes de 04 « Modèle de données », plus `exercise.batch TEXT NOT NULL`), `exercise_comment`, `exercise_validation` (`UNIQUE (exercise_id, reviewer_id, revision)`), `exercise_revision` (clé `exercise_id, revision`), colonnes `user.catalog_reviewer` et `user.health_professional` (`INTEGER NOT NULL DEFAULT 0 CHECK (… IN (0,1))`). Les quatre clés vers `user` en `ON DELETE SET NULL`. Registre : `exercise` et `illustration` = C0, classe C (catalogue servi par `GET /api/catalog`, hors pull), `ownerColumn: null`, `exported: false`, `onUserDelete: 'set_null'` (`reviewed_by`) ; les trois tables de relecture = C0, classe H, `ownerColumn: null`, `exported: false`, `onUserDelete: 'set_null'`.

- [ ] **Step 1: Write the failing tests** — `catalog-migration.test.ts` : une base 0001+0002 avec des lignes migre sans perte et gagne les colonnes à 0 ; supprimer un compte qui a écrit un commentaire, une validation et une révision passe (aucune contrainte refusée) et ne laisse son id dans aucune cellule ; `upgrade.test.ts` : figer le schéma de la base après `0002_coach` (`fixtures/schema-v2.sql`, généré une fois depuis le `socle` de départ) et attendre `applied: ['0003_catalog']` depuis lui, le cas v1 restant couvert ; `entity-rules.test.ts` : lignes `EXPECTED` des 5 tables ; `mirroredTables()` inchangé (aucune des 5 tables).
- [ ] **Step 2: Run** `pnpm --filter @rune/server test db` et `pnpm --filter @rune/contracts test entity-rules` — FAIL.
- [ ] **Step 3: Implement** la migration (`breaking: false`), le registre, une fabrique par table, les constantes de `ENUMS`/`BOUNDS` dont le test de cohérence a besoin.
- [ ] **Step 4: Run** `pnpm test` — PASS (pull-leak, delete, export et admin-isolation restent verts sans changement de code).
- [ ] **Step 5: Commit** `feat(server): tables du catalogue et de la relecture, drapeaux de relecteur`.

### Task 6: Chargeur, bloc servi et version du catalogue

**Files:**
- Create: `apps/server/src/catalog/bundle.ts`, `apps/server/src/catalog/repo.ts`, `apps/server/test/catalog/bundle.test.ts`
- Modify: `apps/server/src/catalog/loader.ts`, `apps/server/src/catalog/routes.ts`, `packages/contracts/src/catalog.ts` (`CatalogBundle.exercises: ServedSheet[]`), `apps/server/test/catalog/{loader,routes}.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5.
- Produces : `loadCatalogFiles(deps)` (lit `data/exercises/*.json`, le manifeste, les modèles ; valide avec `validateCatalog`) ; `seedOrMergeCatalog(trx, files)` (règles de 04 §10 et spec §3.6 : `id` absent → insertion seulement si `draft`, sauf base vide où tout est inséré avec son statut ; `id` présent → ignoré ; manifeste → insertion ou mise à jour ; une ligne `exercise_revision` avec `saved_by` NULL par fiche insérée) ; `rebuildCatalog(trx, deps): CatalogBundle` (lit la base : fiches `published` et `retired` avec `published_at`, sans colonne éditoriale ni `batch` ; calcule `catalog_version` = sha256 de la forme canonique ; met à jour `server_meta` si elle change ; remplace le bloc en mémoire) ; `type ServedSheet` dans contracts.

- [ ] **Step 1: Write the failing tests** — deux chargements de suite ne changent rien ; une fiche déjà en base n'est jamais écrasée ; un fichier invalide n'écrit rien et l'appli démarre avec le catalogue en base ; base vide entièrement amorcée, statuts gardés ; nouvelle fiche `published` dans les fichiers sur base non vide → refusée et journalisée ; `GET /api/catalog` ne contient ni `draft`, ni `reviewed`, ni brouillon retiré, ni `review_notes`, `drafting`, `reviewed_by`, `reviewed_at`, `published_at`, `retired_at`, `exported_revision`, `batch` (critère 9 modifié) ; ETag = version et 304.
- [ ] **Step 2: Run** `pnpm --filter @rune/server test catalog` — FAIL.
- [ ] **Step 3: Implement** ; `CATALOG_STARTUP_TASK` appelle `loadCatalogFiles` → `seedOrMergeCatalog` → `rebuildCatalog` dans une transaction.
- [ ] **Step 4: Run** — PASS ; `apps/web/test/sync/catalog.test.ts` reste vert (forme du bloc inchangée).
- [ ] **Step 5: Commit** `feat(server): chargement des fiches en base et catalogue servi depuis la base`.

### Task 7: Drapeaux de relecteur et garde

**Files:**
- Create: `apps/server/src/admin/reviewer-flags.ts`, `apps/server/src/review/guard.ts`, `apps/server/test/admin/reviewer-flags.test.ts`
- Modify: `apps/server/src/auth/session.ts` (select + `SessionUser`), `apps/server/src/app-env.ts`, `apps/server/src/admin/routes.ts`, `apps/server/src/admin/members.ts` (`MemberSummary`), `apps/server/src/auth/me.ts` (`MeResponse`), `apps/server/src/auth/security-log.ts` (type `reviewer_flags_changed`), `packages/contracts/src/api/{admin,auth}.ts`, `docs/fiche-de-traitement.md` et `apps/web/src/features/public/privacy-content.ts` (drapeaux de relecteur : finalité, base légale = accord de la personne, visibilité ; commentaires et validations dans l'export ; exception à P-CAT-3), `apps/server/test/infra/docs.test.ts` (phrases vérifiées), et dans `docs/superpowers/specs/2026-10-06-appsport-design/` les lignes 02 R-ROLE-3 et 03 §5 et §13.4 (renvoi à la spec de la brique 2)

**Interfaces:**
- Produces : `SessionUser.catalogReviewer: boolean`, `SessionUser.healthProfessional: boolean` ; `requireReviewer` (middleware : 401 sans session, 403 si ni `catalogReviewer` ni admin) ; `POST /api/admin/members/:id/reviewer-flags` corps `SetReviewerFlagsRequest = {catalogReviewer: boolean; healthProfessional: boolean; password: string}` → 200 `MemberSummary` ; `MemberSummary` et `MeResponse` gagnent `catalogReviewer`, `healthProfessional`.

- [ ] **Step 1: Write the failing tests** — sans mot de passe valide : `invalid_credentials`, rien n'est écrit ; l'admin qui coche `healthProfessional` sur lui-même : 403 `self_health_flag` ; succès : `security_event` `reviewer_flags_changed` avec `details` avant/après ; retirer `catalogReviewer` coupe l'accès à `/api/review/*` dès la requête suivante ; `MeResponse` d'un membre porte ses propres drapeaux ; le `MemberSummary` d'un autre n'apparaît que dans `/api/admin/members`.
- [ ] **Step 2: Run** `pnpm --filter @rune/server test admin/reviewer-flags` — FAIL.
- [ ] **Step 3: Implement** sur le modèle de `POST /members/:id/role` (mot de passe vérifié hors transaction, puis transaction).
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat(server): drapeaux de relecteur, garde de la relecture et journal`.

### Task 8: API de relecture (commentaires, validations, files)

**Files:**
- Create: `apps/server/src/review/routes.ts`, `packages/contracts/src/api/review.ts`, `apps/server/test/review/{comments,validations,list,access}.test.ts`
- Modify: `apps/server/src/routes.ts` (monte `/api/review`), `apps/server/src/privacy/export.ts`, `packages/contracts/src/api/export.ts` (`reviewComments`, `reviewValidations`), `apps/server/test/privacy/export.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 7.
- Produces : routes du tableau §3.9 sous `/api/review` (liste avec `queue`, `batch`, `status` ; détail ; commentaire ; résolution ; validation). Contrats : `ReviewListItem`, `ReviewSheetResponse` (fiche selon le tableau de visibilité §3.1, `comments`, `greenLight: 'ok'|'missing'|'stale'`, `diff: string[] | null`, et `validations` nominatives pour l'admin seulement), `CreateCommentRequest {part, body, baseRevision}`, `ValidateRequest {baseRevision}`.

- [ ] **Step 1: Write the failing tests** —
  - `access.test.ts` : énumère toutes les routes de `ctx.app.routes` sous `/api/review/` et `/api/admin/` (reprendre `listRoutes` de `admin-isolation.test.ts`, déplacée dans `apps/server/test/support/routes.ts`) : membre → 403 sur les deux, relectrice → 403 sur `/api/admin/*` et non-403 sur `/api/review/*`, sans session → 401 ; plancher : au moins 5 routes de relecture ;
  - `comments.test.ts` : `part` hors liste → 400 ; `body` nettoyé (`\r\n` → `\n`, U+202E retiré), 1001 caractères → 400 ; commentaire sur révision dépassée accepté avec sa révision ; commenter une fiche `retired` → 409 `not_reviewable` ; « Traité » idempotent sans réécrire `resolved_at` ; relectrice qui résout le commentaire d'une autre → 403 ;
  - `validations.test.ts` : valider un `draft` → 409 `not_reviewable` ; `baseRevision` dépassée → 409 `revision_conflict` ; doublon → 200 et même id ; `health` copié = drapeau effectif ;
  - `list.test.ts` : chaque file rend exactement les fiches de son prédicat (fixture : un brouillon, une relue non sensible, une relue sensible sans feu vert, une publiée sensible modifiée) ; une relectrice ne reçoit jamais `drafting`, `reviewed_by`, ni l'auteur des feux verts ; tri `Intl.Collator('fr', {sensitivity:'base'})` puis `id` ;
  - `export.test.ts` : l'export d'une relectrice contient ses commentaires et validations, pas ceux des autres, pas les révisions.
- [ ] **Step 2: Run** `pnpm --filter @rune/server test review privacy/export` — FAIL.
- [ ] **Step 3: Implement** ; la liste appelle `reviewQueues` et `healthGreenLight` de la tâche 3, jamais une réimplémentation.
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat(server): relecture à plusieurs, commentaires, validations et files`.

### Task 9: Édition admin, transitions, révisions et export du catalogue

**Files:**
- Create: `apps/server/src/review/admin-routes.ts`, `apps/server/test/review/{edit,transitions,concurrency,catalog-version}.test.ts`, `scripts/data/pull.ts`, `scripts/data/pull.test.ts`
- Modify: `apps/server/src/admin/routes.ts` (monte `/exercises`), `apps/server/src/catalog/repo.ts`, `package.json` (script `data:pull`)

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 8.
- Produces : `PUT /api/admin/exercises/:id` `{sheet, baseRevision}` ; `POST /api/admin/exercises/:id/transition` `{to, baseRevision, reviewChecked?, minorsConfirmed?}` ; `GET /api/admin/exercises/export` (fichier `exercises-export.json`, toutes les fiches, forme canonique, met à jour `exported_revision`) ; `pnpm data:pull <fichier>` (découpe dans `data/exercises/`). Écriture = `BEGIN IMMEDIATE`, `UPDATE … WHERE id = ? AND revision = ?`, insertion de la ligne `exercise_revision` (`content` = `contentOf`), `rebuildCatalog`.

- [ ] **Step 1: Write the failing tests** —
  - `concurrency.test.ts` : deux `PUT` lancés par `Promise.all` depuis la même `baseRevision` → un 200 et un 409 `revision_conflict` avec `current`, dans n'importe quel ordre ; la fiche contient la première saisie seulement ; base périmée + blocages → 409 sans liste ;
  - `transitions.test.ts` : chaque transition permise ou interdite de 04 §8 complétée par le §3.6, réponse 422 `transition_blocked` avec `blockers` dans l'ordre ; refus de retirer une fiche citée par un modèle ; `retired → reviewed` à 300 → `catalog_full` ;
  - `edit.test.ts` : chaque écriture crée une ligne de révision dont `content` = `contentOf(fiche)` et ne contient aucun id de compte ; `PUT` d'une fiche publiée invalide → 422 `invalid_sheet` ;
  - `catalog-version.test.ts` : publier change `catalog_version` et `GET /api/catalog` sert la fiche ; modifier une fiche publiée sert le nouveau contenu et change la version ; écrire un brouillon ne la change pas ; commenter ne la change pas ;
  - `pull.test.ts` : aller-retour export → `data:pull` → chargement sur base vide → export identique octet pour octet (04 §13 critère 8).
- [ ] **Step 2: Run** `pnpm --filter @rune/server test review` et `pnpm vitest run --project scripts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat(server): édition des fiches avec contrôle de révision, transitions et export du catalogue`.

### Task 10: Client IA et rédaction des brouillons

**Files:**
- Create: `apps/server/src/ai/{client,fake,index}.ts`, `apps/server/test/ai/client.test.ts`, `scripts/exercises/{draft.ts,prompt-v1.md,NOTES.md}`, `scripts/exercises/draft.test.ts`
- Modify: `apps/server/package.json` (dépendance `@anthropic-ai/sdk`, version exacte), `package.json` (script `exercises:draft`), `.gitignore` (`.env.local` s'il n'y est pas)

**Interfaces:**
- Produces : `interface AiClient { complete<T>(req: {model: string; effort: 'low'|'medium'|'high'; system: CachedBlock[]; user: string; schema: object}): Promise<{value: T; stopReason: string; costUsd: number}> }` ; `createAnthropicClient({apiKey, model})` ; `createFakeAiClient(responses)` (déterministe) ; `pnpm exercises:draft [--ids a,b]` (04 §9 : seulement des `draft` aux champs IA vides ou les ids donnés, 4 appels en parallèle au plus, 2 essais, ne touche qu'aux champs IA, renseigne `drafting`, `revision` + 1, statut laissé à `draft`, écrit en forme canonique).

- [ ] **Step 1: Write the failing tests** — avec le faux client : refuse une fiche qui n'est pas `draft` ; ne modifie que les champs IA (les champs squelette sont octet pour octet identiques) ; rejette une sortie invalide après 2 essais et laisse le fichier intact ; lit `stop_reason` (`max_tokens` → erreur claire) ; aucun appel réseau en CI (le test échoue si `fetch` est appelé).
- [ ] **Step 2: Run** `pnpm vitest run --project scripts exercises` — FAIL.
- [ ] **Step 3: Implement** ; avant d'écrire le client, vérifier sur la documentation officielle d'Anthropic le modèle par défaut (`claude-opus-5-5` dans 04 §9), l'effort, la sortie structurée, le cache et les prix ; noter les valeurs et la date dans `scripts/exercises/NOTES.md`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(scripts): client IA et rédaction des brouillons de fiches`.

### Task 11: Illustrations, nettoyage des SVG et Crédits

**Files:**
- Create: `scripts/svg/{sanitize,check}.ts`, `scripts/svg/sanitize.test.ts`, `scripts/exercises/import-illustrations.ts`, `scripts/exercises/import-illustrations.test.ts`
- Modify: `package.json` (scripts `svg:check`, `illustrations:import`), `.github/workflows/ci.yml` (`pnpm svg:check`), `apps/web/src/features/public/` (page Crédits générée depuis le manifeste : fichier exact selon l'emplacement de la page Crédits après la refonte Task 13), son test

**Interfaces:**
- Produces : `sanitizeSvg(input: string): string` (liste blanche d'éléments ; retire `script`, `foreignObject`, attributs `on*`, liens externes ; ajoute le commentaire de crédit et de licence) ; `pnpm illustrations:import --source <dossier figé> --ids …` (copie seulement les fichiers utilisés, nom `<id>.<hash8>.<ext>`, empreinte sha256, entrée de manifeste avec `replace_before_public` selon 04 §12 règle 3) ; `pnpm svg:check` (40 Ko au plus par fichier, type des fichiers matriciels vérifié par leurs octets).

- [ ] **Step 1: Write the failing tests** — un SVG piégé (`<script>`, `onload`, `href` externe) ressort propre (04 §13 critère 11) ; 41 Ko → refus ; un PNG renommé en `.svg` → refus ; la page Crédits liste chaque illustration de chaque fiche publiée et la mention des textes de la spec §5.7, et reste lisible hors ligne.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test` et `pnpm svg:check` — PASS.
- [ ] **Step 5: Commit** `feat(scripts): import et nettoyage des illustrations, page Crédits générée`.

### Task 12: Dépôt du catalogue côté web et composant d'onglets

**Files:**
- Create: `apps/web/src/repos/catalog-repo.ts`, `apps/web/test/repos/catalog-repo.test.ts`, `apps/web/src/ui/Tabs.tsx`, `apps/web/test/ui/tabs.test.tsx`
- Modify: `apps/web/src/ui/index.ts`, `apps/web/src/ui/ui.module.css`

**Interfaces:**
- Consumes: Tasks 1, 2.
- Produces : `useCatalog(): {state: 'missing'|'loading'|'ready'; sheets: ServedSheet[]}` ; `useExerciseView(opts: {feasibleOnly: boolean}): {groups: {code; label; count}[]; place: {id; name; equipment: Set<EquipmentCode>} | null; cautious: boolean; maxLevel: 1|2|3}` ; `searchExercises(query, opts): {results: ServedSheet[]; hiddenByFeasible: number; hiddenByCautious: boolean}` ; `getSheetView(id): {sheet; usable: boolean; feasibleHere: boolean; chain: {easier?: ServedSheet; harder?: ServedSheet}; substitutes: ServedSheet[]}`. `Tabs` : props `{label: string; tabs: {id: string; label: string}[]; value: string; onChange(id): void; children(panelId): ReactNode}`, motif ARIA APG (flèches, Début, Fin, un seul onglet focalisable, `aria-controls`, panneau focalisable), cibles ≥ 44 px.

- [ ] **Step 1: Write the failing tests** — `catalog-repo.test.ts` (Dexie de test) : catalogue absent → `missing` ; compte des tuiles avec et sans filtre (fixture où une tuile change de nombre et une autre passe à 0) ; profil prudent : aucune fiche `not_for_minors` dans les groupes, la recherche ou les variantes, et `hiddenByCautious` vrai ; sans lieu principal : `place` null et tout le matériel ; `getSheetView` d'une fiche `not_for_minors` en profil prudent → `usable: false` ; `tabs.test.tsx` : flèches, Début, Fin, `aria-selected`, `aria-controls`, `tabIndex` à -1 sur les onglets inactifs.
- [ ] **Step 2: Run** `pnpm --filter @rune/web test repos/catalog-repo ui/tabs` — FAIL.
- [ ] **Step 3: Implement** ; le dépôt appelle `isUsable`, `visibleWithoutPlace`, `usableChainSteps` et `substitutes` de `@rune/domain`.
- [ ] **Step 4: Run** — PASS ; `architecture.test.ts` vert.
- [ ] **Step 5: Commit** `feat(web): dépôt du catalogue et composant d'onglets accessible`.

### Task 13: Fiche d'un exercice

**Files:**
- Create: `apps/web/src/features/exercises/ExerciseSheetPage.tsx`, `apps/web/src/features/exercises/exercises.module.css`, `apps/web/test/exercises/sheet.test.tsx`
- Modify: `apps/web/src/App.tsx` (route `/exercises/:id`), `apps/web/test/theme/contrast.test.ts` (paire avertissement / fond des 5 thèmes)

**Interfaces:**
- Consumes: Task 12 (`getSheetView`, `Tabs`).

- [ ] **Step 1: Write the failing tests** — en-tête (nom, pastilles, illustrations avec texte alternatif « <nom> : position de départ », crédit et lien Crédits) ; sans illustration : ni carte ni crédit ; illustration pas en cache : « Illustration disponible après synchronisation » ; encadré « Sécurité » (titre et icône) présent dans les trois onglets, placé sous la barre d'onglets ; `?tab=mistakes` ouvre Erreurs, valeur inconnue → Comment faire, changer d'onglet appelle `history.replaceState` (pas `pushState`) ; Erreurs : préfixes « Erreur : » et « Correction : » pour les lecteurs d'écran ; Variantes en profil prudent sans fiche `not_for_minors` ; fiche non utilisable ouverte par URL : bandeau « Cet exercice n'est pas proposé avec tes réglages actuels. » et contenu absent ; fiche retirée : bandeau « Cet exercice n'est plus proposé. » et « Voir des exercices proches » ou « Aucun exercice proche pour l'instant. » ; infaisable ici : mention « Pas faisable : <lieu> » ; contraste de l'encadré ≥ 4,5:1 dans les 5 thèmes.
- [ ] **Step 2: Run** `pnpm --filter @rune/web test exercises/sheet theme/contrast` — FAIL.
- [ ] **Step 3: Implement** selon la maquette `exercices-fiche.html` (choix B) et les jetons de la refonte.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): fiche d'exercice à onglets, sécurité toujours visible`.

### Task 14: Onglet Exercices, liste d'un groupe et lien depuis Progression

**Files:**
- Create: `apps/web/src/features/exercises/{ExercisesHome,GroupList}.tsx`, `apps/web/test/exercises/{home,group}.test.tsx`, `apps/web/e2e/exercises.spec.ts`
- Modify: `apps/web/src/App.tsx` (routes `/exercises`, `/exercises/group/:code`), `apps/web/src/ui/nav.ts` (ou le fichier qui porte `TAB_ITEMS` après la refonte : Accueil `/` · Exercices `/exercises` · Progression `/progression` · Profil `/profile` ; `/places…` et `/gyms…` → onglet Profil actif), `apps/web/src/features/progression/ProgressionPage.tsx` (import de `MUSCLE_GROUPS`, rang cliquable vers `/exercises/group/:code`), tests de la barre d'onglets et de Progression

**Interfaces:**
- Consumes: Tasks 12, 13.

- [ ] **Step 1: Write the failing tests** — 9 tuiles avec « Rang E » et le nombre ; nom accessible « Quadriceps, rang E, 18 exercices » ; interrupteur « Faisable : <lieu> » activé par défaut, état gardé en entrant dans un groupe ; sans lieu : ligne « Choisis ton lieu principal pour ne voir que ce que tu peux faire » vers Profil › Mes lieux ; tuile à 0 touchable → « Rien de faisable à <lieu> dans ce groupe » + « Tout voir » ; recherche : la saisie remplace les tuiles, état vide « Aucun exercice ne correspond. » + « N exercices masqués par le filtre Faisable · Les voir », phrase du mode prudent ; catalogue absent : « Le catalogue arrive… » en ligne, « Connecte-toi une fois pour récupérer les exercices. » hors ligne ; liste d'un groupe triée par niveau puis nom (collation française) avec « Niveau 1 sur 3, débutant » ; code de groupe inconnu → `/exercises` ; Retour depuis une fiche restaure la recherche et le défilement ; barre d'onglets : `aria-current` sur Exercices pour `/exercises…`, sur Profil pour `/places…` ; Progression : 9 rangs depuis `MUSCLE_GROUPS`, toucher « Ischios » ouvre `/exercises/group/hamstrings`. E2E : après une synchro, hors ligne, une fiche publiée s'ouvre avec ses illustrations (04 §13 critère 13), Chromium et WebKit.
- [ ] **Step 2: Run** `pnpm --filter @rune/web test exercises progression` — FAIL.
- [ ] **Step 3: Implement** selon la maquette `exercices-liste.html` (B puis liste de A).
- [ ] **Step 4: Run** `pnpm --filter @rune/web test` puis `pnpm --filter @rune/web test:e2e` — PASS.
- [ ] **Step 5: Commit** `feat(web): onglet Exercices, tuiles par muscle et lien depuis Progression`.

### Task 15: Dépôt de relecture et arrivée des relectrices

**Files:**
- Create: `apps/web/src/repos/review-repo.ts`, `apps/web/src/features/review/{ReviewHomeCard,HowToReview}.tsx`, `apps/web/test/review/{repo,arrival}.test.tsx`
- Modify: `apps/web/src/App.tsx` (garde `/review…` : page introuvable pour un non-relecteur, comme `/admin`), `apps/web/src/features/home/HomePage.tsx` (carte), `apps/web/src/features/profile/ProfileHub.tsx` (ligne « Relecture des exercices » dans le groupe Cercle), `apps/web/src/features/public/` (Aide : rappel « Comment relire »)

**Interfaces:**
- Consumes: Tasks 7, 8 (contrats `api/review.ts`).
- Produces : `reviewRepo.list(queue)`, `.get(id)`, `.comment(id, req)`, `.resolve(cid)`, `.validate(id, req)`, `.save(id, req)`, `.transition(id, req)`, `.exportCatalog()`, `.setReviewerFlags(memberId, req)` (classe H : hors ligne → l'erreur « Nécessite le réseau » existante ; 403 → `lostAccess`) ; brouillon de commentaire `commentDraft.get/set/clear(accountId, exerciseId)` en `localStorage` (clé `rune.review.draft.<compte>.<fiche>`), effacé à l'envoi, à la déconnexion (branché sur le nettoyage de déconnexion existant) et à la suppression du compte.

- [ ] **Step 1: Write the failing tests** — carte « Relecture : N fiches t'attendent » affichée seulement en ligne après une réponse réussie, jamais depuis un cache, absente à N = 0 ; N inclut `health_pending` et `revalidate` pour une relectrice santé ; ligne Profil visible seulement pour un relecteur ; `/review` pour un membre → page introuvable ; 403 en pleine session → « Tu n'as plus accès à la relecture. » et retour au Profil sans boucle ; « Comment relire » s'ouvre au premier passage (une fois par compte) et depuis Aide, avec les 5 mots ; brouillon de commentaire effacé à la déconnexion.
- [ ] **Step 2: Run** `pnpm --filter @rune/web test review` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): accès à la relecture, carte d'accueil et explication pour les relectrices`.

### Task 16: Écran de relecture (liste, fiche, commentaires, validation)

**Files:**
- Create: `apps/web/src/features/review/{ReviewList,ReviewSheet,CommentSheet,ValidateSheet}.tsx`, `apps/web/src/features/review/review.module.css`, `apps/web/test/review/{list,sheet,comment,validate}.test.tsx`
- Modify: `apps/web/src/App.tsx` (routes `/review/exercises`, `/review/exercises/:id`)

**Interfaces:**
- Consumes: Tasks 12 (`Tabs`, rendu de fiche de la tâche 13 réutilisé en aperçu), 15.

- [ ] **Step 1: Write the failing tests** — liste : avancement par lot (« Cœur · n / m publiées »), filtres « À relire », « Brouillons à commenter », « Feu vert santé », « À revalider », « Mes commentaires » avec compteurs, pastilles d'état ; fiche : valeurs de sensibilité écrites en clair ; bouton « Commenter » sur chaque partie ; libellé d'onglet « Erreurs · 1 commentaire » ; commentaires en texte brut (un `<b>` tapé s'affiche tel quel) ; feuille de commentaire avec « n / 1000 », phrase « Parle de la fiche, pas de ta santé ni de celle d'un membre. », brouillon restauré après une coupure ; relectrice non santé : bouton « J'ai relu, rien à redire » ; relectrice santé : « Sécurité vérifiée » ; feuille de confirmation qui rappelle la version ; « Fiche suivante » selon le filtre ; file vide : « Ta file est vide. Merci ! » ; une relectrice ne voit ni « Modifier » ni « Publier ».
- [ ] **Step 2: Run** `pnpm --filter @rune/web test review` — FAIL.
- [ ] **Step 3: Implement** selon la maquette `relecture.html`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): écran de relecture, commentaires et validations`.

### Task 17: Outils de l'admin et parcours de bout en bout

**Files:**
- Create: `apps/web/src/features/review/EditSheetForm.tsx`, `apps/web/test/review/{edit,publish}.test.tsx`, `apps/web/e2e/review.spec.ts`
- Modify: `apps/web/src/features/review/{ReviewList,ReviewSheet}.tsx`, `apps/web/src/features/admin/MembersPage.tsx` (feuille « Relecture » : deux interrupteurs et mot de passe ; l'interrupteur santé absent sur son propre compte), `apps/web/src/repos/admin-repo.ts`

**Interfaces:**
- Consumes: Tasks 9, 15, 16.

- [ ] **Step 1: Write the failing tests** — formulaire d'édition (champs de 04 §8, choix des illustrations limité à une source) ; « Publier » désactivé avec les messages du tableau §3.6 écrits dessous ; 409 : « La fiche a changé depuis que tu l'as ouverte. », version courante affichée et saisie gardée à côté ; bandeau « Publiée, feu vert santé à refaire » ; filtres admin (type de mouvement, sans illustration), compteurs « N fiches à exporter » et « à remplacer avant publication », bouton « Exporter le catalogue » ; feuille des drapeaux d'un membre. E2E (Chromium et WebKit) : une relectrice commente, l'admin corrige et marque traité, la relectrice santé valide, l'admin publie, puis un membre ouvre la fiche hors ligne.
- [ ] **Step 2: Run** `pnpm --filter @rune/web test review admin` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test` puis `pnpm --filter @rune/web test:e2e` — PASS.
- [ ] **Step 5: Commit** `feat(web): édition et publication des fiches, drapeaux des relecteurs, parcours complet`.

### Task 18: Fiches étalons, squelettes du lot A et pilote

**Files:**
- Create: `data/exercises/*.json` (2 étalons + squelettes du lot A provisoire), `docs/catalog/lot-a-provisoire.md`
- Modify: `docs/catalog/style-guide.md` (si les étalons le précisent), `scripts/exercises/NOTES.md`

**Interfaces:**
- Consumes: Tasks 4, 6, 10, 11.

- [ ] **Step 1: Write** deux fiches étalons à la main (une sans matériel en chaîne, `push-up` ; une sensible de salle, `dumbbell-romanian-deadlift`), statut `draft`, `batch` `A`, validées par `pnpm data:validate`.
- [ ] **Step 2: Write** `docs/catalog/lot-a-provisoire.md` : la liste provisoire du lot A tirée du tableau de 04 §7 (id, nom, pattern, chaîne, sensible oui/non), puis un squelette `draft` par ligne. **Arrêt : le propriétaire valide cette liste avant toute rédaction.**
- [ ] **Step 3: Run** `pnpm data:validate` — PASS ; un démarrage local (`pnpm dev`) charge les brouillons, visibles dans la relecture et absents de `GET /api/catalog`.
- [ ] **Step 4: Pilote** — le propriétaire pose la clé API dans `.env.local` ; `pnpm exercises:draft --ids <5 ids variés : une sensible, une sans matériel, une machine, une à chaîne>` ; les relecteurs relisent dans l'appli ; on ajuste `prompt-v2.md` et le glossaire, `prompt_version` + 1 ; coût réel noté dans `NOTES.md`.
- [ ] **Step 5: Commit** `feat(data): fiches étalons, squelettes du lot A et pilote de rédaction`.

---

## Couverture de la spec

| Spec | Tâches |
|---|---|
| §1 D1–D11 | 1, 4 (plafond) ; 7–8, 15–17 (D2–D4) ; 14 (D5, D7, D9) ; 10 (D6) ; 13 (D8) ; 16–17 (D10) ; 18 (D11) |
| §2 lots, plafond, `batch` | 1, 3, 4, 6, 9, 18 |
| §3.1 comptes et drapeaux | 5, 7, 15, 17 |
| §3.2–3.4 contenu, feu vert, commentaires, validations | 1, 3, 5, 8 |
| §3.5–3.7 révisions, transitions, version | 6, 9 |
| §3.8–3.9 files, API, export, suppression | 3, 5, 8, 9 |
| §4.1–4.3 écrans membres, groupes | 12, 13, 14 |
| §4.4–4.5 relectrices et relecture | 15, 16, 17 |
| §5 contenu, Crédits | 4, 10, 11, 18 |
| §7 critères 1–13 et 04 §13 | répartis comme indiqué dans chaque tâche |
| 04 §9 rédaction, §10 export, §11 diffusion, §12 illustrations | 6, 9, 10, 11, 14 |
