## Review Focus

Ce sont cinq entrées ou pannes que la spec implique sans qu'aucun test évident ne les couvre. Chacune nomme la partie qui doit porter le test.

1. **Requêtes simultanées sur l'unique connexion `node:sqlite`.** `DatabaseSync` est synchrone et le dialecte n'a qu'une connexion. Si deux requêtes HTTP arrivent en même temps, les requêtes de la seconde peuvent s'exécuter à l'intérieur du `BEGIN` de la première : soit leurs écritures sont annulées avec le rollback de l'autre, soit elles reçoivent « cannot start a transaction within a transaction ». Tests à écrire :
   - le dialecte (`NodeSqliteDialect`) sérialise l'acquisition de la connexion avec un mutex. Le test lance `Promise.all` de deux transactions dont l'une échoue, et vérifie que l'autre est validée ;
   - deux `POST /api/invitations/accept` simultanés avec le même code donnent exactement un compte (201 puis `invitation_used`), et un échec de validation ne consomme pas l'invitation.
   Parties : **fondations** (Task 3) et **comptes** (Task 11).

2. **Changement d'époque avec un appareil en retard.** Un téléphone revient avec un watermark de l'ancienne époque, une outbox non vide et un `serverRevSeen` plus récent que la sauvegarde restaurée. Pannes possibles :
   - le `410 watermark_expired` vide l'outbox ;
   - le `restore_upsert` écrase une ligne modifiée après la restauration (`rev` > `epoch_base_rev`) ;
   - le client refait un pull complet avant d'avoir renvoyé ses lignes J.
   Il faut un test serveur (R-SYN-27, trois branches) et un test client deux appareils sur les tables de test J. L'ordre attendu est : pause de l'outbox, renvoi des 60 jours, reprise, pull complet. On vérifie que l'outbox est intacte et que les données ne régressent pas.
   Partie : **synchro** (Tasks 22 et 27).

3. **Retrait du consentement santé pendant qu'un autre appareil a des opérations C2 en attente.** Le serveur doit :
   - mettre à NULL les colonnes C2 (`applied_partial` avec `droppedFields`) ;
   - écarter sans écriture une ligne d'une table entièrement C2 ;
   - ne créer aucune ligne `sync_rejection` ;
   - ne laisser aucune valeur C2 ni dans `applied_op`, ni dans les journaux, ni dans la deadletter.
   Le client B doit supprimer sa copie locale. Le test plante une valeur témoin C2 et la cherche dans toutes les tables, dans la sortie du logger et dans Dexie.
   Parties : **synchro** (Task 21, client en Task 26), avec `withdrawHealthConsent` de **profil** (Task 19).

4. **Restauration sur place réellement sûre.** `restore` doit :
   - supprimer `appsport.db-wal` et `appsport.db-shm` avant de mettre le fichier restauré en place, sinon SQLite rejoue un WAL étranger ;
   - vérifier `PRAGMA integrity_check` sur l'instantané ;
   - régénérer `server_epoch` avec `epoch_base_rev = sync_counter`.
   `privacy:reapply` doit s'exécuter avant que le service n'accepte des requêtes. Le rollback vers une image précédente qui accepte le schéma (migrations inconnues non cassantes) ne doit ni restaurer ni changer d'époque. Tests :
   - Vitest : restauration d'un instantané pris avant une suppression de compte et un retrait de consentement. Après `privacy:reapply`, ni le compte ni les données C2 ne réapparaissent, et une requête avec l'ancien cookie reçoit `410 account_deleted` ;
   - bats : `appsport-update --rollback` choisit la branche « image seule » quand `/api/health` répond 200 avec l'image précédente.
   Partie : **exploitation** (Tasks 40 et 43), avec `privacy:reapply` de **synchro** (Task 24).

5. **PWA en conditions réelles (WebKit, origine, mise à jour).** Points à couvrir :
   - le cookie de session et l'en-tête `Origin` fonctionnent en E2E sous WebKit sur `http://localhost` (`dev-session`, sans `Secure`) ;
   - un rechargement à froid hors ligne sert `index.html` depuis `shell-<buildHash>` alors que le SW du build B attend encore ;
   - le bandeau reste masqué si `activeSessionId` est renseigné ou si l'onboarding est en cours, et ne peut plus être fermé après un 426 ;
   - après `SKIP_WAITING`, les anciens caches `shell-*` sont purgés, mais Dexie (outbox, meta) reste intact et sa version est à jour ;
   - l'interrupteur d'urgence désenregistre le SW, vide `shell-*` et `illustrations-*`, mais ne touche jamais IndexedDB.
   Ces cas ne se testent qu'en Playwright, sur Chromium et WebKit, avec deux builds A et B.
   Partie : **pwa** (Tasks 38 et 39).