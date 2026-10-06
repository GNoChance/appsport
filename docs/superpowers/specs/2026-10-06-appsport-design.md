# appsport — spécification de design (vision, architecture et socle)

- **Date** : 2026-10-06
- **Statut** : rédigée après validation du design en 4 blocs ; en attente de relecture de la spec écrite.
- **Portée** : vision d'ensemble, décisions transverses, découpage en briques, architecture technique, et détail complet de la brique 1 (socle). Les briques 2 à 5 ont ici leurs principes, règles et modèle ; chacune aura sa spec détaillée et son plan avant implémentation.

## 1. Objectif

Une application web installable (PWA) de suivi de musculation, en français, que le porteur du projet et 1 à 4 proches utilisent **à chaque séance** à la place d'un carnet ou d'une autre appli. Elle propose des programmes adaptés au lieu d'entraînement et au matériel, des fiches d'exercices pour débutants, un coach IA et des repères nutritionnels.

**Critères de succès**
1. Chaque utilisateur saisit ses séances dans l'appli, y compris sans réseau à la salle, sans perte ni doublon.
2. Un débutant trouve pour chaque exercice de son programme une fiche relue, illustrée, en français.
3. La progression (charges, répétitions, allègements) est proposée automatiquement et de façon explicable.
4. Le serveur domestique tourne sans intervention hors mises à jour planifiées, et une restauration complète a été testée.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Utilisateurs | 2 à 5 proches, cercle privé, inscription sur invitation. Le porteur est admin. Âge minimum 16 ans ; des 16-17 ans possibles. |
| Accès réseau | Uniquement via Tailscale : la machine `appsport` est partagée avec le compte Tailscale de chaque proche, limité au port 443. HTTPS par certificat `*.ts.net` (`tailscale serve`). Aucune exposition Internet, pas de nom de domaine. |
| Appareils | iPhone et Android ; PWA installée ; séances saisissables hors ligne. |
| Serveur | Machine dédiée, 2 disques, 16 Go de RAM. Debian 13, Docker Compose, un seul conteneur applicatif. Volume de données LUKS déverrouillé à la main via Tailscale SSH ; pas de redémarrage automatique. |
| Sauvegardes | restic chiffré : second disque local + Backblaze B2 ; 30 jours ; restauration testée chaque mois. |
| Stack | Approche A « monolithe TypeScript » : Node 24 (puis 26 LTS), Hono, SQLite via `node:sqlite`, Kysely, Zod 4, React 19 + Vite, Dexie, service worker maison, `@anthropic-ai/sdk`, Vitest et Playwright, pnpm workspaces, GitHub Actions → GHCR, déploiement manuel par tag. |
| Comptes | Pseudo + mot de passe (Argon2id), pas d'e-mail. Invitation par lien ou code (7 jours, usage unique) contenant la date de naissance saisie par l'admin. Réinitialisation par lien admin (24 h). |
| Onboarding | 8 écrans : objectif, autre sport pratiqué, lieu principal (salle / maison au poids du corps avec petit matériel facultatif), salle ou matériel, niveau, 2 à 4 séances par semaine, santé facultative, récapitulatif. Le contexte « complément d'un autre sport » découle de l'objectif « renforcer mon sport » et du sport choisi. |
| Salles | Entité partagée avec liste de matériel et réglages de charge ; on voit qui y va (chacun peut se masquer, les mineurs le sont par défaut). Pas de partage de séances en v1. |
| Données de santé | Un seul consentement santé, facultatif et révocable (le retirer efface les données de santé). Mode prudent manuel pour tous. |
| Exercices | Fiches 100 % maison (~110-120), brouillons rédigés via l'API Claude, relus par l'admin (brouillon → relue → publiée → retirée). Illustrations Everkinetic et workout-guide (CC BY-SA 4.0) ; les dessins d'origine non documentée sont marqués « à remplacer avant publication ». free-exercise-db écarté (contenu repris de bodybuilding.com). |
| Programmes | 6 modèles maison (salle, maison, complément sport × débutant/intermédiaire) avec allègements, dans le premier lot. Moteur de progression déterministe ; l'utilisateur note chaque exercice (facile / correct / difficile / raté). |
| Coach IA | API Claude, `claude-opus-5-5` par défaut (configurable). Ouvert dès 16 ans avec les garde-fous exigés par Anthropic pour les mineurs. Ne calcule jamais charges ni chiffres nutritionnels ; ses propositions sont validées par le code puis acceptées par l'utilisateur. Plafonds : 3 $/personne/mois et 20 $/mois sur le workspace. |
| Nutrition v1 | Module facultatif : repères calculés par du code versionné, pesées, bilan hebdomadaire borné, fiches conseils. Modes complet / sans chiffres / désactivé ; 16-17 ans toujours sans chiffres. Pas de journal alimentaire. |
| Conventions | Code, tables et colonnes en anglais ; interface et documentation en français. |

## 3. Hors périmètre (v1)

Journal alimentaire et scan de code-barres ; partage de séances, défis, classements ; ouverture au public ; appli native ; photos de progression ; import Strong/Hevy ; passkeys ; onduleur ; vidéos d'exercices ; base géolocalisée des salles.

## 4. Découpage et ordre de construction

| # | Brique | Contenu | Spec détaillée |
|---|---|---|---|
| 1 | Socle | Comptes et invitations, onboarding, salles et lieux, coquille PWA et service worker, synchro générique, admin minimal, déploiement, sauvegardes et procédures | cette spec |
| 2 | Exercices | Taxonomies, fiches, circuit éditorial, illustrations, catalogue hors ligne | à écrire |
| 3 | Programmes et séances | Modèles, moteur de progression, séance en cours, historique, records | à écrire |
| 4 | Coach IA | Conversation, outils, propositions de changement, garde-fous, jeu d'évaluation | à écrire |
| 5 | Nutrition | Activation, repères, pesées, bilan hebdomadaire, fiches conseils | à écrire |

Chaque brique suit le cycle : spec détaillée → plan d'implémentation → code en TDD → revue. L'avancement est suivi sur GitHub (un jalon par brique, une issue par tâche du plan).

## 5. Pourquoi l'approche A

Trois architectures ont été comparées par trois juges indépendants (exploitation, hors-ligne et produit, qualité d'ingénierie) : monolithe TypeScript 31,2/35, PocketBase 24,3/35, PowerSync + PostgreSQL 21,8/35. L'approche A est la seule à la taille du projet (un conteneur, ~700 Mo de RAM, un fichier de base), entièrement testable sur le poste Windows sans Docker, et la plus sûre pour la synchro hors ligne. Détail : [comparaison des approches](../../research/2026-10-06-comparaison-approches.md).

## 6. Sections détaillées

1. [Architecture technique, synchronisation hors ligne, mises à jour et tests](2026-10-06-appsport-design/01-architecture.md)
2. [Comptes, inscription, profil et salles](2026-10-06-appsport-design/02-comptes.md)
3. [Vie privée, sécurité et obligations](2026-10-06-appsport-design/03-vie-privee.md)
4. [Catalogue d'exercices](2026-10-06-appsport-design/04-exercices.md)
5. [Programmes et progression](2026-10-06-appsport-design/05-programmes.md)
6. [Coach IA](2026-10-06-appsport-design/06-coach.md)
7. [Nutrition v1](2026-10-06-appsport-design/07-nutrition.md)
8. [Exploitation du serveur](2026-10-06-appsport-design/08-exploitation.md)
9. [Modèle de données consolidé](2026-10-06-appsport-design/09-modele-de-donnees.md)
10. [Glossaire FR → EN](2026-10-06-appsport-design/10-glossaire.md)

En cas de divergence, l'ordre de priorité est : ce document (§2), puis la section propriétaire du sujet, puis le modèle de données consolidé.

## 7. Risques principaux

| Risque | Parade |
|---|---|
| Briques récentes (`node:sqlite` en version candidate, TypeScript 7) | Adaptateur SQL de ~20 lignes remplaçable par better-sqlite3 ; job CI de repli sous TypeScript 6. |
| Limites des PWA sur iPhone (stockage séparé entre Safari et l'appli installée, pas de vibration) | Inscription faite dans l'appli installée ; tests sur un vrai iPhone à chaque version sensible. |
| Conseils erronés du coach ou des fiches | Fiches relues avant publication ; chiffres calculés par le code ; filtre de sortie ; jeu d'évaluation avec 100 % de réussite sur la sécurité. |
| Panne ou vol du serveur | Données chiffrées ; sauvegardes locales et hors domicile ; restauration testée chaque mois ; renvoi des 60 derniers jours par les téléphones. |
| Admin indisponible | Procédure écrite et enveloppe scellée confiée à une personne de confiance. |
| Illustrations de provenance non documentée | Marquées « à remplacer avant publication » ; bloquant uniquement en cas d'ouverture au public. |

## 8. Recherche

- [Recherche initiale (synthèse)](../../research/2026-10-06-recherche-initiale.md) et [vérification adversariale](../../research/2026-10-06-verification.md) ; [rapports détaillés](../../research/rapports/).
- Les décisions de ce document priment sur les recommandations de la recherche, qui supposaient parfois un nom de domaine, un public ouvert ou la base wger.
