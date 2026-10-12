# Registre des incidents

Registre des incidents de sécurité d'appsport (03 §14). Conduite à tenir, détaillée en P8 « Vol, cambriolage ou fuite » :

1. couper l'accès : révoquer les partages Tailscale ou arrêter le service ;
2. évaluer ce qui a été exposé ;
3. faire tourner tous les secrets (P5), puis refaire l'enveloppe de secours (08 §12, P8) ;
4. prévenir les proches concernés sous 72 h après la découverte : ce qui s'est passé, ce qu'ils doivent faire ;
5. consigner l'incident ici, par une PR : une ligne par incident.

Chaque ligne donne :
- la date ;
- les faits ;
- les données exposées, par catégorie (C0 à C3, secrets), jamais leur contenu ;
- les mesures prises, dont les secrets changés ;
- les personnes prévenues, par nombre ou par rôle (« 3 proches (tous) », « l'admin »), jamais de pseudo.

Elle ne contient jamais de pseudo, de donnée de santé, de mot de passe, de code, de jeton ni d'autre secret : le dépôt est hébergé chez GitHub et son historique garde tout.

Gabarit d'une ligne, à ajouter sous l'en-tête du tableau : `| AAAA-MM-JJ | … | … | … | … |`. À la première ligne consignée, retirer la phrase « Aucun incident enregistré. » qui suit le tableau.

| Date | Faits | Données exposées | Mesures | Personnes prévenues |
|---|---|---|---|---|

Aucun incident enregistré.
