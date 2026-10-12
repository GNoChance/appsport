# Fiche de traitement appsport

Version 1.0 (`PRIVACY_POLICY_VERSION`), 2026-10-12.

Cette fiche tient lieu de registre des traitements, obligatoire dès qu'on traite des données de santé (RGPD, art. 30.5). Elle est la source de la page Confidentialité de l'appli (`apps/web/src/features/public/privacy-content.ts`) : toute modification de fond change les deux, et la version `PRIVACY_POLICY_VERSION` (03 §1, §13.5). L'exemption domestique (art. 2.2.c) est plausible mais pas garantie : on ne s'y fie pas.

## Responsable

Le porteur du projet, personne physique, qui héberge le serveur chez lui, en France, à titre personnel et sans but lucratif. Son prénom figure sur la page Confidentialité (variable `VITE_OWNER_FIRST_NAME`). Contact : directement auprès de lui. Il est le seul administrateur, et le seul détenteur des clés de sauvegarde. Reportés tant que l'appli reste entre proches : AIPD, DPO, CGU, mentions légales.

## Finalités

- Suivi d'entraînement entre proches : comptes sur invitation, profil, lieux et matériel, programmes, séances et progression.
- Adaptation des séances et des repères aux données de santé, seulement avec l'accord santé.
- Coach IA (brique 4), seulement avec l'accord coach.
- Sécurité du service : journal de sécurité, sessions, sauvegardes, supervision.

## Personnes concernées

De 2 à 5 personnes : le porteur et 1 à 4 proches, invités par lui. L'âge minimum est de 16 ans (`MIN_AGE`), vérifié par la date de naissance que saisit l'admin. Un mineur de 16 ou 17 ans consent seul dès 15 ans (loi Informatique et Libertés, art. 45) : aucun circuit d'accord parental.

## Catégories de données

| Cat. | Nom | Contenu | Accès dans l'appli |
|---|---|---|---|
| C0 | Interne | pour tout le cercle : référentiels (fiches d'exercices publiées, illustrations, matériel, modèles de programmes), salles partagées et leur historique, pseudos rendus visibles ; pour l'admin seulement : métadonnées de compte (pseudo, rôle, statut, date de naissance, mineur ou non, création, dernière connexion, état des accords, nombre de sessions actives, coût IA du mois à partir de la brique 4), invitations, liens de réinitialisation, journal de sécurité (date, type, acteur, sujet, IP du tailnet, résultat ; aucune donnée C1 à C3) | le cercle ou l'admin, selon la ligne |
| C1 | Personnel | profil d'entraînement, lieux de type maison, visibilité par lieu, mode prudent manuel, programmes et modifications de programme, séances, séries, records, réglages, rejets de synchro, détail des sessions, historique des accords | le propriétaire seul |
| C2 | Santé | indicateur de prudence issu du questionnaire, limitations et zones sensibles, douleur, motif d'une modification de programme, taille, pesées, sexe utilisé par les formules, profil, cibles et bilans nutritionnels | le propriétaire seul, avec l'accord santé |
| C3 | Sensible | fils et messages du coach, signalements | le propriétaire seul, avec l'accord coach ; un échange signalé devient lisible par l'admin |

C0 ne veut pas dire « non personnel » : C0 regroupe ce que le cercle ou l'admin voit par conception. Exception : les sessions sont C1 mais ne sont pas exportées (R-EXP-2) ; à la suppression du compte, elles sont anonymisées, puis purgées à leur expiration absolue (P-DRT-3).

Aucun e-mail n'est collecté : l'identifiant est un pseudo. Les empreintes de mot de passe et de jetons sont hors catégorie : elles ne sont jamais exportées, synchronisées, journalisées ni renvoyées par l'API. Le porteur voit l'adresse du compte Tailscale de chaque proche, une information gérée par Tailscale. L'admin a la main sur le serveur et peut techniquement lire la base : il s'engage à ne faire aucune requête manuelle sur les données d'une personne sans son accord (P-ADM-3).

## Destinataires

- Dans le cercle : les données C0 seulement (salles partagées, pseudos rendus visibles) ; l'admin voit les métadonnées de compte, jamais les données C1 à C3 d'un autre dans l'appli, sauf un échange signalé (`coach_report`, P-ADM-1).
- Anthropic (coach, brique 4) : avec l'accord coach, les messages et le dossier du coach : tranche d'âge (`age_band`, jamais l'âge exact), niveau, objectif, contexte, matériel, programme, historique récent ; C2 seulement si les accords santé et coach sont actifs (P-COA-1). Jamais : pseudo, date de naissance, identifiant interne, nom ou enseigne de la salle, autres membres, adresse IP.
- Backblaze (B2) : sauvegardes chiffrées côté client avant de quitter le serveur ; Backblaze ne voit que des données chiffrées.
- Tailscale (réseau) : comptes Tailscale des proches et métadonnées de leurs appareils ; le trafic de l'appli reste chiffré de bout en bout.

Aucun autre sous-traitant : ni statistiques, ni traceur, ni service tiers dans l'appli (P-LOG-4) ; la supervision (Healthchecks.io) ne reçoit aucune donnée personnelle.

## Transferts hors UE

- Anthropic, États-Unis : messages et dossier du coach, avec l'accord coach qui l'annonce. Anthropic n'entraîne pas ses modèles sur ces données et les efface sous 30 jours, ou jusqu'à 2 ans si ses filtres de sécurité signalent un échange.
- Backblaze, société américaine : données stockées en région UE (EU Central), chiffrées côté client ; les clés restent chez le porteur. Choix assumé, inscrit ici.
- Tailscale, société américaine : serveur de coordination et relais éventuels, sans accès au contenu du trafic.

## Durées de conservation

| Donnée | Durée |
|---|---|
| C0 de compte, C1 | tant que le compte existe |
| C2 | tant que le compte existe et que l'accord santé est actif ; supprimées au retrait |
| Fils et messages du coach (C3) | 90 jours après le dernier message ; suppression possible à tout moment |
| Signalements (C3) | jusqu'au classement par l'admin, 90 jours au plus |
| Journal d'usage du coach (sans contenu) | 12 mois |
| Côté Anthropic | 30 jours au plus ; 2 ans au plus si l'échange est signalé |
| Sessions | 90 jours sans usage, 365 jours au maximum ; lignes fermées purgées 30 jours après |
| Sessions `account_deleted` | jusqu'à leur expiration absolue |
| Invitations, liens de réinitialisation | 7 jours ou 24 h, usage unique ; purgés 30 jours après |
| Journal de sécurité | 12 mois |
| Journaux techniques | 90 jours au plus |
| Marques de suppression de la synchro | 90 jours ; les salles et lieux supprimés restent, pour l'historique |
| Journal d'idempotence de la synchro (`applied_op` : identifiants d'opération, sans contenu) | 12 mois (R-SYN-23) ; supprimé avec le compte |
| Sauvegardes et instantanés | 30 jours au plus |
| Données locales du téléphone | jusqu'à la déconnexion (file d'envoi vide), au retrait d'un accord pour la catégorie, ou au `410 account_deleted` |

## Mesures de sécurité

- Aucune exposition sur Internet : ni redirection de port ni Funnel ; seule entrée de l'appli : `tailscale serve` (HTTPS) ; administration par Tailscale SSH et, en secours, SSH depuis le réseau local ; pare-feu en refus par défaut, en IPv4 comme en IPv6.
- L'appli n'écoute que sur `127.0.0.1` ; la base n'est jamais joignable par le réseau.
- Partage de la seule machine `appsport` avec le compte Tailscale de chaque proche, limité au port 443 ; l'admin, seul membre du tailnet, a une double authentification.
- Noms publics : le nom de machine `appsport` et le nom du tailnet, aléatoire et sans nom de personne, figurent dans les journaux publics de certificats ; rien de personnel.
- Données chiffrées au repos (volume LUKS déverrouillé à la main) ; sauvegardes chiffrées par restic, une copie hors du domicile, test de restauration chaque mois.
- Authentification obligatoire dans l'appli : mots de passe Argon2id, limitation des échecs, cookie `__Host-session`, contrôle de l'origine des requêtes ; en-têtes HSTS, CSP `default-src 'self'` sans script en ligne et `frame-ancestors 'none'` (P-AUT-9).
- Séparation des données : l'admin n'a aucune route vers les données C1 à C3 d'un autre (réponse `404`), sauf un échange signalé (`coach_report`, P-ADM-1).
- Clé API Anthropic sur le serveur seulement, jamais dans le client ni dans le dépôt ; limite de dépense fixée dans la console.
- Flux sortants du serveur : API Claude, mises à jour, sauvegardes, sonde de supervision ; aucun autre.
- Journaux sans corps de requête, cookie, jeton, code ni valeur C1 à C3.
- Export et suppression du compte en libre-service ; retrait d'un accord avec effacement immédiat ; suppressions réappliquées après toute restauration (03 §8).
- Secrets sur le volume chiffré, rotation selon P5 ; enveloppe de secours scellée chez une personne de confiance.
- Incident : procédure P8, proches concernés prévenus sous 72 h, registre [incidents.md](incidents.md).
