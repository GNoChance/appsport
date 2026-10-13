#!/usr/bin/env bats
# rune-check (08 §9) : disques au-delà de 80 %, SMART, reboot-required ; section host de status.json.

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  CHECK="$HOST_DIR/rune-check"
  STATUS_FILE="$RUNE_ROOT/data/ops/status.json"
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
    "df --output=pcent $RUNE_ROOT" \
    "df --output=pcent $BACKUP_ROOT" \
    "smartctl -H /dev/sda" \
    "smartctl -H /dev/sdb" \
    "curl * https://hc.test/host"
  [[ "$(tail -n1 "$CALLS")" == "curl "*" https://hc.test/host" ]]
  jq -e --arg r "$RUNE_ROOT" --arg b "$BACKUP_ROOT" \
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
  disk_at "$RUNE_ROOT" 91
  run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order \
    "curl *--data-raw disque $RUNE_ROOT à 91 % ; redémarrage requis https://hc.test/host/fail"
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

@test "smartctl absent de l'hôte : un seul problème « smartctl absent », pas de « SMART KO » par disque" {
  SMARTCTL="$T/absent/smartctl" run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw smartctl absent de l'hôte https://hc.test/host/fail"
  refute_call "curl *SMART KO*"
  jq -e '.host | .ok == false and .smartOk == false and .detail == "smartctl absent de l'"'"'hôte"
    and (.disks | length) == 3' "$STATUS_FILE"
}

@test "df absent de l'hôte : un seul problème « df absent », pas de « disque illisible »" {
  DF="$T/absent/df" run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw df absent de l'hôte https://hc.test/host/fail"
  refute_call "curl *illisible*"
  jq -e '.host | .ok == false and .smartOk == true and .disks == [] and .detail == "df absent de l'"'"'hôte"' \
    "$STATUS_FILE"
}

@test "SMART_DEVICES par défaut : disques de lsblk sans zram ni mmcblk (non évaluables par smartctl)" {
  cat >"$T/bin/lsblk" <<'LSBLK'
#!/usr/bin/env bash
printf '%s\n' '/dev/sda disk' '/dev/zram0 disk' '/dev/mmcblk0 disk' '/dev/nvme0n1 disk' '/dev/sda1 part' '/dev/sr0 rom'
LSBLK
  chmod +x "$T/bin/lsblk"
  unset SMART_DEVICES
  run "$CHECK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "smartctl -H /dev/sda" "smartctl -H /dev/nvme0n1" "curl * https://hc.test/host"
  [ "$(count_calls "smartctl *")" -eq 2 ]
}

@test "SMART_DEVICES <type>:<périphérique> : smartctl -d <type>, motif sans le type" {
  export SMART_DEVICES="/dev/sda sat:/dev/disk/by-id/usb-WD_Passport-0:0"
  on smartctl '-H -d sat /dev/disk/by-id/usb-WD_Passport-0:0' 0 "echo 'SMART overall-health self-assessment test result: FAILED!'"
  run "$CHECK"
  [ "$status" -eq 1 ]
  assert_calls_in_order "smartctl -H /dev/sda" "smartctl -H -d sat /dev/disk/by-id/usb-WD_Passport-0:0"
  assert_calls_in_order "curl *--data-raw SMART KO sur /dev/disk/by-id/usb-WD_Passport-0:0 https://hc.test/host/fail"
}
