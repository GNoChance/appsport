# Plan du socle (brique 1) — BROUILLON, non validé

> **Ne pas exécuter ce plan.** Il n'est ni relu ni validé, et aucun code ne doit être écrit à partir de lui.

Rédigé le 2026-10-06 à partir de la [spec validée](../../specs/2026-10-06-appsport-design.md) : une ossature commune (fichiers `00-*`) puis 7 parties rédigées en parallèle, 45 tâches au total.

## Problèmes connus, à corriger à la reprise

1. **Trop long** : environ 765 000 caractères (2,6 fois la spec), avec de nombreux corps de fonctions. Il faut le condenser : garder fichiers, signatures, tests avec valeurs de la spec, commandes et commits ; retirer le code que la signature et les tests déterminent. Cible : environ 30 000 caractères par partie.
2. **Noms divergents** : les rédacteurs ont ajouté environ 145 noms absents de `00-interfaces-partagees.md`. Il faut d'abord unifier ces interfaces (table de renommages), puis l'appliquer à chaque partie.
3. Ensuite : assembler en un seul fichier `docs/superpowers/plans/2026-10-06-socle.md`, faire la relecture writing-plans (couverture de la spec, cohérence des types, Review Focus, proportion), puis le faire valider avant toute implémentation.

## Contenu

| Fichier | Contenu |
|---|---|
| `00-contraintes-globales.md` | Contraintes transverses (versions, conventions, sécurité, synchro) |
| `00-review-focus.md` | Entrées et pannes à couvrir par des tests |
| `00-arborescence.md` | Fichiers du socle et leur responsabilité |
| `00-interfaces-partagees.md` | Noms et signatures partagés (incomplet, voir problème 2) |
| `01-fondations.md` … `07-exploitation.md` | Tâches 1 à 45 |
