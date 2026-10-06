# Recherche initiale — appsport (2026-10-06)

*Ce brief résume 7 rapports de recherche (exercices, PWA et hébergement, coach IA, nutrition, programmes, benchmark et UX, juridique et sécurité), relus par une passe de vérification. En cas de désaccord, c'est la vérification qui l'emporte. Deux marqueurs reviennent : « (déduit) » signale une estimation ou une inférence, « (incertain) » une information qu'aucune source primaire ne confirme. Les prix, versions et quotas datent du 2026-10-06 : à revérifier avant tout engagement.*

## Résumé

- **C'est faisable** en PWA hébergée chez nous, iPhone compris, à trois conditions : HTTPS sur un vrai nom de domaine, une app pensée d'abord pour fonctionner hors ligne, et une IPv4 publique non partagée ou un accès par VPN privé. Les FAI partagent par défaut l'IPv4 entre abonnés (CGNAT).
- **Décision bloquante : à qui s'adresse l'app** (nous et nos proches, ou le public). Ce choix détermine l'exposition réseau, le niveau d'exigence RGPD, le fournisseur d'IA, l'âge minimum et ce que le dépôt peut contenir.
- **Exercices** : base wger (917 exercices, dont 584 nommés en français, licence précisée pour chaque entrée) et dessins workout-guide, pour construire notre propre catalogue d'environ 150 exercices relus. free-exercise-db et ses dérivés sont écartés : textes copiés de bodybuilding.com (vérifié), photos d'origine inconnue.
- **Programmes** : 8 modèles écrits par nous, aux noms génériques, et un moteur de progression à règles fixes. L'IA explique et propose ; c'est le code qui calcule les charges et les calories.
- **Nutrition v1** : objectifs calculés et suivi de la tendance du poids, ajustés chaque semaine. Le journal alimentaire et le scan de code-barres arrivent en v2.
- **Coach IA** : API Claude derrière une interface interne, pour environ 1,1 $ par utilisateur actif et par mois avec Opus 5.5 et environ 0,6 $ avec Sonnet 5.5 (déduit). Les données sont traitées hors UE ; si l'app s'ouvre au public, on passe par la région UE de Google Cloud (+10 %) ou par Mistral. Un LLM local sur processeur est trop lent.
- **Juridique** : poids, apports alimentaires et blessures sont des données de santé (art. 9 du RGPD), donc consentement explicite obligatoire. Indiquer qu'on parle à une IA est obligatoire depuis le 2 août 2026. La certification HDS ne paraît pas requise (incertain). Âge minimum : 18 ans.
- **Ordre de construction** : dépôt GitHub, serveur et HTTPS, catalogue, comptes et onboarding, carnet de séance hors ligne, programmes, nutrition v1 (ensemble = MVP), puis coach IA en V1.1.

## Décisions à prendre

### 0. Dépôt GitHub (préalable, demandé en premier)

Aucun rapport ne traitait ce point. Les recommandations ci-dessous sont déduites des contraintes relevées pour les autres décisions.

| Choix | Options | Compromis |
|---|---|---|
| Visibilité | privé ou public | Public : interdit de versionner des données dont la redistribution est interdite (RepDB, packs ExerciseDB), runners auto-hébergés à proscrire (toute PR pourrait exécuter du code sur le serveur), secrets à surveiller. Privé : aucune de ces contraintes, et on peut le rendre public plus tard. |
| Licence du code | MIT, Apache-2.0, AGPL-3.0 | MIT ou Apache : réutilisation maximale. AGPL : tout service dérivé doit publier son code, et on peut alors reprendre du code wger ou Liftosaur, eux-mêmes sous AGPL (déduit). |
| Licence des données | CC BY-SA 4.0 (imposée) | Obligatoire pour toute fiche dérivée de wger ou de workout-guide. Dossier `data/` avec sa propre licence, séparé du code. Plus tard, les données Open Food Facts et OSM (licence ODbL) iront dans des tables séparées. |
| Médias | dans le dépôt ou à côté | SVG utiles versionnés (quelques Mo). Photos WebP stockées sur le serveur, avec dans le dépôt un manifeste et leurs empreintes sha256. Pas de sous-modules : les dépôts sources pèsent 90 à 100 Mo et contiennent des médias aux droits douteux. |

**Recommandation**
- Dépôt **privé** au départ ; licence du code à choisir avant toute publication.
- Monorepo pnpm :
  - `apps/web` (PWA) et `apps/api` (Node) ;
  - `packages/shared` (schémas Zod, types, moteur de progression commun au client et au serveur) ;
  - `data/` (catalogue et programmes JSON, sous CC BY-SA 4.0) ;
  - `scripts/` (imports), `infra/` (Compose, Caddyfile), `docs/` (ce brief, décisions).
- Branche `main` protégée, travail par pull request.
- CI sur les runners hébergés par GitHub : lint, typage, tests, validation du catalogue et des programmes par JSON Schema. Images publiées sur GHCR, Dependabot pour npm et Docker Compose, secrets dans GitHub Actions et dans le `.env` du serveur, jamais dans git.
- Poste de dev sous Windows : un `.gitattributes` qui impose les fins de ligne LF (déduit). Versions figées : `packageManager` pnpm 10, `engines` Node.
- Node 24, déjà installé, passe en maintenance le 20/10/2026 et reste supporté jusqu'au 30/04/2028. Node 26 devient LTS le 28/10/2026 : on migrera sans urgence.

**Confiance** : moyenne (déduit).

### 1. Source des exercices

| Source | Contenu | Licence réelle | Verdict |
|---|---|---|---|
| wger (API) | 917 exercices ; 584 noms et 570 descriptions en français ; 378 images couvrant 276 exercices ; 78 vidéos HEVC (3,4 Go) | données CC BY-SA 4.0 (764), 3.0 (132), CC0 (21), auteur indiqué pour chaque entrée ; le code est sous AGPL, ce qui ne nous concerne pas si l'on ne prend que les données | **Base** |
| bryllim/workout-guide | 302 exercices, 906 SVG de 512 px (25 Mo), aucun texte | SVG sous CC BY-SA 4.0, code sous MIT | **Visuels, avec réserve** : seuls 76 dessins viennent d'Everkinetic, l'origine des quelque 830 autres n'est pas documentée ; dépôt créé le 24/08/2026, aucun commit depuis le 26/08 |
| everkinetic/data | environ 293 exercices, 537 SVG | CC BY-SA 4.0 | Solution de repli (origine claire, mais projet inactif depuis 2022) |
| free-exercise-db, wrkout, exercemus | 872 à 876 exercices, 1 746 JPG | se disent sous Unlicense, mais leurs textes sont copiés de bodybuilding.com (vérifié, jusqu'à la coquille « torso.This ») et leurs images, aspirées sur le web, sont d'origine inconnue | **Écartés** |
| ExerciseDB | 1 500 exercices, GIF en 180p, pas de français | version gratuite réservée au non commercial ; pack à 199 $ ou 599 $, non redistribuable | Écarté, sauf budget pour des GIF |
| hasaneyldrm/exercises-dataset | 1 324 exercices en français | dérivé d'ExerciseDB, GIF appartenant à Gym visual | Écarté (piège juridique) |
| RepDB (version gratuite) | 609 exercices très structurés | licence propriétaire, redistribution interdite, français payant | Écarté |
| workout-cool | 3 exercices d'exemple | base non publiée ; code sous MIT | Utile seulement comme modèle de schéma |

**Compromis**
- Partage à l'identique : nos fiches dérivées de wger, traductions comprises, doivent être publiées sous CC BY-SA 4.0. Il faut afficher l'auteur, la source, la licence et la mention « modifié », par exemple dans une page Crédits.
- La qualité de wger est inégale :
  - 513 des 584 traductions françaises ont été créées en juin 2026 sous un auteur générique. C'est un import en masse, probablement automatique (déduit).
  - Aucun niveau de difficulté n'est renseigné, et il n'existe pas de matériel « machine » : 42 des 59 exercices sur machine n'ont aucun matériel indiqué.
  - 24 % des exercices n'ont pas de matériel et 70 % pas d'image. Seuls 160 exercices ont à la fois une description en français, une image, un matériel et un muscle.
- Aucune source ouverte ne fournit ce dont un débutant a besoin : erreurs fréquentes, consignes de sécurité, respiration, réglage des machines, variantes, exercices de remplacement, charges de départ.

**Recommandation**
1. Écrire un script d'import relançable, `scripts/import-wger.ts`.
   - Il récupère `exerciseinfo` (5,7 Mo en un seul appel, sans authentification) et `deletion-log`, la liste des suppressions.
   - Il garde la réponse brute datée et produit des JSON normalisés, avec `license`, `authors` et `source_url` pour chaque entrée.
   - On le relance une fois par mois et on relit les différences dans une PR. L'app n'appelle jamais wger.de pendant son utilisation.
2. Construire un catalogue curé d'environ 150 exercices (maison, salle, loisir), qui comprend :
   - notre propre liste d'une vingtaine de matériels et un champ `contexte` ;
   - un classement par type de mouvement (squat, charnière de hanche, poussées et tirages horizontaux ou verticaux, fente, gainage, port de charge), qui permet de proposer automatiquement un exercice de remplacement ;
   - une fiche débutant structurée : consignes, points clés, erreurs, sécurité, respiration, versions plus facile et plus difficile, remplacements, niveau, statut de relecture. L'IA rédige un brouillon, publié seulement après relecture humaine.
3. Ajouter les 15 à 20 exercices de progression et de prévention qui manquent probablement : adducteurs de Copenhague, hollow, pompe archer, pike push-up, rowing sous table, Nordic. Leur présence dans wger reste à vérifier.
4. Médias : SVG de workout-guide figés à la version 1.0.0, quelques photos wger converties en WebP, pas de vidéo en v1, mise en cache seulement à la demande. Demander à l'auteur l'origine des quelque 830 dessins ; à défaut, se replier sur Everkinetic ou sur des dessins maison.
5. Le rapport programmes proposait de partir des textes de free-exercise-db : on n'en reprend aucun, même comme base à enrichir.

**Confiance** : haute pour les exclusions et le choix de wger comme base ; moyenne pour workout-guide et la qualité des traductions.

### 2. Hébergement et exposition HTTPS

**Contraintes**
- Le service worker et la caméra exigent HTTPS ; seul `localhost` est toléré, en développement. Tester sur un vrai téléphone demande donc un certificat valide (déduit).
- L'IPv4 est partagée par défaut chez les quatre grands FAI (CGNAT) :
  - Orange : depuis janvier 2025, désactivable dans la Livebox, mais l'adresse n'est que « préférentielle », pas garantie fixe ;
  - Free : adresse partagée par plages de ports ; une IPv4 fixe complète (« full-stack ») se demande dans l'espace abonné, de façon irréversible ;
  - Bouygues (option « IP dédiée ») et SFR/RED (retour à une IPv4 complète via le support, outil signalé défaillant en 2023) : informations tirées d'un blog et d'un forum, non vérifiées.
- IPv6, fin 2025 : 94 % des clients fixes, 83 % des clients mobiles, mais seulement 50 % chez Free Mobile. Un serveur joignable uniquement en IPv6 ne suffit donc pas.

| Option | Coût | Avantages | Inconvénients |
|---|---|---|---|
| A. Ports 80/443 redirigés + Caddy (certificats Let's Encrypt) + DNS dynamique | domaine, environ 10 €/an (estimation) | chiffrement TLS terminé chez nous, aucune limite | IPv4 complète obligatoire ; adresse IP du domicile visible ; sécurité entièrement à notre charge |
| B. Tailscale privé, rien d'exposé sur Internet | gratuit jusqu'à 6 utilisateurs | aucune surface d'attaque, fonctionne malgré le CGNAT, HTTPS sur un nom `*.ts.net` | VPN à activer sur chaque téléphone ; noms de machines visibles dans les journaux publics de certificats ; inadapté à un public |
| C. Serveur relais loué (VPS) + WireGuard, qui transmet le trafic sans le déchiffrer | environ 4-6 €/mois (estimation) | contourne n'importe quel CGNAT, TLS terminé chez nous, domaine personnalisé | une machine de plus à maintenir ; latence ; avec l'outil Pangolin, le TLS est terminé sur le VPS |
| D. Cloudflare Tunnel | gratuit | aucun port ouvert, protection anti-DDoS | Cloudflare déchiffre le trafic, donc des données de santé passent chez un sous-traitant américain ; domaine obligatoirement géré chez Cloudflare ; envois limités à 100 Mo |
| E. Tailscale Funnel | gratuit | TLS terminé chez nous | en bêta, noms `*.ts.net` uniquement, débit bridé |

**Recommandation**
- **Choix d'exposition**
  - Groupe de 6 personnes au plus, qui acceptent un VPN : option **B**.
  - Au-delà, ou si l'app s'ouvre au public : option **A**, en demandant une IPv4 complète au FAI.
  - Si le FAI ne lève pas le CGNAT : repli sur l'option **C**.
  - **L'option D est écartée** pour des données de santé. Le rapport PWA la gardait en repli, le rapport juridique la déconseillait ; c'est ce dernier qui l'emporte.
  - L'option E ne sert que pour une démo ponctuelle.
- **Serveur**
  - Linux en version LTS, Docker Compose versionné dans le dépôt.
  - Seul Caddy publie des ports, car Docker contourne les règles du pare-feu UFW. L'API et PostgreSQL 18 restent sur un réseau Docker interne.
  - Accès SSH et tableaux de bord uniquement via Tailscale.
  - CrowdSec avec son module pour Caddy, mises à jour de sécurité automatiques, disque chiffré (LUKS).
  - Watchtower étant archivé, les images Docker sont mises à jour par Dependabot puis redéployées.
- **Sauvegardes selon la règle 3-2-1**
  - Export quotidien `pg_dump -Fc`, envoyé par restic, qui chiffre côté client, vers un second disque et vers une copie hors du domicile. Destinations possibles : Backblaze B2 (10 Go gratuits, puis 6,95 $/To/mois), Hetzner Storage Box (environ 3 €/To/mois, à confirmer) ou un disque chez un proche.
  - Restauration testée chaque mois.
  - Sauvegardes conservées 30 jours au plus, pour que les suppressions demandées par les utilisateurs soient réellement effectives.
- **Supervision et certificats**
  - Beszel, Uptime Kuma et une sonde externe, qui détecte une coupure de la box ou du courant.
  - La durée des certificats passera à 64 jours le 10/02/2027, puis à 45 jours le 16/02/2028 : le renouvellement doit être automatique et surveillé.
- **E-mails**
  - Jamais envoyés directement depuis l'IP du domicile : le port 25 est filtré, les IP résidentielles figurent sur la liste noire PBL de Spamhaus, et Gmail exige un reverse DNS ainsi que SPF ou DKIM.
  - Passer par un service d'envoi : Brevo (300 e-mails par jour gratuits) ou Scaleway TEM (300 gratuits, puis 0,25 € les 1 000), avec SPF, DKIM et DMARC configurés.
  - En cercle privé, on peut s'en passer : comptes sur invitation, passkeys, réinitialisation par l'administrateur.
- **Mémoire vive (déduit)** : l'app et ses services occupent environ 3,5 Go, il reste 9 à 12 Go selon les estimations. Un LLM local se limiterait à un modèle de 8 milliards de paramètres compressé (6 Go), avec une limite de mémoire (`mem_limit`) pour protéger PostgreSQL.

**Confiance** : haute pour les contraintes HTTPS et CGNAT et pour le rejet de Cloudflare ; moyenne pour les procédures des FAI et les prix estimés.

### 3. Stack PWA et hors-ligne

| Contrainte (vérifiée) | Conséquence |
|---|---|
| iOS 26 : tout site ajouté à l'écran d'accueil s'ouvre comme une app ; le navigateur ne propose pas lui-même l'installation | écran d'aide « Partager → Sur l'écran d'accueil » |
| Stockage : jusqu'à 60 % du disque par site depuis Safari 17 ; demande de stockage persistant (`persist()`) supportée ; l'app installée a un stockage séparé de Safari (sources de 2020 à 2023) | demander `persist()` ; faire installer l'app avant toute saisie, sinon il faut se reconnecter et les données locales sont perdues (déduit) |
| Synchronisation en arrière-plan (Background Sync) : Chrome et dérivés seulement | synchroniser au lancement, au retour du réseau, au retour au premier plan et après chaque série |
| Minuteur de repos : timers ralentis en arrière-plan, aucune notification locale programmable, pas de vibration sur iOS | stocker l'heure de fin ; garder l'écran allumé (Wake Lock, dans l'app installée à partir d'iOS 18.4) ; notification envoyée par le serveur (iOS 16.4 ou plus, app installée, réseau nécessaire) |
| Lecture de codes-barres (`BarcodeDetector`) absente d'iOS et de Firefox | bibliothèque de remplacement zxing-wasm (environ 1 Mio) servie par notre serveur, en v2 |

| Option de stack (non comparées par les rapports) | Avantages | Inconvénients |
|---|---|---|
| A. Application monopage Vite (React, Vue ou Svelte) + API Node séparée + `vite-plugin-pwa` | le hors-ligne le plus simple : l'interface est mise en cache d'avance, pas de rendu côté serveur | `vite-plugin-pwa` 2.0.0 (sortie le 03/10/2026) sera gelé au profit de `@vite-pwa/core` et d'une copie de Workbox : migration probable |
| B. Next.js 16 + Serwist 9.5 | recommandé par le guide officiel de Next.js ; Serwist est activement maintenu | serveur Node et rendu côté serveur : complexité inutile pour une app derrière connexion, sans besoin de référencement |
| C. SvelteKit ou Nuxt + `@vite-pwa/*` | intégration PWA fournie | intégrations peu mises à jour, et en dernier |

**Recommandation** (le choix des outils est déduit)
- **Option A**, avec le service worker en mode `injectManifest` : le code du service worker est le nôtre et l'outil se contente d'y injecter la liste des fichiers à mettre en cache. Cela limite l'impact du changement d'outillage.
- Mises à jour en mode `prompt`, proposées seulement en dehors d'une séance ; `sw.js` servi en `no-cache`.
- TypeScript partout. Les schémas Zod sont partagés entre la PWA, l'API, les programmes JSON et le coach IA.
- **Côté téléphone**, avec Dexie 4 (une surcouche d'IndexedDB) :
  - chaque série est enregistrée localement dès sa validation, puis placée dans une file d'envoi ;
  - les identifiants (UUIDv7) sont générés sur le téléphone, et le serveur les insère ou les met à jour (`ON CONFLICT (id)`) : un renvoi ne crée donc pas de doublon ;
  - séances et séries ne sont jamais modifiées, seulement ajoutées ;
  - les autres modifications suivent la règle « la dernière écriture gagne », champ par champ, avec un numéro de version tenu par le serveur ;
  - une suppression laisse une marque au lieu d'effacer la ligne ;
  - export JSON/CSV disponible.
- Pas de moteur de synchronisation tout fait : Dexie Cloud (0,12 € par utilisateur et par mois, ou 3 495 € en auto-hébergé), PowerSync et ElectricSQL sont surdimensionnés pour ce besoin.
- **Cache** : l'interface est mise en cache d'avance. Les images restent en cache avec expiration, et un bouton « télécharger la bibliothèque » permet de tout récupérer. Les lectures de l'API passent d'abord par le réseau, avec un délai court avant de se rabattre sur le cache.
- **Côté serveur**
  - API Node (Fastify ou Hono, non comparés) et PostgreSQL 18, qui génère nativement des UUIDv7.
  - ORM à choisir entre Drizzle et Prisma (non comparés).
  - Authentification avec Better Auth : passkeys et limitation du nombre de tentatives. Lucia est abandonné, Auth.js a été repris par Better Auth.
  - Mots de passe hachés en Argon2id, natif à partir de Node 24.7.
- **Tests** : scénarios hors réseau automatisés, puis essais sur de vrais iPhone (iOS 18.4 ou plus) et Android (déduit : aucun rapport ne propose de stratégie de test).

**Confiance** : haute pour les principes du hors-ligne et les limites d'iOS ; faible à moyenne pour le framework, le backend et l'ORM.

### 4. Moteur IA

| Modèle (identifiant) | Prix en $ par million de tokens (entrée / sortie) | Lecture du cache | Maintenu au moins jusqu'au | Remarque |
|---|---|---|---|---|
| Claude Opus 5.5 (`claude-opus-5-5`) | 4 / 20 | 0,20 | 22/09/2027 | la réflexion ne se désactive pas et elle est facturée comme de la sortie ; niveau d'effort `medium` par défaut |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | 2 / 10 | 0,20 | 28/09/2027 | niveau d'effort `high` par défaut : à fixer explicitement, sinon le coût estimé est sous-évalué |
| Claude Haiku 4.5 | 1 / 5 | 0,10 | 15/10/2026 | à écarter |

**Fonctionnement de l'API (vérifié)**
- Traitement par lots (Batch) 50 % moins cher.
- Cache de prompt actif à partir de 512 tokens.
- Sorties structurées et outils en mode `strict` en production, mais sans `minimum`, `maximum` ni `minLength` : les limites métier (séries, répétitions, kcal) se vérifient dans notre code.
- Forcer l'usage d'un outil (`tool_choice` forcé) renvoie une erreur 400 sur Opus et Sonnet 5.5. Il faut aussi gérer les refus des filtres de sécurité (`stop_reason: "refusal"`).
- Palier de départ (Start) : 1 000 requêtes par minute et 500 $ de dépense par mois au maximum. Une nouvelle organisation peut démarrer sur un palier plus bas.

| Option | Avantages | Inconvénients |
|---|---|---|
| A. API Claude en direct | meilleure qualité perçue en français (compar:IA : 1 191 pour Opus 5.5) ; outils stricts, cache, Batch ; environ 1 $ par utilisateur et par mois | traitement hors UE (régions `us` ou `global` seulement, aucune résidence UE possible) ; données supprimées sous 30 jours, gardées jusqu'à 2 ans si un filtre de sécurité les signale ; dépendance à un fournisseur qui fait évoluer son API vite |
| B. Claude via Google Cloud, région multiple `eu` | mêmes modèles, traitement dans l'UE | 10 % plus cher ; pas de Batch ; compte Google Cloud à gérer ; disponibilité d'Opus et Sonnet 5.5 en `eu` non confirmée |
| C. Mistral | données hébergées dans l'UE par défaut, entreprise française | transferts temporaires possibles vers des sous-traitants hors UE ; prix, durée de conservation et qualité non étudiés (seul indice, compar:IA : 1 058) |
| D. Modèle local sur processeur | aucune donnée ne sort, aucun coût par requête | modèle 8B sur Ryzen 9 5950X : lecture du prompt à environ 100 tokens/s, génération à 10,5 tokens/s, soit 50 à 90 s avant le premier mot pour 9 000 tokens de contexte (déduit) ; 2 à 9 tokens/s sur un mini-PC N150 ; une seule requête à la fois par défaut ; partage la mémoire avec PostgreSQL |
| E. Modèle local sur carte graphique | premier mot en 3 à 6 s, données locales | RTX 5060 Ti 16 Go à 550-900 €, rentable seulement au-delà de 30 à 60 utilisateurs actifs sur 2 ans (déduit) ; qualité inférieure en français et sur la sécurité |
| F. Hybride derrière une interface unique | résilience, changement de modèle par simple configuration | deux chemins à tester et à maintenir |

Le chiffre « jusqu'à 25 tokens/s sur processeur » avancé par le rapport PWA ne repose sur aucune source. Les scores compar:IA mesurent des préférences d'utilisateurs, pas l'exactitude des réponses.

**Coût estimé** (déduit, avec ces hypothèses : 20 échanges et 2 programmes par mois, 9 000 tokens d'entrée par appel dont 65 % lus en cache, 800 tokens de sortie par échange)

| | Opus 5.5 | Sonnet 5.5 |
|---|---|---|
| Utilisateur type | 1,13 $/mois | 0,58 $/mois |
| Sans cache | 1,73 $ | 0,87 $ |
| Gros utilisateur (100 échanges) | 4,6 $ | 2,4 $ |
| 10 utilisateurs types | environ 11 $ | environ 6 $ |

**Compromis** : il faut arbitrer entre la qualité en français (Claude en tête) et la localisation des données (UE ou local). Le modèle local sur processeur est trop lent pour du chat. Le coût reste négligeable à notre échelle dans tous les cas.

**Recommandation**
- **Une interface interne `CoachModel`**
  - Elle gère la génération, le streaming, les outils, le format de sortie et le calcul du coût à partir du champ `usage`.
  - Elle a un adaptateur par fournisseur (Anthropic, Google Cloud, Mistral, Ollama), et la liste des modèles est dans un fichier de configuration.
  - À éviter : le mode de compatibilité Anthropic d'Ollama (ni cache ni Batch) et la bibliothèque AI SDK `ai` (3 versions majeures en 11 mois).
- **Le fournisseur dépend du public visé.**
  - Cercle privé informé : Claude en direct, Opus 5.5 avec un effort `low` pour le chat et `medium` pour la génération de programmes.
  - App ouverte au public, ou exigence de rester dans l'UE : Google Cloud en région `eu`, ou Mistral.
  - Le rapport coach et le rapport juridique ne s'accordent pas sur ce point. On tranchera par une évaluation comparative sur le même jeu de tests.
- **Pas de LLM local** dans le chemin critique tant qu'il n'y a pas de carte graphique.
- **Architecture**
  - Contexte envoyé dans l'ordre qui maximise le cache : outils, prompt système figé, dossier de l'utilisateur, mémoire, 10 derniers échanges.
  - Outils : `search_exercises`, `get_history`, `get_records`, `compute_nutrition_targets` (le calcul est fait par notre code), `propose_program`, `flag_safety`.
  - Le modèle propose un programme en JSON. Zod vérifie que les exercices existent et conviennent au matériel, que le nombre de séries reste dans les limites et que les contre-indications sont respectées. Le modèle a 2 essais au plus, puis l'utilisateur confirme.
  - Le coach ne s'appuie que sur les fiches relues. Les textes importés sont traités comme des données, jamais comme des instructions (protection contre l'injection de prompt). Les prompts ne contiennent ni nom ni e-mail.
- **Limites d'usage** : environ 50 messages par jour, un plafond en dollars par utilisateur (par exemple 3 $/mois), une longueur de réponse bornée (`max_tokens`) et une limite de dépense sur le compte Anthropic. Au-delà, le coach passe en mode dégradé.
- **Évaluation**
  - Environ 100 cas en français : programmes maison, salle et loisir ; progression ; nutrition ; sécurité ; tentatives de contournement ; questions hors sujet.
  - Chaque cas est joué 3 fois, pour environ 10 à 20 $ par campagne (déduit).
  - Seuils : 100 % de réussite sur les cas de sécurité (bloquant), au moins 95 % de programmes valides du premier coup.
  - Relecture de 20 à 30 cas par un coach diplômé ou un diététicien.

**Confiance** : haute pour les prix, les limites et la question de la résidence des données ; moyenne pour les coûts estimés ; le choix du fournisseur dépend du public visé.

### 5. Périmètre nutrition v1

| Périmètre | Effort (estimation) | Avantages | Inconvénients |
|---|---|---|---|
| A. Objectifs chiffrés + conseils + suivi du poids | 1 à 2 semaines | couvre l'essentiel pour la muscu : énergie, protéines, tendance du poids ; aucune dépendance externe ; risque de troubles alimentaires (TCA) plus faible | les apports réels ne sont pas mesurés, donc les ajustements sont lents (2 à 3 semaines) |
| B. A + ajout rapide de protéines/kcal + recherche dans Ciqual 2025 | non estimé | Ciqual : 3 484 aliments, licence Etalab 2.0, un fichier XLSX de 1,5 Mo | valeurs manquantes (« - », « traces », « < x ») ; noms d'aliments peu naturels |
| C. Journal alimentaire complet : Ciqual + copie locale d'Open Food Facts (OFF) + scan | 6 à 10 semaines | à égalité avec Yazio ; 1,27 million de produits vendus en France, dont 943 239 avec tableau nutritionnel | voir ci-dessous |

Inconvénients du périmètre C :
- Quotas d'OFF : 15 requêtes par minute et par IP en lecture, 10 en recherche, recherche pendant la frappe interdite. Il faut donc une copie locale (export CSV de 1,28 Go compressé).
- Obligations de la licence ODbL si l'app est publique.
- Pas de lecture native des codes-barres sur iOS.
- L'assiduité s'effondre : avec MyFitnessPal, on passe de 5,4 à 1,4 jour de saisie par semaine entre la 4e et la 12e semaine.
- Ces applis sont associées à davantage de troubles alimentaires (38 études, sans lien de causalité établi).

**Calcul des objectifs** (code versionné ; les seuils marqués « déduit » sont à valider)
- **Métabolisme de base** : formule de Mifflin-St Jeor. Elle est validée de 19 à 78 ans mais biaisée chez les sportifs ; la formule de Ten-Haaf, qui place 80,2 % des sportifs à ±10 %, est une alternative à évaluer. La formule de Katch-McArdle ne sert que si l'on connaît un pourcentage de graisse fiable.
- **Dépense totale** : métabolisme de base multiplié par le niveau d'activité de la FAO (1,40 à 1,69 sédentaire, 1,70 à 1,99 actif, 2,00 à 2,40 très actif).
- **Objectif**
  - perte : 0,5 à 1 % du poids par semaine, avec un déficit plafonné à 25 % de la dépense (déduit) ;
  - prise : 0,25 à 0,5 % par semaine, avec un surplus de 10 à 15 % ;
  - ou maintien.
- **Répartition**
  - protéines : 1,6 g/kg (plage 1,6 à 2,2). Au-delà d'environ 1,62 g/kg, on ne gagne plus de masse maigre ;
  - lipides : au moins le plus élevé de 0,6 g/kg et 20 % des kcal (déduit) ;
  - fibres 30 g ; eau totale 2,0 L pour les femmes, 2,5 L pour les hommes ; le reste en glucides ;
  - objectifs affichés sous forme de fourchettes.
- **Ajustement** : moyenne du poids sur 7 jours glissants. Si la tendance s'écarte de l'objectif pendant 2 à 3 semaines, on ajuste de ±100 à 150 kcal (déduit).

**Garde-fous**
- Aucun objectif chiffré avant 18 ans.
- En cas de TCA, de grossesse, d'allaitement ou de pathologie : pas de déficit, et orientation vers un professionnel.
- Numéro de la ligne d'écoute sur les TCA : le 09 69 325 900. Le rapport nutrition donnait le 0810 037 037, remplacé en mai 2023 ; les horaires restent à vérifier.
- Jamais en dessous du métabolisme de base estimé ; aucun déficit si l'IMC est inférieur à 18,5 ; garder au moins 30 kcal par kg de masse maigre une fois la dépense de l'exercice déduite (seuil de disponibilité énergétique).
- Un mode « sans chiffres » proposé à tous.
- Vocabulaire : « repère » et « estimation », jamais « régime », « prescription » ou « traitement ».
- Le LLM explique les objectifs, il n'en fixe aucun.

**Recommandation** : périmètre A en v1, B en v1.1, C en v2.
- En v2 :
  - copie locale d'OFF limitée à la France et mise à jour chaque jour ;
  - appel à l'API d'OFF seulement pour un code-barres inconnu, avec un User-Agent identifiant l'app ;
  - attribution ODbL respectée ;
  - lecture native des codes-barres quand elle existe, sinon bibliothèque de remplacement servie par notre serveur, et saisie manuelle en secours.
- Tables v1 : `nutrition_profile`, `body_metric`, `nutrition_target` (versionnée : méthode, `algo_version`, données d'entrée) et `nutrition_checkin`.

**Confiance** : haute pour le périmètre A et les garde-fous ; moyenne pour les seuils déduits et le calendrier de B et C.

### 6. Programmes et progression

**Principes** (position de l'ACSM, 2026 : 137 revues systématiques, plus de 30 000 participants)
- Au moins 2 séances par semaine.
- Au moins 10 séries par muscle et par semaine pour l'hypertrophie, au moins 80 % de la charge maximale (1RM) pour la force.
- Ni l'échec musculaire ni une périodisation complexe ne sont nécessaires.
- S'arrêter à 2 ou 3 répétitions de l'échec suffit. On parle de RIR, pour « répétitions en réserve ».
- Il suffit de couvrir le haut et le bas du corps, en poussée et en tirage.

| Réglage par défaut | Débutant (moins de 6 mois) | Intermédiaire |
|---|---|---|
| Fréquence | 2 à 3 séances full body | chaque muscle au moins 2 fois par semaine, sur 3 à 6 séances |
| Séries par muscle et par semaine | 6 à 10, en montant vers 10 | 10 à 20 (une série où le muscle ne travaille qu'en appoint compte pour 0,5) |
| Répétitions | 8 à 12 ; 5 à 8 sur les exercices polyarticulaires | force : 3 à 6 ; hypertrophie : 6 à 15 |
| Effort | RIR 2 à 3 | RIR 1 à 3 en polyarticulaire, 0 à 2 en isolation |
| Repos | 2 à 3 min en polyarticulaire, 60 à 90 s en isolation | idem ; 3 à 5 min au-delà de 85 % du 1RM |
| Semaine allégée (deload) | seulement en cas de besoin | toutes les 4 à 6 semaines (environ 1 semaine), ou en cas de besoin |

Les pratiquants sous-estiment leur RIR d'environ 1 répétition, et l'estiment mieux sous 12 répétitions. On ne demande donc un RIR que jusqu'à 12 à 15 répétitions.

| Option | Verdict |
|---|---|
| A. Programmes figés, écrits semaine par semaine (comme workout-cool) | simple, mais sans progression ni adaptation au matériel |
| B. Modèles écrits par nous + moteur de règles fixes + IA encadrée | **recommandé** : testable, fonctionne hors ligne, peu d'appels à l'IA |
| C. Séances générées par le LLM | résultats imprévisibles, coûteux, inutilisable hors ligne |
| D. Programmes connus, sous licence | StrongLifts est une marque déposée dans l'UE (n° 014288815, classes 9 et 41, jusqu'en 2035) ; Starting Strength et « JIM WENDLER 5/3/1 » sont des marques américaines ; il faudrait des accords avec les auteurs, comme l'a fait Boostcamp |

Le droit d'auteur protège les textes, pas les méthodes (accord ADPIC, art. 9.2). Le risque de parasitisme, propre au droit français, reste une hypothèse à faire valider par un juriste.

**Recommandation** : option B.
- **8 modèles en JSON**, versionnés et vérifiés par JSON Schema en CI, avec des noms descriptifs et des textes écrits par nous :
  - salle : S1 full body A/B sur 3 jours, débutant ; S2 haut/bas sur 4 jours ; S3 Push/Pull/Legs deux fois par semaine, 5 à 6 jours ;
  - maison : M1 sans matériel, 3 jours ; M2 avec un minimum de matériel, haut/bas sur 4 jours ;
  - loisir : L1 santé, 2 jours de 30 à 40 min en supersets ; L2 complément à la course ou au vélo, 2 jours ; L3 complément aux sports à pivots ou de raquette, 2 jours.

  L3 s'appuie notamment sur le Nordic (−51 % de blessures aux ischio-jambiers) et sur l'exercice des adducteurs de Copenhague (−41 % de problèmes d'aine).
- **6 règles de progression**
  - linéaire : +2,5 kg pour le haut du corps, +5 kg pour le bas ; après 3 échecs de suite, −10 % ;
  - double progression : on monte d'abord les répétitions jusqu'au haut de la fourchette, puis la charge ;
  - somme des répétitions, quand le plus petit incrément de charge dépasse 10 % (cas des haltères) ;
  - par RIR et 1RM estimé : estimation selon la formule d'Epley sur les répétitions faites plus le RIR, charge arrondie au matériel disponible, variation de ±5 % au plus ;
  - chaîne au poids du corps : après 2 séances en haut de fourchette, on passe à la variante plus difficile ;
  - durée : +5 s par séance, jusqu'à 45 à 60 s.
- **Règles communes**
  - stagnation : 3 séances sans progrès du 1RM estimé, alors −10 % ou une autre fourchette de répétitions, puis un exercice de remplacement ;
  - semaine allégée : 40 à 50 % de séries en moins, RIR augmenté de 2, même fréquence ;
  - remplacement : même type de mouvement, matériel disponible, mêmes muscles ;
  - ces seuils sont des conventions réglables, à valider sur nos propres données.
- **Données à enregistrer**
  - pour chaque série : type, charge et façon de la compter, répétitions ou durée, RIR au demi-point près, copie des objectifs, repos réel, côté, douleur de 0 à 10, exercice réellement fait ;
  - pour chaque séance : début et fin, poids de corps, forme de 1 à 5, effort ressenti multiplié par la durée, indicateur de semaine allégée.

  Si une donnée manque, le moteur ne change rien. Une douleur signalée suspend la progression.
- **Rôle de l'IA** : elle propose des modifications du programme en JSON, dans des limites fixées. Elles sont vérifiées par schéma puis confirmées par l'utilisateur.
- **Ordre de livraison** : d'abord les progressions linéaire, double et en chaîne (S1, M1, L1) ; puis le RIR, le 1RM estimé et les semaines allégées (S2, S3, M2) ; enfin L2 et L3.
- wger et Liftosaur, sous AGPL, servent de source d'idées, pas de code, sauf si appsport passe lui-même sous AGPL.

**Confiance** : haute pour les principes et le statut des marques au 06/10/2026 ; moyenne pour les seuils du moteur.

### 7. Onboarding et « ma salle »

Repères : Boostcamp pose 4 questions et Hevy Trainer 6. Fitbod enchaîne environ 29 écrans, crée le compte après le questionnaire et gère plusieurs profils de salle.

**Options**
- Onboarding court (7 écrans) ou long, à la Fitbod. Le long personnalise mieux, mais fait abandonner et collecte trop tôt des données de santé.
- « Ma salle » en saisie simple, ou base de salles géolocalisée. La base impose de fusionner des doublons, de respecter la licence ODbL et de maintenir un import.

**Recommandation : 7 écrans, moins de 2 minutes**
1. Âge (18 ans minimum) et objectif : muscle, force, perte de gras, forme et santé, compléter mon sport.
2. Où t'entraînes-tu ? Plusieurs réponses possibles, un profil par lieu :
   - salle : enseigne et ville, puis un modèle de matériel pré-coché à valider ;
   - maison : poids du corps seul, petit matériel (barre de traction, élastiques, haltères) ou home gym (avec l'inventaire des disques) ;
   - sport loisir : quel sport, combien de fois par semaine.
3. Expérience : jamais, moins d'un an, 1 à 3 ans, plus de 3 ans.
4. Nombre de jours par semaine et durée des séances.
5. Douleurs et zones sensibles, et 3 ou 4 questions d'alerte inspirées du questionnaire médical PAR-Q+. Écran facultatif, avec un consentement santé à part ; une réponse à risque active un mode prudent.
6. Mesures, facultatives : elles peuvent attendre le module nutrition.
7. Programme recommandé et 2 alternatives, puis création du compte (passkey) et première séance.

En début de séance, un écran « Aujourd'hui je suis à… » change de profil de lieu et remplace les exercices impossibles. Sur iOS, il faut faire installer l'app avant l'onboarding : les données saisies dans Safari ne passent pas dans l'app installée (déduit).

**« Ma salle »**
- Aucune chaîne ne publie l'inventaire de ses machines ; Basic-Fit, par exemple, ne décrit que des zones. Il faut donc des modèles de matériel par type de salle (chaîne low-cost, salle de quartier, box CrossFit, salle municipale, maison), que l'utilisateur corrige. Ils reposent sur la même liste d'une vingtaine de matériels que le catalogue.
- En V1 : enseigne choisie dans une liste courte, nom libre et modèle de matériel à cocher, sans géolocalisation.
- En V2 : une base locale de moins de 25 000 salles (quelques Mo), interrogée sur notre serveur, car le service de géocodage Nominatim interdit la recherche pendant la frappe. Les profils de matériel y sont partagés par salle. Elle fusionne trois sources :
  - Data ES (ministère des Sports) : 8 084 salles de musculation ou de cardio et 1 096 aires de street workout, sous Licence Ouverte 2.0, avec une API mise à jour chaque jour ;
  - OpenStreetMap : 4 436 salles et 8 762 équipements de plein air, sous ODbL ; couvre environ les trois quarts des 894 clubs Basic-Fit ;
  - All The Places : sous CC0, mais la collecte Basic-Fit manque à la dernière mise à jour.

**Confiance** : moyenne à haute. Deux points restent à clarifier : le sens de « sport loisir » et l'usage du nom de la salle.

### 8. RGPD / AI Act selon le public visé

Constat : le poids croisé avec les apports alimentaires ou l'activité, ainsi que les blessures, sont des données de santé (CNIL ; la Cour de justice de l'UE, dans l'arrêt C-21/23, en retient une définition large). Les séries et les charges seules n'en sont a priori pas. Mais une fois rattachées au profil de l'utilisateur, il vaut mieux les traiter de la même façon (déduit).

| Obligation | (a) Nous et nos proches | (b) App ouverte au public |
|---|---|---|
| Application du RGPD | l'exemption pour usage domestique est plausible mais pas garantie : le considérant 18 soumet au RGPD celui qui fournit les moyens du traitement | RGPD intégral |
| Base légale pour les données de santé | consentement explicite conseillé | consentement explicite (art. 9.2.a), distinct de l'acceptation des CGU, et un consentement séparé pour le coach IA |
| Registre des traitements | conseillé | obligatoire : l'exemption pour les structures de moins de 250 salariés ne s'applique pas aux données de santé |
| Analyse d'impact (AIPD) | non | très probable (santé + IA), à faire avec l'outil PIA de la CNIL |
| Droits et conservation | export et suppression | export JSON/CSV et suppression du compte par l'utilisateur lui-même ; comptes inactifs supprimés après 2 ans et une relance ; journaux gardés 6 à 12 mois, sans données de santé ni prompts |
| Fuite de données | prévenir les proches | notification à la CNIL sous 72 h et registre des incidents |
| Âge minimum | 18 ans | 18 ans recommandés : on peut consentir seul dès 15 ans en France, mais Anthropic considère toute personne de moins de 18 ans comme mineure et impose alors des garde-fous supplémentaires |
| Mentions légales | sans objet | loi LCEN, art. 1-1 : en auto-hébergement, c'est nous l'hébergeur, donc notre adresse risque d'apparaître ; une association loi 1901 l'éviterait (déduit). Les obligations du règlement européen DSA n'ont pas été étudiées |
| Envoi des données à l'IA | consentement éclairé | Claude en direct = traitement hors UE, encadré par des clauses contractuelles types. Le cadre de transfert UE–États-Unis (DPF) a été validé par le Tribunal de l'UE en septembre 2025 (T-553/23), mais reste fragile : un pourvoi est en cours et l'organe de contrôle américain (PCLOB) n'a plus de quorum. Alternatives : Google Cloud en région `eu`, Mistral, ou un modèle local sans aucun transfert |

**AI Act**
- Pas de « haut risque » : appsport est un logiciel de bien-être, pas un dispositif médical, tant qu'il ne pose aucun diagnostic et ne propose aucun traitement.
- Article 50(1), en vigueur depuis le 2 août 2026 : il faut informer l'utilisateur qu'il parle à une IA, au plus tard lors de sa première interaction. Anthropic l'exige au début de chaque session. Publier le code en open source ne dispense pas de cette obligation (art. 2.12). Amendes : jusqu'à 15 M€ ou 3 % du chiffre d'affaires.
- Article 50(2) : les textes générés doivent porter un marquage lisible par une machine. Le délai de grâce jusqu'au 2/12/2026 ne vaut que pour les systèmes déjà sur le marché avant le 2/08/2026, donc pas pour appsport. Les règles pour les textes courts restent floues ; on ajoutera une métadonnée `ai_generated` (déduit).
- **(incertain)** Le règlement 2026/1744 (« Omnibus » numérique), qui a modifié le calendrier de l'AI Act, n'a été lu que via des sources secondaires : le texte sur EUR-Lex était inaccessible.

**HDS (hébergement de données de santé certifié)**
- A priori pas requis : appli de bien-être, hébergée par son propre éditeur, sans professionnel de santé.
- **(incertain)** L'article L.1111-8 du Code de la santé publique vise aussi les données de « prévention » et l'hébergement « pour le compte du patient lui-même ». Aucun rapport ne discute ces termes : il faut un avis juridique avant toute ouverture au public.
- Elle devient obligatoire si des kinés, médecins ou diététiciens suivent leurs patients via l'app, avec en plus un stockage dans l'UE (décret 2026-209).

**Responsabilité**
- L'avertissement « ceci n'est pas un avis médical » est nécessaire mais ne protège pas de tout : face à un consommateur, une clause qui limite la responsabilité d'un éditeur professionnel est nulle.
- Ne jamais présenter l'IA comme un « diététicien » : c'est un titre protégé.
- Un coaching sportif payant exige un diplôme (Code du sport, art. L.212-1).
- Directive 2024/2853 : un logiciel mis sur le marché à partir du 9/12/2026 entre dans le régime de responsabilité du fait des produits défectueux.

**Sécurité**
- Connexion par passkeys (norme WebAuthn niveau 3). Mot de passe de secours haché en Argon2id : au moins 19 Mio de mémoire, 2 itérations, parallélisme de 1.
- Règles de la CNIL (recommandation 2022-100) : 12 caractères si le mot de passe est le seul facteur ; sinon 8 caractères, avec un délai entre les essais et 10 tentatives par heure au plus.
- Cookies HttpOnly, Secure et SameSite. Sans traceurs, pas besoin de bandeau cookies.

**Recommandation** : concevoir la V1 au niveau du scénario (b), même si le lancement se fait d'abord entre proches.
- Deux consentements distincts (santé, coach IA), champs santé facultatifs, pas de photos en V1.
- Export et suppression du compte en libre-service ; un registre d'une page.
- Mention « IA » et métadonnée `ai_generated` ; garde-fous médicaux ; 18 ans minimum.
- Avant toute ouverture au public : analyse d'impact simplifiée ; CGU, politique de confidentialité et avertissement santé relus par un juriste ; choix de la structure juridique.

**Confiance** : haute sur la qualification en données de santé et sur l'article 50(1) ; moyenne sur le détail de l'AI Act ; faible à moyenne sur l'HDS et les mentions légales en auto-hébergement.

## Périmètre MVP recommandé et découpage en sous-projets (ordre de construction)

**Une seule feuille de route.** Les rapports UX, nutrition et coach plaçaient le coach IA à des moments différents ; voici l'arbitrage retenu :
- **V1 (MVP)**
  - carnet de séance utilisable hors ligne ;
  - bibliothèque d'environ 150 exercices relus ;
  - onboarding et « ma salle » en version simple ;
  - programmes S1, M1 et L1, plus des routines personnelles, avec les progressions linéaire, double et en chaîne ;
  - nutrition, périmètre A ;
  - comptes, consentements et export.
- **V1.1**
  - coach IA ;
  - progression au RIR et au 1RM estimé, et semaines allégées (programmes S2, S3, M2) ;
  - ajout rapide de protéines et de kcal, et recherche dans Ciqual.
- **V2**
  - programmes L2 et L3 ;
  - journal alimentaire avec copie locale d'Open Food Facts et scan des codes-barres ;
  - base de salles géolocalisée et profils de matériel partagés ;
  - notification de fin de repos ;
  - import depuis Strong ou Hevy ;
  - fonctions sociales, si on les retient.

Le coach arrive en V1.1 pour trois raisons :
- sans historique de séances, il conseillerait à l'aveugle ;
- il dépend de trois décisions encore ouvertes : public visé, budget, localisation des données ;
- il demande des consentements, la mention « IA » et un jeu de tests réussi à 100 % sur les cas de sécurité.

Si l'IA doit être visible dès la V1, une version réduite peut expliquer le programme et les objectifs sans rien modifier. Confiance : moyenne.

| # | Sous-projet | Livrables clés | Prérequis |
|---|---|---|---|
| 0 | Dépôt GitHub et socle | dépôt, monorepo pnpm, licences, CI (lint, typage, tests, JSON Schema), Dependabot, `main` protégée, `.gitattributes`, dossier `docs/` contenant ce brief | questions 1 et 2 |
| 1 | Serveur et exposition | Linux + Docker Compose ; Caddy + domaine + HTTPS, ou Tailscale ; PostgreSQL 18 ; sauvegardes restic testées ; supervision ; CrowdSec ; disque chiffré (LUKS) | questions 3 et 4 ; à lancer tôt, car il faut un vrai HTTPS pour tester sur téléphone |
| 2 | Catalogue d'exercices | import wger relançable ; correspondance avec workout-guide ; liste des matériels et types de mouvement ; environ 150 fiches débutant relues ; page Crédits | un relecteur ; peut avancer en parallèle de 1 et 3 |
| 3 | Comptes, consentements, onboarding | Better Auth (passkeys, Argon2id, limitation des tentatives) ; barrière d'âge ; onboarding en 7 écrans ; profils de lieu et de matériel ; consentements distincts ; export et suppression ; récupération de compte sans e-mail (plusieurs passkeys, réinitialisation par l'administrateur) | 0, 1 |
| 4 | Carnet de séance hors ligne | voir le détail sous le tableau | 2, 3 |
| 5 | Programmes et moteur de progression | format des modèles ; S1, M1, L1 ; progressions linéaire, double, en chaîne et en durée ; exercices de remplacement ; tests unitaires | 2, 4 |
| 6 | Nutrition v1 | objectifs calculés et versionnés ; pesées et moyenne sur 7 jours ; bilan hebdomadaire ; modes complet, qualitatif et désactivé ; fiches conseils fondées sur le PNNS 2019 et la nutrition sportive | 3 |
| 7 | Coach IA (V1.1) | interface `CoachModel` et adaptateurs ; outils ; garde-fous ; mention « IA » ; limites d'usage ; jeu d'environ 100 tests en français ; relecture par un professionnel | question 5 ; sous-projets 4 à 6 |

Détail du sous-projet 4, le carnet de séance :
- **Données** : Dexie, file d'envoi avec identifiants UUIDv7, insertion côté serveur sans doublon.
- **Saisie**
  - ligne « préc. | kg | reps | valider » pré-remplie avec la séance précédente, que l'on recopie d'un tap ;
  - boutons ±2,5 kg et ±1 répétition ;
  - types de série et remplacement d'exercice.
- **Pendant la séance** : minuteur de repos fondé sur l'heure de fin et écran maintenu allumé (Wake Lock) ; reprise d'une séance interrompue.
- **Suivi** : historique, records, un graphique par exercice, poids de corps, calculateur de disques, export CSV.
- **Ergonomie** : aide à l'installation sur iOS ; boutons d'au moins 48 px en bas d'écran, clavier numérique, annulation possible des suppressions.
- **Tests** : hors réseau, puis sur de vrais appareils.

## Risques principaux et parades

| Risque | Parade |
|---|---|
| Contrefaçon : contenus d'exercices copiés, noms de programmes déposés | wger et fiches écrites par nous ; noms descriptifs ; licence et auteurs indiqués pour chaque entrée ; page Crédits ; aucun import de free-exercise-db, hasaneyldrm ni de la version gratuite d'ExerciseDB |
| Origine inconnue d'environ 830 dessins workout-guide (un seul mainteneur, dépôt inactif) | version figée ; question posée à l'auteur ; repli sur Everkinetic ou sur des dessins maison |
| Conseil dangereux : blessure, déficit extrême, TCA, grossesse, dopage | chiffres calculés par le code ; propositions de l'IA bornées et vérifiées ; fiches relues ; questionnaire d'alerte ; refus de tout diagnostic ; orientation vers un médecin ou un kiné, le 15 ou le 112, Écoute Dopage (0 800 15 2000, numéro à revérifier) et la ligne TCA (09 69 325 900) ; 100 % exigé sur les tests de sécurité ; 18 ans minimum |
| Fuite de données de santé : faille logicielle, vol du serveur | disque chiffré (LUKS) ; sauvegardes chiffrées ; journaux sans données de santé ; mises à jour automatiques ; seul Caddy exposé ; procédure de notification sous 72 h |
| Données de santé chez un tiers : IA hors UE, cadre de transfert fragile, intermédiaire qui déchiffre le trafic | consentement spécifique ; prompts sans nom ni e-mail ; adaptateur UE prêt ; pas de Cloudflare devant le serveur |
| CGNAT impossible à lever, adresse IP du domicile exposée | IPv4 complète demandée au FAI ; repli sur un VPS relais sans déchiffrement, ou sur Tailscale privé ; CrowdSec |
| Perte d'une séance ou de données locales : stockage du téléphone vidé, plusieurs appareils, stockage iOS séparé entre Safari et l'app | enregistrement à chaque série ; file d'envoi ; un identifiant unique par série ; stockage persistant demandé ; export ; installation de l'app avant toute saisie |
| Limites d'iOS : minuteur figé en arrière-plan, ni vibration ni synchronisation en arrière-plan, notifications seulement si l'app est installée | écran maintenu allumé ; heure de fin stockée ; notification envoyée par le serveur (V2) ; tests sur iPhone ; limites expliquées dans l'app |
| Serveur à domicile indisponible : courant, box, FAI | app conçue pour le hors-ligne ; onduleur ; sonde externe ; coach en mode dégradé |
| Dérive des coûts de l'IA : abus, boucles d'appels d'outils, plafond de 500 $/mois du palier de départ | plafonds par utilisateur ; longueur des réponses bornée ; limite de dépense ; alertes ; cache ; niveau d'effort fixé explicitement |
| Dépendances instables : Haiku 4.5 retirable dès le 15/10/2026, `vite-plugin-pwa` gelé, ruptures de l'API wger en v2.5 et v2.6, certificats à 45 jours en 2028 | interface `CoachModel` et liste de modèles en configuration ; service worker en mode `injectManifest` ; copie des données versionnée ; Dependabot ; renouvellement des certificats surveillé |
| E-mails non reçus : port 25 filtré, IP résidentielle mal réputée | service d'envoi européen avec SPF, DKIM et DMARC, ou pas d'e-mail du tout en cercle privé |
| Requalification réglementaire : une allégation médicale ferait de l'app un dispositif médical ; titre de diététicien | vocabulaire « repère » et « estimation » ; aucun diagnostic ; aucune mention de maladie |
| Dérive du périmètre : journal alimentaire, base de salles, fonctions sociales | s'en tenir à la feuille de route V1, V1.1, V2 |

**Incertitudes à lever**
- **Cadre juridique**
  - AI Act : le règlement 2026/1744 n'a été lu que via des sources secondaires, et les règles de marquage des textes courts (art. 50(2)) restent floues ;
  - HDS : portée des termes « prévention » et « pour le compte du patient » ;
  - mentions légales LCEN et obligations du DSA quand on héberge soi-même ;
  - risque de parasitisme ;
  - interprétation de la licence ODbL.
- **Fournisseurs d'IA** : disponibilité d'Opus et Sonnet 5.5 dans la région `eu` de Google Cloud ; prix, durée de conservation et sous-traitants de Mistral.
- **Données et contenus**
  - origine des traductions françaises de wger, probablement automatiques ;
  - origine des dessins de workout-guide ;
  - présence dans wger des exercices de progression qui manquent.
- **Matériel du serveur** (OS, processeur, carte graphique, disques, onduleur) : les estimations de mémoire libre (9 à 12 Go) et de vitesse d'un LLM local en dépendent.
- **Sources anciennes ou indirectes**
  - procédures CGNAT de Bouygues et SFR (blog et forum de 2023) ;
  - politique de stockage d'iOS (sources de 2020 à 2023) ;
  - fiche Écoute Dopage (2021) et horaires de la ligne TCA ;
  - prix estimés (VPS, domaine, Hetzner) ; tarif de Yazio, publié par un concurrent.
- **Stack** : framework front, backend et ORM n'ont pas été comparés.

## Questions ouvertes à nous poser (classées par importance)

**Avant de créer le dépôt et de démarrer**
1. Public visé :
   - nous et nos proches, ou une ouverture au public, et à quelle échéance ?
   - combien d'utilisateurs maintenant, et dans 12 mois ? Jusqu'à 6, Tailscale est gratuit.
   - une monétisation est-elle envisagée (abonnement, coaching payant, publicité) ?
2. Dépôt GitHub :
   - privé ou public ? Sur un compte personnel ou une organisation, et sous quel nom ?
   - quelle licence pour le code : MIT, Apache-2.0 ou AGPL-3.0 ?
   - accepte-t-on de publier les fiches d'exercices sous CC BY-SA 4.0 ? C'est obligatoire si l'on part de wger.
3. Serveur :
   - quel système (Linux, Windows, Proxmox, Unraid, TrueNAS…) ? Est-il dédié à ce projet ou partagé ?
   - quel processeur exact, quelle carte graphique (modèle, mémoire vidéo), quels disques (SSD ou HDD, RAID) ?
   - y a-t-il un onduleur ?
4. Réseau :
   - quel FAI et quelle box ? Fibre ou ADSL ? Quel débit montant ? L'IPv4 est-elle actuellement partagée ?
   - est-on d'accord pour demander une IPv4 complète (irréversible chez Free) ?
   - a-t-on déjà un nom de domaine ? Chez quel registrar, et propose-t-il une API pour le DNS ?
5. Coach IA :
   - quel budget mensuel maximum, et quel plafond par utilisateur ?
   - un traitement aux États-Unis (Claude en direct) est-il acceptable, y compris pour traduire et enrichir les fiches d'exercices ? Ou faut-il rester dans l'UE (région `eu` de Google Cloud à +10 %, ou Mistral), voire tout faire en local (carte graphique à 550-900 €) ?
6. Équipe : qui développe, à quel rythme ? Avec quelles compétences front (React, Vue, Svelte, Next.js) ?

**Avant les sous-projets concernés**
7. Âge minimum : 18 ans (recommandé avec Claude) ou 16 ans ?
8. Relecture : un coach diplômé (BPJEPS, STAPS), un diététicien ou un médecin du sport peut-il relire les fiches, le prompt du coach et un échantillon de réponses ?
9. « Sport en loisir » : veut-on dire un autre sport complété par de la muscu, ou de la muscu sans objectif de performance ? Quels sports proposer au lancement ?
10. « Ma salle » :
    - à quoi sert le nom de la salle : inventaire du matériel, partage entre proches ?
    - décrit-on le matériel par familles ou machine par machine ?
    - quelles salles et quelles enseignes fréquente-t-on ?
    - une recherche de salle géolocalisée est-elle utile dès la V1 ?
11. Téléphones : quelle part d'iPhone, et sous quelle version d'iOS (18.4 ou plus) ? Un minuteur sans vibration est-il acceptable ? Les notifications sont-elles indispensables ?
12. Nutrition :
    - une v1 sans journal alimentaire convient-elle, ou le scan est-il indispensable dès le départ ?
    - quels régimes gérer : végétarien, végan, halal, sans lactose, allergies ?
    - comment demander le sexe utilisé par la formule (avec une option « préfère ne pas dire ») ? Faut-il demander le pourcentage de graisse ?
    - faut-il parler des compléments (créatine, whey) ?
    - pesée quotidienne ou hebdomadaire ?
13. Coach :
    - doit-il seulement proposer, ou peut-il modifier programmes et objectifs après confirmation ?
    - quelle latence est acceptable (premier mot en moins de 3 s) ?
    - tutoiement ou vouvoiement ? Quels nom et ton ?
    - combien de temps garder les conversations ? Peut-on désactiver l'IA ?
14. Visuels : dessins SVG, photos, GIF ou vidéos ? Y a-t-il un budget pour un pack commercial (ExerciseDB à 199 ou 599 $) ou pour filmer nos propres vidéos ?
15. Catalogue v1 : environ 150 exercices relus, ou les 917 de wger avec un statut « non relu » ?
16. Comptes : sur invitation seulement ? Passkeys, mot de passe ou lien magique ? Faut-il envoyer des e-mails ?
17. Programmes :
    - noms descriptifs uniquement ?
    - afficher le RIR, ou une échelle simple (facile, correct, difficile, échec) convertie en RIR en coulisse ?
    - tests de charge maximale (1RM), ou seulement des estimations ?
    - kilos uniquement ?
    - faut-il l'inventaire précis du matériel (plus petits disques, incréments des haltères) ?
18. Exploitation : qui administre le serveur ? Où placer la sauvegarde hors domicile : stockage cloud européen payant ou disque chez un proche ? Quelle disponibilité attend-on ?

**Plus tard**
19. Photos de progression (déconseillées en V1) ? Fonctions sociales ? Import depuis Strong ou Hevy ?
20. Publics particuliers (plus de 60 ans, reprise après blessure, grossesse) : les exclure, les orienter vers un professionnel, ou leur proposer des modèles dédiés ? Faut-il gérer un calendrier sportif pour éviter une séance lourde dans les 48 h avant un match ?
21. Contributions en retour : nos traductions vers wger, des produits manquants vers Open Food Facts ?
22. En cas d'ouverture au public :
    - quelle structure juridique : personne physique, association ou micro-entreprise ?
    - qui est responsable du traitement des données, avec quelle adresse de contact RGPD ?
    - des professionnels de santé suivront-ils des patients via l'app ? L'HDS deviendrait alors obligatoire.
    - une relecture juridique est-elle prévue ?

## Sources (liens)

- **Exercices** — [API wger exerciseinfo](https://wger.de/api/v2/exerciseinfo/?limit=1000) · [doc API wger](https://wger.readthedocs.io/en/latest/api/api.html) · [licence wger](https://github.com/wger-project/wger#license) · [matériels wger](https://wger.de/api/v2/equipment/) · [fixtures wger](https://github.com/wger-project/wger/tree/master/wger/exercises/fixtures) · [workout-guide](https://github.com/bryllim/workout-guide) · [ATTRIBUTION de workout-guide](https://github.com/bryllim/workout-guide/blob/main/ATTRIBUTION.md) · [Everkinetic](https://github.com/everkinetic/data) · [free-exercise-db](https://github.com/yuhonas/free-exercise-db) · [issue #2](https://github.com/yuhonas/free-exercise-db/issues/2) · [issue #13](https://github.com/yuhonas/free-exercise-db/issues/13) · [CONTRIBUTING de wrkout](https://github.com/wrkout/exercises.json/blob/master/CONTRIBUTING.md) · [archive bodybuilding.com 2019](https://web.archive.org/web/2019/https://www.bodybuilding.com/exercises/alternate-incline-dumbbell-curl) · [ExerciseDB V1](https://oss.exercisedb.dev/swagger) · [tarifs ExerciseDB](https://exercisedb.io/pricing) · [hasaneyldrm #5](https://github.com/hasaneyldrm/exercises-dataset/issues/5) · [licence RepDB](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md) · [workout-cool #66](https://github.com/Snouzy/workout-cool/issues/66) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/legalcode)
- **PWA et iOS** — [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) · [Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) · [Safari 27](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) · [Web Push iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [Safari 18.4 (Wake Lock)](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) · [stockage WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/) · [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10120/) · [DMA et moteurs de navigateur (OWA)](https://open-web-advocacy.org/blog/the-digital-markets-act-is-delivering-real-wins-but-not-yet-for-browser-engines/) · caniuse : [Background Sync](https://caniuse.com/background-sync), [Vibration](https://caniuse.com/vibration), [BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) · [Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers) · [ralentissement des timers dans Chrome](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) · [cycle de vie du service worker](https://web.dev/articles/service-worker-lifecycle) · [vite-plugin-pwa #933](https://github.com/vite-pwa/vite-plugin-pwa/issues/933) · [mode de mise à jour vite-pwa](https://vite-pwa-org.netlify.app/guide/auto-update) · [guide PWA de Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps) · [RFC 9562 (UUIDv7)](https://www.rfc-editor.org/rfc/rfc9562.html) · [PostgreSQL 18](https://www.postgresql.org/docs/18/release-18.html) · [tarifs Dexie Cloud](https://dexie.org/cloud/pricing) · [hors-ligne dans Liftosaur](https://www.liftosaur.com/blog/posts/offline-mode-in-liftosaur/)
- **Réseau et exploitation** — [CGNAT Orange (MacG)](https://www.macg.co/ailleurs/2025/01/orange-partage-son-tour-par-defaut-les-ipv4-pour-les-abonnes-adsl-et-fibre-148513) · [adresses IP Orange](https://assistance.orange.fr/livebox-modem/toutes-les-livebox-et-modems/installer-et-utiliser/piloter-et-parametrer-votre-materiel/le-parametrage-avance-reseau-nat-pat-ip/gerer-votre-adresse-ip/adresses-ip-les-elements-a-connaitre-_238182-760947) · [IPv4 full-stack Free](https://www.universfreebox.com/article/596643/le-saviez-vous-free-permet-de-debloquer-une-possibilite-supplementaire-sur-votre-connexion-freebox-derriere-un-nom-plutot-intimidant) · [IP dédiée Bouygues](https://blog.jeanvw.fr/fr/posts/configurer-sa-bbox-pour-avoir-une-ip-publique-dediee/) · [SFR/RED](https://lafibre.info/sfr-la-fibre/ipv6-ipv4-cgnat-red-by-sfr/) · [baromètre IPv6 2026](https://lafibre.info/ipv6/barometre-ipv6-2026/) · [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/) · [modes TLS Cloudflare](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/) · [limite d'envoi Cloudflare](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) · [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) · [tarifs Tailscale](https://tailscale.com/pricing) · [HTTPS Tailscale](https://tailscale.com/kb/1153/enabling-https) · [Let's Encrypt à 45 jours](https://letsencrypt.org/2025/12/02/from-90-to-45) · [Docker et pare-feu](https://docs.docker.com/engine/network/packet-filtering-firewalls/) · [Watchtower](https://github.com/containrrr/watchtower) · [Dependabot et Docker Compose](https://github.blog/changelog/2025-02-25-dependabot-version-updates-now-support-docker-compose-in-general-availability/) · [runners auto-hébergés](https://docs.github.com/en/actions/reference/security/secure-use#hardening-for-self-hosted-runners) · [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) · [restic](https://restic.readthedocs.io/en/stable/100_references.html) · [Backblaze B2](https://www.backblaze.com/cloud-storage/pricing) · [Hetzner Storage Box](https://www.hetzner.com/storage/storage-box/) · [calendrier Node.js](https://github.com/nodejs/Release/blob/main/schedule.json) · [Spamhaus PBL](https://www.spamhaus.org/blocklists/policy-blocklist/) · [exigences Gmail](https://support.google.com/mail/answer/81126?hl=en) · [Brevo](https://www.brevo.com/pricing/) · [Scaleway TEM](https://www.scaleway.com/en/pricing/managed-services/)
- **Coach IA** — [tarifs Claude](https://platform.claude.com/docs/en/about-claude/pricing) · [modèles](https://platform.claude.com/docs/en/about-claude/models/overview) · [guide de migration](https://platform.claude.com/docs/en/about-claude/models/migration-guide) · [sorties structurées](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · [limites de débit](https://platform.claude.com/docs/en/api/rate-limits) · [résidence des données](https://platform.claude.com/docs/en/manage-claude/data-residency) · [Claude sur Google Cloud](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai) · [conservation des données](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) · [conditions commerciales](https://www.anthropic.com/legal/commercial-terms) · [DPA Anthropic](https://www.anthropic.com/legal/data-processing-addendum) · [politique d'usage](https://www.anthropic.com/legal/aup) · [règles pour les mineurs](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors) · [données Mistral](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data) · [compar:IA](https://arene.comparia.beta.gouv.fr/ranking) · [Ollama ministral-3](https://ollama.com/library/ministral-3) · [FAQ Ollama](https://docs.ollama.com/faq) · [compatibilité Anthropic d'Ollama](https://docs.ollama.com/api/anthropic-compatibility) · [mesures CPU llamafile](https://github.com/mozilla-ai/llamafile/discussions/450) · [mesures Geerling](https://github.com/geerlingguy/ai-benchmarks) · [mesures GPU](https://github.com/XiongjieDai/GPU-Benchmarks-on-LLM-Inference) · [prix RTX 5060 Ti](https://www.ginjfo.com/actualites/composants/cartes-graphiques/geforce-rtx-5060-ti-16-go-son-prix-ne-cesse-daugmenter-et-inquiete-20260210) · [tarif EDF](https://www.kelwatt.fr/actu/tarif-edf-reglemente-1er-aout-2026) · [AI SDK](https://www.npmjs.com/package/ai) · [ISSN, préparation en culturisme](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/) · [Écoute Dopage](https://lannuaire.service-public.gouv.fr/centres-contact/R20697)
- **Nutrition** — [Mifflin 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/) · [Frankenfield 2005](https://pubmed.ncbi.nlm.nih.gov/15883556/) · [O'Neill 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10687135/) · [FAO 2004](https://openknowledge.fao.org/server/api/core/bitstreams/65875dc7-f8c5-4a70-b0e1-f429793860ae/content) · [Hall 2011](https://pubmed.ncbi.nlm.nih.gov/21872751/) · [Helms 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/) · [Delany 2025](https://pubmed.ncbi.nlm.nih.gov/40841871/) · [Iraki 2019](https://www.mdpi.com/2075-4663/7/7/154) · [ISSN 2017](https://pubmed.ncbi.nlm.nih.gov/28642676/) · [Morton 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/) · [Afssa 2007](https://www.anses.fr/fr/system/files/NUT-Sy-Proteines.pdf) · [ANSES 2016 (CERIN)](https://www.cerin.org/articles/references-nutritionnelles-proteines-lipides-glucides-fibres-adultes-personnes-agees/) · [EFSA, eau, 2010](https://www.sennutricion.org/media/Docs_Consenso/Scientific_Opinion_Dietary_Reference_Values_for_water-EFSA_2010.pdf) · [CIO, déficit énergétique relatif (REDs)](https://www.olympics.com/ioc/news/ioc-publishes-new-consensus-statement-on-relative-energy-deficiency-in-sport-reds-to-protect-athlete-health) · [PNNS 2019](https://www.santepubliquefrance.fr/nutrition-et-activite-physique/rapportsynthese/recommandations-relatives-a-lalimentation-a-lactivite-physique-et-a-la-sedentarite-pour-les-adultes) · [Ciqual 2025](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY) · [exports OFF](https://world.openfoodfacts.org/data) · [API OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/) · [quotas OFF (commit)](https://github.com/openfoodfacts/openfoodfacts-server/commit/fe164794f42dfdb2bc630901facc9a2a49f5c57d) · [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) · [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) · [import OFF de wger](https://github.com/wger-project/wger/blob/master/wger/nutrition/management/commands/import-off-products.py) · [Evenepoel 2020](https://pubmed.ncbi.nlm.nih.gov/33084583/) · [BarcodeDetector (données MDN)](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json) · [barcode-detector](https://github.com/Sec-ant/barcode-detector) · [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) · [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) · [MyFitnessPal Premium](https://www.myfitnesspal.com/premium) · [Dugas 2026](https://pubmed.ncbi.nlm.nih.gov/41329042/) · [Anderberg 2025](https://pubmed.ncbi.nlm.nih.gov/39671845/) · [Levinson 2017](https://pubmed.ncbi.nlm.nih.gov/28843591/) · [Bilen 2026](https://pubmed.ncbi.nlm.nih.gov/41909033/) · [O'Hara 2025](https://pubmed.ncbi.nlm.nih.gov/40004936/) · [ligne TCA (FFAB)](https://www.ffab.fr/500-ligne-tca-nouveau-numero)
- **Programmes** — [ACSM 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) · [ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/) · [Pelland](https://link.springer.com/article/10.1007/s40279-025-02344-w) · [Schoenfeld 2016](https://pubmed.ncbi.nlm.nih.gov/27102172/) · [Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/27433992/) · [Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/) · [Robinson 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/) · [Refalo 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/) · [Singer 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/) · [Bell 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/) · [Coleman 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/) · [Hickmott 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/) · [Lopes 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6383082/) · [Kikuchi 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5812864/) · [OMS 2020](https://www.ncbi.nlm.nih.gov/books/NBK566048/) · [Lauersen 2014](https://pubmed.ncbi.nlm.nih.gov/24100287/) · [van Dyk 2019](https://pubmed.ncbi.nlm.nih.gov/30808663/) · [Harøy 2019](https://pubmed.ncbi.nlm.nih.gov/29891614/) · [Andersson 2017](https://pubmed.ncbi.nlm.nih.gov/27313171/) · [Llanos-Lagos 2024](https://pubmed.ncbi.nlm.nih.gov/38165636/) · [Schumann 2022](https://pubmed.ncbi.nlm.nih.gov/34757594/) · [Foster 2001](https://pubmed.ncbi.nlm.nih.gov/11708692/) · [estimation du 1RM](https://en.wikipedia.org/wiki/One-repetition_maximum) · [marque StrongLifts (UE)](https://www.tmdn.org/tmview/#/tmview/detail/EM500000014288815) · [marque Starting Strength (US)](https://www.tmdn.org/tmview/#/tmview/detail/US500000085146322) · [marque JIM WENDLER 5/3/1 (US)](https://www.tmdn.org/tmview/#/tmview/detail/US500000090752575) · [Boostcamp et GZCL](https://www.boostcamp.app/cody-lefever-gzcl) · [ADPIC art. 9](https://www.wto.org/english/docs_e/legal_e/27-trips_04_e.htm) · [arrêt Bikram (2015)](https://law.justia.com/cases/federal/appellate-courts/ca9/13-55763/13-55763-2015-10-08.html) · [modèle de progression wger](https://github.com/wger-project/wger/blob/master/wger/manager/models/abstract_config.py) · [Liftoscript](https://www.liftosaur.com/doc/liftoscript) · [API Hevy](https://api.hevyapp.com/docs/) · [schéma workout-cool](https://github.com/Snouzy/workout-cool/blob/main/prisma/schema.prisma)
- **Benchmark, onboarding, salles** — [Hevy : suivi des exercices](https://www.hevyapp.com/features/track-exercises/) · [Hevy Trainer](https://www.hevyapp.com/features/workout-plan-generator/) · [test de Hevy (SensAI)](https://www.sensai.fit/blog/hevy-review-2026) · [Boostcamp](https://www.boostcamp.app/features) · [sélecteur de programmes Boostcamp](https://www.boostcamp.app/program-selector) · [profils de salle Fitbod](https://fitbod.me/blog/your-gym-profile/) · [FAQ Fitbod](https://fitbod.me/faqs/) · [onboarding Fitbod](https://pageflows.com/post/ios/onboarding/fitbod/) · [workout-cool #111](https://github.com/Snouzy/workout-cool/issues/111) · [Liftosaur](https://github.com/astashov/liftosaur) · [app Basic-Fit](https://apps.apple.com/fr/app/basic-fit/id1588263601) · [app Fitness Park](https://www.fitnesspark.fr/app-fitnesspark/) · [Hoober 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php) · [WCAG 2.2, taille des cibles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [OSM taginfo](https://taginfo.geofabrik.de/europe:france/tags/leisure=fitness_centre) · [Data ES](https://www.data.gouv.fr/dataservices/api-data-es) · [All The Places](https://github.com/alltheplaces/alltheplaces) · [politique d'usage de Nominatim](https://operations.osmfoundation.org/policies/nominatim/) · [rapport annuel Basic-Fit 2025](https://annualreport.basic-fit.com/2025/mbr/business-and-financial-review/) · [prix Yazio (Nutrola)](https://nutrola.app/fr/blog/how-much-does-yazio-cost-now-2026)
- **Juridique et sécurité** — [CNIL, donnée de santé](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante) · [CNIL, applis de santé](https://www.cnil.fr/fr/applications-mobiles-en-sante-et-protection-des-donnees-personnelles-les-questions-se-poser) · [CJUE C-21/23](https://www.taylorwessing.com/en/insights-and-events/insights/2024/10/ecj-lindenapotheke) · [considérant 18](https://gdpr-text.com/read/recital-18/) · [art. 30 RGPD](https://gdpr-info.eu/art-30-gdpr/) · [art. 33 RGPD](https://gdpr-info.eu/art-33-gdpr/) · [AIPD (CNIL)](https://www.cnil.fr/fr/realiser-une-analyse-dimpact-si-necessaire) · [comptes inactifs](https://www.cnil.fr/fr/achat-de-contenus-numeriques-quelle-duree-de-conservation-des-comptes-inactifs) · [journaux (CNIL)](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000044283637) · [HDS (G_NIUS)](https://gnius.esante.gouv.fr/en/regulations/regulation-profiles/healthcare-data-hosting-hds) · [décret 2026-209](https://www.vigier-avocats.com/hebergement-des-donnees-de-sante-le-decret-du-24-mars-2026-renforce-la-souverainete-la-territorialite-et-la-transparence/) · [AI Act, art. 50](https://artificialintelligenceact.eu/article/50/) · [AI Act, art. 2](https://artificialintelligenceact.eu/article/2/) · [règlement 2026/1744 (EUR-Lex, non lu)](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng) · [Omnibus IA (NicFab)](https://www.nicfab.eu/en/posts/digital-omnibus-ai-official-journal/) · [Morgan Lewis](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/08/eu-ai-acts-transparency-rules-what-went-into-effect-on-2-august) · [Travers Smith](https://www.traverssmith.com/knowledge/knowledge-container/is-it-a-bot-eu-ai-act-transparency-rules-take-effect-2-august-2026/) · [Baker Botts](https://www.bakerbotts.com/thought-leadership/publications/2026/september/eu-ai-act-article-50-transparency-obligations-go-live) · [MDCG 2019-11](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf) · [révision du MDCG (Emergo)](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful) · [art. 45 de la loi Informatique et Libertés](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037823135) · [CNIL, mineurs](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans) · [décision 2026-911 DC](https://www.conseil-constitutionnel.fr/decision/2026/2026911DC.htm) · [LCEN, art. 1-1](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614) · [clauses noires](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032807196) · [profession de diététicien (CSP)](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006155074/) · [Code du sport, L.212-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037388193) · [directive produits défectueux](https://single-market-economy.ec.europa.eu/single-market/goods/free-movement-sectors/liability-defective-products_en) · [DPF, décision du Tribunal](https://data-en-maatschappij.ai/en/publications/general-court-latombe) · [DPF, pourvoi](https://privacy-daily.com/article/2025/11/07/eu-high-court-accepts-latombes-appeal-on-euus-data-transfer-scheme-2511070020) · [PCLOB (BTLJ)](https://btlj.org/2026/02/third-times-the-charm-the-fate-of-the-eu-u-s-data-privacy-framework/) · [Digital Omnibus, volet RGPD](https://acompli.ie/news/digital-omnibus-gdpr-cookies-status-september-2026/) · [WebAuthn niveau 3](https://www.w3.org/TR/webauthn-3/) · [OWASP, stockage des mots de passe](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [Argon2 dans Node](https://nodejs.org/api/crypto.html#cryptoargon2algorithm-parameters-callback) · [CNIL 2022-100](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000046437451) · [Better Auth](https://better-auth.com/blog/authjs-joins-better-auth) · [cookies (CNIL)](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi) · [guide sécurité CNIL 2024](https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024)