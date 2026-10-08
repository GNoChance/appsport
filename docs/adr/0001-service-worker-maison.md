# ADR 0001 — Service worker maison et mini-plugin Vite de précache

- **Statut** : Acceptée
- **Date** : 2026-10-06
- **Exigences** : 01 R-PWA-1 à R-PWA-9, R-DEP-4, §2 (ligne « Service worker »), §10.3 ; 03 P-LOG-4 ; 02 §3.1.

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
- version du schéma Dexie portée par le manifeste de précache (R-PWA-9).

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
     `self.__APPSPORT_PRECACHE__ = {"buildHash":…,"files":[…],"localDbVersion":…};`, suivie du code du SW.
     Tout changement de la coquille change donc `sw.js` octet pour octet, et le navigateur détecte la mise à
     jour.
3. **Constantes partagées** dans `apps/web/src/sw/precache-manifest.ts` (`PrecacheManifest`,
   `PRECACHE_GLOBAL`, `SHELL_CACHE_PREFIX = 'shell-'`, `ILLUSTRATIONS_CACHE = 'illustrations-v1'`) : la page
   les lit sans embarquer le code du SW.
4. **Navigation en cache d'abord** **[décision plan]** : le SW répond à toute navigation par l'`index.html`
   du cache `shell-<buildHash>` du SW actif. Il ne passe par le réseau que si ce fichier manque. Pas de
   navigation preload. Raisons :
   - **mode prompt** : la page ne change de build qu'au clic. Une navigation réseau d'abord chargerait le
     nouvel `index.html`, et ses fichiers hachés, sous l'ancien SW : la nouvelle version tournerait sans
     clic, et sans bandeau ;
   - **lancement hors ligne sans délai** : l'appli s'ouvre tout de suite, même quand le VPN est coupé ou le
     réseau faible, sans attendre l'échec d'une requête ;
   - **sécurité du schéma Dexie** : un build qui monte `LOCAL_DB_VERSION` met à niveau IndexedDB dès son
     ouverture. Chargé sans clic, il migrerait la base sans que l'utilisateur l'ait choisi, au risque de
     couper une séance.
5. **Version de la base locale** : le manifeste porte `localDbVersion`. La page n'active jamais un SW en
   attente dont `localDbVersion` est inférieur au sien (R-PWA-9). Cas visé : le retour arrière « image
   seule » (R-DEP-4) après un changement de schéma Dexie. L'ancien build ne saurait pas ouvrir la base
   déjà mise à niveau.
6. **Service statique** par le serveur (`apps/server/src/static.ts`) : `index.html`, `sw.js` et les fichiers
   non hachés en `no-cache` ; `/assets/*` en `public, max-age=31536000, immutable` ; illustrations
   `<id>.<hash8>.<ext>` immuables, compressées, avec leur propre CSP ; en-têtes de sécurité sur toute
   réponse ; repli SPA vers `index.html` pour les chemins sans extension. Aucun script en ligne ni ressource
   tierce (P-LOG-4) : le build est vérifié sur `dist/index.html`.

## Repli

Si un défaut du précache n'est pas corrigé en une demi-journée, ou si Background Sync devient nécessaire,
on passe au mode `injectManifest` de vite-plugin-pwa (ou de `@vite-pwa/core`) en **gardant `sw.ts`** : le
plugin n'injecte que la liste des fichiers, notre code reste maître des caches, de `SKIP_WAITING`, de la
navigation et de l'interrupteur d'urgence. Les constantes de `precache-manifest.ts` et le service statique
ne changent pas.

## Conséquences

- Nous maintenons environ 150 lignes de SW et une centaine de lignes de plugin, testées par Vitest
  (manifeste, hachage, génération de `sw.js`) puis par Playwright sur Chromium et WebKit : hors ligne,
  mise à jour A → B, interrupteur d'urgence, 426 (tâches 38 et 39).
- Aucune dépendance gelée dans la chaîne de build : le SW est compilé par esbuild, l'outil prévu aussi pour
  le bundle du serveur (`server.mjs`).
- Le SW ne profite pas des stratégies toutes faites de Workbox. Il n'en a pas besoin : ses deux caches
  (`shell-<buildHash>` et `illustrations-v1`) ne contiennent que des URL versionnées par le build ou par
  l'empreinte du fichier.
- Une nouvelle version n'atteint un téléphone qu'après le clic sur « Mettre à jour ». Une correction urgente
  passe par l'interrupteur d'urgence (`SW_KILL_SWITCH=1`, R-PWA-6), qui vide les caches sans toucher à
  IndexedDB.
- Toute version qui touche `src/sw` passe la recette sur iPhone et Android avant son tag
  (`docs/exploitation/recette-telephones.md`, R-TST-4).
