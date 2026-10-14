# Brique 2 · Exercices : spec de conception

> **Statut :** brouillon du 2026-10-14, à valider par le propriétaire.
> **Base :** la section [04-exercices](2026-10-06-appsport-design/04-exercices.md) de la spec principale reste l'autorité pour tout ce que ce document ne change pas : schéma des fiches, taxonomie, chaînes, fonctions partagées, chargeur, export, diffusion hors ligne, illustrations et crédits. Ce document fixe les décisions du cadrage du 2026-10-14, les écrans et ce qui s'ajoute.
> **Refonte :** les écrans suivent la [spec de la refonte](2026-10-13-refonte-rune-design.md) (jetons, 5 thèmes, boîte à outils, mouvement, voix du Système).

## 1. Décisions du cadrage

| # | Sujet | Décision du propriétaire | Remplace dans la spec 04 |
|---|---|---|---|
| D1 | Volume | Un **cœur** d'environ 110 à 130 fiches (règles d'inclusion du §7 de la spec 04), puis des **lots d'extension** de 30 fiches vers 250 à 300 au total. | Le plafond de 130 ne vaut plus que pour le cœur. |
| D2 | Relecteurs | Le propriétaire (admin) et deux relectrices relisent **en parallèle**, chacune dans l'appli. | « Un seul relecteur », « rôle relecteur distinct » de la liste Plus tard. |
| D3 | Pouvoirs des relectrices | Elles **commentent et valident** ; seul l'admin modifie le texte et publie. | — |
| D4 | Feu vert santé | Une fiche **sensible** ne se publie qu'avec la validation d'une relectrice « professionnelle de santé » sur sa révision courante. Les autres fiches : la relecture de l'admin suffit. | — |
| D5 | Navigation | L'onglet **Salles devient Exercices** ; les lieux restent dans Profil › Mes lieux. | Spec de la refonte §2 (barre d'onglets). |
| D6 | Rédaction | Brouillons par l'**API Claude**, depuis le poste de dev (spec 04 §9). Le modèle et son prix sont revérifiés au pilote. | — |
| D7 | Liste | Tuiles par groupe musculaire avec la pierre de rang, puis une liste dans chaque groupe (maquette « B puis A » du 2026-10-14). | — |
| D8 | Fiche | Onglets **Comment faire · Erreurs · Variantes** ; l'encadré **Sécurité reste visible sur les trois onglets**. | — |

Le reste du document décline ces décisions.

## 2. Volume et lots

- **Lot A** (environ 75 fiches) : spec 04 §7, conditions (a) et (b). Publié avant la recette de la brique 3.
- **Lot B** : spec 04 §7, condition (c). Publié avant la fin de la brique 3.
- **Lots d'extension E1, E2…** : 30 fiches chacun. Une fiche d'extension doit apporter au moins une chose :
  - une variante de matériel absente (exemple : la version poulie d'un exercice qui n'existe qu'aux haltères) ;
  - un muscle peu couvert dans un profil de référence ;
  - un exercice courant dans les salles françaises.
  Elle suit le même schéma, le même circuit et le même feu vert. Les lots d'extension ne bloquent jamais la brique 3 ni les suivantes.
- **Plafond global** : 300 fiches non retirées (réglable dans le fichier de règles de `packages/domain`). Au-delà, une décision du propriétaire est nécessaire.
- **Illustrations** : le §12 de la spec 04 s'applique à toutes les fiches, cœur et extension. Une fiche d'extension sans illustration disponible peut être publiée sans illustration.
- Le champ `batch` (texte court : `A`, `B`, `E1`, `E2`…) s'ajoute aux champs « squelette » du §4 de la spec 04. Il sert aux filtres et au compteur d'avancement de la relecture ; il n'est jamais servi aux téléphones.

## 3. Relecture à plusieurs

### 3.1 Comptes et droits

Les relectrices sont des **membres** du cercle (invitées comme tout le monde, elles peuvent s'entraîner). Deux drapeaux s'ajoutent au compte, écrits par l'admin seulement :

| Colonne `user` | Type | Effet |
|---|---|---|
| `catalog_reviewer` | 0/1 | accès à l'écran de relecture des exercices |
| `health_professional` | 0/1 | sa validation compte comme feu vert santé ; n'a d'effet que si `catalog_reviewer` = 1 ou si le compte est admin |

- `role` reste `admin | member` (pas de migration de la contrainte). L'admin a toujours accès à la relecture.
- L'admin coche les deux drapeaux depuis la fiche du membre (Administration › Membres › Actions). Les retirer est immédiat ; les commentaires et validations déjà faits restent, avec leur auteur.
- `health_professional` est une donnée sur la personne : catégorie C1 de la spec 03, jamais montrée aux autres membres, présente dans l'export de l'intéressée, effacée avec son compte. La fiche de traitement est mise à jour.

| Action | Membre | Relectrice | Relectrice santé | Admin |
|---|---|---|---|---|
| Lire la file de relecture, les fiches de tous statuts, les commentaires et validations | non | oui | oui | oui |
| Commenter une partie d'une fiche | non | oui | oui | oui |
| « Sécurité vérifiée » (validation) | non | oui | oui (feu vert santé) | oui (feu vert santé seulement si le drapeau est coché) |
| Marquer un commentaire « traité » | non | les siens | les siens | tous |
| Modifier une fiche, changer son statut, exporter le catalogue | non | non | non | oui |
| Reste de l'administration (membres, invitations, salles, serveur) | non | non | non | oui |

- Les routes de relecture sont sous **`/api/review/exercises/*`**, séparées de `/api/admin/*` : une relectrice reçoit 403 sur tout `/api/admin/*`.
- Tout l'écran de relecture fonctionne en ligne seulement (classe E de la spec 01), comme l'administration.

### 3.2 Commentaires

Table `exercise_comment` (STRICT) :
- `id` TEXT PK, `exercise_id` → `exercise.id`, `author_id` → `user.id` (ON DELETE SET NULL, affiché « ancien relecteur »), `part` TEXT, `body` TEXT (1 à 1000 caractères), `revision` INTEGER (révision de la fiche au moment du commentaire), `created_at`, `resolved_at` NULL, `resolved_by` NULL → `user.id`.
- `part` ∈ `general`, `name`, `muscles`, `equipment`, `level`, `instructions`, `key_points`, `mistakes`, `safety`, `breathing`, `setup`, `variants`, `illustrations`. Une valeur hors liste est refusée (400).
- Un commentaire ne se modifie pas et ne se supprime pas ; on le marque « traité ». L'écran les range par partie, ouverts d'abord.

### 3.3 Validations et feu vert santé

Table `exercise_validation` (STRICT) :
- `id` TEXT PK, `exercise_id`, `reviewer_id` → `user.id` (ON DELETE SET NULL), `revision` INTEGER, `health` 0/1 (copie de `health_professional` au moment de la validation), `created_at`.
- Une validation porte sur une révision précise. Valider à nouveau la même révision ne crée pas de doublon.

**Fiche sensible** : fonction pure `isSensitive(ex)` dans `packages/domain/src/catalog/` :
- `level` ≥ 2, OU
- `not_for_minors` = vrai, OU
- `stressed_joints` contient au moins un code de `SENSITIVE_JOINTS` = `lower_back`, `knees`, `shoulders`, `neck` (réglable).

**Feu vert santé à jour** : il existe une validation avec `health` = 1 et `revision` = révision courante de la fiche.

### 3.4 Révisions et écritures simultanées

- Table `exercise_revision` (STRICT) : `exercise_id`, `revision`, `content` (la fiche complète en forme canonique, spec 04 §10), `saved_by`, `saved_at` ; clé (`exercise_id`, `revision`). Une ligne par enregistrement, y compris la création et les changements de statut. C'est elle qui permet d'afficher « ce qui a changé depuis ta validation ».
- **Contrôle de révision** : tout enregistrement (`PUT`) et toute transition envoient `base_revision`. Si la fiche n'est plus à cette révision, le serveur répond **409** avec la fiche courante ; rien n'est écrit. L'écran affiche « La fiche a changé depuis que tu l'as ouverte » et la nouvelle version, en gardant ta saisie à côté pour que tu la reportes.
- Cette règle remplace « la dernière écriture gagne » du §8 de la spec 04 pour la table `exercise`. Le reste de la spec principale n'est pas touché.

### 3.5 Transitions (complète le tableau du §8 de la spec 04)

| Transition | Conditions ajoutées |
|---|---|
| `draft` → `reviewed` | aucune (la case « consignes et sécurité vérifiées » de l'admin reste exigée) |
| `reviewed` → `published` | aucun commentaire ouvert ; si `isSensitive` : feu vert santé à jour |
| modification d'une fiche `published` | elle reste publiée (les programmes y renvoient) ; si elle est sensible, son feu vert devient périmé et elle apparaît dans le filtre « À revalider » ; l'admin voit un bandeau « Publiée, feu vert santé à refaire » |
| `published` → `retired` | inchangé |

Le serveur applique ces conditions lui-même : le bouton grisé de l'écran n'est qu'un reflet. Chaque refus renvoie la liste des conditions manquantes (codes `open_comments`, `health_validation_missing`, `incomplete`, `stale_revision`), que l'écran affiche en clair.

### 3.6 API de relecture

| Méthode et route | Qui | Rôle |
|---|---|---|
| `GET /api/review/exercises` | relectrice, admin | liste : id, nom, statut, lot, sensible, commentaires ouverts, état du feu vert, révision ; filtres `status`, `batch`, `queue` (`to_review`, `health_pending`, `revalidate`, `mine`) |
| `GET /api/review/exercises/:id` | relectrice, admin | fiche complète, commentaires, validations, et le différentiel depuis la dernière validation de l'appelant si elle existe |
| `POST /api/review/exercises/:id/comments` | relectrice, admin | `{part, body, base_revision}` |
| `POST /api/review/comments/:cid/resolve` | auteur ou admin | marque traité |
| `POST /api/review/exercises/:id/validations` | relectrice, admin | `{base_revision}` ; 409 si la révision a changé |
| `PUT /api/admin/exercises/:id` | admin | enregistrement avec `base_revision` |
| `POST /api/admin/exercises/:id/transition` | admin | `{to, base_revision}` |

- Aucune de ces données ne passe par la synchro ni par `GET /api/catalog` (critère 9 de la spec 04, étendu aux tables de cette section).
- Le coach (brique 4) ne lit ni les commentaires ni les validations.
- Pas de notification : les compteurs de la liste suffisent. E-mails et notifications vont dans Plus tard.

## 4. Écrans

### 4.1 Onglet Exercices (tous les membres)

- **Barre d'onglets** : Accueil · Exercices · Progression · Profil. L'onglet Salles disparaît ; Profil › Mes lieux (refonte) mène aux lieux, et les anciennes URL `/places…` continuent de marcher. Le placement de Nutrition (brique 5) et du bouton central Séance (brique 3) sera tranché dans leurs specs.
- **Accueil de l'onglet** (`/exercises`) :
  - recherche en haut (spec 04 §6, `normalize` sur `name` et `aliases`) ; dès qu'on tape, les tuiles laissent place à la liste des résultats ;
  - interrupteur « Faisable à <lieu principal> », activé par défaut s'il existe un lieu principal (filtre `feasible`, spec 04 §6) ; sans lieu principal, l'interrupteur est absent ;
  - tuiles par groupe musculaire, chacune avec la pierre de rang du membre (rangs de la refonte, « Rang E » tant que la brique 3 n'existe pas) et le nombre d'exercices visibles avec le filtre courant ; une tuile à 0 reste affichée, atténuée.
- **Groupes de tuiles** (`EXERCISE_MUSCLE_GROUPS`, dans `packages/contracts`, réutilisés par Progression) : Jambes (`quadriceps`, `hamstrings`, `adductors`), Fessiers (`glutes`), Pectoraux (`chest`), Dos (`lats`, `traps`, `lower_back`), Épaules (`front_delts`, `side_delts`, `rear_delts`, `rotator_cuff`), Bras (`biceps`, `triceps`, `forearms`), Abdos et gainage (`abs`, `obliques`), Mollets (`calves`). Un exercice apparaît dans chaque groupe de ses muscles **principaux**.
- **Liste d'un groupe** (`/exercises/group/:group`) : vignette (première illustration), nom, muscles principaux, matériel de la première option faisable, niveau en 3 barres ; tri par niveau puis par nom.
- On ne voit que les fiches utilisables (`isUsable`, spec 04 §6) : publiées, et hors profil prudent pour les fiches `not_for_minors` (le profil prudent est calculé comme dans la spec 04).

### 4.2 Fiche (`/exercises/:id`)

- **En-tête** : nom, pastilles (niveau, muscles principaux, matériel), illustrations côte à côte sur carte claire, ligne de crédit et lien vers Crédits (spec 04 §12).
- **Encadré Sécurité** sous l'en-tête, visible quel que soit l'onglet, style d'avertissement des jetons de la refonte.
- **Onglets** (composant d'onglets accessible : `tablist`, flèches gauche et droite, onglet actif dans l'URL `?tab=`) :
  - *Comment faire* : `instructions` numérotées, `key_points`, `breathing`, `setup` s'il existe ;
  - *Erreurs* : `mistakes`, chacune « ✕ erreur » puis « ✓ correction » (jamais la couleur seule) ;
  - *Variantes* : voisins de chaîne plus facile et plus dur (liens), `easier_tip` et `harder_tip`, puis jusqu'à 5 remplaçants (`substitutes`, spec 04 §6) faisables dans le lieu principal.
- Une fiche retirée ouverte depuis l'historique affiche un bandeau « Cet exercice n'est plus proposé » et son contenu en lecture.
- Hors ligne : tout s'affiche dès que le catalogue et les illustrations sont en local (spec 04 §11).

### 4.3 Lien depuis Progression

Dans l'onglet Progression (refonte), toucher le rang d'un groupe musculaire ouvre `/exercises/group/:group`. Les groupes de Progression et d'Exercices sont la même constante.

### 4.4 Relecture (`/review/exercises`)

- Accessible depuis Profil › Relecture des exercices, ligne visible seulement pour les relectrices et l'admin (l'admin l'a aussi dans Administration).
- **Liste** : avancement par lot (« Cœur · 41 / 120 publiées »), filtres « À relire », « Feu vert santé », « À revalider », « Mes commentaires » avec leurs compteurs, une ligne par fiche avec ses pastilles d'état (sensible et articulation, commentaires ouverts, validée par toi, à revalider, prête à publier).
- **Fiche** : aperçu identique à la vue membre ; bouton « + Commenter » sur chaque partie ; commentaires affichés à leur place, avec auteur, date, révision et bouton « Traité » ; différentiel « depuis ta validation » quand il existe.
- **Admin** : en plus, « Modifier » (formulaire du §8 de la spec 04) et « Publier » ; « Publier » est désactivé tant qu'une condition manque, et la raison est écrite dessous (« 1 commentaire ouvert · feu vert santé manquant »).
- **Relectrice** : « Sécurité vérifiée » à la place de « Modifier » et « Publier ».
- Conflit de révision : message dans la page et nouvelle version affichée (§3.4).

## 5. Production du contenu

1. **Étape 0** (spec 04 §8) : guide de style `docs/catalog/style-guide.md`, glossaire `data/glossary.json`, puis **deux fiches étalons** écrites à la main et relues par les trois relecteurs.
2. **Pilote** : l'API Claude rédige 5 fiches variées (au moins une sensible, une sans matériel, une machine, une à chaîne) ; les trois relecteurs les relisent ; le prompt et le glossaire sont ajustés (`prompt_version` + 1) avant le reste. Avant le pilote, le modèle par défaut et son coût sont revérifiés et le budget est noté dans `scripts/exercises/NOTES.md`.
3. **Cœur** : lots A puis B (§2). Les squelettes sont écrits d'après les 6 modèles de programmes. La spec de la brique 2 fixe les règles et une **liste provisoire** ; la brique 3 la complète quand les modèles sont écrits (spec 04 §7).
4. **Extension** : lots de 30, au rythme de la relecture.
5. **Charge** : 8 à 10 minutes par fiche (spec 04 §7), soit 15 à 20 heures pour le cœur, réparties entre les trois relecteurs ; toutes les fiches sensibles passent par la relectrice santé.
6. **Clé API** : workspace Anthropic de développement, distinct de celui du coach (spec 04 §9). Aucune donnée personnelle n'est envoyée.

## 6. Données ajoutées (récapitulatif)

- `user` : `catalog_reviewer`, `health_professional` (migration non cassante, défaut 0).
- `exercise` : `batch` (texte court, non servi aux téléphones).
- Nouvelles tables : `exercise_comment`, `exercise_validation`, `exercise_revision` (C0 éditorial, admin et relecteurs seulement ; les colonnes d'auteur sont effacées ou anonymisées à la suppression d'un compte, comme `reviewed_by` dans la spec 04).
- Constantes : `SENSITIVE_JOINTS`, `EXERCISE_MUSCLE_GROUPS`, `CATALOG_MAX_SHEETS` = 300.
- Fonctions partagées : `isSensitive(ex)`, `healthGreenLight(ex, validations)`, `publishBlockers(ex, comments, validations)` (pures, testées, utilisées par le serveur et par l'écran).
- L'export du catalogue (spec 04 §10) ne contient ni commentaires, ni validations, ni révisions : ce sont des données de travail de la base. La sauvegarde normale de la base les couvre.

## 7. Critères d'acceptation

Les 14 critères du §13 de la spec 04 restent exigés. S'ajoutent :

1. **Droits** : une relectrice obtient 200 sur `/api/review/exercises/*` et 403 sur tout `/api/admin/*` ; un membre simple obtient 403 sur les deux ; un compte dont on retire `catalog_reviewer` perd l'accès à la requête suivante.
2. **Isolation** : `GET /api/catalog`, la synchro, l'export du catalogue et le coach ne contiennent jamais de commentaire, de validation, de révision ni les drapeaux d'un autre membre.
3. **Feu vert** : publier une fiche sensible sans feu vert santé à jour est refusé par le serveur (code `health_validation_missing`) ; un tableau de cas couvre chaque branche de `isSensitive` (niveau 2, niveau 3, `not_for_minors`, chacune des 4 articulations, et une fiche non sensible).
4. **Commentaires ouverts** : publier avec un commentaire ouvert est refusé (`open_comments`).
5. **Péremption** : modifier une fiche après une validation santé rend le feu vert périmé ; le différentiel montre exactement les champs changés ; une fiche publiée modifiée reste servie aux membres et apparaît dans « À revalider ».
6. **Simultanéité** : deux `PUT` partis de la même `base_revision` donnent 200 puis 409 ; la seconde saisie n'écrase rien ; idem pour une validation envoyée sur une révision dépassée.
7. **Révisions** : chaque enregistrement et chaque transition crée une ligne `exercise_revision` ; le contenu de la ligne courante est identique à la fiche.
8. **Écrans** : les nombres des tuiles suivent l'interrupteur « faisable » ; l'encadré sécurité est présent dans les trois onglets ; les onglets se pilotent au clavier ; le lien depuis Progression ouvre le bon groupe ; une relectrice ne voit ni « Modifier » ni « Publier ».
9. **De bout en bout** (Playwright, Chromium et WebKit) : une relectrice commente, l'admin corrige et marque traité, la relectrice santé valide, l'admin publie, puis un membre ouvre la fiche hors ligne.
10. **Données personnelles** : `health_professional` figure dans l'export de l'intéressée, disparaît à la suppression de son compte, et n'apparaît jamais dans une réponse destinée à un autre membre.

## 8. Risques

- **Relecture plus lente que prévu**, surtout le feu vert santé qui dépend d'une seule personne. Parades : lot A d'abord, filtre « Feu vert santé » pour qu'elle traite sa file d'un coup, lots d'extension sans échéance.
- **Validation donnée sur une version dépassée** : le contrôle de révision et la péremption l'empêchent.
- **Fiche publiée corrigée puis servie avant revalidation** : risque accepté pour ne pas casser les programmes ; il est visible (bandeau, filtre) et limité dans le temps.
- **Barre d'onglets à revoir** à la brique 3 (bouton Séance) et à la brique 5 (Nutrition) : tranché dans leurs specs.
- Les risques de la spec 04 (erreur technique d'une fiche, provenance des dessins, taxonomie grossière, copie du dépôt périmée, SVG piégés) restent valables.

## 9. Plus tard

Suggestions de modification acceptées en un clic ; notifications de relecture ; e-mails ; régénération d'une fiche par l'IA depuis l'écran ; bouton « signaler une erreur » côté membres ; et le reste de la liste du §14 de la spec 04 (vidéos, dessins maison, carte musculaire, cardio, étirements…).
