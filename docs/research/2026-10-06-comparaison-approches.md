# Partie 1 — Pour le porteur du projet

Trois architectures ont été proposées. Trois juges les ont notées, chacun sous un angle : exploitation, hors-ligne et produit, qualité d'ingénierie. **Les trois juges donnent le même classement.**

## A. Monolithe TypeScript (Node + SQLite + appli React hors ligne)
Un seul programme sur le serveur fait tout : il porte l'API, sert l'appli et les illustrations, et contient la base de données, qui est un simple fichier SQLite. Le téléphone enregistre d'abord chaque saisie chez lui, puis l'envoie au serveur dès que Tailscale répond.
- \+ C'est le plus léger : 1 conteneur et environ 700 Mo de RAM. Il n'y a qu'une chose à sauvegarder, à surveiller et à mettre à jour.
- \+ Sa synchro est la plus sûre des trois : sans doublon ni trou, et entièrement testable sur le PC Windows sans Docker.
- \+ Il a peu de dépendances, toutes sous licence libre et remplaçables.
- − Trois briques sont écrites par nous et doivent être bien testées : la synchro, le mode hors ligne (service worker) et la connexion.
- − Certains outils sont très récents (la base SQLite intégrée à Node est en « version candidate », TypeScript 7). Un repli est prévu.
- − Il n'a pas d'écran tout fait pour consulter les données : il faut le construire dans l'appli.

## B. PocketBase + petit service « coach »
PocketBase est un logiciel tout-en-un qui fournit les comptes, la base, un tableau d'admin et les sauvegardes. Un second petit service porte le coach IA, et le hors-ligne reste à écrire comme en A.
- \+ Le tableau de bord d'admin et les sauvegardes sont fournis d'office.
- \+ 2 conteneurs, environ 900 Mo de RAM.
- \+ Le coach est naturellement cloisonné : il ne lit qu'avec les droits de l'utilisateur.
- − PocketBase est en version 0.x et repose sur un mainteneur principal : il faut s'attendre à des ruptures à chaque montée de version.
- − Le serveur mélange deux langages, dont des scripts internes limités et difficiles à tester pour des agents IA.
- − La synchro est moins fine : la dernière modification écrase tout l'enregistrement, selon l'horloge du téléphone.

## C. PowerSync + PostgreSQL
Un moteur de synchronisation du marché recopie les données entre PostgreSQL et une base sur le téléphone. C'est la solution « industrielle », pensée pour des milliers d'utilisateurs.
- \+ La synchro du serveur vers le téléphone est fournie et éprouvée.
- \+ Le téléphone dispose d'un vrai SQL, et c'est la meilleure voie vers une future appli native.
- \+ PostgreSQL est une base classique.
- − 4 à 6 conteneurs, environ 2 Go de RAM, et une réplication à surveiller, qui peut remplir le disque.
- − Elle ne tourne pas sur le PC de dev sans Docker, et il faut garder trois schémas alignés.
- − La licence (FSL) n'est pas une licence libre, un seul éditeur la porte, et la recherche la jugeait déjà surdimensionnée.

## Notes moyennes des 3 juges (sur 5 par critère, total sur 35)
| Critère | A. Monolithe | B. PocketBase | C. PowerSync |
|---|---|---|---|
| Adéquation aux contraintes | 5,0 | 4,0 | 2,2 |
| Simplicité d'exploitation | 4,8 | 4,0 | 1,8 |
| Robustesse hors ligne | 4,2 | 3,2 | 3,8 |
| Maintenabilité / tests | 5,0 | 3,0 | 2,5 |
| Intégration du coach IA | 4,8 | 3,8 | 4,0 |
| Évolutivité | 4,0 | 3,3 | 4,7 |
| Maturité / risque | 3,3 | 3,0 | 2,8 |
| **Total moyen** | **31,2** | **24,3** | **21,8** |

Les totaux sont recalculés à partir des notes par critère, car le juge « exploitation » avait mal additionné deux de ses totaux. Le classement ne change pas.

## Recommandation : A, le monolithe TypeScript
1. **Il est à la taille du projet.** Pour 2 à 5 proches et un seul admin (vous), il n'y a qu'une pièce à faire tourner, sauvegarder et mettre à jour.
2. **La salle sans réseau est le cas normal.** On saisit tout hors ligne, et la synchro ne perd ni ne double aucune série, ce que des tests automatiques vérifient.
3. **Il convient à votre PC.** Sous Windows sans Docker, tout se teste en local en quelques secondes, ce qu'il faut pour des agents IA qui codent en TDD.
4. **Le coach est encadré.** Le serveur le bloque pour les mineurs. Il ne propose que des changements de structure, que le code vérifie et que l'utilisateur accepte.
5. **Il coûte peu.** Environ 700 Mo sur 16 Go, quelques dizaines de Mo à sauvegarder hors du domicile, et aucune licence payante.

**Idées reprises des autres approches et des juges**
- De B :
  - un « numéro d'époque » du serveur : après une restauration de sauvegarde, les téléphones renvoient leurs 60 derniers jours, donc presque aucune séance n'est perdue ;
  - un coach cloisonné à l'utilisateur ;
  - un écran d'admin pour consulter les données ;
  - un guide écrit « reconstruire le serveur ».
- De C :
  - les charges sont figées au démarrage de la séance ;
  - un voyant « Prêt hors ligne » et un compteur « N séries en attente » ;
  - les séries en attente partent avant l'ouverture du coach.
- Des juges :
  - une base réglée pour résister aux coupures de courant ;
  - une mise en production manuelle, version par version, au lieu d'une mise à jour automatique chaque nuit ;
  - un disque chiffré qui se déverrouille seul au redémarrage, et un onduleur ;
  - des proches limités au seul HTTPS dans Tailscale.

---

# Partie 2 — Détails pour la spécification (architecture A, avec les idées reprises)

> **Corrections des juges, qui priment sur la proposition A :**
> - `PRAGMA synchronous=FULL` et non NORMAL : en mode WAL, NORMAL peut perdre une transaction déjà commitée après une coupure de courant (sqlite.org/pragma.html#pragma_synchronous).
> - Ajout d'un `server_epoch`, sans quoi le curseur est faux après une restauration.
> - Un retour arrière de déploiement doit aussi restaurer l'instantané pris avant la migration.
> - Restreindre les utilisateurs du partage au port 443 est possible et vérifié (tailscale.com/kb/1084/sharing, `autogroup:shared`).
> - « VPN coupé : le DNS échoue vite » n'est pas sourcé. On s'appuie sur le délai de 4 s, pas sur le DNS.

## 1. Stack

Les versions npm sont celles relevées par la proposition le 06/10/2026. Un juge a recoupé typescript 7.0.2, vitest 5.0.3 et kysely 0.29.6. Toutes les versions sont à figer dans le lockfile.

| Couche | Choix | Version | Raison |
|---|---|---|---|
| OS serveur | Debian 13 minimal, unattended-upgrades, UFW (entrées seulement sur `tailscale0`) | 13.x | Stable et sobre, avec des dépôts apt officiels pour Docker et Tailscale. Ubuntu 26.04 LTS conviendrait aussi. |
| Chiffrement | LUKS sur `/srv`, déverrouillage TPM2 (systemd-cryptenroll ou Clevis) | — | La machine doit redémarrer seule après une coupure. Si le déverrouillage reste manuel, il faut désactiver les redémarrages automatiques. |
| Runtime | Node.js 24 LTS, puis 26 LTS après le 28/10/2026 | 24.21.0 sur le poste | Fournit en natif `node:sqlite` et `crypto.argon2` (≥ 24.7) : aucun module natif, ni node-gyp ni Python. |
| Conteneurs | Docker Engine + Compose v2, **un seul service `app`** (node:24-slim + `server.mjs`) | Compose v2 | Le minimum de pièces. Tailscale, restic et les timers restent sur l'hôte. |
| Réseau / TLS | Tailscale sur l'hôte + `tailscale serve --bg --https=443 http://127.0.0.1:3000` | client stable | Décision validée. Certificat *.ts.net automatique, en-têtes `Tailscale-User-*` y compris pour les utilisateurs externes du partage (KB 1312). |
| HTTP | Hono + @hono/node-server (serveStatic, streamSSE, csrf, compress) | 4.13.13 / 2.1.3 | `app.request()` teste les routes sans ouvrir de port. SSE natif pour le coach. |
| Base | SQLite via `node:sqlite` : WAL, **synchronous=FULL**, STRICT, foreign_keys=ON, busy_timeout | SQLite 3.53.4 (avec FTS5) | Un seul fichier et un seul écrivain, ce qui ordonne le curseur. Base en mémoire dans les tests. |
| Accès SQL | Kysely + adaptateur maison node:sqlite d'environ 20 lignes ; migrations TS en liste statique | 0.29.6 | Typé, sans génération de code. Drizzle n'accepte node:sqlite qu'en 1.0 RC. L'adaptateur est le point de bascule vers better-sqlite3 ou PostgreSQL. |
| Contrats | Zod 4 dans `packages/contracts` | 4.6.5 | Source unique pour l'API, les opérations de synchro, les fichiers `data/` et les outils stricts du coach (`z.toJSONSchema`). |
| Auth | Maison : invitations et réinitialisations à usage unique, Argon2id natif, sessions opaques hachées, cookie `__Host-` | crypto.argon2 | Besoin minuscule, réseau fermé. Passkeys possibles plus tard. |
| Front | React 19 + Vite 8 (SPA), wouter, CSS Modules, graphiques SVG maison | 19.3.0 / 8.3.3 / 3.13.0 | Écosystème le mieux maîtrisé par les agents. Pas de SEO. |
| Stockage local | Dexie 4 + dexie-react-hooks, **derrière des dépôts** (`SessionsRepo`, `SetsRepo`…) | 4.4.6 / 4.4.0 | L'UI lit et écrit toujours en local. Les dépôts permettent de passer à SQLite dans une future appli native. |
| Service worker | SW maison (~150 lignes) + mini-plugin Vite qui produit le manifeste de précache ; mode « prompt » | — | vite-plugin-pwa est gelé (v2.0.0 du 03/10/2026). Alternative : son mode `injectManifest`, recommandé par la recherche. |
| Coach IA | @anthropic-ai/sdk, boucle d'outils manuelle (`messages.stream`), `strict: true`, `tool_choice: auto`, effort explicite | 0.131.0 ; `claude-opus-5-5` par défaut | Contrôle complet des tours, du budget et de la validation. Modèle configurable (`claude-sonnet-5-5`). |
| Tests | Vitest + fast-check + fake-indexeddb + Testing Library/happy-dom ; Playwright (Chromium et WebKit) | 5.0.3 / 4.10.2 / 6.2.5 / 1.63.0 | Tout tourne sous Windows, sans Docker. |
| Typage / lint | TypeScript 7 (`--noEmit`, `erasableSyntaxOnly`) + Biome 2 ; **job CI de repli sous TS 6** | 7.0.2 / 2.5.15 | tsc ne sert qu'à vérifier les types, et le repli reste prêt. |
| Monorepo / build | pnpm 10 workspaces ; esbuild produit un seul `server.mjs` | 10.x / 0.28.2 | 4 paquets, pas besoin d'orchestrateur. Image sans node_modules. |
| Sauvegardes | `sqlite.backup()` interne + restic sur l'hôte (disque externe et copie hors domicile en UE) | paquet Debian | Copie cohérente sans arrêt, chiffrée côté client. |
| CI/CD | GitHub Actions (runners hébergés) → GHCR privé ; Dependabot ; **déploiement par tag** | — | Aucun accès de la CI au serveur, mise en production explicite. |
| Supervision | Page « santé » dans l'admin + sonde externe « dead man's switch » | — | Signale l'âge de la dernière sauvegarde, le dernier test de restauration et l'espace disque. |

## 2. Composants et responsabilités

```
Téléphone : UI React → dépôts → Dexie (données, outbox, deadletter, catalogue, méta)
            moteur de synchro (push/pull, rebase, epoch) · service worker (coquille, SVG)
   │ HTTPS via le tailnet
tailscale serve :443 (*.ts.net) → 127.0.0.1:3000
Conteneur app (un processus Node) : Hono /api/{auth,sync,catalog,admin,coach,health,version}
   + PWA statique + /illustrations · Kysely → node:sqlite → /data/appsport.db
   + tâche d'instantanés · sortie HTTPS vers l'API Claude
Hôte : tailscaled · restic (timer) · appsport-update (commande) · unattended-upgrades
```

**`packages/domain`** : logique pure, sans entrée-sortie, identique sur le téléphone et le serveur.
- Progression (linéaire, double, somme des reps, RIR/e1RM, chaîne au poids du corps, durée), deload, stagnation.
- Substitutions par matériel et type de mouvement.
- Nutrition versionnée (`algo_version`, mode qualitatif pour les mineurs).
- Machine à états des fiches : brouillon → relue → publiée → retirée.
- Validateurs des propositions du coach, fusion de synchro.

**`packages/contracts`** : schémas Zod (API, opérations, fichiers `data/`, outils du coach).

**`apps/server`**
- `createApp(deps)` avec injection de `Clock`, `IdGen`, `Db`, `CoachModel`.
- Modules : `db/` (adaptateur, migrations), `auth/`, `sync/` (`push`, `pull`, `entity-rules` avec la liste blanche des colonnes par entité), `catalog/` (chargement de `data/` en base par révision, bundle avec ETag), `coach/`, `admin/` (invitations, relecture des fiches, consultation des données, état des sauvegardes), `jobs/`.
- `cli.ts` : `init`, `admin:invite`, `db:check`, `data:export`, `restore`.

**`apps/web`** : `local-db/` (schéma Dexie versionné), `repos/`, `sync/` (outbox, transport, moteur, déclencheurs), `sw/`, `features/` (auth, onboarding, salle, exercices, programmes, séance, historique, coach, nutrition, admin, réglages).

**Ordre de construction**
1. Socle : auth, onboarding, coquille PWA, SW avec interrupteur d'urgence et E2E de mise à jour, synchro générique, déploiement, sauvegardes.
2. Exercices.
3. Programmes et séances.
4. Coach.
5. Nutrition.

## 3. Organisation du repo

```
appsport/
├─ package.json (packageManager pnpm@10, engines node >=24.7)  pnpm-workspace.yaml
├─ tsconfig.base.json  biome.json  .gitattributes (eol=lf)  .node-version  LICENSE
├─ apps/server/src/{main.ts, app.ts, db/, auth/, sync/, catalog/, coach/, admin/, jobs/, cli.ts}  test/
├─ apps/web/{public/, src/{local-db/, repos/, sync/, sw/, features/, ui/}, vite.config.ts, e2e/}
├─ packages/{contracts/, domain/}
├─ data/ (LICENSE CC BY-SA 4.0, ATTRIBUTION.md) exercises/*.json  illustrations/*.svg  programs/*.json  equipment.json
├─ scripts/ exercises/draft.ts (Claude Batch)  data/{pull,validate}.ts  svg/check.ts  coach-eval/
├─ infra/ Dockerfile  compose.yaml  systemd/  tailscale-policy.hujson  README-serveur.md  RUNBOOK-reconstruction.md
├─ docs/ adr/  brief/  vendor-docs/ (extraits figés par version : node:sqlite, Hono, Kysely, Dexie, SDK Anthropic)
└─ .github/ workflows/ci.yml  dependabot.yml
```

## 4. Synchro hors ligne

**Identifiants et colonnes**
- Chaque ligne a un `id` UUIDv7 généré par le client, ainsi que `owner_id`, `rev`, `updated_at`, `updated_by` et `deleted_at` (tombstone).
- Le matériel de salle utilise une clé déterministe (`gym_id`, `equipment_slug`) : deux cases cochées en parallèle fusionnent.

**Catégories**
1. Journal : `workout_session`, `set_entry`, `body_weight`, `nutrition_checkin`. Création idempotente, corrections par patch, tombstone.
2. Documents personnels : `profile`, `settings`, `program_assignment`, `program_adjustment`, `consent`. Patchs champ par champ.
3. Partagées : `gym`, `gym_equipment`, `gym_membership`. Les autres membres ne voient que le nom d'affichage.
4. Catalogue en lecture seule, transmis par ETag, hors outbox.

**Écriture locale**
- La ligne et l'opération `{opId (UUIDv7), entity, id, kind, fields, clientTs, protocol}` sont écrites dans **la même transaction Dexie**.
- L'opération est validée par Zod avant d'entrer dans la file.

**Push** : `POST /api/sync/push` (200 opérations au plus), traité en une transaction serveur, dans l'ordre de la file.
- Si `applied_op(opId)` existe déjà, le serveur répond `duplicate`.
- Sinon : validation, autorisation, filtrage par la liste blanche de colonnes (les colonnes réservées au serveur sont ignorées), application, puis `rev = sync_counter + 1`.
- Statut renvoyé pour chaque opération : `applied`, `duplicate` ou `rejected`.
- Une opération rejetée va dans la deadletter locale **et** dans une table serveur `sync_rejection`, synchronisée. Elle est donc visible sur tous les appareils et par l'admin, jamais supprimée en silence.
- L'outbox n'est vidée qu'après accusé de réception.

**Pull** : `GET /api/sync/pull?since=<watermark>&limit=500`.
- Le watermark est **opaque** : `epoch:rev` aujourd'hui, pour pouvoir passer plus tard à PostgreSQL sans changer le protocole.
- Le serveur renvoie les lignes du périmètre triées par `rev`, avec `nextWatermark` et `hasMore`.
- Le seul écrivain SQLite garantit que l'ordre des `rev` est l'ordre des commits.
- Les tombstones sont purgés après 180 jours. Un watermark plus ancien reçoit un 410, qui déclenche une resynchronisation complète.

**`server_epoch`** (repris de B, bloquant)
- Il est généré à l'`init` de la base et **à chaque restauration**, y compris lors d'un retour arrière de déploiement.
- Un client qui voit un nouvel epoch fait un pull complet, puis renvoie ses entités du journal des 60 derniers jours en créations idempotentes (`ON CONFLICT(id)`).
- Les documents personnels sont repris depuis le serveur, sauf les patchs encore en attente.
- On rattrape ainsi les saisies faites après la dernière sauvegarde : le RPO des séances devient quasi nul.

**Conflits**
- La dernière écriture gagne, champ par champ, dans l'ordre d'arrivée au serveur.
- Côté client, une ligne reçue par pull qui a encore des patchs en attente est rebasée : la ligne serveur est appliquée, puis les patchs locaux sont rejoués.
- Cas résiduel documenté : le même champ modifié hors ligne sur deux appareils.
- L'appli affiche `updated_by` sur le matériel de salle (« modifié par Léa hier »).

**Séance**
- Au démarrage, les cibles calculées et l'`engine_version` sont **figées dans la séance** (instantané de prescription, repris de C). Une reprise, un pull ou une nouvelle version du moteur ne changent pas les charges affichées.
- `workout_session.status = in_progress` et `device_id` sont synchronisés. Un second appareil affiche « séance en cours sur un autre appareil », avec l'option « continuer ici ».

**Déclencheurs et état de connexion**
- Déclencheurs : lancement, `online`, retour au premier plan, 2 s après chaque série, puis toutes les 60 s quand l'app est visible ; Background Sync en bonus sur Android.
- Délai maximal de 4 s par appel, avec reprise à intervalle croissant.
- L'état de connexion vient du résultat des appels et d'une sonde `/api/health`, **jamais de `navigator.onLine`**.
- Un compteur « N éléments en attente » est affiché.

**Sessions et versions**
- Un 401 met la synchro en pause sans toucher à l'outbox.
- L'en-tête `X-Appsport-Protocol` est accepté en N et N-1 ; au-delà, le serveur répond 426 « mise à jour requise », sans bloquer l'usage hors ligne ni effacer la file.
- À la déconnexion, la purge des données locales n'a lieu **que si l'outbox est vide**. Sinon, l'appli avertit et propose l'export.

**iOS**
- Installation avant toute saisie.
- `navigator.storage.persist()` **dès l'onboarding**.
- Voyant « Prêt hors ligne » exigé en fin d'onboarding : précache fait, catalogue chargé, première synchro faite.
- Export JSON/CSV, Wake Lock, minuteur fondé sur une heure de fin.

## 5. Auth et invitations

**Tables** : `user` (rôle, **date de naissance** saisie par l'admin, `tailscale_login`), `credential` (Argon2id : au moins 19 Mio, t=2, p=1 ; 64 Mio possibles), `session` (jeton haché, expiration glissante de 180 jours, appareil), `invitation` (type `invite` ou `reset`, jeton de 256 bits haché, code court Crockford, 7 jours ou 24 h, `used_at`), `consent` (santé, coach_ia, parental sous 15 ans), `audit_log` (sans données de santé).

**Première mise en route**
- `docker compose exec app node server.mjs init`, puis `admin:invite --role admin`.
- Le service **refuse de créer une base hors de `init`** (voir § 7).

**Invitation**
1. L'admin crée l'invitation : prénom et date de naissance.
2. Il partage la machine dans la console Tailscale.
3. Il envoie le lien par messagerie.
4. Sur Android, ou si l'app est déjà installée, l'activation est directe. Sur iPhone, la page affiche l'aide à l'installation et un code court, à saisir dans l'app installée (son stockage est séparé de Safari). Le nombre d'essais est limité.
5. L'utilisateur choisit son mot de passe : au moins 10 caractères, mots de passe courants refusés.
6. Il donne ses consentements santé et IA, séparément.

**Réinitialisation** : l'admin génère un lien ou code `reset` à usage unique. À son utilisation, toutes les sessions sont révoquées. L'admin ne voit jamais le mot de passe.

**Durcissement**
- Cookie `__Host-appsport` HttpOnly, Secure, SameSite=Lax.
- `csrf()` de Hono (contrôle de l'Origin) et requêtes JSON uniquement.
- 10 échecs par heure au maximum, par compte et par identité Tailscale, avec délai croissant.
- Liaison optionnelle de la session à `Tailscale-User-Login`, enregistré à la première connexion.
- Politique Tailscale : `{"src":["autogroup:shared"],"dst":["*"],"ip":["443"]}`. SSH reste réservé à l'admin, via Tailscale SSH.

**Mineurs**
- `is_minor` est calculé à chaque requête à partir de la date de naissance. Une année seule ne suffit pas à trancher l'âge.
- `requireAdult` côté serveur sur `/api/coach/*`, et l'onglet est masqué.
- Nutrition qualitative, sans cible chiffrée.
- Consentement parental sous 15 ans.

## 6. Coach IA

**Interface `CoachModel`**
- Implémentée par `AnthropicCoachModel` et par `FakeCoachModel`, aux réponses scriptées pour les tests.
- Configuration : `COACH_MODEL=claude-opus-5-5`. L'effort se fixe **toujours** explicitement : `low` en chat, `medium` pour une revue de programme. Opus 5.5 est à `medium` par défaut, Sonnet 5.5 à `high`, et la réflexion d'Opus 5.5 ne se désactive pas.
- Le modèle est figé pour toute la durée d'un fil : en changer casse le cache et les blocs de réflexion.

**Moindre privilège** (repris de B)
- Les outils reçoivent un `UserScopedRepo` lié au `userId`, qui applique les mêmes règles que le pull.
- Le module coach n'a aucun accès en écriture aux programmes ni aux cibles.
- Un test d'architecture interdit les imports directs de `db/` depuis `coach/`.

**Contexte, dans l'ordre qui favorise le cache**
1. Outils et prompt système figé, versionné dans le dépôt.
2. Dossier pseudonymisé : ni nom ni e-mail ; objectif, contexte d'entraînement, matériel, état du moteur, 4 semaines résumées, records, tendance du poids, cibles calculées par le code.
3. Messages.

Avant d'ouvrir un fil, l'appli **tente de vider l'outbox**, avec un délai court.

**Outils** (`strict: true`, `tool_choice: auto`, car le choix forcé renvoie une erreur 400)
- Lecture : `get_history`, `get_records`, `search_exercises` (fiches publiées et compatibles avec le matériel), `get_exercise`, `explain_progression`, `compute_nutrition_targets`.
- `simulate_adjustment` : aperçu des charges recalculées par le domaine.
- `propose_program_change` : schéma **sans aucun champ de charge ni de kcal**.
- `flag_safety(category)` : affiche les ressources (15/112, ligne TCA 09 69 325 900, Écoute Dopage) et ne journalise que la catégorie.

**Cycle d'une proposition**
1. Validation par Zod, puis par les règles du domaine, 2 essais au plus.
2. Stockage au statut « en attente ».
3. Carte « Accepter / Refuser » avec l'aperçu des charges.
4. `POST …/accept` crée un `program_adjustment`, synchronisé.
5. Le moteur recalcule les charges.

**Robustesse**
- 6 tours d'outils au plus, `max_tokens` borné.
- `stop_reason` est vérifié : un `refusal` déclenche un message neutre avec les ressources, un `max_tokens` une coupure propre.
- Historique **en ajout seul** : les blocs de contenu bruts sont stockés et renvoyés sans modification.
- Nouveau fil au-delà d'environ 40 messages, avec un résumé intégré au dossier.
- Streaming SSE (`delta`, `tool`, `proposal`, `done`) via fetch + ReadableStream.

**Conformité et budget**
- Mention « Tu échanges avec une IA » en tête de chaque fil, et `ai_generated` sur chaque message.
- Coût calculé depuis `usage`.
- Plafonds : messages par jour, dollars par mois par personne et au global, limite de dépense sur la console Anthropic. Au-delà, le coach passe en mode dégradé.
- Hors ligne, l'onglet affiche « nécessite le réseau ».

**Brouillons de fiches** : `scripts/exercises/draft.ts`, avec sorties structurées et API Batch (−50 %). Les fiches sont relues dans `/admin/exercices`, puis `data:pull` ouvre une PR, validée par la CI.

## 7. Déploiement

**Hôte**
- Debian 13, LUKS avec déverrouillage TPM2, Docker depuis son dépôt, Tailscale avec MagicDNS et HTTPS.
- **Nom de machine neutre** : il apparaît dans les journaux publics de certificats.
- `tailscale serve --bg --https=443 http://127.0.0.1:3000`.
- Onduleur recommandé.

**`compose.yaml`** (un service)
- `image: ghcr.io/gnochance/appsport:${TAG}`, `ports: 127.0.0.1:3000:3000`, `volumes: /srv/appsport/data:/data`.
- `env_file` en mode 600, qui contient `ANTHROPIC_API_KEY`.
- `read_only` + `tmpfs /tmp`, `user: 1000`, `mem_limit: 512m`, healthcheck `/api/health`, journaux en rotation.

**Garde au démarrage** (bloquante)
- `RequiresMountsFor=/srv/appsport/data` dans l'unité systemd.
- Fichier sentinelle `/data/.appsport-volume`.
- Refus de démarrer si la base est absente, sauf après `init`. Sans cette garde, un volume non monté produirait une base neuve sur laquelle les téléphones se synchroniseraient.

**Image** : construite en CI en plusieurs étapes (`vite build`, puis `esbuild --bundle`). Le résultat est `node:24-slim` + `server.mjs` + `public/` + `data/`, sans node_modules.

**Mise en production**
1. Un tag `vX.Y.Z` sur `main`, CI verte, publie l'image sur GHCR.
2. L'admin lance `appsport-update vX.Y.Z` via Tailscale SSH.
3. Le script prend un instantané, fait `pull`, puis `up`. Les migrations s'exécutent en transaction au démarrage, puis vient le healthcheck.
4. En cas d'échec : image précédente **+ restauration de l'instantané + nouvel epoch**.
5. Une alerte se déclenche si le pull GHCR échoue, par exemple si le jeton `read:packages` a expiré.
6. Pas de mise en production automatique chaque nuit.

**RAM** : environ 700 Mo pour toute la machine (estimation), dont l'app bornée à 512 Mo.

## 8. Sauvegardes et restauration

**Dans l'app** : `sqlite.backup()` toutes les heures (48 conservés) et chaque jour (30 conservés), dans `/data/snapshots`.

**Sur l'hôte** : restic chaque jour, avec chiffrement côté client.
- Sauvegardé : le dernier instantané, `compose.yaml`, `.env`, `tailscale serve status --json`, les unités systemd et la politique Tailscale.
- Destinations : disque externe et copie hors domicile en UE (B2 région UE ou Hetzner Storage Box).
- `forget --keep-daily 30 --prune`, pour que les suppressions RGPD soient effectives sous 30 jours.

**Secrets hors serveur** : mot de passe restic, `.env` et jeton GHCR sont rangés dans le gestionnaire de mots de passe de l'admin. Sans eux, la reconstruction est impossible.

**Test mensuel automatisé** : restauration dans un dossier temporaire, `PRAGMA integrity_check`, conteneur jetable, appel de `/api/health`. Le résultat est affiché dans l'admin et suivi par une sonde externe.

**Restauration réelle** (`cli restore`)
1. Arrêt du service.
2. Copie de l'instantané.
3. **Régénération de `server_epoch`**.
4. Démarrage.
5. Les téléphones renvoient leurs 60 derniers jours.

`RUNBOOK-reconstruction.md` décrit la reconstruction du serveur de zéro.

## 9. Mises à jour de la PWA

**En-têtes de cache** : `index.html` et `sw.js` en `no-cache`, assets hachés en `immutable`, caches nommés `shell-<buildHash>`.

**Bandeau « Nouvelle version »**
- Affiché **uniquement hors séance**, grâce à un indicateur stocké dans Dexie.
- Le clic envoie `SKIP_WAITING`, puis l'app se recharge. Les anciens caches sont purgés à l'activation.

**Compatibilité** : protocole N et N-1, 426 au-delà, sans perte de l'outbox. Le schéma Dexie évolue par `version(n).upgrade()`, les migrations serveur par expand/contract.

**Interrupteur d'urgence** : `/api/version` peut demander au SW de se désenregistrer. Il est livré avec le test E2E de mise à jour **dès le socle**.

**Illustrations hors ligne** : précache des SVG des exercices compatibles avec la salle de l'utilisateur, et bouton « télécharger la bibliothèque ».

## 10. Stratégie de tests

Principe : une interface explicite et des dépendances injectées par unité, et un test rouge avant chaque comportement. Tout tourne dans un seul processus Node sous Windows.

1. **Domaine** : tables de cas, propriétés fast-check et fichiers de référence sur 12 semaines par modèle de programme ; couverture d'au moins 90 %. Exemples de propriétés :
   - jamais de hausse au-delà du pas autorisé ;
   - un deload réduit toujours le volume ;
   - une substitution respecte toujours le matériel ;
   - les kcal restent au-dessus du métabolisme de base ;
   - aucune cible chiffrée pour un mineur.
2. **Synchro** : le vrai `createApp` sur SQLite en mémoire, relié à deux appareils simulés (Dexie sur fake-indexeddb) par un transport qui perd, duplique, retarde ou réordonne les envois. Propriétés :
   - convergence des appareils ;
   - aucune série perdue ni dupliquée ;
   - rejet toujours visible.

   Tests ciblés : 401, 426, 410, **restauration avec changement d'epoch**, matériel de salle modifié en parallèle, séance ouverte sur deux appareils.
3. **Serveur** : invitations et réinitialisations, sessions, limitation des tentatives, isolation entre utilisateurs (**tests de fuite sur le pull**), `requireAdult`, consentements, CSRF, chargeur du catalogue (pas de rétrogradation), ETag, garde de démarrage.
4. **Contrats et migrations**
   - Tests de l'adaptateur rejoués sur better-sqlite3 en CI.
   - Instantané de `sqlite_schema` après application des migrations sur une base vide.
   - Base de la version précédente vers le schéma courant, et Dexie n-1 vers n.
   - Cohérence entre Zod, les types Kysely et le schéma Dexie.
5. **Coach** : `FakeCoachModel` (outils, refus, `max_tokens`, budget, propositions invalides), test d'architecture sur les imports, aucun appel réseau en CI. `pnpm coach:eval`, manuel et payant : environ 100 cas en français joués 3 fois, 100 % exigés sur la sécurité, au moins 95 % de propositions valides du premier coup.
6. **Web** : Testing Library + happy-dom + fake-indexeddb (écran de séance, onboarding, filtrage par salle).
7. **E2E Playwright** (Chromium et WebKit, profils Pixel et iPhone) :
   - invitation, onboarding, première séance ;
   - séance complète hors ligne, rechargement à froid, synchro, vue sur un second contexte ;
   - bandeau de mise à jour absent pendant une séance ;
   - interrupteur d'urgence du SW ;
   - SVG affichés hors ligne.
8. **Recette sur appareils réels** (iPhone iOS 18.4 ou plus, Android), critère de sortie de toute version qui touche le SW, la synchro ou iOS :
   - démarrage à froid en mode avion, appli tuée ;
   - 100 séries hors ligne puis retour du VPN, sans perte ni doublon ;
   - survie à un redémarrage du téléphone et à 7 jours sans réseau ;
   - mise à jour avec une file non vide.
9. **CI** : biome, tsc (TS 7, plus un job TS 6), vitest, `data:validate`, `svg:check`, E2E, build de l'image. Job Windows hebdomadaire.

## 11. Risques ouverts et points à vérifier

**Risques et parades**

| Risque | Parade |
|---|---|
| Bug de synchro | Propriétés sur deux appareils, deadletter, `sync_rejection`, `applied_op`, export. |
| SW bloqué sur une ancienne version | Interrupteur d'urgence, E2E de mise à jour, `sw.js` en `no-cache`. |
| Faille dans l'auth maison | Surface réduite, primitives natives, tailnet, tests d'isolation. |
| `node:sqlite` en RC, TypeScript 7 très récent | Adaptateur avec tests de contrat sur better-sqlite3, job TS 6, ADR. |
| Perte sur coupure de courant | `synchronous=FULL`, onduleur. |
| Disque chiffré verrouillé ou volume vide au démarrage | TPM2, garde de démarrage. |
| Données perdues sur iPhone | Installation avant toute saisie, `persist()` à l'onboarding, export. |
| Serveur domestique indisponible (courant, box, Bouygues) | Séance 100 % hors ligne, coach en mode « nécessite le réseau ». |
| Mineur exposé au coach | Date de naissance, `requireAdult` côté serveur, tests dédiés. |
| Dérive des coûts de l'API | Effort explicite, plafonds, limite de dépense sur la console. |
| Provenance des illustrations workout-guide | Seuls 76 dessins viennent d'Everkinetic, l'origine des autres n'est pas documentée : privilégier Everkinetic ou des dessins maison, et contrôler les SVG en CI. |
| Changement d'origine (*.ts.net vers un domaine) | Il efface IndexedDB : vider toutes les outbox, puis resynchroniser depuis le serveur. Plan à documenter dans un ADR. |

**Points à vérifier**
1. L'affirmation « depuis le 31/08/2026, modifier un tour passé renvoie une erreur 400 » n'est pas dans la recherche : à confirmer dans le guide de migration Anthropic. L'historique en ajout seul reste de toute façon la règle.
2. Le repli serveur `fallbacks` (bêta) n'est pas sourcé : ne pas l'activer sans test.
3. Les utilisateurs externes d'un partage comptent-ils dans la limite de 6 utilisateurs du plan Personal gratuit de Tailscale ?
4. Comportement du SSE derrière `tailscale serve` (mise en mémoire tampon, délais).
5. Échec rapide ou délai d'attente quand le VPN est coupé sur un réseau faible : à mesurer sur le terrain.
6. Déverrouillage TPM2 sur le matériel réel. Le CPU et le type de disque sont encore inconnus.
7. Résidence des données du coach : l'API directe ne traite les données qu'aux États-Unis ou en « global ». À mentionner dans le consentement IA.
8. Version exacte de Debian 13 et date de bascule vers Node 26 (image et `engines`), après le 28/10/2026.
9. Alternative au SW maison : le mode `injectManifest` de vite-plugin-pwa 2.0 ou de @vite-pwa/core. À trancher par un ADR.