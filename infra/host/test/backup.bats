#!/usr/bin/env bats
# appsport-backup (R-OPS-9, R-OPS-10, R-DEP-7, 08 §7, §9) : instantané daily, restic local puis offsite.

OFFSITE=s3:https://s3.test/appsport-backups

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  BACKUP="$HOST_DIR/appsport-backup"
  STATUS_FILE="$APPSPORT_ROOT/data/ops/status.json"
  PATHS="--exclude $APPSPORT_ROOT/data/appsport.db* $APPSPORT_ROOT/data/snapshots $APPSPORT_ROOT/secrets $APPSPORT_ROOT/deploy.env $APPSPORT_ROOT/deploy.log $TAILSCALE_STATE"
  # Motif glob des mêmes arguments : l'étoile de appsport.db* est littérale (exclusion exacte, -wal et -shm compris).
  PATHS_PAT=${PATHS//\*/\\\*}
}

@test "nominal : début, instantané daily, local sauvegardé puis purgé, offsite de même, succès en dernier" {
  run "$BACKUP"
  [ "$status" -eq 0 ]
  assert_calls_in_order \
    "curl * https://hc.test/backup/start" \
    "docker compose * exec -T app node /app/server.mjs snapshot --tag daily" \
    "restic -r $BACKUP_ROOT/restic backup --tag daily $PATHS_PAT" \
    "restic -r $BACKUP_ROOT/restic forget --keep-daily 30 --prune" \
    "restic -r $OFFSITE backup --tag daily $PATHS_PAT" \
    "restic -r $OFFSITE forget --keep-daily 30 --prune" \
    "curl * https://hc.test/backup"
  [[ "$(tail -n1 "$CALLS")" == "curl "*" https://hc.test/backup" ]]
  refute_call "curl * https://hc.test/backup/fail"
  jq -e '.backup | .ok == true and .detail == "local+offsite" and (.at | test("^[0-9-]+T[0-9:]+Z$"))' "$STATUS_FILE"
  assert_ops_modes
  # Arguments exacts : ni l'étoile de l'exclusion perdue (WAL de la base vive sauvegardé), ni chemin en trop.
  grep -Fxq -- "restic -r $BACKUP_ROOT/restic backup --tag daily $PATHS" "$CALLS"
  grep -Fxq -- "restic -r $OFFSITE backup --tag daily $PATHS" "$CALLS"
  # Clés B2 seulement pour offsite (sous-shell de restic_on) ; mot de passe restic du volume chiffré partout.
  [ "$(cat "$STATE/restic-env")" = "$(printf '%s none\n%s none\n%s b2-key-id\n%s b2-key-id' \
    "$BACKUP_ROOT/restic" "$BACKUP_ROOT/restic" "$OFFSITE" "$OFFSITE")" ]
  [ "$(sort -u "$STATE/restic-pass")" = "$APPSPORT_ROOT/secrets/restic.pass" ]
}

@test "volume verrouillé : code 1, motif « volume verrouillé », ni verrou ni restic, status.json intact" {
  rm -f "$STATE/mounted"
  before=$(cat "$STATUS_FILE")
  run "$BACKUP"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "curl * https://hc.test/backup/start" \
    "curl *--data-raw volume verrouillé : lancer appsport-unlock https://hc.test/backup/fail"
  refute_call "flock -n 9"
  refute_call "restic *"
  refute_call "docker *"
  [ "$(cat "$STATUS_FILE")" = "$before" ]
}

@test "verrou occupé : code 1, motif « verrou occupé », ni instantané ni restic" {
  # Un test de restauration en cours tient le verrou : sa copie n'est pas touchée.
  mkdir -p "$APPSPORT_ROOT/tmp/restore-test-20261004T050000Z"
  on flock '-n 9' 1
  run "$BACKUP"
  [ "$status" -eq 1 ]
  assert_calls_in_order "flock -n 9" "curl *--data-raw verrou occupé https://hc.test/backup/fail"
  refute_call "docker *"
  refute_call "restic *"
  [ -d "$APPSPORT_ROOT/tmp/restore-test-20261004T050000Z" ]
  jq -e '.backup | .ok == false and .detail == "verrou occupé"' "$STATUS_FILE"
}

@test "restes d'un test de restauration interrompu (coupure) : conteneur puis copie supprimés, après le verrou" {
  local left="$APPSPORT_ROOT/tmp/restore-test-20260101T050000Z"
  mkdir -p "$left/data"
  echo daily-20251231 >"$left/data/appsport.db"
  # Copie encore là quand le conteneur est supprimé : le conteneur part d'abord.
  on docker 'rm -f appsport-restore-test' 0 'if [ -d "$APPSPORT_ROOT/tmp/restore-test-20260101T050000Z" ]; then echo present; else echo absent; fi >>"$STATE/copy-at-rm"'
  run "$BACKUP"
  [ "$status" -eq 0 ]
  [ ! -e "$left" ]
  [ "$(cat "$STATE/copy-at-rm")" = present ]
  assert_calls_in_order \
    "flock -n 9" \
    "docker rm -f appsport-restore-test" \
    "docker compose * exec -T app node /app/server.mjs snapshot --tag daily" \
    "curl * https://hc.test/backup"
  jq -e '.backup.ok == true' "$STATUS_FILE"
}

@test "instantané KO : code 1, aucun restic, .backup.ok false, /fail" {
  on docker '* exec -T app node /app/server.mjs snapshot --tag daily' 1
  run "$BACKUP"
  [ "$status" -eq 1 ]
  refute_call "restic *"
  assert_calls_in_order "curl *--data-raw instantané daily en échec https://hc.test/backup/fail"
  jq -e '.backup | .ok == false and .detail == "instantané daily en échec"' "$STATUS_FILE"
}

@test "offsite KO : local sauvegardé et purgé, pas de forget offsite, /fail qui nomme offsite" {
  on restic "-r $OFFSITE backup *" 1
  run "$BACKUP"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "restic -r $BACKUP_ROOT/restic backup --tag daily $PATHS_PAT" \
    "restic -r $BACKUP_ROOT/restic forget --keep-daily 30 --prune" \
    "restic -r $OFFSITE backup --tag daily $PATHS_PAT" \
    "curl *--data-raw sauvegarde offsite en échec https://hc.test/backup/fail"
  refute_call "restic -r $OFFSITE forget *"
  refute_call "curl * https://hc.test/backup"
  jq -e '.backup | .ok == false and (.detail | contains("offsite"))' "$STATUS_FILE"
}

@test "local KO : pas de forget local, offsite quand même sauvegardé puis purgé, /fail qui nomme local" {
  on restic "-r $BACKUP_ROOT/restic backup *" 1
  run "$BACKUP"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "restic -r $BACKUP_ROOT/restic backup --tag daily $PATHS_PAT" \
    "restic -r $OFFSITE backup --tag daily $PATHS_PAT" \
    "restic -r $OFFSITE forget --keep-daily 30 --prune" \
    "curl *--data-raw sauvegarde local en échec https://hc.test/backup/fail"
  refute_call "restic -r $BACKUP_ROOT/restic forget *"
  refute_call "curl * https://hc.test/backup"
  jq -e '.backup | .ok == false and .detail == "sauvegarde local en échec"' "$STATUS_FILE"
}

@test "purge locale KO : offsite sauvegardé et purgé, /fail « purge local en échec »" {
  on restic "-r $BACKUP_ROOT/restic forget *" 1
  run "$BACKUP"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "restic -r $BACKUP_ROOT/restic backup --tag daily $PATHS_PAT" \
    "restic -r $BACKUP_ROOT/restic forget --keep-daily 30 --prune" \
    "restic -r $OFFSITE backup --tag daily $PATHS_PAT" \
    "restic -r $OFFSITE forget --keep-daily 30 --prune" \
    "curl *--data-raw purge local en échec https://hc.test/backup/fail"
  jq -e '.backup | .ok == false and .detail == "purge local en échec"' "$STATUS_FILE"
}
