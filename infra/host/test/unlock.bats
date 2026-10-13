#!/usr/bin/env bats
# rune-unlock (R-OPS-6, R-DEP-6, 08 §3) : toutes les commandes de l'hôte sont des stubs (helpers.bash).

LUKS_DEVICE=/dev/disk/by-partlabel/rune-data
HEALTH=http://127.0.0.1:3000/api/health

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  UNLOCK="$HOST_DIR/rune-unlock"
}

@test "volume verrouillé : ouverture, montage, Docker, compose, santé, OK puis ping alive" {
  rm -f "$STATE/luks-open" "$STATE/mounted" "$STATE/running"
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK : Rune répond (version v1.2.0)."* ]]
  assert_calls_in_order \
    "cryptsetup open $LUKS_DEVICE rune" \
    "mount $RUNE_ROOT" \
    "systemctl start docker" \
    "docker compose * up -d" \
    "curl *$HEALTH" \
    "curl * https://hc.test/alive"
}

@test "volume déjà ouvert et monté : ni cryptsetup open ni mount (idempotent)" {
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK : Rune répond (version v1.2.0)."* ]]
  refute_call "cryptsetup open *"
  refute_call "mount *"
  assert_calls_in_order "systemctl start docker" "docker compose * up -d" "curl * https://hc.test/alive"
}

@test "sentinelle absente : KO, pas de up -d, ping alive/fail avec le motif" {
  rm -f "$RUNE_ROOT/data/.rune-volume"
  # R-OPS-6 étape 5 : KO affiché d'abord, ping ensuite (Healthchecks injoignable : curl peut bloquer 40 s).
  on curl '* https://hc.test/alive/fail' 0 'echo PING-ALIVE-FAIL >&2'
  run "$UNLOCK"
  [ "$status" -eq 1 ]
  [[ "$output" == *"KO : sentinelle absente, ce n'est pas le volume rune."*PING-ALIVE-FAIL* ]]
  refute_call "docker compose * up -d"
  assert_calls_in_order "curl *sentinelle* https://hc.test/alive/fail"
  refute_call "curl * https://hc.test/alive"
}

@test "santé jamais 200 : KO après exactement 3 essais de 2 s, ping alive/fail" {
  export HEALTH_TIMEOUT_S=12 HEALTH_POLL_S=2
  # Pause enregistrée (SLEEP=true ne l'est pas) : sans elle, un port fermé épuise les essais en quelques ms.
  cp "$BATS_TEST_DIRNAME/stub.sh" "$T/bin/sleep"
  chmod +x "$T/bin/sleep"
  export SLEEP="$T/bin/sleep"
  set_health 22
  run "$UNLOCK"
  [ "$status" -eq 1 ]
  [[ "$output" == *"KO : /api/health ne répond pas 200 après 2 min (voir P8)."* ]]
  [ "$(count_calls "curl -fsS --max-time 2 $HEALTH")" -eq 3 ]
  [ "$(count_calls "curl *$HEALTH")" -eq 3 ]
  # Chaque essai complété jusqu'à sa tranche de 4 s (2 × HEALTH_POLL_S moins la durée de la sonde, qui échoue
  # aussitôt : 4 s, ou 3 si une seconde a basculé), aucune pause après le dernier.
  assert_calls_in_order \
    "curl -fsS --max-time 2 $HEALTH" "sleep [34]" \
    "curl -fsS --max-time 2 $HEALTH" "sleep [34]" \
    "curl -fsS --max-time 2 $HEALTH"
  [ "$(count_calls "sleep *")" -eq 2 ]
  assert_calls_in_order "docker compose * up -d" "curl * https://hc.test/alive/fail"
  refute_call "curl * https://hc.test/alive"
}

@test "phrase refusée : code 1, ni mount ni Docker" {
  rm -f "$STATE/luks-open" "$STATE/mounted" "$STATE/running"
  on cryptsetup 'open *' 2
  run "$UNLOCK"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Phrase refusée."* ]]
  refute_call "mount *"
  refute_call "systemctl *"
  refute_call "docker *"
}

@test "sauvegarde de la nuit manquée (absente ou de plus de 24 h) : relancée après OK, jamais sinon" {
  local status_file="$RUNE_ROOT/data/ops/status.json"

  echo '{}' >"$status_file"
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK : Rune répond"* ]]
  assert_calls_in_order "curl * https://hc.test/alive" "systemctl start --no-block rune-backup.service"

  reset_calls
  write_backup_at "$(date -u -d '-25 hours' +%Y-%m-%dT%H:%M:%SZ)"
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "curl * https://hc.test/alive" "systemctl start --no-block rune-backup.service"

  reset_calls
  write_status_at "$(date -u -d '-23 hours' +%Y-%m-%dT%H:%M:%SZ)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  refute_call "systemctl start --no-block *"
}

@test "sauvegarde de la nuit en échec (ok false, at récent) : relancée après OK" {
  printf '{"backup":{"at":"%s","ok":false,"detail":"sauvegarde offsite en échec"}}\n' \
    "$(date -u -d '-30 minutes' +%Y-%m-%dT%H:%M:%SZ)" >"$RUNE_ROOT/data/ops/status.json"
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "curl * https://hc.test/alive" "systemctl start --no-block rune-backup.service"
}

# write_status_at <backup.at> <restoreTest.at|""> : status.json, sans section restoreTest si la date est vide.
write_status_at() {
  jq -cn --arg b "$1" --arg r "$2" \
    '{backup: {at: $b, ok: true}} + (if $r == "" then {} else {restoreTest: {at: $r, ok: true}} end)' \
    >"$RUNE_ROOT/data/ops/status.json"
}

# fake_now <date GNU> : date sans -d répond à cette heure (UTC) ; date -d reste la vraie commande.
fake_now() {
  local real s
  rm -f "$T/bin/date"
  hash -r
  real=$(command -v date)
  s=$("$real" -u -d "$1" +%s)
  cat >"$T/bin/date" <<EOF
#!/usr/bin/env bash
for a in "\$@"; do
  case \$a in -d | -d* | --date | --date=*) exec "$real" "\$@" ;; esac
done
exec "$real" -d "@$s" "\$@"
EOF
  chmod +x "$T/bin/date"
}

@test "test de restauration manqué (absent ou antérieur au dernier 1er dimanche 05:00) : relancé, jamais sinon" {
  # Timer Sun *-*-01..07 05:00:00 : le 4 octobre 2026 est le 1er dimanche, le 6 septembre le précédent (28 jours).
  export TZ=UTC
  fake_now '2026-10-04 06:00:00'

  # Coupure le 1er dimanche : le timer a tourné volume verrouillé, restoreTest date du mois d'avant (28 j).
  write_status_at 2026-10-04T05:00:00Z 2026-09-06T05:40:00Z
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "curl * https://hc.test/alive" "systemctl start --no-block rune-restore-test.service"
  refute_call "systemctl start --no-block rune-backup.service"

  # Test du mois fait après le créneau : rien à relancer.
  reset_calls
  write_status_at 2026-10-04T05:00:00Z 2026-10-04T05:40:00Z
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  refute_call "systemctl start --no-block *"

  # Avant le créneau du jour, le test de septembre suffit.
  reset_calls
  fake_now '2026-10-04 04:00:00'
  write_status_at 2026-10-04T03:40:00Z 2026-09-06T05:40:00Z
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  refute_call "systemctl start --no-block *"

  # Jamais fait (première installation) avec la sauvegarde manquée : sauvegarde d'abord, test ensuite
  # (After=rune-backup.service les ordonne, le verrou exclusif ne les met pas en conflit).
  reset_calls
  echo '{}' >"$RUNE_ROOT/data/ops/status.json"
  run "$UNLOCK"
  [ "$status" -eq 0 ]
  assert_calls_in_order "curl * https://hc.test/alive" "systemctl start --no-block rune-backup.service" \
    "systemctl start --no-block rune-restore-test.service"
}

@test "lancé par un lien symbolique (/usr/local/sbin) : common.sh trouvé, OK" {
  if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then
    skip "liens symboliques non fiables sous Windows : vérifié par le job infra"
  fi
  mkdir -p "$T/sbin"
  ln -s "$UNLOCK" "$T/sbin/rune-unlock"
  run "$T/sbin/rune-unlock"
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK : Rune répond (version v1.2.0)."* ]]
}
