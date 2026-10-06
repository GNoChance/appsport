# Programmes d'entraînement et logique de progression (appsport) : principes, 8 modèles de départ (salle, maison, loisir), droits sur les programmes connus, algorithmes de progression, données à enregistrer et modèle de données

# Programmes d'entraînement et logique de progression

**Synthèse.** La position de l'ACSM d'avril 2026 ([137 revues systématiques, >30 000 participants](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)) simplifie le cadre : régularité, au moins 2 séances par semaine, au moins 10 séries par muscle et par semaine pour l'hypertrophie, ≥80 % du 1RM pour la force. Ni l'échec musculaire ni une périodisation complexe ne sont nécessaires. Recommandation : 8 modèles « maison » aux noms génériques, un moteur de progression **déterministe** (des règles JSON versionnées dans le repo), et une IA qui explique et ajuste dans des bornes sans calculer seule les charges.

## 1. Principes consensuels

Les sources sont vérifiées. Les valeurs du tableau sont nos réglages par défaut, tirés de ces sources.

| Variable | Débutant (moins de 6 mois de pratique régulière) | Intermédiaire |
|---|---|---|
| Fréquence | 2–3 séances full body | chaque muscle ≥2×/sem, sur 3–6 séances |
| Volume (séries/muscle/sem) | 6–10, en montant vers 10 | 10–20, avec des rendements décroissants |
| Répétitions | 8–12 RM ; 5–8 sur les polyarticulaires | force : 3–6 (≥80 % 1RM) ; hypertrophie : 6–15, jusqu'à 30 près de l'échec |
| Effort | RIR 2–3 | RIR 1–3 en polyarticulaire, 0–2 en isolation |
| Repos | 2–3 min en polyarticulaire, 60–90 s en isolation | idem ; 3–5 min au-delà de 85 % |
| Deload | seulement en réaction | planifié toutes les 4–6 sem (~1 sem) ou en réaction |

Sources : [ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/) (débutant : 8–12 RM, 2–3 j/sem ; intermédiaire : environ 6 mois de pratique, 3–4 j/sem), [ACSM 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/), [Schoenfeld 2016](https://pubmed.ncbi.nlm.nih.gov/27102172/) (2×/sem fait mieux que 1×), [Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/27433992/) (+0,37 % de gain par série hebdomadaire en plus), [Singer 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/) (un repos de plus de 60 s aide un peu, aucun gain au-delà de 90 s), [Bell 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/).

- **Fréquence** : à volume égal, elle n'a presque pas d'effet sur l'hypertrophie mais elle aide la force ([Pelland 2025](https://link.springer.com/article/10.1007/s40279-025-02344-w)). L'étude compte une série indirecte pour 0,5 : c'est la méthode « fractionnelle », la mieux étayée.
- **Échec musculaire** : l'hypertrophie augmente quand on s'en approche, la force non ([Robinson 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/)). L'échec musculaire momentané n'a pas d'avantage démontré ([Refalo 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/)). Les pratiquants sous-estiment leur RIR d'environ 1 rep et l'estiment mieux sous 12 reps ([Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/)). On ne prescrit donc un RIR que jusqu'à 12–15 reps.
- **Autorégulation** : elle donne des gains de force comparables à ceux des pourcentages ([Hickmott 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/)), mais c'est la seule option au poids du corps ou aux élastiques (ACSM 2026).
- **Structure** : selon l'ACSM 2026, couvrir haut/bas × poussée/tirage (avec horizontal/vertical) suffit. Ces combinaisons deviennent nos « patterns » de mouvement.
- **ISSN** : ses positions portent sur la nutrition (protéines 1,4–2,0 g/kg/j, [ISSN 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/)). Elles serviront au module nutrition.

## 2. Huit modèles de départ (des choix de conception appuyés sur les sources)

| # | Contexte · niveau | Structure | Contenu type | Progression |
|---|---|---|---|---|
| S1 | Salle · débutant | Full body A/B, 3 j | squat, développé couché, développé militaire, rowing, soulevé de terre roumain, tirage vertical ; 3×5–8, puis accessoires en 2–3×8–12 | linéaire, puis double |
| S2 | Salle · intermédiaire | Haut/Bas, 4 j (un jour force 4–6, un jour 8–15) | 12–16 séries/muscle | RIR/e1RM + double ; bloc de 5 sem + deload |
| S3 | Salle · intermédiaire (5–6 j dispo) | Push/Pull/Legs ×2 | 14–20 séries/muscle | comme S2 |
| M1 | Maison · débutant, sans matériel | Full body, 3 j | pompes murales→inclinées→au sol→déclinées→archer ; squat→fente→bulgare→pistol assisté ; pont fessier→unipodal ; rowing sous table ; planche→hollow | chaîne au poids du corps + temps |
| M2 | Maison · intermédiaire (barre de traction, élastiques, haltères réglables) | Haut/Bas, 4 j | tractions assistées ou lestées, haltères, bulgare, soulevé de terre roumain unilatéral, Nordic excentrique | double + chaîne ; à charge max : unilatéral, tempo, 20–30 reps |
| L1 | Loisir / santé · débutant | Full body, 2 j de 30–40 min, supersets antagonistes | 6–8 exercices couvrant les 6 patterns ; 2×8–15, RIR 2–3 | double |
| L2 | Loisir · course ou vélo | 2 j (1 j en compétition) | jambes lourdes 3–5×3–6, mollets unipodaux, step-up, pliométrie légère, gainage | linéaire, puis RIR |
| L3 | Loisir · sports pivots ou raquette | 2 j | Nordic, Copenhague (3 niveaux), fentes, soulevé de terre roumain, réceptions de sauts, rotation externe d'épaule, anti-rotation | double + chaîne |

Ce sur quoi s'appuient ces modèles :
- Les élastiques valent le matériel classique pour la force ([Lopes 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6383082/)). Les pompes valent le développé couché à 40 % du 1RM ([Kikuchi 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5812864/)).
- L'OMS demande au moins 2 j/sem sur tous les grands groupes musculaires ([OMS 2020](https://www.ncbi.nlm.nih.gov/books/NBK566048/)). Les formats courts en supersets le permettent ([Brummer 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13388269/)).
- Prévention :
  - le renforcement abaisse le risque de blessure à RR 0,315 ([Lauersen 2014](https://pubmed.ncbi.nlm.nih.gov/24100287/)) ;
  - Nordic : −51 % de blessures aux ischios ([van Dyk 2019](https://pubmed.ncbi.nlm.nih.gov/30808663/)) ;
  - Copenhague : −41 % de problèmes d'aine, 3×/sem en pré-saison puis 1×/sem ([Harøy 2019](https://pubmed.ncbi.nlm.nih.gov/29891614/)) ;
  - programme épaule : −28 % ([Andersson 2017](https://pubmed.ncbi.nlm.nih.gov/27313171/)).
- Coureurs : les charges lourdes et la pliométrie améliorent l'économie de course ([Llanos-Lagos 2024](https://pubmed.ncbi.nlm.nih.gov/38165636/)).
- Sport et musculation se combinent sans perte d'hypertrophie ni de force max ([Schumann 2022](https://pubmed.ncbi.nlm.nih.gov/34757594/)). L'explosivité baisse si les deux tombent dans la même séance : il faut les espacer d'au moins 3 h.

## 3. Droits (TMview consulté le 2026-10-06)

| Programme | Constat | Conséquence |
|---|---|---|
| StrongLifts 5×5 | [marque UE 014288815](https://www.tmdn.org/tmview/#/tmview/detail/EM500000014288815) (classes 9 et 41, valable jusqu'en 2035, couvre la France) + marque US | ne pas utiliser le nom ; le schéma « 5×5 linéaire » est libre |
| Starting Strength | [marques US](https://www.tmdn.org/tmview/#/tmview/detail/US500000085146322), aucune trouvée en UE ou en France ; le livre est protégé | ne pas le nommer ni le recopier |
| 5/3/1 | « JIM WENDLER 5/3/1 » est une [marque US (6758948)](https://www.tmdn.org/tmview/#/tmview/detail/US500000090752575) ; proposé sur [Boostcamp](https://www.boostcamp.app/free-workout-app) | idem |
| GZCLP | aucune marque trouvée ; [partenariat officiel avec Boostcamp](https://www.boostcamp.app/cody-lefever-gzcl) | reprendre l'idée des paliers T1/T2/T3, sans le nom ni le tableur |
| Recommended Routine | aucune marque ; aucune licence ouverte trouvée (Reddit inaccessible) ; [les contributeurs gardent leurs droits](https://redditinc.com/policies/user-agreement) | ne pas recopier le texte |
| FIFA 11+ | « FIFA » est une marque | les exercices sont libres, le nom ne l'est pas |

Le droit d'auteur protège l'expression, pas les « idées, procédures, méthodes » ([ADPIC 9.2](https://www.wto.org/english/docs_e/legal_e/27-trips_04_e.htm), [OMPI](https://www.wipo.int/copyright/fr/faq-copyright.html)). Aux États-Unis, une séquence d'exercices n'est pas protégeable ([Bikram, 2015](https://law.justia.com/cases/federal/appellate-courts/ca9/13-55763/13-55763-2015-10-08.html)). Hypothèse à faire valider par un juriste : en France, profiter de la notoriété d'un nom peut être qualifié de parasitisme. Conclusion : des noms descriptifs, des textes écrits par nous ou repris de free-exercise-db (Unlicense).

## 4. Algorithmes (les seuils non cités sont des choix déduits, paramétrables)

- **Linéaire** : séries réussies → +2,5 kg en haut du corps ou +5 kg en bas du corps. L'[ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/) conseille +2–10 % dès qu'on dépasse la cible de 1–2 reps. 3 échecs de suite → −10 %. 2 retours en arrière sans record → passage en double progression ou en RIR.
- **Double** : fourchette [min, max]. Quand toutes les séries atteignent max avec un RIR ≥ cible, on ajoute le plus petit incrément et on repart de min. Si cet incrément dépasse 10 % (haltères), on progresse sur la somme des reps.
- **RIR/e1RM** : e1RM = charge × (1 + (reps + RIR)/30) (Epley) ou charge × 36/(37 − (reps + RIR)) (Brzycki), plus fiable sous 10 reps, avec une erreur possible de 10 % ou plus ([précision](https://en.wikipedia.org/wiki/One-repetition_maximum)). Charge suivante = e1RM lissé / (1 + (reps_cible + RIR_cible)/30), arrondie au matériel disponible, sans dépasser ±5 %.
- **Chaîne au poids du corps** : 2 séances de suite en haut de fourchette (3×12 en haut du corps, 3×15 en jambes) → variante suivante en 3×5–6. Isométrie : +5 s par séance jusqu'à 45–60 s.
- **Stagnation** : e1RM sans progrès sur 3 séances → −10 % ou autre fourchette, puis substitution. Si plusieurs exercices stagnent et que la forme est à 2/5 ou moins, l'app propose un deload.
- **Deload** : −40 à −50 % de séries, RIR +2, même fréquence. [Bell 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/) recommande de baisser le volume et la proximité de l'échec. Mieux vaut alléger qu'arrêter : une semaine d'arrêt complet a freiné la force ([Coleman 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/)).
- **Substitution** : même pattern, matériel possédé, mêmes muscles principaux, niveau adapté à l'utilisateur. La séance suivante sert de calibration à RIR 3.

Précédents : [wger](https://github.com/wger-project/wger/blob/master/wger/manager/models/abstract_config.py) (règles par itération : +/−/remplacer, en absolu ou en %, répétition, conditions sur les logs) et [Liftosaur](https://www.liftosaur.com/doc/liftoscript) (`lp`, `dp`, `sum`). Les deux sont sous AGPL : on reprend les idées, pas le code.

## 5. Données et modèle

- **Par série** :
  - type (échauffement, travail, backoff, AMRAP, dégressive) ;
  - charge et mode (barre totale, par haltère, élastique, lest, assistance négative) ;
  - reps ou durée, RIR au demi-point ;
  - **copie des cibles** (reps, charge, RIR) ;
  - repos réel, côté, douleur 0–10, exercice réellement fait.
- **Par séance** : début et fin, poids de corps, forme 1–5, notes, indicateur deload. On y ajoute le RPE de séance × durée ([Foster 2001](https://pubmed.ncbi.nlm.nih.gov/11708692/)) pour cumuler la charge avec le sport pratiqué.
- **État par slot** : charge de travail, niveau dans la chaîne, compteurs de succès et d'échecs, e1RM.

[Hevy](https://api.hevyapp.com/docs/) utilise une structure proche (warmup/normal/failure/dropset, rpe, rep_range, rest_seconds).

```
ProgramTemplate{id, version, contexte, niveau, objectif, jours, matériel[], politique_deload}
 └ Week{index, type: normal|deload, modifs{rir_delta, facteur_séries}}
    └ Day{index, nom, focus[]}
       └ Slot{ordre, pattern, exercice_défaut, rôle, superset, substitution}
          ├ SetGroup{type, séries, reps_min, reps_max|durée, rir, prescription: kg|%e1RM|rir|niveau, repos_s}
          └ Progression{type: lin|double|sum|rir|chaîne|temps, params}
Enrollment → SlotState ; WorkoutSession → PerformedExercise → PerformedSet
```

[workout-cool](https://github.com/Snouzy/workout-cool/blob/main/prisma/schema.prisma) (MIT) écrit chaque semaine en dur, sans RIR, sans repos et sans règle de progression. [free-exercise-db](https://github.com/yuhonas/free-exercise-db) compte 876 exercices mais n'a ni pattern ni matériel multiple. Il lui manque aussi la pompe archer, le pike, le hollow et le Copenhague : il faudra ajouter une table de tags et environ 15–20 exercices.

## Recommandation

Retenir l'option B. 1) Écrire 8 modèles maison aux noms descriptifs (S1 Salle full body 3 j débutant ; S2 Haut/Bas 4 j ; S3 PPL ×2 ; M1 Maison sans matériel 3 j ; M2 Maison avec matériel minimal, Haut/Bas 4 j ; L1 Santé 2 j ; L2 Complément course/vélo 2 j ; L3 Complément sports pivots/raquette 2 j). Les stocker en JSON versionné dans le repo, valider par JSON Schema en CI et charger en base au déploiement. N'utiliser aucun nom de programme déposé (StrongLifts est une marque UE) ni aucun texte copié. 2) Construire un moteur déterministe avec 6 primitives paramétrables : linéaire (avec compteur d'échecs et reset à −10 %), double progression, somme des reps, RIR/e1RM (Epley sur reps + RIR, arrondi au matériel, plafond ±5 %), chaîne au poids du corps, progression en temps. Y ajouter des règles de stagnation, de deload (planifié toutes les 4-6 semaines pour les intermédiaires, réactif pour les débutants ; −40 à −50 % de séries, RIR +2) et de substitution par pattern et matériel. Réglages par défaut : chaque muscle ≥2×/sem ; 10-20 séries « fractionnelles »/muscle/sem pour les intermédiaires, 6-10 en montant vers 10 pour les débutants et le loisir ; RIR 1-3 ; repos de 2-3 min en polyarticulaire et 60-90 s en isolation. 3) Enregistrer pour chaque série : type, charge et mode de charge, reps ou durée, RIR, copie des cibles, repos, côté, douleur. Pour chaque séance : forme, RPE de séance × durée, poids de corps. 4) L'IA lit l'état et les règles, explique et propose des modifications sous forme de patch JSON borné et validé ; elle ne calcule jamais seule les charges. 5) Ordre de livraison : linéaire + double + chaîne au poids du corps (couvre S1, M1, L1), puis RIR/e1RM + deload (S2, S3, M2), puis les variantes sport (L2, L3). En parallèle, enrichir free-exercise-db : tags de pattern, matériel multiple, chaînes de progression, et environ 15-20 exercices manquants (Copenhague, hollow, pompe archer, pike push-up, rowing sous table...).

## Options

### A. Programmes statiques entièrement écrits semaine par semaine (comme workout-cool)
- Pour : Le plus simple à coder et à afficher ; Programmes faciles à rédiger et à relire ; Comportement prévisible
- Contre : Pas de progression automatique : les séances réalisées ne modifient rien ; Contenu dupliqué pour chaque semaine, chaque niveau et chaque variante de matériel ; Pas de RIR, de repos cible ni de règle de deload ; Mauvaise couverture des 3 contextes (salle, maison, loisir) et du matériel variable

### B. Modèles maison + moteur de règles déterministe (idées de wger et Liftosaur) + IA qui explique et ajuste dans des bornes
- Pour : Explicable et reproductible ; testable par des tests unitaires ; S'adapte aux séances enregistrées (règles linéaire, double, somme des reps, RIR/e1RM, chaîne au poids du corps, temps) ; Programmes en JSON versionnés dans le repo GitHub et validés par un JSON Schema en CI ; Coût d'IA faible : l'IA explique et propose, elle ne calcule rien à chaque série ; Fonctionne hors ligne dans la PWA, car les règles s'exécutent côté client ou serveur sans LLM
- Contre : Plus de travail au départ : moteur, schéma, validation, arrondis selon le matériel ; Les seuils (échecs avant deload, plafond ±5 %, etc.) restent à régler et à tester ; Il faut maintenir une table de tags (pattern, matériel, chaînes de progression) en plus de la base d'exercices ; Moins flexible qu'une génération libre par l'IA

### C. Programmes et charges générés par le LLM à chaque séance
- Pour : Flexibilité maximale et dialogue naturel ; Prototype rapide
- Contre : Non déterministe : charges ou volumes aberrants possibles (hallucinations), difficile à tester ; Coût et latence à chaque séance ; dépend d'un budget d'API encore inconnu ; Inutilisable hors ligne ; Responsabilité en cas de blessure ; il faudrait de toute façon des garde-fous déterministes

### D. Reprendre des programmes connus sous licence (StrongLifts, 5/3/1, GZCLP...)
- Pour : Notoriété et confiance immédiates ; Structures éprouvées
- Contre : Exige des accords avec les auteurs (modèle Boostcamp), peut-être payants ; StrongLifts est une marque UE opposable en France ; les livres et tableurs sont protégés ; Peu adapté aux contextes maison et loisir et aux débutants complets ; Crée une dépendance envers des tiers

## Risques

- Juridique : afficher « StrongLifts » ou recopier des textes, tableaux ou illustrations (livres Starting Strength et 5/3/1, wiki Reddit) expose à une action en contrefaçon. En France, profiter de la notoriété d'un nom pourrait aussi être qualifié de parasitisme (hypothèse à faire valider par un juriste, surtout si l'app devient publique ou payante).
- Licence : wger et Liftosaur sont sous AGPL-3.0. Copier leur code imposerait l'AGPL à appsport ; on ne reprend que les idées.
- Sécurité : les utilisateurs se trompent d'environ 1 rep en moyenne sur le RIR, avec une forte variabilité. Des débutants peuvent sur- ou sous-charger ; il faut des réglages prudents (RIR 2-3), éviter l'échec sur les polyarticulaires en charge libre et fournir un contenu technique.
- Santé : public non filtré (blessures, pathologies, mineurs, grossesse). Il faut un questionnaire de santé à l'onboarding, des avertissements et un champ douleur qui suspend la progression.
- Surcharge chez les sportifs de loisir : le sport et la musculation s'additionnent. Sans saisie de la charge du sport (RPE de séance) ni du calendrier des matchs, le moteur peut placer une séance lourde la veille d'une compétition.
- Algorithmes : l'e1RM n'est pas fiable au-delà d'environ 10 reps ni au poids du corps ou aux élastiques. Les écarts de charge entre haltères (10 à 20 %) cassent la progression linéaire. Il faut gérer les arrondis selon le matériel et basculer vers la double progression.
- Données incomplètes : RIR non saisi ou séances non enregistrées. Le moteur doit alors ne rien changer par défaut, sans extrapoler.
- Base d'exercices : free-exercise-db n'a ni pattern ni matériel multiple, et plusieurs exercices de progression maison ou de prévention y manquent. Les traductions françaises sont aussi à produire pour 876 exercices.
- IA : un LLM qui modifie un programme sans garde-fous peut proposer des volumes ou des charges dangereux. Il faut des patches bornés et validés par schéma.
- Preuves limitées : l'ACSM 2026 s'appuie surtout sur des novices et des essais de 6 à 52 semaines, et ne fixe pas de cibles RIR précises. Plusieurs seuils du moteur sont donc des conventions à valider sur nos propres données.
- Péremption : le statut des marques (vérifié le 2026-10-06) et les recommandations (ACSM 2026, préprint 1RM de 2026 non relu par des pairs) peuvent évoluer. Il faut revoir ces points avant une ouverture au public.

## Questions pour nous

- Public cible : l'app est-elle réservée à vous et vos proches, ou ouverte au public, voire payante ? La réponse change le niveau de prudence juridique (noms de programmes, parasitisme), les avertissements santé et le besoin d'un questionnaire de santé à l'inscription.
- Voulez-vous des noms évocateurs (« style 5×5 ») pour rassurer les habitués, ou uniquement des noms maison descriptifs ? Je recommande la seconde option.
- Personnalisation : modèles fixes plus moteur de règles (recommandé), ou programmes générés par l'IA ? Jusqu'où l'IA peut-elle modifier un programme sans validation de l'utilisateur ?
- Faut-il afficher le RIR aux débutants, ou une échelle simple (facile / correct / difficile / échec) convertie en RIR en coulisse ?
- À l'inscription, faut-il demander l'inventaire précis du matériel (plus petits disques, pas des haltères, niveaux d'élastiques, barre de traction) pour arrondir les charges correctement ?
- Pour « salle de sport (et laquelle) » : le nom de la salle sert-il à quelque chose (inventaire des machines, partage entre proches), ou seulement le type d'équipement ?
- Quels sports de loisir proposer au lancement (course, vélo, foot, tennis/padel, basket, natation, sports de combat) ? Chacun demande des variantes de modèle (L2, L3).
- Faut-il gérer le calendrier sportif (matchs, sorties longues) pour placer automatiquement les séances de renforcement à au moins 48 h d'un match ?
- Faut-il prévoir des tests de 1RM, ou uniquement des estimations à partir de séries sous-maximales (recommandé pour la sécurité) ?
- Unités : kg uniquement, ou kg et lb ? Et faut-il importer l'historique d'autres applis (Hevy, Strong) ?
- Populations particulières (plus de 60 ans, mineurs, reprise après blessure, grossesse) : à exclure, à orienter vers un professionnel, ou à couvrir avec des modèles dédiés ?
- Envisagez-vous du coaching humain ou une monétisation ? Le cadre légal de l'encadrement sportif rémunéré en France resterait à vérifier.

## Affirmations clés

- [haute] Position ACSM 2026 (Med Sci Sports Exerc 58(4):851-872 ; 137 revues systématiques, plus de 30 000 participants) : la force progresse avec des charges ≥80 % 1RM, en amplitude complète, 2-3 séries par séance, en début de séance et au moins 2 séances/sem. L'hypertrophie progresse avec ≥10 séries/muscle/sem et le travail excentrique. L'entraînement jusqu'à l'échec, le type de matériel et la périodisation n'ont pas d'effet constant. (https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)
- [haute] ACSM 2026 : une cible de 2-3 répétitions en réserve (RIR) suffit comme stimulus. Les échelles RIR/effort perçu conviennent aux élastiques et au poids du corps. Couvrir haut/bas × poussée/tirage (plus horizontal/vertical pour le haut du corps) suffit pour cibler les grands groupes musculaires. (https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)
- [haute] Pelland et al., Sports Med 2026;56:481-505 (67 études, 2 058 participants) : plus de volume donne plus d'hypertrophie et de force, avec des rendements décroissants plus marqués pour la force. La fréquence a un effet négligeable sur l'hypertrophie et positif sur la force. Le comptage « fractionnel » (série indirecte = 0,5) est le mieux étayé. (https://link.springer.com/article/10.1007/s40279-025-02344-w)
- [haute] Schoenfeld 2016 : à volume égal, entraîner un muscle 2×/sem donne plus d'hypertrophie que 1×/sem (ES 0,49 contre 0,30). (https://pubmed.ncbi.nlm.nih.gov/27102172/)
- [haute] Halperin 2022 (12 études, 414 participants) : les pratiquants sous-estiment de 0,95 rep en moyenne les répétitions restantes avant l'échec. L'estimation est meilleure à 12 reps ou moins et près de l'échec. Le niveau d'entraînement ne change pas la précision. (https://pubmed.ncbi.nlm.nih.gov/34542869/)
- [haute] Robinson 2024 : l'hypertrophie augmente à mesure que les séries s'arrêtent plus près de l'échec. Les gains de force restent similaires sur une large plage de RIR. (https://pubmed.ncbi.nlm.nih.gov/38970765/)
- [haute] Singer 2024 (méta-analyse bayésienne) : un repos de plus de 60 s entre séries apporte un léger bénéfice en hypertrophie. Aucune différence notable au-delà de 90 s. (https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/)
- [haute] ACSM 2009 : augmenter la charge de 2-10 % quand on fait 1-2 reps de plus que la cible. Débutant : 8-12 RM, 2-3 j/sem. Intermédiaire (environ 6 mois de pratique) : 3-4 j/sem. Hypertrophie : 6-12 RM avec 1-2 min de repos. Force lourde : 3-5 min de repos. (https://pubmed.ncbi.nlm.nih.gov/19204579/)
- [haute] Bell 2023 (Delphi, coachs de force et de physique) : le deload est généralement placé toutes les 4-6 semaines pour environ 7 jours. On réduit les séries/reps et la proximité de l'échec. Il peut être planifié et/ou autorégulé (consensus à 100 %). (https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/)
- [haute] Coleman 2024 : une semaine d'arrêt complet au milieu d'un programme de 9 semaines n'a pas changé l'hypertrophie mais a réduit les gains de force du bas du corps. (https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/)
- [haute] Hickmott 2022 : charge autorégulée (RIR/RPE, vitesse) et charge en pourcentage donnent des gains de 1RM comparables (DM 2,07 kg, p = 0,09). (https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/)
- [haute] STRONGLIFTS est une marque de l'Union européenne enregistrée (n° 014288815, classes 9 et 41, renouvelée jusqu'au 2035-06-23), opposable en France. Elle est aussi enregistrée aux États-Unis (5037641), au Canada et en Australie. (https://www.tmdn.org/tmview/#/tmview/detail/EM500000014288815)
- [moyenne] STARTING STRENGTH (Asgaard Funding / The Aasgaard Company) et « JIM WENDLER 5/3/1 » (US 6758948, enregistrée en 2022) sont des marques américaines. TMview ne montre aucune marque UE ou française pour ces deux noms, ni aucune marque GZCLP ou « Recommended Routine » (recherche du 2026-10-06). (https://www.tmdn.org/tmview/#/tmview/detail/US500000090752575)
- [haute] Accord ADPIC, art. 9.2 : le droit d'auteur protège les expressions, pas les idées, procédures ou méthodes. Un schéma séries × reps × règle de progression peut donc être réimplémenté. Les textes, illustrations et marques restent protégés (déduction pour le cas des programmes). (https://www.wto.org/english/docs_e/legal_e/27-trips_04_e.htm)
- [haute] Bikram's Yoga College v. Evolation Yoga (9e circuit, 2015) : une séquence d'exercices est une idée ou un système non protégeable par le copyright. Cela vaut en droit américain ; c'est seulement une indication pour la France. (https://law.justia.com/cases/federal/appellate-courts/ca9/13-55763/13-55763-2015-10-08.html)
- [haute] Le marché obtient des licences pour les programmes nommés : Boostcamp indique s'être « officiellement associé » à Cody Lefever pour adapter GZCLP. (https://www.boostcamp.app/cody-lefever-gzcl)
- [haute] Les programmes de prévention qui incluent le Nordic hamstring réduisent jusqu'à 51 % les blessures aux ischios (RR 0,49 ; 15 études, 8 459 athlètes). (https://pubmed.ncbi.nlm.nih.gov/30808663/)
- [haute] Le programme de renforcement des adducteurs (Copenhague, 3 niveaux) réduit de 41 % les problèmes d'aine (OR 0,59) chez des footballeurs. Rythme : 3×/sem en pré-saison, puis 1×/sem en saison. (https://pubmed.ncbi.nlm.nih.gov/29891614/)
- [haute] Lauersen 2014 : le renforcement musculaire réduit le risque de blessure sportive (RR 0,315). Les étirements n'ont pas d'effet (RR 0,963). (https://pubmed.ncbi.nlm.nih.gov/24100287/)
- [haute] Schumann 2022 : l'entraînement concurrent (endurance + force) ne réduit ni l'hypertrophie ni la force maximale. Il réduit l'explosivité si les deux ont lieu dans la même séance, mais pas s'ils sont séparés d'au moins 3 h. (https://pubmed.ncbi.nlm.nih.gov/34757594/)
- [haute] Les élastiques donnent des gains de force similaires au matériel classique (Lopes 2019, 8 études). C'est la base des modèles « maison ». (https://pmc.ncbi.nlm.nih.gov/articles/PMC6383082/)
- [moyenne] Des pompes ajustées à une charge équivalente à 40 % du 1RM au développé couché donnent une hypertrophie et une force comparables sur 8 semaines (Kikuchi 2017). L'échantillon est petit (n = 18). (https://pmc.ncbi.nlm.nih.gov/articles/PMC5812864/)
- [haute] free-exercise-db (Unlicense) compte 876 exercices. Chaque exercice a un seul champ matériel et aucun champ « pattern de mouvement ». Exemples de répartition : 111 « body only », 20 « bands », 123 haltères, 170 barre. La base ne contient ni Copenhague, ni hollow body, ni pompe archer, ni pike push-up ; le Nordic y figure sous le nom « Natural Glute Ham Raise » (analyse de dist/exercises.json le 2026-10-06). (https://github.com/yuhonas/free-exercise-db)
- [haute] wger (AGPL-3.0) modélise la progression par des règles d'itération : opération +/−/remplacement, pas absolu ou en %, répétition, conditions sur les logs. Ses logs stockent la cible et le réalisé pour le poids, les reps, le RIR et le repos. Ses types de série incluent warmup, dropset, myo et iso. (https://github.com/wger-project/wger/blob/master/wger/manager/models/abstract_config.py)
- [haute] Liftosaur (AGPL-3.0) propose des primitives de progression : lp (incrément, tentatives avant hausse, baisse après N échecs), dp (incrément, reps min, reps max), sum (seuil de reps totales) et custom. (https://www.liftosaur.com/doc/liftoscript)
- [haute] API publique de Hevy : séries de type warmup/normal/failure/dropset, RPE de 6 à 10 par demi-points, et rep_range, rest_seconds et superset_id dans les routines. Les types d'exercice incluent bodyweight_assisted_reps, duration et weight_duration. (https://api.hevyapp.com/docs/)
- [moyenne] Les formules d'Epley et de Brzycki donnent le même 1RM estimé à 10 reps. L'estimation peut s'écarter de 10 % ou plus du réel ; elle est plus fiable sous 10 reps. (https://en.wikipedia.org/wiki/One-repetition_maximum)
- [haute] Coureurs de demi-fond et de fond : les charges lourdes (≥80 % 1RM) et la pliométrie améliorent l'économie de course. Les charges sous-maximales et l'isométrie semblent moins efficaces (Llanos-Lagos 2024). (https://pubmed.ncbi.nlm.nih.gov/38165636/)
- [haute] OMS 2020 : les adultes devraient faire du renforcement d'intensité modérée ou plus, sur tous les grands groupes musculaires, au moins 2 jours par semaine. (https://www.ncbi.nlm.nih.gov/books/NBK566048/)
- [faible] Reddit : les contributeurs restent propriétaires de leurs contenus et accordent une licence à Reddit seulement. Aucune licence ouverte n'a été trouvée pour le wiki « Recommended Routine », qui n'a pas pu être consulté (accès Reddit bloqué). (https://redditinc.com/policies/user-agreement)
