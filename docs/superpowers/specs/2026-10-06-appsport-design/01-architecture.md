## Architecture technique, synchronisation hors ligne, mises à jour et tests

> Cette section décrit l'approche A, le monolithe TypeScript. Elle est détaillée pour le socle (brique 1). Les règles numérotées servent de critères d'acceptation. Paramètres réglables : `EN_MAJUSCULES`.
> Conventions : les identifiants de code, les tables et les colonnes sont en anglais (snake_case en base, camelCase en TypeScript, conversion faite par le `CamelCasePlugin` de Kysely). L'interface et la documentation sont en français.

### 1. Principes

1. **Une seule pièce à faire tourner.** Le serveur est un conteneur unique, `app`. Il porte l'API, sert la PWA et les illustrations, et contient la base SQLite. Tailscale, restic et les scripts d'exploitation tournent sur l'hôte.
2. **Le téléphone écrit d'abord chez lui.** L'interface lit et écrit toujours dans la base locale. Pendant une séance, le réseau n'est jamais nécessaire.
3. **Le serveur fait foi.** En cas d'écart, sa version finit toujours par être recopiée sur les appareils. Aucune donnée n'est rejetée sans que l'utilisateur le voie.
4. **Hors ligne, on ne saisit que ce qui sert en salle :** les séances, les séries, la douleur et les pesées. Tout le reste se modifie en ligne et reste lisible hors ligne depuis le cache. Cela supprime la plupart des conflits.
5. **Logique pure partagée.** Le moteur de progression, les remplacements, la nutrition et les validateurs sont un seul code, sans entrée-sortie, exécuté à l'identique sur le téléphone et sur le serveur.
6. **Mise en production manuelle.** Rien de l'application n'est mis à jour automatiquement, ni le serveur applicatif ni la PWA. Seuls les correctifs de sécurité Debian et le client Tailscale de l'hôte se mettent à jour seuls, sans redémarrage (section Exploitation). Chaque mise en production est réversible.

### 2. Stack

Versions relevées le 06/10/2026, figées dans le lockfile.

| Couche | Choix | Version | Raison |
|---|---|---|---|
| OS serveur | Debian 13 minimal, `unattended-upgrades` **sans redémarrage automatique**, pare-feu ouvert seulement sur `tailscale0` (plus `22/tcp` depuis le réseau local, en secours) | 13.x | Stable et sobre, avec des dépôts officiels pour Docker et Tailscale. |
| Chiffrement | Volume LUKS2 pour les données (`/srv/appsport`, qui contient le data-root Docker et les secrets), **déverrouillé à la main via Tailscale SSH** après chaque redémarrage. OS en clair, pas de TPM. | — | Tailscale démarre sans le volume, ce qui permet le déverrouillage à distance. Détail dans la section Exploitation. |
| Réseau / TLS | Tailscale sur l'hôte, machine `appsport`, `tailscale serve --bg --https=443 http://127.0.0.1:3000` | client stable, mise à jour automatique | Certificat `*.ts.net` automatique. Les proches passent par le partage, limités au port 443. |
| Conteneurs | Docker Engine + Compose v2, **un seul service `app`** | — | Le minimum de pièces. |
| Runtime | Node.js 24 LTS, puis 26 LTS dès sa sortie (28/10/2026), par une PR et une mise en production normale | ≥ 24.7 | Fournit `node:sqlite` et `crypto.argon2` en natif, sans module natif à compiler. |
| HTTP | Hono + @hono/node-server (fichiers statiques, SSE, csrf, compress) | 4.13.x / 2.1.x | `app.request()` teste les routes sans ouvrir de port. |
| Base | SQLite via `node:sqlite` : `journal_mode=WAL`, **`synchronous=FULL`**, tables `STRICT`, `foreign_keys=ON`, `busy_timeout` | SQLite 3.53.x | Un fichier, un seul écrivain, donc les révisions sont ordonnées. `FULL` évite de perdre une transaction validée lors d'une coupure de courant. |
| Accès SQL | Kysely + adaptateur maison pour `node:sqlite` (une vingtaine de lignes) ; migrations en TS, liste statique | 0.29.x | Typé, sans génération de code. L'adaptateur permet de basculer sur better-sqlite3 si besoin. |
| Contrats | Zod 4 dans `packages/contracts` | 4.x | Source unique pour l'API, les opérations de synchro, les fichiers `data/`, la taxonomie et les outils du coach (`z.toJSONSchema`). |
| Logique métier | `packages/domain`, en TS pur, sans entrée-sortie | — | Même code sur le téléphone et sur le serveur. |
| Front | React 19 + Vite (SPA), wouter, CSS Modules, graphiques SVG maison | 19.x / 8.x | Pas de SEO. Écosystème bien connu des agents. |
| Stockage local | Dexie 4, **toujours derrière des dépôts** (`WorkoutSessionsRepo`, `PerformedSetsRepo`…) | 4.x | L'interface ignore Dexie. Une appli native future pourra changer le stockage. |
| Service worker | SW maison (environ 150 lignes) + mini-plugin Vite qui génère le manifeste de précache, mode « prompt » | — | vite-plugin-pwa est gelé. Repli possible : son mode `injectManifest` (ADR à la brique 1). |
| Coach IA | @anthropic-ai/sdk, boucle d'outils manuelle en streaming, modèle `claude-opus-5-5` par défaut (`COACH_MODEL`) | 0.131.x | Contrôle complet. Détail dans la section Coach. |
| Tests | Vitest, fast-check, fake-indexeddb, Testing Library + happy-dom, Playwright (Chromium + WebKit) | 5.x / 4.x / 6.x / 1.6x | Tout tourne sous Windows, sans Docker. |
| Typage / lint | TypeScript 7 (`--noEmit`) + Biome 2 ; job CI non bloquant sous TypeScript 6 | 7.0.x | TS 7 est très récent : le repli reste prêt. |
| Monorepo / build | pnpm workspaces ; `vite build` + esbuild qui produit un seul `server.mjs` | pnpm 10 | 4 paquets, aucun orchestrateur. L'image ne contient pas de `node_modules`. |
| Sauvegardes | `sqlite.backup()` dans l'appli + restic sur l'hôte (disque local + Backblaze B2), chiffré côté client | paquet Debian | Copie cohérente sans arrêt du service. |
| CI/CD | GitHub Actions → GHCR privé ; Dependabot ; déploiement manuel par tag (`appsport-update`) | — | La CI n'a aucun accès au serveur. |

### 3. Composants et responsabilités

```
Téléphone (PWA installée)
  UI React → dépôts → Dexie : données miroir, outbox, deadletter, catalogue, meta
  moteur de synchro (push, pull, epoch) · service worker (coquille, illustrations)
      │ HTTPS https://appsport.<tailnet>.ts.net (tailnet uniquement)
Hôte Debian : tailscaled → serve :443 → 127.0.0.1:3000
  Conteneur app (un processus Node) :
    Hono : /api/{health,auth,sync,catalog,admin,coach,...} + PWA statique + /illustrations
    Kysely → node:sqlite → /data/appsport.db (volume LUKS)
    tâches : purges, sortie HTTPS vers l'API Claude
  Hôte : timers appsport-{backup,alive,check,restore-test} · appsport-update · appsport-unlock · unattended-upgrades
```

| Composant | Responsabilité | Ne fait jamais |
|---|---|---|
| `packages/contracts` | Schémas Zod de l'API et des opérations ; registre unique de toutes les tables (`entityRules`) ; taxonomie du matériel et des types de mouvement (`src/taxonomy.ts`, dont les profils de référence `REFERENCE_PROFILES`), tenue par la section Exercices | Pas de logique métier |
| `packages/domain` | Progression, allègement, stagnation, `feasible()`, `substitutes()`, nutrition versionnée, machine à états des fiches, validateurs d'`InstanceChange`, rejeu d'une instance | Pas d'horloge ni d'entrée-sortie : la date est passée en paramètre |
| `apps/server` | `createApp(deps)`, avec injection de `Clock`, `IdGen`, `Db` et `AiClient` ; modules `db/`, `auth/`, `sync/`, `catalog/`, `ai/`, `coach/`, `admin/`, `jobs/` ; `cli.ts` | Pas de lecture des données C1 à C3 d'un autre utilisateur par une session admin, sauf `coach_report` (section Vie privée, P-ADM-1) |
| `apps/web` | `local-db/` (schéma Dexie versionné), `repos/`, `sync/` (outbox, transport, moteur, déclencheurs), `sw/`, `features/` | Pas d'accès direct à Dexie depuis un composant d'écran |
| `infra/` | Dockerfile, `compose.yaml`, unités systemd, politique Tailscale, scripts `appsport-*`, runbook de reconstruction | — |

Commandes `cli.ts` : `init`, `snapshot`, `restore`, `admin:bootstrap`, `admin:reset <pseudo>` (section Comptes, R-ROLE-5), `privacy:collect` et `privacy:reapply` (section Vie privée, §8), `db:check`, `data:export`.

**Contrat de l'image** (repris de la section Exploitation) :
- un seul port HTTP, 3000 ;
- configuration uniquement par variables d'environnement (`APP_ORIGIN`, `ANTHROPIC_API_KEY`, `COACH_MODEL`, `SW_KILL_SWITCH`) ;
- `GET /api/health` sans authentification et sans donnée personnelle (§6, R-VER-3) ;
- migrations appliquées au démarrage, dans une transaction, de façon idempotente (§6, R-VER-7) ;
- journaux sur stdout, sans donnée C2 ou C3, sans prompt ni secret ;
- utilisateur non root, `read_only` avec `tmpfs /tmp`, arrêt propre sur SIGTERM en moins de 10 s.

### 4. Organisation du dépôt

```
appsport/
├─ package.json (packageManager pnpm, engines node >=24.7)  pnpm-workspace.yaml
├─ tsconfig.base.json  biome.json  .gitattributes (eol=lf)  .node-version
├─ apps/server/src/{main.ts, app.ts, cli.ts, db/, auth/, sync/, catalog/, coach/, admin/, jobs/}  test/
├─ apps/web/{public/, src/{local-db/, repos/, sync/, sw/, features/, ui/}, vite.config.ts, e2e/}
├─ packages/contracts/  packages/domain/
├─ data/   exports JSON des fiches (tous statuts) et des modèles de programmes, manifeste
│          et fichiers des illustrations, LICENSE (format tenu par la section Exercices)
├─ scripts/ exercises/{draft,import-illustrations}.ts  data/{validate,pull}.ts  svg/check.ts  coach-eval/
├─ eval/coach/  jeu de cas et rapports d'évaluation du coach (section Coach)
├─ infra/  Dockerfile  compose.yaml  systemd/  tailscale-policy.hujson
│          host/appsport-{unlock,update,backup,restore-test,alive,check}  RUNBOOK-reconstruction.md
├─ docs/   adr/  vendor-docs/ (extraits figés par version : node:sqlite, Hono, Kysely, Dexie, SDK Anthropic)
└─ .github/ workflows/{ci.yml, release.yml}  dependabot.yml
```

`scripts/exercises/draft.ts` (rédaction des fiches) tourne sur le poste de dev. Il appelle l'API par `AiClient` (section Coach) avec la clé d'un workspace `appsport-dev` plafonné, rangée dans un `.env.local` non versionné, et jamais avec la clé de production. La CI n'a aucune clé Anthropic.

### 5. Synchronisation hors ligne

#### 5.1 Colonnes communes et identifiants

- **R-SYN-1** Toute table synchronisée a les colonnes `id`, `owner_id`, `rev`, `created_at`, `updated_at`, `updated_by` et `deleted_at`. Exceptions, détaillées dans le modèle de données : `user` (sa propre ligne, sans `owner_id` ni `deleted_at`), `gym` et `gym_equipment` (partagées, sans propriétaire), `consent_event` (ajout seulement, sans `deleted_at`).
- **R-SYN-2** `id` est un UUIDv7 généré **par le client** pour tout ce qui peut être créé hors ligne, et par le serveur pour le reste. Exceptions : `id = owner_id` pour les tables 1-1, clés déterministes pour le matériel, `slot_state` et `engine_decision`, slugs pour le catalogue (modèle de données, §0). Le serveur vérifie son format, mais ne se sert jamais de son horodatage pour ordonner quoi que ce soit, car l'horloge du téléphone n'est pas fiable.
- **R-SYN-3** `rev` est attribué par le serveur, à partir d'un compteur global (`server_meta.sync_counter`) incrémenté à chaque écriture. `updated_at` est l'heure du serveur. `owner_id` vient de la session, jamais du corps de la requête.
- **R-SYN-4** Toute table déclare dans `entityRules` :
  - sa catégorie de donnée (C0 à C3) ;
  - sa classe de synchro (§5.2) ;
  - la liste blanche des colonnes que le client peut écrire (`clientWritable`) ;
  - ses colonnes C2 (`c2Columns`) et ses secrets (`secretColumns`) ;
  - son export (`exported`) et son sort à la suppression du compte (`onUserDelete`).

  Un test vérifie que chaque table et chaque colonne de `sqlite_schema` sont déclarées. Les tests génériques d'export, de suppression et de 404 pour l'admin s'appuient sur ce registre.

#### 5.2 Classes de données et règles de conflit

| Classe | Entités (noms anglais) | Écriture hors ligne | Règle |
|---|---|---|---|
| **J. Journal** | `workout_session`, `performed_exercise`, `performed_set`, `weigh_in` ; `sync_rejection` (créée par le serveur, seule `dismissed_at` est écrite par le client) | oui, via l'outbox | Création idempotente par `id`. Corrections champ par champ, la dernière arrivée au serveur gagne. Suppression logique, qui l'emporte sur tout patch ultérieur. |
| **D. Calculé par le serveur** | `slot_state`, `engine_decision`, `nutrition_target`, `nutrition_checkin` (sa réponse passe par l'API en ligne) | non poussé | Le téléphone peut calculer une copie provisoire (cibles de la séance suivante). Le pull la remplace toujours. |
| **E. Édité en ligne** | `user` (sa propre ligne ; date de naissance en lecture seule), `training_profile` (dont le mode prudent), `health_screening`, `limitation`, `consent_event` (ajout seulement), `place`, `home_equipment`, `gym`, `gym_equipment`, `nutrition_profile`, `program_instance`, `instance_change` | non : appel API direct, refusé hors ligne avec le message « Nécessite le réseau » | Le serveur fait foi : dernière écriture gagnante, champ par champ, plus l'historique des salles (`gym_history`). Matériel : ajout et retrait idempotents sur une clé déterministe. `instance_change` vérifie `base_revision` : si la révision est périmée, la proposition passe à `expired` (code `stale_revision`), avec une réponse 409 ; il faut une nouvelle proposition. |
| **C. Catalogue** | fiches d'exercices publiées et retirées, modèles de programmes, manifeste des illustrations, fiches conseils (`advice_sheet`) | lecture seule | Téléchargé en entier quand `catalog_version` change (ETag). Hors outbox. |
| **H. Hors synchro** | fils et messages du coach, et les autres tables H du modèle de données (tables techniques, invitations, sessions, journaux) | — | Lus et écrits en ligne seulement. Ils ne sont pas copiés sur le téléphone. |

Règles propres à certains types :
- **R-SYN-5** `weigh_in` : une seule pesée non supprimée par (`owner_id`, `date`). Si une création arrive avec un autre `id` pour une date déjà occupée, le serveur supprime logiquement l'ancienne et garde la nouvelle, dans l'ordre d'arrivée.
- **R-SYN-6** Supprimer une `workout_session` supprime logiquement ses `performed_exercise` et `performed_set` dans la même transaction. La restauration d'une ligne supprimée n'est pas prévue en v1.
- **R-SYN-7** Deux séances démarrées hors ligne sur deux appareils sont toutes les deux conservées. Le serveur rejoue l'instance dans l'ordre des dates de début, et son résultat fait foi (voir la section Programmes). `workout_session.status = in_progress` et `device_id` sont synchronisés. Un second appareil affiche « Séance en cours sur un autre appareil », avec l'option « Continuer ici », qui réécrit `device_id`.
- **R-SYN-8** Au démarrage d'une séance, les cibles (colonnes `target_*` de `performed_set`) et `rules_version` sont **figées dans la séance**. Un pull, une reprise ou une nouvelle version du moteur ne changent jamais les charges affichées d'une séance en cours.
- **R-SYN-9** Données C2 (colonnes `pain_level` et `swap_reason = pain` de `performed_exercise`, et table `weigh_in`) :
  - le client ne les envoie que si le consentement santé est actif dans son cache ;
  - si le serveur reçoit une colonne C2 sans consentement actif, il la met à NULL (et remplace `swap_reason = pain` par NULL), applique le reste et répond `applied_partial`, avec la liste des champs retirés. Pour une ligne d'une table entièrement C2 (`weigh_in`), il ne crée rien et répond aussi `applied_partial` ; le client supprime alors sa copie locale. Rien ne va dans `sync_rejection` (Vie privée, P-CST-4). Une série n'est jamais perdue à cause d'un consentement retiré sur un autre appareil ;
  - au retrait du consentement, le serveur, dans une seule transaction, vide immédiatement les colonnes C2 et le contenu des lignes des tables C2, dont il ne reste qu'une suppression logique sans contenu (`id`, `owner_id`, `rev`, `deleted_at`), propagée par pull (nouveaux `rev`) puis purgée au bout de `TOMBSTONE_TTL` (R-SYN-23), et ne rejoue pas les slots. Le client efface ses copies locales et les opérations en attente de cette catégorie (Vie privée, P-CST-3).
- **R-SYN-10** Douleur sans consentement santé (sections Programmes §13 et Vie privée P-CST-2) :
  - le bouton douleur écrit seulement l'ajustement neutre `next_adjustment` (`hold` ou `lighten`) de `performed_exercise`, donnée C1 non sanitaire, synchronisée normalement ;
  - aucune trace de la douleur ni de son motif n'est stockée, ni sur le serveur, ni dans la base locale, ni dans l'outbox.

#### 5.3 Écriture locale et outbox

- **R-SYN-11** La ligne locale et l'opération `{opId (UUIDv7), userId, entity, id, kind: create|patch|delete|restore_upsert, fields, clientTs, protocol, attempts}` (`restore_upsert` : R-SYN-26) sont écrites **dans la même transaction Dexie**. L'opération est validée par Zod avant d'entrer dans la file. Une opération invalide est un bug, qui fait échouer la saisie de façon visible.
- **R-SYN-12** L'outbox est étiquetée par `userId`. Elle n'est envoyée que sous une session du **même** utilisateur. Un 401 met la synchro en pause sans toucher à la file.
- **R-SYN-13** Une opération ne quitte l'outbox qu'après l'accusé de réception du serveur. Le client enregistre alors le `rev` attribué dans la ligne locale (`serverRevSeen`).
- **R-SYN-14** À la déconnexion, les données locales ne sont purgées que si l'outbox est vide. Sinon, l'appli avertit et propose l'export.

#### 5.4 Push

`POST /api/sync/push` envoie au plus `SYNC_PUSH_MAX` = 200 opérations, dans l'ordre de la file.
- **R-SYN-15** Le lot est traité dans une transaction, avec un point de sauvegarde par opération. Une opération rejetée n'annule pas les autres.
- **R-SYN-16** Pour chaque opération, le serveur suit cet ordre :
  1. si `applied_op(op_id)` existe, il répond `duplicate` ;
  2. sinon, il valide le schéma, vérifie l'autorisation (`owner_id`), filtre par la liste blanche (les colonnes réservées au serveur sont ignorées), applique l'opération et attribue `rev`.

  Statuts possibles : `applied`, `applied_partial`, `duplicate` ou `rejected` (avec un code). Un patch sur une ligne supprimée donne `applied` sans effet.
- **R-SYN-17** Si un parent a été rejeté, ses enfants le sont aussi, avec le code `parent_rejected`.
- **R-SYN-18** Une opération rejetée va dans la deadletter locale **et** dans la table serveur `sync_rejection`, synchronisée vers son propriétaire. Elle est donc visible sur tous ses appareils, avec le détail et une action « Ignorer ». Elle n'est jamais supprimée en silence.
- **R-SYN-19** Si le lot touche des séries d'une instance de programme, le serveur rejoue cette instance (fonction de `packages/domain`) dans la même transaction. Les `slot_state` et `engine_decision` recalculés reçoivent de nouveaux `rev`.

#### 5.5 Pull

`GET /api/sync/pull?since=<watermark>&limit=500` renvoie les lignes du périmètre de l'utilisateur, triées par `rev`, avec `nextWatermark` et `hasMore`.
- **R-SYN-20** Le watermark est opaque (`<server_epoch>:<rev>`), ce qui permet de changer de base plus tard sans changer le protocole.
- **R-SYN-21** Le périmètre comprend :
  - les lignes de l'utilisateur, toutes classes confondues sauf H et C ;
  - toutes les salles partagées (`gym`) et leur matériel (`gym_equipment`), en C0.

  Aucune ligne d'un autre membre n'est synchronisée : la liste des pseudos visibles d'une salle (`visible_at_gym = 1`) est servie par l'API en ligne. Un test de fuite vérifie qu'aucune ligne C1 à C3 d'un autre utilisateur ne sort, y compris pour une session admin.
- **R-SYN-22** Une ligne reçue alors qu'elle a encore des patchs en attente est rebasée : la ligne serveur est appliquée, puis les patchs locaux sont rejoués par-dessus.
- **R-SYN-23** Les suppressions logiques sont purgées au bout de `TOMBSTONE_TTL` = 90 jours, et `applied_op` au bout de 12 mois. Un watermark plus ancien que la dernière purge reçoit `410 {code: "watermark_expired"}`. Le client garde alors son outbox, vide son miroir et refait un pull complet.
- **R-SYN-24** Un compte supprimé reçoit `410 {code: "account_deleted"}` : le client efface toutes les données locales de cet utilisateur.

#### 5.6 Époque du serveur et restauration

- **R-SYN-25** `server_meta.server_epoch` (UUID) est généré par `init` et **par chaque restauration**, y compris lors d'un retour arrière avec restauration. Au même moment, `epoch_base_rev` reçoit la valeur du compteur restauré. Chaque réponse de l'API porte l'en-tête `X-Appsport-Epoch`.
- **R-SYN-26** Quand un client voit une nouvelle époque, il procède ainsi :
  1. il met l'outbox en pause ;
  2. il renvoie, par opérations `restore_upsert`, ses lignes de classe J (hors `sync_rejection`, créée par le serveur) dont le `updated_at` local date de moins de `EPOCH_RESEND_DAYS` = 60 jours, suppressions logiques comprises ;
  3. il reprend l'outbox ;
  4. il refait un pull complet.
- **R-SYN-27** Traitement d'un `restore_upsert` par le serveur :
  - si la ligne est absente, il l'insère ;
  - si la ligne est présente, il la remplace seulement si son `rev` est ≤ `epoch_base_rev` (pas modifiée depuis la restauration) **et** si `serverRevSeen` du client est strictement supérieur à ce `rev` (le client avait vu une version plus récente que la sauvegarde) ;
  - sinon, il la laisse telle quelle.

  Ainsi, un appareil resté longtemps hors ligne ne fait pas régresser les données.
- **R-SYN-28** Les données de classe E modifiées après la sauvegarde sont perdues, à une exception près : si le cache du client montre un consentement **retiré** qui est actif sur le serveur restauré, le client renvoie automatiquement le retrait. Un consentement donné n'est jamais renvoyé automatiquement.

#### 5.7 Déclencheurs, état de connexion et stockage

- **R-SYN-29** La synchro se déclenche :
  - au lancement ;
  - au retour au premier plan ;
  - sur l'événement `online` (simple indice) ;
  - 2 s après la validation d'une série (avec regroupement) ;
  - toutes les 60 s quand l'appli est visible et que l'outbox n'est pas vide ;
  - avant l'ouverture du coach, avec une tentative de vider l'outbox limitée à 4 s.
- **R-SYN-30** Chaque appel est limité à `SYNC_TIMEOUT_MS` = 4000 ms. En cas d'échec, les reprises se font à intervalle croissant, de 2 s à 5 min. L'état « connecté » vient du résultat des appels et de la sonde `/api/health`, **jamais de `navigator.onLine`**.
- **R-SYN-31** `navigator.storage.persist()` est demandé à la fin de l'onboarding, dans l'appli installée. Le résultat est affiché dans Réglages. Un refus ne bloque pas l'usage, mais l'appli affiche un conseil d'export.
- **R-SYN-32** Catalogue et illustrations :
  - le texte du catalogue est copié en entier dans Dexie et téléchargé de nouveau quand `catalog_version` change ;
  - les illustrations (fichiers à nom haché, cache HTTP immuable) sont servies par le SW en cache d'abord ;
  - après chaque mise à jour du catalogue, et au démarrage s'il en manque, le SW télécharge toutes les illustrations référencées qui manquent (environ 300 fichiers, quelques Mo) et supprime celles qui ne sont plus référencées (section Exercices, §11) ;
  - pas de cache LRU maison ni de bouton « tout télécharger » en v1.
- **R-SYN-33** Le voyant **« Prêt hors ligne »** est vert si et seulement si quatre conditions sont réunies :
  1. la coquille du build courant est en précache ;
  2. le catalogue local correspond à la dernière `catalog_version` connue ;
  3. les illustrations référencées par le catalogue local sont en cache ;
  4. un pull a réussi il y a moins de 24 h.

  Il est exigé en fin d'onboarding.
- **R-SYN-34** Un compteur **« N en attente »** (opérations dans l'outbox) est visible partout où l'on saisit. Un compteur « N refusé(s) » mène aux rejets (R-SYN-18).

### 6. Compatibilité client et serveur

1. **R-VER-1** Le format des opérations et du pull porte un entier `SYNC_PROTOCOL`, envoyé dans l'en-tête `X-Appsport-Protocol`. Le serveur accepte `[MIN_PROTOCOL, SYNC_PROTOCOL]`, avec `MIN_PROTOCOL` ≥ `SYNC_PROTOCOL − 1`.
2. **R-VER-2** Hors de cette plage, le serveur répond `426 {serverProtocol, minProtocol}`. La saisie hors ligne continue, l'outbox est conservée, et le client cherche une mise à jour du SW (§7).
3. **R-VER-3** `GET /api/health` renvoie `{status, version, db, protocol, minProtocol, epoch, swKill}`. C'est aussi la sonde de connexion du client.
4. **R-VER-4** **Téléphone resté longtemps hors ligne** : aucune opération n'est jamais jetée pour une raison de version. Chaque changement de `SYNC_PROTOCOL` livre un convertisseur `vN → vN+1` des opérations de l'outbox, appliqué par la mise à jour Dexie (`version(n).upgrade()`). La chaîne de convertisseurs couvre toutes les versions depuis la v1. Un appareil en retard de plusieurs versions installe la PWA courante, convertit sa file, puis synchronise.
5. **R-VER-5** Le schéma Dexie n'évolue que par `version(n).upgrade()`. Chaque version doit pouvoir relire l'outbox et le miroir de toutes les versions précédentes. Des jeux de test figés par version le vérifient.
6. **R-VER-6** Les migrations serveur suivent le principe expand/contract. Chaque migration se déclare `breaking: true|false` dans la table `schema_migrations`. Une colonne n'est retirée (contract) que dans une version où plus aucun protocole accepté ne l'utilise.
7. **R-VER-7** Au démarrage, l'appli applique d'abord, dans une transaction, les migrations connues qui manquent (puis le chargeur du catalogue tourne). Elle refuse de tourner :
   - si l'une de ces migrations échoue ;
   - si la base contient une migration qu'elle ne connaît pas **et** marquée `breaking`.

   Elle tourne en revanche sur un schéma plus récent si les migrations inconnues sont toutes non cassantes, ce qui permet le retour arrière sans restauration.

### 7. Mises à jour de la PWA

1. **R-PWA-1** En-têtes de cache :
   - `index.html` et `sw.js` en `no-cache` ;
   - fichiers hachés en `immutable` ;
   - caches nommés `shell-<buildHash>` et `illustrations-v1`.
2. **R-PWA-2** Le SW est en mode **prompt** : la nouvelle version s'installe en attente, puis l'appli affiche le bandeau « Nouvelle version disponible — Mettre à jour ». La recherche de mise à jour a lieu au lancement, au retour au premier plan, et toutes les 60 min quand l'appli est visible.
3. **R-PWA-3** Le bandeau n'apparaît **jamais pendant une séance** (indicateur `activeSessionId` dans Dexie) ni pendant un onboarding.
4. **R-PWA-4** Au clic, l'appli envoie `SKIP_WAITING`, puis se recharge. Les anciens caches `shell-*` sont purgés à l'activation. IndexedDB n'est jamais effacé par une mise à jour.
5. **R-PWA-5** Après un 426 (R-VER-2), le bandeau ne peut plus être fermé, mais il reste soumis à R-PWA-3.
6. **R-PWA-6** **Interrupteur d'urgence** : avec `SW_KILL_SWITCH=1` sur le serveur, `/api/health` renvoie `swKill: true`. La page (au démarrage) et le SW (à chaque navigation, de façon non bloquante) le vérifient. S'il est actif :
   1. le SW se désenregistre ;
   2. les caches `shell-*` et `illustrations-*` sont vidés (**pas IndexedDB**) ;
   3. la page se recharge depuis le réseau.

   Il est livré et testé dès la première version du socle.
7. **R-PWA-7** L'origine `https://appsport.<tailnet>.ts.net` ne doit jamais changer : la changer effacerait les données locales. Un futur changement exigerait de vider toutes les outbox d'abord (ADR à écrire le cas échéant).

### 8. Pipeline de déploiement

**Construction**
1. **R-DEP-1** Une PR fusionnée sur `main` lance la CI complète (§9.2).
2. **R-DEP-2** Un tag `vX.Y.Z` posé sur un commit de `main` dont la CI est verte lance `release.yml` :
   - construction en plusieurs étapes (`vite build`, puis `esbuild --bundle`) ;
   - image `node:24-slim` (puis 26) + `server.mjs` + `public/` + `data/`, sans `node_modules` ;
   - publication de `ghcr.io/gnochance/appsport:vX.Y.Z`.

   La version est inscrite dans l'image et renvoyée par `/api/health`.

**Mise en production** : `sudo appsport-update vX.Y.Z`, lancé par l'admin via Tailscale SSH, de préférence le soir.

3. **R-DEP-3** Le script enchaîne les étapes suivantes et s'arrête à la première erreur :
   1. il vérifie que le volume LUKS est monté, que le fichier sentinelle `/srv/appsport/data/.appsport-volume` (vu `/data/.appsport-volume` dans le conteneur) existe et que `/api/health` répond 200 ;
   2. il affiche les séances `in_progress` démarrées il y a moins de 3 h (par pseudo) et demande confirmation ;
   3. il fait `git fetch --tags && git checkout vX.Y.Z` dans `/opt/appsport` (compose et scripts de la même version), puis `docker compose pull`. En cas d'échec, par exemple un jeton GHCR expiré, il s'arrête **sans rien avoir changé** et le signale ;
   4. il prend un **instantané avant migration** (`cli snapshot --tag pre-vX.Y.Z` via `sqlite.backup()`), puis lance restic avec le tag `pre-deploy` ;
   5. il écrit `APPSPORT_VERSION=vX.Y.Z` dans `/srv/appsport/deploy.env`, puis lance `docker compose up -d` ; les migrations s'appliquent au démarrage, en une transaction (R-VER-7) ;
   6. il attend au plus 2 min que `/api/health` réponde `200` avec `version == vX.Y.Z` ;
   7. il note la date, la version précédente, la nouvelle et le résultat dans `/srv/appsport/deploy.log`.
4. **R-DEP-4** **Retour arrière automatique** si l'étape 5 ou 6 échoue, et **manuel** avec `appsport-update --rollback` :
   1. il essaie d'abord l'image précédente seule. Elle démarre si R-VER-7 l'accepte (migrations non cassantes), sans perte de données ;
   2. sinon, il restaure l'instantané `pre-vX.Y.Z`, ce qui régénère `server_epoch`, puis démarre l'image précédente. Les téléphones renvoient leurs 60 derniers jours (R-SYN-26).

   Durée visée : moins de 10 min.
5. **R-DEP-5** Garde au démarrage, bloquante :
   - `RequiresMountsFor=/srv/appsport` dans l'unité systemd ;
   - Docker désactivé au boot et point de montage vide non inscriptible ;
   - l'appli refuse de démarrer sans le fichier sentinelle ou sans base, sauf pendant `init`. Elle ne crée jamais de base vide sur laquelle les téléphones se synchroniseraient.
6. **R-DEP-6** Après un redémarrage, la synchro reste indisponible jusqu'au déverrouillage manuel (`appsport-unlock` via Tailscale SSH). Pendant ce temps, la saisie hors ligne continue normalement. Les redémarrages automatiques sont désactivés.
7. **R-DEP-7** Sauvegardes, en résumé (détail dans la section Exploitation) :
   - `sqlite.backup()` (`cli snapshot`) chaque jour à 03:30 et avant chaque déploiement (pas d'instantané horaire), 3 de chaque type conservés localement, puis restic (`appsport-backup`) ;
   - restic vers le disque local et Backblaze B2, avec `forget --keep-daily 30 --prune` ;
   - **test de restauration mensuel** (`appsport-restore-test`) : restauration dans un dossier temporaire du volume chiffré, `PRAGMA integrity_check`, conteneur jetable, appel de `/api/health` ;
   - `cli restore` régénère toujours `server_epoch`.

### 9. Stratégie de tests et CI

#### 9.1 Niveaux de tests

Principe : un test rouge avant chaque comportement, des dépendances injectées (`Clock`, `IdGen`, `Db`, `AiClient`) et tout dans un seul processus Node sous Windows, sans Docker.

1. **Domaine** : tables de cas, propriétés fast-check et scénarios de référence sur 12 semaines par modèle de programme. Couverture d'au moins 90 %.
2. **Synchro** (cœur du socle) : le vrai `createApp` sur SQLite en mémoire, avec deux appareils simulés (Dexie sur fake-indexeddb) et un transport qui **perd, duplique, retarde ou réordonne** les envois. Propriétés vérifiées :
   - les appareils convergent ;
   - aucune série n'est perdue ni dupliquée ;
   - un rejet est toujours visible.

   Tests ciblés : 401, 426, 410 (`watermark_expired` et `account_deleted`), changement d'époque avec appareil en retard (R-SYN-27), retrait de consentement concurrent (R-SYN-9), pesée en double (R-SYN-5), séance ouverte sur deux appareils, conversion d'une outbox de chaque protocole antérieur (R-VER-4).
3. **Serveur** :
   - invitations, sessions, limitation des tentatives, CSRF ;
   - isolation : tests de fuite sur le pull, et 404 pour une session admin sur les données C1 à C3 des autres (sauf `coach_report`, P-ADM-1), générés depuis `entityRules` ;
   - export et suppression génériques ;
   - chargeur du catalogue et ETag ;
   - garde de démarrage, R-VER-7.
4. **Schéma et migrations** :
   - instantané de `sqlite_schema` sur une base vide ;
   - passage de la base de la version précédente au schéma courant ;
   - image précédente sur un schéma courant non cassant ;
   - tests de l'adaptateur rejoués sur better-sqlite3 ;
   - cohérence entre Zod, les types Kysely et Dexie.
5. **Web** : Testing Library + happy-dom + fake-indexeddb (écran de séance, onboarding, voyant et compteurs).
6. **E2E Playwright** (Chromium et WebKit, profils Pixel et iPhone). Le hors-ligne est simulé par `context.setOffline(true)` **et** par des requêtes qui n'aboutissent pas (VPN coupé : on s'appuie sur le délai de 4 s, pas sur une erreur DNS) :
   1. invitation (lien et code saisi), onboarding, « Prêt hors ligne », première séance ;
   2. séance complète hors ligne, rechargement à froid hors ligne, retour du réseau, synchro, vue sur un second contexte ;
   3. fiche et illustrations affichées hors ligne ;
   4. **mise à jour du SW** : build A installé, séance démarrée, build B déployé. On vérifie que le bandeau est absent pendant la séance et présent après, puis qu'après le clic l'appli tourne sur B avec l'outbox intacte et le schéma Dexie à jour ;
   5. 426, puis mise à jour, puis synchro de la file ;
   6. interrupteur d'urgence : désenregistrement, rechargement, IndexedDB intact ;
   7. changement d'époque : restauration simulée, renvoi des 60 jours, aucune perte.
7. **Coach** : faux `AiClient` déterministe, aucun appel réseau en CI. L'évaluation payante `pnpm coach:eval` (jeu de cas `eval/coach/`) est lancée à la main depuis le poste de dev, sur le workspace `appsport-dev` (voir la section Coach, §16).

#### 9.2 CI (GitHub Actions)

- **R-TST-1** Bloquant sur chaque PR : Biome, `tsc` (TypeScript 7), Vitest (tous niveaux), `data:validate`, `svg:check`, E2E Chromium + WebKit et build de l'image.
- **R-TST-2** Non bloquant : `tsc` sous TypeScript 6.
- **R-TST-3** `release.yml` ne publie que depuis un tag sur un commit vert.

#### 9.3 Recette sur vrais téléphones

- **R-TST-4** Critère de sortie de toute version qui touche le SW, la synchro, le schéma Dexie ou un comportement iOS. Elle se fait sur au moins un iPhone et un Android des proches, avec la PWA installée :
  1. démarrage à froid en mode avion, appli tuée ;
  2. 100 séries hors ligne, puis retour du VPN : ni perte ni doublon, et le compteur revient à 0 ;
  3. Tailscale coupé avec le Wi-Fi ou la 4G actifs : la saisie reste fluide et l'appli affiche « hors ligne » en 4 s au plus ;
  4. redémarrage du téléphone avec une file non vide ;
  5. mise à jour de la PWA avec une file non vide, hors séance ;
  6. une fois à la recette du socle, puis à chaque changement du stockage : 7 jours sans réseau, puis synchro.

### 10. Points à vérifier pendant la brique 1

1. Le comportement du SSE derrière `tailscale serve` (mise en mémoire tampon, délais).
2. L'échec rapide ou le délai d'attente quand le VPN est coupé sur un réseau faible, à mesurer sur le terrain pour ajuster `SYNC_TIMEOUT_MS`.
3. Le choix entre le SW maison et le mode `injectManifest`, à trancher par un ADR avant d'écrire le SW.
4. Le statut de `node:sqlite` dans Node 26 et la date de bascule de l'image.