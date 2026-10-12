#!/usr/bin/env bats
# appsport-restore-test (R-OPS-11, R-DEP-7, 08 §7) : restauration hors site dans tmp/ du volume chiffré,
# db:stats sur la copie et sur la base réelle, conteneur jetable sans réseau, restic check des deux dépôts.

OFFSITE=s3:https://s3.test/appsport-backups
IMAGE=ghcr.io/gnochance/appsport:v1.2.0
STAMP_RE='restore-test-[0-9]{8}T[0-9]{6}Z'

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  RESTORE_TEST="$HOST_DIR/appsport-restore-test"
  STATUS_FILE="$APPSPORT_ROOT/data/ops/status.json"
}

# tmp/ du volume vidé de toute copie (le dossier lui-même peut rester).
assert_tmp_empty() {
  [ ! -d "$APPSPORT_ROOT/tmp" ] || [ -z "$(ls -A "$APPSPORT_ROOT/tmp")" ] || {
    echo "tmp/ non vide :" >&2
    ls -lA "$APPSPORT_ROOT/tmp" >&2
    return 1
  }
}

@test "nominal : restauration hors site, copie la plus récente, conteneur jetable, check local puis offsite" {
  run "$RESTORE_TEST"
  [ "$status" -eq 0 ]
  assert_calls_in_order \
    "curl * https://hc.test/restore-test/start" \
    "restic -r $OFFSITE restore latest --tag daily --target $APPSPORT_ROOT/tmp/restore-test-* --include $APPSPORT_ROOT/data/snapshots" \
    "chown -R 1000:1000 $APPSPORT_ROOT/tmp/restore-test-*/data" \
    "docker run --rm --network none * node /app/server.mjs db:stats" \
    "docker compose * exec -T app node /app/server.mjs db:stats" \
    "docker run -d --name appsport-restore-test --network none --read-only --tmpfs /tmp --user 1000 *" \
    "docker exec appsport-restore-test node -e *" \
    "docker rm -f appsport-restore-test" \
    "restic -r $BACKUP_ROOT/restic check --read-data-subset=5%" \
    "restic -r $OFFSITE check --read-data-subset=5%" \
    "curl * https://hc.test/restore-test"
  [[ "$(tail -n1 "$CALLS")" == "curl "*" https://hc.test/restore-test" ]]
  # Copie : le daily le plus récent de la sauvegarde, jamais un pre-v ni un plus ancien.
  [ "$(cat "$STATE/db-stats-source")" = daily-20261005 ]
  # Conteneur jetable : même image que la version en place, origine fictive, aucun secret de app.env.
  assert_calls_in_order "docker run -d * -e APP_ORIGIN=https://restore-test.invalid *$IMAGE"
  refute_call "docker run *--env-file*"
  refute_call "docker run *app.env*"
  # Conteneur jetable sur la copie, jamais sur la base réelle : tout -v de docker run vient de la copie horodatée.
  assert_calls_in_order "docker run -d * -v $APPSPORT_ROOT/tmp/restore-test-*/data:/data *"
  refute_call "docker run * -v $APPSPORT_ROOT/data:/data *"
  [ "$(count_calls "docker run *")" -eq 2 ]
  grep '^docker run ' "$CALLS" >"$T/runs"
  while read -r line; do
    [[ "$line" == *" -v "* ]]
    mount=${line#* -v }
    mount=${mount%% *}
    [[ "${mount#"$APPSPORT_ROOT/tmp/"}" =~ ^${STAMP_RE}/data:/data$ ]]
  done <"$T/runs"
  # Sonde : 200 exigé sur /api/health du conteneur (port 3000), échec sinon.
  assert_calls_in_order \
    "docker exec appsport-restore-test node -e fetch('http://127.0.0.1:3000/api/health',*).then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))"
  # Toute cible de restauration sous tmp/ du volume chiffré, au nom horodaté.
  grep -- '--target' "$CALLS" >"$T/targets"
  [ -s "$T/targets" ]
  while read -r line; do
    target=${line#*--target }
    target=${target%% *}
    [[ "$target" == "$APPSPORT_ROOT/tmp/"* ]]
    [[ "${target#"$APPSPORT_ROOT/tmp/"}" =~ ^$STAMP_RE$ ]]
  done <"$T/targets"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == true and .detail == "daily-20261005.db ; écart 18 h" and (.at | test("Z$"))' \
    "$STATUS_FILE"
  assert_ops_modes
}

@test "restes d'un test interrompu (coupure) : conteneur puis copie supprimés avant la restauration" {
  local left="$APPSPORT_ROOT/tmp/restore-test-20260101T050000Z"
  mkdir -p "$left/data"
  echo daily-20251231 >"$left/data/appsport.db"
  on docker 'rm -f appsport-restore-test' 0 'if [ -d "$APPSPORT_ROOT/tmp/restore-test-20260101T050000Z" ]; then echo present; else echo absent; fi >>"$STATE/copy-at-rm"'
  run "$RESTORE_TEST"
  [ "$status" -eq 0 ]
  [ ! -e "$left" ]
  # Premier rm -f (purge) : la copie était encore là, le conteneur part d'abord.
  [ "$(head -n1 "$STATE/copy-at-rm")" = present ]
  assert_calls_in_order \
    "flock -n 9" \
    "docker rm -f appsport-restore-test" \
    "restic -r $OFFSITE restore latest *"
  assert_tmp_empty
}

@test "volume verrouillé : code 1, motif « volume verrouillé », ni verrou ni restic ni docker, rien écrit" {
  rm -f "$STATE/mounted"
  before=$(cat "$STATUS_FILE")
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "curl * https://hc.test/restore-test/start" \
    "curl *--data-raw volume verrouillé : lancer appsport-unlock https://hc.test/restore-test/fail"
  refute_call "flock *"
  refute_call "restic *"
  refute_call "docker *"
  [ "$(cat "$STATUS_FILE")" = "$before" ]
  # Aucune copie sur le point de montage en clair.
  [ ! -e "$APPSPORT_ROOT/tmp" ]
}

@test "verrou occupé : code 1, motif « verrou occupé », ni restic ni docker" {
  on flock '-n 9' 1
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order "flock -n 9" "curl *--data-raw verrou occupé https://hc.test/restore-test/fail"
  refute_call "restic *"
  refute_call "docker *"
  [ ! -e "$APPSPORT_ROOT/tmp" ]
  jq -e '.restoreTest | .ok == false and .detail == "verrou occupé"' "$STATUS_FILE"
}

@test "intégrité KO : motif « intégrité », pas de conteneur, copie nettoyée" {
  echo '{"integrity":"*** in database main ***\nPage 3 is never used","users":0,"syncCounter":0,"lastWriteAt":null}' \
    >"$STATE/db-stats-copy"
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw intégrité KO sur la copie restaurée https://hc.test/restore-test/fail"
  refute_call "docker run -d *"
  refute_call "curl * https://hc.test/restore-test"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and .detail == "intégrité KO sur la copie restaurée"' "$STATUS_FILE"
}

@test "aucun utilisateur dans la copie : motif « utilisateur »" {
  echo '{"integrity":"ok","users":0,"syncCounter":3,"lastWriteAt":"2026-10-05T01:30:00.000Z"}' >"$STATE/db-stats-copy"
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw aucun utilisateur dans la copie restaurée https://hc.test/restore-test/fail"
  refute_call "docker run -d *"
  assert_tmp_empty
}

@test "copie de plus de 48 h en retard sur la base réelle : motif « retard »" {
  # 48 h pile passent ; 48 h et une seconde, non.
  echo '{"integrity":"ok","users":2,"syncCounter":60,"lastWriteAt":"2026-10-07T01:30:00.000Z"}' >"$STATE/db-stats-live"
  run "$RESTORE_TEST"
  [ "$status" -eq 0 ]
  jq -e '.restoreTest | .ok == true and .detail == "daily-20261005.db ; écart 48 h"' "$STATUS_FILE"

  reset_calls
  echo '{"integrity":"ok","users":2,"syncCounter":60,"lastWriteAt":"2026-10-07T01:30:01.000Z"}' >"$STATE/db-stats-live"
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw retard de 48 h sur la base réelle https://hc.test/restore-test/fail"
  refute_call "docker run -d *"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and (.detail | contains("retard"))' "$STATUS_FILE"
}

@test "date de dernière écriture de la copie nulle : code 1, pas de conteneur, motif sans « retard »" {
  # Copie vide ou tronquée : aucun écart calculable, jamais compté comme 0 h.
  echo '{"integrity":"ok","users":2,"syncCounter":40,"lastWriteAt":null}' >"$STATE/db-stats-copy"
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw date de dernière écriture illisible https://hc.test/restore-test/fail"
  refute_call "curl *--data-raw *retard* https://hc.test/restore-test/fail"
  refute_call "docker run -d *"
  refute_call "curl * https://hc.test/restore-test"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and .detail == "date de dernière écriture illisible"' "$STATUS_FILE"
}

@test "conteneur jetable sans 200 : rm -f puis /fail, copie nettoyée" {
  on docker 'exec appsport-restore-test *' 1
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "docker run -d --name appsport-restore-test *" \
    "docker exec appsport-restore-test node -e *" \
    "docker rm -f appsport-restore-test" \
    "curl *--data-raw conteneur jetable : api/health sans 200 https://hc.test/restore-test/fail"
  # Sondé jusqu'au délai de santé (HEALTH_TIMEOUT_S / HEALTH_POLL_S essais), pas une seule fois.
  [ "$(count_calls "docker exec appsport-restore-test *")" -eq 4 ]
  assert_tmp_empty
  jq -e '.restoreTest.ok == false' "$STATUS_FILE"
}

@test "restic check offsite KO : motif « offsite », check local fait" {
  on restic "-r $OFFSITE check *" 1
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "restic -r $BACKUP_ROOT/restic check --read-data-subset=5%" \
    "restic -r $OFFSITE check --read-data-subset=5%" \
    "curl *--data-raw restic check offsite en échec https://hc.test/restore-test/fail"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and .detail == "restic check offsite en échec"' "$STATUS_FILE"
}

@test "TERM pendant le test : conteneur supprimé, copie nettoyée, /fail « interrompu » et restoreTest KO" {
  # Le stub est un enfant direct du script : TERM au script, traité au retour de docker run -d.
  # shellcheck disable=SC2016 # extrait évalué par le stub
  on docker 'run -d --name appsport-restore-test *' 0 'kill -TERM "$PPID"'
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "docker run -d --name appsport-restore-test *" \
    "docker rm -f appsport-restore-test" \
    "curl *--data-raw test de restauration interrompu https://hc.test/restore-test/fail"
  [ "$(count_calls "curl * https://hc.test/restore-test/fail")" -eq 1 ]
  refute_call "curl * https://hc.test/restore-test"
  refute_call "restic * check *"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and .detail == "test de restauration interrompu"' "$STATUS_FILE"
}

@test "SIGTERM pendant la sonde : conteneur supprimé et copie effacée par les traps, aucun succès" {
  # Arrêt du service ou extinction de l'hôte en plein test : le stub envoie TERM au script, qui sort en 1 (pas 143).
  # shellcheck disable=SC2016 # extrait évalué par le stub
  on docker 'exec appsport-restore-test *' 0 'kill -TERM $PPID'
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "docker run -d --name appsport-restore-test *" \
    "docker exec appsport-restore-test node -e *" \
    "docker rm -f appsport-restore-test" \
    "curl *--data-raw test de restauration interrompu https://hc.test/restore-test/fail"
  [ "$(count_calls "curl * https://hc.test/restore-test/fail")" -eq 1 ]
  refute_call "restic * check *"
  refute_call "curl * https://hc.test/restore-test"
  assert_tmp_empty
}

@test "abandon par set -e après le démarrage du conteneur : trap EXIT, conteneur supprimé et copie effacée" {
  on docker 'exec appsport-restore-test *' 1
  export SLEEP=false
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "docker run -d --name appsport-restore-test *" \
    "docker exec appsport-restore-test node -e *" \
    "docker rm -f appsport-restore-test"
  [ "$(count_calls "docker exec appsport-restore-test *")" -eq 1 ]
  refute_call "curl * https://hc.test/restore-test"
  assert_tmp_empty
}

@test "base réelle en intégrité KO : motif « intégrité KO sur la base réelle », pas de conteneur" {
  echo '{"integrity":"*** in database main ***\nPage 7 is never used","users":0,"syncCounter":0,"lastWriteAt":null}' \
    >"$STATE/db-stats-live"
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw intégrité KO sur la base réelle https://hc.test/restore-test/fail"
  refute_call "docker run -d *"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and .detail == "intégrité KO sur la base réelle"' "$STATUS_FILE"
}

@test "base réelle plus ancienne que la sauvegarde : échec au-delà de 5 min, écart 0 h en deçà" {
  # 5 min de tolérance (horloge recalée) : la base réelle ne recule pas sans restauration.
  echo '{"integrity":"ok","users":2,"syncCounter":40,"lastWriteAt":"2026-10-05T01:25:00.000Z"}' >"$STATE/db-stats-live"
  run "$RESTORE_TEST"
  [ "$status" -eq 0 ]
  jq -e '.restoreTest | .ok == true and .detail == "daily-20261005.db ; écart 0 h"' "$STATUS_FILE"

  reset_calls
  echo '{"integrity":"ok","users":2,"syncCounter":40,"lastWriteAt":"2026-10-05T01:24:59.000Z"}' >"$STATE/db-stats-live"
  run "$RESTORE_TEST"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "curl *--data-raw base réelle plus ancienne que la sauvegarde https://hc.test/restore-test/fail"
  refute_call "docker run -d *"
  assert_tmp_empty
  jq -e '.restoreTest | .ok == false and .detail == "base réelle plus ancienne que la sauvegarde"' "$STATUS_FILE"
}
