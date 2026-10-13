# Refonte Rune du socle — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au socle le look et la vie de Rune (thèmes, coquille, composants, animations, coachs, rangs, Progression en avant-goût) et terminer la revue finale, pour une PR `socle` → `main` prête (pas de mise en production avant la fin de toutes les briques, décision du 2026-10-13).

**Architecture:** On garde React 19 + modules CSS. Une couche de jetons CSS (5 thèmes) et une boîte à outils dans `apps/web/src/ui/` portent tout le style ; les écrans de `apps/web/src/features/` sont rhabillés zone par zone sans toucher aux dépôts ni à la synchro. Une seule donnée serveur nouvelle : `training_profile.coach`. La revue finale touche le serveur, l'infra, les docs et le harnais E2E dans une file à part.

**Tech Stack:** TypeScript, React 19, Vite 8, CSS Modules, wouter, Dexie, Hono, Kysely/node:sqlite, Vitest + Testing Library + happy-dom, Playwright (Chromium, WebKit), bats, Fontsource.

**Spec:** `docs/superpowers/specs/2026-10-13-refonte-rune-design.md` (lire en entier avant toute tâche). Maquettes : `C:\Users\eliott.colin\appsport-local\maquettes\project\*.dc.html` (sources HTML lisibles, rangées A à E + Mix/Progression), guide `C:\Users\eliott.colin\appsport-local\maquettes\GUIDE.md`, prototype animé `C:\Users\eliott.colin\appsport-local\prototype\src.html`. Art : `docs/brand/` et `C:\Users\eliott.colin\appsport-local\brand\{skald,rangs}\`.

## Global Constraints

- Branche `socle`, un commit (ou plusieurs) par tâche, messages en français au format du dépôt (`feat(web): …`, `fix(server): …`), trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` verts à la fin de chaque tâche ; E2E (`pnpm --filter @rune/web test:e2e`) verts pour les tâches qui touchent un parcours E2E.
- CSP inchangée : `default-src 'self'` — aucune ressource externe (polices embarquées), aucun `<script>` inline, aucun `dangerouslySetInnerHTML`, aucun `style="…"` en HTML statique (les props `style` de React sont permises).
- Plus rien ne s'appelle appsport (décision du 2026-10-13, tâche 0) : affichage « Rune », code `rune` (paquets `@rune/*`, en-têtes `X-Rune-*`, variables `RUNE_*`, chemins `/srv/rune`, image `ghcr.io/gnochance/rune`, dépôt `GNoChance/rune`). Seuls `docs/superpowers/` et `docs/research/` gardent l'ancien nom par historique.
- Apostrophe droite `'` dans tous les textes ; tutoiement ; textes légaux (consentement santé, avertissement santé, ligne d'écoute) mot pour mot, seule substitution « appsport » → « Rune ».
- Accessibilité : rôles et noms accessibles existants conservés ; cible tactile ≥ 44 px ; contrastes ≥ 4,5:1 (texte) et 3:1 (grand texte, éléments d'interface) dans les 5 thèmes ; `prefers-reduced-motion` respecté.
- Animations : 150–250 ms (retour de geste), 300–450 ms (écran), 600–1 200 ms (célébration) ; courbe unique `cubic-bezier(.2,.8,.2,1)`.
- Le coach : textes écrits à l'avance, étiquetés, jamais de chiffre nutritionnel, jamais d'indicateur « en train d'écrire ».
- Aucune fausse donnée à l'écran : avant-goûts à 0 / rang E, pas de valeur inventée.
- Maximum 5 agents en parallèle ; une tâche ne modifie que les fichiers de sa liste (plus les tests qu'elle met à jour pour un texte changé).

## Review Focus

1. **Thème forcé + mode sombre du téléphone** : choisir « Clair » alors que le téléphone est en sombre doit rendre clair partout (aucun bloc resté sombre) ; idem « Carnet » et « Salle de nuit ». Test dans la tâche 1.
2. **Reprise d'onboarding sans coach** : un compte créé avant la refonte (profil sans `coach`, `onboardingStep` = `availability`) rouvre l'étape coach puis reprend à `availability` ; « Commencer » ne termine pas tant que le coach manque. Tests dans les tâches 6 et 7.
3. **Mouvement réduit** : avec `prefers-reduced-motion: reduce`, aucune animation ne retarde l'apparition d'un contenu ou d'un bouton (la célébration « Éveil terminé » affiche tout immédiatement). Tests dans les tâches 4 et 8.
4. **Brouillon d'équipement abandonné** : quitter la fiche avec des changements non enregistrés ne doit rien envoyer et ne doit pas perdre l'état serveur ; un échec réseau à l'enregistrement laisse le brouillon intact avec une erreur. Test dans la tâche 11.
5. **Clavier et lecteurs d'écran dans les feuilles du bas** : Échap ferme, le focus reste piégé puis revient sur le déclencheur, le fond est `inert`. Test dans la tâche 4.

---

## Structure des fichiers

- `apps/web/src/ui/theme/` : `tokens.css` (jetons des 5 thèmes), `theme.ts` (choix et application), `fonts.ts` (imports Fontsource).
- `apps/web/src/ui/` : composants (un fichier par composant), `motion.css`, `use-reduced-motion.ts`, `art/` (avatars et rangs générés en TSX), `Logo.tsx`.
- `apps/web/scripts/` : `svg-to-tsx.mjs` (génère `ui/art/`), `render-icons.mjs` (PNG des icônes PWA), `screenshots.mjs` (captures de relecture).
- `apps/web/src/features/coach/` : `coach-lines.ts` (textes), `CoachStep.tsx`, `CoachIntro.tsx`, `MyCoachPage.tsx`.
- `apps/web/src/features/progression/ProgressionPage.tsx`.
- `apps/web/src/features/profile/ProfileHub.tsx` (+ `ProfilePage.tsx` devient « Mon profil »).
- Serveur : `apps/server/src/db/migrations/0002_coach.ts`, `packages/contracts/src/coach.ts`.

## Tâche préalable — renommage (avant toutes les files)

### Task 0: Renommage complet appsport → rune

**Files:**
- Modify: tout le dépôt sauf `docs/superpowers/**` et `docs/research/**` (historique) : `package.json` des 5 paquets et leurs imports, configs (tsconfig, vitest, biome, playwright), `pnpm-lock.yaml` (régénéré), `apps/**`, `packages/**`, `infra/**`, `.github/workflows/**`, `docs/exploitation/**`, `docs/adr/**`, `docs/fiche-de-traitement.md`, `docs/incidents.md`, `README.md`, `data/LICENSE`
- Rename (git mv) : `infra/host/appsport-*` → `infra/host/rune-*` ; `infra/systemd/appsport-*` → `infra/systemd/rune-*` ; les fichiers d'infra nommés `appsport` (drop-in Docker, fichier apt `52appsport-unattended`, etc.) ; `docs/exploitation/installer-appsport.md` → `installer-rune.md`
- Create: `apps/server/test/infra/name.test.ts`

**Interfaces:**
- Produces (noms que toutes les tâches suivantes utilisent) :
  - paquets `rune` (racine), `@rune/contracts`, `@rune/domain`, `@rune/server`, `@rune/web` ; commandes `pnpm --filter @rune/<paquet>` ;
  - en-têtes `X-Rune-Epoch`, `X-Rune-Protocol` (constantes `EPOCH_HEADER`, `PROTOCOL_HEADER` inchangées) ;
  - variables d'environnement `RUNE_*` à la place de chaque `APPSPORT_*` (`RUNE_DATA_DIR`, `RUNE_PUBLIC_DIR`, `RUNE_CONTENT_DIR`, `RUNE_URL`, `RUNE_ROOT`, `RUNE_REPO`, `RUNE_VERSION`, …) ;
  - données : `/data/rune.db`, sentinelle `/data/.rune-volume`, `EXPORT_FORMAT` = `rune-export/1`, fichier d'export `rune-export-AAAA-MM-JJ.json` ;
  - navigateur : bases Dexie, clés de stockage, noms d'événements et préfixe de journal en `rune` ;
  - hôte : `/srv/rune`, `/opt/rune`, projet compose `rune`, image `ghcr.io/gnochance/rune`, scripts `rune-unlock`, `rune-update`, `rune-backup`, `rune-restore-test`, `rune-alive`, `rune-check`, unités systemd `rune-*`, mapper LUKS `rune`, partlabel `rune-data`, verrou `/run/rune.lock`, bucket B2 `rune-backups`, machine Tailscale `rune`, adresse `https://rune.<tailnet>.ts.net`, dépôt `https://github.com/GNoChance/rune` ;
  - textes visibles : « Rune » (consentement « que Rune enregistre », version 1.0 inchangée ; avertissement santé « Rune ne remplace pas un avis médical… », en « vous ») ;
  - R-MDP-3 : refus d'un mot de passe qui contient « rune » (insensible à la casse), code `contains_app_name`, message « Le mot de passe ne doit pas contenir « rune ». » ;
  - `RESERVED_USERNAMES` : `admin`, `rune`, `appsport`, `systeme`.

- [ ] **Step 1: Test qui échoue** — `name.test.ts` : parcourt `git ls-files` (hors `docs/superpowers/`, `docs/research/`, fichiers binaires) et échoue si un chemin ou un contenu contient « appsport » (insensible à la casse), sauf deux exceptions exactes : l'entrée `'appsport'` de `RESERVED_USERNAMES` et le nom de fichier historique `2026-10-06-appsport-design` ; il vérifie aussi que `docs/exploitation/P1-installation.md` contient `rune.<tailnet>.ts.net` et que `isPasswordAcceptable` (ou la fonction R-MDP-3 existante) refuse « MaRune2026!! ».
- [ ] **Step 2: Lancer** `pnpm --filter @rune/server test infra/name` après le renommage des paquets (sinon par chemin) — FAIL.
- [ ] **Step 3: Renommer** : paquets et imports d'abord (`pnpm install` régénère le lockfile), puis identifiants, variables, chemins, scripts et unités (`git mv`), puis docs d'exploitation et textes visibles ; mettre à jour tous les tests (unitaires, bats, `docs.test.ts`, E2E).
- [ ] **Step 4: Lancer** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:infra` (Git Bash), `pnpm --filter @rune/web test:e2e` (Chromium et WebKit), le build de production du serveur et du web — tout vert.
- [ ] **Step 5: Commit** `refactor: l'appli et son code s'appellent Rune`.

## File F — fondations (séquentielle)

### Task 1: Jetons, thèmes et polices

**Files:**
- Create: `apps/web/src/ui/theme/tokens.css`, `apps/web/src/ui/theme/theme.ts`, `apps/web/src/ui/theme/fonts.ts`, `apps/web/test/ui/theme.test.ts`, `apps/web/test/ui/contrast.test.ts`
- Modify: `apps/web/src/main.tsx` (appliquer le thème avant `createRoot`), `apps/web/src/ui/ui.module.css` (remplacer les anciennes variables `--color-*` par les nouveaux jetons), `apps/web/package.json` (dépendances `@fontsource/chakra-petch`, `@fontsource/barlow`, `@fontsource/newsreader`, versions exactes publiées depuis plus de deux semaines)

**Interfaces:**
- Produces: `type ThemeChoice = 'auto' | 'clair' | 'sombre' | 'carnet' | 'nuit'`; `THEME_CHOICES: readonly ThemeChoice[]`; `readThemeChoice(): ThemeChoice` (localStorage clé `rune.theme`, `try/catch`, défaut `'auto'`); `writeThemeChoice(c: ThemeChoice): void`; `applyTheme(c: ThemeChoice, root?: HTMLElement): void` (pose `data-theme` sauf pour `auto`, met à jour `<meta name="theme-color">`); `useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void]`.
- Jetons CSS (noms imposés, utilisés par toutes les tâches) : `--bg`, `--surface`, `--surface-strong`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-text` (texte sur accent), `--accent-2`, `--danger`, `--success`, `--warning-text`, `--warning-bg`, `--field-bg`, `--field-border`, `--focus`, `--radius-card: 18px`, `--radius-control: 14px`, `--font-display`, `--font-body`, `--font-title` (Newsreader en Carnet, sinon `--font-display`). Valeurs « clair »/« sombre » = tableau Tokens de `GUIDE.md` ; « carnet » = maquette `Carnet.dc.html` ; « nuit » = maquette `Main.dc.html`.
- Structure CSS : `:root` = clair ; `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { …sombre } }` ; `:root[data-theme="clair"]`, `[data-theme="sombre"]`, `[data-theme="carnet"]`, `[data-theme="nuit"]`.

- [ ] **Step 1: Écrire les tests qui échouent** — `theme.test.ts` : `readThemeChoice()` renvoie `'auto'` sans stockage et quand `localStorage.getItem` lève ; `applyTheme('clair')` pose `data-theme="clair"` ; `applyTheme('auto')` retire l'attribut ; `theme-color` vaut `#F1F3F7` pour clair et `#070A12` pour sombre ; `tokens.css` ne redéfinit les jetons sombres sous `prefers-color-scheme: dark` que pour `:root:not([data-theme])` (un thème forcé l'emporte toujours sur le réglage du téléphone). `contrast.test.ts` : lit `tokens.css` (fs), extrait chaque bloc de thème et vérifie `ratio(--text, --bg) >= 4.5`, `ratio(--text-muted, --surface) >= 4.5`, `ratio(--accent-text, --accent) >= 4.5`, `ratio(--accent, --bg) >= 3` pour les 5 thèmes (fonction `contrastRatio(hexA, hexB)` WCAG 2.x dans le test).
- [ ] **Step 2: Lancer** `pnpm --filter @rune/web test theme contrast` — attendu : FAIL (modules absents).
- [ ] **Step 3: Implémenter** `tokens.css`, `theme.ts`, `fonts.ts` (imports des sous-ensembles latins woff2 : Chakra Petch 600/700, Barlow 400/500/600, Newsreader 600), appel `applyTheme(readThemeChoice())` dans `main.tsx` avant le rendu ; brancher `ui.module.css` sur les jetons.
- [ ] **Step 4: Lancer** les deux tests, puis `pnpm --filter @rune/web build` et vérifier dans `dist/` que les woff2 sont émis et figurent dans le manifeste de précache (test existant `precache-plugin.test.ts` vert).
- [ ] **Step 5: Commit** `feat(web): jetons des 5 thèmes, choix d'apparence par appareil et polices embarquées`.

### Task 2: Marque Rune, icônes et logo

**Files:**
- Create: `apps/web/src/ui/Logo.tsx`, `apps/web/scripts/render-icons.mjs`, `apps/web/test/app/brand.test.ts`
- Modify: `apps/web/public/manifest.webmanifest` (`name` `Rune`, `short_name` `Rune`, `theme_color` `#070A12`, `background_color` `#070A12`), `apps/web/public/icons/*.png` (régénérés), `apps/web/index.html` (icônes, `theme-color`), `apps/web/test/pwa/manifest.test.ts`

**Interfaces:**
- Consumes: le renommage de la tâche 0 (textes « Rune » déjà en place).
- Produces: `<RuneMark size?: number; glow?: boolean; title?: string />` (SVG en ligne de `rune-mark-mono.svg`, `currentColor` ; `glow` ajoute le dégradé et la lueur de `rune-mark.svg`) ; `<RuneWordmark />` (texte « RUNE » en `--font-display`, `letter-spacing: .22em`).

- [ ] **Step 1: Test qui échoue** — `brand.test.ts` : (a) le manifeste a `name === 'Rune'`, `short_name === 'Rune'` et les icônes 192, 512 et maskable 512 ; (b) `RuneMark` rend un `svg` avec `role="img"` et le titre donné, sans `id` en double quand deux marques sont affichées.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** : `render-icons.mjs` (Playwright, `docs/brand/rune-icon.svg` → 192, 512, maskable 512 avec 10 % de marge, apple-touch 180, favicon 32) puis le lancer et committer les PNG ; `Logo.tsx`.
- [ ] **Step 4: Lancer** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat(web): logo Rang brisé et icônes de l'appli installée`.

### Task 3: Composants de base

**Files:**
- Create: `apps/web/src/ui/ChoiceCard.tsx`, `Chips.tsx`, `Switch.tsx`, `SegmentedProgress.tsx`, `Badge.tsx`, `ListRow.tsx`, `EmptyState.tsx`, `PageHeader.tsx`, `apps/web/test/ui/components.test.tsx`
- Modify: `apps/web/src/ui/Button.tsx`, `Field.tsx`, `Banner.tsx`, `ChoiceList.tsx` (devient un adaptateur vers `ChoiceCard`), `ui.module.css`, `index.ts`

**Interfaces:**
- Produces:
  - `Button` : `variant?: 'primary' | 'secondary' | 'ghost' | 'danger'`, `block?: boolean` (pleine largeur).
  - `Field` : props existantes + `help?: string`, `error?: string` (rendue sous le champ avec `aria-describedby`, icône).
  - `ChoiceCard` : `{ type: 'radio' | 'checkbox'; name: string; value: string; checked: boolean; onChange(): void; title: string; description?: string; icon?: ReactNode }` — un vrai `<input>` + `<label>`, sélection = bord accent + teinte + coche.
  - `ChoiceGroup` : `{ legend: string; children }` (`<fieldset>`).
  - `Chips` : `{ name; options: { value: string; label: string }[]; value: string | null; onChange(v: string): void; legend: string }` (radios stylées, 44 px).
  - `Switch` : `{ id; label: string; checked; onChange(v: boolean): void; help?: string }` (`role="switch"`).
  - `SegmentedProgress` : `{ step: number; total: number }` rend « Étape {step} sur {total} » et `total` segments.
  - `Badge` : `{ tone: 'accent' | 'success' | 'muted' | 'warning' | 'danger'; children }`.
  - `ListGroup` + `ListRow` : `{ icon?; label; value?; href?; onClick?; badge?: ReactNode; tone?: 'danger' }` (lien ou bouton, chevron, 56 px).
  - `EmptyState` : `{ icon; title; text; action?: ReactNode }`.
  - `PageHeader` : `{ title: string; back?: string | (() => void) }` (bouton « Retour » 44×44 avec `aria-label="Retour"`).
  - `ChoiceList` garde sa signature actuelle (pas de casse pour les écrans existants).

- [ ] **Step 1: Tests qui échouent** — `components.test.tsx` : `ChoiceCard` cochée expose `getByRole('radio', { name: 'Prendre du muscle', checked: true })` ; `Chips` change la valeur au clic et a des cibles `min-height` 44 (classe) ; `Switch` a `role="switch"` et `aria-checked` ; `SegmentedProgress step=3 total=9` affiche « Étape 3 sur 9 » et 9 segments dont 3 `data-done` ; `Field error="12 caractères au moins."` relie l'erreur par `aria-describedby` ; `PageHeader back="/profile"` rend `getByRole('link', { name: 'Retour' })`.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon les maquettes (`GUIDE.md` › Components).
- [ ] **Step 4: Lancer** `pnpm --filter @rune/web test` — tous verts (les écrans existants gardent leurs rôles).
- [ ] **Step 5: Commit** `feat(web): boîte à outils de base (cartes de choix, pastilles, interrupteur, progression, listes, états vides)`.

### Task 4: Feuilles du bas, Système, coach, rangs, art et mouvement

**Files:**
- Create: `apps/web/scripts/svg-to-tsx.mjs`, `apps/web/src/ui/art/` (généré : `CoachOmbre.tsx`, `CoachSkald.tsx`, `CoachScribe.tsx` avec variantes `mode: 'training' | 'nutrition'` et `scheme: 'dark' | 'light'`, `RankStone.tsx`), `apps/web/src/ui/BottomSheet.tsx`, `SystemPanel.tsx`, `CoachBubble.tsx`, `RankBadge.tsx`, `motion.css`, `use-reduced-motion.ts`, `CountUp.tsx`, `apps/web/test/ui/sheet-motion.test.tsx`
- Modify: `apps/web/src/ui/Dialog.tsx` (rend une `BottomSheet` sur téléphone, garde son API), `apps/web/src/ui/index.ts`

**Interfaces:**
- Consumes: jetons (Task 1), `Button` (Task 3), `inert-outside.ts` existant.
- Produces:
  - `type CoachId = 'ombre' | 'skald' | 'scribe'` (importé de `@rune/contracts`, Task 6 ; en attendant la fusion, cette tâche déclare le type localement dans `ui/art/coach-id.ts` et Task 6 le remplace par l'import).
  - `<CoachAvatar coach: CoachId; mode?: 'training' | 'nutrition'; size: number; animated?: boolean />` (choisit `scheme` selon le thème effectif ; ids préfixés par `useId()`).
  - `<CoachBubble coach: CoachId; label: 'Aujourd\'hui' | 'Aperçu' | 'Message d\'accueil'; mode?; children />` (avatar 40 px + bulle ; aucune animation de frappe).
  - `<SystemPanel title: string; children; tone?: 'default' | 'success' />` (étiquette « [ SYSTÈME ] », coin HUD en sombre et en Salle de nuit, barre dégradée en clair).
  - `<RankBadge rank: 'E'|'D'|'C'|'B'|'A'|'S'; size: number; mini?: boolean; locked?: boolean />` (pierres runiques, `role="img"`, `aria-label="Rang E"`).
  - `<BottomSheet open: boolean; onClose(): void; title: string; children />` (poignée, fond assombri, focus piégé, Échap, retour du focus, fond `inert`).
  - `useReducedMotion(): boolean` ; `<CountUp to: number; duration?: number />` (affiche directement `to` si mouvement réduit).
  - `motion.css` : variables `--ease`, `--dur-fast: 200ms`, `--dur-screen: 380ms`, `--dur-celebrate: 900ms` ; classes `.enter-up`, `.stagger > *` (délai par index), `.pop` ; toutes neutralisées sous `prefers-reduced-motion`.
- Sources, copiées d'abord dans le dépôt (`docs/brand/coachs/{ombre,skald,scribe}/` et `docs/brand/rangs/`, que `svg-to-tsx.mjs` lit ; aucun chemin hors dépôt dans un script) depuis `C:\Users\eliott.colin\appsport-local\brand\skald\{systeme,personnage,embleme}\*.svg` (Ombre = systeme, Skald = personnage, Scribe = embleme), `C:\Users\eliott.colin\appsport-local\brand\rangs\pierre\rank-*.svg` et `mini/`. `svg-to-tsx.mjs` : attributs en camelCase, `id` et `url(#…)` préfixés par une prop `idPrefix`, groupes animables gardés (`*-eyes`, `*-visor`, `*-glyph`, `*-glow`).

- [ ] **Step 1: Tests qui échouent** — `sheet-motion.test.tsx` : `BottomSheet` ouverte → `getByRole('dialog', { name: 'Se déconnecter' })`, Échap appelle `onClose`, le focus revient au bouton déclencheur après fermeture, le reste a `inert` ; `RankBadge rank="E"` → `getByRole('img', { name: 'Rang E' })` ; `CountUp to={3}` sous `matchMedia('(prefers-reduced-motion: reduce)')` affiche « 3 » au premier rendu ; deux `CoachAvatar` sur la même page n'ont aucun `id` en double.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** ; lancer `node apps/web/scripts/svg-to-tsx.mjs` et committer les fichiers générés (en-tête « fichier généré par svg-to-tsx.mjs »).
- [ ] **Step 4: Lancer** `pnpm --filter @rune/web test` — PASS.
- [ ] **Step 5: Commit** `feat(web): feuilles du bas, fenêtre du Système, bulles et avatars des coachs, rangs en pierre et mouvement`.

### Task 5: Coquille, navigation et état de connexion

**Files:**
- Create: `apps/web/src/ui/TabBar.tsx`, `apps/web/src/ui/SideNav.tsx`, `apps/web/src/ui/ConnectionPill.tsx`, `apps/web/test/app/shell.test.tsx`
- Modify: `apps/web/src/ui/AppShell.tsx` (en-tête logo + RUNE + `ConnectionPill` + rond initiale → `/profile` ; `UpdateBanner` sous l'en-tête ; `TabBar` en bas sur téléphone, `SideNav` ≥ 900 px ; transitions d'écran), `apps/web/src/ui/Page.tsx` (utilise `PageHeader`), `apps/web/src/App.tsx` (routes `/progression` → page vide provisoire `ProgressionPage` de Task 9, `/places` = liste des lieux, redirection `/profile/places` → `/places`), `apps/web/src/features/status/ConnectionStatus.tsx`, `apps/web/src/sw/UpdateBanner.tsx` (+ son CSS), `apps/web/test/app/guard.test.tsx` et tests qui ciblaient l'ancien en-tête

**Interfaces:**
- Consumes: Tasks 2 à 4.
- Produces (démarrage) : `<BootSplash />` dans `apps/web/src/ui/BootSplash.tsx` — au premier affichage d'une session, le logo se dessine (≤ 1,2 s) puis s'efface ; ignoré sous mouvement réduit ; ne retarde jamais un écran dont les données sont prêtes (il se superpose et disparaît). Test : sous mouvement réduit, `BootSplash` ne rend rien.
- Produces: `TAB_ITEMS = [{ href: '/', label: 'Accueil' }, { href: '/progression', label: 'Progression' }, { href: '/places', label: 'Salles' }, { href: '/profile', label: 'Profil' }]` ; `<TabBar />` (nav `aria-label="Navigation principale"`, onglet actif `aria-current="page"` selon le préfixe d'URL, pastille qui glisse) ; `ConnectionPill` lit la même source que les écrans qui affichent « Nécessite le réseau » (`useSyncState().connection`) ; plus de compteurs dans l'en-tête (ils passent dans Réglages, Task 10).

- [ ] **Step 1: Tests qui échouent** — `shell.test.tsx` : sur `/places/…` l'onglet « Salles » a `aria-current="page"` ; sur `/profile/health` c'est « Profil » ; l'en-tête n'affiche plus « 0 en attente » ; quand `connection === 'offline'`, la pastille dit « Hors ligne » (jamais « En ligne ») ; l'onglet « Administration » n'existe plus dans la barre (l'admin passe par Profil) ; `/profile/places` redirige vers `/places`.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon `MixSombre.dc.html` / `MixClair.dc.html` (barre flottante en pilule) ; transitions : avant = glisse depuis la droite, retour = depuis la gauche, onglet = fondu (classe posée selon l'historique wouter).
- [ ] **Step 4: Lancer** `pnpm test` puis `pnpm --filter @rune/web test:e2e arrival` — adapter les sélecteurs E2E qui visaient l'ancienne navigation.
- [ ] **Step 5: Commit** `feat(web): coquille Rune, barre d'onglets flottante, navigation latérale et état de connexion unique`.

## File S — serveur (parallèle à la file F)

### Task 6: Coach du profil (contrats, migration, API, dépôt web)

**Files:**
- Create: `packages/contracts/src/coach.ts`, `apps/server/src/db/migrations/0002_coach.ts`, `apps/server/test/profile/coach.test.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/src/api/profile.ts` (`TrainingProfilePatch.coach`, profil renvoyé), `packages/contracts/src/entity-rules.ts` (`training_profile.columns` gagne `'coach'`), `apps/server/src/db/migrations/index.ts`, `apps/server/src/db/schema.ts` (`TrainingProfileTable.coach: string | null`), `apps/server/src/profile/routes.ts` (`EMPTY_PROFILE.coach`, fusion, `completeOnboarding` lève `httpError('validation', { field: 'coach' })` si `coach` est nul), `apps/server/src/auth/me.ts` si le profil y est exposé, le dépôt web du profil d'entraînement (`apps/web/src/repos/…`, exposer `coach` et `setCoach(c: CoachId)`), tests existants de fuite de colonnes et d'export

**Interfaces:**
- Produces: `COACH_IDS = ['ombre', 'skald', 'scribe'] as const` ; `CoachId` ; `CoachIdSchema = z.enum(COACH_IDS)` ; colonne SQL `coach TEXT CHECK (coach IN ('ombre','skald','scribe'))` (migration `0002_coach`, `breaking: false`, `ALTER TABLE training_profile ADD COLUMN …`) ; `PATCH /api/training-profile` accepte `{ coach }` ; `POST /api/onboarding/complete` refuse sans coach ; dépôt web `repos.profile.setCoach(coach: CoachId): Promise<void>` et `useTrainingProfile().coach: CoachId | null`.

- [ ] **Step 1: Tests qui échouent** — `coach.test.ts` : la migration ajoute la colonne et une base `0001` existante migre sans perte ; `PATCH {coach:'skald'}` puis lecture → `'skald'` ; `PATCH {coach:'berserker'}` → 400 `validation` ; `complete` avec tous les autres champs mais sans coach → 400 `{ field: 'coach' }` ; avec coach → 200 ; le pull de synchro renvoie `coach` pour le propriétaire et rien pour un autre utilisateur ; l'export JSON contient `coach`.
- [ ] **Step 2: Lancer** `pnpm --filter @rune/server test profile/coach` — FAIL.
- [ ] **Step 3: Implémenter** (contrats → migration → routes → dépôt web).
- [ ] **Step 4: Lancer** `pnpm test` (serveur et web) — PASS, y compris le test de fuite de la synchro et le test de schéma.
- [ ] **Step 5: Commit** `feat(server): coach choisi dans le profil d'entraînement, exigé pour terminer l'onboarding`.

## File E — écrans (après F ; parallélisables entre eux sauf mention)

### Task 7: Choix du coach, présentation et textes des coachs

**Files:**
- Create: `apps/web/src/features/coach/coach-lines.ts`, `CoachStep.tsx`, `CoachIntro.tsx`, `apps/web/test/coach/coach-step.test.tsx`
- Modify: `apps/web/src/features/onboarding/OnboardingFlow.tsx` (étape « coach » avant « goal », numérotation sur 9, reprise : si `profile.coach == null` → coach puis l'étape enregistrée)

**Interfaces:**
- Consumes: `CoachAvatar`, `CoachBubble`, `ChoiceCard`, `SegmentedProgress` (Tasks 3–4), `setCoach` (Task 6).
- Produces: `COACHES: Record<CoachId, { name: string; temper: string; sample: string; intro: string; nutri: string; ready: string; daily: readonly string[] }>` ; `coachLine(coach: CoachId, moment: 'daily', date: Date, pseudo: string): string` (ligne du jour = `daily[jourParis % daily.length]`, `{pseudo}` remplacé).

Textes (mot pour mot ; `{pseudo}` remplacé par le pseudo) :

| | L'Ombre | Le Skald | Le Scribe |
|---|---|---|---|
| name | L'Ombre | Le Skald | Le Scribe |
| temper | Froid et laconique. Exigeant, jamais humiliant. | Mentor chaleureux. Il raconte, il explique. | Calme et précis. Il aime les plans clairs et les bilans. |
| sample | Quête acceptée. Rang E. Montre-moi ta discipline. | Chaque saga commence par un premier pas, {pseudo}. Je serai là pour la raconter. | Trois séances par semaine : c'est un rythme tenable. Je note tout. |
| intro | Je suis L'Ombre. Je fixe tes quêtes, tu les accomplis. Le dialogue viendra plus tard : d'ici là, avance. | Je suis le Skald. Je raconterai ta saga, séance après séance, et je t'expliquerai chaque étape. Nos vraies conversations viendront plus tard : pour l'instant, je pose les premiers vers. | Je suis le Scribe. Je prépare un plan clair et je note chaque série pour faire le point avec toi. Nos échanges viendront plus tard : pour l'instant, je consigne. |
| nutri | Bois régulièrement. Après l'effort, un vrai repas. La récupération fait partie de la quête. | À table aussi, la saga s'écrit, {pseudo}. Un vrai repas après ta séance t'aidera à récupérer. | Note du jour : bois régulièrement, et prévois un vrai repas après ta séance. |
| ready | Éveil validé. Rang E. Le reste se gagne en séance. | Le prologue est écrit, {pseudo}. La saga commence. | Profil complet, lieu noté. Le plan arrivera ici. |
| daily (3) | Jour 1. Rang E. La discipline se prouve, elle ne se promet pas. / Une quête attend. Ton rang aussi. / Pas d'excuse aujourd'hui. Juste la suite. | Le premier chapitre de ta saga s'ouvre aujourd'hui, {pseudo}. Les grands récits commencent toujours ainsi. / Chaque jour ajoute une ligne à ta saga. / Les héros aussi ont commencé au rang E. | Profil complet, lieu noté, rythme de {jours} séances par semaine. Le plan arrivera ici. / Point du jour : ton profil est à jour. / Je consigne. Les premières séances arriveront bientôt. |

(`{jours}` = `daysPerWeek` du profil.)

- [ ] **Step 1: Tests qui échouent** — `coach-step.test.tsx` : l'étape 1 affiche « Choisis ton coach », « Étape 1 sur 9 » et 3 radios nommées L'Ombre, Le Skald, Le Scribe ; choisir Le Skald puis « Continuer » appelle `setCoach('skald')` et montre la présentation (texte `intro` du Skald, étiquette « Message d'accueil », bouton « C'est parti ») ; « C'est parti » mène à l'objectif (« Étape 2 sur 9 ») ; reprise : profil `coach: null`, `onboardingStep: 'availability'` → coach d'abord, puis disponibilité ; `coachLine('scribe','daily', …)` remplace `{jours}` ; aucune ligne des trois coachs ne contient de chiffre suivi de « kcal », « g », « kg » ou « % ».
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon le prototype (`src.html`, écrans « coach » et « intro ») et `B01-Objectif-*.dc.html` pour la mise en page ; démonstration nutrition : bascule automatique une fois vers `mode="nutrition"` + ligne `nutri`, puis retour ; interrupteur « Entraînement / Nutrition » pour la rejouer.
- [ ] **Step 4: Lancer** les tests web — PASS.
- [ ] **Step 5: Commit** `feat(web): choix du coach dès l'onboarding et présentation animée`.

### Task 8: Onboarding rhabillé et « Éveil terminé »

**Files:**
- Modify: `apps/web/src/features/onboarding/*.tsx` et `onboarding.module.css`, `apps/web/src/ui/HealthWarning.tsx` (style seulement), tous les tests et E2E qui cliquent « Suivant » (`apps/web/test/onboarding/*.tsx`, `apps/web/e2e/support/flows.ts`, `apps/web/e2e/*.spec.ts`) → « Continuer »
- Create: `apps/web/test/onboarding/celebration.test.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4, 7 (`COACHES[c].ready`).
- Produces: bouton d'avancée nommé « Continuer » partout dans l'onboarding ; écran « C'est prêt » = célébration.

- [ ] **Step 1: Tests qui échouent** — `celebration.test.tsx` : l'écran prêt montre `getByRole('heading', { name: 'Éveil terminé.' })`, la carte « Quêtes d'éveil 3/3 » avec « Profil complété », « Lieu principal choisi », « Prêt hors ligne » cochés seulement quand l'état réel l'est (prêt hors ligne non atteint → 2/3 et la case non cochée), `RankBadge` « Rang E », la bulle du coach choisi avec sa ligne `ready` ; sous mouvement réduit, « Commencer » est présent dès le premier rendu.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** chaque étape selon `B0n-*.dc.html` (cartes de choix, pastilles pour jours et durée, sélecteur de salle avec recherche et « Créer une salle ») ; l'écran Santé garde ses textes mot pour mot, sans voix du Système ; renommer « Suivant » → « Continuer » et mettre à jour tests et E2E.
- [ ] **Step 4: Lancer** `pnpm test` et `pnpm --filter @rune/web test:e2e` — PASS (Chromium et WebKit).
- [ ] **Step 5: Commit** `feat(web): onboarding Rune en 9 étapes et célébration « Éveil terminé »`.

### Task 9: Accueil et Progression

**Files:**
- Create: `apps/web/src/features/progression/ProgressionPage.tsx`, `progression.module.css`, `apps/web/test/progression/progression.test.tsx`
- Modify: `apps/web/src/features/home/HomePage.tsx`, `home.module.css`, `apps/web/test/home/*.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–7 ; `coachLine` (Task 7).
- Produces: `MUSCLE_GROUPS_LABELS = ['Pectoraux','Dos','Épaules','Bras','Abdos','Fessiers','Quadriceps','Ischios','Mollets']` (constante d'affichage dans `ProgressionPage.tsx`).

- [ ] **Step 1: Tests qui échouent** — accueil : titre « Bonsoir, {pseudo} » / « Bonjour, {pseudo} » selon l'heure de Paris (bascule à 18 h), bulle du coach étiquetée « Aujourd'hui » avec la ligne du jour, carte « Quêtes d'éveil » aux vrais états, tuile « Lieu principal » avec le nom du lieu principal, tuile « Rythme » avec `daysPerWeek` ; le bandeau « Tu as 18 ans… » et le rappel annuel de mot de passe restent affichés quand ils s'appliquent. Progression : « Rang E », « 0 / 100 XP », compteurs 0 (séances, kg soulevés, semaines d'assiduité), 9 `RankBadge` « Rang E » avec les libellés ci-dessus, fenêtre du Système « Aucune séance gravée. Ta première séance débloque tes rangs. »
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon `MixSombre/MixClair` et `ProgressionSombre/ProgressionClair` (cartes en cascade, compteurs `CountUp`).
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat(web): accueil avec le coach et onglet Progression en avant-goût`.

### Task 10: Espace Profil, réglages, coach, santé, confidentialité, déconnexion

**Files:**
- Create: `apps/web/src/features/profile/ProfileHub.tsx`, `apps/web/src/features/coach/MyCoachPage.tsx`, `apps/web/test/profile/hub.test.tsx`
- Modify: `apps/web/src/App.tsx` (routes `/profile` → hub, `/profile/edit` → `ProfilePage`, `/profile/coach`), `apps/web/src/features/profile/ProfilePage.tsx` (Mon profil : lignes qui ouvrent les formulaires ; mot de passe derrière « Changer le mot de passe » ; mode prudent ici seulement), `apps/web/src/features/status/SettingsPage.tsx` (Apparence 5 choix avec aperçu + Synchronisation : connexion, en attente, refusés, stockage), `apps/web/src/features/privacy/HealthSection.tsx` (retrait de l'accord ici), `PrivacySettingsPage.tsx` (état de l'accord + lien vers Santé ; export ; suppression isolée en bas), `apps/web/src/features/auth/LogoutDialog.tsx` (une seule entrée, choix dans la feuille), tests `apps/web/test/profile/*`, `privacy/*`, `auth/logout-reset.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–7 (`useThemeChoice`, `BottomSheet`, `CoachAvatar`, `COACHES`, `setCoach`).

- [ ] **Step 1: Tests qui échouent** — hub : lignes « Mon profil », « Mon coach », « Mes lieux », « Santé », « Confidentialité et données », « Réglages », « Aide », « Administration » (admin seulement), « Se déconnecter » ; badge sur « Réglages » quand il y a des refus ; Mon coach affiche les deux avatars (entraînement et nutrition) et « Changer de coach » ouvre une feuille avec les 3 choix, confirmer appelle `setCoach` ; Réglages : `getByRole('radio', { name: 'Auto' })` coché par défaut, choisir « Carnet » appelle `writeThemeChoice('carnet')` et pose `data-theme="carnet"` ; Mon profil n'affiche pas les champs de mot de passe avant le clic ; Santé contient « Retirer l'accord santé » et Confidentialité ne le contient plus ; déconnexion : une ligne, la feuille propose « Cet appareil » et « Tous mes appareils », l'avertissement de données non envoyées reste.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon `C01` à `C06`.
- [ ] **Step 4: Lancer** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat(web): espace Profil, Mon coach, apparence, santé, confidentialité et déconnexion`.

### Task 11: Salles et lieux

**Files:**
- Create: `packages/contracts/src/equipment-short-labels.ts`, `apps/web/test/places/draft.test.tsx`
- Modify: `apps/web/src/features/places/*.tsx` et `places.module.css`, `packages/contracts/src/index.ts`, tests `apps/web/test/places/*`

**Interfaces:**
- Produces: `EQUIPMENT_SHORT_LABELS: Record<EquipmentCode, string>` (libellé jusqu'à la parenthèse ; exceptions écrites à la main : « Barre guidée (Smith) » gardé entier) ; `useEquipmentDraft(initial: Set<EquipmentCode>): { selected; toggle(code); changes: { added: EquipmentCode[]; removed: EquipmentCode[] }; reset(); save(): Promise<void> }`.

- [ ] **Step 1: Tests qui échouent** — `draft.test.tsx` : cocher puis décocher le même équipement → 0 changement, aucun appel ; 1 ajout + 1 retrait → barre « 2 changements · 1 ajout, 1 retrait », « Enregistrer » envoie exactement ces deux appels ; quitter la fiche sans enregistrer → aucun appel et l'état serveur est réaffiché au retour ; un échec réseau à l'enregistrement garde le brouillon et affiche l'erreur ; toucher une salle dans « Mes lieux » ouvre directement sa fiche ; l'interrupteur « Lieu principal » est `disabled` et coché sur le lieu principal ; la case « Qui va à cette salle » porte l'interrupteur de visibilité de l'utilisateur.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon `D01` à `D05` (pastilles par catégorie, historique en frise).
- [ ] **Step 4: Lancer** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat(web): salles et lieux Rune, équipement en brouillon et fiche directe`.

### Task 12: Administration

**Files:**
- Modify: `apps/web/src/features/admin/*.tsx` et `admin.module.css`, tests `apps/web/test/admin/*`

- [ ] **Step 1: Tests qui échouent** — Membres : une carte par membre (`getAllByRole('article')`), badges rôle/statut/accord, dernière connexion relative ; le bouton « Actions pour ines.m » ouvre une feuille où « Désactiver » et « Supprimer le compte » sont dans un groupe « Actions sensibles » placé en dernier ; un membre désactivé garde « Réactiver » ; sous-navigation « Membres · Invitations · Salles · Serveur » ; Invitations : le code n'apparaît qu'à la création ; État du serveur : badges par section et « Dernier contrôle de l'hôte ».
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon `E01` à `E05`.
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat(web): administration en cartes, actions sensibles isolées`.

### Task 13: Accès, pages publiques, 404, hors ligne et mise à jour

**Files:**
- Modify: `apps/web/src/features/auth/*.tsx` et `auth.module.css`, `apps/web/src/features/public/*.tsx` et `public.module.css`, `apps/web/src/sw/UpdateBanner.tsx`, tests `apps/web/test/auth/*`, `app/public-pages.test.tsx`

- [ ] **Step 1: Tests qui échouent** — Connexion : logo, « RUNE », « Grave ta progression. », champs Pseudo et Mot de passe, lien « J'ai un code d'invitation » ; Aide : l'encadré d'urgence (15, 112) est avant « Installer Rune », la section Crédits est présente ; 404 : « Page introuvable » et « Zone inconnue. » avec un lien vers l'accueil ; bannière de mise à jour : « Plus tard » absent dans la variante 426 ; erreur de mot de passe rattachée au champ.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** selon `A01` à `A06` et `E06`.
- [ ] **Step 4: Lancer** `pnpm test` et `pnpm --filter @rune/web test:e2e` — PASS.
- [ ] **Step 5: Commit** `feat(web): connexion, invitation, aide, 404 et bannière de mise à jour aux couleurs de Rune`.

## File R — revue finale (parallèle aux files F et E, fichiers disjoints)

### Task 14: Décisions de confidentialité et déploiements ratés

**Files:**
- Modify: `docs/fiche-de-traitement.md`, `apps/web/src/features/public/privacy-content.ts` (phrase de l'enveloppe de secours, spec principale 03 et décision du 2026-10-12), `docs/exploitation/P9-admin-indisponible.md` (supprimer les sauvegardes B2 et locales après un dernier export pour chaque membre), `apps/server/test/infra/docs.test.ts`, `apps/server/src/auth/` (`admin:reset` réactive un admin désactivé) + son test CLI, `infra/host/rune-update` et `infra/host/test/update.bats` (T43-F14 : `pull-failed` et `backup-failed` écrivent aussi `.deploy` dans `status.json` avec `ok: false` et la version en place)

- [ ] **Step 1: Tests qui échouent** — docs.test : P9 contient la suppression des sauvegardes ; la fiche de traitement contient « copie scellée » ; CLI : `admin:reset leo` sur un admin désactivé → statut actif + lien ; bats : un `pull-failed` laisse `.deploy.ok == false`.
- [ ] **Step 2: Lancer** `pnpm --filter @rune/server test infra/docs`, le test CLI, et `pnpm test:infra` (Git Bash) — FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** — PASS ; shellcheck propre.
- [ ] **Step 5: Commit** `fix(ops): enveloppe de secours dite, sauvegardes effacées à l'arrêt, admin réactivé et déploiements ratés visibles`.

### Task 15 (après les tâches 7 à 13): Points reportés, tests instables et journaux de CI

**Files:** selon les points ; d'abord `apps/web/e2e/support/*.ts` (masquage des liens et codes d'invitation dans les journaux et traces, T38-F3) et les tests instables (`apps/web/test/profile/profile-page.test.tsx`, `privacy/withdraw.test.tsx`, `places/places-page.test.tsx`).

- [ ] **Step 1:** Dresser la liste des points mineurs reportés de T30 à T45 (`.superpowers/sdd/2026-10-06-socle/progress.md`, sections « Deferred » et « new minors ») dans `.superpowers/sdd/2026-10-06-socle/deferred-sweep.md`, chacun marqué `corrigé`, `rendu caduc par la refonte` ou `fermé : <raison>`.
- [ ] **Step 2:** Pour chaque point corrigé : test qui échoue, correctif, test vert.
- [ ] **Step 3:** Tests instables : exécuter `pnpm --filter @rune/web test` 5 fois de suite sans échec (`for i in 1 2 3 4 5; do pnpm --filter @rune/web test || break; done`).
- [ ] **Step 4:** E2E : aucune ligne de journal ni trace ne contient `#` suivi d'un code d'invitation (test du harnais).
- [ ] **Step 5: Commit(s)** `fix(...)` par point, puis `chore: bilan des points reportés du socle`.

## Clôture

### Task 16: Vérification complète et captures de relecture

**Files:**
- Create: `apps/web/scripts/screenshots.mjs` (lance un serveur de démo jetable comme `appsport-local/video/record-app.cjs`, parcourt les écrans en clair et en sombre à 390 × 844, enregistre `screenshots/<écran>-<thème>.png` hors dépôt)

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test` — tout vert.
- [ ] **Step 2:** `pnpm test:infra` (Git Bash) et `pnpm --filter @rune/web test:e2e` — tout vert.
- [ ] **Step 3:** `node apps/web/scripts/screenshots.mjs` — une capture par écran et par thème clair/sombre ; les joindre au rapport pour la relecture du propriétaire.
- [ ] **Step 4:** Mesurer le bundle initial (`dist/assets/index-*.js` gzip) avant/après : hausse ≤ 25 % hors polices.
- [ ] **Step 5: Commit** `chore(web): script de captures de relecture`.
