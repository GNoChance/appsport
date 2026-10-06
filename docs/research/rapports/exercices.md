# Source des données d'exercices (bibliothèque débutants) pour appsport

# Source des données d'exercices pour appsport (mesures du 2026-10-06)

*Toutes les mesures ont été faites en lecture seule, via `gh api`, l'API wger.de et les fichiers bruts GitHub. Les points notés « déduit » sont des interprétations, pas des constats.*

## En bref
- **Source principale : wger.** On passe par son [API publique](https://wger.de/api/v2/exerciseinfo/?limit=1000). C'est la seule base qui soit à la fois maintenue, sous une licence claire pour chaque entrée et déjà en partie traduite : 584 des 917 exercices ont une version française.
- **Complément visuel : [bryllim/workout-guide](https://github.com/bryllim/workout-guide).** Il fournit 302 exercices, chacun en 3 dessins SVG, sous licence CC BY-SA 4.0.
- **On n'importe pas les données telles quelles.** On construit notre propre catalogue d'environ 150 exercices pour débutants, enrichis et relus en français. Il est versionné dans le repo, avec la licence et les auteurs de chaque élément.
- **Sources à écarter :**
  - free-exercise-db, wrkout et exercemus : leurs textes et photos sont copiés de bodybuilding.com.
  - hasaneyldrm/exercises-dataset et la version gratuite d'ExerciseDB : usage non commercial seulement, médias appartenant à des tiers.
  - workout-cool ne publie pas sa base d'exercices.

## 1. Inventaire des sources

| Source | Exercices | Français | Médias | Licence code / données / médias | Activité |
|---|---|---|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 876 | 0 | 1 746 JPG (94 Mo) | Unlicense / Unlicense revendiquée / contenu venant de bodybuilding.com | active (sept. 2026) |
| [wrkout/exercises.json](https://github.com/wrkout/exercises.json) | 873 | 0 | les mêmes JPG | Unlicense / idem / images « scrapées » | arrêtée (2025) |
| [wger](https://github.com/wger-project/wger#license) | 917 | 584 noms, 570 descriptions | 378 images (216 Mo), 78 vidéos (3,4 Go en HEVC) | AGPL / CC BY-SA 4 (764), BY-SA 3 (132), CC0 (21) / CC BY-SA, fichier par fichier | très active ([v2.7](https://github.com/wger-project/wger/releases/tag/2.7)) |
| [workout-cool](https://github.com/Snouzy/workout-cool) | 3 (exemples) | oui | vidéos YouTube intégrées | MIT / base non publiée / vidéos de tiers | active |
| [ExerciseDB](https://github.com/ExerciseDB/exercisedb-api) | 1 500 (V1) | 0 | GIF 180p hébergés chez eux | dépôt AGPL sans code / non commercial + attribution / payant | commercial |
| [exercemus](https://github.com/exercemus/exercises) | 872 | 0 | aucune image, 24 vidéos YouTube | MIT / mélange exercises.json + wger | en sommeil |
| [everkinetic/data](https://github.com/everkinetic/data) | environ 293 | 0 | 537 SVG (10 Mo) | CC BY-SA 4.0 | dernier commit en 2022 |
| [workout-guide](https://github.com/bryllim/workout-guide) | 302 | 0 | 906 SVG de 512 px (25 Mo) | MIT / pas de texte / CC BY-SA 4.0 | créé en août 2026 |
| [RepDB, version gratuite](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md) | 609 | payant | 1 165 WebP générés par IA (17,5 Mo) | propriétaire : attribution obligatoire, redistribution interdite | active |
| [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) | 1 324 | 1 324 | GIF © Gym visual | « MIT » appliqué à des données dérivées d'ExerciseDB | contestée |

**free-exercise-db**
- Le schéma est propre : `level`, `force`, `mechanic`, un seul `equipment`, muscles primaires et secondaires, `instructions` (4,3 étapes en moyenne). 525 exercices sont classés « beginner ».
- Le mainteneur ne sait pas d'où viennent les images ([#2](https://github.com/yuhonas/free-exercise-db/issues/2)). En août 2026, il a envisagé de les remplacer par des images de substitution ([#13](https://github.com/yuhonas/free-exercise-db/issues/13)).
- Le dépôt d'origine dit lui-même que ses images ont été « scrapées » ([CONTRIBUTING](https://github.com/wrkout/exercises.json/blob/master/CONTRIBUTING.md)).
- **Vérifié** : les textes sont aussi copiés mot pour mot de bodybuilding.com. Deux fiches comparées à l'archive de 2019 sont identiques, jusqu'à la coquille « torso.This » ([fiche 1](https://web.archive.org/web/2019/https://www.bodybuilding.com/exercises/alternate-incline-dumbbell-curl), [fiche 2](https://web.archive.org/web/2019/https://www.bodybuilding.com/exercises/34-sit-up)).
- 448 fiches sur 876 contiennent la formule typique « This will be your starting position ».
- L'Unlicense ne couvre donc pas ce contenu.

**wger**
- Points forts :
  - plusieurs matériels par exercice ;
  - 15 muscles avec cartes SVG et 8 catégories ;
  - des groupes de variantes (`variation_group` : 59 groupes, 243 exercices) et 204 noms alternatifs ;
  - une licence et un auteur pour chaque traduction et chaque image (279 images sur 378 sont signées, 42 sont marquées comme générées par IA).
- Points faibles :
  - aucun niveau de difficulté ;
  - aucune catégorie « machine » ;
  - 24 % des exercices sans matériel, 157 sans muscle, 70 % sans image ;
  - seuls 160 exercices ont à la fois une description FR, une image, un matériel et un muscle.
- 513 des 584 traductions FR ont été créées en juin 2026 sous un auteur générique. **Déduit** : c'est un import en masse, probablement automatique, donc à relire.
- Les fixtures du dépôt ne contiennent que 70 exercices en français. Il faut donc utiliser l'API : un seul appel renvoie 5,7 Mo, sans authentification ni limite de débit d'après la [documentation](https://wger.readthedocs.io/en/latest/api/api.html).

**workout-cool**
- La base n'est pas publiée : seulement 3 exercices d'exemple. Le mainteneur conseille de générer sa propre base avec ChatGPT ([#66](https://github.com/Snouzy/workout-cool/issues/66)).
- Les vidéos de l'exemple sont des intégrations YouTube de la chaîne Fit'distance. Aucun droit n'est transmis.
- Seul intérêt : servir de modèle (schéma FR/EN et liste de 36 matériels, [code sous MIT](https://github.com/Snouzy/workout-cool/blob/main/prisma/schema.prisma)).

**ExerciseDB**
- La V1 gratuite est réservée à un usage non commercial, avec attribution obligatoire, GIF en 180p et quotas stricts ([spécification](https://oss.exercisedb.dev/swagger)).
- Le pack payant coûte 199 $ ou 599 $ en achat unique ([tarifs](https://exercisedb.io/pricing)). Il est hébergeable chez soi mais ne peut pas être redistribué.
- Pas de français.

**hasaneyldrm/exercises-dataset**
- Le français est complet, mais l'auteur reconnaît que les données et les GIF viennent d'ExerciseDB V1 ([#5](https://github.com/hasaneyldrm/exercises-dataset/issues/5)).
- Les médias appartiennent à Gym visual et le dépôt précise que le cloner ne donne aucune licence ([NOTICE](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md)). C'est un piège juridique.

**RepDB**
- Les données sont riches : 56 matériels, niveau de difficulté, conseils, variantes.
- Mais la licence est propriétaire : la redistribution est interdite (donc pas dans un repo public) et le français est payant.

**Wikidata** : couverture négligeable (28 exercices, 5 noms en français).

## 2. Obligations de licence
- L'AGPL de wger ne s'applique que si l'on réutilise son code, pas ses données.
- La licence CC BY-SA impose d'afficher l'auteur, la source, la licence et la mention « modifié ».
- Une traduction compte comme une adaptation ([CC BY-SA 3.0, §1 et §4b](https://creativecommons.org/licenses/by-sa/3.0/legalcode)). Nos textes dérivés de wger devront donc être publiés sous CC BY-SA 4.0. Les entrées sous 3.0 peuvent être republiées en 4.0. Même règle pour des SVG recolorés.
- En pratique :
  - un dossier `data/` sous CC BY-SA 4.0, séparé du code ;
  - des champs `license`, `authors` et `source_url` pour chaque exercice et chaque média ;
  - une page « Crédits » dans l'appli.

## 3. Filtrage par matériel
- wger couvre bien l'entraînement à la maison : poids du corps 271 exercices, haltères 150, banc 50, barre de traction 22, élastique 20, kettlebell 17.
- En revanche, il couvre mal la salle : 42 des 59 exercices « machine » n'ont aucun matériel renseigné ([liste des matériels](https://wger.de/api/v2/equipment/)).
- workout-guide ajoute des objets de la maison : mur, chaise, porte, serviette.
- Il faut donc **notre propre liste de matériels**, une vingtaine de valeurs (poids du corps, haltères, barre, barre EZ, kettlebell, élastique, barre de traction, banc, poulie, machine guidée, presse, Smith, TRX…).
- On y ajoute un champ `contexte` (maison, salle ou loisir), vérifié à la main sur le catalogue curé.

## 4. Stratégie d'import
**Méthode recommandée : une copie des données versionnée dans notre repo**, produite par un script rejouable (`scripts/import-wger.ts`, Node 24). Ce script :
1. récupère les exercices (`exerciseinfo`) et la liste des suppressions (`deletion-log`), garde la réponse brute datée et génère nos JSON normalisés (identifiant wger, licence, auteurs) ;
2. copie uniquement les SVG utiles de workout-guide, en version figée 1.0.0, avec leur attribution ;
3. pour les photos wger retenues : conversion en WebP et stockage sur le serveur, avec dans le repo une liste des fichiers et leurs empreintes sha256 ;
4. aucune vidéo en v1 : 3,4 Go en HEVC, un format mal lu par les navigateurs ;
5. au déploiement, charge les données dans la base ; le service worker ne met les médias en cache qu'à la demande.

On relance la synchronisation une fois par mois et on relit les différences dans une PR.

**À éviter :**
- les sous-modules git (dépôts de 90 à 100 Mo, avec des médias douteux) ;
- les appels à wger.de pendant l'utilisation de l'appli (pas de hors-ligne, fuite de données vers un tiers, dépendance à leur disponibilité) ;
- l'import au moment du build (résultat non reproductible).

La correspondance entre workout-guide et wger se fait à la main : seuls 114 des 302 noms correspondent automatiquement.

**Traduction en français**
1. Reprendre les 584 traductions wger, marquées comme venant de wger.
2. Traduire les exercices manquants par IA avec un glossaire (développé couché, tirage vertical, soulevé de terre, fentes, gainage…), en statut « brouillon ».
3. Faire relire par un humain, en commençant par le catalogue curé.
4. En option, reverser nos traductions à wger.

## 5. Ce qui manque aux débutants
Aucune source ouverte ne fournit :
- les erreurs fréquentes ;
- les consignes de sécurité ;
- la respiration ;
- le réglage des machines ;
- les variantes plus faciles ou plus difficiles ;
- les remplacements selon le matériel ;
- les charges de départ.

wger n'offre que ses groupes de variantes et 4 remarques en français. ExerciseDB vend ces informations dans son offre Pro.

**Comment combler :**
- Créer une fiche débutant structurée : consignes, points clés, erreurs, sécurité, respiration, version plus facile, version plus difficile, remplacements, niveau, contexte, statut de relecture.
- Classer les exercices par grand type de mouvement (squat, flexion de hanche, poussée et tirage horizontaux ou verticaux, fente, gainage, port de charge). Ce classement permet de calculer automatiquement un exercice de remplacement selon le matériel disponible.
- Faire rédiger des brouillons par IA, puis les relire avant publication.
- Le coach IA ne s'appuie que sur ces fiches relues (RAG), avec un avertissement santé.

## Recommandation
- wger sert de base pour les données et pour le français, workout-guide fournit les visuels.
- Le catalogue curé compte environ 150 exercices couvrant la maison, la salle et le loisir, enrichis et relus en français.
- Le reste de wger (environ 900 exercices) reste consultable comme catalogue étendu.
- free-exercise-db peut au mieux inspirer notre classement des exercices. Les faits bruts (noms, muscles) ne sont en principe pas protégés par le droit d'auteur (déduit, ce n'est pas un avis juridique), mais on n'importe ni ses textes ni ses images.

## Recommandation

Source principale : wger, importé depuis l'API wger.de dans une copie versionnée du repo par un script rejouable. On garde la licence et les auteurs de chaque entrée. On l'utilise pour les données (muscles, matériel, variantes) et pour le français (584 traductions existantes, à relire).

Complément visuel : les SVG de bryllim/workout-guide (CC BY-SA 4.0, version 1.0.0 figée). On y ajoute quelques photos wger, converties en WebP. Pas de vidéos en v1.

Sur cette base, on construit notre propre catalogue d'environ 150 exercices pour débutants, qui couvre la maison, la salle et le loisir. Il contient :
- notre propre liste de matériels et un champ contexte ;
- un classement par grand type de mouvement pour proposer des remplacements ;
- des fiches débutant (erreurs, sécurité, variantes) rédigées en brouillon par IA puis relues par un humain.

Les données de ce catalogue sont publiées sous CC BY-SA 4.0, avec une page Crédits dans l'appli. On n'importe ni textes ni images de free-exercise-db, wrkout, exercemus, hasaneyldrm ou d'ExerciseDB gratuit, car leurs contenus sont protégés ou réservés au non commercial. Seule exception envisageable : un pack ExerciseDB payant, si vous voulez des GIF animés et avez le budget.

## Options

### wger (API) + illustrations workout-guide + catalogue curé enrichi en FR (recommandé)
- Pour : Licences claires entrée par entrée (CC BY-SA 4.0/3.0, CC0) avec auteurs fournis par l'API ; 917 exercices, dont 584 déjà nommés et 570 décrits en français ; Projet très actif (v2.7 en sept. 2026), API sans authentification, 5,7 Mo en un appel, liste des suppressions pour resynchroniser ; Plusieurs matériels par exercice, bien adapté à la maison (poids du corps, barre de traction, élastique) ; Groupes de variantes (59 groupes, 243 exercices) comme point de départ pour les remplacements ; Visuels SVG homogènes et légers (25 Mo pour 906 images) sous CC BY-SA 4.0 ; Aucune dépendance à un tiers pendant l'utilisation si on garde une copie versionnée
- Contre : Partage à l'identique : nos textes dérivés doivent être publiés sous CC BY-SA 4.0, et l'attribution doit être affichée ; Qualité inégale (contributions ouvertes) ; traductions FR de juin 2026 d'origine non documentée, à relire ; Pas de niveau de difficulté, pas de matériel « machine », 24 % des exercices sans matériel, 70 % sans image ; Correspondance workout-guide ↔ wger à faire à la main (114 sur 302 automatiques) ; workout-guide est très récent (août 2026) avec un seul mainteneur ; l'origine des images non issues d'Everkinetic n'est pas documentée

### yuhonas/free-exercise-db (et ses dérivés wrkout/exercises.json, exercemus)
- Pour : Schéma JSON simple et riche (level, force, mechanic, muscles, category) ; 876 exercices, 1 746 photos, prêt à l'emploi ; 525 exercices marqués débutant
- Contre : Textes et photos copiés de bodybuilding.com : risque de contrefaçon, l'Unlicense ne vaut rien pour ce contenu ; Le mainteneur envisage de retirer les images (août 2026) : source instable ; Aucun contenu en français ; 23 % des exercices en matériel « other » ou vide ; un seul matériel par exercice ; pas de barre de traction ; wrkout est arrêté, exercemus en sommeil (aucune image)

### ExerciseDB (V1 gratuite ou pack payant à 199 $ ou 599 $)
- Pour : 1 394 à 1 500 exercices avec GIF animés homogènes ; Liste de matériels détaillée, machines comprises ; Pack Pro avec remplacements, progressions et régressions ; Hébergement chez soi autorisé avec le pack payant
- Contre : V1 gratuite : non commerciale, attribution obligatoire, 180p, quotas stricts ; Pack payant : redistribution interdite, coût, dépendance commerciale ; Aucun contenu en français ; Le dépôt GitHub (AGPL) ne contient ni code ni données

### RepDB (version gratuite)
- Pour : 609 exercices très structurés (difficulté, conseils, MET, variantes, 56 matériels dont machines) ; Illustrations homogènes et légères (17,5 Mo) ; Usage gratuit dans une appli, même commerciale, avec attribution
- Contre : Licence propriétaire : redistribution comme dataset interdite, donc pas dans un repo GitHub public ; Images générées par IA, interdiction de les utiliser pour de l'IA générative ; Français uniquement dans l'offre payante ; Droit propre aux bases de données (Allemagne) ; mélange difficile avec du contenu CC BY-SA

### hasaneyldrm/exercises-dataset
- Pour : 1 324 exercices avec consignes en français ; GIF pour chaque exercice
- Contre : Données dérivées d'ExerciseDB V1 (non commerciale) republiées en « MIT » sans en avoir le droit ; GIF © Gym visual, aucune licence pour ceux qui réutilisent le dépôt ; Français probablement traduit automatiquement (tutoiement, ajout en juillet 2026)

### Snouzy/workout-cool
- Pour : Projet français ; schéma FR/EN et liste de 36 matériels réutilisables (MIT)
- Contre : Base d'exercices non publiée (3 exemples) ; Vidéos = intégrations YouTube Fit'distance, sans droits

### Tout produire nous-mêmes (textes rédigés par IA puis relus, visuels maison)
- Pour : Propriété totale du contenu, pas d'obligation de partage à l'identique ; Contenu entièrement adapté aux débutants francophones
- Contre : Gros effort de rédaction, de relecture et de production visuelle ; Risque d'erreurs techniques sans relecteur compétent

## Risques

- Juridique : importer free-exercise-db, wrkout, exercemus ou hasaneyldrm revient à redistribuer du contenu protégé (bodybuilding.com, ExerciseDB, Gym visual), d'autant plus si le repo GitHub est public.
- Non-conformité CC BY-SA : attribution manquante, ou nos textes dérivés non publiés sous la même licence ; mélanger dans les mêmes fichiers du contenu propriétaire (RepDB, ExerciseDB payant) et du CC BY-SA crée un conflit de licences.
- Qualité du français : 513 traductions wger importées en masse en juin 2026, d'origine non documentée (probablement automatique) ; une consigne technique fausse peut blesser un débutant.
- Sécurité et responsabilité : conseils d'exercice ou du coach IA erronés ; il faut des fiches relues, un avertissement santé et un coach limité à ces fiches.
- Dépendance aux sources : l'API wger a eu des changements incompatibles (v2.5 et v2.6) et workout-guide est un projet de 6 semaines avec un seul mainteneur. La copie versionnée réduit ce risque.
- Couverture visuelle : 70 % des exercices wger n'ont pas d'image, la correspondance avec workout-guide est manuelle, et le style mélange photos et dessins.
- Volume des médias et PWA : les vidéos wger (3,4 Go en HEVC) sont mal lues par une partie des navigateurs ; tout pré-charger saturerait le cache des appareils.
- Source instable : free-exercise-db pourrait remplacer ses images par des images de substitution à tout moment, ce qui casserait un import direct.

## Questions pour nous

- Le repo GitHub sera-t-il public ou privé ? Cela détermine ce qu'on peut y versionner (médias tiers, RepDB interdit en dépôt public).
- L'appli restera-t-elle réservée à vous et vos proches, ou sera-t-elle ouverte au public, voire payante un jour ? Les sources « non commerciales » (ExerciseDB gratuit) seraient alors exclues.
- Acceptez-vous de publier nos fiches d'exercices sous CC BY-SA 4.0 ? C'est obligatoire si on part des textes wger. Sinon il faut tout rédiger nous-mêmes.
- Quel style visuel voulez-vous : dessins SVG homogènes, photos, GIF animés ou vidéos ? Y a-t-il un budget pour un pack commercial (ExerciseDB à 199 ou 599 $) ou pour filmer nos propres vidéos des 30 exercices clés ?
- Qui peut relire les fiches en français (technique et sécurité) ? Y a-t-il un coach ou un pratiquant expérimenté parmi vos proches ?
- Taille du catalogue en v1 : un noyau d'environ 150 exercices relus, ou les 917 de wger dès le départ avec un statut « non relu » ?
- Peut-on envoyer les textes d'exercices à une API d'IA externe pour la traduction et l'enrichissement, ou faut-il un modèle local ? (Le serveur a-t-il un GPU ?)
- Voulez-vous reverser nos traductions françaises à wger (contribution open source) ?

## Affirmations clés

- [haute] free-exercise-db: 876 exercices, 1 746 images JPG (94 Mo), mais le mainteneur ignore l'origine et les droits des images (« usage à vos risques »). (https://github.com/yuhonas/free-exercise-db/issues/2)
- [haute] Le dépôt d'origine wrkout/exercises.json déclare que ses images ont été scrapées sur internet, que l'auteur n'en détient pas les droits, et déconseille l'usage commercial. (https://github.com/wrkout/exercises.json/blob/master/CONTRIBUTING.md)
- [haute] Les textes d'instructions de free-exercise-db sont des copies mot pour mot des guides bodybuilding.com (2 fiches vérifiées sur l'archive 2019, coquille comprise) ; 448 fiches sur 876 contiennent la formule « This will be your starting position ». (https://web.archive.org/web/2019/https://www.bodybuilding.com/exercises/alternate-incline-dumbbell-curl)
- [haute] API wger.de (mesuré le 2026-10-06) : 917 exercices, tous en anglais ; 584 avec un nom FR et 570 avec une description FR ; 378 images (216 Mo) sur 276 exercices ; 78 vidéos (3,4 Go en HEVC). (https://wger.de/api/v2/exerciseinfo/?limit=1000)
- [haute] wger : code sous AGPL-3.0, données d'exercices sous licence Creative Commons définie entrée par entrée (mesuré : 764 en CC BY-SA 4, 132 en CC BY-SA 3, 21 en CC0). (https://github.com/wger-project/wger#license)
- [moyenne] 513 des 584 traductions FR de wger ont été créées en juin 2026 sous l'auteur générique « wger.de » (import en masse ; que ce soit une traduction automatique est déduit, non vérifié). (https://wger.de/api/v2/exerciseinfo/?limit=1000)
- [haute] La liste des matériels de wger compte 12 valeurs (dont barre de traction, élastique, kettlebell, poids du corps) mais aucune valeur « machine » ; 42 des 59 exercices au nom de machine n'ont aucun matériel renseigné. (https://wger.de/api/v2/equipment/)
- [moyenne] Les endpoints publics de wger (exercices) sont accessibles sans authentification et sans limite de débit ; la pagination se règle avec ?limit=n (5,7 Mo en un seul appel). (https://wger.readthedocs.io/en/latest/api/api.html)
- [haute] workout-cool ne publie pas sa base d'exercices complète (3 exercices d'exemple) ; le mainteneur conseille de générer son propre CSV, y compris avec ChatGPT. (https://github.com/Snouzy/workout-cool/issues/66)
- [haute] Les vidéos de l'échantillon workout-cool sont des intégrations YouTube de la chaîne française Fit'distance (aucune licence de réutilisation). (https://github.com/Snouzy/workout-cool/blob/main/data/sample-exercises.csv)
- [haute] ExerciseDB V1 gratuite : 1 500 exercices, GIF en 180p, usage non commercial uniquement, attribution à AscendAPI obligatoire, quotas stricts. (https://oss.exercisedb.dev/swagger)
- [moyenne] ExerciseDB payant : packs auto-hébergeables à 199 $ ou 599 $ (achat unique, 1 394 exercices, licence commerciale perpétuelle, redistribution interdite). (https://exercisedb.io/pricing)
- [haute] bryllim/workout-guide : 302 exercices, 906 images SVG 512×512 (24,7 Mo) ; images sous CC BY-SA 4.0 (dérivées d'Everkinetic), code sous MIT ; dépôt créé le 2026-08-24. (https://github.com/bryllim/workout-guide)
- [haute] hasaneyldrm/exercises-dataset (1 324 exercices, FR complet) : l'auteur a confirmé que données et GIF proviennent d'ExerciseDB V1 (GIF identiques octet pour octet) ; les médias sont © Gym visual et cloner le dépôt ne donne aucune licence. (https://github.com/hasaneyldrm/exercises-dataset/issues/5)
- [haute] RepDB (version gratuite) : 609 exercices EN/DE/ES, images générées par IA ; usage dans une appli autorisé avec attribution, mais redistribution comme dataset interdite et utilisation des images pour de l'IA générative interdite ; FR payant. (https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md)
- [haute] Sous CC BY-SA, une traduction est une adaptation ; une adaptation d'un contenu CC BY-SA 3.0 peut être publiée sous une version ultérieure (4.0) avec les mêmes conditions (partage à l'identique). (https://creativecommons.org/licenses/by-sa/3.0/legalcode)
- [haute] Les fixtures d'exercices du dépôt wger (mises à jour en juin 2026) ne contiennent que 70 traductions FR, contre 584 sur l'API : il faut importer depuis l'API. (https://github.com/wger-project/wger/tree/master/wger/exercises/fixtures)
