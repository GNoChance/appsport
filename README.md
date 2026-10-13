<p align="center">
  <img src="docs/brand/rune-icon.svg" width="140" alt="Logo de Rune : la rune Raidō dans un badge de rang hexagonal">
</p>

<h1 align="center">Rune</h1>

<p align="center"><em>Grave ta progression.</em></p>

Rune est une application web installable (PWA) de suivi de musculation, auto-hébergée, pour un cercle privé. Elle propose des programmes d'entraînement, un suivi des séances qui marche hors ligne, des fiches d'exercices pour débutants, un coach IA et des conseils nutrition.

> Rune portait un autre nom de code pendant le cadrage. Tout s'appelle désormais Rune : le dépôt, les paquets (`@rune/…`) et les fichiers techniques. Seuls `docs/superpowers/` et `docs/research/` gardent l'ancien nom, par historique : y lire « rune » partout où un identifiant porte l'ancien nom.

> **Statut : brique 1 (socle) en finition.** La spécification est versionnée dans [`docs/superpowers/specs/`](docs/superpowers/specs/2026-10-06-appsport-design.md). Le socle est codé et en revue finale avant d'être fusionné dans `main` : comptes sur invitation, onboarding, PWA hors ligne, synchronisation, administration, déploiement, sauvegardes et procédures. La refonte visuelle aux couleurs de Rune est prévue en fin de socle.

## Ce que fera l'app

- **Profil selon le contexte** : à l'inscription, chacun indique où il s'entraîne : au poids du corps à la maison, en salle (et laquelle), ou en sport loisir.
- **Programmes** adaptés au contexte et au niveau, et **suivi des séances** (séries, répétitions, charges, progression), utilisable hors ligne à la salle.
- **Bibliothèque d'exercices** pour débutants : visuels, consignes, muscles travaillés, matériel nécessaire.
- **Coach IA**, « le Skald », qui conseille sur l'entraînement et la nutrition à partir du profil et de l'historique.
- **Nutrition** : besoins caloriques, macronutriments et conseils.

Public visé : un cercle privé (inscription sur invitation).

## Identité

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/rune-wordmark.svg">
  <img src="docs/brand/rune-wordmark-ink.svg" height="56" alt="RUNE">
</picture>

- **Le nom.** Une rune se grave, comme la progression qu'on note séance après séance.
- **Le logo, « Rang brisé ».** La rune Raidō ᚱ, qui est aussi un R et veut dire « le voyage », est placée dans un badge de rang hexagonal. Sa jambe traverse le cadre et en sort : la progression ne reste pas dans le rang qu'on t'a donné.
- **La palette.** Le noir de nuit `#05070D`, le bleu glace `#5ED8FF`, le violet d'éveil `#8C6BFF` (hauts rangs et récompenses) et le givre `#F2FDFF`. Sur les thèmes clairs, le symbole s'affiche en une seule couleur.
- **Pistes pour la suite** (à spécifier) : des thèmes au choix (carnet, salle de nuit, coach calme), plusieurs tempéraments de coach, une progression façon RPG avec des rangs de E à S par groupe musculaire, et une carte de fin de séance à partager.

Les fichiers du logo sont dans [`docs/brand/`](docs/brand/).

## Feuille de route

| # | Brique | Contenu |
|---|--------|---------|
| 0 | Vision et architecture | Choix techniques, hébergement, modèle de données |
| 1 | Socle | Comptes sur invitation, onboarding, PWA, déploiement |
| 2 | Exercices | Fiches débutant rédigées en français (brouillon IA, relecture humaine), illustrations, recherche par matériel |
| 3 | Programmes et suivi | Modèles de programmes, séance en cours, historique, progression |
| 4 | Coach IA | Conseils personnalisés, ajustement des programmes |
| 5 | Nutrition | Objectifs caloriques et macros, conseils |

Chaque brique suit le même cycle : spécification, plan d'implémentation, puis code.

## Hébergement

Serveur personnel (16 Go de RAM, 3 To de stockage), joignable par Tailscale. Le déploiement (conteneur Docker, HTTPS, sauvegardes restic, supervision) est décrit dans la section Exploitation de la spécification.

## Crédits

Les fiches d'exercices sont rédigées pour Rune. Illustrations prévues : [everkinetic/data](https://github.com/everkinetic/data) et [bryllim/workout-guide](https://github.com/bryllim/workout-guide) (CC BY-SA 4.0). Le détail des attributions sera tenu à jour dans l'app (page Crédits).
