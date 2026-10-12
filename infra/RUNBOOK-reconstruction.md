# Runbook de reconstruction complète (R-OPS-12)

Quand : **avant la première invitation**, puis une fois par an (P7, échéances).

Durée : objectif moins de 2 h, chronométré du début à la fin.

Exercice de reconstruction sur une **autre machine** que le serveur : une machine Linux avec Docker (PC de l'admin sous Linux, machine virtuelle, ou WSL2 avec Docker), dont le disque est chiffré. Avec quoi : uniquement le gestionnaire de mots de passe, GitHub et B2 ; ni le serveur, ni l'enveloppe de secours. Le serveur réel continue de tourner pendant l'exercice.

La copie restaurée contient des données personnelles en clair : elle reste dans un dossier privé et elle est détruite à la fin (étape 14). Les clés B2 ne sont lues que dans un sous-shell `( … )`, jamais exportées dans le terminal, et restic travaille sans cache (`--no-cache`) : rien ne reste dans `~/.cache`. Gabarits : `vX.Y.Z` (version lue dans la sauvegarde), `AAAAMMJJ` (date de l'instantané), `<date ISO>` (instant de l'instantané, UTC).

1. **Démarrer le chronomètre.**

   ```
   date
   ```

   Résultat attendu : l'heure de départ est notée.

   Sinon : noter l'heure de la montre ; la durée totale est le résultat de l'exercice.

2. **Préparer un dossier privé.**

   ```
   mkdir -m 700 ~/appsport-exercice && cd ~/appsport-exercice
   ```

   Résultat attendu : `ls -ld ~/appsport-exercice` affiche `drwx------`.

   Sinon : choisir un autre emplacement sur un disque chiffré ; jamais un dossier partagé ou synchronisé.

3. **Vérifier les outils.**

   ```
   restic version
   docker version --format '{{.Server.Version}}'
   ```

   Résultat attendu : une version de restic (0.16 ou plus) et une version de Docker Engine.

   Sinon : installer `restic` (`sudo apt install restic`) ou Docker ; noter le temps perdu dans les écarts.

4. **Écrire les accès B2 depuis le gestionnaire.** Mêmes valeurs que `b2.env` et `restic.pass` sur le serveur (P1, « Dépôts restic »).

   ```
   install -m 600 /dev/null b2.env && nano b2.env
   install -m 600 /dev/null restic.pass && nano restic.pass
   ```

   Contenu de `b2.env` :

   ```
   RESTIC_OFFSITE_REPOSITORY=s3:https://<endpoint S3 du bucket>/appsport-backups
   AWS_ACCESS_KEY_ID=<keyID de la clé B2>
   AWS_SECRET_ACCESS_KEY=<applicationKey de la clé B2>
   ```

   Résultat attendu : les deux fichiers existent, en mode `600`.

   Sinon : une valeur absente du gestionnaire est un écart grave : le noter, puis la reprendre sur le serveur et l'ajouter au gestionnaire.

5. **Lister les sauvegardes hors site.**

   ```
   ( set -a; . ./b2.env; set +a; restic -r "$RESTIC_OFFSITE_REPOSITORY" --password-file restic.pass --no-cache snapshots )
   ```

   Résultat attendu : des instantanés `daily` (et `pre-deploy`), le dernier de moins de 24 h.

   Sinon : `403` : clé B2 ; `wrong password` : mot de passe restic du gestionnaire ; dernier instantané trop ancien : P8, section de l'alerte `backup`, sur le serveur.

6. **Restaurer la dernière sauvegarde.**

   ```
   ( set -a; . ./b2.env; set +a; restic -r "$RESTIC_OFFSITE_REPOSITORY" --password-file restic.pass --no-cache restore latest --target restaure )
   ls restaure/srv/appsport/data/snapshots restaure/var/lib/tailscale
   ls restaure/srv/appsport/secrets
   cat restaure/srv/appsport/deploy.env
   ```

   Résultat attendu : des `daily-AAAAMMJJ.db`, le fichier `tailscaled.state`, les secrets `app.env`, `b2.env`, `deploy_key`, `deploy_key.pub`, `docker` et `restic.pass`, et `APPSPORT_VERSION=vX.Y.Z`.

   Sinon : un élément manque dans la sauvegarde : écart grave, à corriger dans `appsport-backup` avant toute invitation.

7. **Récupérer l'image de la même version.** Jeton GHCR du gestionnaire (portée `read:packages`), collé quand `docker login` demande le mot de passe.

   ```
   docker login ghcr.io -u <compte GitHub>
   IMAGE=ghcr.io/gnochance/appsport:vX.Y.Z
   docker pull "$IMAGE"
   ```

   Résultat attendu : `Login Succeeded`, puis l'image est téléchargée.

   Sinon : `unauthorized` : jeton expiré (P5) ; `manifest unknown` : vérifier la version de `deploy.env`.

8. **Préparer le volume de l'exercice.** Comme `/srv/appsport/data` : instantanés avec leur date (`cp -p` : l'instant de collecte se lit dessus), sentinelle, propriétaire 1000.

   ```
   mkdir -p data/snapshots data/ops
   cp -p restaure/srv/appsport/data/snapshots/*.db data/snapshots/
   touch data/.appsport-volume
   sudo chown -R 1000:1000 data
   ```

   Résultat attendu : `ls -la data` montre `.appsport-volume`, `snapshots/` et `ops/` à `1000`.

   Sinon : reprendre l'étape 6.

9. **Collecter, restaurer et réappliquer, comme en P4.** Il n'y a pas de base courante : la collecte lit l'instantané le plus récent (`--source`), qui est aussi celui que l'on restaure.

   ```
   date -u -d "@$(( $(stat -c %Y data/snapshots/daily-AAAAMMJJ.db) - 300 ))" +%Y-%m-%dT%H:%M:%SZ
   RUN="docker run --rm --network none --read-only --tmpfs /tmp --user 1000 -v $PWD/data:/data -e APP_ORIGIN=https://appsport.<tailnet>.ts.net $IMAGE"
   $RUN node /app/server.mjs privacy:collect --since <date ISO> --source /data/snapshots/daily-AAAAMMJJ.db --out /data/ops/privacy-exercice.json
   $RUN node /app/server.mjs restore /data/snapshots/daily-AAAAMMJJ.db
   $RUN node /app/server.mjs privacy:reapply /data/ops/privacy-exercice.json
   ```

   Résultat attendu : l'instant `<date ISO>`, 5 minutes avant l'heure de cet instantané dans `restic snapshots` (étape 5, colonne Time, heure locale), jamais l'heure actuelle, à reporter dans `--since` ; puis « 0 événement(s) écrit(s) dans /data/ops/privacy-exercice.json » (la source est l'instantané lui-même), « Restauration terminée. Nouvelle époque : … », puis « Réapplication terminée : 0 compte(s) supprimé(s), 0 accord(s) santé retiré(s). ».

   Sinon : instant à l'heure actuelle : copie sans `-p` à l'étape 8, la refaire et noter l'écart (en P4, un tel instant ferait revenir des suppressions) ; « Instantané corrompu (PRAGMA integrity_check) : base actuelle laissée intacte. » : prendre l'instantané précédent et noter l'écart.

10. **Démarrer l'appli et la vérifier.** Sans réseau : la santé se lit depuis le conteneur. L'appli met quelques secondes à répondre (migrations au démarrage) : la boucle réessaie pendant 2 minutes au plus, comme les scripts hôte.

    ```
    docker run -d --name appsport-exercice --network none --read-only --tmpfs /tmp --user 1000 -v "$PWD/data:/data" -e APP_ORIGIN=https://appsport.<tailnet>.ts.net "$IMAGE"
    for i in $(seq 60); do docker exec appsport-exercice node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.ok?r.text():Promise.reject(r.status)).then(console.log)" 2>/dev/null && break; sleep 2; done
    docker exec appsport-exercice node /app/server.mjs db:stats
    ```

    Résultat attendu : en 2 minutes au plus, une ligne avec `"status":"ok"` et `"version":"vX.Y.Z"` ; `db:stats` donne `"integrity":"ok"`, au moins 1 utilisateur, et une dernière écriture de moins de 24 h avant la sauvegarde.

    Sinon : aucune ligne de santé au bout de 2 minutes : `docker logs appsport-exercice` ; noter l'erreur comme écart.

11. **Vérifier l'identité Tailscale (premier exercice seulement).** La restauration de l'identité est déduite, pas vérifiée (08, Risques). Avant la première invitation, sur une machine Linux de test où Tailscale est installé mais jamais connecté : arrêter d'abord tailscaled sur le serveur (par SSH du réseau local : Tailscale SSH va couper), puis :

    ```
    sudo systemctl stop tailscaled
    sudo mv /var/lib/tailscale /var/lib/tailscale.avant-exercice
    sudo cp -a restaure/var/lib/tailscale /var/lib/tailscale
    sudo systemctl start tailscaled
    tailscale status
    ```

    Résultat attendu : la machine de test apparaît comme `appsport`, avec l'adresse `100.x.y.z` du serveur, sans nouvelle connexion. Passer aussitôt à l'étape 12 : deux machines ne gardent jamais la même identité.

    Sinon : noter l'écart (P4 « Nouvelle machine » prévoit alors une nouvelle machine `appsport` et un nouveau lien de partage pour chaque proche), puis l'étape 12 quand même.

12. **Remettre l'identité Tailscale d'origine (premier exercice seulement).** Sur la machine de test ; sans objet si l'étape 11 n'a pas été faite. Puis, sur le serveur, par SSH du réseau local : `sudo systemctl start tailscaled`.

    ```
    sudo systemctl stop tailscaled
    sudo rm -rf /var/lib/tailscale
    sudo mv /var/lib/tailscale.avant-exercice /var/lib/tailscale
    sudo systemctl start tailscaled
    tailscale status
    ```

    Résultat attendu : sur la machine de test, `tailscale status` ne montre plus `appsport` comme machine locale : elle a retrouvé son propre état (son propre nom, ou « Logged out. » si elle n'avait jamais été connectée) ; dans la console Tailscale, `appsport` est de nouveau en ligne, avec son adresse habituelle.

    Sinon : `/var/lib/tailscale.avant-exercice` introuvable : sur la machine de test, `sudo systemctl stop tailscaled && sudo rm -rf /var/lib/tailscale` (elle repartira comme une machine neuve) ; ne jamais laisser l'identité du serveur sur une autre machine.

13. **Arrêter le chronomètre.**

    ```
    date
    ```

    Résultat attendu : moins de 2 h depuis l'étape 1.

    Sinon : noter les étapes lentes dans les écarts, et simplifier P4 ou ce runbook en conséquence.

14. **Détruire la copie.** Base en clair, secrets et identité Tailscale ne restent pas sur cette machine.

    ```
    docker rm -f appsport-exercice
    docker image rm "$IMAGE"
    docker logout ghcr.io
    cd ~ && sudo rm -rf ~/appsport-exercice
    sudo test -e /var/lib/tailscale.avant-exercice && echo "Identité du serveur encore en place : étape 12."
    ```

    Résultat attendu : `ls ~/appsport-exercice` répond `No such file or directory`, et la dernière commande n'affiche rien.

    Sinon : « Identité du serveur encore en place » : faire l'étape 12 ; pour le reste, supprimer à la main ce qui reste ; ne jamais garder la copie « pour plus tard ».

15. **Noter l'exercice.** Ajouter une ligne au journal ci-dessous, par une PR : date, durée, écarts constatés (rien de personnel, aucun secret).

    ```
    git switch -c exercice/AAAAMMJJ
    ```

    Résultat attendu : la ligne est fusionnée ; P1, recette, critère 7, est rempli.

    Sinon : noter d'abord sur papier, puis reporter dès que possible.

## Journal des exercices

| Date | Durée | Écarts constatés |
|---|---|---|
