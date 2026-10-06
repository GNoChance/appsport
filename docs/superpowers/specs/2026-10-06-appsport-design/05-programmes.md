## Programmes et progression

> **Statut.** Cette section fixe les principes, le périmètre, les règles et le modèle de données de la brique 3. Sa spec détaillée viendra plus tard : écrans, API, catalogue complet des cas de test. Tous les seuils chiffrés sont des **conventions réglables**. Ils sont rangés dans un fichier de règles versionné (`packages/domain`, constante `RULES_VERSION`) et seront revus après 8 à 12 semaines de données réelles. La mention « (déduit) » signale un choix de conception que la recherche ne fournit pas directement.

### 1. Principes

1. **Déterminisme.** À entrées égales, sorties égales. Le moteur de progression est un module pur de `packages/domain` : pas de réseau, pas de base de données, pas d'horloge. La date de la séance, `ageBand` et `cautious` lui sont passés en paramètres. Il tourne à l'identique sur le téléphone, même hors ligne, et sur le serveur.
2. **Le code décide, l'IA propose.** Seul le moteur fixe les charges, les répétitions cibles, les incréments, les arrondis, la stagnation, les allègements et les suspensions. L'IA ne peut que proposer un `InstanceChange` fait d'opérations bornées (§15). Elle ne choisit jamais une charge ni un pourcentage.
3. **Prudence par défaut.**
   - La cible est de 2 à 3 répétitions en réserve (RIR), ce qui suffit comme stimulus (ACSM 2026).
   - Aucune série prescrite jusqu'à l'échec, aucun test de 1RM.
   - Si une donnée manque, rien ne change.
4. **Modèles écrits par type de mouvement.** Un *slot* (emplacement d'exercice dans une séance) porte un `movementPattern`, tiré de la taxonomie unique `MOVEMENT_PATTERNS` tenue par la section Exercices, et une liste ordonnée d'exercices. Le lieu du jour détermine l'exercice réellement fait, avec `isUsable()` et `substitutes()` du code partagé.
5. **Peu de primitives de progression, toutes paramétrables** (§8). On reprend les idées de wger et de Liftosaur, pas leur code, qui est sous AGPL.
6. **Explicable.** Chaque décision du moteur porte un code raison. L'interface et le coach le traduisent en phrase.
7. **Noms et textes maison.** Aucun nom de programme déposé (StrongLifts est une marque de l'UE, n° 014288815 ; Starting Strength et « JIM WENDLER 5/3/1 » sont des marques américaines). Aucun texte recopié : le droit d'auteur protège l'expression, pas la méthode (ADPIC, art. 9.2).

**Réglages par défaut tirés de la recherche** (ACSM 2009 et 2026, Pelland 2026, Bell 2023)

| | Débutant (moins de 6 mois de pratique régulière) | Intermédiaire |
|---|---|---|
| Fréquence | 2 à 3 séances corps entier | chaque muscle au moins 2 fois par semaine |
| Séries de travail par grand groupe et par semaine, en comptage fractionnel (muscle secondaire = 0,5) | 6 à 10, en montant vers 10 | 10 à 20 |
| Répétitions | 8 à 12 ; 5 à 8 en polyarticulaire | 4 à 6 (force), 6 à 15 (hypertrophie) |
| RIR cible | 2 à 3 | 1 à 3 en polyarticulaire, 1 à 2 en isolation, jamais 0 |
| Repos | 2 à 3 min en polyarticulaire, 60 à 90 s en isolation | idem |
| Allègement (deload) | réactif seulement | planifié toutes les 5 semaines de programme, plus réactif |

Le RIR est mieux estimé sous 12 répétitions, et il est sous-estimé d'environ 1 répétition (Halperin 2022). L'erreur va donc dans le sens de la prudence.

### 2. Périmètre

| Lot | Contenu |
|---|---|
| **Premier lot** (brique 3) | Les 6 modèles (débutants et intermédiaires) ; primitives `fixed`, `linear`, `double` (avec passage automatique en mode somme), `chain` et `duration` ; calibration ; stagnation ; allègement réactif et planifié ; choix de l'exercice selon le lieu ; arrondi au matériel ; douleur à 3 niveaux ; profil prudent ; reprise après absence ; séance libre (saisie sans programme ni progression) ; validateur partagé ; `InstanceChange` |
| **Plus tard** | Push/pull/legs sur 5 à 6 jours ; 1 et 5 à 6 jours par semaine ; supersets ; saisie du RIR en chiffres ; charges autorégulées par RIR et 1RM estimé ; prescription en % du 1RM ; lest, assistance et élastiques en niveaux de charge ; inventaire de home gym (nombre de disques) ; éditeur de programmes personnels ; séries AMRAP, dégressives et backoff ; forme du jour ; calendrier sportif ; variantes par famille de sport ; livres (lb) ; import Strong ou Hevy ; reprise de l'état des slots lors d'un changement de version de modèle |

L'unité affichée est le **kilogramme uniquement** ; les schémas, les fichiers de modèles et la base comptent en grammes. En v1, on s'entraîne **2 à 4 jours par semaine**.

### 3. Modèles de départ et choix du modèle

| `id` (stable) | Nom affiché | Jours (défaut) | Contenu | Progression | Bloc |
|---|---|---|---|---|---|
| `gym-beginner-full-body-ab` | Salle · Débutant · Corps entier A/B | 2–3 (3) | A : squat, développé couché, rowing, gainage, 1 accessoire. B : soulevé de terre roumain, développé militaire, tirage vertical, fente. Exercices principaux en 3×6, accessoires en 2–3×8–12 | `linear` (principaux), `double` (accessoires), `duration` (gainage) | réactif |
| `gym-intermediate-upper-lower` | Salle · Intermédiaire · Haut / Bas | 3–4 (4) | Haut 1 et Bas 1 : principaux en 4–6 reps. Haut 2 et Bas 2 : 8–15 reps. 12 à 16 séries par muscle et par semaine | `double` (+ somme) | planifié, 5 semaines dont 1 allégée |
| `home-beginner-full-body` | Maison · Débutant · Corps entier | 2–3 (3) | Chaînes : pompes (murales → inclinées → au sol → pieds surélevés), squat (squat → fente → fente bulgare), pont fessier (bipodal → unipodal), rowing sous table, gainage (planche → hollow). Si le matériel est coché : tractions ou tirage à l'élastique, variantes avec haltères | `chain`, `duration`, `double` (petit matériel) | réactif |
| `home-intermediate-upper-lower` | Maison · Intermédiaire · Haut / Bas | 3–4 (4) | Fins de chaîne : pompe archer, pike push-up, fente bulgare, squat sur une jambe assisté, soulevé de terre roumain unipodal, Nordic en excentrique. Tempo, travail unilatéral ; haltères, élastiques et barre de traction en tête de liste quand ils sont cochés | `chain` (prolongée jusqu'à 25 reps), `duration`, `double` | planifié, 5 semaines |
| `sport-beginner-complement` | Complément sport · Débutant · Corps entier et prévention | 2 (2) | 30 à 40 min, 2×8–15 : les 6 grands mouvements (squat ou fente, charnière de hanche, poussées horizontale et verticale, tirages horizontal et vertical), plus Nordic, adducteurs de Copenhague niveau 1, mollets, anti-rotation | `double`, `chain`, `duration` | réactif |
| `sport-intermediate-strength-prevention` | Complément sport · Intermédiaire · Force et prévention | 2 (2) | Jambes lourdes en 3–4×4–6, step-up, mollets unipodaux, réceptions de sauts, Nordic, Copenhague niveaux 2 et 3, rotation externe d'épaule, anti-rotation | `double` (+ somme), `chain` | réactif |

**Choix du modèle : `recommendTemplate(input, templates)`** (fonction pure de `packages/domain`, définie par la section Comptes, §9 ; il n'existe pas d'autre fonction de choix). Rappel de ses règles :

1. `level` vaut `beginner` si `experience` vaut `none` ou `lt_6_months` (« jamais » ou « moins de 6 mois » de pratique régulière, repère ACSM 2009), sinon `intermediate`.
2. `context` vaut `sport` si `goal = sport_support` et qu'un sport est renseigné (`sportCode`). Sinon, c'est le type du lieu principal qui décide (`gym` ou `home`).
3. Un intermédiaire qui a moins de jours que le minimum du modèle intermédiaire de son contexte reçoit le modèle débutant du même contexte. Sinon, si `daysPerWeek` sort de [min, max] du modèle, on prend la borne la plus proche et l'interface le signale.
4. Le modèle choisi est une suggestion : l'utilisateur peut prendre n'importe lequel des 6. Tous restent accessibles aux mineurs, avec le profil prudent (§14).

**Repères affichés.** Les listes d'exercices des slots des modèles sport vont du plus chargé au poids du corps, si bien qu'un même modèle fonctionne à la salle comme à la maison. L'app conseille au moins 3 h d'écart entre le sport et la musculation (Schumann 2022). Contenus fondés sur la recherche : Nordic, −51 % de blessures aux ischio-jambiers (van Dyk 2019) ; adducteurs de Copenhague, −41 % de problèmes d'aine (Harøy 2019) ; le poids du corps et les élastiques permettent une vraie progression de force (Lopes 2019, Kikuchi 2017).

### 4. Structure et format d'un modèle

**Hiérarchie** : modèle → bloc → séances (en rotation) → slots → groupes de séries cibles → progression.

- **Semaine de programme** : N séances terminées, N étant le nombre de jours par semaine choisi. Elle ne correspond pas à une semaine du calendrier, ce qui la rend robuste aux emplois du temps irréguliers.
- **Pas de recopie semaine par semaine.** Le bloc donne seulement sa longueur et la place de la semaine allégée.
- **Rotation** : la séance proposée est celle qui suit la dernière séance terminée dans `workouts`. Une séance abandonnée sans aucune série de travail ne fait pas avancer la rotation. L'utilisateur peut choisir une autre séance, et ce choix est enregistré.

Il y a un fichier par modèle : `data/programs/<id>.json`, en camelCase, validé par un schéma Zod de `packages/contracts`. Les slugs d'exercices de l'extrait ci-dessous sont illustratifs.

```json
{
  "schemaVersion": 1,
  "id": "gym-beginner-full-body-ab",
  "version": 1,
  "name": "Salle · Débutant · Corps entier A/B",
  "description": "Deux séances qui alternent, 2 ou 3 fois par semaine.",
  "context": "gym",
  "level": "beginner",
  "daysPerWeek": { "min": 2, "max": 3, "default": 3 },
  "estimatedMinutes": 55,
  "block": { "mode": "reactive" },
  "workouts": [
    {
      "id": "A",
      "name": "Séance A",
      "slots": [
        {
          "id": "A1",
          "movementPattern": "squat",
          "role": "main",
          "exercises": ["back-squat", "goblet-squat", "leg-press", "bodyweight-squat"],
          "sets": [
            { "kind": "warmup", "count": 2, "reps": { "min": 5, "max": 5 }, "pctWorkLoad": 50 },
            { "kind": "work", "count": 3, "reps": { "min": 6, "max": 6 }, "targetRir": 2, "restS": 150 }
          ],
          "progression": { "type": "linear", "incrementG": 5000 }
        },
        {
          "id": "A5",
          "movementPattern": "core_anti_extension",
          "role": "accessory",
          "chain": "front-plank",
          "sets": [
            { "kind": "work", "count": 3, "durationS": { "min": 20, "max": 60 }, "targetRir": 2, "restS": 60 }
          ],
          "progression": { "type": "duration", "stepS": 5 }
        }
      ]
    }
  ]
}
```

| Champ | Contenu |
|---|---|
| `version` | version du contenu ; augmente à chaque modification |
| `context` | `gym`, `home` ou `sport` |
| `level` | `beginner` ou `intermediate` |
| `block` | `{ "mode": "reactive" }` ou `{ "mode": "planned", "weeks": 5, "deloadWeek": 5 }` |
| `slot.movementPattern` | code de `MOVEMENT_PATTERNS` (section Exercices) |
| `slot.role` | `main`, `secondary` ou `accessory` |
| `slot.exercises` | liste ordonnée de slugs, **ou** `slot.chain`, un `chain_id` du catalogue. Le rang de chaque variante (`chain_rank`) se calcule à partir des pointeurs `easier_id` / `harder_id` des fiches |
| `sets[]` | `kind` (`warmup` ou `work`), `count`, `reps {min,max}` ou `durationS {min,max}`, `targetRir` (1 à 5), `restS`, `pctWorkLoad` (échauffement seulement) |
| `progression` | `type` parmi `fixed`, `linear`, `double`, `chain`, `duration`, avec ses paramètres (§8) |

### 5. Validateur unique

Le même code (`packages/domain`) sert à deux moments : en CI sur chaque modèle, et à l'exécution sur le programme qui résulterait de chaque `InstanceChange` (§15). Il s'appuie sur les profils de référence `REFERENCE_PROFILES` du code partagé, définis par la section Exercices (§3.3) :

- `gym_reference`, la « salle de référence » : la liste stricte de 14 codes du matériel présent dans toute salle commerciale française (sans `ez_bar`, `back_extension_bench` ni `smith_machine`), qui fait foi dans la section Exercices (§3.3) ;
- `home_bodyweight` : les objets du quotidien (chaise, table), c'est-à-dire la maison sans matériel.

Les **groupes de couverture** sont ceux de `PATTERN_GROUPS` (section Exercices, §3.4) : `lower_body` = {squat, fente} ; `hinge` = {charnière de hanche, pont fessier} ; `push` = {horizontale, verticale} ; `pull` = {horizontal, vertical} ; `core` = {anti-extension, anti-rotation}.

**Règles**

1. Le fichier respecte le schéma Zod.
2. Les identifiants sont uniques : identifiant de modèle ; identifiants de séances et de slots à l'intérieur d'un modèle.
3. Cohérence :
   - `reps.min` ≤ `reps.max` ;
   - `targetRir` ≥ 1, et ≥ 2 pour les slots `main` des modèles débutants ;
   - 1 à 5 séries de travail par slot ; repos de 30 à 300 s ;
   - `min` ≤ `default` ≤ `max` ; jours compris entre 2 et 4.
4. Couverture : chaque semaine de programme contient au moins un slot de chacun des 5 groupes de couverture. Pour les modèles `home` et `sport`, cette couverture doit être assurée par des slots dont au moins un exercice est faisable avec `home_bodyweight`. Les autres slots, comme le tirage vertical à la maison, peuvent exiger du petit matériel ; s'il manque, ils sont sautés sans pénalité.
5. Références :
   - en CI, chaque slug existe dans l'export du catalogue présent dans le dépôt, et son `movement_pattern` est celui du slot (ou la chaîne existe) ;
   - pour un modèle `gym`, le premier exercice de chaque slot est faisable avec `gym_reference`.
6. Volume : on compte les séries par grand groupe et par semaine de programme, au nombre de jours par défaut, en comptage fractionnel. Le calcul se fait sur le premier exercice faisable de chaque slot, dans le profil de référence du contexte (`gym_reference` pour `gym`, `home_bodyweight` pour `home` et `sport`).
   - Groupes contrôlés (codes `MUSCLES`) : quadriceps (`quadriceps`), ischio-jambiers (`hamstrings`), fessiers (`glutes`), pectoraux (`chest`), dorsaux (`lats`), deltoïdes (`front_delts`, `side_delts`, `rear_delts`). Une série compte au plus une fois par groupe, avec le poids le plus fort (1 si l'un des muscles du groupe est principal, sinon 0,5).
   - Fourchettes : débutant 6 à 12, intermédiaire 10 à 20, sport 4 à 10.
7. Aucun nom de la liste des noms interdits (marques du §1).
8. Si le contenu d'un modèle diffère de celui de `main`, sa `version` a augmenté.
9. Scénarios de référence : pour chaque modèle, on simule 12 semaines de programme avec 5 profils scriptés (progresse toujours, échoue, signale une douleur, ne saisit jamais l'effort, profil prudent) et on compare le résultat à un instantané.

**Au chargement sur le serveur**, un slug non publié est ignoré. Un modèle dont un slot n'a plus aucun exercice publié est marqué « indisponible » : on ne le propose plus à l'inscription, et les instances en cours passent par le §11.

### 6. Instance de programme

1. **Une seule instance active par utilisateur.** L'inscription copie le modèle entier (`snapshot`) avec son `templateId` et sa `templateVersion`. Une nouvelle version du modèle ne touche jamais une instance en cours.
2. **Changer de modèle, ou de version, crée une nouvelle inscription.** L'ancienne instance passe à `ended`. L'état des slots n'est pas repris : la calibration (§9) propose comme point de départ la dernière charge utilisée sur chaque exercice.
3. **L'instance ne change que par des `InstanceChange`** (§15), ajoutés au journal et jamais réécrits. Chaque changement accepté incrémente `revision`.
4. **L'état des slots (`SlotState`) est un cache**, qu'on peut recalculer en rejouant les séances et les changements acceptés.
   - Le téléphone calcule les cibles suivantes dès la fin de la séance, même hors ligne.
   - À la synchronisation, le serveur recalcule. En cas d'écart (version d'app plus ancienne, séances de deux appareils arrivées dans le désordre), il rejoue l'historique de l'instance par `startedAt` puis par `id`, et c'est sa version qui fait foi.
   - Un changement de `RULES_VERSION` ne déclenche pas de rejeu rétroactif, sauf migration explicite.
5. **Les charges sont stockées en grammes entiers**, pour qu'aucun arrondi ne diffère entre le téléphone et le serveur.

### 7. Échelle d'effort

L'effort est demandé au minimum sur la **dernière série de travail de chaque exercice**, en un tap. Sur les autres séries, il est facultatif.

| Bouton | Libellé | `effort` | RIR retenu (constante) |
|---|---|---|---|
| Facile | « J'aurais pu en faire 4 de plus, ou plus » | `easy` | 4 |
| Correct | « Encore 2 ou 3 » | `ok` | 2,5 |
| Difficile | « Encore 1, pas plus » | `hard` | 1 |
| Échec | « La dernière n'est pas passée » | `failed` | 0 |

**Effort validé**
- `rirEval` est le plus petit RIR retenu sur les séries de travail de l'exercice.
- L'effort est validé si `rirEval` existe, si ce n'est pas un échec, et s'il vaut au moins `targetRir − 1`.
- Adulte débutant (`targetRir` = 2) : facile, correct et difficile valident.
- Profil prudent (`targetRir` ≥ 3) : seuls facile et correct valident ; « difficile » donne un maintien.
- **Effort non saisi : pas de hausse de charge.** Les répétitions comptent quand même.

### 8. Primitives de progression

**Définitions**
- *Pas* : le plus petit écart réalisable au-dessus de la charge actuelle (§12).
- *Incrément effectif* : max(`incrementG`, pas) pour un adulte ; un seul pas en profil prudent.
- *Échec de slot* : au moins une série de travail sous `reps.min`, ou sous la durée cible moins 5 s.
- *Progrès* : charge en hausse ; ou, à charge égale, total de répétitions ou de secondes en hausse ; ou variante plus difficile.

**Primitives**
- **`fixed`** : aucune modification (échauffement, mobilité).
- **`linear`** (répétitions fixes r ; `incrementG` vaut par défaut 2500 (2,5 kg) pour le haut du corps et 5000 (5 kg) pour le bas)
  - Toutes les séries atteignent r et l'effort est validé : la charge suivante est la première charge réalisable ≥ charge + incrément effectif.
  - Toutes les séries atteignent r mais l'effort n'est pas validé : maintien.
  - Sinon : échec.
  - Si le pas du lieu dépasse max(`incrementG`, 10 % de la charge), le slot passe en `double`.
- **`double`** (fourchette [min, max])
  - Toutes les séries à max et effort validé : charge + un pas, puis retour à min.
  - Sinon, si aucune série n'est sous min : progrès si le total de répétitions augmente à charge égale, maintien sinon.
  - Sinon : échec.
  - **Mode somme**, automatique quand le pas dépasse 10 % de la charge (haltères, machines) :
    - la charge monte quand le total des répétitions de travail atteint séries × max + séries et que l'effort est validé ;
    - après une hausse, une série qui descend jusqu'à min − 2 ne compte pas comme un échec.
- **`chain`** (variantes ordonnées du catalogue, fourchette [min, max], `sessionsAtTop` = 2)
  - Les répétitions progressent comme en `double`, sans charge.
  - Toutes les séries à max avec effort validé pendant 2 séances de suite : variante suivante, retour à min.
  - 2 échecs consécutifs sur une nouvelle variante : retour à la variante précédente.
  - Sur la dernière variante, max passe à 25 (15 en profil prudent). Au-delà, c'est la stagnation.
  - Le niveau de départ se fixe à la première séance : l'utilisateur choisit sa variante en partant d'une suggestion.
- **`duration`** (fourchette en secondes, `stepS` = 5)
  - Toutes les séries tenues et effort validé : +5 s, jusqu'à max.
  - Si max est tenu pendant 2 séances et que le slot a une chaîne : variante suivante.

### 9. Évaluation d'un slot après une séance (ordre strict)

1. **Données insuffisantes** (aucune série de travail avec des répétitions ou une durée), ou slot non réalisable dans le lieu : `IGNORED`. L'état ne change pas ; ce n'est ni un échec ni une stagnation.
2. **Semaine allégée** : `DELOAD`. L'état ne change pas, mais l'étape 3 s'applique quand même.
3. **Ajustement demandé** (`nextAdjustment`, venu du bouton douleur ou du choix manuel, §13) :
   - `hold` donne `ADJUSTED_HOLD` : pas de progression à la séance suivante ;
   - `lighten` donne `ADJUSTED_LIGHTEN` : allègement standard (§12).
   - La séance ne compte pas pour la stagnation.
4. **Calibration** : premières séances d'un exercice sans historique dans ce slot.
   - La suggestion de départ est la dernière charge utilisée sur cet exercice dans toute l'histoire de l'utilisateur. À défaut, l'utilisateur choisit.
   - Suite selon l'effort : facile → +2 pas ; correct → fin de la calibration ; difficile → maintien ; échec → −10 %.
   - La calibration s'arrête au premier « correct », ou au bout de 3 séances.
   - En profil prudent, la cible est « facile » ; facile donne +1 pas seulement, et aucune hausse n'a lieu avant la 3e séance de l'exercice.
5. **Primitive** : `PROGRESS`, `HOLD` ou `FAIL`.
6. **Stagnation**
   - `noProgressCount` compte les séances valides consécutives sans progrès. À 3, il y a une stagnation de rang k.
   - Après un record, le compteur et k repartent à zéro.
   - Réponse selon la primitive :

| Primitive | k = 1 | k = 2 | k = 3 |
|---|---|---|---|
| `linear` | allègement standard | passage en `double` [r, r+4] | proposition de remplacement |
| `double` / somme | allègement standard et retour à min | proposition de remplacement | – |
| `chain` / `duration` | retour à min dans la même variante | proposition de remplacement | – |

Une proposition de remplacement est un `InstanceChange` créé par le moteur avec le statut `proposed` (§15). Elle n'est jamais imposée.

Chaque évaluation produit une **décision**, stockée dans `engine_decision`, liée 1-1 à l'exercice réalisé et calculée par le serveur (le téléphone en affiche une valeur provisoire) : résultat, cible suivante, code raison (`REPS_MAX_REACHED`, `EFFORT_MISSING`, `STALL_1_LIGHTEN`, etc.) et `RULES_VERSION`.

### 10. Allègement (deload) et reprise

1. **Réactif (tous les modèles)** : au moins 2 slots en stagnation sur les 2 dernières semaines de programme. Le moteur **propose** alors une semaine allégée (`start_deload`, statut `proposed`).
2. **Planifié** (modèles avec `block.mode = planned`) : la 5e semaine de chaque bloc de 5 est allégée d'office. Accepter un allègement réactif fait repartir le bloc à sa première semaine.
3. **Contenu d'une semaine allégée** :
   - séries de travail réduites à la moitié arrondie au supérieur (3 → 2, 4 → 2, 5 → 3) ;
   - `targetRir` + 2 ;
   - charges, variantes et fréquence inchangées ;
   - aucune évaluation de progression ;
   - reprise ensuite à l'état d'avant.
   On allège plutôt que d'arrêter : une semaine d'arrêt complet a freiné les gains de force du bas du corps (Coleman 2024), et le consensus de Bell 2023 recommande de baisser le volume et la proximité de l'échec.
4. **Reprise après absence (déduit)**, mesurée au début de la séance depuis la dernière séance de l'instance :
   - 14 jours ou plus : cibles de charge et de durée −10 % ;
   - 28 jours ou plus : −20 % et une variante de chaîne en moins ;
   - la première séance de reprise suit la règle de calibration.

### 11. Choix de l'exercice selon le lieu

On choisit le lieu en début de séance (« Aujourd'hui je suis à… »). Le matériel de la salle, ou celui du lieu maison, sert de filtre. À la maison, chacun coche le petit matériel qu'il possède. Profil prudent = `ageBand = minor` ou `cautious = true`.

1. On prend le premier exercice de `slot.exercises` (ou la variante courante de la chaîne) qui est `isUsable()` : publié, `feasible(exercise, ctx)`, et non `notForMinors` si le profil prudent s'applique.
2. Si aucun ne convient : `substitutes(reference, ctx)` du code partagé, où la référence est le premier exercice du slot ou la variante courante. Les candidats sont déjà filtrés par `isUsable()` (filtre prudent compris) ; on prend le premier. `ctx.maxLevel` vient de `maxExerciseLevel`, la correspondance unique niveau utilisateur → niveau de fiche, tenue par la section Exercices.
3. Si rien ne convient : slot « non réalisable ici », sauté sans pénalité (`IGNORED`).
4. Pendant la séance, l'utilisateur peut changer d'exercice parmi les candidats des points 1 et 2. On enregistre l'exercice prévu, l'exercice réalisé et la raison (`equipment`, `busy`, `pain`, `preference`).

L'état de progression est tenu **par couple (slot, exercice)** : une charge à la presse ne vaut pas une charge au squat. Un exercice nouveau dans un slot passe par la calibration.

### 12. Arrondi des charges et allègement standard

Les charges réalisables dépendent du mode de charge de la fiche et des `loadSettings` du lieu (§16) :

| Mode de charge (`load_mode` de la fiche) | Charges réalisables |
|---|---|
| `barbell` (charge totale) | `barG` + n × 2 × `smallestPlateG` (disques supposés disponibles en quantité suffisante) |
| `dumbbell` (haltères, kettlebells) | liste `dumbbellsG` du lieu, charge enregistrée **par main**. Si la liste est vide, pas de hausse de charge : progression en répétitions, et l'écran indique « passe à la paire au-dessus » une fois max atteint |
| `machine` (machine, poulie) | multiples de `machineStepG`. L'utilisateur peut corriger le pas d'une machine précise ; la correction passe par l'API en ligne (indisponible hors ligne), est gardée dans `slot_state.machine_step_g_override` et conservée lors d'un rejeu |
| `bodyweight`, `weighted` (lest), `band` | pas de charge en v1 : progression par répétitions, variante ou durée |

**Opérations**
- `roundDown(t)` : la plus grande charge réalisable ≤ t.
- `next(c)` : la plus petite charge réalisable > c.
- **Plafond d'une hausse** : max(`incrementG`, 10 % de la charge) pour un adulte (ACSM 2009 : +2 à 10 %) ; un seul pas en profil prudent.
- **Allègement standard** (constante `LIGHTEN_PCT` = 10, fixée par le code, jamais par l'IA) :
  - avec charge : `roundDown(c × 0,9)`, au moins un pas sous c ;
  - sans charge : une variante de chaîne en moins, ou −10 % de durée, ou retour à min ;
  - si la charge minimale est déjà atteinte, on la garde et le slot passe en `double` ou en somme.
- L'écran de séance affiche les disques à mettre de chaque côté.

### 13. Sécurité et douleur

1. **Pas de 1RM.** Aucun test de charge maximale, aucune prescription en % du 1RM, aucune série prescrite jusqu'à l'échec. Si un 1RM estimé est affiché (Epley, seulement si reps + RIR ≤ 12 et charge externe), il porte la mention « estimation, écart possible de 10 % ou plus » et ne sert jamais de cible.
2. **Jamais de `targetRir` à 0.** Les débutants restent à 2 ou plus sur les polyarticulaires.
3. **Le moteur n'ajoute jamais de séries.** Seuls un modèle ou un `InstanceChange` accepté changent le volume.
4. **Donnée manquante : rien ne change. Effort manquant : pas de hausse de charge.**
5. **Échauffement** prévu par le modèle pour les exercices principaux à la barre.
6. **Douleur à 3 niveaux, saisie par exercice** : `none`, `discomfort` (gêne) ou `pain` (douleur).
   - `discomfort` écrit `nextAdjustment = hold`.
   - `pain` écrit `nextAdjustment = lighten`, affiche le conseil de sécurité (« arrête l'exercice si la douleur augmente ; si elle persiste, consulte un médecin ou un kiné ; douleur à la poitrine ou malaise : appelle le 15 ou le 112 ») et propose tout de suite un autre exercice du même type de mouvement.
   - L'ajustement neutre `nextAdjustment` (`hold` / `lighten`) existe aussi pour tout le monde, comme choix manuel « ne pas augmenter » ou « alléger la prochaine fois ». Ce n'est pas une donnée de santé.
7. **Avec le consentement santé**, on stocke aussi `painLevel` et le compteur `painStreak` du slot. Après **2 séances de suite** en `pain` sur un slot, le moteur crée un `suspend_slot` déjà accepté (code `PAIN_SUSPEND`) : le slot est retiré des séances et un remplacement est proposé. Seul l'utilisateur lève la suspension.
8. **Sans consentement santé**, on ne stocke ni `painLevel` ni `painStreak`, le serveur remplace `swapReason = pain` par une valeur vide, et il n'y a pas de suspension automatique. Le bouton affiche le conseil et agit sur la séance suivante uniquement par l'ajustement neutre.
9. **Retrait du consentement santé** : `painLevel`, `painStreak` et `swapReason = pain` sont mis à vide immédiatement sur le serveur, et le téléphone purge ses copies ; les codes `PAIN_*` (dans `instance_change` et `engine_decision`) sont réécrits en `USER_*` et les textes `reason` des changements du coach sont effacés. Les ajustements et les suspensions restent : ce sont des événements neutres. Aucun recalcul rétroactif de l'état des slots, et le rejeu donne le même résultat.

### 14. Profil prudent

Le moteur reçoit `ageBand` (`minor` pour 16-17 ans, `adult` sinon) et `cautious`, tous deux calculés par le socle à la lecture (section Comptes, §12). `cautious` vaut vrai si l'utilisateur est mineur, si le « mode prudent » manuel (`cautious_mode`, ouvert à tous et non sanitaire) est activé, ou si l'indicateur de prudence santé (`caution`) est présent avec le consentement santé actif. Le moteur ne lit jamais la date de naissance. Le profil prudent s'applique si `ageBand = minor` ou si `cautious = true`. À 18 ans, le passage au profil adulte est automatique, sans perte d'état, et un message l'annonce.

Les bornes suivent la position de la NSCA (2009) : 1 à 3 séries de 6 à 15 répétitions, des charges qui montent par paliers de 5 à 10 %, un début léger centré sur la technique. Le consensus de Lloyd 2014 juge le 1RM inutile pour des jeunes peu entraînés.

| Paramètre | Adulte | Prudent |
|---|---|---|
| Répétitions | celles du modèle | ramenées dans 6 à 15, avec un écart min-max d'au moins 2 (4–6 devient 6–8 ; 3×6 reste valable) |
| Séries de travail par exercice | ≤ 5 | ≤ 3 |
| `targetRir` | celui du modèle | ≥ 3 |
| Incrément | max(modèle, pas) | un pas ; mode somme dès que le pas dépasse 10 % |
| Calibration | vise « correct » | vise « facile » ; aucune hausse avant la 3e séance de l'exercice |
| Exercices | fiches publiées | fiches publiées et non `notForMinors` |
| Fin de chaîne | 25 reps | 15 reps |
| `InstanceChange` | bornes adultes (§15) | bornes prudentes ; aucune hausse de volume |

**Messages propres aux mineurs** : pour les exercices à la barre, s'entraîner avec un adulte expérimenté ; en cas de douleur, en parler à un parent.

### 15. `InstanceChange` : la seule entité de modification d'une instance

**Champs** : `id`, `instanceId`, `baseRevision`, `author` (`user`, `coach` ou `engine`), `operations[]`, `reasonCode`, `reason` (texte), `status` (`proposed`, `accepted`, `rejected` ou `expired`), `createdAt`, `expiresAt`, `decidedAt`. Champs d'IA : `aiGenerated`, `aiModel`, `promptVersion`, `coachThreadId`.

**Règles**

1. Le journal est en ajout seul. Les seules transitions possibles sont `proposed` → `accepted`, `rejected` ou `expired`. Seule exception : le retrait du consentement santé efface `reason` et réécrit `reasonCode` (§13.9).
2. Les propositions du coach et du moteur (remplacement, allègement réactif) naissent `proposed`, avec `expiresAt` = création + 7 jours. Les changements faits par l'utilisateur et les suspensions pour douleur naissent `accepted`.
3. L'acceptation exige trois conditions : `baseRevision` égale à la `revision` courante, la date limite `expiresAt` non dépassée, et un programme résultant qui passe le validateur du §5 (fourchettes de volume comprises, appliquées au résultat et non à chaque opération). L'instance prend alors `revision + 1`.
4. Une proposition dont `baseRevision` est périmée, ou dont la date est dépassée, passe à `expired` à la lecture suivante. Le coach peut en faire une nouvelle.
5. On annule un changement par un nouveau changement inverse, de l'auteur `user`.
6. 5 opérations au plus par changement.

| Opération | Bornes adulte | Bornes prudent | Auteurs |
|---|---|---|---|
| `replace_exercise {slot, exercise}` | même type de mouvement, fiche publiée, faisable dans au moins un lieu de l'utilisateur | + non `notForMinors` | user, coach, engine |
| `change_sets {slot, delta ±1}` | résultat entre 1 et 5 | résultat entre 1 et 3, baisse seulement | user, coach |
| `set_rep_range {slot, min, max}` | entre 5 et 30, écart ≥ 2 | entre 6 et 15 | user, coach |
| `set_target_rir {slot, value}` | 1 à 4 (≥ 2 pour un débutant en polyarticulaire) | hausse seulement | user, coach |
| `set_rest {slot, seconds}` | 30 à 300 s | idem | user, coach |
| `lighten_exercise {slot}` | allègement standard du §12 (`LIGHTEN_PCT` fixé par le code), appliqué à la séance suivante | idem | user, coach |
| `start_deload {}` | toujours permis | idem | user, coach, engine |
| `suspend_slot {slot}` / `resume_slot {slot}` | suspension : toujours permise ; levée : par l'utilisateur seulement | idem | suspend : user, coach, engine ; resume : user |
| `remove_slot {slot}` | interdit si un groupe de couverture se retrouve vide | idem | user, coach |
| `add_slot {workout, movementPattern, exercises}` | rôle `accessory`, progression `double`, 1 slot par séance et par changement, 8 slots au plus par séance | interdit | user, coach |
| `set_days_per_week {days}` | dans [min, max] du modèle et dans 2 à 4 | idem | user, coach |
| `switch_template {templateId}` | modèle disponible ; une fois accepté, nouvelle inscription (§6.2) | idem | user, coach |

**Interdit à l'IA** : fixer ou augmenter une charge ; choisir un pourcentage ; modifier les seuils du moteur ; lever une suspension ; annuler un allègement en cours ; toucher aux bornes du profil prudent.

**Circuit avec le coach**
1. L'outil du coach génère son schéma à partir de cette liste (`packages/contracts`).
2. Le code valide la sortie. En cas d'erreur, il la renvoie au modèle, 2 fois au plus.
3. L'utilisateur voit les différences et accepte ou refuse.
4. Le coach lit les décisions et leurs codes raison pour les **expliquer**. Il ne les recalcule jamais. `painLevel` ne lui est envoyé que si le consentement santé et le consentement coach sont tous les deux actifs.

### 16. Ce que les autres sections fournissent

- **Socle, lieu** (`place` : salle partagée ou maison) : matériel (`gym_equipment` ou `home_equipment`), avec les codes de la taxonomie Exercices ; `loadSettings` (JSON `load_settings`, en grammes), ajoutés dès la v1 avec leurs valeurs par défaut, même si leur écran n'arrive qu'en brique 3 :
  - `barG` (20000) ;
  - `smallestPlateG` (1250) ;
  - `dumbbellsG[]` (salle : de 2000 à 40000 par pas de 2000, partagé entre les membres ; maison : vide) ;
  - `machineStepG` (5000).
- **Socle, profil** : `ageBand`, `cautious`, `experience`, `goal`, `sportCode`, `daysPerWeek` (2 à 4), lieu principal (`place.is_primary`), état du consentement santé.
- **Exercices** : slug stable, `status`, `movement_pattern`, `primary_muscles` et `secondary_muscles`, `equipment_options`, `load_mode`, `measure` (`reps` ou `duration`), `unilateral`, `level`, `not_for_minors`, `chain_id` et pointeurs `easier_id` / `harder_id` (`chain_rank` calculé) ; fonctions `feasible()`, `isUsable()`, `usableChainSteps()` et `substitutes()` ; `maxExerciseLevel` ; `REFERENCE_PROFILES` et `PATTERN_GROUPS` ; export JSON du catalogue dans le dépôt pour la CI.
- **Synchronisation générique (socle)** : identifiants UUIDv7 créés sur le téléphone pour les séances (classe J), file d'envoi idempotente, réponse du serveur qui fait foi.

### 17. Tests attendus (TDD)

1. Tests sur tableaux de cas pour chaque primitive et chaque étape du §9 : (état, cibles, séance, matériel, `ageBand`, `cautious`, date) → décision attendue.
2. Tests de propriétés (fast-check) :
   - jamais de hausse avec un ajustement, une douleur ou un effort manquant ;
   - jamais de hausse au-delà du plafond ;
   - jamais de cible hors des bornes prudentes quand `ageBand = minor` ou `cautious = true` ;
   - même entrée, même sortie ;
   - le rejeu donne le même état que le calcul incrémental, y compris après le retrait du consentement santé.
3. Scénarios de référence sur 12 semaines (§5, règle 9).
4. Parité téléphone et serveur : la même suite tourne dans les deux environnements.
5. Validateur : un jeu de modèles et d'`InstanceChange` invalides, chacun avec son erreur attendue. Cas couverts : baseRevision périmée, proposition vieille de plus de 7 jours, `lighten_exercise` muni d'un pourcentage (refusé par le schéma), `add_slot` en profil prudent.
6. `recommendTemplate` : ses tests sont tenus par la section Comptes ; Programmes vérifie que chaque `id` de modèle qu'elle peut renvoyer existe.
7. Sans consentement santé, une séance avec `pain` ne laisse en base aucun `painLevel`, `painStreak` ni `swapReason = pain`, et la séance suivante est allégée.
8. Une session admin reçoit une 404 sur les instances, séances et changements des autres utilisateurs.

### Modèle de données

**Fichier versionné (C0)** : `ProgramTemplate` dans `data/programs/<id>.json` (structure du §4), chargé au déploiement.

**Tables** (snake_case ; colonnes de synchro `+SYNC` du modèle consolidé, dont `owner_id` ; UUIDv7 créés sur le téléphone pour les tables de classe J, par l'API sinon ; charges en grammes entiers). Le modèle de données consolidé fait foi pour les types et les index.

- `program_instance` (C1, classe E) : `id`, `+SYNC`, `template_id`, `template_version`, `snapshot` (JSON), `days_per_week`, `status` (`active` | `ended`), `revision`, `started_at`, `ended_at?`. Une seule instance `active` par `owner_id`.
- `instance_change` (C1, `reason` en C2 ; classe E) : `id`, `+SYNC`, `instance_id`, `base_revision`, `author` (`user` | `coach` | `engine`), `operations` (JSON), `reason_code`, `reason?`, `status` (`proposed` | `accepted` | `rejected` | `expired`), `expires_at?`, `decided_at?`, `ai_generated`, `ai_model?`, `prompt_version?`, `coach_thread_id?`. En ajout seul (exception du §13.9).
- `slot_state` (C1 ; `pain_streak` en C2 ; classe D, cache recalculable) : `id` déterministe = `instance_id:slot_id:exercise_id`, `+SYNC`, `instance_id`, `slot_id`, `exercise_id` ; `mode` (`linear` | `double` | `sum` | `chain` | `duration`), `load_g?`, `target_reps?`, `variant_rank?`, `duration_s?`, `machine_step_g_override?`, `calibration_left`, `no_progress_count`, `stall_rank`, `pain_streak?`, `suspended`, `last_session_id`, `rules_version`.
- `engine_decision` (C1, classe D ; relation 1-1 avec `performed_exercise`) : `id` = `performed_exercise_id`, `+SYNC`, `instance_id?`, `slot_id?`, `exercise_id`, `result` (`PROGRESS` | `HOLD` | `FAIL` | `IGNORED` | `DELOAD` | `ADJUSTED_HOLD` | `ADJUSTED_LIGHTEN` | `CALIBRATION` | `STALL`), `reason_code`, `next_target` (JSON), `profile` (`adult` | `cautious`), `rules_version`.
- `workout_session` (C1, classe J) : `id`, `+SYNC`, `instance_id?` (vide pour une séance libre), `workout_id?`, `place_id`, `device_id`, `started_at`, `ended_at?`, `status` (`in_progress` | `completed` | `abandoned`), `week_type` (`normal` | `deload`), `template_version?`, `rules_version`, `app_version`, `note?`.
- `performed_exercise` (C1 ; `pain_level`, et `swap_reason` quand il vaut `pain`, en C2 ; classe J) : `id`, `+SYNC`, `session_id`, `slot_id?`, `planned_exercise_id?`, `exercise_id`, `swap_reason?` (`equipment` | `busy` | `pain` | `preference`), `position`, `pain_level?` (`none` | `discomfort` | `pain`), `next_adjustment?` (`hold` | `lighten`), `note?`. La décision du moteur est dans `engine_decision`, jamais dans cette table.
- `performed_set` (C1, classe J) : `id`, `+SYNC`, `performed_exercise_id`, `position`, `kind` (`warmup` | `work`), `load_mode`, `load_g?`, `reps?` | `duration_s?`, `side?` (`left` | `right`), `effort?` (`easy` | `ok` | `hard` | `failed`), cibles copiées (`target_reps_min?`, `target_reps_max?`, `target_duration_s?`, `target_load_g?`, `target_rir?`, `target_variant?`), `logged_at`. Le repos réel se déduit des heures de saisie ; il n'est pas stocké.

**Relations** : user 1–N program_instance (une seule active) ; program_instance 1–N instance_change, slot_state et workout_session ; workout_session N–1 place ; workout_session 1–N performed_exercise 1–N performed_set ; performed_exercise 1–1 engine_decision ; performed_exercise et slot_state N–1 exercise.

### Risques

- **Seuils non validés** : 3 séances sans progrès, −10 %, conversion de l'échelle d'effort, reprise après absence. L'ACSM 2026 repose surtout sur des novices. Parade : fichier de règles versionné, scénarios de référence, revue après 8 à 12 semaines.
- **Mineurs de 16-17 ans** : la NSCA recommande un encadrement qualifié, que l'app ne fournit pas. Parade : profil prudent, filtre `notForMinors`, conseil d'encadrement, ni échec ni 1RM.
- **Matériel de salle approximatif** : substitutions et recalibrations fréquentes. Parade : matériel corrigé par les membres, état tenu par couple (slot, exercice).
- **Gros sauts de charge** (haltères, machines à pas de 5 kg). Parade : mode somme automatique, pas de machine corrigeable.
- **Saisie d'effort négligée**, qui bloque la hausse de charge et peut frustrer. Parade : un seul tap par exercice, rappel dans l'interface.
- **Deux appareils hors ligne** qui envoient leurs séances dans le désordre. Parade : UUID créés sur le téléphone, rejeu par date de début, serveur qui fait foi.
- **Dérive du volume** à force de changements successifs. Parade : validation du programme résultant.
- **Ajustement neutre et douleur** : sans consentement, `nextAdjustment = lighten` est un choix ouvert à tous et ne mentionne aucune douleur. Il faut garder ce libellé neutre dans l'interface et dans l'export.
- **Rowing sous table et Nordic à la maison** : ils demandent une installation sûre (table solide, point d'ancrage), à décrire dans les fiches.

### Sources

- Recherche interne : `docs/research/2026-10-06-recherche-initiale.md` (§6, §7) ; rapports `docs/research/rapports/programmes.md`, `exercices.md`, `coach-ia.md`, `ux-concurrence.md`.
- ACSM 2026 : https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/ ; ACSM 2009 : https://pubmed.ncbi.nlm.nih.gov/19204579/
- Halperin 2022 : https://pubmed.ncbi.nlm.nih.gov/34542869/ ; Pelland 2026 : https://link.springer.com/article/10.1007/s40279-025-02344-w
- Bell 2023 : https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/ ; Coleman 2024 : https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/
- Schumann 2022 : https://pubmed.ncbi.nlm.nih.gov/34757594/ ; van Dyk 2019 : https://pubmed.ncbi.nlm.nih.gov/30808663/ ; Harøy 2019 : https://pubmed.ncbi.nlm.nih.gov/29891614/
- Lopes 2019 : https://pmc.ncbi.nlm.nih.gov/articles/PMC6383082/ ; Kikuchi 2017 : https://pmc.ncbi.nlm.nih.gov/articles/PMC5812864/
- NSCA 2009, position sur les jeunes (extraits) : https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf ; Lloyd 2014 (extraits) : https://pubmed.ncbi.nlm.nih.gov/24055781/
- Marque StrongLifts (TMview) : https://www.tmdn.org/tmview/#/tmview/detail/EM500000014288815 ; ADPIC art. 9.2 : https://www.wto.org/english/docs_e/legal_e/27-trips_04_e.htm
- Liftoscript (idées seulement, AGPL) : https://www.liftosaur.com/doc/liftoscript ; wger : https://github.com/wger-project/wger/blob/master/wger/manager/models/abstract_config.py
