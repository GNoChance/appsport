# Nutrition : calcul des besoins, bases alimentaires (Ciqual, Open Food Facts, USDA), scan de code-barres en PWA, périmètre v1, garde-fous et modèle de données minimal

# Nutrition — besoins, bases alimentaires, scan, périmètre v1

*Recherche du 2026-10-06. Tout ce qui n'est pas marqué « (déduit) » a été vérifié sur la source liée. « (déduit) » désigne un choix de conception à valider.*

## 1. Calcul des besoins

**Métabolisme de base (MB)**
- **Mifflin-St Jeor** : H = 10·poids + 6,25·taille − 5·âge + 5 ; F = … − 161. Elle a été établie sur 498 adultes de 19 à 78 ans ([Mifflin 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/)). C'est la plus fiable des quatre équations usuelles, avec toutefois des erreurs individuelles notables ([Frankenfield 2005](https://pubmed.ncbi.nlm.nih.gov/15883556/)).
- **Chez les sportifs**, Mifflin est biaisée. Seules Cunningham, Harris-Benedict, De Lorenzo et Ten-Haaf ne le sont pas. Ten-Haaf place 80,2 % des sujets à ±10 %, contre 40,7–63,7 % pour les autres équations ([O'Neill 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10687135/)).
- **Katch-McArdle** (370 + 21,6 × masse maigre) n'est utile que si le % de gras est fiable, ce que les balances à impédance ne garantissent pas (déduit).

**Activité.** Plages FAO/OMS/UNU du niveau d'activité (PAL) : 1,40–1,69 sédentaire, 1,70–1,99 actif, 2,00–2,40 très actif ([FAO 2004](https://openknowledge.fao.org/server/api/core/bitstreams/65875dc7-f8c5-4a70-b0e1-f429793860ae/content)). Le coefficient « ×1,2 » des calculateurs grand public est en dessous de cette plage (déduit).

**Limite principale.** Le poids réagit lentement : il faut environ un an pour atteindre la moitié de l'effet d'un changement d'apport ([Hall 2011](https://pubmed.ncbi.nlm.nih.gov/21872751/)). La formule ne donne donc qu'un point de départ. Il faut la recalibrer toutes les 2–3 semaines sur la tendance du poids (moyenne glissante sur 7 jours), par pas de ±100–150 kcal (déduit).

| Objectif | Rythme raisonnable | Source |
|---|---|---|
| Perte de gras | −0,5 à −1 % du poids/sem. ; 0,5–1 kg/sem., déficit 250–1000 kcal/j | [Helms 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/), [Delany 2025](https://pubmed.ncbi.nlm.nih.gov/40841871/) (synthèse de 73 consensus) |
| Prise de muscle | +0,25–0,5 %/sem., surplus ~10–20 % | [Iraki 2019](https://www.mdpi.com/2075-4663/7/7/154) |
| Recomposition / maintien | apport de maintien, poids stable | (déduit) |

**Macronutriments, fibres, eau**
- **Protéines**
  - ISSN : 1,4–2,0 g/kg/j, jusqu'à 2,3–3,1 g/kg/j en déficit chez les pratiquants entraînés, 20–40 g par prise toutes les 3–4 h ([ISSN 2017](https://pubmed.ncbi.nlm.nih.gov/28642676/)).
  - Au-delà de ~1,62 g/kg/j, plus de gain de masse maigre ([Morton 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/)).
  - Pour un adulte non sportif, l'Afssa juge 0,83–2,2 g/kg/j « satisfaisant » et 2,2–3,5 « élevé », sans fixer de limite de sécurité ([Afssa 2007](https://www.anses.fr/fr/system/files/NUT-Sy-Proteines.pdf)).
  - → Valeur par défaut 1,6 g/kg, plage 1,6–2,2, plafond à 2,2 (déduit).
- **Lipides** : 35–40 % de l'énergie selon l'ANSES pour la population générale ([ANSES 2016 via CERIN](https://www.cerin.org/articles/references-nutritionnelles-proteines-lipides-glucides-fibres-adultes-personnes-agees/)) ; 0,5–1,5 g/kg/j chez les culturistes (Iraki). → Plancher : le plus élevé de 0,6 g/kg et 20 % des kcal (déduit).
- **Fibres** : 30 g/j (ANSES).
- **Eau totale**, aliments compris : 2,0 L/j pour les femmes, 2,5 L/j pour les hommes ([EFSA 2010](https://www.sennutricion.org/media/Docs_Consenso/Scientific_Opinion_Dietary_Reference_Values_for_water-EFSA_2010.pdf)).
- **Glucides** : le reste de l'énergie.

## 2. Bases alimentaires

| | Ciqual 2025 (ANSES) | Open Food Facts | USDA FDC |
|---|---|---|---|
| Contenu | 3 484 aliments génériques, 74 constituants (2025-11-19) | 1 272 478 produits « France », dont 943 239 avec tableau nutritionnel complété (API, 2026-10-06) | aliments américains |
| Licence | Etalab 2.0 | ODbL/DbCL, images CC-BY-SA | CC0 |
| Accès | XLSX 1,5 Mo, XML 69 Mo | API v3 (v2 dépréciée) ; exports quotidiens : CSV 1,28 Go gz, JSONL 13,1 Go gz, Parquet 7,9 Go | API avec clé, 1 000 req/h/IP |
| Usage | aliments bruts et plats maison | produits emballés (code-barres) | secours, en anglais |

Sources : [Ciqual](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY), [OFF](https://world.openfoodfacts.org/data), [FDC](https://fdc.nal.usda.gov/api-guide/).

**Open Food Facts : contraintes fortes**
- **Quotas.** Depuis avril 2026, la lecture d'un produit est limitée à **15 req/min/IP** (100 auparavant) et la recherche à 10 req/min. La recherche « à la frappe » est proscrite et un bannissement d'IP est possible ([doc](https://openfoodfacts.github.io/openfoodfacts-server/api/), [commit](https://github.com/openfoodfacts/openfoodfacts-server/commit/fe164794f42dfdb2bc630901facc9a2a49f5c57d)).
  - Si toutes les requêtes passent par notre serveur, ces 15 req/min sont partagées entre tous les utilisateurs.
  - OFF recommande un miroir local alimenté par les exports quotidiens.
  - Un User-Agent de la forme `App/Version (email)` est exigé.
  - Pendant nos tests, une recherche non filtrée a renvoyé « Page temporarily unavailable ».
- **Appels directs depuis le navigateur.** C'est possible : CORS `*` vérifié, et la doc compte alors le quota par utilisateur. Mais l'adresse IP des utilisateurs est transmise à OFF, et rien ne fonctionne hors ligne.
- **Valeurs manquantes dans Ciqual.** La table contient des « - », « traces » et « < x ». La table complétée CALNUT semble n'exister qu'en version 2020 (à vérifier).
- **Fiabilité.** OFF fournit ses données « sans garantie d'exactitude ». Une base participative reste fiable pour l'énergie et les macros si l'on écarte les valeurs aberrantes (r = 0,96 ; 2,8 % de valeurs rejetées, [Evenepoel 2020](https://pubmed.ncbi.nlm.nih.gov/33084583/)). → À l'import, vérifier que 4P + 4G + 9L ≈ kcal à ±15 % (déduit).
- **ODbL.** Extraire tous les produits français crée une base dérivée. Si des tiers utilisent l'appli, il faut citer OFF et mettre à disposition cette base ou le script de transformation. Nos propres tables, gardées séparées, restent une « Collective Database » non soumise à l'ODbL ([ODbL §4.4–4.6](https://opendatacommons.org/licenses/odbl/1-0/) ; interprétation à valider). wger réalise déjà cet import avec une synchronisation quotidienne ([code](https://github.com/wger-project/wger/blob/master/wger/nutrition/management/commands/import-off-products.py)).

## 3. Scan de code-barres

**Support de `BarcodeDetector`** ([MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json)) :
- natif sur Chrome Android 83+ ;
- Chrome desktop : seulement sous macOS et ChromeOS ;
- Safari 17+ : derrière un réglage désactivé par défaut, donc **indisponible dans tous les navigateurs iOS** ;
- Firefox : absent.

**Approche retenue.** Utiliser l'API native si elle existe, sinon le polyfill [`barcode-detector`](https://github.com/Sec-ant/barcode-detector) (MIT, ZXing-C++ compilé en WASM). Son binaire de lecture (~1,04 Mio) est chargé par défaut depuis jsDelivr : il faut l'auto-héberger et le mettre en cache ([zxing-wasm](https://github.com/Sec-ant/zxing-wasm)). `@zxing/library` n'est plus qu'en « maintenance mode ».

**Prérequis.** La caméra exige HTTPS ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)), donc un nom de domaine et un certificat valides sur le serveur maison.

**Performances (indicatives).**
- Mesures de 2021 : 47 ms par image en natif contre 92 ms pour ZXing-JS sur Pixel 4a ; 77 contre 373 ms sur un Android bas de gamme ([minhazav](https://blog.minhazav.dev/Using-BarcodeDecoder-in-javascript/)).
- Benchmark d'éditeur de 2026, donc biaisé : zxing-wasm décode en 74 ms (médiane) et lit 3 814 EAN-13 difficiles sur 4 857 ([Dynamsoft](https://www.dynamsoft.com/codepool/benchmark-barcode-reading-javascript-zxing-wasm-dynamsoft-barcode-reader.html)).
- Garder la saisie manuelle des chiffres en secours.

## 4. Périmètre : objectifs + conseils, ou journal complet ?

- **Concurrents.** MyFitnessPal réserve le scan, la saisie par photo et les macros personnalisées à son offre Premium (49,99 €/an, [MFP](https://www.myfitnesspal.com/premium)). Yazio laisse le scan gratuit ([Yazio](https://www.yazio.com/en/android-app)).
- **Adhésion.** Avec MFP, les utilisateurs passent de 5,4 à 1,4 jour de saisie par semaine entre les semaines 4 et 12. Les freins cités sont la saisie manuelle et les bases incomplètes ([Dugas 2026](https://pubmed.ncbi.nlm.nih.gov/41329042/)).
- **Risque de TCA.** Une revue de 38 études associe ces applis à davantage de symptômes de troubles alimentaires, sans lien de causalité établi ([Anderberg 2025](https://pubmed.ncbi.nlm.nih.gov/39671845/)). 73 % des patients atteints de TCA qui utilisent MFP estiment qu'elle a contribué à leur trouble ([Levinson 2017](https://pubmed.ncbi.nlm.nih.gov/28843591/)).
- **Effort (déduit).** La v1 « cibles + conseils + suivi du poids » demande environ 1–2 semaines. Un journal complet (Ciqual, miroir OFF, recherche en français, scan, portions, hors ligne) demande environ 6–10 semaines.
- **Indispensable pour un pratiquant (déduit)** : un apport énergétique adapté à l'objectif, assez de protéines et le suivi de la tendance du poids.

## 5. Garde-fous et formulation

- **Mineurs**
  - Mifflin n'est validée qu'à partir de 19 ans.
  - Des plans générés par cinq LLM pour des adolescents sous-estimaient l'énergie d'environ 695 kcal/j ([Bilen 2026](https://pubmed.ncbi.nlm.nih.gov/41909033/)).
  - En France, un mineur ne peut consentir seul qu'à partir de 15 ans ([CNIL](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans)).
  - → Avant 18 ans : conseils qualitatifs uniquement (déduit).
- **TCA, grossesse ou allaitement, pathologie ou traitement**
  - Aucun chiffre ni déficit ; orienter vers un professionnel.
  - Pour les TCA, afficher la ligne Anorexie Boulimie Info Écoute, 0810 037 037 ([FFAB](https://www.ffab.fr/trouver-de-l-aide/permanence-telephonique)).
  - Proposer à tous un mode « sans chiffres » (déduit).
- **Déficits**
  - Plafonds de 1 % du poids par semaine et de 25 % de la dépense ; plancher au niveau du MB estimé ; aucun déficit si l'IMC est inférieur à 18,5 (déduit).
  - Garder une disponibilité énergétique au-dessus de 30 kcal/kg de masse maigre ([Delany 2025](https://pubmed.ncbi.nlm.nih.gov/40841871/)) pour éviter le déficit énergétique relatif dans le sport (REDs, [CIO 2023](https://www.olympics.com/ioc/news/ioc-publishes-new-consensus-statement-on-relative-energy-deficiency-in-sport-reds-to-protect-athlete-health)).
- **Cadre réglementaire**
  - Un logiciel « bien-être » n'est pas un dispositif médical ; c'est la finalité revendiquée qui compte (MDCG 2019-11, révisé en 2025, [Emergo](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful)).
  - L'éducation nutritionnelle de patients sur prescription médicale relève du diététicien ([CSP L4371-1](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006155074/)).
  - Vocabulaire : « repère », « estimation », « objectif indicatif ». Jamais « régime », « prescription » ou « traitement », et aucune mention de maladie.
  - Depuis le 2 août 2026, le chatbot doit indiquer qu'il est une IA (AI Act, art. 50, [synthèse](https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/technology/ai-transparency-ai-act-what-businesses-need-know-before-2-august-2026/)).
  - Un poids croisé avec des apports caloriques devient une donnée de santé ([CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)) : il faut un consentement explicite.
- **IA**
  - Les cibles sont calculées par du code versionné. Le LLM explique, mais ne fixe aucun chiffre.
  - Justification : à partir de photos de repas, ChatGPT-4 s'écarte de plus de 10 % sur 13 nutriments sur 16 ([O'Hara 2025](https://pubmed.ncbi.nlm.nih.gov/40004936/)).

## Recommandation et modèle de données

**v1**
- onboarding nutrition facultatif, avec écran de sécurité ;
- cibles en fourchettes : kcal ±100, protéines, plancher de lipides, fibres, eau ;
- pesées et bilan hebdomadaire avec ajustement adaptatif ;
- fiches conseils fondées sur le [PNNS 2019](https://www.santepubliquefrance.fr/nutrition-et-activite-physique/rapportsynthese/recommandations-relatives-a-lalimentation-a-lactivite-physique-et-a-la-sedentarite-pour-les-adultes) et la nutrition sportive ;
- coach IA encadré.

Le contexte d'entraînement saisi à l'inscription (maison/poids du corps, salle, loisir) présélectionne le PAL et le ton ; en « loisir », le mode qualitatif est activé par défaut (déduit).

**v1.1** : ajout rapide de protéines/kcal et recherche dans Ciqual. **v2** : miroir OFF et scan.

**Tables v1**
- `nutrition_profile`(user_id, birth_date, sex_for_calc, height_cm, activity_level, training_context, goal, pace, body_fat_pct?, diet_pattern, nutrition_mode[complet|qualitatif|désactivé], safety_flags jsonb, health_consent_at)
- `body_metric`(user_id, measured_on, weight_kg, waist_cm?, body_fat_pct?)
- `nutrition_target`(user_id, valid_from, kcal, protein_g_min/max, fat_g_min, carbs_g, fiber_g, water_ml, method, algo_version, inputs jsonb, reason)
- `nutrition_checkin`(user_id, week_start, trend_kg_week, adherence/hunger/energy 1–5, kcal_adjustment)

**Tables v2** : `food_generic` (Ciqual), `off_product` (miroir séparé, sous ODbL), `user_food`, `food_log_entry` (quantity_g + copie figée des kcal/P/G/L pour que l'historique ne bouge pas).

**Susceptible d'être périmé** : quotas OFF (modifiés en avril 2026, doc retouchée en septembre), tarifs MFP/Yazio, support de `BarcodeDetector` dans Safari, calendrier de l'AI Act (discussions « Digital Omnibus »), révisions des tables ANSES.


## Recommandation

Livrer en v1 le périmètre A.

**Profil et sécurité**
- Onboarding nutrition facultatif, greffé sur le contexte d'entraînement : maison/poids du corps, salle ou loisir ; en « loisir », mode qualitatif par défaut.
- Écran de sécurité : âge, grossesse ou allaitement, antécédents de TCA, pathologie ou traitement. Il détermine le mode nutrition : complet, qualitatif ou désactivé.

**Cibles calculées par du code versionné**
- Métabolisme de base : Mifflin-St Jeor ; Katch-McArdle seulement si un % de gras fiable est fourni.
- Dépense : multiplication par un niveau d'activité FAO (1,4 à 2,2).
- Ajustement selon l'objectif :
  - perte de gras : −0,5 à −1 % du poids par semaine, déficit plafonné à 25 % ;
  - prise de muscle : +0,25 à +0,5 % par semaine, surplus de 10 à 15 % ;
  - recomposition / maintien : apport de maintien.
- Protéines : 1,6 g/kg par défaut (plage 1,6–2,2, plafond 2,2).
- Lipides : au moins 0,6 g/kg et au moins 20 % des kcal.
- Fibres 30 g, eau 2,0 à 2,5 L, glucides en complément.
- Les cibles sont affichées en fourchettes.

**Suivi**
- Pesées, idéalement quotidiennes, lissées sur 7 jours.
- Bilan hebdomadaire qui ajuste de ±100 à 150 kcal si la tendance s'écarte de l'objectif pendant 2 à 3 semaines.

**Conseils**
- Fiches fondées sur le PNNS 2019 et la nutrition sportive : répartition des protéines, repas autour de la séance, hydratation, sources végétales.
- Coach IA qui reçoit les cibles et la tendance comme contexte, explique, et ne peut ni modifier un chiffre ni sortir des bornes.
- Mention obligatoire « vous échangez avec une IA ».
- Garde-fous :
  - aucune cible chiffrée avant 18 ans ;
  - en cas de TCA, de grossesse ou de pathologie : pas de déficit, orientation vers un professionnel et la ligne FFAB ;
  - plancher au niveau du métabolisme de base estimé, aucun déficit si l'IMC est inférieur à 18,5 ;
  - un mode « sans chiffres » accessible à tous.
- Vocabulaire « repère / estimation », jamais « régime / prescription ».
- Consentement explicite pour les données de santé.

**Versions suivantes**
- v1.1 : ajout rapide de protéines/kcal et recherche Ciqual 2025.
- v2 : journal complet avec miroir local OFF (export filtré sur la France + deltas quotidiens, appel à l'API seulement pour un code-barres inconnu, User-Agent dédié, attribution ODbL et publication du script d'import). Scan par BarcodeDetector natif, sinon polyfill barcode-detector/zxing-wasm auto-hébergé, avec saisie manuelle en secours, le tout sur HTTPS.
- Modèle de données v1 : nutrition_profile, body_metric, nutrition_target (versionné : method, algo_version, inputs), nutrition_checkin.
- v2 ajoute food_generic, off_product (séparé), user_food et food_log_entry, avec une copie figée des nutriments.

## Options

### Périmètre A — Cibles + conseils + suivi du poids, sans journal (recommandé pour la v1)
- Pour : Environ 1–2 semaines de développement (estimation) ; Couvre l'essentiel pour la musculation : apport énergétique adapté à l'objectif, protéines, tendance du poids ; Aucune dépendance à OFF (quotas, disponibilité, ODbL) ; Risque de comportement alimentaire obsessionnel bien plus faible qu'avec un comptage de calories ; Reste clairement dans le cadre « bien-être » ; L'ajustement adaptatif sur la tendance du poids compense l'imprécision des formules
- Contre : Les apports réels ne sont pas mesurés, donc les ajustements sont plus lents (2–3 semaines par pas) ; Moins d'usage quotidien que Yazio ou MyFitnessPal ; Certains utilisateurs réclameront le scan

### Périmètre B — A + ajout rapide de protéines/kcal + recherche Ciqual (v1.1)
- Pour : Ciqual 2025 : licence Etalab 2.0 (simple attribution), 3 484 aliments français, XLSX de 1,5 Mo, import trivial ; Ni ODbL ni quota d'API ; Le suivi des protéines est le principal levier pour la musculation
- Contre : Pas de produits emballés ; Valeurs manquantes de Ciqual (« - », « traces », « < x ») à traiter ; Libellés Ciqual peu naturels : recherche plein texte en français à soigner ; Commence à exposer au risque de comptage obsessionnel

### Périmètre C — Journal alimentaire complet (Ciqual + miroir OFF + scan) dès la v1
- Pour : Parité avec Yazio, avec un scan gratuit alors que MyFitnessPal le fait payer ; 1,27 million de produits français dans OFF ; Données plus riches pour le coach IA
- Contre : Environ 6–10 semaines (estimation) ; Miroir OFF indispensable en pratique (15 req/min/IP), avec une synchro à maintenir et plusieurs Go de données ; Obligations ODbL si l'application est ouverte à des tiers ; Pas de BarcodeDetector sur iOS, donc un WASM d'environ 1 Mio à embarquer ; L'assiduité à la saisie s'effondre en quelques semaines ; Risque de TCA accru

### Accès OFF — appels à l'API en direct via notre serveur
- Pour : Simple à mettre en place ; Rien à stocker
- Contre : 15 req/min/IP partagées entre tous les utilisateurs ; Erreurs 503 globales et bannissement possible ; Recherche « à la frappe » interdite ; Dépend de la disponibilité d'OFF (« Page temporarily unavailable » observée pendant les tests)

### Accès OFF — miroir local (export CSV ou Parquet filtré sur la France + deltas quotidiens), API en secours
- Pour : Approche recommandée par OFF lui-même ; Rapide, hors quota, recherche locale et usage hors ligne possibles ; 3 To de disque : largement suffisant ; Déjà fait par wger
- Contre : Une tâche de synchronisation à maintenir ; Exports volumineux (CSV 1,28 Go gz ; JSONL 13,1 Go gz) ; Base dérivée au sens de l'ODbL : il faut publier le script d'import et citer OFF

### Accès OFF — appels directs depuis le navigateur de l'utilisateur
- Pour : CORS ouvert ; le quota est alors compté par utilisateur ; Aucune infrastructure à gérer
- Contre : L'adresse IP des utilisateurs est transmise à OFF (à indiquer dans la politique de confidentialité) ; Ne fonctionne pas hors ligne ; Le navigateur ne permet pas de personnaliser le User-Agent ; l'en-tête X-User-Agent est accepté par CORS (déduit) ; Dépend de la disponibilité d'OFF

## Risques

- Open Food Facts : depuis avril 2026, quota de 15 req/min/IP, erreurs 503 globales et bannissement d'IP possibles. Passer par l'API depuis un serveur unique ne tient pas à l'échelle : prévoir un miroir local.
- ODbL : si l'application est ouverte à d'autres que nous, la base OFF extraite devient une base dérivée utilisée publiquement. Il faut alors l'attribution et la publication de la base ou du script de transformation. Mélanger nos données à la base OFF au lieu de les garder séparées pourrait contaminer nos propres tables.
- Données de santé : le poids croisé avec les apports constitue une donnée de santé selon la CNIL. L'article 9 du RGPD impose un consentement explicite, la minimisation et la sécurité (chiffrement, sauvegardes du serveur maison). L'obligation d'hébergement certifié HDS en cas d'ouverture au public reste à clarifier : elle vise les données de prévention, de diagnostic ou de soins hébergées pour le compte de tiers.
- Troubles alimentaires : comptage de calories et objectifs de déficit sont associés à davantage de symptômes de TCA. Les publics à risque (mineurs, antécédents de TCA) doivent être exclus des chiffres.
- Le LLM produit des chiffres faux ou des conseils dangereux : sous-estimation d'environ 695 kcal/j dans des plans pour adolescents, plus de 10 % d'erreur sur 13 nutriments sur 16 à partir de photos. Les chiffres doivent rester calculés par du code, et le LLM borné.
- Dérive réglementaire : toute allégation sur une maladie (diabète, cholestérol, « soigner ») peut faire basculer le produit vers le dispositif médical (MDR) ou empiéter sur la profession de diététicien. L'obligation de transparence de l'AI Act s'applique depuis le 2 août 2026.
- Imprécision des formules : Mifflin est biaisée chez les sportifs et l'erreur individuelle est souvent supérieure à 10 %. Sans ajustement adaptatif, l'utilisateur risque d'être frustré par des cibles inadaptées.
- iOS : pas de BarcodeDetector, d'où un WASM d'environ 1 Mio à mettre en cache. Des demandes d'autorisation caméra répétées ont été signalées en PWA autonome (bug WebKit 215884, à tester). La caméra impose HTTPS, donc un domaine et un certificat sur le serveur maison.
- Qualité des données : OFF n'offre aucune garantie d'exactitude (confusions kJ/kcal, valeurs par portion au lieu de 100 g). Ciqual contient des valeurs manquantes. Prévoir des contrôles de plausibilité à l'import.
- Charge de maintenance : synchronisation quotidienne du miroir OFF (exports de 1,3 à 13 Go), mise à jour des tables ANSES, et pages de conseils à maintenir à jour face à la science et à la réglementation.
- Informations datées : quotas OFF, tarifs MFP/Yazio, support de BarcodeDetector dans Safari et calendrier de l'AI Act (Digital Omnibus) évoluent vite. À revérifier avant l'implémentation.

## Questions pour nous

- Public cible : l'appli reste-t-elle entre nous et nos proches, ou sera-t-elle ouverte au public ? Cela conditionne les obligations ODbL, l'ampleur du travail RGPD (données de santé, éventuelle analyse d'impact) et la question de l'hébergement HDS.
- Acceptez-vous une v1 sans journal alimentaire (cibles, conseils, suivi du poids), le journal et le scan arrivant ensuite en v1.1/v2 ? Ou le scan de code-barres est-il indispensable dès le lancement ?
- Quel âge minimum pour s'inscrire (15, 16 ou 18 ans) ? Et faut-il réserver les cibles chiffrées aux majeurs ?
- Comment poser la question du sexe utilisé dans la formule (homme/femme/« préfère ne pas dire » avec une valeur moyenne) ? Faut-il demander le % de gras (impédancemètre peu fiable) ?
- Le coach IA peut-il proposer des changements de cibles, validés ensuite par le code dans des bornes ? Ou doit-il seulement expliquer les cibles calculées ?
- Faut-il aborder les compléments (créatine, whey) dans les conseils ? Le risque d'allégation est plus élevé ; on peut aussi s'en tenir à l'alimentation courante.
- Quels régimes et contraintes gérer dès la v1 : végétarien, végan, halal, sans porc, sans lactose, allergies ?
- Le serveur maison aura-t-il un nom de domaine et un certificat HTTPS valide (Let's Encrypt) ? C'est indispensable pour la caméra et l'installation de la PWA.
- À quelle fréquence demander la pesée (quotidienne, plus précise pour la tendance, ou hebdomadaire, moins anxiogène) ? Faut-il prévoir un mode « sans chiffres » par défaut pour certains profils ?
- Faut-il contribuer en retour à Open Food Facts (produits manquants ajoutés par nos utilisateurs) ? Cela demande un compte d'application OFF et le formulaire d'usage de l'API.
- Pour l'accès à OFF, préférez-vous protéger la vie privée (miroir local sur notre serveur) ou la simplicité (appels directs depuis le navigateur, qui transmettent l'IP des utilisateurs à OFF) ?

## Affirmations clés

- [haute] Open Food Facts limite la lecture produit à 15 req/min/IP (contre 100 avant le changement de doc du 2026-04-26) et la recherche à 10 req/min/IP. La recherche « à la frappe » est proscrite, le bannissement d'IP possible, et OFF recommande un miroir local alimenté par les exports quotidiens. (https://github.com/openfoodfacts/openfoodfacts-server/commit/fe164794f42dfdb2bc630901facc9a2a49f5c57d)
- [haute] Quand les requêtes viennent directement des appareils des utilisateurs, la limite OFF s'applique par utilisateur. L'API renvoie Access-Control-Allow-Origin: * (CORS ouvert, testé le 2026-10-06). (https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [haute] Le 2026-10-06, OFF compte 1 272 478 produits tagués France, dont 943 239 au tableau nutritionnel complété (requête API). (https://world.openfoodfacts.org/api/v2/search?countries_tags=en:france&states_tags=en:nutrition-facts-completed&page_size=1&fields=code)
- [haute] Taille des exports OFF quotidiens (mesurée le 2026-10-06) : CSV 1,28 Go gz, JSONL 13,1 Go gz, Parquet 7,9 Go. Des deltas couvrent les 14 derniers jours. (https://world.openfoodfacts.org/data)
- [moyenne] ODbL : extraire une partie substantielle crée une base dérivée. Si elle sert publiquement, il faut fournir la base dérivée, ou un fichier ou une méthode décrivant les modifications. Une « Collective Database » (bases indépendantes juxtaposées) n'a pas à passer sous ODbL. L'application à notre cas reste à valider. (https://opendatacommons.org/licenses/odbl/1-0/)
- [haute] Ciqual 2025 : 3 484 aliments, 74 constituants, licence Etalab 2.0, publiée le 2025-11-19 en XLSX (1,5 Mo) et XML (69 Mo pour la composition). (https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY)
- [haute] USDA FoodData Central : données sous CC0, clé api.data.gov obligatoire, 1 000 req/h/IP, blocage d'une heure en cas de dépassement. (https://fdc.nal.usda.gov/api-guide/)
- [haute] BarcodeDetector : natif sur Chrome Android 83+. Sur Chrome desktop, seulement macOS et ChromeOS. Sur Safari 17+ (donc iOS), présent derrière un réglage désactivé par défaut. Absent de Firefox. (https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json)
- [haute] Le polyfill barcode-detector (MIT) s'appuie sur zxing-wasm. Son binaire de lecture pèse environ 1,04 Mio et se charge par défaut depuis jsDelivr ; on peut l'auto-héberger. @zxing/library n'est plus qu'en maintenance. (https://github.com/Sec-ant/zxing-wasm)
- [haute] getUserMedia (caméra) ne fonctionne qu'en contexte sécurisé (HTTPS ou localhost). Le serveur maison doit donc avoir un domaine et un certificat valides. (https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [haute] Mifflin-St Jeor a été dérivée sur 498 sujets de 19 à 78 ans : elle n'est pas validée pour les mineurs. (https://pubmed.ncbi.nlm.nih.gov/2305711/)
- [haute] Chez les sportifs, seules Cunningham, Harris-Benedict, De Lorenzo et Ten-Haaf ne sont pas biaisées. Ten-Haaf place 80,2 % des sujets à ±10 %, contre 40,7 à 63,7 % pour les autres équations. (https://pmc.ncbi.nlm.nih.gov/articles/PMC10687135/)
- [haute] Niveaux d'activité (PAL) FAO/OMS/UNU : 1,40–1,69 sédentaire, 1,70–1,99 actif, 2,00–2,40 très actif ; au-delà de 2,40, difficile à tenir. (https://openknowledge.fao.org/server/api/core/bitstreams/65875dc7-f8c5-4a70-b0e1-f429793860ae/content)
- [haute] La réponse du poids à un changement d'apport a une demi-vie d'environ 1 an. D'où l'intérêt de recalibrer les cibles sur la tendance du poids (conclusion déduite). (https://pubmed.ncbi.nlm.nih.gov/21872751/)
- [haute] ISSN 2017 : protéines 1,4–2,0 g/kg/j, 2,3–3,1 en hypocalorique chez les entraînés, 0,25 g/kg ou 20–40 g par prise toutes les 3–4 h. (https://pubmed.ncbi.nlm.nih.gov/28642676/)
- [haute] Au-delà d'environ 1,62 g/kg/j de protéines, aucun gain supplémentaire de masse maigre (méta-analyse de 49 études, 1 863 participants). (https://pubmed.ncbi.nlm.nih.gov/28698222/)
- [haute] Afssa 2007 : 0,83–2,2 g/kg/j de protéines « satisfaisant » pour un adulte non sportif à fonction rénale normale, 2,2–3,5 « élevé », au-delà de 3,5 « très élevé ». Aucune limite de sécurité n'est fixée. (https://www.anses.fr/fr/system/files/NUT-Sy-Proteines.pdf)
- [haute] Revue de 73 consensus (2025) : perte de gras de 0,5 à 1 kg/sem., déficit de 250 à 1000 kcal/j, disponibilité énergétique au-dessus de 30 kcal/kg de masse maigre par jour, protéines 1,6–2,4 g/kg/j. (https://pubmed.ncbi.nlm.nih.gov/40841871/)
- [haute] Hors saison, en culturisme : prise de 0,25 à 0,5 % du poids par semaine, surplus d'environ 10–20 %, lipides 0,5–1,5 g/kg/j, protéines 1,6–2,2 g/kg/j. (https://www.mdpi.com/2075-4663/7/7/154)
- [haute] Références ANSES 2016 pour l'adulte : lipides 35–40 % de l'apport énergétique total, fibres 30 g/j (source secondaire CERIN). (https://www.cerin.org/articles/references-nutritionnelles-proteines-lipides-glucides-fibres-adultes-personnes-agees/)
- [haute] MyFitnessPal réserve à Premium (49,99 €/an) le scan de code-barres, la saisie par photo ou par la voix et les objectifs de macros personnalisés. (https://www.myfitnesspal.com/premium)
- [haute] Adhésion aux applis de comptage de calories : avec MyFitnessPal, l'auto-surveillance tombe de 5,4 à 1,4 jour par semaine entre les semaines 4 et 12 (revue de portée, 68 études). (https://pubmed.ncbi.nlm.nih.gov/41329042/)
- [haute] L'usage d'applis de suivi alimentaire et sportif est associé à davantage de symptômes de TCA (38 études, sans conclusion causale). 73 % des patients TCA qui utilisent MyFitnessPal jugent qu'elle a contribué à leur trouble. (https://pubmed.ncbi.nlm.nih.gov/39671845/)
- [haute] Des plans alimentaires générés par cinq LLM pour des adolescents sous-estimaient l'énergie d'environ 695 kcal/j par rapport à ceux d'une diététicienne. (https://pubmed.ncbi.nlm.nih.gov/41909033/)
- [haute] Selon la CNIL, un poids croisé avec des apports caloriques ou un nombre de pas devient une donnée de santé. C'est une donnée sensible au sens de l'article 9 du RGPD, ce qui impose un consentement explicite. (https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)
- [haute] L'article 50 de l'AI Act s'applique depuis le 2 août 2026 : un chatbot doit informer l'utilisateur qu'il échange avec une IA. (https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/technology/ai-transparency-ai-act-what-businesses-need-know-before-2-august-2026/)
- [haute] Article L4371-1 du CSP : exerce la profession de diététicien quiconque dispense habituellement des conseils nutritionnels et, sur prescription médicale, participe à l'éducation et à la rééducation nutritionnelle de patients atteints de troubles du métabolisme ou de l'alimentation. (https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006155074/)
- [moyenne] Un logiciel à finalité « lifestyle / bien-être » n'est pas un dispositif médical : c'est la finalité revendiquée qui détermine la qualification (MDCG 2019-11, révision 1 du 2025-06-17). (https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful)
- [haute] La ligne « Anorexie Boulimie Info Écoute » répond au 0810 037 037, quatre jours par semaine de 16 h à 18 h. (https://www.ffab.fr/trouver-de-l-aide/permanence-telephonique)
- [haute] wger, sous AGPL, importe déjà les produits OFF : commande import-off-products et synchronisation quotidienne du delta. (https://github.com/wger-project/wger/blob/master/wger/nutrition/management/commands/import-off-products.py)
