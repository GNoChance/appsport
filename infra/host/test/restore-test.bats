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
