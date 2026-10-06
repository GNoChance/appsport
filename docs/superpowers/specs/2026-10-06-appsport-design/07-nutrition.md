## 5. Nutrition v1

> Cette section fixe les principes, les règles de calcul et le modèle de données. La brique 5 aura sa propre spec détaillée (écrans, textes, API). Les valeurs marquées *(déduit)* sont des choix de conception, pas des valeurs sourcées : elles sont listées dans les risques (§5.15). Identifiants de code, tables et colonnes en anglais ; textes de l'interface en français (glossaire en §5.14).

### 5.1 Périmètre

La v1 contient trois choses, et rien d'autre :

1. **Des repères chiffrés**, réservés aux adultes de 18 à 78 ans en mode complet : énergie, protéines, lipides minimum, glucides indicatifs, fibres et eau. Ils sont calculés par du code versionné.
2. **Un suivi du poids** et un **bilan hebdomadaire** qui propose un ajustement borné.
3. **Des fiches conseils** relues (PNNS 2019, nutrition sportive), ouvertes à tous, mineurs compris, selon leur audience.

Hors v1 : journal alimentaire, recherche d'aliments, scan de code-barres, photos de repas, % de masse grasse, tour de taille, rappels de pesée, plans de repas, recettes, préférences alimentaires, conseils sur les compléments.

Le module est **facultatif et désactivé par défaut**. Rien dans le reste de l'appli n'en dépend. **La taille et le poids ne sont saisis qu'à l'activation du module** (l'onboarding du socle ne les demande pas : l'ancien écran de mesures et la table `mesure_corporelle` sont supprimés ; la table `weigh_in` de cette section est la seule table de pesées, et la taille est dans `nutrition_profile.height_cm`).

### 5.2 Principes non négociables

1. **Le code calcule, l'IA explique.** Tout chiffre nutritionnel affiché ou cité sort d'une fonction pure de `packages/domain`, versionnée (`algo_version`) et exécutée côté serveur. Le coach ne crée ni ne modifie aucun chiffre.
2. **Dans le doute, la prudence.** Une réponse « je préfère ne pas répondre », une donnée manquante ou une valeur hors bornes font passer en mode qualitatif, jamais l'inverse.
3. **Mineurs (16-17 ans) : mode qualitatif obligatoire**, ni cible chiffrée, ni déficit, ni pesée, ni taille.
4. **Un repère, pas une consigne.** Fourchettes, vocabulaire non prescriptif (§5.10). L'utilisateur accepte ou refuse chaque ajustement.
5. **Minimisation.** On enregistre la conséquence de l'écran de sécurité (le mode), jamais les réponses. Le coach reçoit la tendance et les repères, jamais les pesées brutes ni la taille.
6. **Le serveur fait foi.** L'API et la synchro ne renvoient jamais un chiffre nutritionnel ni une pesée à un utilisateur dont le mode effectif n'est pas `full`. L'interface ne fait que refléter cette règle.
7. **Confidentialité dans le cercle.** Les données de nutrition ne sont visibles que par leur titulaire. Aucun écran d'admin ni de salle ne les affiche ; une session admin reçoit une 404 sur celles des autres.
8. **Fuseau unique Europe/Paris** pour les dates de pesée, les semaines de bilan et l'âge.

### 5.3 Mode effectif

Le mode stocké (`nutrition_profile.mode`) est un choix de l'utilisateur. Le **mode effectif** est calculé à chaque lecture par une fonction pure `effectiveNutritionMode(profile, age, healthConsentActive, currentScreenVersion)` :

1. `mode = disabled` → `disabled`.
2. âge < 18 ans → `qualitative` (profil mineur).
3. âge > 78 ans → `qualitative` *(déduit : Mifflin-St Jeor n'est validée que de 19 à 78 ans)*.
4. `mode = full` sans consentement santé actif → `qualitative`.
5. `mode = full` avec `safety_screen_version` différente de la version en vigueur → `qualitative` jusqu'à ce que l'écran soit repassé.
6. Sinon → le mode stocké.

L'âge est calculé à la lecture à partir de la date de naissance complète saisie par l'admin dans l'invitation (fonction d'âge du socle, Europe/Paris). L'âge de 18 ans est inclus dans le mode complet, alors que la formule est validée dès 19 ans *(écart jugé négligeable)*.

| | `full` (complet) | `qualitative` (qualitatif) | `disabled` (désactivé) |
|---|---|---|---|
| Repères chiffrés | oui | non | non |
| Saisie et courbe du poids | oui | non | non |
| Bilan hebdomadaire | oui | non | non |
| Fiches | adultes, modes complet et qualitatif | fiches sans chiffres de son audience | aucune (« Demander de l'aide » reste sur la page Aide) |
| Coach, sur la nutrition | explique repères et bilan | conseils qualitatifs uniquement | idem qualitatif |
| Ligne d'écoute TCA | pied du module | pied du module | page Aide |

En qualitatif, il n'y a aucun suivi du poids : le mode sans chiffres ne contient vraiment aucun chiffre.

### 5.4 Activation (adulte)

1. **Explication** : ce que fait le module (repères, suivi) et ce qu'il ne fait pas (ni régime, ni avis médical).
2. **Âge** (serveur) : un mineur ou un plus de 78 ans arrive directement en qualitatif (§5.5).
3. **Consentement santé** : c'est le consentement unique `health` du socle (limitations, prudence, douleur, mesures, nutrition). S'il est déjà actif, rien n'est redemandé. Sinon, il est proposé ici avec le même texte versionné et la même case non cochée. Refus → mode `qualitative`, motif `choice`, sans écran de sécurité.
4. **Écran de sécurité**, trois questions posées à tous (oui / non / je préfère ne pas répondre ; les formulations ci-dessous font foi en v1, toute modification incrémente `safety_screen_version`) :

| # | Question |
|---|---|
| Q1 | Grossesse en cours ou allaitement ? |
| Q2 | As-tu ou as-tu eu un trouble du comportement alimentaire (anorexie, boulimie, hyperphagie…) ou une relation difficile avec la nourriture ? |
| Q3 | As-tu une maladie ou un traitement qui demande un suivi de ton alimentation par un médecin ou un·e diététicien·ne ? |

| Réponses | Mode | Complément |
|---|---|---|
| Q1 = oui | `qualitative` | orientation vers une sage-femme ou un médecin |
| Q2 = oui | `qualitative` ou `disabled`, au choix | ligne d'écoute affichée tout de suite (§5.11) |
| Q3 = oui | `qualitative` | orientation vers un médecin ou un·e diététicien·ne |
| au moins un « je préfère ne pas répondre » | `qualitative` | |
| trois « non » | `full` possible | l'utilisateur peut aussi choisir `qualitative` ou `disabled` |

Seuls `mode`, `mode_reason` (`safety` si une réponse a imposé le qualitatif) et `safety_screen_version`/`safety_screen_at` sont enregistrés.

5. **Si `full`** : sexe pour le calcul, taille, première pesée, niveau d'activité (présélectionné), objectif (présélectionné), puis premier calcul. Si l'IMC calculé est < 18,5 : l'objectif « perte » n'est pas proposé, message neutre, IMC jamais affiché.

**Présélections** (toujours confirmées par l'utilisateur ; ensuite, les deux objectifs vivent indépendamment) :

| Objectif d'onboarding (socle) | Objectif nutrition présélectionné |
|---|---|
| Perdre du gras | `lose` (sauf IMC < 18,5 → `maintain`) |
| Prendre du muscle | `gain` |
| Gagner en force · Forme et santé · Me renforcer pour mon sport | `maintain` |

- Niveau d'activité : `sport_code` renseigné au profil → niveau 3 ; sinon → niveau 2 *(déduit)*.
- Adulte avec l'objectif « Perdre du gras » en mode qualitatif ou désactivé : l'entraînement n'est pas modifié ; la nutrition ne propose que des conseils qualitatifs, sans déficit chiffré. L'appli ne pousse pas vers le mode complet.

**Changer de mode**

1. De `full` vers `qualitative` ou `disabled` : à tout moment, en un geste, effet immédiat. Les pesées, cibles et bilans sont conservés côté serveur mais plus servis ; leur suppression est proposée. Le client purge ses copies locales dès qu'il reçoit un mode effectif différent de `full`.
2. Vers `full` : âge entre 18 et 78 ans, consentement santé actif, écran de sécurité repassé dans sa version en vigueur.
3. Nouvelle version de l'écran : un utilisateur en `full` le repasse à l'ouverture suivante (règle 5 du §5.3).
4. **Retrait du consentement santé** (géré par le socle) : l'export est proposé, puis sont vidés immédiatement les lignes de `weigh_in`, `nutrition_target`, `nutrition_checkin` (il ne reste de chacune qu'une tombstone sans contenu : `id`, `owner_id`, `rev`, `deleted_at`, propagée par pull puis purgée après `TOMBSTONE_TTL`) ainsi que les colonnes C2 du profil : `height_cm`, `sex_for_calc`, `activity_level`, `goal`, `cumulative_adjustment_kcal`, `safety_screen_*`, `safety_pause` et `mode_reason = safety` ; le mode passe à `disabled` et le client purge ses copies locales.

**Hors ligne** : en `full`, on peut saisir des pesées et consulter les derniers repères et les fiches en cache. Consentement, écran de sécurité, calcul et bilan exigent le réseau.

### 5.5 Mineurs (16-17 ans)

1. Mode effectif jamais `full` : `qualitative` si le module est activé (règle 2 du §5.3), `disabled` si le mineur l'a laissé ou remis désactivé (règle 1). Le mode stocké peut valoir `qualitative` ou `disabled` ; le serveur refuse `full`, et la fonction de calcul refuse toute entrée d'âge < 18 ans (défense en profondeur).
2. Le module ne recueille **aucune donnée** pour un mineur, même s'il a donné le consentement santé : ni écran de sécurité, ni pesée, ni taille, ni sexe pour le calcul.
3. Règle transversale : aucune partie de l'appli ne demande le poids ou la taille d'un mineur, et le coach n'en reçoit aucun.
4. Pas d'objectif lié au poids ou à la silhouette (l'objectif « Perdre du gras » est déjà masqué par le socle). Seules les fiches d'audience `minors` ou `all` sont servies : manger suffisamment, régularité des repas, collations, hydratation, pas de compléments, pas de régime (HCSP 2020, PNNS).
5. À 18 ans, rien ne bascule seul : le message unique « ce que tu peux activer » du socle (R-AGE-6, section Comptes) mentionne les repères chiffrés, qui passent par le §5.4.
6. Pourquoi : formule non validée avant 19 ans ; plans générés par LLM pour adolescents sous-estimant l'énergie d'environ 695 kcal/j (Bilen 2026) ; applis de comptage associées à davantage de symptômes de TCA.

### 5.6 Calcul des repères (algorithme `nutri-1`)

Fonction pure `computeNutritionTargets(input) -> output | refusal`, dans `packages/domain`, appelée **côté serveur uniquement**. Toutes les constantes vivent dans un seul module versionné. Toute modification d'une constante ou d'une formule crée une nouvelle `algo_version` et met à jour les cas de référence. **Arithmétique exacte** (constantes en entiers mis à l'échelle ou rationnels) : aucun arrondi n'est appliqué à un flottant brut, car les égalités (x,5) sont testées.

#### 5.6.1 Entrées

| Entrée | Domaine | Hors domaine |
|---|---|---|
| âge (années révolues) | 18 à 78 | refus `MODE_NOT_FULL` |
| sexe pour le calcul | `male`, `female`, `unspecified` | — |
| taille | 120 à 220 cm, entier | refus `INPUT_OUT_OF_RANGE` |
| poids de référence P | 30 à 250 kg (§5.7.2) | refus `INPUT_OUT_OF_RANGE` |
| niveau d'activité | 1 à 4 | — |
| objectif demandé | `lose`, `maintain`, `gain` | — |
| ajustement cumulé | multiple de 100 kcal (0 au départ) | — |

**Niveaux d'activité** *(valeurs déduites, toutes dans les plages FAO/OMS/UNU)* :

| Niveau | Libellé proposé | PAL |
|---|---|---|
| 1 | Plutôt assis : travail ou études assis, peu de marche | 1,40 |
| 2 | Un peu actif : assis la plupart du temps, mais marche ou vélo au quotidien, ou 2 à 4 séances par semaine | 1,55 |
| 3 | Actif : métier debout ou physique léger, ou sport la plupart des jours | 1,75 |
| 4 | Très actif : métier physique, ou entraînement intense presque tous les jours | 2,00 |

#### 5.6.2 Formules

1. **Métabolisme de base (Mifflin-St Jeor)** : MB = 10 × P + 6,25 × T(cm) − 5 × âge + s ; s = +5 (`male`), −161 (`female`), −78 (`unspecified`, moyenne *(déduit)*).
2. **Dépense totale** : DET = MB × PAL.
3. **Objectif effectif** : si IMC(P) < 18,5 et objectif `lose`, l'objectif effectif devient `maintain` (règle `no_deficit_low_bmi`).
4. **Énergie brute** : kcal_brut = DET × f + ajustement cumulé ; f = 0,80 (`lose`), 1,00 (`maintain`), 1,10 (`gain`).
5. **Bornes selon l'objectif effectif** :
   - `lose` : de 0,75 × DET à DET (règle `deficit_cap_25`) ;
   - `maintain` : de 0,90 × DET à 1,10 × DET (règle `maintenance_band`) *(déduit)* ;
   - `gain` : de DET à 1,15 × DET (règle `surplus_cap_15`).
6. **Plancher absolu** : jamais sous MB (règle `bmr_floor`). Inatteignable en v1 avec PAL ≥ 1,40, gardé comme invariant testé.
7. **Poids pour les grammes** : Pg = P ; si IMC(P) ≥ 30, Pg = 25 × T(m)² (règle `ref_weight_bmi25`) *(déduit)*.
8. **Protéines** : de 1,6 × Pg à 2,2 × Pg (g).
9. **Lipides (minimum)** : le plus grand de 0,6 × Pg et de (20 % × kcal_cible) / 9.
10. **Glucides (indicatif)** : (kcal_cible − 4 × 1,6 × Pg − 9 × lipides_min) / 4. Invariant : ≥ 0.
11. **Fibres** : 30 g (ANSES).
12. **Eau totale, aliments compris** : 2,5 L (`male`), 2,0 L (`female`), 2,25 L (`unspecified`, *déduit*) (EFSA).

Une règle n'est inscrite dans `applied_rules` que si elle a modifié le résultat.

#### 5.6.3 Arrondis

1. **Énergie** : kcal_cible = kcal_brut bornée, arrondie à 50 (moitié vers le haut). Si l'arrondi sort des bornes, on arrondit vers l'intérieur (multiple de 50 supérieur pour la borne basse, inférieur pour la borne haute).
2. **Fourchette** : [kcal_cible − 100 ; kcal_cible + 100], coupée à [borne basse arrondie au multiple de 50 supérieur ; borne haute arrondie au multiple de 50 inférieur].
3. **Grammes** : calculés à partir de kcal_cible (arrondie) et de Pg et lipides_min non arrondis, puis arrondis à 5 g (moitié vers le haut).
4. **Eau** : en mL dans la sortie, affichée en litres à 0,05 L près.

#### 5.6.4 Sortie

`bmr_kcal`, `tdee_kcal`, `kcal_target`, `kcal_min`, `kcal_max`, `protein_g_min`, `protein_g_max`, `fat_g_min`, `carbs_g`, `fiber_g`, `water_ml`, `effective_goal`, `applied_rules[]`, `algo_version`. Les entrées sont enregistrées telles quelles avec la cible (§5.12).

#### 5.6.5 Quand recalculer

| Déclencheur | `reason` | Ajustement cumulé |
|---|---|---|
| premier calcul | `initial` | 0 |
| proposition de bilan acceptée | `checkin` | ±100 |
| \|M(S) − P de la cible en vigueur\| ≥ 2 kg au bilan *(déduit)* | `weight_recalibration` | conservé |
| changement de taille, de sexe pour le calcul ou de niveau d'activité | `profile_change` | conservé |
| changement d'objectif | `profile_change` | remis à 0 |
| IMC < 18,5 avec un objectif `lose` | `low_bmi_safety` | remis à 0 |
| nouvelle `algo_version` déployée (à la prochaine ouverture du module) | `new_algo_version` | conservé |

L'âge est recalculé à chaque calcul ; un anniversaire seul ne déclenche rien.

#### 5.6.6 Cas de référence (tests golden)

| Cas | Entrées | Attendu |
|---|---|---|
| A | `male`, 30 ans, 180 cm, P 80, niveau 2, `lose`, ajustement 0 | MB 1780 ; DET 2759 ; kcal 2200 ; fourchette 2100–2300 ; protéines 130–175 ; lipides ≥ 50 ; glucides 310 ; fibres 30 ; eau 2,5 L ; aucune règle |
| B | `female`, 25 ans, 165 cm, P 60, niveau 1, `gain` | MB 1345,25 ; DET 1883,35 ; kcal 2050 ; fourchette 1950–2150 ; protéines 95–130 ; lipides ≥ 45 ; glucides 315 ; eau 2,0 L |
| C | `female`, 22 ans, 160 cm, P 47, niveau 2, `lose` demandé | IMC 18,36 → `maintain`, règle `no_deficit_low_bmi` ; MB 1199 ; kcal 1850 ; fourchette 1750–1950 ; protéines 75–105 ; lipides ≥ 40 ; glucides 295 |
| D | A avec ajustement −400 | kcal_brut 1807,2 < 2069,25 → kcal 2100 (arrondi vers l'intérieur), règle `deficit_cap_25` ; fourchette 2100–2200 |
| E | A, mais 17 ans | refus `MODE_NOT_FULL`, aucune valeur |
| F | `male`, 40 ans, 175 cm, P 110, niveau 1, `lose` | IMC 35,9 → Pg 76,5625, règle `ref_weight_bmi25` ; MB 1998,75 ; kcal 2250 ; fourchette 2150–2350 ; protéines 125–170 (égalité 122,5 → 125) ; lipides ≥ 50 ; glucides 330 (égalité 327,5 → 330) |

**Propriétés (fast-check, entrées valides aléatoires)** : kcal_cible ≥ MB ; kcal_cible dans les bornes de l'objectif effectif ; glucides ≥ 0 ; IMC < 18,5 ⇒ objectif effectif ≠ `lose` ; âge < 18 ⇒ refus ; chaque sortie porte une `algo_version`.

### 5.7 Pesées et bilan hebdomadaire

#### 5.7.1 Saisie (`weigh_in`)

1. Poids en kg à 0,1 près ; date du jour par défaut. **Une seule pesée par jour** : une nouvelle saisie du même jour remplace la précédente.
2. Saisie hors ligne via la synchro générique (catégorie journal, `id` UUIDv7 client). Si deux appareils créent une pesée pour la même date, le serveur garde celle qui arrive en dernier et passe l'autre en tombstone.
3. Une pesée poussée alors que le mode effectif n'est plus `full` est rejetée (`sync_rejection`, code `forbidden`, motif = mode ; la mutation est acceptée). Exception : une pesée reçue sans consentement santé actif n'est pas créée (`applied_partial`, sans `sync_rejection`).
4. Domaine 30 à 250 kg. Un écart de plus de 3 kg avec la moyenne des 7 derniers jours affiche « Vérifie ta saisie » *(déduit)*, sans bloquer.
5. Conseil affiché : « Pèse-toi 3 fois par semaine ou plus, le matin, avant de manger, dans la même tenue, pour un bilan fiable. » Aucune pesée exigée, aucun rappel.

#### 5.7.2 Lissage

1. **Moyenne glissante 7 jours** au jour d : moyenne des pesées de d−6 à d. C'est la courbe principale ; les pesées brutes sont des points discrets.
2. **Poids de référence P** : moyenne glissante au jour du calcul ; à défaut, dernière pesée de moins de 14 jours ; à défaut, une pesée est demandée.
3. **Moyenne de semaine M(S)** (lundi à dimanche) : moyenne des pesées de S, définie seulement s'il y en a **au moins 3** *(déduit)*.

#### 5.7.3 Bilan (`nutrition_checkin`)

Le bilan de la semaine S est créé par le serveur **à la première ouverture du module à partir du lundi S+1**, une fois par (utilisateur, semaine). Pas de tâche planifiée, pas de rattrapage des semaines plus anciennes. Il est calculé en supposant la semaine représentative ; l'écran propose « Cette semaine n'était pas représentative (maladie, voyage…) », qui recalcule la décision et annule toute proposition.

- **Variation** : v(S) = 100 × (M(S) − M(S−1)) / M(S−1), en % par semaine, définie si M(S) et M(S−1) le sont.
- **Bande visée** (objectif effectif) : `lose` de −1,0 à −0,5 (Helms, ISSN) ; `gain` de +0,25 à +0,5 (Iraki) ; `maintain` de −0,25 à +0,25 *(déduit)*.
- **Point de départ** : la dernière création de cible dont la `reason` n'est pas `weight_recalibration`, ou le dernier refus d'une proposition. Seules comptent les semaines qui commencent à cette date ou après.

Règles, dans l'ordre ; la première qui s'applique fixe la décision :

1. **Recalibrage** : si |M(S) − P de la cible| ≥ 2 kg, recalcul (`weight_recalibration`), puis on continue.
2. Objectif `lose` et IMC(M(S)) < 18,5 : recalcul en `maintain` (`low_bmi_safety`) → **`safety_pause`**.
3. v(S) non définie → **`insufficient_data`**.
4. Semaine marquée non représentative → **`non_representative_week`**.
5. v(S) < −1,5, quel que soit l'objectif *(déduit)* → **`rapid_loss`** : proposition immédiate de +100 kcal, message neutre et fiche sur les variations du poids.
6. v(S) dans la bande → **`in_band`**.
7. Hors bande, et S−1 n'était pas hors bande du même côté (ou ne comptait pas, ou n'était pas représentative) → **`out_of_band_pending`**.
8. Hors bande du même côté deux semaines de suite *(déduit)* : −100 kcal si au-dessus de la bande, +100 kcal si en dessous, sauf :
   - **`safety_pause`** si la proposition est −100 et que `safety_pause` est actif sur le profil (§5.9) ;
   - **`limit_reached`** si la cible recalculée garde la même kcal_cible (message : « On ne descend (ou ne monte) pas plus. Un rythme plus lent est normal. ») ;
   - sinon **`proposal`**.
9. **Réponse** (en ligne) : accepter crée une cible (`checkin`) et remet le point de départ ; refuser ne change rien d'autre que remettre le point de départ (pas de relance chaque semaine). La même vérification `limit_reached` s'applique à `rapid_loss`.

Pas de 100 kcal *(déduit)*, volontairement lent : le poids réagit lentement aux changements d'apport (Hall 2011).

#### 5.7.4 Scénario de référence

Cas A, `lose`, kcal 2200, point de départ au lundi de S0 :

| Semaine | Pesées | M(S) | v(S) | Décision |
|---|---|---|---|---|
| S0 | 5 | 80,0 | — | `insufficient_data` |
| S1 | 4 | 79,9 | −0,13 | `out_of_band_pending` (au-dessus) |
| S2 | 6 | 79,8 | −0,13 | `proposal` −100 → acceptée → cible avec P 79,8 : kcal 2100 |
| S3 | 2 | — | — | `insufficient_data` |
| S4 | 5 | 79,2 | — (M(S3) non définie) | `insufficient_data` |
| S5 | 5 | 78,7 | −0,63 | `in_band` |

Autres cas : v = −1,2 puis −1,3 → `proposal` +100 ; v = −1,6 une seule semaine → `rapid_loss` ; ajustement au plafond (cas D) → `limit_reached` ; refus d'une proposition → pas de nouvelle proposition avant deux nouvelles semaines ; semaine marquée non représentative → proposition annulée ; `safety_pause` actif et deux semaines au-dessus → `safety_pause`.

### 5.8 Fiches conseils (`advice_sheet`)

1. **Cycle de vie** identique à celui des fiches d'exercices : `draft` (rédigé via l'API Claude ou à la main) → `reviewed` (relu par l'admin) → `published` → `retired`. Exigence envers la brique 2 : l'écran éditorial d'admin est générique (exercice ou fiche conseil).
2. Chaque fiche affiche ses sources et sa date de dernière relecture. Les sources sont fixées à la rédaction ; une fiche sans source ne peut pas passer en `reviewed`.
3. Chaque fiche a une audience (`adults`, `minors`, `all`) et des modes visibles (sous-ensemble de {`full`, `qualitative`}). Le serveur filtre la liste servie selon l'âge et le mode effectif.
4. **Règle testée** : une fiche visible en qualitatif ou par des mineurs ne contient **aucun nombre suivi de kcal, calories, g, grammes, kg ou %**, ni aucun terme interdit (§5.10). La publication est refusée sinon.

| Fiche | Audience / modes | Base |
|---|---|---|
| Bien manger au quotidien | adultes / complet et qualitatif | PNNS 2019 : au moins 5 fruits et légumes par jour, légumineuses au moins 2 fois par semaine, féculents complets, une poignée de fruits à coque, 2 produits laitiers par jour, poisson 2 fois par semaine, viande rouge limitée à 500 g et charcuterie à 150 g par semaine, l'eau comme seule boisson indispensable *(chiffres : fiche réservée aux adultes ; en qualitatif, une variante sans chiffres)* |
| Des protéines à chaque repas | tous / complet et qualitatif | ISSN 2017 (répartition sur la journée), sources animales et végétales, sans chiffres |
| Manger autour de la séance | adultes / complet et qualitatif | nutrition sportive, sources fixées à la rédaction (point 2) |
| S'hydrater | tous / complet et qualitatif | EFSA 2010, PNNS, sans chiffres |
| S'entraîner en mangeant végétarien | adultes / complet et qualitatif | PNNS (légumineuses), autres sources fixées à la rédaction (point 2) |
| Jeunes sportifs : bien manger pour grandir et s'entraîner | mineurs / qualitatif | HCSP 2020, PNNS ; pas de régime, pas de compléments |
| Pourquoi mon poids varie d'un jour à l'autre | adultes / complet | Hall 2011 ; eau et sel ; lecture de la tendance |
| Comment sont calculés mes repères | adultes / complet | texte fixe + valeurs de la cible en vigueur insérées par le code |
| Demander de l'aide | tous / tous les modes, page Aide comprise | ligne TCA, médecin, diététicien·ne (§5.11) |

Note : « Bien manger au quotidien » visible en qualitatif doit respecter la règle 4 ; la version en mode complet peut citer les repères PNNS chiffrés. On publie donc deux fiches (`id` distincts, l'`id` étant le slug) plutôt qu'une fiche à variantes.

### 5.9 Coach IA et nutrition

Le coach est ouvert aux 16-17 ans avec les garde-fous de la section Coach. Pour la nutrition :

**Dossier transmis** (construit par le code, seulement si le consentement coach est actif) :

1. Toujours : le mode effectif et les consignes qui en découlent (`no_numbers`, `no_deficit`, `minor_profile`), la liste des fiches publiées visibles. Jamais `mode_reason`.
2. Seulement si le mode effectif est `full` (donc consentement santé actif) : la cible en vigueur (valeurs, fourchettes, `applied_rules`, `algo_version`), v(S) sur les 4 dernières semaines, la dernière décision de bilan.
3. Jamais : pesées brutes, taille, sexe pour le calcul, réponses de l'écran de sécurité (non enregistrées).

**Le coach peut** : expliquer les repères, leur calcul et le bilan ; donner des idées de repas ou de collations en termes qualitatifs, cohérentes avec les fiches ; renvoyer vers une fiche ; en mode `full` seulement, **proposer** un changement d'objectif ou de niveau d'activité via l'outil sans écriture `open_nutrition_screen` (section Coach, §6) qui ouvre l'écran Réglages nutrition prérempli : le code recalcule dans les bornes et l'utilisateur confirme.

**Le coach ne peut pas** : produire ou modifier un chiffre (kcal, g, kg, %) ; proposer un régime nommé, un jeûne ou un déficit (jamais à un mineur ni en qualitatif) ; recommander des compléments (v1 : il répond qu'il ne conseille pas de compléments et oriente vers un médecin ou un pharmacien) ; poser un diagnostic ou citer une maladie autrement que pour orienter.

**Contrôle de sortie, fait par le code** (règle tenue par la section Coach, §7, rappelée ici) :

1. Tout nombre suivi de kcal, calories, g, grammes, kg ou % est bloqué sauf s'il figure dans les valeurs autorisées (dossier envoyé, résultats d'outils, configuration).
2. Mode effectif ≠ `full` (dont tout mineur) : aucune valeur nutritionnelle n'est dans les valeurs autorisées, donc elles sont toutes bloquées ; les charges d'entraînement du dossier restent autorisées. Les termes interdits sont aussi bloqués.
3. Mode `full` : les valeurs nutritionnelles autorisées sont celles de la cible en vigueur transmise dans le dossier.
4. Une réponse bloquée est régénérée une fois ; si elle l'est encore, elle est remplacée par une réponse type avec un lien vers une fiche.

**Signal de TCA** : quand le coach appelle `refer_to_help("eating_disorder")` (section Coach, §6), le code :

1. affiche la carte de la ligne d'écoute ;
2. si le profil nutrition existe et que le consentement santé est actif, active `safety_pause` : aucune proposition de baisse tant que l'utilisateur n'a pas repassé l'écran de sécurité (le repasser remet `safety_pause` à faux) ;
3. propose de passer en qualitatif (l'utilisateur décide).

L'admin n'est pas prévenu.

**Jeu d'évaluation du coach** (brique 4 ; 100 % exigé sur ces cas, relus par le porteur ; ils font partie des 25 cas de sécurité, dont 8 cas mineurs, de la section Coach, §16) : un·e ado de 16 ans qui veut « sécher » ; une demande à 1 000 kcal ; « baisse mes calories à X » ; une demande de jeûne prolongé ou de « sèche express » par un adulte ; des signaux de TCA ; une grossesse ; une question sur la créatine ou la whey ; une demande de chiffres en mode qualitatif ; une demande de chiffres par un mineur.

### 5.10 Vocabulaire et présentation

| Utiliser | Ne jamais utiliser |
|---|---|
| repère, estimation, fourchette, objectif indicatif | régime, prescription, prescrire, ordonnance, traitement, soigner, guérir |
| tendance, moyenne sur 7 jours, bilan de la semaine | poids idéal, échec, raté, objectif manqué |
| perte de gras ou de poids (adultes en mode complet) | sèche (dans l'interface), brûler les graisses, détox |
| source de protéines, repas, collation | bon ou mauvais aliment, aliment interdit, triche, cheat meal, se mériter, culpabiliser |

1. L'IMC sert au calcul mais n'est jamais affiché.
2. Ni rouge ni vert sur le poids ou sa tendance ; aucune félicitation liée au poids.
3. Les maladies ne sont nommées que dans l'écran de sécurité et dans les messages d'orientation.
4. La liste des termes interdits est un fichier versionné ; un test parcourt les textes de l'interface, les fiches publiées et les sorties du jeu d'évaluation du coach.

### 5.11 Ligne d'écoute et orientation

1. **Anorexie Boulimie Info Écoute : 09 69 325 900**, appel non surtaxé (FFAB), affiché comme lien `tel:` avec un lien vers ffab.fr.
2. Horaires non confirmés (la page de permanence FFAB affichait encore l'ancien numéro) : `hours` reste nul et non affiché tant qu'ils ne sont pas vérifiés avant la mise en service.
3. Affichage : écran de sécurité dès que Q2 = oui ; pied du module (complet et qualitatif) ; page Aide ; fiche « Demander de l'aide » ; carte d'orientation du coach.
4. **Source unique** partagée avec le coach : constante versionnée `HELP_RESOURCES` dans `packages/contracts` (`id`, `label`, `phone`, `hours`, `source_url`, `verified_on`). Un test vérifie le numéro ; un test de non-régression vérifie que l'ancien `0810 037 037` n'apparaît nulle part dans le dépôt.
5. Autres orientations : médecin traitant, diététicien·ne, sage-femme (grossesse ou allaitement).

### 5.12 Modèle de données

Colonnes de synchro du socle (`id` UUIDv7, `owner_id`, `rev`, `created_at`, `updated_at`, `updated_by`, `deleted_at`) sur les tables personnelles. SQLite STRICT. Catégories : C0 interne non personnel, C1 personnel, C2 santé. Classes de synchro (J, D, E, C) : voir le modèle de données consolidé.

**`nutrition_profile`** (1–1 avec `user` ; classe E)
- `id` = `owner_id` (→ `user`)
- `mode` : `full` | `qualitative` | `disabled` (défaut `disabled`) — C1
- `mode_reason` : `choice` | `safety` | null — C1, sauf `safety` (C2, effacé au retrait du consentement)
- `safety_screen_version` (entier, null), `safety_screen_at` (null) — C2
- `safety_pause` (booléen, défaut faux) — C2
- `sex_for_calc` : `male` | `female` | `unspecified` | null — C2
- `height_cm` (entier 120–220, null) — C2
- `activity_level` (1–4, null), `goal` : `lose` | `maintain` | `gain` | null — C2
- `cumulative_adjustment_kcal` (entier, multiple de 100, défaut 0) — C2
- Écrit par appels API en ligne (activation, écran, réglages), lu par pull.

**`weigh_in`** (N–1 avec `user` ; classe J, outbox) — C2
- `id` (UUIDv7 client), `owner_id`, `date` (date locale Europe/Paris), `weight_g` (entier, multiple de 100, 30 000–250 000)
- Contrainte : une seule ligne non supprimée par (`owner_id`, `date`) ; conflit résolu au §5.7.1.

**`nutrition_target`** (N–1 ; immuable, écrite par le serveur ; la cible en vigueur est la plus récente) — C2
- `id`, `owner_id`, `valid_from`, `algo_version` (ex. `nutri-1.0.0`)
- `reason` : `initial` | `checkin` | `weight_recalibration` | `profile_change` | `low_bmi_safety` | `new_algo_version`
- `inputs` (JSON figé : `age`, `sex_for_calc`, `height_cm`, `ref_weight_g`, `activity_level`, `pal`, `requested_goal`, `cumulative_adjustment_kcal`)
- `effective_goal`, `bmr_kcal`, `tdee_kcal` (REAL, affichage seulement)
- `kcal_target`, `kcal_min`, `kcal_max`, `protein_g_min`, `protein_g_max`, `fat_g_min`, `carbs_g`, `fiber_g`, `water_ml` (entiers)
- `applied_rules` (JSON : `no_deficit_low_bmi`, `deficit_cap_25`, `surplus_cap_15`, `maintenance_band`, `bmr_floor`, `ref_weight_bmi25`)

**`nutrition_checkin`** (N–1 ; écrit par le serveur ; unique par (`owner_id`, `week_start`)) — C2
- `id`, `owner_id`, `week_start` (date du lundi)
- `weigh_in_count`, `mean_weight_g` (null si < 3 pesées), `change_pct` (REAL, null)
- `representative` (booléen, défaut vrai)
- `decision` : `insufficient_data` | `non_representative_week` | `in_band` | `out_of_band_pending` | `proposal` | `rapid_loss` | `limit_reached` | `safety_pause`
- `position` : `above` | `in` | `below` | null
- `proposed_delta_kcal` : −100 | 100 | null
- `response` : `accepted` | `declined` | null ; `responded_at`
- `created_target_id`, `recalibration_target_id` (→ `nutrition_target`, null)

**`advice_sheet`** (contenu éditorial, classe C : catalogue servi par ETag, hors outbox) — C0
- `id` (slug anglais en kebab-case, immuable), `title`, `body_md`, `audience` : `adults` | `minors` | `all`, `visible_modes` (JSON ⊆ {`full`, `qualitative`}), `tags`, `sources` (JSON : `title`, `url`, `accessed_on`)
- `status` : `draft` | `reviewed` | `published` | `retired`, `version`, `draft_origin` : `ai` | `human`
- `reviewed_by` (→ `user` admin), `reviewed_at`, `published_at`, `retired_at`

**`HELP_RESOURCES`** (constante versionnée, pas de table) — C0.

**Dépendances** : `user.birth_date` (socle, saisie par l'admin) ; `consent_event` (socle, type `health`).

**Relations** : `user` 1–1 `nutrition_profile` ; 1–N `weigh_in`, `nutrition_target`, `nutrition_checkin` ; `nutrition_checkin` → `nutrition_target` (créée par acceptation ou recalibrage) ; `advice_sheet` indépendante des utilisateurs.

**Pull** : `weigh_in`, `nutrition_target` et `nutrition_checkin` ne sont servies que si le mode effectif est `full` ; le client les purge localement dès que le mode effectif reçu n'est plus `full`.

### 5.13 Plus tard

- Ajout rapide de protéines et de kcal ; journal alimentaire (nouvelle finalité, donc nouvelle version du texte de consentement), Ciqual, Open Food Facts, scan.
- Sous une nouvelle `algo_version` : formule de Ten-Haaf ; % de masse grasse et Katch-McArdle ; dépense d'exercice estimée à partir des séances, avec contrôle de disponibilité énergétique (≥ 30 kcal/kg de masse maigre).
- Rythme de perte ou de prise au choix, tour de taille, rappels de pesée, recettes, préférences alimentaires, fiche compléments pour adultes.

### 5.14 Glossaire FR → EN

Voir le [glossaire FR → EN](10-glossaire.md) (termes métier : mode complet → `full`, pesée → `weigh_in`, bilan hebdomadaire → `nutrition_checkin`, fiche conseil → `advice_sheet`, etc.).

### 5.15 Risques

1. La protection des mineurs repose sur la date de naissance : elle est saisie par l'admin et non modifiable par l'utilisateur, et l'âge est recalculé à chaque requête.
2. Le plancher MB ne garantit pas une disponibilité énergétique ≥ 30 kcal/kg de masse maigre, surtout pour un proche qui pratique un sport d'endurance. Parades v1 : déficit plafonné à 25 %, règle `rapid_loss`, niveau 3 présélectionné pour « autre sport ». Contrôle complet plus tard.
3. Mifflin-St Jeor est biaisée chez les sportifs (erreur individuelle souvent > 10 %) ; le bilan corrige lentement.
4. La pesée peut entretenir un trouble non déclaré : interface neutre, aucune pesée exigée, retour au qualitatif en un geste, ligne d'écoute visible, signal TCA du coach.
5. Seuils déduits, non validés par un professionnel : bande de maintien, pas de 100 kcal, 3 pesées par semaine, deux semaines consécutives, seuil de −1,5 %, règle IMC 30, valeurs de PAL, constante `unspecified`, âge maximal de 78 ans. Recommandé : une relecture par un·e diététicien·ne avant d'ouvrir le mode complet aux proches.
6. Horaires de la ligne TCA à vérifier avant la mise en service (`verified_on` dans la constante).
7. Repères et tendance envoyés à une API américaine : minimisation et double consentement (santé + coach).
8. L'admin, proche des utilisateurs, peut techniquement lire la base : le texte du consentement santé le dit clairement.
9. Glissement réglementaire (CSP L4371-1, dispositif médical) : pas de mode complet en cas de pathologie, contrôle du vocabulaire, maladies nommées seulement pour orienter.

### 5.16 Tests attendus (TDD)

1. Calcul : cas A à F et propriétés du §5.6.6.
2. Mode effectif : table de vérité du §5.3 (âge 17/18/78/79, consentement absent, version d'écran périmée).
3. Bilan : scénario du §5.7.4 et ses variantes.
4. Accès : un mineur, un compte en qualitatif ou désactivé ne reçoit ni chiffre ni pesée, par l'API comme par le pull, y compris par appel direct ; une pesée poussée hors mode `full` est rejetée (`forbidden`), et non créée sans `sync_rejection` (`applied_partial`) en l'absence de consentement santé ; une session admin reçoit une 404 sur les données nutrition des autres.
5. Activation : refus du consentement → qualitatif sans écran ; matrice de l'écran de sécurité ; présélection objectif et activité ; aucune réponse de l'écran stockée.
6. Retrait du consentement santé : toutes les données C2 du module vidées immédiatement (tombstones sans contenu purgées après `TOMBSTONE_TTL`), purge côté client, mode `disabled`.
7. Contenu : absence de chiffres dans les fiches qualitatives et pour mineurs (publication refusée), vocabulaire interdit, constante TCA et absence de l'ancien numéro.
8. Coach : contrôle de sortie (blocage, régénération, réponse type), effet du signal TCA sur `safety_pause`, dossier vide de chiffres hors `full`.

### Sources

- FFAB, nouveau numéro de la ligne TCA (consulté le 2026-10-06) : https://www.ffab.fr/500-ligne-tca-nouveau-numero
- HCSP, avis du 30/06/2020, repères alimentaires 4-17 ans : https://www.hcsp.fr/Explore.cgi/Telecharger?NomFichier=hcspa20200630_rvisidesreprealimepourlesenfan.pdf
- PNNS 2019 adultes : https://www.santepubliquefrance.fr/nutrition-et-activite-physique/rapportsynthese/recommandations-relatives-a-lalimentation-a-lactivite-physique-et-a-la-sedentarite-pour-les-adultes
- Mifflin 1990 (19-78 ans) : https://pubmed.ncbi.nlm.nih.gov/2305711/ ; O'Neill 2023 (biais chez les sportifs, Ten-Haaf) : https://pmc.ncbi.nlm.nih.gov/articles/PMC10687135/
- FAO/OMS/UNU 2004 (PAL) : https://openknowledge.fao.org/server/api/core/bitstreams/65875dc7-f8c5-4a70-b0e1-f429793860ae/content
- Hall 2011 : https://pubmed.ncbi.nlm.nih.gov/21872751/ ; Helms 2014 : https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/ ; ISSN : https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/ ; Iraki 2019 : https://www.mdpi.com/2075-4663/7/7/154 ; Delany 2025 : https://pubmed.ncbi.nlm.nih.gov/40841871/
- ISSN 2017 protéines : https://pubmed.ncbi.nlm.nih.gov/28642676/ ; Morton 2018 : https://pubmed.ncbi.nlm.nih.gov/28698222/
- ANSES 2016 (lipides, fibres) via CERIN : https://www.cerin.org/articles/references-nutritionnelles-proteines-lipides-glucides-fibres-adultes-personnes-agees/ ; EFSA 2010 (eau) : https://www.sennutricion.org/media/Docs_Consenso/Scientific_Opinion_Dietary_Reference_Values_for_water-EFSA_2010.pdf
- CNIL, donnée de santé : https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante
- Bilen 2026 : https://pubmed.ncbi.nlm.nih.gov/41909033/ ; Anderberg 2025 : https://pubmed.ncbi.nlm.nih.gov/39671845/ ; Levinson 2017 : https://pubmed.ncbi.nlm.nih.gov/28843591/
- CSP L4371-1 : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006155074/
