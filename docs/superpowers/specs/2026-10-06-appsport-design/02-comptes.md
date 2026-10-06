## Comptes, inscription, profil et salles

> Brique 1, le socle : cette section est au niveau de détail complet. Chaque règle porte un numéro (R-…) et sert directement de critère d'acceptation. Les paramètres réglables sont écrits `EN_MAJUSCULES` et rangés dans la configuration du serveur. Les identifiants de code, tables et colonnes sont en anglais (snake_case en base, camelCase en TS) ; les textes affichés sont en français. Catégories de données : **C0** interne (salles visibles de tout le cercle ; métadonnées de compte — pseudo, rôle, état, dates —, invitations et journal de sécurité visibles de l'admin), **C1** personnel, **C2** santé (consentement santé exigé), **C3** sensible (fils du coach, signalements : brique 4). Les secrets d'authentification (colonnes `*_hash`) sont hors catégorie : déclarés dans `secretColumns`, ils ne sont jamais exportés, synchronisés ni journalisés (section Modèle de données).

### 1. Principes

1. **Deux barrières distinctes.** Tailscale filtre les appareils ; l'appli authentifie les personnes. L'appli n'utilise jamais l'identité Tailscale (en-têtes `Tailscale-User-*` ignorés).
2. **Ni e-mail, ni état civil.** L'identifiant est un pseudo, qui sert aussi de nom affiché. L'appli ne collecte ni nom, ni e-mail, ni téléphone, ni adresse, ni photo. La date de naissance est saisie par l'admin.
3. **Santé facultative.** Les données C2 (indicateur de prudence, limitations, douleur, pesées, nutrition) n'existent qu'avec le consentement santé, distinct et révocable. Tout le reste de l'appli fonctionne sans lui.
4. **Le serveur fait foi** pour le compte, le profil, les lieux et les salles. En v1, les modifier demande le réseau (appels API directs, hors file de synchro). Hors ligne, ces données restent lisibles depuis le cache local, en lecture seule. La saisie hors ligne des séances relève de la brique 3 et de la synchro générique.
5. **L'âge est calculé, jamais stocké.** Une seule fonction le calcule ; les autres briques ne lisent que la tranche d'âge.
6. **L'admin administre, il ne consulte pas.** Aucune route admin ne renvoie de donnée C1, C2 ou C3 d'un autre utilisateur, à la seule exception de `coach_report` (échange signalé par la personne, brique 4). La page Confidentialité dit que l'exploitant du serveur peut techniquement lire la base.

### 2. Rôles

| Rôle | Qui | Droits |
|---|---|---|
| `member` | chaque proche | son compte, son profil, ses lieux ; créer une salle ; modifier les salles qu'il a parmi ses lieux actifs |
| `admin` | le porteur (au moins une personne) | droits d'un membre, plus : invitations, liens de réinitialisation, désactivation, suppression, promotion et rétrogradation, correction de date de naissance, modification et suppression de n'importe quelle salle, relecture des fiches d'exercices (brique 2) |

- **R-ROLE-1** Un admin est aussi un utilisateur ordinaire, avec son propre profil.
- **R-ROLE-2** Il reste toujours au moins un admin actif : on ne peut ni rétrograder, ni désactiver, ni supprimer le dernier.
- **R-ROLE-3** Pas de rôle « relecteur » en v1.
- **R-ROLE-4** Le serveur vérifie les droits à chaque requête ; l'interface ne fait que masquer.
- **R-ROLE-5 Amorçage.** Commande serveur `admin:bootstrap --birth-date AAAA-MM-JJ` (via Tailscale SSH) : affiche une invitation admin (lien et code) à usage unique, valable 24 h. Refusée s'il existe déjà un admin. Secours : `admin:reset <pseudo>` affiche un lien de réinitialisation, pour un admin qui a perdu son mot de passe.

### 3. Arrivée d'un proche

#### 3.1 Prérequis réseau (détail dans la section Exploitation)

1. Le proche, y compris s'il a 16 ou 17 ans, crée **son propre** compte Tailscale et l'installe sur son téléphone.
2. L'admin partage la machine `appsport` avec lui (utilisateurs du partage limités au port 443) ; le proche accepte.
3. Le proche ouvre `https://appsport.<tailnet>.ts.net` et **installe l'appli** (iPhone : Partager → Sur l'écran d'accueil ; Android : Installer l'application).
4. Il ouvre l'appli installée et colle le lien ou tape le code d'invitation.

L'appli est installée avant toute création de compte : sur iPhone, le stockage de Safari et celui de l'appli installée sont séparés ; cet ordre évite toute reconnexion et toute perte.

#### 3.2 Invitation

- **R-INV-1** Seul un admin crée une invitation. Champs : **date de naissance complète** (obligatoire) et note libre facultative (« pour Léa », 60 caractères au plus). Le rôle attribué est toujours `member`, sauf pour l'invitation d'amorçage (R-ROLE-5, `is_admin_bootstrap`). Le pseudo n'est pas choisi par l'admin : le proche le saisit à la création du compte (§3.4).
- **R-INV-2 Âge.** La création est refusée si l'âge calculé (R-AGE-1) est inférieur à `MIN_AGE` = 16 (constante de `packages/contracts`). Message : « appsport est réservé aux 16 ans et plus ».
- **R-INV-3 Secret.** Un seul secret sert de code et de lien : 16 caractères en base32 de Crockford (80 bits, générateur cryptographique), affichés en `XXXX-XXXX-XXXX-XXXX`. Le serveur ne stocke que son empreinte SHA-256. Le code n'est affiché qu'une fois, à la création, avec Copier et Partager.
- **R-INV-4 Lien.** `https://appsport.<tailnet>.ts.net/invite#<code>`. Dans le fragment, le code n'apparaît ni dans les journaux d'accès ni dans le Referer ; la page l'envoie dans le corps d'une requête.
- **R-INV-5 Saisie tolérante.** Le champ accepte le lien complet ou le code ; il ignore casse, espaces et tirets, et lit I/L comme 1 et O comme 0.
- **R-INV-6 Validité.** `INVITATION_TTL_DAYS` = 7. Usage unique : consommer l'invitation et créer le compte se font dans la même transaction ; de deux soumissions simultanées, une seule réussit, l'autre reçoit « déjà utilisée ».
- **R-INV-7 États.** `pending`, `used`, `revoked`, et `expired` calculé (en attente et date d'expiration passée). L'admin peut révoquer une invitation en attente, avec effet immédiat. La date de naissance est effacée de l'invitation dès qu'elle quitte l'état en attente : à l'usage (R-CPT-2), à la révocation, ou à l'expiration (purge quotidienne du serveur). L'écran liste note, dates, état et pseudo créé.
- **R-INV-8 Code invalide.** Message selon le cas (expirée, déjà utilisée, révoquée, inconnue), terminé par « Demande un nouveau code à l'administrateur ». Vérification limitée à 20 essais par heure et par adresse IP du tailnet.
- **R-INV-9 Message de partage proposé.** « 1. Installe Tailscale et accepte le partage. 2. Ouvre https://appsport.<tailnet>.ts.net et installe l'appli. 3. Dans l'appli, colle ce lien ou tape le code <code> (valable 7 jours). »

#### 3.3 Ouverture du lien

- **R-ARR-1** Dans l'appli installée (mode `standalone`), le lien ou le code mène directement à la création du compte.
- **R-ARR-2** Dans un navigateur (mode non installé), la page n'ouvre pas la création : elle affiche l'aide à l'installation propre au système, le code en clair avec un bouton Copier, et un lien secondaire « Continuer dans ce navigateur » (usage sur ordinateur), accompagné de l'avertissement « sur téléphone, tes données ne seront pas dans l'appli installée ».

#### 3.4 Création du compte

Un seul écran, réseau obligatoire.

| Champ | Règle |
|---|---|
| Pseudo | 3 à 24 caractères : lettres (accents admis), chiffres, `.`, `_`, `-`. Unique sans tenir compte de la casse (comparaison après NFKC et minuscules). Réservés : `admin`, `appsport`, `systeme` |
| Mot de passe et confirmation | §4 |
| Date de naissance | affichée en lecture seule : « Renseignée par l'administrateur. Une erreur ? Préviens-le. » |
| « J'ai lu la page Confidentialité et règles » | case obligatoire avec lien ; la version du texte acceptée est enregistrée |

- **R-CPT-1** Le compte n'est créé que si tout est valide ; un échec ne laisse aucune donnée et ne consomme pas l'invitation.
- **R-CPT-2** À la création : la date de naissance est copiée de l'invitation vers le compte puis effacée de l'invitation ; la session s'ouvre ; l'appli demande `navigator.storage.persist()` ; l'onboarding démarre.
- **R-CPT-3** Le pseudo se change ensuite dans le Profil, selon les mêmes règles. La date de naissance n'est modifiable que par un admin (R-AGE-4). Chaque changement est journalisé.

### 4. Mots de passe et connexion

Référence : CNIL 2022-100, cas n° 2 (au moins 50 bits avec restriction d'accès).

- **R-MDP-1** 12 à 128 caractères (points de code après NFC) ; 14 au moins pour un admin. La longueur d'un admin est contrôlée à chaque connexion : un admin promu dont le mot de passe fait moins de 14 caractères doit le changer avant d'accéder à l'appli.
- **R-MDP-2** Aucune règle de composition ; espaces acceptés ; l'appli suggère une phrase de passe de 4 mots ou plus.
- **R-MDP-3** Refus si le mot de passe figure dans une liste embarquée d'environ 10 000 mots de passe courants (insensible à la casse), s'il contient le pseudo ou « appsport », ou s'il répète un seul caractère.
- **R-MDP-4** Argon2id natif (`crypto.argon2`), sel aléatoire ≥ 16 octets, paramètres ≥ m = 19 Mio, t = 2, p = 1, stockés avec l'empreinte. Si les paramètres sont durcis, le mot de passe est ré-haché à la connexion suivante.
- **R-MDP-5** Aucun renouvellement imposé ; pour un admin, rappel non bloquant au bout de 12 mois.
- **R-MDP-6** Changer son mot de passe exige l'actuel et ferme toutes les autres sessions.

**Connexion**
- **R-AUTH-1** Pseudo et mot de passe. Échec : toujours « Pseudo ou mot de passe incorrect ».
- **R-AUTH-2 Restriction par pseudo normalisé**, même inexistant : à partir du 5e échec consécutif, attente de 1 min doublée à chaque échec (15 min au plus) ; au 10e échec sur une heure glissante, refus pendant 1 h à compter de ce 10e échec ; un succès remet le compteur consécutif à zéro ; un lien de réinitialisation débloque immédiatement.
- **R-AUTH-3** Au plus 30 échecs par heure par adresse IP du tailnet, tous pseudos confondus.
- **R-AUTH-4** Les compteurs sont en mémoire : un redémarrage les remet à zéro (accepté, redémarrages manuels et rares).
- **R-AUTH-5** Compte désactivé : « Compte désactivé, contacte l'administrateur », affiché seulement après un mot de passe correct.
- **R-AUTH-6 Session.** Jeton opaque de 32 octets dans le cookie `__Host-session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`) ; seule l'empreinte est stockée ; nouvelle session à chaque connexion ; expiration après 90 jours sans activité et au plus tard à 365 jours ; contrôle de l'en-tête `Origin` sur toute requête qui modifie des données.
- **R-AUTH-7** Profil : « Déconnecter tous mes appareils ». L'admin peut fermer toutes les sessions d'un membre (téléphone perdu).
- **R-AUTH-8 Session expirée ou fermée.** Les données locales non envoyées restent sur l'appareil et partent à la reconnexion du même utilisateur. Si un autre pseudo se connecte, l'appli prévient d'abord : « N éléments non envoyés de <pseudo> seront effacés de cet appareil ».
- **R-AUTH-9 Déconnexion volontaire.** S'il reste des données non envoyées, même avertissement, avec « Annuler » et « Se déconnecter quand même ». Une fois la déconnexion confirmée (ou s'il n'y avait rien en attente), les données locales de l'utilisateur sont effacées.

### 5. Réinitialisation et désactivation

Parcours : le membre prévient l'admin hors de l'appli → Admin › Membres › « Générer un lien de réinitialisation » → lien et code affichés une fois, transmis hors de l'appli → le membre les ouvre ou les saisit dans l'appli, choisit un nouveau mot de passe → toutes ses sessions sont fermées, puis il est connecté.

- **R-RST-1** Même format de secret que l'invitation (R-INV-3 à R-INV-5), lien `…/reset#<code>`.
- **R-RST-2** Valable 24 h, usage unique. En générer un nouveau annule le précédent ; un changement de mot de passe par une autre voie aussi.
- **R-RST-3** L'admin ne voit ni ne choisit jamais le mot de passe ; pas de mot de passe temporaire.
- **R-RST-4** Un admin ne peut pas générer de lien pour lui-même : il utilise `admin:reset`.
- **R-ADM-1 Désactivation.** Connexion impossible, sessions fermées, données conservées, réversible. Pour un départ, l'admin retire aussi le partage Tailscale.

### 6. Écran d'administration

- **Membres** : pseudo, rôle, statut, badge « mineur », dernière connexion, onboarding terminé ou non. Actions : lien de réinitialisation, fermeture des sessions, désactivation et réactivation, promotion et rétrogradation, correction de la date de naissance, suppression.
- **Invitations** : création (date de naissance, note), liste, révocation.
- **Salles** : liste, modification, suppression d'une salle inutilisée.
- **Fiches** : relecture et publication (brique 2).
- **État du serveur** : page « santé » définie par la section Exploitation (§9 Supervision légère).

### 7. Âge et mineurs

- **R-AGE-1** L'âge est le nombre d'années révolues entre la date de naissance et la date du jour à l'heure de Paris. Une personne née un 29 février prend un an le 1er mars les années non bissextiles. Une seule fonction pure, `ageOn(birthDate, today)`, dans `packages/domain`.
- **R-AGE-2** Tranches : `minor` (16 ou 17 ans) et `adult`. Le serveur calcule `ageBand` à chaque requête et l'envoie avec le profil ; le client le garde en cache pour le hors-ligne. Aucune tâche planifiée : le passage à 18 ans s'applique à la première requête qui suit.
- **R-AGE-3** Les autres briques reçoivent `ageBand` (et `cautious`, §12) en paramètres et ne lisent jamais la date de naissance.
- **R-AGE-4** Correction par l'admin : refusée si l'âge résultant est inférieur à `MIN_AGE` (l'admin désactive ou supprime alors le compte). Journalisée.
- **R-AGE-5** Aucun circuit d'accord parental : à 16 ans et plus, le mineur consent seul (art. 45 de la loi Informatique et Libertés : seuil de 15 ans).

| Domaine | 16-17 ans | Spec détaillée |
|---|---|---|
| Objectif « Perdre du gras » | non proposé | ici (E1) |
| Visibilité « qui va à cette salle » | désactivée par défaut | §10.6 |
| Programmes | profil prudent imposé ; tous les modèles accessibles ; exercices « déconseillés aux mineurs » exclus | Programmes |
| Nutrition | mode qualitatif obligatoire : ni taille, ni poids, ni cible chiffrée, ni déficit | Nutrition |
| Coach IA | ouvert, avec les garde-fous Anthropic pour les mineurs (modération, bouton « Signaler », consignes dédiées) | Coach |

- **R-AGE-6** À 18 ans, les restrictions tombent mais rien ne s'active tout seul : un message unique liste ce qu'on peut désormais activer (objectif « Perdre du gras », nutrition chiffrée). Les réglages de visibilité et le mode prudent manuel restent tels quels.

### 8. Onboarding

- **R-ONB-1** Démarre après la création du compte, tant que `onboarding_completed_at` est vide. Exige le réseau.
- **R-ONB-2** Chaque écran est enregistré au clic sur « Suivant » ; reprise au premier écran incomplet ; retour arrière possible ; indicateur « étape n/N ».
- **R-ONB-3** Toutes les réponses se modifient ensuite dans le Profil, avec les mêmes écrans.
- **R-ONB-4** Objectif : moins de 2 minutes hors écran Santé.

| # | Écran | Contenu | Statut |
|---|---|---|---|
| E1 | Objectif | un choix : Prendre du muscle · Gagner en force · Perdre du gras (masqué pour les mineurs) · Forme et santé · Me renforcer pour mon sport | obligatoire |
| E2 | Autre sport | « Pratiques-tu un autre sport régulièrement ? » Non · Oui → un sport dans la liste | obligatoire ; « Oui » imposé si E1 = Me renforcer pour mon sport |
| E3 | Lieu principal | « Où t'entraîneras-tu le plus souvent ? » À la salle · À la maison | obligatoire |
| E4 | Ma salle **ou** Ma maison | salle : choisir ou créer (§10.4) et régler la visibilité ; maison : préréglage puis liste de matériel (§10.2) | obligatoire |
| E5 | Niveau | « Depuis combien de temps fais-tu de la musculation régulièrement (au moins une fois par semaine) ? » Jamais · Moins de 6 mois · 6 mois à 2 ans · Plus de 2 ans | obligatoire |
| E6 | Disponibilité | séances par semaine : 2, 3 ou 4 ; durée : 30, 45, 60, 75 ou 90 min | obligatoire |
| E7 | Santé et prudence | §12 | facultatif |
| E8 | C'est prêt | récapitulatif ; voyant « Prêt hors ligne » ; à partir de la brique 3, programme recommandé (§9) | — |

**Règles par écran**
- **E2.** Liste versionnée : course à pied, vélo, natation, football, rugby, basket, handball, tennis, padel, badminton, sports de combat, escalade, ski, danse, Autre (texte libre de 40 caractères au plus). Un seul sport en v1.
- **E3/E4.** L'onboarding crée un seul lieu, marqué principal. Les autres lieux s'ajoutent dans Profil › Lieux. Le contexte principal de l'utilisateur est le type de son lieu principal ; il n'est pas stocké ailleurs.
- **E4 maison.** Nom « Maison » par défaut, modifiable.
- **E8.** « Commencer » termine l'onboarding (`onboarding_completed_at`) une fois le voyant « Prêt hors ligne » au vert : coquille précachée par le service worker, données de l'utilisateur reçues (première synchro réussie), catalogue chargé et toutes les illustrations référencées en cache (section Exercices §11, R-SYN-33). Sinon, bouton « Réessayer ».

### 9. Choix du modèle de programme

Fonction pure `recommendTemplate(input, templates)` dans `packages/domain`, utilisée par la brique 3 (écran E8 et Profil). Les identifiants et bornes des modèles sont ceux de la section Programmes (3 contextes × 2 niveaux, tous dans le premier lot).

Entrée : `goal`, `sportCode`, `primaryPlaceKind` (`gym` | `home`), `experience`, `daysPerWeek`, et pour chaque modèle `{id, context, level, days {min, max}, available}`.
Sortie : `{templateId | null, context, level, daysPerWeek, reasons[]}`.

- **R-REC-1 Contexte.** `sport` si `goal = sport_support` et `sportCode` non vide ; sinon `gym` ou `home` selon le lieu principal.
- **R-REC-2 Niveau.** `none` ou `lt_6_months` → `beginner` ; `6_to_24_months` ou `gt_24_months` → `intermediate`.
- **R-REC-3 Peu de jours.** Si le niveau est `intermediate` et que `daysPerWeek` est sous le minimum du modèle intermédiaire du contexte, on prend le modèle débutant du même contexte (corps entier), raison `FEW_DAYS_FULL_BODY`.
- **R-REC-4 Disponibilité.** Si le modèle retenu est marqué indisponible, on prend l'autre niveau du même contexte ; si aucun n'est disponible, `templateId = null`, raison `NO_TEMPLATE_AVAILABLE` (l'appli propose la séance libre).
- **R-REC-5 Jours.** `daysPerWeek` est ramené dans [min, max] du modèle retenu, raison `DAYS_ADJUSTED` s'il change. Le choix de l'utilisateur dans le profil n'est pas modifié.
- **R-REC-6** La fonction ignore l'âge et le mode prudent : le profil prudent s'applique au moteur, pas au choix du modèle.
- **R-REC-7** La recommandation est une proposition : l'utilisateur peut choisir un autre modèle (brique 3). Quand un champ d'entrée change dans le Profil, l'appli propose le nouveau modèle sans jamais changer d'inscription d'elle-même.
- **R-REC-8** En v1, l'objectif n'influe que sur le contexte `sport`. Il est aussi transmis au coach et sert de présélection à l'objectif nutrition (section Nutrition).

### 10. Salles et lieux

#### 10.1 Notions

- **Salle** (`gym`, C0) : entité partagée, visible de tous les membres. Nom, ville, matériel, réglages de charge, historique.
- **Lieu** (`place`, C1) : endroit où un utilisateur s'entraîne. Soit une salle (par référence), soit une maison, privée, avec son propre matériel et ses réglages de charge. Un seul lieu est principal.

#### 10.2 Matériel

- **R-MAT-1** Une seule taxonomie du matériel, constante du code partagé, **tenue par la section Exercices** ; salles, maisons et fiches utilisent les mêmes codes. Pas de cardio en v1. Le sol et le mur ne sont pas des matériels.
- **R-MAT-2** Les préréglages ci-dessous sont des constantes placées à côté de la taxonomie ; ils servent seulement à pré-cocher et ne sont pas stockés. Un test vérifie que chaque code cité existe.

| Préréglage | Pré-coché |
|---|---|
| Salle · Grande salle ou chaîne | tout le matériel, sauf les objets de maison (chaise, table) |
| Salle · Petite salle de quartier | haltères, barre et disques, barre EZ, banc plat, banc inclinable, rack, poulie, tirage vertical, tirage horizontal, presse à cuisses, barre de traction, station de dips |
| Salle · Box de cross-training | barre et disques, rack, haltères, kettlebell, banc plat, barre de traction, sangles ou anneaux, box, élastiques |
| Salle · Autre | rien |
| Maison · Sans matériel (défaut) | chaise, table |
| Maison · Petit matériel | chaise, table, barre de traction, élastiques, haltères |
| Maison · Home gym | chaise, table, barre de traction, élastiques, haltères, kettlebell, barre et disques, rack, banc plat |

- **R-MAT-3** Retirer un matériel n'efface aucune donnée d'entraînement ; la brique 3 propose un remplacement à la séance suivante.

#### 10.3 Réglages de charge

Champ `load_settings` (JSON validé par Zod, valeurs en grammes) sur la salle et sur le lieu maison. Il sert à l'arrondi des charges (section Programmes). Le socle livre le champ, les valeurs par défaut et l'API ; l'écran d'édition arrive avec la brique 3.

| Clé | Rôle | Bornes | Défaut salle | Défaut maison |
|---|---|---|---|---|
| `barG` | poids de la barre | 5 000 à 25 000 | 20 000 | 20 000 |
| `smallestPlateG` | plus petit disque | 250 à 5 000 | 1 250 | 1 250 |
| `dumbbellsG` | charges d'haltères disponibles, par haltère, croissantes, sans doublon, 60 au plus | 500 à 80 000 chacune | 2 000 à 40 000 par pas de 2 000 | vide |
| `machineStepG` | pas des machines et poulies | 500 à 10 000 | 5 000 | 5 000 |

- **R-CHG-1** Les valeurs par défaut sont posées à la création ; elles ne sont jamais nulles.
- **R-CHG-2** Seules les clés utiles au matériel présent sont lues par le moteur (une barre sans « barre et disques » n'est pas utilisée).
- **R-CHG-3** Sur une salle, les réglages suivent les droits et l'historique du §10.4. Un lieu de type salle n'a pas de réglages propres.

#### 10.4 Créer, choisir, modifier une salle

- **R-SAL-1** L'écran « Ta salle » liste les salles (nom, ville, nombre de membres visibles) avec une recherche, et propose « Ma salle n'est pas dans la liste ».
- **R-SAL-2 Création.** Nom (2 à 60 caractères, l'enseigne peut y figurer) et ville (2 à 60), puis préréglage, puis validation de la liste pré-cochée. La salle est ajoutée aux lieux du créateur.
- **R-SAL-3 Doublons.** Avant création, l'appli montre les salles dont le nom ou la ville se ressemblent après normalisation (minuscules, sans accents ni ponctuation, recherche par inclusion). Le couple (nom normalisé, ville normalisée) est unique.
- **R-SAL-4 Droits.** Modifient une salle : les membres qui l'ont parmi leurs lieux actifs, et les admins.
- **R-SAL-5 Concurrence.** Nom, ville et réglages de charge : la dernière écriture gagne. Matériel : opérations « ajouter X » et « retirer X », idempotentes, sur une ligne par (salle, code) ; deux ajouts simultanés donnent l'union.
- **R-SAL-6 Historique.** Chaque modification ajoute une ligne (qui, quand, quoi). La fiche affiche les 10 dernières, avec « modifié par <pseudo> » ; un compte supprimé apparaît comme « ancien membre ».
- **R-SAL-7** Seul un admin supprime une salle, et seulement si aucun lieu actif n'y renvoie. La salle est marquée supprimée (`deleted_at`), pas effacée : les lieux supprimés et les séances passées y restent rattachés.

#### 10.5 Les lieux d'un utilisateur

- **R-LIEU-1** Après l'onboarding, chaque utilisateur a au moins un lieu actif ; le dernier ne peut pas être supprimé.
- **R-LIEU-2** Un seul lieu actif par salle et par utilisateur. Un lieu de type salle utilise le matériel et les réglages de la salle, sans ajout personnel en v1.
- **R-LIEU-3** Un lieu maison a un nom libre (30 caractères au plus, « Maison » par défaut), son matériel et ses réglages ; il est invisible des autres. On peut en avoir plusieurs.
- **R-LIEU-4** Exactement un lieu actif est principal. Supprimer le lieu principal oblige à en désigner un autre. Le lieu du jour se choisit en début de séance (brique 3), le principal par défaut.
- **R-LIEU-5** Supprimer un lieu le marque supprimé sans l'effacer : les séances passées y restent rattachées.

#### 10.6 Qui va à cette salle

- **R-VIS-1** La fiche d'une salle liste les pseudos des comptes actifs qui l'ont comme lieu actif visible, et rien d'autre : ni horaires, ni fréquence, ni séances.
- **R-VIS-2** Liste visible de tous les membres connectés.
- **R-VIS-3** Réglage lieu par lieu, au choix de la salle puis dans Profil › Lieux. Défaut : visible pour un majeur, invisible pour un mineur.
- **R-VIS-4** Les personnes invisibles ne sont ni listées ni comptées.
- **R-VIS-5** Un compte désactivé ou supprimé n'apparaît plus.

### 11. Écran Profil

- **Compte** : pseudo, date de naissance (lecture seule), mot de passe, « Déconnecter tous mes appareils ».
- **Entraînement** : objectif, sport, niveau, disponibilité, mode prudent.
- **Lieux** : ajouter, renommer, choisir le principal, régler la visibilité, modifier le matériel, supprimer.
- **Santé** : consentement, questionnaire d'alerte, limitations.
- **Confidentialité** : texte en vigueur, consentements et retrait, export, suppression du compte.

### 12. Consentement santé et mode prudent

- **R-CST-1** Deux types de consentement : `health` (ici) et `ai_coach` (recueilli par la brique 4). Chacun est lié à la version du texte affiché, versionné dans le dépôt, et enregistré dans un journal en ajout seul ; l'état courant est le dernier événement par type.
- **R-CST-2** Chaque consentement a sa propre case, jamais pré-cochée, distincte de l'acceptation de la page Confidentialité.
- **R-CST-3** Le consentement `health` couvre toutes les données C2 : indicateur de prudence, limitations, douleur (brique 3), pesées et nutrition (brique 5).
- **R-CST-4** Sans consentement `health` actif, toute écriture par l'API en ligne d'une table C2 (`health_screening`, `limitation`) reçoit `403`, et les champs C2 sont absents des réponses. Une colonne C2 arrivée par la synchro (douleur d'une séance) n'est jamais rejetée : le serveur la met à NULL et répond `applied_partial` (section Architecture, R-SYN-9).
- **R-CST-5 Retrait**, en un bouton dans Profil › Confidentialité, après une confirmation qui liste ce qui sera effacé et propose un export : effacement immédiat de toutes les données C2 de l'utilisateur (chaque brique déclare les siennes, §13). Les lignes des tables C2 sont vidées : il reste seulement une tombstone sans contenu (`id`, `owner_id`, `rev`, `deleted_at`), propagée par pull puis purgée après `TOMBSTONE_TTL` ; les colonnes C2 (champs douleur des séances) sont mises à vide, sans recalcul rétroactif ; le client purge ses copies locales. Le mode prudent manuel (C1) est conservé.
- **R-CST-6** Si un texte change de version majeure, le consentement est redemandé à l'ouverture suivante ; un refus vaut retrait.

**Écran E7 (et Profil › Santé)**
1. Explication : données de santé ; servent seulement à adapter les séances ; restent sur le serveur du cercle ; ne vont au coach qu'avec son propre consentement en plus ; supprimables à tout moment. Boutons « J'accepte et je renseigne » ou « Passer ».
2. **Avec consentement** : 4 questions oui/non inspirées du PAR-Q+ (problème cardiaque connu ou activité sous surveillance médicale ; douleur thoracique à l'effort ou perte de connaissance dans les 12 derniers mois ; maladie ou traitement qui limite l'activité ; problème d'os, d'articulation ou de muscle aggravé par l'effort ; ces 4 thèmes sont figés, le libellé exact est relu par l'admin avant la mise en service et versionné avec le questionnaire). Un seul « oui » affiche une recommandation de consulter un médecin et met `caution = true`. Seuls l'indicateur, la version du questionnaire et la date sont enregistrés, jamais les réponses.
3. Puis limitations, facultatives (« Aucune » pour passer) : zone (épaule, coude, poignet ou main, cou, haut du dos, bas du dos, hanche, genou, cheville ou pied, autre), côté (gauche, droite, les deux, sans objet), gêne (légère, ou forte : « m'empêche certains mouvements »), note de 200 caractères au plus ; mention « aucun diagnostic n'est nécessaire ».
4. **Sans consentement** : les mêmes questions s'affichent comme auto-vérification non enregistrée (« Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer »), suivies de la proposition d'activer le mode prudent.
5. **Mode prudent**, proposé à tous sur cet écran : interrupteur « Je préfère une progression plus prudente » (`cautious_mode`, C1, pas une donnée de santé). Pour un mineur, il est affiché comme imposé jusqu'à 18 ans.

- **R-CST-7** Le profil prudent du moteur vaut `ageBand = minor` OU `cautious_mode` OU `caution` (si le consentement est actif). Le socle expose ce booléen calculé, `cautious`.
- **R-CST-8** Sans consentement, le bouton douleur de la séance affiche le conseil de sécurité et agit sur la séance suivante sans stocker aucune trace de douleur : il écrit seulement `performed_exercise.next_adjustment` (`hold` | `lighten`, C1) (règle détaillée par la section Programmes).

### 13. Export et suppression

- **R-REG-1 Registre.** Toute table qui porte un `owner_id` ou un `user_id` est déclarée dans le registre unique `entityRules` de `packages/contracts` (section Modèle de données) : catégorie (C0 à C3), colonnes C2 (`c2Columns`, purgées au retrait du consentement `health` avec les tables C2), colonnes secrètes (`secretColumns`), inclusion dans l'export (`exported`), règle de suppression (`onUserDelete`). Un test parcourt le schéma et échoue si une table liée à un utilisateur n'est pas déclarée.
- **R-EXP-1** Profil › Confidentialité › « Télécharger mes données » : fichier JSON au format versionné `appsport-export/1`, produit immédiatement, réseau nécessaire. L'appli avertit si des éléments locaux ne sont pas encore envoyés.
- **R-EXP-2** Contenu : compte (sans empreinte de mot de passe ni sessions), profil, lieux, salles concernées et modifications faites par l'utilisateur, historique des consentements, données C2, puis ce qu'ajoute chaque brique. L'export est journalisé, sans son contenu.
- **R-SUP-1 Par l'utilisateur** : export proposé, liste de ce qui sera supprimé, saisie du mot de passe, confirmation « Supprimer définitivement ».
- **R-SUP-2 Par un admin**, sur demande : saisie du pseudo pour confirmer.
- **R-SUP-3** Suppression immédiate et définitive, en une transaction : toutes les lignes de l'utilisateur et ses liens de réinitialisation. Ses sessions sont révoquées et détachées du compte (`user_id` à NULL, `revoked_reason = account_deleted`), ce qui permet la réponse `410` de R-SUP-5. Les salles restent ; l'utilisateur y devient « ancien membre » (auteur à null). L'invitation utilisée perd son lien vers le compte.
- **R-SUP-4** Le dernier admin ne peut pas supprimer son compte.
- **R-SUP-5** L'appareil qui supprime efface ses données locales ; tout autre appareil du compte reçoit `410 account_deleted` à sa requête suivante et efface les siennes.
- **R-SUP-6** Subsistent, et la page Confidentialité le dit : le journal de sécurité (12 mois) et les sauvegardes (30 jours au plus). L'événement `account_deleted` du journal sert à la procédure de restauration (section Exploitation, P4 ; section Vie privée), qui réapplique les suppressions intervenues après la date de la sauvegarde restaurée.

### 14. Journal de sécurité et page Confidentialité

- **Journal** (`security_event`) : connexions réussies et échouées, blocages, changements de mot de passe, liens de réinitialisation créés et utilisés, invitations créées, révoquées et utilisées, changements de rôle, désactivations, fermetures de sessions, corrections de date de naissance, consentements donnés et retirés, exports, suppressions de compte et de salle. Champs : horodatage, type (dont `account_deleted` et `consent_revoked`), acteur, cible, IP du tailnet, résultat, détails. Jamais de mot de passe, de code, de jeton ni de donnée C2. Conservation 12 mois ; consultation sur le serveur uniquement.
- **Page « Confidentialité et règles »**, versionnée : responsable (le porteur) et contact ; données collectées et finalités ; lieu (serveur à domicile, accès par Tailscale) ; accès technique de l'exploitant ; durées de conservation (y compris sauvegardes et journal) ; droits et leur exercice dans l'appli ; règles pour les 16-17 ans ; « pas un avis médical » ; coach IA et traitement hors UE (brique 4).

### 15. Tests d'acceptation clés

1. Invitation avec une date de naissance donnant 15 ans et 364 jours : refusée ; le jour des 16 ans : acceptée.
2. Une invitation utilisée, révoquée ou expirée ne crée pas de compte ; deux soumissions simultanées du même code créent un seul compte ; un échec de validation ne consomme pas l'invitation.
3. Le code est accepté en minuscules, avec ou sans tirets, avec O à la place de 0 ; le lien complet collé fonctionne aussi.
4. Ni le code ni le jeton de session ne sont stockés en clair ni écrits dans un journal.
5. Hors mode installé, le lien d'invitation affiche l'aide à l'installation et ne propose pas la création directe.
6. Mot de passe de 11 caractères : refusé ; 12 minuscules hors liste : accepté ; présent dans la liste ou contenant le pseudo : refusé ; 13 caractères pour un admin : refusé.
7. 5e échec : attente de 1 min ; 10e dans l'heure : refus ; une heure après : possible. Un pseudo inexistant suit les mêmes règles.
8. Un lien de réinitialisation sert une fois, en 24 h ; après usage, toutes les sessions sont fermées.
9. Impossible de rétrograder, désactiver ou supprimer le dernier admin.
10. `ageOn` : veille et jour de l'anniversaire ; né un 29 février, année non bissextile (28 février : pas encore ; 1er mars : oui) ; passage de `minor` à `adult` le jour des 18 ans à l'heure de Paris.
11. Un mineur ne voit pas « Perdre du gras » ; son lieu de type salle est créé invisible ; `cautious` vaut vrai même sans mode prudent ni consentement.
12. `recommendTemplate` : table exhaustive (5 objectifs × sport oui/non × 2 types de lieu × 4 niveaux × 3 jours = 240 cas) ; propriétés : les jours renvoyés sont toujours dans les bornes du modèle ; contexte `sport` si et seulement si objectif sport et sport renseigné ; même entrée, même sortie.
13. Sans consentement `health`, l'écriture d'une limitation ou de l'indicateur de prudence reçoit `403` ; le retrait vide toutes les lignes C2 (seules restent des tombstones sans contenu) et les colonnes C2, et laisse `cautious_mode` intact.
14. Une session admin qui demande une ressource C1, C2 ou C3 d'un autre utilisateur reçoit `404`, à la seule exception de `coach_report` (échange signalé par la personne).
15. Un membre qui n'a pas la salle parmi ses lieux ne peut pas la modifier ; un admin le peut. Deux ajouts simultanés de matériel donnent l'union.
16. Une salle et une maison créées ont des `load_settings` complets aux valeurs par défaut ; une valeur hors bornes est refusée.
17. Un compte invisible n'est ni listé ni compté sur la fiche de la salle.
18. Après suppression d'un compte : aucune ligne ne référence son `user_id` hors du journal de sécurité ; l'historique de salle affiche « ancien membre » ; un autre appareil du compte reçoit `410`.
19. Test de registre (R-REG-1) : chaque table liée à un utilisateur est couverte par l'export et la suppression.

### 16. Modèle de données

Identifiants UUIDv7. Horodatages en UTC ; dates civiles et âge à l'heure de Paris. Tables SQLite `STRICT`. Types, colonnes `+SYNC` (`owner_id`, `rev`, `created_at`, `updated_at`, `updated_by`, `deleted_at`) et classes de synchro (E, H…) : voir la section Modèle de données, qui détaille chaque colonne. « secret » = colonne listée dans `secretColumns`.

```
user (C0 : métadonnées de compte visibles de l'admin ; E : sa propre ligne)
  id, username, username_key UNIQUE, password_hash (secret, Argon2id au format PHC, paramètres inclus),
  role {admin|member}, status {active|disabled}, birth_date (AAAA-MM-JJ),
  terms_version, terms_accepted_at, last_login_at, password_changed_at,
  onboarding_step, onboarding_completed_at, invitation_id -> invitation (ON DELETE SET NULL),
  rev, created_at, updated_at, updated_by
  Calculés, non stockés : age, age_band {minor|adult}, cautious

invitation (C0, H)
  id, code_hash UNIQUE (secret), note, birth_date (effacée hors de l'état en attente, R-INV-7), is_admin_bootstrap,
  created_by -> user (null pour l'amorçage), created_at, expires_at,
  used_at, used_by -> user (null si compte supprimé), revoked_at
  État calculé : pending | used | revoked | expired

password_reset (C1, H)
  id, user_id, code_hash UNIQUE (secret), created_by (null = commande serveur), created_at, expires_at, used_at, cancelled_at

session (C1, H)
  id, token_hash UNIQUE (secret), user_id (NULL après suppression du compte : réponse 410 account_deleted),
  created_at, last_seen_at, expires_at (+365 j), revoked_at,
  revoked_reason {logout|logout_all|password_change|password_reset|admin|account_deleted}

consent_event (C1, E, ajout seul)
  id, owner_id, type {health|ai_coach}, action {grant|withdraw}, text_version,
  rev, created_at (= instant de l'événement), updated_at, updated_by ; pas de deleted_at

training_profile (C1, E, 1-1 avec user : id = owner_id)
  +SYNC, goal {muscle|strength|fat_loss|fitness|sport_support},
  experience {none|lt_6_months|6_to_24_months|gt_24_months},
  days_per_week (2..4), session_minutes {30|45|60|75|90},
  sport_code (nullable), sport_other_label (nullable, 40 car.), cautious_mode (bool)

health_screening (C2, E, 1-1 : id = owner_id)
  +SYNC, caution (bool), questionnaire_version, answered_at

limitation (C2, E)
  id, +SYNC, body_area {shoulder|elbow|wrist_hand|neck|upper_back|lower_back|hip|knee|ankle_foot|other},
  side {left|right|both|not_applicable}, severity {mild|severe}, note (200 car.), active

gym (C0, E, partagée : owner_id NULL)
  id, name, name_key, city, city_key, load_settings (JSON), created_by (nullable), updated_by (nullable),
  rev, created_at, updated_at, deleted_at (suppression par l'admin, R-SAL-7)
  UNIQUE (name_key, city_key)

gym_equipment (C0, E)
  id = gym_id || ':' || equipment_code, gym_id, equipment_code, added_by (nullable),
  rev, created_at, updated_at, deleted_at (retrait = tombstone ; ajout = upsert qui remet deleted_at à NULL)

gym_history (C0, H, ajout seul)
  id, gym_id, author_id (nullable = ancien membre), at,
  action {create|update_info|add_equipment|remove_equipment|update_load_settings}, detail (JSON)

place (C1, E)
  id, +SYNC, kind {gym|home}, gym_id (si gym), name (si home), is_primary, visible_at_gym (si gym),
  load_settings (JSON, si home)
  Uniques partiels parmi les lieux non supprimés : (owner_id, gym_id), et un seul is_primary par owner_id

home_equipment (C1, E)
  id = place_id || ':' || equipment_code, place_id, equipment_code, +SYNC

security_event (C0, H, 12 mois)
  id, at, type, actor_id, target_id (sans clé étrangère), tailnet_ip, outcome, details (sans secret ni C2 ou C3)
```

`load_settings` : `{ barG, smallestPlateG, dumbbellsG[], machineStepG }` (§10.3), schéma Zod dans `packages/contracts`.

Constantes du code partagé (non modifiables dans l'appli) : `MIN_AGE` = 16 ; taxonomie du matériel (section Exercices) et préréglages ; liste des sports ; textes de la charte et des consentements (versionnés) ; questionnaire d'alerte (versionné) ; liste des mots de passe courants.

Compteurs d'échecs de connexion : en mémoire, non persistés.

Lu par les autres briques : `ageBand`, `cautious`, `goal`, `experience`, `daysPerWeek`, `sessionMinutes`, `sportCode`, lieux, matériel, `load_settings`, limitations (si consentement), état des consentements.

### 17. Glossaire

| Français | Anglais (code) |
|---|---|
| utilisateur, membre | user, member |
| pseudo | username |
| invitation, code d'invitation | invitation, invitation code |
| lien de réinitialisation | password reset |
| tranche d'âge, mineur, majeur | age band, minor, adult |
| consentement santé | health consent |
| journal de sécurité | security event log |
| objectif | goal |
| niveau d'expérience | experience |
| séances par semaine, durée | days per week, session minutes |
| mode prudent (manuel) | cautious mode |
| profil prudent (calculé) | cautious |
| indicateur de prudence (questionnaire) | caution |
| questionnaire d'alerte | health screening |
| limitation, zone, côté, gêne | limitation, body area, side, severity |
| salle | gym |
| lieu, lieu principal | place, primary place |
| maison | home |
| matériel | equipment |
| préréglage de matériel | equipment preset |
| réglages de charge | load settings |
| barre, plus petit disque, haltères, pas machine | bar, smallest plate, dumbbells, machine step |
| historique de salle | gym history |
| visible à la salle | visible at gym |
| recommandation de modèle | template recommendation |
| contexte (salle, maison, sport) | context (gym, home, sport) |
| ancien membre | former member |

### 18. Plus tard

Passkeys ; rôle « relecteur » ; fusion de salles ; base de salles géolocalisée ; matériel personnel ajouté à celui d'une salle ; inventaire fin des disques ; plusieurs sports par utilisateur ; liste des sessions et journal visibles dans l'appli ; suggestions d'enseignes ; signalement des comptes inactifs ; modification hors ligne du profil et des lieux.
