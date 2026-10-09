# shellcheck shell=bash
# Bibliothèque des scripts hôte d'appsport (08 §3, §7 à §10), sourcée par infra/host/appsport-*.
# Chaque variable se surcharge par l'environnement (tests bats : infra/host/test/helpers.bash).
# Les fonctions ne comptent pas sur set -e : elles propagent leurs échecs (appelées dans des if et des ||).

: "${APPSPORT_ROOT:=/srv/appsport}"
: "${APPSPORT_REPO:=/opt/appsport}"
: "${BACKUP_ROOT:=/srv/backup}"
: "${HC_ENV:=/etc/appsport/healthchecks.env}"
: "${DOCKER:=docker}"
: "${CURL:=curl}"
: "${RESTIC:=restic}"
: "${CRYPTSETUP:=cryptsetup}"
: "${SYSTEMCTL:=systemctl}"
: "${MOUNT:=mount}"
: "${MOUNTPOINT:=mountpoint}"
: "${GIT:=git}"
: "${SLEEP:=sleep}"
: "${DF:=df}"
: "${SMARTCTL:=smartctl}"
: "${CHOWN:=chown}"
: "${FLOCK:=flock}"
: "${HEALTH_URL:=http://127.0.0.1:3000/api/health}"
: "${LUKS_DEVICE:=/dev/disk/by-partlabel/appsport-data}"
: "${LUKS_NAME:=appsport}"
: "${HEALTH_TIMEOUT_S:=120}"
: "${HEALTH_POLL_S:=2}"
: "${TAILSCALE_STATE:=/var/lib/tailscale}"
: "${REBOOT_REQUIRED_FILE:=/var/run/reboot-required}"
: "${LOCK_FILE:=/run/appsport.lock}"
: "${SMART_DEVICES:=$(lsblk -dno PATH,TYPE 2>/dev/null | awk '$2 == "disk" { print $1 }' | tr '\n' ' ')}"

# Secrets sur le volume chiffré (R-OPS-4) ; seules les URL Healthchecks sont hors du volume.
export DOCKER_CONFIG="$APPSPORT_ROOT/secrets/docker"
export RESTIC_PASSWORD_FILE="$APPSPORT_ROOT/secrets/restic.pass"
export RESTIC_CACHE_DIR="$APPSPORT_ROOT/cache/restic"
export GIT_SSH_COMMAND="ssh -i $APPSPORT_ROOT/secrets/deploy_key -o IdentitiesOnly=yes"
# compose lit la version dans deploy.env, que l'environnement du shell écraserait : jamais exportée.
unset APPSPORT_VERSION
# Base restaurée sans privacy:reapply réussie (03 §8, 08 §12 P4) : app ne doit pas redémarrer. Fichier root hors de
# data/, écrit avant restore par appsport-update, levé après la réapplication (ou à la main en P4) ; nomme la liste.
REAPPLY_MARKER="$APPSPORT_ROOT/reapply-pending"

# HC_ALIVE_URL, HC_BACKUP_URL, HC_RESTORE_TEST_URL, HC_HOST_URL, APPSPORT_URL.
if [ -r "$HC_ENV" ]; then
  # shellcheck source=/dev/null
  . "$HC_ENV"
fi

log() { printf '%s\n' "$*"; }

die() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# update, backup et restore-test sont exclusifs ; le descripteur 9 reste ouvert jusqu'à la fin du script.
take_lock() {
  exec 9>"$LOCK_FILE" || return 1
  "$FLOCK" -n 9
}

compose() {
  "$DOCKER" compose --project-name appsport -f "$APPSPORT_REPO/infra/compose.yaml" \
    --env-file "$APPSPORT_ROOT/deploy.env" "$@"
}

app_running() {
  local id
  id=$(compose ps --status running --quiet app 2>/dev/null) || return 1
  [ -n "$id" ]
}

# CLI de server.mjs : dans le conteneur en marche, sinon dans un conteneur jetable (service arrêté).
app_cli() {
  if app_running; then
    compose exec -T app node /app/server.mjs "$@"
  else
    app_cli_run "$@"
  fi
}

app_cli_run() {
  compose run --rm --no-deps app node /app/server.mjs "$@"
}

volume_mounted() { "$MOUNTPOINT" -q "$APPSPORT_ROOT"; }

sentinel_present() { [ -f "$APPSPORT_ROOT/data/.appsport-volume" ]; }

# Garde de tout compose up -d (appsport-unlock, appsport-update) : vraie si une réapplication est en attente.
reapply_pending() { [ -e "$REAPPLY_MARKER" ]; }

health_json() { "$CURL" -fsS --max-time "${1:-5}" "$HEALTH_URL"; }

# 200 avec status ok (et la version demandée) : HEALTH_TIMEOUT_S / (2 × HEALTH_POLL_S) essais d'au plus
# HEALTH_POLL_S secondes, séparés d'autant (2 min au plus). Version servie dans HEALTH_VERSION.
# shellcheck disable=SC2034 # HEALTH_VERSION est lue par appsport-unlock
wait_health() {
  local want=${1:-} tries i json
  tries=$((HEALTH_TIMEOUT_S / (2 * HEALTH_POLL_S)))
  if [ "$tries" -lt 1 ]; then tries=1; fi
  HEALTH_VERSION=""
  for ((i = 1; i <= tries; i++)); do
    if json=$(health_json "$HEALTH_POLL_S") && [ "$(jq -r '.status' <<<"$json" 2>/dev/null)" = ok ]; then
      HEALTH_VERSION=$(jq -r '.version // ""' <<<"$json" 2>/dev/null)
      if [ -z "$want" ] || [ "$HEALTH_VERSION" = "$want" ]; then return 0; fi
    fi
    if [ "$i" -lt "$tries" ]; then "$SLEEP" "$HEALTH_POLL_S"; fi
  done
  return 1
}

# hc_ping <alive|backup|restore-test|host> [ok|start|fail] [motif] : URL en dernier ; URL absente → avertissement.
hc_ping() {
  local check=$1 kind=${2:-ok} reason=${3:-} var url
  case $check in
    alive) var=HC_ALIVE_URL ;;
    backup) var=HC_BACKUP_URL ;;
    restore-test) var=HC_RESTORE_TEST_URL ;;
    host) var=HC_HOST_URL ;;
    *) die "hc_ping : contrôle inconnu $check" 2 ;;
  esac
  url=${!var:-}
  if [ -z "$url" ]; then
    log "Avertissement : $var absente de $HC_ENV, ping $check non envoyé."
    return 0
  fi
  case $kind in
    ok) ;;
    start | fail) url="$url/$kind" ;;
    *) die "hc_ping : type inconnu $kind" 2 ;;
  esac
  local -a opts=(-fsS -m 10 --retry 3 -o /dev/null)
  if [ -n "$reason" ]; then opts+=(--data-raw "$reason"); fi
  "$CURL" "${opts[@]}" "$url"
}

# data/ops appartient au conteneur (utilisateur 1000), 0750.
ensure_ops_dir() {
  mkdir -p "$APPSPORT_ROOT/data/ops" &&
    "$CHOWN" 1000:1000 "$APPSPORT_ROOT/data/ops" &&
    chmod 0750 "$APPSPORT_ROOT/data/ops"
}

# status_merge <section> <json> : remplace une section de status.json (OpsStatus), écriture atomique.
status_merge() {
  local file="$APPSPORT_ROOT/data/ops/status.json" tmp base
  ensure_ops_dir || return 1
  base=$(jq -c 'if type == "object" then . else {} end' "$file" 2>/dev/null) || base=""
  if [ -z "$base" ]; then base='{}'; fi
  tmp=$(mktemp "$APPSPORT_ROOT/data/ops/.status.XXXXXX") || return 1
  if jq --arg k "$1" --argjson v "$2" '.[$k] = $v' <<<"$base" >"$tmp" &&
    chmod 0640 "$tmp" && "$CHOWN" 1000:1000 "$tmp" && mv -f "$tmp" "$file"; then
    return 0
  fi
  rm -f "$tmp"
  return 1
}

# restic_on <local|offsite> <args…> : B2 lu dans un sous-shell, ses clés ne fuient pas dans le script.
restic_on() {
  local where=$1
  shift
  case $where in
    local) "$RESTIC" -r "$BACKUP_ROOT/restic" "$@" ;;
    offsite)
      (
        set -a
        # shellcheck source=/dev/null
        . "$APPSPORT_ROOT/secrets/b2.env" || exit 1
        set +a
        "$RESTIC" -r "$RESTIC_OFFSITE_REPOSITORY" "$@"
      )
      ;;
    *) die "restic_on : dépôt inconnu $where" 2 ;;
  esac
}

# restic_backup_all <tag> : local puis offsite ; dépôts en échec sur stdout, 1 si au moins un échec.
restic_backup_all() {
  local tag=$1 where failed=0
  for where in local offsite; do
    if ! restic_on "$where" backup --tag "$tag" --exclude "$APPSPORT_ROOT/data/appsport.db*" \
      "$APPSPORT_ROOT/data/snapshots" "$APPSPORT_ROOT/secrets" "$APPSPORT_ROOT/deploy.env" \
      "$APPSPORT_ROOT/deploy.log" "$TAILSCALE_STATE" >&2; then
      echo "$where"
      failed=1
    fi
  done
  return "$failed"
}

# Tag vX.Y.Z : seule forme admise comme ref git et dans les noms d'instantané ou de liste. deploy.env et
# deploy.log reviennent de restic et s'éditent en P4 : relus, jamais une option git ni un chemin hors de data/.
valid_version() { [[ "${1:-}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

current_version() {
  [ -r "$APPSPORT_ROOT/deploy.env" ] || return 1
  sed -n 's/^APPSPORT_VERSION=//p' "$APPSPORT_ROOT/deploy.env" | tail -n1
}

write_deploy_env() {
  local tmp
  tmp=$(mktemp "$APPSPORT_ROOT/.deploy.env.XXXXXX") || return 1
  if printf 'APPSPORT_VERSION=%s\n' "$1" >"$tmp" && chmod 0644 "$tmp" && mv -f "$tmp" "$APPSPORT_ROOT/deploy.env"; then
    return 0
  fi
  rm -f "$tmp"
  return 1
}

# log_deploy <ancienne> <nouvelle> <ok|pull-failed|backup-failed|rolled-back-image|rolled-back-restore|rollback-failed>
log_deploy() { printf '%s %s %s %s\n' "$(now_iso)" "$1" "$2" "$3" >>"$APPSPORT_ROOT/deploy.log"; }
