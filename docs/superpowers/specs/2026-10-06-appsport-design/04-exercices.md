## Catalogue d'exercices (brique 2)

> Cette section fixe les principes, le schéma des fiches, la taxonomie partagée et le circuit éditorial. La spec détaillée de la brique 2 précisera les écrans et la liste nominative des fiches. Les seuils marqués « réglable » sont rangés dans le fichier de règles versionné de `packages/domain`.

### 1. Objet et périmètre

Le catalogue est la liste des exercices connus de l'appli. Chaque fiche est écrite pour un débutant francophone. Il sert :
- à l'utilisateur, qui consulte une fiche avant ou pendant la séance, y compris hors ligne ;
- au moteur de programmes (brique 3) : type de mouvement, muscles, matériel, mode de charge, chaînes, remplacements ;
- au coach (brique 4), qui ne lit que les fiches publiées.

**En v1** : musculation, gainage, pliométrie légère ; illustrations fixes ; écran d'admin de relecture ; page Crédits.
**Hors v1** : voir §14 (le cardio en fait partie).

### 2. Principes

1. **Textes 100 % maison.** Le brouillon est rédigé par l'API Claude, puis relu et publié par l'admin. Aucun texte n'est importé (ni wger, ni free-exercise-db, ni autre). On peut consulter des faits bruts (nom, muscles), jamais recopier une phrase.
2. **Seules les fiches publiées sont utilisées.** Programmes, remplacements, recherche utilisateur et coach ne voient que `published`. Les fiches `draft` et `reviewed` ne quittent jamais l'admin.
3. **Identifiant immuable.** Une fiche n'est jamais supprimée ni renommée, car l'historique des séances y renvoie. On la retire (`retired`).
4. **On stocke des faits, on calcule le reste.** Faisabilité, rang de chaîne et remplaçants sont calculés par `packages/domain`, à l'identique sur le téléphone (hors ligne) et sur le serveur.
5. **Une seule taxonomie**, dans le code partagé (§3). Les schémas Zod, le JSON Schema des fiches, les écrans de salle et de maison du socle et les modèles de Programmes en dérivent. Ajouter une valeur passe par une PR.
6. **Aucun chiffre de charge dans une fiche.** Charges et cibles relèvent du moteur (brique 3), jamais du modèle d'IA.
7. **La base fait foi après le premier chargement.** Le dépôt en garde une copie exportée, qui sert à la CI et à l'amorçage d'une base neuve (§10).
8. **Provenance tracée fichier par fichier** pour chaque illustration (§12).

Convention : les codes de taxonomie, les tables et les colonnes sont en anglais. Les slugs des fiches et des chaînes sont aussi en anglais, en kebab-case et immuables (ex. `dumbbell-romanian-deadlift`), comme les identifiants de modèles de Programmes. Seuls les noms affichés (`name`, `aliases`) sont en français.

### 3. Taxonomie partagée (source unique)

#### 3.1 Emplacement

- `packages/contracts/src/taxonomy.ts` : constantes `as const` (codes, libellés français, catégories) et énumérations Zod qui en dérivent.
- `packages/domain/src/catalog/` : fonctions du §6 et règles réglables (poids du score, limite de remplaçants).
- Aucun fichier `data/equipment.json` : la liste vit dans le code. Le tableau du matériel du socle, ses modèles de pré-cochage et les modèles de Programmes utilisent ces codes, et la CI refuse tout code inconnu.

#### 3.2 Matériel (`EQUIPMENT`, 23 codes, sans cardio)

Le sol, un mur et le poids du corps ne sont pas du matériel : ils sont toujours disponibles.

| Catégorie | Code | Libellé affiché |
|---|---|---|
| `household` (objets du quotidien) | `chair` | Chaise ou banc stable |
| | `table` | Table solide (rowing sous la table) |
| `small_equipment` (petit matériel) | `resistance_band` | Élastiques (bandes, avec poignées ou mini-bandes) |
| | `dumbbells` | Haltères fixes ou réglables |
| | `kettlebell` | Kettlebell |
| | `pull_up_bar` | Barre de traction |
| | `suspension_trainer` | Sangles de suspension ou anneaux |
| | `box` | Box ou step stable |
| `benches_racks` (bancs et supports) | `flat_bench` | Banc plat |
| | `adjustable_bench` | Banc inclinable |
| | `squat_rack` | Cage ou supports à squat avec sécurités |
| | `dip_station` | Barres parallèles |
| | `back_extension_bench` | Banc à lombaires (45° ou GHD) |
| `free_weights` (charges libres) | `barbell` | Barre droite et disques |
| | `ez_bar` | Barre EZ |
| `machines` (poulies et machines) | `cable_station` | Poulie réglable ou vis-à-vis |
| | `lat_pulldown` | Tirage vertical |
| | `seated_row` | Tirage horizontal assis |
| | `leg_press` | Presse à cuisses |
| | `smith_machine` | Barre guidée (Smith) |
| | `leg_extension` | Leg extension |
| | `leg_curl` | Leg curl |
| | `upper_body_machines` | Machines guidées du haut du corps (développé, pec deck, épaules) |

Règles :
- **R-EQ-1** Les codes sont stables. Renommer ou supprimer un code demande une migration des données de salle, de maison et de fiches.
- **R-EQ-2** Implication unique : `adjustable_bench` vaut aussi `flat_bench` (`EQUIPMENT_IMPLIES`). `expandEquipment()` l'applique avant tout calcul.
- **R-EQ-3** Les codes `household` ne s'affichent que pour un lieu maison. Ils sont pré-cochés à la création du lieu, et l'utilisateur les décoche s'il n'a ni chaise stable ni table solide. Ils ne sont jamais implicites.
- **R-EQ-4** Pour un lieu maison, chacun coche ce qu'il possède parmi `household` et `small_equipment`. Les autres catégories restent possibles (home gym).
- **R-EQ-5** En CI, chaque code doit être utilisé par au moins une fiche non retirée.

#### 3.3 Profils de référence (`REFERENCE_PROFILES`)

Ce sont des constantes du code partagé (`REFERENCE_PROFILES`, dans `taxonomy.ts`). Cette section en est la seule définition : Programmes y renvoie. Elles servent aux contrôles de CI (§7 et validateur de Programmes) et aux pré-cochages du socle.

| Profil | Codes |
|---|---|
| `home_bodyweight` | `chair`, `table` |
| `home_small_equipment` | `home_bodyweight` + `pull_up_bar`, `resistance_band`, `dumbbells` |
| `gym_reference` (salle de référence : matériel présent dans toute salle commerciale française) | `dumbbells`, `barbell`, `squat_rack`, `flat_bench`, `adjustable_bench`, `dip_station`, `pull_up_bar`, `cable_station`, `lat_pulldown`, `seated_row`, `leg_press`, `leg_extension`, `leg_curl`, `upper_body_machines` (14 codes ; en sont exclus `kettlebell`, `smith_machine`, `ez_bar`, `back_extension_bench`, `box`, `resistance_band`, `suspension_trainer`) |

- Programmes, validateur (§5, règles 4 et 5) : `HOME_BASE_EQUIPMENT` se lit `home_bodyweight`, et `REFERENCE_GYM_EQUIPMENT` (« salle de référence ») se lit `gym_reference`. Ces deux noms ne sont pas des constantes distinctes.
- Préréglages du socle (section Comptes, §10.2) : « Maison · Sans matériel » = `home_bodyweight` ; « Maison · Petit matériel » = `home_small_equipment` ; « Salle · Grande salle ou chaîne » = tous les codes sauf `household`. Le socle dérive ses autres préréglages (petite salle, box, home gym) des mêmes codes.

Correspondance avec l'ancienne liste du socle, pour mémoire (la section Comptes, §10.2, n'emploie plus que les nouveaux codes) :

| Ancien code du socle | Nouveau code |
|---|---|
| `barre_olympique` | `barbell` |
| `banc` | `flat_bench`, `adjustable_bench` |
| `machine_tirage` | `lat_pulldown`, `seated_row` |
| `machine_poussee` | `upper_body_machines` |
| `machine_jambes` | `leg_extension`, `leg_curl` |
| `barres_paralleles` | `dip_station` |
| `anneaux_sangles` | `suspension_trainer` |
| `elastiques` | `resistance_band` |
| `halteres`, `barre_ez`, `kettlebell`, `rack`, `smith`, `poulie`, `presse_cuisses`, `banc_lombaires`, `barre_traction`, `box` | `dumbbells`, `ez_bar`, `kettlebell`, `squat_rack`, `smith_machine`, `cable_station`, `leg_press`, `back_extension_bench`, `pull_up_bar`, `box` |
| `cardio` | supprimé (cardio hors v1) |

#### 3.4 Types de mouvement (`MOVEMENT_PATTERNS`, 20 codes)

Les slots de Programmes utilisent directement ces codes (`slot.movementPattern`). Il n'existe pas de seconde liste de patterns.

| Groupe | Code | Libellé |
|---|---|---|
| Bas du corps | `squat` | Squat |
| | `lunge` | Fente (fentes, bulgare, step-up, pistol) |
| | `hip_hinge` | Charnière de hanche |
| | `glute_bridge` | Pont fessier, hip thrust |
| | `knee_flexion` | Flexion du genou (leg curl, Nordic) |
| | `knee_extension` | Extension du genou |
| | `calf_raise` | Mollets |
| | `hip_adduction_abduction` | Adducteurs et abducteurs (dont Copenhague) |
| Haut du corps | `horizontal_push` | Poussée horizontale |
| | `vertical_push` | Poussée verticale |
| | `horizontal_pull` | Tirage horizontal |
| | `vertical_pull` | Tirage vertical |
| | `shoulder_isolation` | Isolation d'épaule (élévations, oiseau, face pull, rotations) |
| | `elbow_flexion` | Flexion du coude |
| | `elbow_extension` | Extension du coude |
| Tronc et divers | `core_anti_extension` | Gainage anti-extension |
| | `core_anti_rotation` | Gainage anti-rotation, y compris latéral |
| | `trunk_flexion` | Flexion du tronc |
| | `loaded_carry` | Port de charge |
| | `plyometrics` | Pliométrie |

**Groupes de couverture (`PATTERN_GROUPS`)**, utilisés par la règle de couverture de Programmes (§5, règle 4) et par les chaînes (§5) :

| Groupe | Patterns |
|---|---|
| `lower_body` | `squat`, `lunge` |
| `hinge` | `hip_hinge`, `glute_bridge` |
| `push` | `horizontal_push`, `vertical_push` |
| `pull` | `horizontal_pull`, `vertical_pull` |
| `core` | `core_anti_extension`, `core_anti_rotation` |

Un pattern qui n'appartient à aucun groupe forme son propre groupe (`patternGroup(p) = p`).

#### 3.5 Muscles, articulations, niveaux

- **`MUSCLES` (18)** : `chest`, `front_delts`, `side_delts`, `rear_delts`, `rotator_cuff`, `traps`, `lats` (dorsaux), `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `lower_back`, `glutes`, `quadriceps`, `hamstrings`, `adductors`, `calves`. Les groupes de volume (par exemple « épaules » = 3 faisceaux) sont définis par Programmes à partir de ces codes.
- **`JOINTS` (8)** : `neck`, `shoulders`, `elbows`, `wrists`, `lower_back`, `hips`, `knees`, `ankles`.
- **`EXERCISE_LEVELS`** :
  - `1` débutant : apprenable seul avec la fiche, risque faible ;
  - `2` intermédiaire : technique de base acquise ;
  - `3` avancé (pistol, pompe archer, Nordic complet…).

**Correspondance entre le niveau de programme de l'utilisateur et le niveau de fiche** (`maxExerciseLevel`) :
- `beginner` → 1 ;
- `intermediate` → 2.

Le niveau 3 n'est jamais proposé automatiquement. On l'atteint par une liste de slot écrite dans un modèle ou en avançant dans une chaîne. Le niveau ne bloque pas l'avancée dans une chaîne, puisqu'elle se mérite par la performance (Programmes, primitive `chain`).

#### 3.6 Modes de charge (`LOAD_MODES`)

| Code | Charge enregistrée | Ancien nom dans Programmes |
|---|---|---|
| `barbell` | charge totale de la barre | barre |
| `dumbbell` | charge par haltère ou kettlebell | halteres |
| `machine` | valeur de la pile, ou de la poulie | machine, poulie |
| `weighted` | lest ajouté seulement ; le poids du corps n'est pas compté | lest |
| `bodyweight` | aucune | poids_du_corps |
| `band` | aucune (progression par répétitions ou variante) | — |

- La durée n'est pas un mode de charge, c'est une mesure (`measure = duration`). Une planche est `bodyweight` + `duration`.
- Toutes les options de matériel d'une fiche ont le même mode de charge. Sinon, on crée deux fiches.
- L'arrondi au matériel reste dans Programmes (§12).

### 4. Schéma d'une fiche

Le schéma est unique pour tous les statuts : `ExerciseSheet` (Zod, `packages/contracts`). Colonne « Rempli par » :
- **squelette** : à la création (§8, étape 1) ;
- **IA** : proposé par le brouillon, puis relu ;
- **système** : géré par le code.

| Champ | Type et bornes | Rempli par | Règle |
|---|---|---|---|
| `id` | slug ASCII kebab-case, 60 car. max | squelette | égal au nom du fichier ; immuable |
| `schema_version` | entier | système | version du format |
| `revision` | entier ≥ 1 | système | +1 à chaque enregistrement |
| `status` | `draft` / `reviewed` / `published` / `retired` | admin | transitions au §8 |
| `name` | 60 car. max | squelette | nom courant dans les salles françaises (« Hip thrust ») |
| `aliases` | 0 à 6 | IA | variantes et nom anglais courant ; uniques dans tout le catalogue après `normalize()` |
| `movement_pattern` | `MOVEMENT_PATTERNS` | squelette | |
| `mechanics` | `compound` / `isolation` | squelette | |
| `unilateral` | booléen | squelette | vrai : saisie par côté (brique 3) |
| `measure` | `reps` / `duration` | squelette | |
| `load_mode` | `LOAD_MODES` | squelette | §3.6 |
| `primary_muscles` | 1 à 3 `MUSCLES` | IA | comptent 1 série dans le volume |
| `secondary_muscles` | 0 à 4, disjoints des principaux | IA | comptent 0,5 série |
| `equipment_options` | 1 à 4 options ; option = 0 à 3 codes `EQUIPMENT` | squelette | OU d'ensembles ET ; `[[]]` = sans matériel ; pas d'option en double ni d'option qui en contient une autre |
| `level` | 1 / 2 / 3 | squelette | §3.5 |
| `not_for_minors` | booléen | squelette, confirmé à la relecture | exclut la fiche du profil prudent (§6) |
| `stressed_joints` | 0 à 3 `JOINTS` | IA | articulations fortement sollicitées ; lues par les briques 3 et 4 |
| `instructions` | 3 à 7 étapes, 160 car. max | IA | impératif, tutoiement, une action par étape |
| `key_points` | 2 à 4, 120 car. max | IA | |
| `mistakes` | 2 à 4 × {`mistake`, `fix`} | IA | |
| `safety` | 1 à 3 | IA | dit toujours quand s'arrêter ; ni diagnostic ni vocabulaire médical |
| `breathing` | 160 car. max | IA | |
| `setup` | facultatif, 240 car. max | IA | réglage des machines, bancs, rack |
| `chain_id` | slug facultatif | squelette | §5 |
| `easier_id`, `harder_id` | id facultatif | squelette | seulement entre membres de la même chaîne (§5) |
| `easier_tip`, `harder_tip` | facultatif, 160 car. max | IA | conseil pour simplifier ou durcir, même hors chaîne |
| `illustrations` | 0 à 3 × {`illustration_id`, `role`: `start` / `mid` / `end`} | admin | une seule source par fiche (§12) |
| `review_notes` | texte | IA | doutes de l'IA ; jamais servi aux utilisateurs |
| `drafting` | {`origin`: `ai` / `human`, `model`, `prompt_version`, `generated_at`} | système | traçabilité |
| `reviewed_by`, `reviewed_at`, `published_at`, `retired_at`, `updated_at` | | système | |

- **R-FIC-1** Dans un `draft`, les champs remplis par l'IA peuvent être vides. Ils sont obligatoires à partir de `reviewed`.
- **R-FIC-2** Champs **calculés, jamais stockés dans les fichiers** : `chain_rank` (§5). Les contextes maison, salle ou sport ne sont pas stockés : l'interface filtre avec `feasible()` sur le lieu choisi.
- **R-FIC-3** Repère pour `not_for_minors` (guide de style) : vrai pour le niveau 3, la pliométrie à fort impact (box jump, sauts en contrebas) et les mouvements orientés vers la charge maximale. Le relecteur confirme ou corrige la valeur explicitement.
- **R-FIC-4** Pas de licence par fiche. Les textes relèvent d'une mention globale (`data/LICENSE`), et chaque illustration porte sa licence (§12).

### 5. Chaînes de progression

Une chaîne est une suite ordonnée de variantes, de la plus facile à la plus difficile (ex. `push-up`, les pompes : murales → inclinées → au sol → pieds surélevés → archer). Les chaînes servent à la primitive `chain` de Programmes et aux remplacements.

- **R-CH-1** Tous les membres d'une chaîne portent le même `chain_id`. Ils sont reliés par `easier_id` et `harder_id`, réciproques : A.`harder_id` = B ⇔ B.`easier_id` = A.
- **R-CH-2** Une chaîne forme un chemin linéaire : un seul membre sans `easier_id`, un seul sans `harder_id`, pas de cycle, pas de branche, aucun membre isolé.
- **R-CH-3** Les membres partagent au moins un muscle principal et le même groupe de couverture (`patternGroup`). Par exemple, squat → fente → fente bulgare reste dans `lower_body`.
- **R-CH-4** Le `level` ne baisse jamais le long de la chaîne.
- **R-CH-5** `chain_rank` = position dans le chemin, à partir de 1 pour la variante la plus facile. Il est calculé par `buildChains(catalog)`.
- **R-CH-6** Une fiche retirée sort de sa chaîne. La CI refuse une chaîne qui deviendrait discontinue : il faut d'abord relier ses voisines.

### 6. Fonctions partagées (`packages/domain/src/catalog`)

Ce sont des fonctions pures et déterministes, couvertes par **une seule suite de tests**. Programmes, le coach et l'interface les appellent, et aucune autre section n'a son propre algorithme de remplacement.

```ts
expandEquipment(codes: EquipmentCode[]): Set<EquipmentCode>
feasible(ex: ExerciseSheet, ctx: CatalogContext): boolean
isUsable(ex: ExerciseSheet, ctx: CatalogContext): boolean
usableChainSteps(chainId: string, ctx: CatalogContext): ExerciseSheet[]
substitutes(ex: ExerciseSheet, ctx: CatalogContext): ExerciseSheet[]
buildChains(catalog: ExerciseSheet[]): Map<string, ExerciseSheet[]>
normalize(text: string): string
// CatalogContext = { catalog, equipment (déjà étendu), maxLevel: 1|2|3, cautious: boolean }
```

1. **`feasible`** : vrai s'il existe une option de `equipment_options` entièrement incluse dans `ctx.equipment`. `[[]]` est toujours faisable.
2. **`isUsable`** : `status = published` ET `feasible` ET non (`cautious` et `not_for_minors`). `cautious` vaut vrai en profil prudent, c'est-à-dire pour un mineur, en « mode prudent » manuel (`cautious_mode`), ou si le consentement santé est actif et que le questionnaire donne `caution` ; c'est l'appelant qui le fournit. Programmes l'utilise pour prendre le premier exercice utilisable d'une liste de slot (Programmes, §11, étape 1).
3. **`usableChainSteps`** : les membres utilisables d'une chaîne, dans l'ordre de `chain_rank`. En profil prudent, la chaîne s'arrête donc avant la première variante `not_for_minors`.
4. **`substitutes`** :
   1. Candidats : fiches `c` ≠ `ex`, `isUsable(c)`, `c.level ≤ maxLevel`, ET (même `movement_pattern` OU même `chain_id` non vide), ET au moins un muscle principal commun.
   2. Score = 3 × muscles principaux communs + 1 × muscles secondaires communs − 2 × |écart de niveau| + 1 si même `unilateral` + 1 si même `load_mode` (poids réglables).
   3. Tri par score décroissant, puis par `id` en ordre binaire. On renvoie au plus `SUBSTITUTE_LIMIT` = 5 fiches (réglable).

   Programmes, §11 étape 2, prend le premier résultat. À l'étape 4 (changement manuel), il propose les exercices utilisables de la liste du slot, puis `substitutes`.
5. **`normalize`** : minuscules, sans accents ni ponctuation. La recherche porte sur `name` et `aliases`.

Le filtrage selon les douleurs ou les zones sensibles déclarées (`stressed_joints`) relève des briques 3 et 4. Il n'est pas fait ici.

### 7. Contenu de la v1 : environ 110 à 120 fiches (plafond 130)

**Règle d'inclusion.** Une fiche entre en v1 seulement si au moins une condition est remplie :
- (a) elle figure dans un slot d'un des 6 modèles de Programmes : `gym-beginner-full-body-ab`, `gym-intermediate-upper-lower`, `home-beginner-full-body`, `home-intermediate-upper-lower`, `sport-beginner-complement`, `sport-intermediate-strength-prevention` ;
- (b) elle est un membre d'une chaîne utilisée par ces modèles ;
- (c) elle est nécessaire pour que chaque slot ait au moins 2 exercices utilisables (adulte, `maxLevel` du modèle) dans chaque profil de référence pertinent : `gym_reference` pour les modèles salle, `home_bodyweight` et `home_small_equipment` pour les modèles maison, les trois pour les modèles sport. En profil prudent, il en faut au moins 1.

Estimation (déduite de la recherche) ; la liste exacte est celle que donnent les règles (a) à (c) une fois les 6 modèles écrits, dans la limite du plafond :

| Famille | Exemples | Estimation |
|---|---|---|
| Squat, fente | squat sur chaise → squat → fente arrière → bulgare → pistol assisté ; goblet, squat barre, squat avant, presse, step-up, fente latérale | 16 |
| Hanche, ischios, mollets, adducteurs | soulevé de terre roumain (barre, haltères, unipodal), soulevé de terre, swing, hyperextension ; pont → pont unipodal → hip thrust ; leg curl, Nordic assisté → Nordic ; leg extension ; mollets ; Copenhague (3 niveaux), abduction élastique | 24 |
| Poussées | pompes murales → inclinées → au sol → déclinées → archer ; développé couché (barre, haltères), incliné, machine, écarté ; dips (barres, chaise) ; développé militaire, haltères assis, pike → pike pieds surélevés | 19 |
| Tirages | rowing sous table, rowing inversé, rowing barre, rowing haltère, tirage horizontal, rowing élastique ; tirage vertical (poulie, élastique), tractions négatives → assistées → pronation → lestées, chin-up | 15 |
| Isolation bras et épaules | élévations latérales (haltères, poulie), oiseau, face pull, écartement élastique, rotation externe élastique ; 4 curls, 4 extensions triceps | 14 |
| Tronc, port de charge, pliométrie | planche genoux → planche, dead bug → hollow, roue ; planche latérale, Pallof, bird dog ; crunch, relevés de jambes ; marche du fermier, port unilatéral ; pogo, squat sauté, réception de saut, bonds latéraux, box jump | 19 |
| **Total** | | **≈ 107**, soit 110 à 120 avec les remplaçants manquants |

**Ordre de publication**
- **Lot A** : fiches des conditions (a) et (b) pour les 6 modèles (environ 75 ; le nombre exact découle des modèles). Il doit être publié avant la recette de la brique 3, dont le validateur exige des références publiées.
- **Lot B** : fiches de la condition (c). Il doit être publié avant la fin de la brique 3.
- Charge de relecture : 8 à 10 minutes par fiche, soit 15 à 20 heures (déduit).

### 8. Circuit éditorial

**Statuts** : `draft` → `reviewed` → `published` → `retired`. La machine à états est **générique**, dans `packages/domain`, et la brique 5 la réutilise pour ses fiches conseils. L'écran de relecture est propre aux exercices.

**Étape 0, une seule fois**
- Le guide de style `docs/catalog/style-guide.md` : tutoiement, impératif, phrases de 20 mots au plus, unités métriques, aucune marque, aucune allégation médicale, repères `not_for_minors`.
- Le glossaire `data/glossary.json` : terme préféré, variantes refusées, équivalent anglais. Exemples : développé couché, charnière de hanche, « dos neutre », RIR = « répétitions en réserve ».
- Deux fiches étalons, rédigées et relues à la main.

**Étape 1, squelettes.** Le porteur crée un fichier `data/exercises/<id>.json` par fiche, au statut `draft`, qui ne contient que les champs « squelette ». Ils passent par une PR, et la CI applique le validateur (§13, point 1).

**Étape 2, rédaction par l'API Claude** (§9). Le script remplit les champs « IA » des brouillons, puis la PR est validée par la CI.

**Étape 3, chargement.** Au déploiement suivant, le chargeur insère les nouvelles fiches (§10).

**Étape 4, relecture** dans `/admin/exercises`. L'écran est réservé au rôle admin et ne fonctionne qu'en ligne.
- **Liste** : filtres par statut, lot, type de mouvement et absence d'illustration ; compteur d'avancement ; compteur « N fiches modifiées depuis le dernier export ».
- **Fiche** : formulaire champ par champ ; aperçu identique à la vue utilisateur ; `review_notes` mises en évidence ; choix des illustrations, limité à une seule source.
- **Enregistrement** : la dernière écriture gagne (un seul relecteur) et `revision` augmente de 1.

| Transition | Conditions |
|---|---|
| (création) → `draft` | squelette valide (CI) |
| `draft` → `reviewed` | champs obligatoires remplis ; validation complète réussie ; case « consignes et sécurité vérifiées » cochée ; `not_for_minors` confirmé ; `reviewed_by` et `reviewed_at` renseignés |
| `reviewed` → `draft` | toujours permis (renvoi en rédaction) |
| `reviewed` → `published` | illustrations présentes dans le manifeste, ou aucune ; `published_at` renseigné |
| modification d'une fiche `published` | elle reste publiée si la validation complète passe ; `revision` + 1 ; `reviewed_at` mis à jour |
| tout statut → `retired` | refusé si un modèle de programme chargé y renvoie (liste de slot ou chaîne) ou si cela coupe une chaîne (R-CH-6) ; `retired_at` renseigné ; l'écran indique le nombre d'instances actives concernées |
| `retired` → `reviewed` | réactivation |

Une fiche retirée reste lisible dans l'historique des séances. Elle disparaît du catalogue, de la recherche, des remplacements et du coach.

**Étape 5, export** (§10). Il est obligatoire avant de fusionner une PR de modèle de programme qui renvoie à des fiches nouvellement publiées.

### 9. Rédaction des brouillons par l'API Claude

- **Script** : `pnpm exercises:draft` (`scripts/exercises/draft.ts`), lancé sur le poste de dev, jamais en CI ni sur le serveur.
- **Client** : il passe par `AiClient` (`apps/server/src/ai/`), posé dès la brique 2 et réutilisé par le coach en brique 4. `AiClient` gère le modèle configurable, l'effort explicite, la sortie structurée, la lecture de `stop_reason` et le coût calculé depuis `usage`. Un faux déterministe le remplace dans les tests.
- **Clé** : clé d'un workspace Anthropic de développement, distinct de celui du coach en production. Elle est rangée dans le gestionnaire de mots de passe du porteur et dans `.env.local`, ignoré par git.
- **Fiches traitées** : les `draft` dont les champs IA sont vides, ou une liste d'`id` passée en option. Le script refuse toute fiche qui n'est pas `draft` et ne touche qu'aux champs « IA ».
- **Appel** :
  - modèle `claude-opus-5-5` par défaut (configurable), effort fixé explicitement à `high` ;
  - sortie structurée par le JSON Schema dérivé de Zod (`z.toJSONSchema`), sans outils ;
  - partie fixe mise en cache (guide de style, glossaire, fiches étalons), puis le squelette et les noms des voisines de chaîne ;
  - appels standards, 4 en parallèle au plus. Pas d'API Batch.
- **Consignes au modèle** : rédaction originale, sans reprise de texte existant ; aucun chiffre de charge ; doutes notés dans `review_notes`.
- **Réponse** : validée par le même schéma que la CI, avec 2 essais au plus ; écrite dans le fichier ; `drafting` renseigné ; `revision` + 1 ; statut laissé à `draft`.
- **Pilote** : 5 fiches rédigées et relues d'abord, puis ajustement du prompt et du glossaire (`prompt_version` + 1, fichier `scripts/exercises/prompt-v<n>.md`) avant le reste.
- **Coût estimé** : 10 à 20 $ au total (déduit).
- **Données** : aucune donnée personnelle n'est envoyée. Cette étape ne dépend d'aucun consentement.

### 10. Dépôt, chargement et export

```
data/
  exercises/<id>.json            une fiche par fichier (copie exportée)
  glossary.json
  illustrations/manifest.json    une entrée par fichier retenu (§12)
  illustrations/files/<id>.<ext>
  LICENSE                        textes maison ; illustrations sous leur licence
scripts/
  exercises/draft.ts, exercises/import-illustrations.ts, exercises/prompt-v<n>.md
  data/validate.ts, data/pull.ts, svg/check.ts
```

**Format** : JSON UTF-8, fins de ligne LF, indentation de 2 espaces, ordre des clés fixe (celui du §4), sérialisation canonique produite par une seule fonction partagée.

**Chargeur** (module `catalog/` du serveur, au démarrage, après les migrations). Il est transactionnel (tout ou rien) et idempotent.

| Situation | Action |
|---|---|
| fichier invalide | aucune écriture ; erreur journalisée ; l'appli démarre avec le catalogue déjà en base |
| `id` absent de la base | insertion, avec le statut du fichier |
| `id` déjà en base | ignoré : la base fait foi (journal : « N fiches ignorées ») |
| entrée du manifeste d'illustrations | insertion ou mise à jour : le dépôt fait foi pour les illustrations |

Ensuite, le chargeur recalcule `catalog_version` (stockée dans `server_meta.catalog_version`, avec `catalog_updated_at`), empreinte du contenu servi aux utilisateurs : fiches `published` et `retired`, manifeste et modèles de programmes (`data/programs/*.json`).

**Export**
- Le bouton « Exporter le catalogue » de l'écran d'admin télécharge un seul fichier `exercises-export.json` (toutes les fiches, tous statuts, forme canonique).
- `pnpm data:pull <fichier>` le découpe dans `data/exercises/`. Le porteur ouvre une PR, et la CI lance les validateurs du catalogue et de Programmes.
- `exported_revision` est mis à jour à l'export, ce qui alimente le compteur « à exporter ».
- Une base neuve (installation ou reconstruction sans sauvegarde) est amorcée depuis cette copie. La sauvegarde normale reste celle de la base (section Exploitation).

### 11. Diffusion aux téléphones et hors ligne

- **`GET /api/catalog`** : catalogue en lecture seule, hors outbox, avec `ETag` = `catalog_version`. Il contient les fiches `published` et `retired`, sans colonnes éditoriales (`review_notes`, `drafting`, `reviewed_by`, `reviewed_at`, `published_at`, `retired_at`, `exported_revision`), ainsi que les métadonnées d'illustrations et les modèles de programmes (section Architecture, classe C). Taille : environ 0,5 Mo non compressé (déduit).
- Le client vérifie le catalogue aux déclencheurs de la synchro générique (lancement, retour du réseau, premier plan). Il retélécharge tout si la version a changé (pas de mise à jour partielle) et stocke le catalogue dans Dexie (stores `exercises`, `illustrations`, `programTemplates` ; version dans `meta.catalogVersion`).
- **Illustrations** : après chaque mise à jour du catalogue, le service worker télécharge les fichiers manquants dans un cache dédié et supprime ceux qui ne sont plus référencés. Cela représente environ 300 fichiers, quelques Mo. Pas de cache LRU ni de bouton « tout télécharger ».
- Le voyant « Prêt hors ligne » du socle (01 R-SYN-33) couvre la coquille, les données de l'utilisateur, le catalogue et toutes les illustrations référencées : il ne s'allume que lorsque tout est en local.

### 12. Illustrations

**Sources** (mesurées le 2026-10-06)
- **Everkinetic** (everkinetic/data, Greg Priday, CC BY-SA 4.0) : 293 exercices, 537 SVG, surtout du matériel de salle. Dernier commit le 20/02/2022.
- **workout-guide** (bryllim, CC BY-SA 4.0 déclarée) : 302 exercices, 906 images, seule source qui couvre la maison et la prévention (pompe archer, pike, hollow, Nordic, Copenhague, Pallof).
  - 76 images citent leur source Everkinetic et les modifications apportées.
  - Les 830 autres portent « Bryl Lim, CC BY-SA 4.0 », sans source ni méthode.

**Règles**
1. Un fichier n'entre que si son créateur est identifié, sa licence déclarée (CC BY-SA 4.0, CC BY 4.0 ou CC0) et son URL source figée à un commit.
2. Tous les fichiers d'Everkinetic et de workout-guide utilisés par une fiche sont admis (dépôt et appli privés).
3. Les fichiers dont la provenance n'est pas documentée (les 830 images de workout-guide sans source) portent `replace_before_public = true`, affiché « à remplacer avant publication ». « Publication » veut dire ici toute ouverture de l'appli ou du dépôt au-delà du cercle privé. Le marquage ne bloque pas le statut `published` d'une fiche. L'écran d'admin affiche le nombre de fichiers marqués.
4. Une fiche affiche une seule source. Ordre de préférence : workout-guide si toutes ses images existent, puis Everkinetic, puis aucune illustration.
5. Seuls les fichiers utilisés sont copiés dans le dépôt, avec leur empreinte sha256.
6. Le porteur peut demander à l'auteur de workout-guide l'origine de ses dessins. La réponse est archivée dans `docs/`, et le marquage est levé si elle documente la provenance.

**Attribution (CC BY-SA 4.0, §3(a))**
- Sous chaque illustration, une ligne de crédit et un lien vers la page Crédits, par exemple : « Illustration : Bryl Lim, d'après Everkinetic (Greg Priday) · CC BY-SA 4.0 · modifiée ».
- La page Crédits est générée depuis le manifeste et disponible hors ligne. Elle donne pour chaque source les créateurs, le lien, la licence et le commit figé ; nos modifications (nettoyage, optimisation, renommage), dont les versions modifiées sont sous CC BY-SA 4.0 ; la liste des fichiers des fiches publiées ; et pour les textes, la mention « rédigés avec l'aide d'une IA (Claude) et relus par l'administrateur ».
- Chaque SVG contient un commentaire avec son crédit et sa licence.

**Import et service**
- Import par `scripts/exercises/import-illustrations.ts`, à partir d'une copie figée de la source.
- Nettoyage des SVG par liste blanche d'éléments : suppression de `script`, `foreignObject`, des attributs `on*` et des liens externes. Le type des fichiers matriciels est vérifié par leurs octets.
- 40 Ko au plus par fichier, vérifié en CI (`svg:check`).
- Le fichier servi est nommé `<id>.<hash8>.<ext>`, avec `Cache-Control: public, max-age=31536000, immutable`, la compression, `X-Content-Type-Options: nosniff` et une CSP `default-src 'none'; style-src 'unsafe-inline'`.
- Affichage toujours par `<img>`, sur une carte claire même en mode sombre. Les poses sont côte à côte. Texte alternatif : « <nom> : position de départ » (ou « de milieu », « de fin »).

### 13. Critères d'acceptation

1. Le validateur (`data:validate`, en CI) refuse :
   - un code hors taxonomie, un `id` différent du nom de fichier, un alias en double après `normalize()` ;
   - une option de matériel en double ou qui en contient une autre, des modes de charge mélangés ;
   - des pointeurs non réciproques, une chaîne cyclique, ramifiée ou discontinue, des membres sans muscle principal commun ou de groupes différents, un niveau qui baisse ;
   - une fiche `reviewed` ou `published` incomplète ;
   - une illustration absente du manifeste ou d'empreinte différente ;
   - un code de matériel inutilisé (R-EQ-5).
2. `feasible` et `expandEquipment` ont des tableaux de cas : `[[]]`, plusieurs options, banc inclinable valant banc plat, lieu vide.
3. `substitutes` a des tableaux de cas et des propriétés fast-check :
   - le résultat ne contient jamais l'exercice lui-même, ni une fiche non publiée, non faisable ou au-dessus de `maxLevel` ;
   - jamais de fiche `not_for_minors` si `cautious` ;
   - au plus 5 résultats, dans un ordre stable quel que soit l'ordre du catalogue en entrée ;
   - les égalités de score sont départagées par `id`.

   La même suite tourne sous Node et dans l'environnement du navigateur (happy-dom).
4. `buildChains` calcule `chain_rank` de 1 à n. `usableChainSteps` s'arrête avant la première variante `not_for_minors` en profil prudent.
5. CI de couverture : pour chaque slot des 6 modèles et chaque profil de référence pertinent, au moins 2 exercices utilisables (adulte) et au moins 1 en profil prudent.
6. Chargeur : deux exécutions de suite ne changent rien ; une fiche déjà en base n'est jamais écrasée ; un fichier invalide n'écrit rien ; une base vide est entièrement amorcée.
7. Chaque transition permise ou interdite du §8 a son test, dont le refus de retirer une fiche citée par un modèle.
8. Aller-retour : export → `data:pull` → chargement sur une base vide → export donne un fichier identique octet pour octet.
9. `GET /api/catalog` ne renvoie jamais de `draft` ni de `reviewed`, ni aucune colonne éditoriale (`review_notes`, `drafting`, `reviewed_by`…). `/admin/exercises` renvoie 403 à un membre.
10. `exercises:draft`, avec le faux `AiClient` : il refuse une fiche qui n'est pas `draft`, ne modifie que les champs IA et rejette une sortie invalide après 2 essais. Aucun appel réseau en CI.
11. Le nettoyage retire `<script>`, `onload` et un `href` externe d'un SVG piégé.
12. La page Crédits liste chaque illustration de chaque fiche publiée.
13. Playwright (Chromium et WebKit) : après une synchronisation, en mode hors ligne, une fiche publiée quelconque s'affiche avec ses illustrations.
14. La recherche ignore la casse et les accents, sur le nom et sur les alias.

### 14. Plus tard

Vidéos et animations ; carte musculaire ; dessins maison ; exercices créés par les utilisateurs ; régénération par l'IA depuis l'écran d'admin ; bouton « signaler une erreur » ; étirements, échauffement et cardio ; liste manuelle de remplaçants ; détail des machines une par une ; rôle « relecteur » distinct de l'admin ; reversement des traductions à des projets ouverts.

### Modèle de données

Toutes les tables du catalogue sont en catégorie **C0** (contenu interne, lisible par tous les membres). Seule exception de lecture : les champs éditoriaux, réservés à l'admin.

**`exercise`** (une ligne par fiche, STRICT ; clé `id`)
- `id` TEXT PK (slug anglais en kebab-case, immuable), `schema_version` INTEGER, `revision` INTEGER, `status` TEXT (`draft` | `reviewed` | `published` | `retired`)
- `name` TEXT, `aliases` TEXT (JSON)
- `movement_pattern`, `mechanics`, `unilateral` (0/1), `measure`, `load_mode`, `level` (1–3), `not_for_minors` (0/1)
- `primary_muscles`, `secondary_muscles`, `equipment_options`, `stressed_joints` : TEXT (JSON)
- `content` TEXT (JSON : `instructions`, `key_points`, `mistakes`, `safety`, `breathing`, `setup`, `easier_tip`, `harder_tip`)
- `chain_id` TEXT NULL, `easier_id` / `harder_id` TEXT NULL → `exercise.id`
- `illustrations` TEXT (JSON : [{`illustration_id`, `role`}])
- éditorial (admin seulement) : `review_notes`, `drafting` (JSON), `reviewed_by` NULL → `user.id` (ON DELETE SET NULL), `reviewed_at`, `published_at`, `retired_at`, `updated_at`, `exported_revision`
- index : `status`, `movement_pattern`, `chain_id`

**`illustration`** (une ligne par fichier retenu ; le dépôt fait foi)
- `id` TEXT PK, `file` (nom servi haché), `sha256`, `bytes`, `media_type`
- `source` (`everkinetic` | `workout_guide`), `source_url` (figée à un commit), `creators` (JSON), `license` (`CC-BY-SA-4.0` | `CC-BY-4.0` | `CC0-1.0`), `license_url`, `modifications`
- `replace_before_public` (0/1)

**Version du catalogue** : pas de table propre ; colonnes `catalog_version` et `catalog_updated_at` de `server_meta` (socle).

**Constantes du code partagé** (pas de tables) : `EQUIPMENT` (23), `EQUIPMENT_CATEGORIES` (5), `EQUIPMENT_IMPLIES`, `REFERENCE_PROFILES` (3), `MOVEMENT_PATTERNS` (20), `PATTERN_GROUPS` (5), `MUSCLES` (18), `JOINTS` (8), `EXERCISE_LEVELS` (3), `LOAD_MODES` (6), `maxExerciseLevel`, poids du score, `SUBSTITUTE_LIMIT`.

**Côté téléphone** (Dexie) : stores `exercises` (fiches servies) et `illustrations` (manifeste), version dans `meta.catalogVersion` ; fichiers d'illustrations dans le cache du service worker.

**Relations**
- `exercise` N–N `illustration` (via `exercise.illustrations`).
- `exercise` → `exercise` (`easier_id`, `harder_id`) ; chaîne = chemin des pointeurs.
- Socle : `gym_equipment.equipment_code` et `home_equipment.equipment_code` (lieu maison, table `place`) → codes `EQUIPMENT`.
- Programmes : `slot.movementPattern` → `MOVEMENT_PATTERNS` ; `slot.exercises[]` et `slot.chain` → `exercise.id` / `chain_id` ; `performed_exercise.exercise_id` et `slot_state.exercise_id` → `exercise.id` (d'où l'interdiction de supprimer).
- Coach : lit les seules fiches `published` (outil de recherche filtré par `isUsable`) et `stressed_joints`.

### Risques

- **Erreur technique d'une fiche rédigée par l'IA**, non vue à la relecture, qui blesserait un débutant ou un mineur. Parades : pilote de 5 fiches, fiches étalons, `review_notes`, case « sécurité vérifiée », `safety` obligatoire, confirmation de `not_for_minors`.
- **Provenance non documentée** de la majorité des dessins de workout-guide. Risque faible en cercle privé, mais l'ouverture au public impose de remplacer les fichiers marqués.
- **Taxonomie trop grossière** (machines regroupées) : un exercice peut être proposé alors qu'il est impossible dans une salle donnée. Parades : changement d'exercice en séance (brique 3) et extension par PR.
- **Relecture sous-estimée** (15 à 20 h), qui retarderait la brique 3. Parade : lot A en priorité.
- **Copie du dépôt périmée**, qui fausse la CI de Programmes. Parades : compteur « à exporter » et export obligatoire avant toute PR de modèle.
- **SVG tiers piégés** : nettoyage par liste blanche, affichage par `<img>`, nosniff et CSP.