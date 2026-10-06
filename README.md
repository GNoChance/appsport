# appsport

Application web installable (PWA) de suivi de musculation, auto-hébergée : programmes d'entraînement, suivi des séances, fiches d'exercices pour débutants, coach IA et conseils nutrition.

> **Statut : cadrage.** La spécification est en cours de rédaction (elle sera versionnée dans `docs/`). Pas encore de code applicatif.

## Ce que fera l'app

- **Profil selon le contexte** : à l'inscription, chacun indique où il s'entraîne — au poids du corps à la maison, en salle (et laquelle), ou en sport loisir.
- **Programmes** adaptés au contexte et au niveau, et **suivi des séances** (séries, répétitions, charges, progression), utilisable hors ligne à la salle.
- **Bibliothèque d'exercices** pour débutants : visuels, consignes, muscles travaillés, matériel nécessaire.
- **Coach IA** qui conseille sur l'entraînement et la nutrition à partir du profil et de l'historique.
- **Nutrition** : besoins caloriques, macronutriments et conseils.

Public visé : un cercle privé (inscription sur invitation).

## Feuille de route (provisoire)

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

Serveur personnel (16 Go de RAM, 3 To de stockage). Le déploiement (conteneurs, HTTPS, sauvegardes) sera décrit dans la spécification d'architecture.

## Crédits

Les fiches d'exercices sont rédigées pour appsport. Illustrations prévues : [everkinetic/data](https://github.com/everkinetic/data) et [bryllim/workout-guide](https://github.com/bryllim/workout-guide) (CC BY-SA 4.0). Le détail des attributions sera tenu à jour dans l'app (page Crédits).
