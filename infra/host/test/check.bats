#!/usr/bin/env bats
# appsport-check (08 §9) : disques au-delà de 80 %, SMART, reboot-required ; section host de status.json.

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  CHECK="$HOST_DIR/appsport-check"
  STATUS_FILE="$APPSPORT_ROOT/data/ops/status.json"
}

# df --output=pcent <montage> : en-tête puis pourcentage.
disk_at() { on df "--output=pcent $1" 0 "printf 'Use%%\n %s%%\n' $2"; }

@test "tout va bien : ping host, section host complète (SAS « SMART Health Status: OK » accepté)" {
  # smartctl rend un masque de bits non nul même quand le disque est sain : seule la sortie compte.
  on smartctl '-H /dev/sda' 4 "echo 'SMART Health Status: OK'"
  run "$CHECK"
  [ "$status" -eq 0 ]
  assert_calls_in_order \
    "df --output=pcent /" \
    "df --output=pcent $APPSPORT_ROOT" \
    "df --output=pcent $BACKUP_ROOT" \
    "smartctl -H /dev/sda" \
    "smartctl -H /dev/sdb" \
    "curl * https://hc.test/host"
  [[ "$(tail -n1 "$CALLS")" == "curl "*" https://hc.test/host" ]]
  jq -e --arg r "$APPSPORT_ROOT" --arg b "$BACKUP_ROOT" \
    '.host | .ok == true and .smartOk == true and .rebootRequired == false and (.at | test("Z$"))
      and .disks == [{mount: "/", usedPct: 42}, {mount: $r, usedPct: 42}, {mount: $b, usedPct: 42}]' "$STATUS_FILE"
  assert_ops_modes
}

@test "disque à 85 % : /fail « disque <montage> à 85 % », host.ok false" {
  disk_at "$BACKUP_ROOT" 85
  run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw disque $BACKUP_ROOT à 85 % https://hc.test/host/fail"
  jq -e --arg b "$BACKUP_ROOT" '.host | .ok == false and .detail == "disque \($b) à 85 %"
    and (.disks | map(select(.mount == $b)) | .[0].usedPct == 85)' "$STATUS_FILE"
}

@test "disque à 80 % pile : pas d'alerte" {
  disk_at / 80
  run "$CHECK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "curl * https://hc.test/host"
  refute_call "curl * https://hc.test/host/fail"
  jq -e '.host | .ok == true and .disks[0].usedPct == 80' "$STATUS_FILE"
}

@test "SMART KO sur /dev/sdb : /fail « SMART », smartOk false" {
  on smartctl '-H /dev/sdb' 0 "echo 'SMART overall-health self-assessment test result: FAILED!'"
  run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw SMART KO sur /dev/sdb https://hc.test/host/fail"
  jq -e '.host | .ok == false and .smartOk == false' "$STATUS_FILE"
}

@test "reboot-required présent : « redémarrage requis », problèmes joints par « ; »" {
  : >"$REBOOT_REQUIRED_FILE"
  disk_at "$APPSPORT_ROOT" 91
  run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "curl *--data-raw disque $APPSPORT_ROOT à 91 % ; redémarrage requis https://hc.test/host/fail"
  jq -e '.host | .ok == false and .rebootRequired == true' "$STATUS_FILE"
}

@test "volume verrouillé : ping quand même, status.json non écrit" {
  rm -f "$STATE/mounted"
  before=$(cat "$STATUS_FILE")
  run "$CHECK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "smartctl -H /dev/sdb" "curl * https://hc.test/host"
  [ "$(cat "$STATUS_FILE")" = "$before" ]
  refute_call "chown *"
}
