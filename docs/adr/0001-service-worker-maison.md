# ADR 0001 — Service worker maison et mini-plugin Vite de précache

- **Statut** : Acceptée
- **Date** : 2026-10-06
- **Exigences** : 01 R-PWA-1 à R-PWA-9, R-DEP-4, R-VER-4, R-VER-5, §2 (ligne « Service worker »), §10.3 ;
  02 §3.1, R-ARR-1, R-EXP-1 ; 03 P-LOG-4 ; 04 §12 (Import et service).

## Contexte

L'appli est une PWA installée avant toute création de compte (02 §3.1). Elle doit démarrer hors ligne, ne
changer de version qu'au clic sur « Mettre à jour » et ne jamais perdre une saisie ni effacer IndexedDB.
La spec fixe pour cela des règles précises :

- caches nommés `shell-<buildHash>` et `illustrations-v1` ; `index.html` et `sw.js` en `no-cache`,
  fichiers hachés en `immutable` (R-PWA-1) ;
- mode **prompt** : la nouvelle version s'installe en attente, la page affiche le bandeau, et seul le clic
  envoie `SKIP_WAITING` (R-PWA-2, R-PWA-4) ; jamais de bandeau pendant une séance ou l'onboarding (R-PWA-3,
  R-PWA-5) ;
- interrupteur d'urgence vérifié par le SW à chaque navigation, sans la bloquer (R-PWA-6) ;
- navigation servie depuis la coquille du build courant (R-PWA-8) ;
- version du schéma Dexie portée par le manifeste de précache, jamais d'activation d'une coquille de schéma
  plus ancien (R-PWA-9).

L'outil habituel, vite-plugin-pwa, est gelé en maintenance par ses auteurs au profit de `@vite-pwa/core` et
d'un fork encore jeune de Workbox (issue #933, v2.0.0 du 03/10/2026, voir `docs/research/`). Son mode
`generateSW` produit un SW Workbox dont le comportement passe par des options implicites contraires à
R-PWA-2 à R-PWA-6 : `skipWaiting` et `clientsClaim` (activés d'office en mise à jour automatique),
navigation preload (la navigation passerait par le réseau), caches nommés par Workbox et non
`shell-<buildHash>`. Il faudrait les neutraliser une à une, puis vérifier à chaque montée de version
qu'elles le restent. Rien de ce dont nous avons besoin (un cache par build, une attente stricte de
`SKIP_WAITING`, un champ `localDbVersion`, l'interrupteur d'urgence) n'est fourni tel quel.

## Décision

1. **Service worker maison** dans `apps/web/src/sw/sw.ts` (environ 150 lignes, tâche 36), compilé à part par
   esbuild en un script classique (`iife`, `es2022`, minifié) : pas d'`import` dans le SW, pas de
   `type: 'module'` à l'enregistrement.
2. **Mini-plugin Vite** `apps/web/vite-plugin-precache.ts` (`precachePlugin`, au build seulement). Après
   l'écriture du bundle, `public/` compris, il :
   - liste les fichiers de `dist/` sans `sw.js` ni `*.map`, triés par chemin ;
   - calcule `buildHash` : SHA-256 sur chaque fichier trié (chemin, `\0`, taille, `\0`, octets), 12 premiers
     caractères hexadécimaux. Le calcul ne dépend que des octets du build : deux builds identiques donnent
     le même hachage, un octet changé en donne un autre ;
   - lit `LOCAL_DB_VERSION` dans `src/local-db/db.ts` ;
   - écrit `dist/sw.js`, dont la première ligne est le manifeste
     `self.__APPSPORT_PRECACHE__ = {"buildHash":…,"files":[…],"localDbVersion":…};`, suivie du code du SW
     enveloppé dans une fonction ouverte par `"use strict"` : sous la ligne du manifeste, la directive
     qu'esbuild place en tête du script n'en serait plus une, et le SW tournerait en mode non strict.
     Tout changement de la coquille change donc `sw.js` octet pour octet, et le navigateur détecte la mise à
     jour.
3. **Constantes partagées** dans `apps/web/src/sw/precache-manifest.ts` (`PrecacheManifest`,
   `PRECACHE_GLOBAL`, `SHELL_CACHE_PREFIX = 'shell-'`, `ILLUSTRATIONS_CACHE = 'illustrations-v1'`) : la page
   les lit sans embarquer le code du SW.
4. **Navigation en cache d'abord** **[décision plan]** : le SW répond à toute navigation de même origine hors
   `/api/*` par l'`index.html` du cache `shell-<buildHash>` du SW actif. Il ne passe par le réseau que si ce
   fichier manque. Pas de navigation preload. Le SW ne répond pas (pas de `respondWith`, la requête va au
   réseau) aux requêtes `/api/*`, navigations comprises (le téléchargement `GET /api/me/export` de R-EXP-1
   doit atteindre le serveur), aux requêtes d'une autre origine et à toute requête autre que `GET`.
   Raisons :
   - **mode prompt** : tant qu'une fenêtre de l'appli est ouverte, la page ne change de build qu'au clic.
     Une navigation réseau d'abord (rechargement, seconde fenêtre) chargerait le nouvel `index.html`, et ses
     fichiers hachés, sous l'ancien SW : la nouvelle version tournerait sans clic, et sans bandeau ;
   - **lancement hors ligne sans délai** : l'appli s'ouvre tout de suite, même quand le VPN est coupé ou le
     réseau faible, sans attendre l'échec d'une requête ;
   - **sécurité du schéma Dexie** : un build qui monte `LOCAL_DB_VERSION` met à niveau IndexedDB dès son
     ouverture. Chargé sans clic dans une seconde fenêtre ou par un rechargement, il migrerait la base sous
     la page encore ouverte (Dexie lui fermerait sa connexion), au risque de couper une séance.
5. **Version de la base locale, gardée par le SW et par la page** (R-PWA-9) : le manifeste porte
   `localDbVersion`. Cas visé : le retour arrière « image seule » (R-DEP-4) après un changement de schéma
   Dexie. Un build de schéma plus ancien ne doit jamais tourner sur une base déjà mise à niveau, et Dexie 4
   ne l'en empêche pas : sur `VersionError`, il rouvre la base à la version installée, et l'ancien build
   tournerait sans erreur sur un schéma et une outbox qu'il ne connaît pas. Retenir `SKIP_WAITING` ne suffit
   pas non plus : le navigateur active de lui-même un SW en attente à la fermeture de l'appli
   (décision 7). Trois règles :
   - **marqueur** : la plus haute version de base locale connue de l'appareil est gardée dans Cache Storage,
     cache `appsport-meta`, entrée `/__sw/local-db-version` (réponse synthétique dont le corps est l'entier).
     Le SW n'ouvre donc jamais IndexedDB. Le marqueur n'est jamais abaissé. La page l'écrit après l'ouverture
     de Dexie (`LOCAL_DB_VERSION`) ; le SW l'écrit dans son `activate` (son `localDbVersion`), avant que la
     page de son build ne tourne. `cachesToDelete` ne vise que les `shell-*`, et l'interrupteur d'urgence que
     les `shell-*` et `illustrations-*` : le marqueur reste, comme la base qu'il décrit ;
   - **installation refusée** : avant tout téléchargement, l'`install` du SW lit le marqueur. Si le
     `localDbVersion` de son manifeste est inférieur, l'installation échoue : le SW devient `redundant` sans
     jamais atteindre l'attente, et ni un clic ni la fermeture de l'appli ne peuvent l'activer. Le
     navigateur le retélécharge à chaque recherche de mise à jour et le refuse aussitôt, sans rien précacher ;
   - **page** : la page ne propose jamais d'activer (pas de bandeau) un SW en attente dont `localDbVersion`
     est inférieur au sien, et ne lui envoie jamais `SKIP_WAITING`. Défense en profondeur : avec le refus à
     l'installation, un tel SW ne devrait jamais être en attente.
6. **Service statique** par le serveur (`apps/server/src/static.ts`) : `index.html`, `sw.js` et les fichiers
   non hachés en `no-cache` ; `/assets/*` en `public, max-age=31536000, immutable` ; illustrations
   `<id>.<hash8>.<ext>` immuables, compressées, avec leur propre CSP ; en-têtes de sécurité sur toute
   réponse ; repli SPA vers `index.html` pour les chemins sans extension. Aucun script en ligne ni ressource
   tierce (P-LOG-4) : le build est vérifié sur `dist/index.html`.
7. **Activation sans clic à la fermeture de l'appli** (confirmée par le propriétaire le 2026-10-08) : dans le cycle
   de vie standard, le navigateur active de lui-même un SW en attente dès qu'aucune fenêtre ne dépend plus de
   l'ancien : appli fermée par l'utilisateur, ou tuée par le système (fréquent sur iOS). Retenir
   `SKIP_WAITING` ne l'empêche pas. Au lancement suivant, le nouveau SW sert sa coquille et le nouveau build
   met la base à niveau, sans clic. Décision : **une fermeture complète de l'appli vaut accord** pour un
   build plus récent ; un build plus ancien n'atteint jamais l'attente (décision 5).
   - Garanti : tant qu'une fenêtre de l'appli est ouverte, aucun autre build ne tourne ni ne met la base à
     niveau ; le bandeau n'apparaît jamais pendant une séance ni pendant l'onboarding (R-PWA-3) ; aucun
     build de schéma plus ancien ne s'active (décision 5).
   - Non garanti : « une nouvelle version ne tourne qu'après le clic » (R-PWA-8) devient « après le clic ou
     après une fermeture complète de l'appli ». L'intention de R-PWA-3 (pas de changement de version pendant
     une séance) ne tient que tant que l'appli reste ouverte : une séance en cours (`activeSessionId`) peut
     reprendre sous le nouveau build après une fermeture. Rien n'est perdu : chaque version relit l'outbox et
     le miroir des précédentes (R-VER-4, R-VER-5), et la mise à niveau a lieu au lancement, pas sous une page
     ouverte.
   - Alternative écartée : après une activation sans `SKIP_WAITING`, continuer de servir la coquille
     précédente, nommée dans un marqueur, jusqu'au clic. Il faudrait garder cette coquille malgré la purge à
     l'activation (R-PWA-4), servir ses fichiers depuis un SW dont le manifeste ne les liste pas, faire
     dialoguer une page ancienne avec un SW récent (messages de deux versions), et proposer le clic par un
     autre canal, puisqu'aucun SW ne serait plus en attente. Ce coût et la fragilité ajoutée au SW dépassent
     le gain : le cas couvert, une fermeture pendant une séance, ne perd déjà aucune donnée.

   R-PWA-8 est à amender en ce sens dans la spec (01 §7).

## Repli

Si un défaut du précache n'est pas corrigé en une demi-journée, ou si Background Sync devient nécessaire,
on passe au mode `injectManifest` de vite-plugin-pwa (ou de `@vite-pwa/core`) en **gardant `sw.ts`** : le
plugin n'injecte que la liste des fichiers, notre code reste maître des caches, de `SKIP_WAITING`, de la
navigation, du marqueur de base locale et de l'interrupteur d'urgence. Les constantes de
`precache-manifest.ts` et le service statique ne changent pas.

## Conséquences

- Nous maintenons environ 150 lignes de SW et une centaine de lignes de plugin, testées par Vitest
  (manifeste, hachage, génération de `sw.js`, refus d'installation sous le marqueur) puis par Playwright sur
  Chromium et WebKit : hors ligne, mise à jour A → B, interrupteur d'urgence, 426 (tâches 36 à 39).
- Aucune dépendance gelée dans la chaîne de build : le SW est compilé par esbuild, l'outil prévu aussi pour
  le bundle du serveur (`server.mjs`).
- Le SW ne profite pas des stratégies toutes faites de Workbox. Il n'en a pas besoin : ses deux caches de
  contenu (`shell-<buildHash>` et `illustrations-v1`) ne contiennent que des URL versionnées par le build ou
  par l'empreinte du fichier. Un troisième cache, `appsport-meta`, ne contient que le marqueur de la
  décision 5.
- Une nouvelle version ne tourne sur un téléphone qu'après le clic sur « Mettre à jour », ou après une
  fermeture complète de l'appli (décision 7) ; jamais une version de schéma plus ancien (décision 5). Une
  correction urgente passe par l'interrupteur d'urgence (`SW_KILL_SWITCH=1`, R-PWA-6), qui vide les caches
  `shell-*` et `illustrations-*` sans toucher à IndexedDB.
- Toute version qui touche `src/sw` passe la recette sur iPhone et Android avant son tag
  (`docs/exploitation/recette-telephones.md`, R-TST-4).
