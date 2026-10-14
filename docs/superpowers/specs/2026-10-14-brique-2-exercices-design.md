# Brique 2 · Exercices : spec de conception

> **Statut :** version 3 du 2026-10-14, **validée par le propriétaire le 2026-10-14** (page de synthèse : les 6 choix de la section 4 cochés ; adducteurs gardés avec Quadriceps). Relue par quatre relecteurs (vie privée, cohérence, expérience, testabilité) et une vérification des corrections.
> **Base :** la section [04-exercices](2026-10-06-appsport-design/04-exercices.md) de la spec principale reste l'autorité pour tout ce que ce document ne remplace pas explicitement : schéma des fiches, taxonomie, chaînes, fonctions partagées, chargeur, export, diffusion hors ligne, illustrations et crédits. Ce document fixe les décisions du cadrage du 2026-10-14, les écrans, et ce qui s'ajoute ou change.
> **Refonte :** les écrans suivent la [spec de la refonte](2026-10-13-refonte-rune-design.md) : jetons, 5 thèmes, boîte à outils, feuilles du bas, mouvement, voix du Système.

## 1. Décisions et remplacements

| # | Sujet | Décision | Remplace |
|---|---|---|---|
| D1 | Volume | Un **cœur** d'environ 110 à 130 fiches (règles d'inclusion de 04 §7), puis des **lots d'extension** de 30 fiches, jusqu'à 300 fiches non retirées au plus. | 04 §7 : le plafond de 130 ne vaut plus que pour le cœur. |
| D2 | Relecteurs | L'admin et des relectrices relisent **en parallèle**, chacune dans l'appli. | 04 §8 « un seul relecteur » ; 04 §14 « rôle relecteur distinct » (Plus tard) ; 02 R-ROLE-3 « pas de rôle relecteur ». |
| D3 | Pouvoirs | Les relectrices **commentent et valident** ; seul l'admin modifie le texte, change les statuts et exporte. | — |
| D4 | Feu vert santé | Une fiche **sensible** ne se publie qu'avec le **feu vert santé à jour** d'une relectrice « professionnelle de santé » qui n'est pas l'auteur de la modification. | — |
| D5 | Navigation | L'onglet **Salles devient Exercices**. Barre : **Accueil · Exercices · Progression · Profil**. Les lieux restent dans Profil › Mes lieux. | Refonte §5 (barre d'onglets) et §5 « À la brique 5, Nutrition prend la place de Salles » (le sort de Nutrition et du bouton Séance sera tranché dans leurs specs). |
| D6 | Rédaction | Brouillons par l'**API Claude** depuis le poste de dev (04 §9). Modèle et prix revérifiés au pilote. | — |
| D7 | Liste | Tuiles par groupe musculaire avec la pierre de rang, puis une liste dans chaque groupe. | — |
| D8 | Fiche | Onglets **Comment faire · Erreurs · Variantes** ; l'encadré **Sécurité est visible sur les trois onglets**. | — |
| D9 | Groupes musculaires | Les **9 groupes de la refonte** (Progression) deviennent une constante partagée, utilisée par les tuiles et par Progression. | Plan de la refonte, Task 9 : la constante locale `MUSCLE_GROUPS_LABELS` est remplacée par l'import de `MUSCLE_GROUPS`. |
| D10 | Écran d'admin | L'écran de relecture `/review/exercises` remplace `/admin/exercises` (04 §8, étape 4) ; l'admin y a des outils en plus (§4.5). | 04 §8 étape 4, 04 §13 critère 9 (la route `/admin/exercises` n'existe plus côté web ; les routes API d'édition restent sous `/api/admin/`). |
| D11 | Fin de la brique 2 | La brique 2 livre l'outillage, les écrans, les fiches étalons, le pilote et les squelettes du lot A provisoire. La liste définitive des lots A et B et leur publication se terminent dans la brique 3, quand les 6 modèles de programmes sont écrits. | 04 §7 « Lot A publié avant la recette de la brique 3 » reste vrai ; seule la répartition entre briques est précisée. |

## 2. Volume et lots

- **Lot A** (environ 75 fiches) : 04 §7, conditions (a) et (b). Publié avant la recette de la brique 3.
- **Lot B** : 04 §7, condition (c). Publié avant la fin de la brique 3.
- **Lots d'extension `E1`, `E2`…** : 30 fiches chacun. Une fiche d'extension apporte au moins une chose : une variante de matériel absente, un muscle peu couvert dans un profil de référence, ou un exercice courant dans les salles françaises. Même schéma, même circuit, même feu vert. Ils ne bloquent aucune brique.
- **Plafond** : `CATALOG_MAX_SHEETS` = 300 fiches non retirées, tous statuts confondus (brouillons compris), réglable dans le fichier de règles de `packages/domain`.
  - `data:validate` échoue au-delà de 300 (300 accepté, 301 refusé).
  - Le serveur refuse `retired → reviewed` qui ferait dépasser 300 (blocage `catalog_full`).
- **Champ `batch`** : ajouté aux champs « squelette » de 04 §4. Valeurs `A`, `B`, ou `E` suivi d'un nombre de 1 à 99 (`E1`…`E99`) ; obligatoire ; les fiches étalons sont en `A`. Colonne éditoriale : jamais servie aux téléphones (ajoutée à la liste d'exclusion de `GET /api/catalog`, 04 §11, et aux colonnes éditoriales de 09).
- **Liste provisoire du lot A** : écrite à la première étape du plan (squelettes), à partir du tableau de 04 §7 et des patterns de slots prévus par 05. Le propriétaire la valide avant toute rédaction.

## 3. Relecture à plusieurs

### 3.1 Comptes et drapeaux

Les relectrices sont des **membres** du cercle, invitées comme tout le monde (elles passent l'onboarding normal). Deux drapeaux s'ajoutent à `user`, écrits par l'admin seulement :

| Colonne | Type | Effet |
|---|---|---|
| `catalog_reviewer` | INTEGER 0/1, défaut 0 | accès à la relecture des exercices |
| `health_professional` | INTEGER 0/1, défaut 0 | la validation de ce compte compte comme feu vert santé |

- **Drapeau effectif** : un compte est *relecteur* si `catalog_reviewer` = 1 ou `role` = admin. Il est *relecteur santé* si `health_professional` = 1 ET `catalog_reviewer` = 1 ET `role` = member : un admin n'est jamais relecteur santé, même si le drapeau a été coché par un autre admin ou avant une promotion.
- `role` reste `admin | member` (contrainte CHECK de 0001 inchangée). Migration non cassante : deux `ADD COLUMN … NOT NULL DEFAULT 0 CHECK (… IN (0,1))`.
- **Catégorie** : C0 admin, comme `role` (spec 03 et 09). Ni le drapeau ni son changement ne sont des données de santé ; c'est une qualification professionnelle déclarée. Base légale : l'accord de la personne, recueilli par l'admin avant de cocher. La personne voit ses propres drapeaux (`/api/me`, Profil › Relecture des exercices) ; ils sont dans son export (colonnes non secrètes de `user`) et effacés avec son compte. La fiche de traitement, la page Confidentialité, 02 R-ROLE-3 et 03 §5 et §13.4 sont mis à jour.
- **Visibilité** : les autres membres ne voient jamais ces drapeaux. Les autres relectrices ne voient pas qui est relectrice santé : elles voient l'état agrégé « feu vert santé : à jour / manquant / à refaire », sans auteur. Seul l'admin voit qui a donné un feu vert santé.
- **Changer un drapeau** : `POST /api/admin/members/:id/reviewer-flags` `{catalogReviewer, healthProfessional, password}`. Le mot de passe de l'admin est ressaisi (P-AUT-5), comme pour un changement de rôle, et l'événement `reviewer_flags_changed` (avant et après) est écrit au journal de sécurité. **L'admin ne peut pas cocher `health_professional` sur son propre compte** (refus `self_health_flag`). Le retrait est immédiat : la session relit les drapeaux à chaque requête.

| Action | Membre | Relectrice | Relectrice santé | Admin |
|---|---|---|---|---|
| Lire la file, les fiches de tous statuts, `review_notes`, les commentaires | non | oui | oui | oui |
| Voir `drafting`, `reviewed_by`, `exported_revision`, qui a validé | non | non | non | oui |
| Commenter | non | oui | oui | oui |
| Valider | non | « J'ai relu, rien à redire » | « Sécurité vérifiée » (feu vert santé) | « J'ai relu » (jamais de feu vert santé) |
| Marquer un commentaire traité | non | les siens | les siens | tous |
| Modifier, changer un statut, choisir les illustrations, exporter | non | non | non | oui |
| Reste de l'administration | non | non | non | oui |

- Toutes les routes de relecture sont sous **`/api/review/*`** et gardées par « relecteur effectif », relu à chaque requête. Les routes d'édition restent sous `/api/admin/*` (garde admin existante) : une relectrice y reçoit 403.
- **Classe de synchro H** (spec 01) : la relecture fonctionne en ligne seulement, rien n'est copié sur les téléphones, comme l'administration.

### 3.2 Contenu d'une révision et feu vert

- **Champs de contenu** : tous les champs de 04 §4 sauf les champs système et éditoriaux : `schema_version`, `revision`, `status`, `review_notes`, `drafting`, `reviewed_by`, `reviewed_at`, `published_at`, `retired_at`, `updated_at`, `exported_revision`, `batch`. Fonction pure `contentOf(sheet)` dans `packages/domain/src/catalog/`, forme canonique de 04 §10.
- **Révision** : `revision` reste le compteur de 04 §4 (+1 à chaque enregistrement, transitions comprises). Il sert au contrôle des écritures simultanées (§3.5).
- **Fiche sensible** : `isSensitive(sheet)` = `level` ≥ 2, OU `not_for_minors`, OU `stressed_joints` contient un code de `SENSITIVE_JOINTS` = `lower_back`, `knees`, `shoulders`, `neck` (réglable).
- **Feu vert santé à jour** : `healthGreenLight(sheet, validations, users)` est vrai s'il existe une validation telle que :
  1. son auteur est encore relecteur santé effectif au moment du calcul (un compte supprimé ou un drapeau retiré ne compte plus) ;
  2. son auteur n'est pas `saved_by` de la dernière révision dont le contenu a changé ;
  3. `contentOf` de la révision validée est identique à `contentOf` de la fiche courante.

  Une transition (`draft → reviewed`, `reviewed → published`…) ne change pas le contenu : elle ne périme donc aucun feu vert.
- **On valide** une fiche au statut `reviewed` ou `published` seulement (refus `not_reviewable` sinon).
- **Différentiel** (« ce qui a changé depuis ta validation ») : liste triée des clés de contenu dont la valeur diffère entre la révision de la dernière validation de l'appelant et la fiche courante. `null` si l'appelant n'a jamais validé cette fiche ; `[]` si rien n'a changé. Pour l'admin, le différentiel est calculé depuis la dernière validation santé qui remplit encore les conditions 1 et 2 (`null` s'il n'y en a pas). L'écran montre, pour chaque clé, l'ancienne et la nouvelle valeur.

### 3.3 Commentaires

Table `exercise_comment` (STRICT, classe H, C0 ; déclaration `entityRules` au §6) :
- `id` TEXT PK ; `exercise_id` → `exercise.id` ; `author_id` → `user.id` ON DELETE SET NULL (affiché « Ancien relecteur ») ; `part` TEXT ; `body` TEXT ; `revision` INTEGER (la `base_revision` envoyée) ; `created_at` ; `resolved_at` NULL ; `resolved_by` → `user.id` ON DELETE SET NULL.
- `part` ∈ `general`, `name`, `muscles`, `equipment`, `level`, `not_for_minors`, `stressed_joints`, `instructions`, `key_points`, `mistakes`, `safety`, `breathing`, `setup`, `variants`, `illustrations`. Hors liste : 400.
- `body` : 1 à 1000 caractères après retrait des caractères de contrôle sauf le retour à la ligne (`\n` gardé, `\r\n` ramené à `\n`) et des caractères d'inversion de sens (U+202A à U+202E, U+2066 à U+2069). Affiché en **texte brut** : ni Markdown, ni HTML, ni lien automatique.
- Un commentaire envoyé sur une révision dépassée est **accepté** (un avis reste utile) et garde sa révision. Tout commentaire ouvert bloque la publication, quelle que soit sa révision.
- On ne modifie ni ne supprime un commentaire ; « Traité » est idempotent (200, `resolved_at` non réécrit). On peut commenter une fiche de n'importe quel statut sauf `retired`.
- Ordre d'affichage : ordre de la liste `part`, puis ouverts avant traités, puis `created_at`, puis `id`.
- Sous le champ : « Parle de la fiche, pas de ta santé ni de celle d'un membre. »

### 3.4 Validations

Table `exercise_validation` (STRICT, classe H, C0) : `id` TEXT PK, `exercise_id`, `reviewer_id` → `user.id` ON DELETE SET NULL, `revision` INTEGER, `health` 0/1 (drapeau effectif au moment de valider, pour l'historique ; le calcul du feu vert relit le drapeau actuel), `created_at`. Contrainte `UNIQUE (exercise_id, reviewer_id, revision)` ; une seconde validation de la même révision par le même compte renvoie 200 avec la validation existante.

### 3.5 Révisions et écritures simultanées

- Table `exercise_revision` (STRICT, classe H, C0) : `exercise_id`, `revision`, `content` (sortie de `contentOf`, donc sans champ éditorial ni identifiant de compte), `status`, `saved_by` → `user.id` ON DELETE SET NULL (NULL pour une ligne écrite par le chargeur), `saved_at` ; clé (`exercise_id`, `revision`). Une ligne par enregistrement et par transition.
- Tout `PUT` et toute transition envoient `base_revision`. L'écriture est un `UPDATE … WHERE id = ? AND revision = ?` dans une transaction `BEGIN IMMEDIATE`, avec l'insertion de la ligne de révision et, si besoin, le recalcul de `catalog_version` (§3.7). Si aucune ligne n'est mise à jour : **409** `{error: 'revision_conflict', current}` avec la fiche courante, sans évaluer d'autre condition.
- L'écran garde la saisie de l'admin à côté de la version courante pour qu'il la reporte. Une validation envoyée sur une révision dépassée reçoit aussi 409 (on ne valide que ce qu'on a vu).
- Cette règle remplace « la dernière écriture gagne » (04 §8 étape 4 et 09) pour la table `exercise` seulement.

### 3.6 Transitions et blocages

Les transitions de 04 §8 restent ; voici leurs blocages, dans cet ordre fixe (tableau `PUBLISH_BLOCKERS_ORDER` de `packages/domain`) :

| Code | Message affiché | S'applique à |
|---|---|---|
| `incomplete` | Des champs obligatoires sont vides. | `draft → reviewed` |
| `invalid_sheet` | La fiche ne passe pas la validation complète (04 §13, critère 1). | `draft → reviewed`, et `PUT` sur une fiche `reviewed` ou `published` |
| `review_unchecked` | Coche « Consignes et sécurité vérifiées ». | `draft → reviewed` |
| `minors_unconfirmed` | Confirme le réglage « Déconseillé aux mineurs ». | `draft → reviewed` |
| `open_comments` | N commentaires ne sont pas traités. | `reviewed → published` |
| `health_validation_missing` | Il manque le feu vert santé sur cette version. | `reviewed → published` (fiche sensible) |
| `illustrations_missing` | Une illustration n'est pas dans le manifeste. | `reviewed → published` |
| `referenced_by_template` | Un modèle de programme utilise cette fiche. | `→ retired` |
| `chain_break` | Retirer cette fiche couperait sa chaîne. | `→ retired` |
| `catalog_full` | Le catalogue a atteint 300 fiches. | `retired → reviewed` |

- Refus : **422** `{error: 'transition_blocked', blockers: [codes dans l'ordre ci-dessus]}` (un `PUT` refusé par `invalid_sheet` répond de même). Les codes de blocage forment une énumération à part, `PublishBlocker`, dans `packages/contracts` ; ils ne sont jamais renvoyés comme `error`.
- Codes ajoutés à `ApiErrorCode`, avec leur statut : `revision_conflict` 409, `transition_blocked` 422, `not_reviewable` 409, `self_health_flag` 403.
- **Modifier une fiche `published`** : elle reste publiée (les programmes y renvoient) et les téléphones reçoivent le nouveau contenu. Si elle est sensible et que son feu vert n'est plus à jour, elle entre dans la file « À revalider » et l'admin voit le bandeau « Publiée, feu vert santé à refaire ». Le même cas s'applique à une fiche publiée qui devient sensible après une modification (passage du niveau 1 au niveau 2, par exemple).
- **Fiches retirées servies** : `GET /api/catalog` ne sert une fiche `retired` que si elle a été publiée un jour (`published_at` non nul). Un brouillon retiré ne quitte jamais le serveur.
- **Chargeur** (04 §10) : une fiche absente de la base n'est insérée que si son statut est `draft`, sauf pour amorcer une base vide (installation neuve). Dans ce cas, les commentaires, validations et révisions, qui ne sont pas exportés, sont perdus ; les fiches gardent leur statut.

### 3.7 Version du catalogue

Tout enregistrement ou transition d'une fiche recalcule `catalog_version` dans la même transaction et reconstruit depuis la base le bloc servi par `GET /api/catalog` (la base fait foi, 04 §2). La version étant une empreinte du contenu servi (fiches `published`, fiches `retired` déjà publiées, manifeste, modèles), elle ne change que si ce contenu change : une écriture sur un brouillon la laisse identique. Un commentaire ou une validation ne déclenche aucun recalcul.

### 3.8 Files de relecture

| File | Prédicat |
|---|---|
| `to_review` | `status` = `reviewed`, et l'appelant n'a pas validé le contenu courant |
| `drafts` (« Brouillons à commenter ») | `status` = `draft` ; consultable et commentable, jamais compté par la carte d'accueil |
| `health_pending` | `status` = `reviewed`, `isSensitive`, et pas de feu vert santé à jour |
| `revalidate` | `status` = `published`, `isSensitive`, et pas de feu vert santé à jour |
| `mine` | au moins un commentaire **ouvert** écrit par l'appelant |
| « Prête à publier » | `status` = `reviewed` et aucun blocage de `reviewed → published` |
| Avancement « Cœur · n / m publiées » | n = fiches `published` des lots `A` et `B` ; m = fiches non retirées des lots `A` et `B` ; une ligne par lot d'extension |

### 3.9 API

| Méthode et route | Qui | Rôle |
|---|---|---|
| `GET /api/review/exercises?queue=&batch=&status=` | relecteur | liste : id, nom, statut, lot, sensible et articulations, commentaires ouverts, état du feu vert, `revision`, « validée par toi » |
| `GET /api/review/exercises/:id` | relecteur | fiche (champs selon le tableau §3.1), commentaires, état du feu vert, différentiel de l'appelant ; l'admin reçoit en plus les validations nominatives |
| `POST /api/review/exercises/:id/comments` | relecteur | `{part, body, base_revision}` |
| `POST /api/review/comments/:cid/resolve` | auteur relecteur ou admin | marque traité |
| `POST /api/review/exercises/:id/validations` | relecteur | `{base_revision}` |
| `GET /api/admin/exercises/export` | admin | export du catalogue (04 §10) |
| `PUT /api/admin/exercises/:id` | admin | enregistrement avec `base_revision` |
| `POST /api/admin/exercises/:id/transition` | admin | `{to, base_revision}` |
| `POST /api/admin/members/:id/reviewer-flags` | admin | §3.1 |

- `MeResponse` porte `catalogReviewer` et `healthProfessional` du compte courant ; `MemberSummary` (admin) porte les deux drapeaux.
- Rien de cette section ne passe par la synchro, `GET /api/catalog`, l'export du catalogue ni le coach.
- **Export personnel** (spec 03) : il contient en plus les commentaires écrits par la personne (`author_id`) et ses validations (`reviewer_id` : fiche, révision, date), par un traitement explicite dans `buildExport` comme pour `gym_history`. C'est une exception déclarée à P-CAT-3 (le C0 n'est pas exporté d'ordinaire), notée dans la spec 03 et la fiche de traitement. Les révisions ne sont pas exportées : elles ne contiennent aucune donnée de la personne.
- **Suppression de compte** : les quatre clés vers `user` sont en SET NULL ; aucune ligne de ces tables ne garde l'identifiant ; les trois tables sont ajoutées aux jeux de données de `delete.test`.
- Pas de notification ni d'e-mail ; la carte d'accueil (§4.4) en tient lieu.

## 4. Écrans

### 4.1 Onglet Exercices

- **Barre d'onglets** : Accueil · Exercices · Progression · Profil (`/exercises`, onglet actif pour `/exercises…`). Les lieux suivent la règle P6 de la refonte : `/places…` est canonique, `/profile/places…` y redirige ; sur `/places…` et `/gyms…`, l'onglet actif est **Profil**.
- **Accueil de l'onglet** :
  - recherche en haut (`normalize`, 04 §6) ; dès qu'on tape, les tuiles laissent place aux résultats ;
  - interrupteur **« Faisable : <lieu principal> »**, activé par défaut ; son état est gardé dans la liste d'un groupe et dans les résultats ;
  - **sans lieu principal** : pas d'interrupteur, une ligne « Choisis ton lieu principal pour ne voir que ce que tu peux faire » qui mène à Profil › Mes lieux ; listes et remplaçants sans filtre de faisabilité ;
  - **9 tuiles** (`MUSCLE_GROUPS`, §4.3), chacune avec la pierre de rang du membre (« Rang E » tant que la brique 3 n'existe pas) et le nombre d'exercices visibles avec le filtre courant. Nom accessible, par exemple : « Quadriceps, rang E, 18 exercices ». Une tuile à 0 garde un contraste normal ; la toucher ouvre l'état vide « Rien de faisable à <lieu> dans ce groupe » avec « Tout voir ».
- **Liste d'un groupe** (`/exercises/group/:code`) : vignette (première illustration, ou pictogramme neutre du groupe avec `alt=""`), nom, muscles principaux, matériel de la première option faisable (ou de la première option sans lieu), niveau en 3 barres avec le texte « Niveau 1 sur 3, débutant » (visible ou réservé aux lecteurs d'écran). Tri par niveau, puis par nom avec `Intl.Collator('fr', {sensitivity: 'base'})`, puis par `id`.
- **Recherche** : le filtre « faisable » s'applique aussi aux résultats. Sans résultat : « Aucun exercice ne correspond. » et, si des fiches sont masquées, « N exercices masqués par le filtre Faisable · Les voir ». En profil prudent : « Certains exercices sont masqués par le mode prudent. ». Filtre coupé, un exercice non faisable porte la mention écrite « Pas faisable : <lieu> ».
- **Ce qu'on voit** : interrupteur activé = `isUsable` (04 §6) avec le matériel du lieu principal ; interrupteur coupé ou sans lieu = `published` et non (`cautious` et `not_for_minors`).
- **Catalogue pas encore téléchargé** : en ligne, « Le catalogue arrive… » ; hors ligne, « Connecte-toi une fois pour récupérer les exercices. » (voix du Système), à la place du contenu de toute page `/exercises…` (accueil de l'onglet, groupe, fiche ouverte par URL).
- Cibles tactiles d'au moins 44 × 44 px : tuiles, lignes, interrupteur, onglets de la fiche, liens de variantes, pastilles de filtre, boutons de la relecture.

### 4.2 Fiche (`/exercises/:id`)

- **En-tête** : nom, pastilles (niveau, muscles principaux, matériel), illustrations côte à côte sur carte claire avec ligne de crédit et lien vers Crédits (04 §12). Sans illustration : ni carte ni crédit. Illustration pas encore en cache : la carte affiche « Illustration disponible après synchronisation ».
- **Onglets** (motif d'onglets de l'ARIA APG : `tablist`, flèches, Début, Fin, un seul onglet focalisable, `aria-controls`, panneau focalisable). Onglet dans l'URL (`?tab=how|mistakes|variants`) ; changer d'onglet **remplace** l'entrée d'historique, donc Retour revient à la liste, dont la recherche et le défilement sont restaurés. Onglet par défaut et valeur inconnue : « Comment faire ».
- **Encadré Sécurité** : juste **sous la barre d'onglets, au-dessus du contenu de chaque onglet**, avec le titre « Sécurité » et une icône (pas la couleur seule). Chaque entrée de `safety` fait au plus 120 caractères (guide de style et validateur). La paire texte d'avertissement / fond entre dans le test de contraste des 5 thèmes.
- **Comment faire** : `instructions` numérotées, `key_points`, `breathing`, `setup` s'il existe.
- **Erreurs** : chaque `mistakes` en « ✕ erreur » puis « ✓ correction », avec les préfixes réservés aux lecteurs d'écran « Erreur : » et « Correction : ».
- **Variantes** : voisins de chaîne plus facile et plus dur **filtrés par `usableChainSteps`** (un voisin non utilisable n'est pas affiché), `easier_tip` et `harder_tip`, puis jusqu'à 5 remplaçants (`substitutes`). Leur `maxLevel` vient du niveau d'expérience du profil d'entraînement (`maxExerciseLevel`, 04 §3.5 ; 2 si inconnu). Le matériel est celui du lieu principal, ou tout le matériel sans lieu.
- **Fiche non utilisable ouverte par son URL** (profil prudent et `not_for_minors`) : bandeau « Cet exercice n'est pas proposé avec tes réglages actuels. » et lien vers les remplaçants ; le contenu n'est pas affiché. Une fiche simplement infaisable dans le lieu s'affiche normalement, avec la mention « Pas faisable : <lieu> ».
- **Fiche retirée** (depuis l'historique) : bandeau « Cet exercice n'est plus proposé. », contenu en lecture, lien « Voir des exercices proches » vers ses remplaçants ; s'il n'y en a aucun, le lien est remplacé par « Aucun exercice proche pour l'instant. ».
- Hors ligne : tout s'affiche dès que le catalogue et les illustrations sont en local (04 §11).

### 4.3 Groupes musculaires et Progression

`MUSCLE_GROUPS` (dans `packages/contracts`) : 9 groupes, code anglais pour l'URL, libellé de la refonte, muscles de 04 §3.5. Chaque muscle est dans un seul groupe ; un exercice apparaît dans le groupe de chacun de ses muscles **principaux**.

| Code | Libellé | Muscles |
|---|---|---|
| `chest` | Pectoraux | `chest` |
| `back` | Dos | `lats`, `traps`, `lower_back` |
| `shoulders` | Épaules | `front_delts`, `side_delts`, `rear_delts`, `rotator_cuff` |
| `arms` | Bras | `biceps`, `triceps`, `forearms` |
| `core` | Abdos | `abs`, `obliques` |
| `glutes` | Fessiers | `glutes` |
| `quads` | Quadriceps | `quadriceps`, `adductors` |
| `hamstrings` | Ischios | `hamstrings` |
| `calves` | Mollets | `calves` |

- Progression (refonte, Task 9) affiche ses 9 rangs à partir de cette constante ; toucher un rang ouvre `/exercises/group/:code`.
- Ces groupes d'affichage sont distincts des groupes de volume de Programmes (05) : la brique 3 garde les siens.
- Une tuile ou un rang pour une URL de groupe inconnue : redirection vers `/exercises`.

### 4.4 Arrivée des relectrices

- **Carte d'accueil** réservée aux relecteurs : « Relecture : N fiches t'attendent » (N = taille de `to_review` pour l'appelant, plus `health_pending` et `revalidate` pour une relectrice santé), qui ouvre la relecture. Elle ne s'affiche qu'en ligne, après une réponse réussie, sans cache ; hors ligne ou si l'appel échoue, elle est absente. Elle disparaît quand N = 0.
- **Entrée permanente** : Profil, groupe « Cercle », ligne « Relecture des exercices » (avec Administration pour l'admin). Garde web : `/review…` répond comme une page introuvable pour un non-relecteur, comme `/admin`.
- **Premier passage** : une feuille du bas « Comment relire », rappelable depuis Aide, explique en une phrase chacun : *version* (chaque modification crée une nouvelle version), *sensible*, *feu vert santé*, *à revalider*, *prête à publier*. L'écran marche aussi sur ordinateur.

### 4.5 Écran de relecture (`/review/exercises`)

- **Liste** : avancement par lot (§3.8) ; filtres « À relire », « Feu vert santé », « À revalider », « Mes commentaires » avec compteurs ; une ligne par fiche avec ses pastilles (sensible et articulation, commentaires ouverts, validée par toi, à revalider, prête à publier). Pour l'admin seulement, en plus : filtres par type de mouvement et « sans illustration », compteur « N fiches à exporter », compteur des fichiers « à remplacer avant publication », bouton « Exporter le catalogue ».
- **Fiche** : aperçu identique à la vue membre, plus les valeurs qui décident de la sensibilité écrites en clair (niveau, « Déconseillé aux mineurs : oui/non », articulations sollicitées). Bouton « Commenter » sur chaque partie ; le libellé de chaque onglet porte le nombre de commentaires ouverts (« Erreurs · 1 commentaire »). Le commentaire se rédige dans une feuille du bas avec le compteur « n / 1000 ». Le brouillon est gardé sur l'appareil jusqu'à l'envoi (une clé locale par compte et par fiche), pour qu'une coupure réseau ne le perde pas ; il est effacé à l'envoi, à la déconnexion et à la suppression du compte. C'est la seule donnée de relecture stockée sur l'appareil.
- **Valider** : feuille du bas de confirmation qui rappelle la version validée ; ensuite, « Fiche suivante » (selon le filtre actif). File vide : « Ta file est vide. Merci ! ».
- **Admin** : en plus, « Modifier » (formulaire de 04 §8, choix des illustrations compris) et « Publier ». « Publier » reste désactivé tant qu'un blocage existe, avec les messages du §3.6 écrits dessous. Sur un 409, l'écran affiche « La fiche a changé depuis que tu l'as ouverte. », la version courante, et la saisie à reporter.

## 5. Production du contenu

1. **Étape 0** (04 §8) : guide de style `docs/catalog/style-guide.md` (dont la limite de 120 caractères par entrée de sécurité), glossaire `data/glossary.json`, puis **deux fiches étalons** écrites à la main et relues par l'admin et les relectrices.
2. **Squelettes du lot A provisoire** (D11, §2), validés par le propriétaire.
3. **Pilote** : l'API Claude rédige 5 fiches variées (au moins une sensible, une sans matériel, une machine, une à chaîne) ; l'admin et les relectrices les relisent ; le prompt et le glossaire sont ajustés (`prompt_version` + 1). Avant le pilote, le modèle par défaut et son coût sont revérifiés et notés dans `scripts/exercises/NOTES.md`.
4. **Suite** (brique 3 et après) : rédaction et relecture du lot A définitif, puis du lot B, puis des lots d'extension.
5. **Charge** : 8 à 10 minutes par fiche (04 §7), 15 à 20 heures pour le cœur, réparties entre les relecteurs ; toutes les fiches sensibles passent par la relectrice santé.
6. **Clé API** : workspace Anthropic de développement, distinct de celui du coach. Aucune donnée personnelle envoyée.
7. **Crédits** (04 §12) : la mention des textes devient « rédigés avec l'aide d'une IA (Claude), relus par l'administrateur et des relectrices, dont une professionnelle de santé pour les exercices sensibles ».

## 6. Données ajoutées (récapitulatif)

- `user` : `catalog_reviewer`, `health_professional` (C0 admin, migration non cassante).
- `exercise` : `batch` (colonne éditoriale).
- Nouvelles tables `exercise_comment`, `exercise_validation`, `exercise_revision` : STRICT, déclarées dans `entityRules` avec classe H, catégorie C0, `ownerColumn: null`, `exported: false` (l'export personnel des commentaires et validations passe par le traitement explicite du §3.9), `onUserDelete: set_null`. Aucune n'est dans l'export du catalogue.
- Événement de sécurité `reviewer_flags_changed`.
- Constantes : `SENSITIVE_JOINTS`, `MUSCLE_GROUPS`, `CATALOG_MAX_SHEETS`, `PUBLISH_BLOCKERS_ORDER`.
- Fonctions pures, testées une seule fois et appelées par le serveur et l'écran : `contentOf`, `isSensitive`, `healthGreenLight`, `transitionBlockers`, `contentDiff`, `reviewQueues`.

## 7. Critères d'acceptation

Les critères de 04 §13 restent exigés, sauf le 9 qui devient : « `GET /api/catalog` ne renvoie ni `draft`, ni `reviewed`, ni brouillon retiré, ni colonne éditoriale (dont `batch`) ; `/review/exercises` et `/api/review/*` refusent un membre ». S'ajoutent :

1. **Droits, par énumération** : un test parcourt toutes les routes enregistrées commençant par `/api/admin/` et attend 403 pour une relectrice et pour un membre ; il parcourt toutes celles de `/api/review/` et attend 403 pour un membre, 401 sans session. Retirer `catalog_reviewer`, ou rétrograder un admin, coupe l'accès dès la requête suivante. Une relectrice qui marque traité le commentaire d'une autre reçoit 403.
2. **Isolation avec repères** : le test crée d'abord un commentaire (`body` repère), une révision (`content` repère), une validation et des drapeaux, puis vérifie qu'aucun repère textuel, ni aucune clé `healthProfessional`, `health`, `reviewer_id` ou `catalogReviewer` d'un autre compte, n'apparaît dans `GET /api/catalog`, le pull de synchro d'un autre membre, l'export du catalogue, l'export personnel d'un autre membre et les réponses destinées à une autre relectrice (pour le drapeau santé et l'auteur des feux verts). `pull-leak.test` couvre les trois tables.
3. **Feu vert** : tableau de cas de `isSensitive` (niveau 2, niveau 3, `not_for_minors`, chacune des 4 articulations, fiche non sensible). Publier une fiche sensible sans feu vert est refusé (`health_validation_missing`, 422). Valider la version N au statut `reviewed`, puis `reviewed → draft → reviewed → published` sans modifier le contenu : accepté. Valider un `draft` : 409 `not_reviewable`. Un admin dont `health_professional` vaut 1 : sa validation n'est pas un feu vert santé. Feu vert donné par l'auteur de la dernière modification : non compté. Drapeau retiré après la validation : non compté. Compte supprimé : non compté.
4. **Admin et drapeau santé** : l'admin ne peut pas cocher `health_professional` sur lui-même (`self_health_flag`) ; tout changement de drapeau exige le mot de passe et écrit `reviewer_flags_changed`.
5. **Blocages** : chaque code du §3.6 a son test ; la liste `blockers` respecte l'ordre fixe ; une base périmée donne 409 sans liste de blocages.
6. **Péremption et différentiel** : modifier le contenu après un feu vert le périme ; le différentiel renvoie exactement les clés de contenu changées (`null` sans validation, `[]` sans changement) ; une fiche publiée modifiée reste servie avec le nouveau contenu, `catalog_version` change, et elle entre dans `revalidate`. Une fiche publiée de niveau 1 passée au niveau 2 entre dans `revalidate`.
7. **Simultanéité** : deux `PUT` lancés ensemble (`Promise.all`) depuis la même `base_revision` donnent un 200 et un 409, dans n'importe quel ordre ; la fiche contient la première saisie seulement. Une validation sur une révision dépassée : 409. Un commentaire sur une révision dépassée : accepté, avec sa révision.
8. **Révisions** : chaque enregistrement et chaque transition crée une ligne ; `content` de la dernière ligne = `contentOf` de la fiche ; aucune ligne ne contient d'identifiant de compte dans `content`.
9. **Suppression et export personnels** : supprimer une relectrice ne laisse son identifiant dans aucune des trois tables (`delete.test`) ; son export contient ses commentaires, ses validations et ses drapeaux.
10. **Chargeur et catalogue** : une nouvelle fiche non `draft` dans les fichiers est refusée sauf sur base vide ; un `draft → retired` n'apparaît jamais dans `GET /api/catalog` ; plafond : 300 fiches acceptées, 301 refusées par `data:validate`, et `retired → reviewed` refusé à 300 (`catalog_full`).
11. **Écrans** (fixture où une tuile change de nombre avec le filtre et une autre passe à 0) : nombres des tuiles et états vides ; encadré Sécurité présent sur les trois onglets ; onglets au clavier selon l'APG et Retour qui revient à la liste ; variantes sans fiche `not_for_minors` en profil prudent ; bandeau d'une fiche non utilisable ouverte par URL ; lien Progression vers le bon groupe ; cibles de 44 px ; une relectrice ne voit ni « Modifier » ni « Publier ».
12. **De bout en bout** (Playwright, Chromium et WebKit) : une relectrice commente, l'admin corrige et marque traité, la relectrice santé valide, l'admin publie, puis un membre ouvre la fiche hors ligne.
13. **Ordres déterministes** : listes triées avec la collation française puis `id` ; commentaires dans l'ordre du §3.3, avec `FakeClock`.

## 8. Risques

- **Relecture plus lente que prévu**, surtout le feu vert santé qui dépend d'une personne. Parades : lot A d'abord, file « Feu vert santé » à traiter d'un coup, lots d'extension sans échéance.
- **Fiche publiée corrigée puis servie avant revalidation** : accepté pour ne pas casser les programmes ; visible (bandeau, file) et limité dans le temps.
- **Barre d'onglets à revoir** à la brique 3 (bouton Séance) et à la brique 5 (Nutrition).
- **Base amorcée sans sauvegarde** : commentaires et validations perdus (§3.6) ; la sauvegarde normale de la base les couvre.
- Les risques de 04 restent valables.

## 9. Plus tard

Suggestions de modification acceptées en un clic ; notifications et e-mails de relecture ; régénération d'une fiche par l'IA depuis l'écran ; bouton « signaler une erreur » pour les membres ; le reste de 04 §14 (vidéos, dessins maison, carte musculaire, cardio, étirements…).
