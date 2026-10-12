# shellcheck shell=bash
# Outillage bats des scripts hôte : arborescence temporaire, stubs, règles et assertions sur les appels.
# Aucune commande réelle de l'hôte (cryptsetup, mount, systemctl, docker…) n'est jamais lancée.

# shellcheck disable=SC2034 # lue par les fichiers .bats
HOST_DIR=$(cd "$BATS_TEST_DIRNAME/.." && pwd)
STUBBED_COMMANDS=(docker curl restic cryptsetup systemctl mount mountpoint git df smartctl chown flock)

# Hôte sain en v1.2.0 : volume ouvert et monté, sentinelle, app en marche, sauvegarde de moins de 24 h.
setup_host() {
  export T="$BATS_TEST_TMPDIR"
  export CALLS="$T/calls" STATE="$T/state" STUB_DEFAULTS="$BATS_TEST_DIRNAME/defaults.bash"
  mkdir -p "$T/bin" "$T/rules" "$STATE" "$T/etc" "$T/var/lib/tailscale" "$T/opt/appsport/infra" \
    "$T/srv/backup/restic" "$T/srv/appsport/data/ops" "$T/srv/appsport/data/snapshots" "$T/srv/appsport/secrets"
  local cmd
  for cmd in "${STUBBED_COMMANDS[@]}"; do
    cp "$BATS_TEST_DIRNAME/stub.sh" "$T/bin/$cmd"
    chmod +x "$T/bin/$cmd"
  done
  wrap_windows_jq
  export PATH="$T/bin:$PATH"

  export APPSPORT_ROOT="$T/srv/appsport" APPSPORT_REPO="$T/opt/appsport" BACKUP_ROOT="$T/srv/backup"
  export HC_ENV="$T/etc/healthchecks.env" HEALTH_URL=http://127.0.0.1:3000/api/health
  export DOCKER="$T/bin/docker" CURL="$T/bin/curl" RESTIC="$T/bin/restic" CRYPTSETUP="$T/bin/cryptsetup"
  export SYSTEMCTL="$T/bin/systemctl" MOUNT="$T/bin/mount" MOUNTPOINT="$T/bin/mountpoint" GIT="$T/bin/git"
  export DF="$T/bin/df" SMARTCTL="$T/bin/smartctl" CHOWN="$T/bin/chown" FLOCK="$T/bin/flock"
  export SLEEP=true LOCK_FILE="$T/appsport.lock" SMART_DEVICES="/dev/sda /dev/sdb" HEALTH_TIMEOUT_S=8
  export TAILSCALE_STATE="$T/var/lib/tailscale" REBOOT_REQUIRED_FILE="$T/reboot-required"
  unset APPSPORT_VERSION HEALTH_POLL_S

  cat >"$HC_ENV" <<'EOF'
HC_ALIVE_URL=https://hc.test/alive
HC_BACKUP_URL=https://hc.test/backup
HC_RESTORE_TEST_URL=https://hc.test/restore-test
HC_HOST_URL=https://hc.test/host
APPSPORT_URL=https://appsport.test.ts.net
EOF
  cat >"$APPSPORT_ROOT/secrets/b2.env" <<'EOF'
RESTIC_OFFSITE_REPOSITORY=s3:https://s3.test/appsport-backups
AWS_ACCESS_KEY_ID=b2-key-id
AWS_SECRET_ACCESS_KEY=b2-secret
EOF
  : >"$APPSPORT_ROOT/data/.appsport-volume"
  : >"$APPSPORT_ROOT/data/appsport.db"
  write_deploy_env_for_test v1.2.0
  echo "2026-09-01T20:00:00Z v1.1.0 v1.2.0 ok" >"$APPSPORT_ROOT/deploy.log"
  write_backup_at "$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ)"

  touch "$STATE/luks-open" "$STATE/mounted" "$STATE/running"
  echo v1.2.0 >"$STATE/image"
  set_healthy_versions v1.2.0
}

# jq.exe de Windows écrit des CRLF : -b (sans effet ailleurs) ; sous Linux, le vrai jq est utilisé tel quel.
wrap_windows_jq() {
  [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]] || return 0
  local real
  real=$(command -v jq)
  printf '#!/usr/bin/env bash\nexec "%s" -b "$@"\n' "$real" >"$T/bin/jq"
  chmod +x "$T/bin/jq"
}

# on <commande> <motif glob des arguments> <code> [extrait évalué par le stub]
on() {
  printf '%s\t%s\t%s\n' "$2" "$3" "${4:-}" >>"$T/rules/$1"
}

set_healthy_versions() { echo "$*" >"$STATE/healthy"; }

# Code de sortie imposé au curl de /api/health (0 : simulation normale).
set_health() { echo "$1" >"$STATE/health-code"; }

write_deploy_env_for_test() { echo "APPSPORT_VERSION=$1" >"$APPSPORT_ROOT/deploy.env"; }

write_backup_at() {
  printf '{"backup":{"at":"%s","ok":true}}\n' "$1" >"$APPSPORT_ROOT/data/ops/status.json"
}

reset_calls() { : >"$CALLS"; }

# Les motifs glob apparaissent dans $CALLS dans cet ordre (d'autres appels peuvent s'intercaler).
assert_calls_in_order() {
  local i=0 line
  local -a pats=("$@")
  if [ -f "$CALLS" ]; then
    while IFS= read -r line && [ "$i" -lt "${#pats[@]}" ]; do
      # shellcheck disable=SC2053 # motif glob voulu
      if [[ "$line" == ${pats[$i]} ]]; then i=$((i + 1)); fi
    done <"$CALLS"
  fi
  if [ "$i" -lt "${#pats[@]}" ]; then
    echo "appel attendu absent ou hors ordre : ${pats[$i]}" >&2
    echo "appels :" >&2
    cat "$CALLS" >&2 2>/dev/null || true
    return 1
  fi
}

refute_call() {
  local line
  [ -f "$CALLS" ] || return 0
  while IFS= read -r line; do
    # shellcheck disable=SC2053 # motif glob voulu
    if [[ "$line" == $1 ]]; then
      echo "appel inattendu : $line" >&2
      return 1
    fi
  done <"$CALLS"
}

# refute_call_between <début> <fin> <motif> : aucun appel <motif> entre le premier <début> et le <fin> qui le suit ;
# échoue aussi si <début> ou <fin> manque.
refute_call_between() {
  local line inside=0
  if [ -f "$CALLS" ]; then
    while IFS= read -r line; do
      # shellcheck disable=SC2053 # motifs glob voulus
      if [ "$inside" = 0 ]; then
        if [[ "$line" == $1 ]]; then inside=1; fi
      elif [[ "$line" == $2 ]]; then
        return 0
      elif [[ "$line" == $3 ]]; then
        echo "appel inattendu entre « $1 » et « $2 » : $line" >&2
        return 1
      fi
    done <"$CALLS"
  fi
  echo "« $1 » puis « $2 » attendus dans les appels" >&2
  return 1
}

# data/ops en 0750 et status.json en 0640 (03 §7, Interfaces §8). chmod est sans effet sous Windows (MSYS) :
# vérifié par le job infra sous Linux.
assert_ops_modes() {
  if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then return 0; fi
  [ "$(stat -c %a "$APPSPORT_ROOT/data/ops")" = 750 ] || { echo "data/ops n'est pas en 0750" >&2; return 1; }
  [ "$(stat -c %a "$APPSPORT_ROOT/data/ops/status.json")" = 640 ] || { echo "status.json n'est pas en 0640" >&2; return 1; }
}

count_calls() {
  local line n=0
  if [ -f "$CALLS" ]; then
    while IFS= read -r line; do
      # shellcheck disable=SC2053 # motif glob voulu
      if [[ "$line" == $1 ]]; then n=$((n + 1)); fi
    done <"$CALLS"
  fi
  echo "$n"
}
