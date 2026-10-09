#!/usr/bin/env bats
# lib/common.sh : verrou, status.json (conteneur non fiable, écrivains concurrents), dépendances, attente de santé.

HEALTH=http://127.0.0.1:3000/api/health

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  COMMON="$HOST_DIR/lib/common.sh"
  STATUS_FILE="$APPSPORT_ROOT/data/ops/status.json"
}

# status_merge <section> <json> dans un shell qui source common.sh.
run_status_merge() {
  run bash -c 'source "$1" && status_merge "$2" "$3"' _ "$COMMON" "$1" "$2"
}

skip_without_symlinks() {
  if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then
    skip "liens symboliques non fiables sous Windows : vérifié par le job infra"
  fi
}

@test "verrou impossible à ouvrir (sans sudo) : message distinct du verrou occupé, ni flock ni git" {
  export LOCK_FILE="$T/absent/appsport.lock"
  run "$HOST_DIR/appsport-update" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Impossible d'ouvrir $LOCK_FILE : lancez avec sudo."* ]]
  [[ "$output" != *"Une autre opération appsport est en cours"* ]]
  refute_call "flock *"
  refute_call "git *"
}

@test "status_merge : verrou propre (fd 8, pas LOCK_FILE), temporaire hors de data/ops, chmod et chown avant mv" {
  run_status_merge deploy '{"version":"v1.3.0","ok":true}'
  [ "$status" -eq 0 ]
  assert_calls_in_order "flock -w 30 8" "chown 1000:1000 $APPSPORT_ROOT/.ops-tmp/status.*"
  refute_call "flock * 9"
  refute_call "chown * $APPSPORT_ROOT/data/ops/.status.*"
  jq -e '.deploy.version == "v1.3.0" and .backup.ok == true' "$STATUS_FILE"
  [ -z "$(compgen -G "$APPSPORT_ROOT/data/ops/.status.*" || true)" ]
  [ -z "$(compgen -G "$APPSPORT_ROOT/.ops-tmp/status.??????" || true)" ]
}

@test "status_merge : verrou de status.json tenu par un autre écrivain → échec, status.json inchangé" {
  local before
  before=$(cat "$STATUS_FILE")
  on flock '-w 30 8' 1
  run_status_merge deploy '{"ok":true}'
  [ "$status" -ne 0 ]
  [ "$(cat "$STATUS_FILE")" = "$before" ]
  refute_call "chown 1000:1000 $APPSPORT_ROOT/.ops-tmp/status.*"
}

@test "status_merge : data/ops remplacé par un lien symbolique → échec, rien hors du volume n'est touché" {
  skip_without_symlinks
  mkdir -p "$T/host-dir"
  chmod 0755 "$T/host-dir"
  rm -rf "$APPSPORT_ROOT/data/ops"
  ln -s "$T/host-dir" "$APPSPORT_ROOT/data/ops"
  run_status_merge deploy '{"ok":true}'
  [ "$status" -ne 0 ]
  refute_call "chown *"
  [ "$(stat -c %a "$T/host-dir")" = 755 ]
  [ -z "$(ls -A "$T/host-dir")" ]
  run bash -c 'source "$1" && ensure_ops_dir' _ "$COMMON"
  [ "$status" -ne 0 ]
  refute_call "chown *"
}

@test "status_merge : status.json remplacé par un lien symbolique → la cible n'est ni lue ni modifiée" {
  skip_without_symlinks
  printf '{"auths":{"ghcr.io":{"auth":"SECRET"}}}\n' >"$T/host-secret.json"
  rm -f "$STATUS_FILE"
  ln -s "$T/host-secret.json" "$STATUS_FILE"
  run_status_merge deploy '{"ok":true}'
  [ "$status" -eq 0 ]
  [ ! -L "$STATUS_FILE" ]
  [ "$(cat "$T/host-secret.json")" = '{"auths":{"ghcr.io":{"auth":"SECRET"}}}' ]
  run grep -c SECRET "$STATUS_FILE"
  [ "$output" = 0 ]
}

@test "jq absent de l'hôte : appsport-update refuse avant le verrou, aucun git" {
  export JQ="$T/absent/jq"
  run "$HOST_DIR/appsport-update" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Commande jq absente de l'hôte. Rien n'a été changé."* ]]
  refute_call "flock *"
  refute_call "git *"
  refute_call "docker *"
}

@test "jq absent de l'hôte : appsport-unlock refuse avant cryptsetup" {
  export JQ="$T/absent/jq"
  rm -f "$STATE/luks-open" "$STATE/mounted" "$STATE/running"
  run "$HOST_DIR/appsport-unlock"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Commande jq absente de l'hôte. Rien n'a été changé."* ]]
  refute_call "cryptsetup *"
  refute_call "mount *"
}

@test "wait_health : sonde qui échoue tout de suite, chaque essai garde sa tranche de 2 × HEALTH_POLL_S" {
  # Connexion refusée (curl 7) : l'essai ne dure presque rien, seul le sommeil compte.
  export SLEEP=sleep HEALTH_TIMEOUT_S=12 HEALTH_POLL_S=2
  set_health 7
  run bash -c 'source "$1"; s=$SECONDS; wait_health; rc=$?; echo "rc=$rc elapsed=$((SECONDS - s))"' _ "$COMMON"
  [[ "$output" =~ rc=1\ elapsed=([0-9]+) ]]
  local elapsed=${BASH_REMATCH[1]}
  [ "$(count_calls "curl -fsS --max-time 2 $HEALTH")" -eq 3 ]
  # 3 essais : 2 tranches de 4 s avant le dernier (8 s, contre 4 s avec un simple sommeil de HEALTH_POLL_S),
  # jamais plus que HEALTH_TIMEOUT_S.
  [ "$elapsed" -ge 7 ]
  [ "$elapsed" -le 13 ]
}
