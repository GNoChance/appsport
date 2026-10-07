## Vie privée, sécurité et obligations

> Cette section fixe les exigences transverses de vie privée et de sécurité. Le socle (brique 1) les met en œuvre en entier, et chaque brique les applique à ses propres tables. Le socle (section Comptes) fait foi pour les comptes : pseudo seul, rôle `member` par invitation, règles de mot de passe et d'échec de connexion. La section Exploitation fait foi pour le chiffrement, les sauvegardes, le réseau et les secrets. Les règles `P-…` servent directement de critères d'acceptation.

### 1. Cadre juridique retenu

- **Les faits.** Le porteur, une personne physique, héberge chez lui, sans but lucratif, les données de 2 à 5 personnes (lui-même et 1 à 4 proches). Certains ont 16 ou 17 ans. Ces données comprennent des données de santé et des échanges envoyés à un sous-traitant américain (Anthropic).
- **Exemption domestique (art. 2.2.c du RGPD).** Elle est plausible mais pas garantie. La CJUE l'interprète strictement (*Lindqvist*, *Ryneš*), et le considérant 18 maintient le RGPD pour ceux qui fournissent les moyens du traitement. **On ne s'y fie pas.**
- **Socle minimal appliqué :** information claire, consentements explicites (santé, coach), minimisation, export et suppression en libre-service, durées de conservation, sécurité.
- **Fiche de traitement** `docs/fiche-de-traitement.md`, d'une page :
  - contenu : finalités, catégories de données, destinataires (Anthropic pour le coach, Backblaze pour des sauvegardes chiffrées, Tailscale pour le réseau), durées et mesures ;
  - elle tient lieu de registre, obligatoire dès qu'on traite des données de santé (art. 30.5) ;
  - elle sert de source à la page Confidentialité.
- **Reportés tant que l'appli reste entre proches :** AIPD, DPO, CGU, mentions légales LCEN.
- **Mineurs.** L'âge minimum est de 16 ans. Un mineur consent seul dès 15 ans (art. 45 de la loi Informatique et Libertés), donc **aucun circuit d'accord parental**.
- **IA.** L'IA est annoncée au début de chaque conversation, comme l'exigent la politique d'usage d'Anthropic et l'AI Act (art. 50).

### 2. Catégories de données

Chaque table, et chaque champ sensible placé dans une table d'une autre catégorie, porte une catégorie. Les règles s'appliquent par catégorie, jamais au cas par cas.

| Cat. | Nom | Contenu | Qui y accède dans l'appli | Règles |
|---|---|---|---|---|
| **C0** | Interne | **Pour tout le cercle :** référentiels (fiches d'exercices publiées, illustrations, matériel, modèles de programmes), salles partagées et leur historique, pseudos rendus visibles.<br>**Pour l'admin seulement :** métadonnées de compte (pseudo, rôle, statut, date de naissance, mineur oui/non, création, dernière connexion, état des consentements, nombre de sessions actives, coût IA du mois), invitations, liens de réinitialisation, journal de sécurité. | le cercle ou l'admin, selon la ligne | C0 ne veut pas dire « non personnel » : C0 regroupe ce que le cercle ou l'admin voit par conception |
| **C1** | Personnel | Profil d'entraînement, lieux de type maison, visibilité par lieu, mode prudent manuel, programmes et `instance_change`, séances, séries, records, réglages, rejets de synchro, détail des sessions, historique des consentements. | le propriétaire seul | exporté (sauf les sessions, voir ci-dessous) ; supprimé avec le compte ; envoyé au coach seulement avec l'accord coach |
| **C2** | Santé | Indicateur de prudence issu du questionnaire, limitations et zones sensibles, douleur (`pain_level`, `swap_reason = pain`, `pain_streak`), motif d'une modification de programme (`instance_change.reason`), taille, pesées, sexe utilisé par les formules, profil, cibles et bilans nutritionnels. | le propriétaire seul | accord santé requis ; supprimé au retrait de l'accord ; jamais dans un journal ; envoyé au coach seulement si les accords santé **et** coach sont actifs |
| **C3** | Sensible | Fils et messages du coach, signalements. | le propriétaire seul ; un échange signalé devient lisible par l'admin (P-COA-4) | accord coach requis ; supprimé au retrait de l'accord ; jamais dans un journal ; durée limitée (§7) |

Les empreintes de mot de passe et de jetons (`*_hash`) sont hors catégorie, listées dans `secretColumns` : elles ne sont jamais exportées, synchronisées, journalisées ni renvoyées par l'API.

Exception : les sessions sont C1 mais ne sont pas exportées (section Comptes, R-EXP-2, qui prime). Le registre les déclare non exportées et anonymisées à la suppression du compte (P-DRT-3), et le test de P-CAT-2 admet cette exception.

- **P-CAT-1** Un registre unique `entityRules`, dans `packages/contracts`, associe chaque table à sa catégorie (`category`), et liste les champs C2 placés dans une table C1 (`c2Columns`, par exemple `performed_exercise.pain_level`) et les secrets (`secretColumns`).
- **P-CAT-2** Un test parcourt le schéma : il échoue si une table n'est pas dans le registre, ou si une table liée à un `user_id` n'est pas couverte à la fois par l'export et par la suppression.
- **P-CAT-3** La catégorie décide de tout ce qui suit : l'export, la suppression, l'interdiction dans les journaux, l'interdiction d'accès pour l'admin, la condition de consentement et l'envoi au coach.

### 3. Consentements

| Accord (`consent_event.type`) | Ce qu'il permet | Sans lui |
|---|---|---|
| **Santé** (`health`) | enregistrer les données C2 : limitations, prudence, douleur, mesures, nutrition | voir P-CST-2 |
| **Coach IA** (`ai_coach`) | envoyer à Anthropic (États-Unis) les messages et le dossier du coach ; conserver les fils | coach désactivé, aucun appel à l'API Claude pour cet utilisateur |

- **P-CST-1** Chaque accord est présenté sur son propre écran, avec une case non cochée par défaut, distincte de l'acceptation de la page Confidentialité.
  - Le texte est versionné dans le dépôt.
  - Un changement de version majeure fait redemander l'accord à l'ouverture suivante, et un refus vaut retrait.
- **P-CST-2 Sans accord santé :**
  - l'API en ligne refuse toute écriture C2 (`403 health_consent_required`) et les champs C2 sont absents des réponses ;
  - dans la synchro, le serveur retire les colonnes C2 d'une opération et applique le reste, avec le statut `applied_partial` (R-SYN-9 de la section Architecture). Une opération qui crée ou modifie une ligne d'une table C2 est écartée sans rien écrire, avec le même statut ;
  - la nutrition chiffrée est désactivée ;
  - le questionnaire de prudence devient une auto-vérification affichée mais non enregistrée.
  - Le bouton douleur affiche le conseil de sécurité et agit sur la séance suivante, selon la section Programmes. Aucune trace de la douleur ni de son motif n'est stockée, ni sur le serveur, ni dans la base locale, ni dans la file d'envoi. L'effet est enregistré comme un ajustement neutre, sans motif : le bouton écrit seulement `performed_exercise.next_adjustment` (`hold` ou `lighten`, C1).
  - Le **mode prudent manuel** (`cautious_mode`, C1, non sanitaire) reste disponible pour tous.
- **P-CST-3 Retrait d'un accord :**
  1. l'appli propose un export ;
  2. elle liste ce qui sera effacé et demande le mot de passe ;
  3. les données sont effacées immédiatement :
     - pour la santé : les lignes des tables C2 sont vidées, et il n'en reste qu'une marque de suppression sans contenu (`id`, `owner_id`, `rev`, `deleted_at`), propagée par le pull puis purgée après `TOMBSTONE_TTL` ; les champs C2 des tables C1 sont mis à `NULL`. L'état des slots n'est pas recalculé rétroactivement ;
     - pour le coach : toutes les lignes C3, et les propositions du coach encore en attente ;
  4. le client efface ses copies locales et les opérations en attente de la catégorie ;
  5. un événement `withdraw` est ajouté à `consent_event`, et un événement `consent_revoked` au journal de sécurité.
- **P-CST-4** Une opération C2 écartée faute d'accord n'entre jamais dans les rejets de synchro (`sync_rejection`, aucun code de rejet pour le consentement) : le client supprime sa copie locale. Ainsi, aucune donnée C2 n'atterrit dans une table visible par l'admin.

**Textes v1, à relire par le porteur**
- *Santé* : « J'accepte qu'appsport enregistre mes données de santé : limitations et zones sensibles, réponses de prudence, douleurs signalées pendant les séances, taille, poids, profil et suivi nutritionnels. Elles servent uniquement à adapter mes séances et mes repères. Elles restent sur le serveur du cercle et l'administrateur ne les consulte pas dans l'appli. Je peux retirer cet accord à tout moment : elles seront alors supprimées. »
- *Coach* : « J'accepte que mes messages au coach et les informations utiles soient envoyés à Anthropic, société américaine qui fournit l'IA Claude : mes objectifs, mon niveau, mon matériel, mon programme, mon historique récent et, si j'ai donné l'accord santé, mes données de santé. Le traitement a lieu aux États-Unis. Anthropic n'entraîne pas ses modèles sur ces données et les efface sous 30 jours, sauf si ses filtres de sécurité signalent un échange : il peut alors le garder jusqu'à 2 ans. Mon pseudo et ma date de naissance ne sont jamais envoyés. Si je signale une réponse, l'échange concerné devient lisible par l'administrateur. Je peux retirer cet accord à tout moment : mes conversations seront supprimées d'appsport, mais pas ce qu'Anthropic a déjà reçu. »

### 4. Mineurs (16 et 17 ans)

- **P-MIN-1 Âge minimum.** Il vaut 16 ans (`MIN_AGE`). L'admin ne peut pas créer d'invitation ni corriger une date de naissance qui donnerait moins de 16 ans au jour de l'opération.
- **P-MIN-2 Date de naissance.**
  - L'admin saisit la date complète dans l'invitation : c'est notre vérification d'âge, puisque le porteur connaît la personne.
  - L'utilisateur la voit, mais ne peut pas la modifier. Seul l'admin la corrige, et chaque correction est journalisée.
  - La date est copiée sur le compte à l'activation, puis effacée de l'invitation.
- **P-MIN-3 Calcul de l'âge.** `age_band` (`minor` avant 18 ans, définition retenue aussi par Anthropic, sinon `adult`) est calculé à la lecture à partir de la seule fonction `ageOn` de `packages/domain`, à l'heure de Paris, jamais stocké. Les cas limites (veille de l'anniversaire, 29 février) sont fixés par le socle (R-AGE-1).
- **P-MIN-4 Accès réseau.** Chaque mineur a son propre compte Tailscale, ce que Tailscale autorise dès 16 ans.
- **P-MIN-5 Nutrition.** Ni cible chiffrée ni déficit, et aucune donnée de santé nutritionnelle recueillie (ni pesée, ni taille, ni sexe pour le calcul). Le serveur refuse le calcul : masquer l'écran ne suffit pas.
- **P-MIN-6 Salles.** Pour un mineur, la visibilité dans « qui va à cette salle » est désactivée par défaut, lieu par lieu.
- **P-MIN-7 Coach.** Il est ouvert aux 16-17 ans avec les garde-fous du §12. Le mode mineur est décidé côté serveur à partir de `age_band`, jamais à partir d'une valeur envoyée par le client.
- **P-MIN-8 À 18 ans.** Rien ne s'active tout seul. Un message, affiché une seule fois par appareil, indique ce que l'utilisateur peut désormais activer lui-même (R-AGE-6 du socle).

### 5. Ce que l'admin voit et ne voit pas

| L'admin peut | L'admin ne peut pas, dans l'appli |
|---|---|
| créer et révoquer des invitations ; saisir et corriger une date de naissance | lire les données C1, C2 ou C3 d'un autre utilisateur |
| générer un lien de réinitialisation ; fermer toutes les sessions d'un membre ; désactiver un compte | se connecter à la place d'un utilisateur : aucune fonction d'usurpation |
| supprimer un compte à la demande de la personne | exporter les données d'un autre |
| promouvoir ou rétrograder (il reste toujours au moins un admin) | connaître ou choisir un mot de passe |
| voir les métadonnées C0 des comptes et le journal de sécurité | voir les rejets de synchro (`sync_rejection`, C1) d'un autre utilisateur |
| lire un échange que l'utilisateur a lui-même signalé (P-COA-4) | |
| relire les fiches d'exercices ; gérer les salles | |

- **P-ADM-1** Toute lecture d'une donnée C1 à C3 est filtrée côté serveur par l'utilisateur de la session. Le rôle admin n'ouvre aucune route vers ces tables, sauf `coach_report`.
- **P-ADM-2** Une session admin qui demande une ressource C1, C2 ou C3 d'un autre utilisateur reçoit `404`, jamais `403`, pour ne pas révéler son existence.
- **P-ADM-3 Limite assumée et annoncée.** L'admin a la main sur le serveur et peut techniquement lire la base. On ne chiffre pas par utilisateur, car le moteur de progression et le coach tournent côté serveur. La page Confidentialité le dit et pose un engagement : aucune requête manuelle sur les données d'une personne sans son accord.

### 6. Droits : export, rectification, suppression

- **P-DRT-1 Export.** « Télécharger mes données » produit un JSON au format versionné `appsport-export/1`.
  - Il contient le compte (sans aucune empreinte), l'historique des consentements, ainsi que toutes les lignes C1, C2 et C3 de l'utilisateur, sauf les sessions (§2), avec `ai_generated` et le modèle (`coach_message.effective_model`, `instance_change.ai_model`) sur les contenus produits par l'IA. Le CSV des séries relève de la brique 3.
  - Si la file d'envoi locale n'est pas vide, l'appli avertit avant d'exporter.
  - L'export est journalisé, sans son contenu.
- **P-DRT-2 Rectification.** Toute donnée saisie est modifiable par son auteur, sauf la date de naissance (P-MIN-2).
- **P-DRT-3 Suppression du compte.** Elle se fait par l'utilisateur, ou par l'admin à sa demande, selon les règles du socle (export proposé, mot de passe, confirmation). C'est une seule transaction :
  1. suppression physique de toutes les lignes C1 à C3 et des liens de réinitialisation ;
  2. les salles restent, et l'auteur devient « ancien membre » ;
  3. les sessions de l'utilisateur sont **anonymisées** (`user_id = NULL`, `revoked_reason = 'account_deleted'`) et purgées à leur expiration absolue ;
  4. un événement `account_deleted` est ajouté au journal de sécurité, avec l'identifiant technique seulement.
- **P-DRT-4 Réponse aux appareils.** Une requête portant un cookie de session `account_deleted` reçoit `410` avec le corps `{"error":"account_deleted"}`. Le client efface alors toute sa base locale, file d'envoi comprise, et affiche « Ce compte a été supprimé ».
  - Le client agit sur le **code d'erreur**, pas sur le seul statut. Un `410` portant un autre code, par exemple un curseur de synchro périmé, n'efface rien.
  - Un `401` (session expirée ou fermée) met la synchro en pause sans toucher à la file d'envoi.
- **P-DRT-5** Le dernier admin ne peut pas supprimer son compte.
- **P-DRT-6 Côté Anthropic.** On ne peut pas déclencher la suppression. L'écran de suppression le dit : effacement sous 30 jours, jusqu'à 2 ans si un échange a été signalé par les filtres d'Anthropic.

### 7. Conservation

| Donnée | Durée | Mécanisme |
|---|---|---|
| C0 de compte, C1 | tant que le compte existe | suppression du compte |
| C2 | tant que le compte existe et que l'accord santé est actif | suppression au retrait (P-CST-3) |
| Fils et messages du coach (C3) | 90 jours après le dernier message ; suppression possible à tout moment | purge quotidienne |
| Signalements (C3) | jusqu'au classement par l'admin, 90 jours au plus | purge quotidienne |
| Journal d'usage du coach (sans contenu) | 12 mois | purge quotidienne |
| Côté Anthropic | 30 jours au plus ; 2 ans au plus si l'échange est signalé | hors de notre contrôle, annoncé dans l'accord |
| Sessions | 90 jours sans usage, 365 jours au maximum ; lignes fermées purgées 30 jours après | purge quotidienne |
| Sessions `account_deleted` | jusqu'à leur expiration absolue | purge quotidienne |
| Invitations, liens de réinitialisation | 7 jours ou 24 h, usage unique ; purgés 30 jours après | purge quotidienne |
| Journal de sécurité | 12 mois | purge quotidienne |
| Journaux techniques | 90 jours au plus | rotation bornée par l'âge (Exploitation, R-OPS-15) |
| Marques de suppression de la synchro (tombstones) | 90 jours (`TOMBSTONE_TTL`) ; les salles et lieux supprimés restent, pour l'historique (R-SAL-7, R-LIEU-5 du socle) | purge quotidienne |
| Sauvegardes | **30 jours au plus** | rotation (Exploitation) |
| Données locales du téléphone | jusqu'à la déconnexion (si la file d'envoi est vide), au retrait d'un accord pour la catégorie concernée, ou jusqu'au `410 account_deleted` | effacement par le client |

### 8. Restauration : réappliquer les suppressions

Cette étape est **obligatoire** dans la procédure de restauration P4 (section Exploitation). Une donnée supprimée ne doit pas « revenir ».

1. Avant de restaurer un instantané S, la commande `server.mjs privacy:collect --since <date de S>` extrait la liste des événements `account_deleted` et `consent_revoked` postérieurs à S. Elle lit la source la plus récente disponible : la base courante si elle est lisible, sinon l'instantané le plus récent.
2. On restaure S.
3. `server.mjs privacy:reapply <liste>` réapplique les suppressions de compte (P-DRT-3) et les retraits d'accord (P-CST-3). Elle s'exécute **avant** que le service n'accepte des requêtes : les sessions d'un compte supprimé sont ainsi anonymisées avant que les appareils ne rejouent leurs saisies.
4. Après réapplication, les écritures rejouées par les clients pour un compte supprimé reçoivent `410`. Les écritures C2 rejouées sans accord sont écartées (P-CST-2, P-CST-4).
5. Les suppressions ordinaires d'entités synchronisées sont rattrapées par la synchro (marques de suppression et `server_epoch`).

Risque résiduel accepté : en cas de perte totale du serveur, une suppression faite après le dernier instantané hors site est perdue. Le porteur la refait à la main.

### 9. Authentification et sessions

Le détail est dans le socle. Exigences :

- **P-AUT-1 Identité.** L'identifiant est un pseudo et **aucun e-mail n'est collecté**. Les règles de mot de passe (12 caractères au moins, 14 pour un admin, refus des mots de passe courants), Argon2id et la limitation des échecs (délai croissant à partir du 5e échec, refus au 10e dans l'heure, 30 par heure et par IP) sont celles du socle.
- **P-AUT-2 Jetons d'invitation et de réinitialisation.**
  - Tirés d'un générateur cryptographique ; seule leur empreinte SHA-256 est stockée.
  - Placés dans le fragment de l'URL, ou saisis à la main dans l'appli installée, puis transmis **dans le corps** d'un POST. Jamais dans le chemin ni dans la chaîne de requête.
  - Usage unique, validité limitée, nombre d'essais limité. Le format du code saisi à la main est fixé par le socle (R-INV-3 : 16 caractères en base32 de Crockford, 80 bits).
- **P-AUT-3 Cookie de session.**
  - Nom `__Host-session` (R-AUTH-6 du socle), attributs `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sans `Domain`.
  - Jeton opaque de 32 octets, haché côté serveur, renouvelé à chaque connexion.
  - Expiration après 90 jours sans usage, et au plus tard 365 jours après la connexion.
- **P-AUT-4 CSRF.** Toute requête qui modifie des données exige un `Origin` égal à l'origine de l'appli et un corps JSON.
- **P-AUT-5 Actions sensibles.** Changer de mot de passe, retirer un accord, supprimer un compte, changer un rôle : le mot de passe est ressaisi au moment de l'action. Il n'y a pas de fenêtre de réauthentification.
  - Exception explicite : après une restauration, le téléphone renvoie seul, sans mot de passe, un retrait de l'accord santé que le serveur restauré a perdu, aux conditions de R-SYN-28 (section Architecture).
- **P-AUT-6 File d'envoi.** Elle est étiquetée par `user_id` et ne part jamais sous la session d'un autre utilisateur. Si un autre pseudo se connecte sur l'appareil, il est averti, puis la file est effacée.
- **P-AUT-7 Identité Tailscale.** L'appli ne se sert jamais de l'identité Tailscale : les en-têtes `Tailscale-User-*` sont ignorés.
- **P-AUT-8 Récupération sans e-mail.**
  - L'admin génère un lien de réinitialisation et ne connaît jamais le mot de passe ; toutes les sessions sont fermées.
  - Pour l'admin lui-même, une commande sur le serveur (`server.mjs admin:reset <pseudo>`), accessible par Tailscale SSH.
  - Téléphone perdu : « Déconnecter tous mes appareils », ou fermeture des sessions par l'admin, puis retrait de l'appareil du compte Tailscale.
- **P-AUT-9 En-têtes HTTP.**
  - HSTS ;
  - CSP `default-src 'self'` sans script en ligne, `frame-ancestors 'none'` ;
  - `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` minimale.

### 10. Réseau, chiffrement, sauvegardes, secrets

Ce sont des exigences ; leur mise en œuvre est dans la section Exploitation.

1. **Aucune exposition sur Internet** : ni Funnel, ni redirection de port, ni DMZ. Le pare-feu de l'hôte refuse toute entrée hors de l'interface Tailscale, **en IPv4 comme en IPv6**.
2. **Partage de la seule machine `appsport`** avec le compte Tailscale de chaque proche. La politique d'accès limite `autogroup:shared` à `tcp:443`, et le retrait d'un proche se fait en révoquant le partage.
3. **TLS** par `tailscale serve` (certificat `*.ts.net`). L'appli n'écoute que sur `127.0.0.1`, et la base n'est jamais joignable par le réseau.
4. **L'authentification de l'appli reste obligatoire** dans le tailnet.
5. **Noms publics.** Le nom de machine `appsport` et le nom du tailnet apparaissent dans les journaux publics de certificats. `appsport` révèle l'usage mais rien de personnel, ce qui est accepté. Le nom du tailnet reste aléatoire.
6. **Double authentification** sur le compte qui administre le tailnet.
7. **Données chiffrées au repos.** Volume LUKS, déverrouillé à la main.
8. **Sauvegardes** chiffrées côté client avant de quitter le serveur, une copie hors du domicile, **30 jours au plus**, **restauration testée chaque mois**. Les clés sont détenues par le porteur seul.
9. **Clé API Anthropic** sur le serveur seulement : jamais dans le client ni dans le dépôt. Une limite de dépense est fixée dans la console.
10. **Flux sortants du serveur** : API Claude, mises à jour, sauvegardes, sonde de supervision. Aucun autre.

### 11. Journaux et services tiers

- **P-LOG-1 Journal de sécurité** (`security_event`, 12 mois).
  - Événements : connexions réussies ou échouées, blocages, changements et réinitialisations de mot de passe, fermetures de sessions, invitations, changements de rôle, de statut ou de date de naissance, accords donnés ou retirés, exports, suppressions de compte, signalements.
  - Champs : date, type, acteur, sujet, IP du tailnet, résultat. **Aucune donnée C1 à C3.**
- **P-LOG-2 Journaux techniques.** Ils contiennent la méthode, le modèle de route, le statut, la durée et l'identifiant de requête.
  - **Interdits** : corps de requête ou de réponse, `Cookie`, jetons, codes d'invitation, chaînes de requête, valeurs C1 à C3, prompts et réponses de l'IA.
  - Un test injecte des valeurs témoins C2 et C3 et un jeton, puis vérifie qu'ils n'apparaissent dans aucune sortie de journal.
- **P-LOG-3 Journal d'usage du coach.** Il enregistre utilisateur, date, modèle, jetons et coût, sans contenu. Il est défini dans la section Coach.
- **P-LOG-4 Aucun service tiers côté client** : ni statistiques, ni télémétrie, ni suivi d'erreurs externe, ni police ou CDN externe. Tout est servi par notre serveur. Sans traceur, il n'y a pas de bandeau cookies.

### 12. Coach : minimisation et garde-fous pour les mineurs

- **P-COA-1 Envoyé à l'API :** tranche d'âge (`age_band`, jamais l'âge exact), niveau, objectif, contexte, matériel, programme, historique récent ; C2 seulement si les accords santé **et** coach sont actifs. **Jamais envoyés :** pseudo, date de naissance, identifiant interne, nom ou enseigne de la salle, autres membres, IP. Le champ `metadata.user_id` n'est pas renseigné.
- **P-COA-2** Les contenus importés (fiches, notes de séance) sont transmis comme des données balisées, jamais comme des instructions.
- **P-COA-3** La modération et le contrôle des sorties sont faits par notre code et par l'API Claude. Ils n'ajoutent **aucun autre sous-traitant**.
- **P-COA-4 Bouton « Signaler ».**
  - Il est présent sur chaque réponse du coach, pour tous les utilisateurs.
  - Avant de confirmer, l'utilisateur est averti que la réponse signalée et son message précédent deviendront lisibles par l'admin.
  - Seule cette copie est stockée dans `coach_report`.
  - L'admin la lit, puis la classe, ce qui la supprime. Elle est supprimée au plus tard après 90 jours, au retrait de l'accord coach ou avec le compte.
- **P-COA-5** Les alertes de sécurité détectées par le coach (TCA, détresse, dopage) affichent les ressources de la page Aide et ne sont comptées que par catégorie, sans contenu ni identité.

**Exigences d'Anthropic pour les mineurs** (consignes du 16/03/2026) et réponse prévue, détaillée dans la section Coach :

| Exigence | Réponse |
|---|---|
| Vérification de l'âge | date de naissance saisie par l'admin, non modifiable par l'utilisateur (P-MIN-2) |
| Modération et filtrage | consignes dédiées aux mineurs dans le prompt système ; aucun chiffre nutritionnel ; contrôle des sorties par le code ; prompt de protection de l'enfance d'Anthropic dès sa publication ; cas d'évaluation « mineur » réussis à 100 % |
| Surveillance et signalement | bouton « Signaler » (P-COA-4) ; alertes comptées par catégorie (P-COA-5) |
| Ressources éducatives | page « Bien utiliser le coach », avec une partie pour les jeunes |
| Conformité documentée | rubrique « Coach et mineurs » de la page Confidentialité, accessible sans connexion depuis le tailnet |
| Mention de l'IA | §13 |

### 13. Mentions dans l'appli

Les pages Confidentialité, Crédits et Aide sont accessibles **sans connexion**, depuis le tailnet seulement.

1. **Premier écran de l'invitation :** « appsport est un outil de suivi entre proches, hébergé chez [prénom du porteur]. Ce n'est pas un service médical. » Il porte un lien vers Confidentialité.
2. **Avertissement santé** (onboarding, nutrition, pied de chaque fiche d'exercice) : « appsport ne remplace pas un avis médical. Consultez un médecin avant de reprendre une activité si vous avez un problème de santé, et arrêtez en cas de douleur. » Le vocabulaire reste « repère » et « estimation », jamais « régime », « prescription » ni « traitement ».
3. **Coach.**
   - Un bandeau fixe en tête de chaque conversation : « Vous échangez avec une IA (Claude, d'Anthropic), pas avec un humain. Elle peut se tromper et ne remplace pas un professionnel de santé. En cas d'urgence : 15 ou 112. »
   - Une étiquette « IA » sur chaque message ; `ai_generated` et `effective_model` sont enregistrés et exportés.
   - Les propositions portent la mention « proposé par l'IA, vérifié par l'appli ».
4. **Fiches d'exercices :** « Rédigé avec l'aide d'une IA, relu par l'administrateur ».
5. **Page Confidentialité**, versionnée et tirée de la fiche de traitement. Elle indique :
   - qui est responsable ;
   - les données collectées (C0 à C3) et pourquoi ;
   - où elles se trouvent : serveur à domicile en France, États-Unis pour le coach, sauvegardes chiffrées hors du domicile ;
   - les durées de conservation (§7) ;
   - ce que l'admin voit ou ne voit pas, y compris P-ADM-3 ;
   - que le porteur voit l'adresse du compte Tailscale de chaque proche, une information gérée par Tailscale ;
   - les droits et comment les exercer ;
   - la rubrique « Coach et mineurs ».
6. **Page Crédits**, générée à partir des champs `license`, `creators`, `source_url` et `modifications` de chaque illustration.
   - Elle donne l'auteur, la licence, la source et la mention « modifié » le cas échéant. Un dessin adapté d'Everkinetic dans workout-guide porte les deux attributions.
   - Les illustrations de provenance non documentée portent `replace_before_public = 1`. Elles sont admises tant que le dépôt et l'appli restent privés.
7. **Page Aide :** 15, 112, 3114 (prévention du suicide), ligne TCA 09 69 325 900, Écoute Dopage. Les numéros sont revérifiés avant chaque mise en production, et la date de vérification est affichée.

### 14. Incident de sécurité

1. Couper l'accès : révoquer les partages Tailscale ou arrêter le service.
2. Évaluer ce qui a été exposé.
3. **Prévenir les proches concernés sous 72 h** : ce qui s'est passé, ce qu'ils doivent faire.
4. Consigner l'incident dans `docs/incidents.md` : date, faits, mesures, personnes prévenues.

### 15. Si l'appli s'ouvrait au public (rappel, hors périmètre)

1. Exposition : domaine propre et frontal durci. Des passkeys éventuellement ajoutées d'ici là (§16) seraient à recréer sur le nouveau domaine.
2. RGPD complet : responsable identifié, AIPD, registre formel, contrats de sous-traitance, analyse du transfert hors UE.
3. Mineurs : vérification d'âge à distance ; exigences d'Anthropic documentées publiquement.
4. Comptes : inscription ouverte, protection contre les abus, récupération par e-mail.
5. Textes juridiques (mentions légales, CGU, santé, éventuel HDS) relus par un juriste.

### 16. Plus tard

Passkeys et TOTP pour l'admin · vue « Mon compte › Sécurité » (sessions actives, événements du compte) · Tailnet Lock · liste blanche stricte des flux sortants · second admin (l'enveloppe de secours scellée est déjà prévue en v1, R-OPS-14 de la section Exploitation) · signalement des comptes inactifs.

### 17. Critères d'acceptation

1. Une session admin qui demande une ressource C1, C2 ou C3 d'un autre utilisateur reçoit `404`. Aucune route admin ne renvoie de champ C1 à C3, sauf `coach_report`. **Chaque brique ajoute ce test pour ses tables.**
2. Une table absente de `entityRules`, ou liée à un `user_id` sans couverture par l'export et par la suppression, fait échouer la CI.
3. Sans accord santé, toute écriture C2 par l'API en ligne renvoie `403`, toute colonne ou ligne C2 reçue par la synchro est écartée (`applied_partial`, aucune ligne `sync_rejection`), et les champs C2 sont absents des réponses. Le bouton douleur n'écrit aucune donnée de douleur, ni dans la base locale, ni dans la file, ni sur le serveur.
4. Retirer l'accord santé vide immédiatement toutes les lignes C2 (seule reste une marque de suppression sans contenu, purgée après `TOMBSTONE_TTL`) et met à `NULL` les champs C2. Retirer l'accord coach supprime toutes les lignes C3. Un événement `consent_revoked` est journalisé et le client purge ses copies locales.
5. Une invitation ne peut pas être créée avec une date de naissance donnant moins de 16 ans. L'utilisateur ne peut pas modifier sa date de naissance. `age_band` passe de `minor` à `adult` le jour des 18 ans, sans tâche planifiée.
6. Pour un mineur, le calcul nutritionnel chiffré est refusé par le serveur, et le coach applique le mode mineur même si le client prétend le contraire.
7. Les jetons et codes d'invitation ou de réinitialisation ne sont jamais stockés en clair et n'apparaissent dans aucun journal. Les valeurs témoins C2 et C3 non plus.
8. Le cookie s'appelle `__Host-session` et porte `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sans `Domain`. Une requête qui modifie des données avec un `Origin` étranger est refusée.
9. Après la suppression d'un compte, aucune ligne C1 à C3 ne référence l'utilisateur. Un autre appareil de ce compte reçoit `410 {"error":"account_deleted"}` et efface sa base locale. Un `410` portant un autre code n'efface rien.
10. Une restauration d'un instantané antérieur à une suppression de compte et à un retrait d'accord, suivie de `privacy:reapply`, ne fait réapparaître ni le compte ni les données C2 ou C3 supprimées. Les écritures rejouées par les clients sont refusées.
11. La file d'envoi d'un utilisateur A n'est jamais envoyée sous la session d'un utilisateur B.
12. L'export contient toutes les catégories de l'utilisateur, l'historique de ses accords, `ai_generated` et le modèle utilisé, mais aucune empreinte.
13. Le dossier envoyé au coach pour un utilisateur « canari » ne contient ni pseudo, ni date de naissance, ni identifiant interne, ni nom de salle, ni aucune donnée C2 si l'un des deux accords manque (brique 4).
14. Un signalement crée une ligne `coach_report` lisible par l'admin. Après classement, retrait de l'accord coach ou 90 jours, elle n'existe plus.
15. Les pages Confidentialité, Crédits et Aide s'affichent sans session, et aucune ressource n'est chargée depuis un domaine tiers.

### Modèle de données (champs qui relèvent de cette section)

Noms en anglais, `snake_case` en base. Les tables de comptes appartiennent au socle ; on ne liste ici que ce que la vie privée exige.

- **user** — `id` (UUIDv7, PK), `username`, `username_key` (UNIQUE), `role` (`admin`|`member`), `status` (`active`|`disabled`), `birth_date` (date `YYYY-MM-DD`, saisie par l'admin), `created_at`, `last_login_at` : C0, visibles par l'admin. `password_hash` (Argon2id au format PHC) : secret (`secretColumns`). Calculés à la lecture : `age`, `age_band` (`minor`|`adult`).
- **invitation** — `id`, `code_hash` (UNIQUE, secret), `birth_date` (effacée à l'usage ou à l'expiration), `note`, `created_by`, `created_at`, `expires_at`, `used_at`, `used_by` (nullable), `revoked_at` : C0 admin.
- **password_reset** — `id`, `user_id` (FK, cascade), `code_hash` (UNIQUE, secret), `created_by` (nullable si créé par la commande serveur), `created_at`, `expires_at`, `used_at`, `cancelled_at` : C0 admin.
- **session** — `id`, `token_hash` (UNIQUE, secret), `user_id` (FK **nullable**, `ON DELETE SET NULL`), `created_at`, `last_seen_at`, `expires_at` (+365 j ; expiration aussi après 90 j sans usage), `revoked_at`, `revoked_reason` (`logout`|`logout_all`|`password_change`|`password_reset`|`admin`|`account_deleted`) : C1.
- **consent_event** — `id`, `owner_id` (FK, cascade), `type` (`health`|`ai_coach`), `action` (`grant`|`withdraw`), `text_version`, `created_at` (instant de l'événement). En ajout seulement ; l'état courant est le dernier événement par `type`. C1 ; son état (actif ou non) est C0 pour l'admin.
- **security_event** — `id`, `at`, `type` (dont `account_deleted` et `consent_revoked`), `actor_id`, `target_id` (sans clé étrangère, pour survivre à la suppression du compte), `tailnet_ip`, `outcome`, `details` (JSON sans aucune donnée C1 à C3) : C0 admin, 12 mois.
- **Exigences sur les tables des autres domaines :**
  - `coach_thread` et `coach_message` sont C3 ; `coach_message` porte `ai_generated` et `effective_model`. `instance_change` porte `ai_generated` et `ai_model`.
  - `coach_report` est C3, lisible par l'admin.
  - `performed_exercise.pain_level`, `performed_exercise.swap_reason` quand il vaut `pain`, `slot_state.pain_streak` et `instance_change.reason` sont C2 (`c2Columns`).
  - `training_profile.cautious_mode` est C1 ; l'indicateur de prudence du questionnaire (`health_screening.caution`) est C2.
  - `sync_rejection` est C1, visible du seul propriétaire ; `detail_json` ne contient aucune valeur C2.
  - `illustration` porte `license`, `creators`, `source_url`, `modifications` et `replace_before_public`.
  - `exercise.drafting.origin` et `advice_sheet.draft_origin` valent `ai` ou `human`.
  - `gym.created_by` est nullable.

### Risques

- L'admin peut techniquement tout lire. La protection repose sur la transparence et un engagement (P-ADM-3).
- Des données de santé, y compris de mineurs de 16 et 17 ans, sont envoyées aux États-Unis. Anthropic peut les garder 2 ans si elles sont signalées, et le cadre UE–États-Unis reste fragile. Parades : double consentement et minimisation.
- Coach ouvert aux 16-17 ans : un manquement aux exigences d'Anthropic peut faire suspendre le compte API, et donc le coach pour tout le cercle.
- Sans e-mail, un membre qui a perdu son mot de passe dépend de la disponibilité de l'admin.
- Le retrait d'un accord est irréversible. Parades : export proposé et confirmation par mot de passe.
- Une perte totale du serveur peut faire « revenir » une suppression faite après le dernier instantané hors site (§8).

### Sources

- Anthropic, consignes pour les organisations qui servent des mineurs (16/03/2026) : https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors
- Anthropic, politique d'usage : https://www.anthropic.com/legal/aup ; conservation des données : https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- Tailscale, politique de confidentialité, §15 (pas de compte avant 16 ans, version du 25/08/2026) : https://tailscale.com/privacy-policy ; partage de machine : https://tailscale.com/kb/1084/sharing
- Loi Informatique et Libertés, art. 45 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037823135
- RGPD, considérant 18 et art. 30.5 ; CNIL, donnée de santé, délibérations 2022-100 (mots de passe) et 2021-122 (journaux)
- OWASP, Password Storage Cheat Sheet (Argon2id)
- CC BY-SA 4.0, section 3(a) ; bryllim/workout-guide, ATTRIBUTION.md
- Ligne TCA 09 69 325 900 : https://www.ffab.fr/500-ligne-tca-nouveau-numero