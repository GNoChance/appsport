### Task 14: Taxonomie du matériel, préréglages, réglages de charge, sports et textes versionnés

**Files:**
- Create: `packages/contracts/src/{taxonomy.ts, presets.ts, load-settings.ts, sports.ts, texts.ts}`, `packages/domain/src/text.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`
- Test: `packages/contracts/test/{taxonomy,load-settings,sports-texts}.test.ts`, `packages/domain/test/text.test.ts`

**Interfaces:**
- Consumes : `zod` ; squelette T1.
- Produces : Interfaces partagées §4 (`taxonomy.ts`, `presets.ts`, `load-settings.ts`, `sports.ts`, `texts.ts`, `domain/text.ts`).

**Spec:** 02 R-MAT-1, R-MAT-2, 04 R-EQ-1 à R-EQ-4, 04 §3.2 et §3.3, 02 §10.3 (R-CHG-1), 02 §8 E2, R-CST-1, 03 P-CST-1, 02 R-SAL-3, 02 §15 n°16.

- [ ] **Step 1: Write the failing test**

```ts
// taxonomy.test.ts
expect(EQUIPMENT).toHaveLength(23); expect(new Set(EQUIPMENT).size).toBe(23);
// les 5 catégories partitionnent EQUIPMENT (23 codes) ; household ['chair','table'] ; free_weights ['barbell','ez_bar'] ;
// small_equipment ['resistance_band','dumbbells','kettlebell','pull_up_bar','suspension_trainer','box']
expect(EQUIPMENT_LABELS.squat_rack).toBe('Cage ou supports à squat avec sécurités'); expect(EQUIPMENT_LABELS.chair).toBe('Chaise ou banc stable');
expect(EQUIPMENT_IMPLIES).toEqual({ adjustable_bench: ['flat_bench'] });   // R-EQ-2
// REFERENCE_PROFILES (04 §3.3) : home_bodyweight ['chair','table'] ; home_small_equipment = chair, table, pull_up_bar, resistance_band, dumbbells ;
//   gym_reference 14 codes, sans kettlebell, smith_machine, ez_bar, back_extension_bench, box, resistance_band, suspension_trainer
expect(EquipmentCodeSchema.safeParse('cardio').success).toBe(false);
// préréglages (R-MAT-2) : 7 ids ; gym_large = EQUIPMENT hors household ; home_none = home_bodyweight ; home_small = home_small_equipment ; HOME_DEFAULT_PRESET 'home_none'
// gym_small = dumbbells, barbell, ez_bar, flat_bench, adjustable_bench, squat_rack, cable_station, lat_pulldown, seated_row, leg_press, pull_up_bar, dip_station
// gym_crossfit = barbell, squat_rack, dumbbells, kettlebell, flat_bench, pull_up_bar, suspension_trainer, box, resistance_band
// home_gym = chair, table, pull_up_bar, resistance_band, dumbbells, kettlebell, barbell, squat_rack, flat_bench ; gym_other = []
// kind 'gym' pour gym_*, 'home' sinon ; aucun code household dans un préréglage de salle (R-EQ-3)
// load-settings.test.ts (02 §10.3)
expect(defaultLoadSettings('gym')).toEqual({ barG: 20000, smallestPlateG: 1250, dumbbellsG: Array.from({ length: 20 }, (_, i) => 2000 * (i + 1)), machineStepG: 5000 });
expect(defaultLoadSettings('home')).toEqual({ barG: 20000, smallestPlateG: 1250, dumbbellsG: [], machineStepG: 5000 });   // copie neuve à chaque appel
// refusés : barG 4999, 25001, 20000.5 ; smallestPlateG 249, 5001 ; machineStepG 499, 10001 ; dumbbellsG [4000, 2000], [2000, 2000], 61 valeurs, [400], [80500] ;
//   clé inconnue barKg ; champ manquant
// acceptés : 60 haltères de 500 à 30000 ; bornes barG 5000/25000, smallestPlateG 250/5000, machineStepG 500/10000, dumbbellsG [80000]
// sports-texts.test.ts
expect(SPORTS).toHaveLength(15); expect(SPORTS.map((s) => s.code)).toEqual([...SPORT_CODES]);
expect(SPORTS.find((s) => s.code === 'other')?.label).toBe('Autre'); expect(SPORTS.find((s) => s.code === 'running')?.label).toBe('Course à pied');
expect(SPORTS_LIST_VERSION).toBe(1); expect(SPORT_OTHER_LABEL_MAX).toBe(40); expect(SportCodeSchema.safeParse('golf').success).toBe(false);
expect(HEALTH_CONSENT_TEXT.version).toBe('1.0'); expect(HEALTH_CONSENT_TEXT.text).toMatch(/^J'accepte qu'appsport enregistre mes données de santé/);
expect(HEALTH_CONSENT_TEXT.text).toMatch(/elles seront alors supprimées\.$/);
expect(HEALTH_QUESTIONNAIRE.version).toBe('1.0'); expect(HEALTH_QUESTIONNAIRE.questions).toHaveLength(4);   // chacune finit par '?'
expect(majorOf('1.2')).toBe(1); expect(majorOf('12.0')).toBe(12); expect(() => majorOf('abc')).toThrow(); expect(() => majorOf('1')).toThrow();
// text.test.ts (R-SAL-3)
it.each([['Basic-Fit  Lyon Part-Dieu', 'basic fit lyon part dieu'], ['Salle Énergie', 'salle energie'],
  ["L'Orange Bleue — Saint-Étienne", 'l orange bleue saint etienne'], ['  Fitness   Park!! ', 'fitness park'], ['Crossfit 69', 'crossfit 69'], ['', '']])
  ('%s → %s', (i, o) => expect(normalize(i)).toBe(o));
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/contracts test -- taxonomy load-settings sports-texts` et `pnpm --filter @appsport/domain test -- text` → « does not provide an export named EQUIPMENT ».

- [ ] **Step 3: Implement**

Catégories (ordre interne) : `household` chair, table ; `small_equipment` resistance_band, dumbbells, kettlebell, pull_up_bar, suspension_trainer, box ; `benches_racks` flat_bench, adjustable_bench, squat_rack, dip_station, back_extension_bench ; `free_weights` barbell, ez_bar ; `machines` cable_station, lat_pulldown, seated_row, leg_press, smith_machine, leg_extension, leg_curl, upper_body_machines. `gym_reference` = dumbbells, barbell, squat_rack, flat_bench, adjustable_bench, dip_station, pull_up_bar, cable_station, lat_pulldown, seated_row, leg_press, leg_extension, leg_curl, upper_body_machines.

Textes exacts :
- `EQUIPMENT_LABELS` : chair « Chaise ou banc stable » ; table « Table solide (rowing sous la table) » ; resistance_band « Élastiques (bandes, avec poignées ou mini-bandes) » ; dumbbells « Haltères fixes ou réglables » ; kettlebell « Kettlebell » ; pull_up_bar « Barre de traction » ; suspension_trainer « Sangles de suspension ou anneaux » ; box « Box ou step stable » ; flat_bench « Banc plat » ; adjustable_bench « Banc inclinable » ; squat_rack « Cage ou supports à squat avec sécurités » ; dip_station « Barres parallèles » ; back_extension_bench « Banc à lombaires (45° ou GHD) » ; barbell « Barre droite et disques » ; ez_bar « Barre EZ » ; cable_station « Poulie réglable ou vis-à-vis » ; lat_pulldown « Tirage vertical » ; seated_row « Tirage horizontal assis » ; leg_press « Presse à cuisses » ; smith_machine « Barre guidée (Smith) » ; leg_extension « Leg extension » ; leg_curl « Leg curl » ; upper_body_machines « Machines guidées du haut du corps (développé, pec deck, épaules) ».
- Préréglages : gym_large « Grande salle ou chaîne », gym_small « Petite salle de quartier », gym_crossfit « Box de cross-training », gym_other « Autre », home_none « Sans matériel », home_small « Petit matériel », home_gym « Home gym ».
- Sports : running « Course à pied », cycling « Vélo », swimming « Natation », football « Football », rugby « Rugby », basketball « Basket », handball « Handball », tennis « Tennis », padel « Padel », badminton « Badminton », combat_sports « Sports de combat », climbing « Escalade », skiing « Ski », dance « Danse », other « Autre ».
- `HEALTH_CONSENT_TEXT.text` : « J'accepte qu'appsport enregistre mes données de santé : limitations et zones sensibles, réponses de prudence, douleurs signalées pendant les séances, taille, poids, profil et suivi nutritionnels. Elles servent uniquement à adapter mes séances et mes repères. Elles restent sur le serveur du cercle et l'administrateur ne les consulte pas dans l'appli. Je peux retirer cet accord à tout moment : elles seront alors supprimées. »
- Questions v1.0 (à faire relire par l'admin avant la mise en service, ce qui changera la version) : « As-tu un problème cardiaque connu, ou pratiques-tu une activité physique sous surveillance médicale ? » ; « As-tu ressenti une douleur à la poitrine pendant un effort, ou perdu connaissance, au cours des 12 derniers mois ? » ; « As-tu une maladie ou un traitement qui limite ton activité physique ? » ; « As-tu un problème d'os, d'articulation ou de muscle qui s'aggrave à l'effort ? »

`LoadSettings` : `z.strictObject`, entiers bornés, `dumbbellsG` `.max(60)` et strictement croissant. `majorOf` accepte `/^\d+\.\d+$/`. `normalize` : minuscules → NFD sans `\p{M}` → suites hors `[\p{L}\p{N}]` remplacées par une espace → `trim`.

- [ ] **Step 4: Run test to verify it passes**

Mêmes commandes → vert ; `pnpm typecheck` et `pnpm lint`.

- [ ] **Step 5: Commit**

`git commit -m "feat(profil): taxonomie du matériel, préréglages, réglages de charge et textes versionnés"`

---

### Task 15: recommendTemplate, objectifs et reprise de l'onboarding

**Files:**
- Create: `packages/contracts/src/api/profile.ts` (objectifs, expérience), `packages/domain/src/{recommend-template.ts, onboarding.ts}`, `packages/domain/test/fixtures/templates.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/test/{recommend-template,onboarding}.test.ts`

**Interfaces:**
- Consumes : `ONBOARDING_STEPS`, `OnboardingStep` (T10) ; `AgeBand` (T2).
- Produces : Interfaces partagées §4 (`GOALS`, `Goal`, `EXPERIENCES`, `Experience`, `GOAL_LABELS`, `EXPERIENCE_LABELS` ; `recommend-template.ts` ; `onboarding.ts`). Support local :
```ts
// packages/domain/test/fixtures/templates.ts
export const FAKE_TEMPLATES: readonly TemplateDescriptor[];   // 6 modèles factices ci-dessous
export function withUnavailable(ids: readonly string[]): TemplateDescriptor[];   // copie, ces ids à available = false
```

**Spec:** 02 §9 R-REC-1 à R-REC-8, 05 §3 (règles 1 à 4), 02 R-ONB-2, §8 E1, §15 n°11 et n°12.

- [ ] **Step 1: Write the failing test**

`FAKE_TEMPLATES` : `gym-beginner-full-body-ab` (gym, beginner, 2..3), `gym-intermediate-upper-lower` (gym, intermediate, 3..4), `home-beginner-full-body` (home, beginner, 2..3), `home-intermediate-upper-lower` (home, intermediate, 3..4), `sport-beginner-complement` (sport, beginner, 2..2), `sport-intermediate-strength-prevention` (sport, intermediate, 2..2), tous disponibles.
```ts
// recommend-template.test.ts : 240 cas (5 objectifs × sportCode null|'football' × gym|home × 4 expériences × 2|3|4 jours)
// contexte attendu = goal === 'sport_support' && sportCode ? 'sport' : primaryPlaceKind ; niveau de l'expérience ; oracle écrit à la main :
// gym|home beginner : 2 → full-body 2 ; 3 → 3 ; 4 → 3 ['DAYS_ADJUSTED']
// gym|home intermediate : 2 → <contexte>-beginner-… 2 ['FEW_DAYS_FULL_BODY'] ; 3 → upper-lower 3 ; 4 → upper-lower 4
// sport beginner : 2 → sport-beginner-complement 2 ; 3 et 4 → 2 ['DAYS_ADJUSTED'] ; sport intermediate : idem avec sport-intermediate-strength-prevention
expect(EXPERIENCES.map(levelFromExperience)).toEqual(['beginner', 'beginner', 'intermediate', 'intermediate']);   // R-REC-2
// R-REC-1 : sport_support avec sportCode null, '' ou '   ' → contexte du lieu
const base = { goal: 'muscle', sportCode: null, primaryPlaceKind: 'gym', experience: 'gt_24_months', daysPerWeek: 2 };
expect(recommendTemplate(base, FAKE_TEMPLATES)).toEqual({ templateId: 'gym-beginner-full-body-ab', context: 'gym', level: 'beginner', daysPerWeek: 2, reasons: ['FEW_DAYS_FULL_BODY'] });
expect(recommendTemplate({ ...base, daysPerWeek: 4 }, withUnavailable(['gym-intermediate-upper-lower'])))
  .toEqual({ templateId: 'gym-beginner-full-body-ab', context: 'gym', level: 'beginner', daysPerWeek: 3, reasons: ['DAYS_ADJUSTED'] });   // R-REC-4
expect(recommendTemplate(base, withUnavailable(['gym-beginner-full-body-ab'])))
  .toEqual({ templateId: 'gym-intermediate-upper-lower', context: 'gym', level: 'intermediate', daysPerWeek: 3, reasons: ['FEW_DAYS_FULL_BODY', 'DAYS_ADJUSTED'] });
expect(recommendTemplate({ ...base, daysPerWeek: 4 }, withUnavailable(['gym-beginner-full-body-ab', 'gym-intermediate-upper-lower'])))
  .toEqual({ templateId: null, context: 'gym', level: 'intermediate', daysPerWeek: 4, reasons: ['NO_TEMPLATE_AVAILABLE'] });
// R-REC-5 : DAYS_ADJUSTED seulement si les jours changent ; propriétés fast-check : jours dans [min, max] d'un modèle disponible du bon contexte
//   (ou null + NO_TEMPLATE_AVAILABLE), contexte sport ⇔ sport_support et sportCode non vide, résultat déterministe
// onboarding.test.ts (R-ONB-2)
expect(ONBOARDING_STEPS).toEqual(['goal','sport','place_kind','place','experience','availability','health','ready']);
```

| État (`full` = muscle, none, 3 j, 45 min, lieu principal) | `firstIncompleteStep` |
|---|---|
| rien | `goal` |
| goal + validé `goal` ; validé `sport` | `sport` ; `place_kind` |
| validé `place_kind` sans lieu | `place_kind` |
| lieu principal, validé `sport` | `experience` |
| lieu + expérience, validé `experience` ; `full` sans `sessionMinutes` | `availability` |
| `full` validé `availability` ; validé `health` ; validé `ready` | `health` ; `ready` ; `ready` |
| `full` validé `goal` (retour arrière) | `sport` |
| `full` sans `goal`, validé `health` ; `full` sans lieu, validé `health` | `goal` ; `place_kind` |

```ts
expect(availableGoals('minor')).toEqual(['muscle','strength','fitness','sport_support']);   // E1, 02 §15 n°11
expect(availableGoals('adult')).toEqual(['muscle','strength','fat_loss','fitness','sport_support']);
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/domain test -- recommend-template onboarding` → `recommendTemplate`, `firstIncompleteStep`, `GOALS` introuvables.

- [ ] **Step 3: Implement**

Libellés : `GOAL_LABELS` muscle « Prendre du muscle », strength « Gagner en force », fat_loss « Perdre du gras », fitness « Forme et santé », sport_support « Me renforcer pour mon sport » ; `EXPERIENCE_LABELS` none « Jamais », lt_6_months « Moins de 6 mois », 6_to_24_months « 6 mois à 2 ans », gt_24_months « Plus de 2 ans ».

`recommendTemplate` (ordre R-REC-1 à R-REC-5 ; aucun paramètre d'âge ni de prudence, R-REC-6) :
```ts
const find = (ctx, lvl) => templates.find((t) => t.context === ctx && t.level === lvl);
const context = input.goal === 'sport_support' && input.sportCode?.trim() ? 'sport' : input.primaryPlaceKind;
let level = levelFromExperience(input.experience); const reasons: RecommendReason[] = [];
if (level === 'intermediate') { const inter = find(context, 'intermediate');          // R-REC-3 : bornes du descripteur, même indisponible
  if (inter && input.daysPerWeek < inter.days.min) { level = 'beginner'; reasons.push('FEW_DAYS_FULL_BODY'); } }
let tpl = find(context, level);
if (!tpl?.available) { const other = find(context, level === 'beginner' ? 'intermediate' : 'beginner');   // R-REC-4
  if (!other?.available) return { templateId: null, context, level: levelFromExperience(input.experience), daysPerWeek: input.daysPerWeek, reasons: [...reasons, 'NO_TEMPLATE_AVAILABLE'] };
  tpl = other; }
const days = Math.min(Math.max(input.daysPerWeek, tpl.days.min), tpl.days.max);      // R-REC-5
if (days !== input.daysPerWeek) reasons.push('DAYS_ADJUSTED');
return { templateId: tpl.id, context, level: tpl.level, daysPerWeek: days, reasons };
```
`firstIncompleteStep` (`validated(s)` = `lastValidatedStep` d'index ≥ `s`) : `goal` nul → `goal` ; `!validated('sport')` → `sport` ; pas de lieu principal → `place_kind` ; `experience` nul → `experience` ; jours ou durée nuls → `availability` ; `!validated('health')` → `health` ; sinon `ready`.

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert (240 cas, cas ciblés, 3 propriétés, 13 cas d'onboarding) ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(profil): recommendTemplate et reprise de l'onboarding"`

---

### Task 16: Profil d'entraînement et fin de l'onboarding côté serveur

**Files:**
- Modify: `packages/contracts/src/api/profile.ts` (`DAYS_PER_WEEK`, `SESSION_MINUTES`, `TrainingProfilePatch`), `apps/server/src/routes.ts` (`app.route('/api/me', profileRoutes(deps))`), `apps/server/test/support/index.ts`
- Create: `apps/server/src/profile/routes.ts`, `apps/server/test/support/onboarding.ts`
- Test: `apps/server/test/profile/{training-profile,onboarding-complete}.test.ts`

**Interfaces:**
- Consumes : T6 (`AppDeps`, `AppEnv`, `httpError`, `parseJson`) ; T4a (`writeStamp`) ; T9 (`requireUser`) ; T10 (`buildMe`, `MeResponse`, `OnboardingStep`, `createUserAndLogin`) ; T2 (`ageBandOn`, `parisDate`) ; T15 (`availableGoals`, `firstIncompleteStep`, `Goal`, `Experience`) ; T14 (`SportCodeSchema`, `SPORT_OTHER_LABEL_MAX`, `defaultLoadSettings`) ; T5 (`insertFixtureRow`).
- Produces : Interfaces partagées §4 (`DAYS_PER_WEEK`, `SESSION_MINUTES`, `TrainingProfilePatch`, `profileRoutes`) et §2 (support `completeOnboarding` : profil muscle, none, 3 j, 45 min, `onboardingStep 'health'`, lieu maison principal par `insertFixtureRow`, `POST /api/me/onboarding/complete` attendu à 200).

**Spec:** 02 R-ONB-1 à R-ONB-3, §8 E1, E2, E5, E6, R-AGE-5, R-AGE-6, R-CST-7, §15 n°11, 03 P-MIN-8, Global Constraints « Ajouts au modèle » (3) et (4).

- [ ] **Step 1: Write the failing test**

```ts
// training-profile.test.ts
// premier PATCH { goal: 'muscle', onboardingStep: 'goal' } → 200 et ligne { id: u.id, ownerId: u.id, goal: 'muscle', experience: null, daysPerWeek: null,
//   sessionMinutes: null, sportCode: null, sportOtherLabel: null, cautiousMode: 0, updatedBy: u.id, deletedAt: null } ; user.onboarding_step 'goal'
// PATCH suivant { experience: 'lt_6_months', daysPerWeek: 3, sessionMinutes: 45 } → fusion, rev augmenté ; { onboardingStep: 'place_kind' } seul crée la ligne vide
// même valeur renvoyée → pas de nouveau rev
it.each([[{ daysPerWeek: 5 }], [{ daysPerWeek: 1 }], [{ sessionMinutes: 50 }], [{ goal: 'cardio' }], [{ experience: 'expert' }], [{ sportCode: 'golf' }], [{ unknown: 1 }]])
  ('400 validation pour %o', /* (await res.json()).error === 'validation' */);
// fat_loss : mineur (birthDate '2009-10-07') → 400 validation ; majeur → 200 (E1)
// E2 : goal sport_support puis { sportCode: null, onboardingStep: 'sport' } → 400 ; { sportCode: 'tennis', onboardingStep: 'sport' } → 200
// sportOtherLabel : avec 'tennis' → 400 ; 41 caractères → 400 ; 'Ultimate' avec 'other' → 200 ; passage à 'rugby' → sportOtherLabel NULL
// cautiousMode true → me.cautious true ; false → false et cautiousMode 0 (R-CST-7)
// mineur ('2008-10-07') : { ageBand: 'minor', cautious: true } ; à '2026-10-06T22:30:00.000Z' → { ageBand: 'adult', cautious: false }, profil inchangé, fat_loss → 200 (R-AGE-6)
// sans session → 401
// onboarding-complete.test.ts (R-ONB-1)
expect(await res.json()).toEqual({ error: 'onboarding_incomplete', step: 'goal' });   // 409 ; après profil sans lieu → step 'place_kind' ; validé 'availability' → 'health'
// profil + lieu principal + validé 'health' → 200, onboardingCompletedAt '2026-10-06T10:00:00.000Z', inchangé à un second appel (+60 s)
// après completeOnboarding, PATCH { goal: 'strength', onboardingStep: 'goal' } → 200 mais user.onboarding_step reste 'health' (R-ONB-3)
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- training-profile onboarding-complete` → 404 et `completeOnboarding` non exporté.

- [ ] **Step 3: Implement**

`profileRoutes` : `requireUser` sur chaque route, jamais `use('*')` (d'autres routeurs partagent `/api/me`). PATCH en transaction : état fusionné ; refus `validation { field }` pour un `goal` hors `availableGoals(ageBand)`, pour `sport_support` sans `sportCode` à l'étape `sport`, pour un `sportOtherLabel` sans `sportCode 'other'` (colonne remise à NULL si le sport n'est pas `other`) ; insertion ou mise à jour des seules colonnes changées avec `writeStamp` ; `onboardingStep` écrit seulement si `onboarding_completed_at` est NULL ; réponse `buildMe`. POST `/onboarding/complete` : `firstIncompleteStep` (lieu principal = `place` actif `is_primary = 1`) ≠ `ready` → `onboarding_incomplete { step }` ; sinon `onboarding_completed_at` posé une seule fois.

- [ ] **Step 4: Run test to verify it passes**

Même commande → vert ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(profil): profil d'entraînement et fin de l'onboarding"`

---

### Task 17: Salles partagées (création, doublons, droits, matériel, historique, visibilité, suppression)

**Files:**
- Create: `packages/contracts/src/api/places.ts` (salles), `apps/server/src/places/{place-rows.ts, gyms.ts, gym-routes.ts}`
- Modify: `packages/contracts/src/index.ts`, `apps/server/src/admin/routes.ts` (`DELETE /gyms/:id`), `apps/server/src/routes.ts` (`/api/gyms`)
- Test: `apps/server/test/places/gyms.test.ts`

**Interfaces:**
- Consumes : T6 (`httpError`, `parseJson`, `parseQuery`, `clientIp`) ; T4a (`writeStamp`, `DbExecutor`) ; T9 (`requireUser`, `requireAdmin`, `logSecurityEvent`) ; T12 (`adminRoutes`) ; T14 (`normalize`, `EquipmentCodeSchema`, `EQUIPMENT`, `EQUIPMENT_CATEGORIES`, `LoadSettings`, `defaultLoadSettings`) ; T2 (`ageBandOn`, `parisDate`).
- Produces : Interfaces partagées §4 (`GymEquipmentCode`, `GymHistoryAction`, `GymSummary`, `GymDetail`, `CreateGymRequest`, `CreateGymResponse`, `UpdateGymRequest`, `demotePrimaries`, `insertGymPlace`, `deleteGymAsAdmin`, `gymRoutes`) et routes `/api/gyms*`, `DELETE /api/admin/gyms/:id`.

**Spec:** 02 R-SAL-1 à R-SAL-7, R-CHG-1, R-CHG-3, R-VIS-1 à R-VIS-5, R-EQ-3, 03 P-MIN-6, 01 R-SYN-3, R-SYN-21, 02 §15 n°15 à n°17.

- [ ] **Step 1: Write the failing test**

```ts
// gyms.test.ts — createGym(a) = POST /api/gyms { name: 'Basic-Fit Part-Dieu', city: 'Lyon', equipment: ['barbell', 'squat_rack'], isPrimary: true }
// création (R-SAL-2, R-SAL-3, R-CHG-1) : 201 { gymId, placeId } ;
expect(gym).toMatchObject({ name: 'Basic-Fit Part-Dieu', nameKey: 'basic fit part dieu', city: 'Lyon', cityKey: 'lyon', createdBy: a.id, deletedAt: null });
expect(JSON.parse(gym.loadSettings)).toEqual(defaultLoadSettings('gym'));
// gym_equipment [[`${id}:barbell`,'barbell',a.id,null],[`${id}:squat_rack`,'squat_rack',a.id,null]] ; place { kind: 'gym', isPrimary: 1, visibleAtGym: 1, loadSettings: null, name: null } ;
// un gym_history { action: 'create', authorId: a.id }
// doublon { name: 'BASIC FIT  part-dieu', city: ' lyon ' } → 409 { error: 'gym_duplicate', gymId: id }
// household refusé à la création (['chair']) et en PUT ('table') ; code 'cardio' → 400 ; nom 'X' ou ville de 61 caractères → 400 (R-EQ-3)
// mineur : lieu visibleAtGym 0 par défaut, 1 s'il le demande (P-MIN-6)
// recherche (R-SAL-1) : /api/gyms → [id] ; ?q=PART → [id] ; ?q=marseille → [] ; /similar?name=basic fit&city=Villeurbanne → [id] ;
//   /similar?name=Fitness Park&city=LYON → [id] ; /similar?name=Keep Cool&city=Paris → []
// droits (R-SAL-4, 02 §15 n°15) : membre sans lieu actif à la salle → PATCH et PUT 403 forbidden ; admin → 204 ; canEdit false pour b, true pour a ; salle inconnue → 404
// matériel (R-SAL-5) : PUT ×2 → même rev ; DELETE → tombstone, rev augmenté ; DELETE ×2 → même rev ; PUT → deletedAt null ;
//   detail.equipment ['dumbbells','squat_rack','barbell'] (ordre de EQUIPMENT) ; historique ['create','add_equipment','remove_equipment','add_equipment']
// deux PUT simultanés (leg_press, lat_pulldown) → 204, 204 et l'union ['lat_pulldown','leg_press']
// modification (R-SAL-6, R-CHG-3) : name 'Basic Fit Gerland' → nameKey 'basic fit gerland' ; 'KEEP-COOL' (autre salle) → 409 ; barG 30000 → 400 ; {} → 400 ; barG 15000 → 204
// 12 PATCH alternés puis suppression du compte de b → history de 10 lignes, h[0] { action: 'update_info', detail: { city: { from: 'Lyon 10', to: 'Lyon 11' } } }, h[1].authorUsername null
// visibilité (R-VIS-1 à R-VIS-5, 02 §15 n°17) : mineur invisible, invisible, désactivé et supprimé ne comptent pas → visibleMembers ['lea'], visibleMemberCount 1
// suppression admin (R-SAL-7) : membre → 403 ; lieu actif → 409 gym_in_use ; sans lieu actif → 204, deletedAt '2026-10-06T10:00:00.000Z', rev augmenté,
//   gym_deleted { actorId: admin.id, targetId: id } ; liste vide ; détail avec deletedAt ; PATCH et seconde suppression → 404
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- gyms` → `POST /api/gyms` renvoie 404.

- [ ] **Step 3: Implement**

- Une transaction par écriture, un `writeStamp` par ligne écrite ; `/similar` déclaré avant `/:id`.
- Recherche : salles non supprimées triées par `name_key` ; `q` normalisé inclus dans `name_key` ou `city_key`. `/similar` : critère de moins de 2 caractères ignoré ; correspondance si l'une des clés contient l'autre (nom **ou** ville).
- Doublon contrôlé avant insertion, y compris contre une salle supprimée (contrainte `UNIQUE` globale).
- Historique : `create { name, city, equipment }` ; `update_info { name?: {from,to}, city?: {from,to} }` ; `update_load_settings { from, to }` ; `add_equipment` / `remove_equipment { code }` seulement s'il y a écriture ; détail = 10 dernières lignes `ORDER BY at DESC, id DESC`, auteur par `LEFT JOIN user`.
- `insertGymPlace` : `place_exists` si un lieu actif renvoie à la salle ; `visibleAtGym` par défaut majeur 1, mineur 0 ; aucun lieu actif → principal d'office ; `isPrimary` → `demotePrimaries` avant insertion.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- gyms` → vert ; `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 5: Commit**

`git commit -m "feat(salles): salles partagées, matériel, historique et visibilité"`

---

### Task 18: Lieux de l'utilisateur (salle et maison, lieu principal, suppression)

**Files:**
- Modify: `packages/contracts/src/api/places.ts` (lieux), `apps/server/src/routes.ts` (`/api/places`)
- Create: `apps/server/src/places/{places.ts, place-routes.ts}`
- Test: `apps/server/test/places/places.test.ts`

**Interfaces:**
- Consumes : tout ce que consomme T17, plus `insertGymPlace`, `demotePrimaries` (T17), `completeOnboarding` (T16).
- Produces : Interfaces partagées §4 (`HOME_PLACE_DEFAULT_NAME`, `CreatePlaceRequest`, `CreatePlaceResponse`, `UpdatePlaceRequest`, `DeletePlaceRequest`, `placeRoutes`) et routes `/api/places*`.

**Spec:** 02 R-LIEU-1 à R-LIEU-5, R-VIS-3, R-CHG-1, R-CHG-3, R-EQ-3, R-EQ-4, §8 E3/E4, 03 P-ADM-2, 02 §15 n°14 et n°16.

- [ ] **Step 1: Write the failing test**

```ts
// places.test.ts
// maison (R-LIEU-3) : POST { kind: 'home', equipment: ['chair','table','dumbbells','dumbbells'], isPrimary: true } → 201 ;
//   place { kind: 'home', name: 'Maison', gymId: null, isPrimary: 1 } ; loadSettings = defaultLoadSettings('home') ;
//   home_equipment [[`${id}:chair`,u.id,null],[`${id}:dumbbells`,u.id,null],[`${id}:table`,u.id,null]]
// nom de 31 caractères → 400 ; plusieurs maisons possibles
// matériel maison idempotent (PUT kettlebell ×2, DELETE chair ×2 → actifs ['kettlebell','table']) ; PUT sur un lieu salle → 400
// salle (R-LIEU-2) : second lieu actif sur la même salle → 409 place_exists ; salle inconnue → 404
// visibilité : mineur → 0, PATCH { visibleAtGym: true } → 204 et 1 ; visibleAtGym sur une maison → 400 (R-VIS-3)
// lieu salle : loadSettings ou name → 400 (R-CHG-3) ; maison : dumbbellsG [2000, 4000] → 204, barG 4999 → 400, name 'Appart' → 204
// principal (R-LIEU-4) : premier lieu principal d'office ; isPrimary true sur un autre → il devient le seul ; { isPrimary: false } → 400
// suppression (R-LIEU-1, R-LIEU-5) : dernier lieu après l'onboarding → 409 last_place ; principal sans newPrimaryId → 409 primary_required ;
//   newPrimaryId = lui-même → 400 ; valide → 204, { deletedAt: '2026-10-06T10:00:00.000Z', isPrimary: 0 }, rev augmenté, nouveau principal ; seconde suppression → 404
// avant la fin de l'onboarding, le seul lieu peut être supprimé ; un lieu salle supprimé libère la salle (nouveau POST → 201)
// lieu d'un autre, admin compris (P-ADM-2) : PATCH, DELETE, PUT et DELETE matériel → 404 { error: 'not_found' }, rien ne change
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- places` → `POST /api/places` renvoie 404.

- [ ] **Step 3: Implement**

Lieu chargé par `id`, `owner_id = user.id`, `deleted_at IS NULL`, sinon `not_found` (aucune exception admin). Maison : `name ?? HOME_PLACE_DEFAULT_NAME`, `visibleAtGym 0`, réglages maison par défaut, matériel household admis (R-EQ-4). DELETE : autres lieux actifs vides et onboarding terminé → `last_place` ; principal avec d'autres lieux : `newPrimaryId` absent → `primary_required`, hors des autres lieux → `validation { field: 'newPrimaryId' }` ; le lieu supprimé reçoit `deleted_at`, `is_primary = 0`, un nouveau rev, et garde son matériel.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- places` puis `-- gyms` (non-régression) → vert ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(salles): lieux salle et maison, lieu principal"`

---

### Task 19: Consentement santé, questionnaire d'alerte, limitations et retrait

**Files:**
- Create: `packages/contracts/src/api/consent.ts`, `apps/server/src/privacy/{consent.ts, consent-routes.ts}`
- Modify: `packages/contracts/src/index.ts`, `apps/server/src/routes.ts` (`app.route('/api/me', consentRoutes(deps))`)
- Test: `apps/server/test/privacy/{consent,withdraw}.test.ts`

**Interfaces:**
- Consumes : T6 ; T4a (`writeStamp`, `Migration`) ; T5 (`SYNC_COLUMNS`, `entityRules`) ; T9 (`requireUser`, `logSecurityEvent`) ; T10 (`ConsentType`, `getConsentState`, `isHealthConsentActive`, `buildMe`, `verifyUserPassword`) ; T14 (`HEALTH_CONSENT_TEXT`, `HEALTH_QUESTIONNAIRE`).
- Produces : Interfaces partagées §4 (`api/consent.ts`, `grantConsent`, `withdrawHealthConsent`, `consentRoutes`) et routes `/api/me/consents*`, `/api/me/health-screening`, `/api/me/limitations*`.

**Spec:** 02 R-CST-1 à R-CST-8, 03 P-CST-1 à P-CST-4, 02 §12 E7, 01 R-SYN-9, 09 §8 « Retrait du consentement santé », 03 P-LOG-1, P-LOG-2, §17 n°3, n°4, n°7, 02 §15 n°13, Review Focus 3.

- [ ] **Step 1: Write the failing test**

```ts
// consent.test.ts
// grant (R-CST-1) : 200, me.consents.health = { active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' } ;
//   un consent_event { type: 'health', action: 'grant', textVersion: '1.0', updatedBy: u.id } ; consent_granted, details { consentType: 'health' }
// textVersion '0.9' ou type 'ai_coach' → 400 ; grant identique répété → un seul événement
// sans consentement (R-CST-4, P-CST-2) : PUT health-screening, POST, PATCH et DELETE limitations → 403 { error: 'health_consent_required' }, aucune ligne
// questionnaire (E7) : [false ×4] → { caution: false } ; [false, false, true, false] → { caution: true } ;
expect(Object.keys(row).sort()).toEqual(['answeredAt','caution','createdAt','deletedAt','id','ownerId','questionnaireVersion','rev','updatedAt','updatedBy']);   // réponses jamais stockées
// row { caution: 1, questionnaireVersion: '1.0', answeredAt: '2026-10-06T10:00:00.000Z' } ; me.cautious true ; version '0.1' ou 3 réponses → 400
// limitations : POST { bodyArea: 'knee', side: 'left', severity: 'mild', note: 'gêne en descente' } → 201, active 1 ; PATCH { severity: 'severe', active: false } → 204 ;
//   note de 201 caractères ou bodyArea 'tail' → 400 ; admin → 404 ; DELETE → 204 et tombstone sans contenu
//   { bodyArea: null, side: null, severity: null, note: null, active: null, deletedAt: '2026-10-06T10:00:00.000Z' } **[décision plan]** ; PATCH ensuite → 404
// withdraw.test.ts — tables de test t19_note (C1 J, pain_note dans c2Columns) et t19_c2_log (C2 J) ; deux utilisateurs avec consentement, cautiousMode,
//   questionnaire [true, false, false, false], deux limitations et des lignes de test contenant WITNESS = 'TEMOIN-C2-5a1f'
// mot de passe faux → 401 invalid_credentials, consentement toujours actif
// retrait (R-CST-5, P-CST-3, 02 §15 n°13) : 200, consents.health.active false, cautious true (cautious_mode gardé) ;
//   health_screening { caution: null, questionnaireVersion: null, answeredAt: null, deletedAt: '2026-10-06T10:00:01.000Z' } ;
//   limitations sans contenu, supprimées, rev augmenté ; t19_note { label: 'séance', pain_note: null, deleted_at: null }, rev > 1 ;
//   t19_c2_log { value: null, deleted_at: '2026-10-06T10:00:01.000Z' } ; consent_event withdraw '1.0' ; un consent_revoked { consentType: 'health' } ; l'autre utilisateur intact
// second retrait → aucune nouvelle ligne (idempotent) ; cautiousMode false puis retrait → cautious false
// Review Focus 3 : après retrait des deux utilisateurs, WITNESS n'apparaît ni dans aucune table (SELECT * de sqlite_schema) ni dans le journal
// nouveau consentement puis questionnaire → la même ligne health_screening est réactivée (deletedAt null)
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm --filter @appsport/server test -- consent withdraw` → `POST /api/me/consents` renvoie 404.

- [ ] **Step 3: Implement**

Libellés exacts : `BODY_AREA_LABELS` shoulder « Épaule », elbow « Coude », wrist_hand « Poignet ou main », neck « Cou », upper_back « Haut du dos », lower_back « Bas du dos », hip « Hanche », knee « Genou », ankle_foot « Cheville ou pied », other « Autre » ; `LIMITATION_SIDE_LABELS` left « Gauche », right « Droite », both « Les deux », not_applicable « Sans objet » ; `LIMITATION_SEVERITY_LABELS` mild « Légère », severe « Forte : m'empêche certains mouvements ».

`withdrawHealthConsent` (n'agit que si le consentement est actif) — pour chaque table de `deps.entityRules` liée au propriétaire :
- `category === 'C2'` : colonnes de contenu (hors `id` et `SYNC_COLUMNS`) à NULL, `deleted_at = COALESCE(deleted_at, now)`, un `writeStamp` par ligne, sur les lignes non supprimées ou encore pleines ;
- sinon, `c2Columns` non vides : ces colonnes à NULL et nouveau stamp sur les lignes concernées ;
- SQL dynamique par `sql.table` et `sql.id` (noms snake_case du registre) ; puis `consent_event withdraw` (`textVersion` du dernier grant) et `consent_revoked { consentType: 'health' }` ; aucune valeur de contenu journalisée.

Garde C2 (`health_consent_required`) vérifiée avant toute lecture de la ressource ; `caution = answers.some(Boolean)` ; upsert du questionnaire sur `id = owner_id`.

- [ ] **Step 4: Run test to verify it passes**

`pnpm --filter @appsport/server test -- consent withdraw` puis `pnpm --filter @appsport/server test` → vert, dont « Review Focus 3 » et `admin-isolation` (T13) sur les nouvelles routes ; `pnpm typecheck`.

- [ ] **Step 5: Commit**

`git commit -m "feat(privacy): consentement santé, questionnaire, limitations et retrait"`
