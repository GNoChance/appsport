# shellcheck shell=bash
# Bibliothèque des scripts hôte de Rune (08 §3, §7 à §10), sourcée par infra/host/rune-*.
# Chaque variable se surcharge par l'environnement (tests bats : infra/host/test/helpers.bash).
# Les fonctions ne comptent pas sur set -e : elles propagent leurs échecs (appelées dans des if et des ||).

: "${RUNE_ROOT:=/srv/rune}"
: "${RUNE_REPO:=/opt/rune}"
: "${BACKUP_ROOT:=/srv/backup}"
: "${HC_ENV:=/etc/rune/healthchecks.env}"
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
: "${JQ:=jq}"
: "${HEALTH_URL:=http://127.0.0.1:3000/api/health}"
: "${LUKS_DEVICE:=/dev/disk/by-partlabel/rune-data}"
: "${LUKS_NAME:=rune}"
: "${HEALTH_TIMEOUT_S:=120}"
: "${HEALTH_POLL_S:=2}"
: "${TAILSCALE_STATE:=/var/lib/tailscale}"
: "${REBOOT_REQUIRED_FILE:=/var/run/reboot-required}"
: "${LOCK_FILE:=/run/rune.lock}"
# Disques évalués par smartctl (rune-check), séparés par des espaces ; <type>:<chemin> ajoute -d <type> (pont
# USB : sat:/dev/disk/by-id/usb-…). Par défaut, les disques de lsblk sauf zram et mmcblk, que smartctl n'évalue pas.
: "${SMART_DEVICES:=$(lsblk -dno PATH,TYPE 2>/dev/null |
  awk '$2 == "disk" && $1 !~ /^\/dev\/(zram|mmcblk)/ { print $1 }' | tr '\n' ' ')}"

# Secrets sur le volume chiffré (R-OPS-4) ; seules les URL Healthchecks sont hors du volume.
export DOCKER_CONFIG="$RUNE_ROOT/secrets/docker"
export RESTIC_PASSWORD_FILE="$RUNE_ROOT/secrets/restic.pass"
export RESTIC_CACHE_DIR="$RUNE_ROOT/cache/restic"
export GIT_SSH_COMMAND="ssh -i $RUNE_ROOT/secrets/deploy_key -o IdentitiesOnly=yes"
# compose lit la version dans deploy.env, que l'environnement du shell écraserait : jamais exportée.
unset RUNE_VERSION
# Base restaurée sans privacy:reapply réussie (03 §8, 08 §12 P4) : app ne doit pas redémarrer. Fichier root hors de
# data/, écrit avant restore par rune-update, levé après la réapplication (ou à la main en P4) ; nomme la liste.
REAPPLY_MARKER="$RUNE_ROOT/reapply-pending"

# HC_ALIVE_URL, HC_BACKUP_URL, HC_RESTORE_TEST_URL, HC_HOST_URL, RUNE_URL.
if [ -r "$HC_ENV" ]; then
  # shellcheck source=/dev/null
  . "$HC_ENV"
fi

# Terminal disparu (SSH coupé, HUP ignoré par rune-update) : l'écriture échoue sans arrêter le script.
log() { printf '%s\n' "$*" 2>/dev/null || true; }

die() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# require_cmds <commande…> : outils de l'hôte dont dépend un script. Sans jq, une appli saine paraîtrait KO
# (wait_health) et déclencherait un retour arrière inutile : refus avant toute action.
require_cmds() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "Commande ${cmd##*/} absente de l'hôte. Rien n'a été changé."
  done
}

# update, backup et restore-test sont exclusifs ; le descripteur 9 reste ouvert jusqu'à la fin du script.
# 0 verrou pris, 1 occupé, 2 LOCK_FILE impossible à ouvrir (lancé sans sudo, /run plein).
take_lock() {
  exec 9>"$LOCK_FILE" || return 2
  "$FLOCK" -n 9 || return 1
}

compose() {
  "$DOCKER" compose --project-name rune -f "$RUNE_REPO/infra/compose.yaml" \
    --env-file "$RUNE_ROOT/deploy.env" "$@"
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

volume_mounted() { "$MOUNTPOINT" -q "$RUNE_ROOT"; }

sentinel_present() { [ -f "$RUNE_ROOT/data/.rune-volume" ]; }

# Volume chiffré monté et sentinelle présente : status.json peut s'écrire sans toucher le disque en clair.
volume_ready() { volume_mounted && sentinel_present; }

# Garde de tout compose up -d (rune-unlock, rune-update) : vraie si une réapplication est en attente.
reapply_pending() { [ -e "$REAPPLY_MARKER" ]; }

health_json() { "$CURL" -fsS --max-time "${1:-5}" "$HEALTH_URL"; }

# 200 avec status ok (et la version demandée) : HEALTH_TIMEOUT_S / (2 × HEALTH_POLL_S) essais d'au plus
# HEALTH_POLL_S secondes, chacun dans une tranche de 2 × HEALTH_POLL_S complétée par un sommeil (2 min au plus,
# même quand la sonde échoue aussitôt : connexion refusée pendant les migrations). Version dans HEALTH_VERSION.
# shellcheck disable=SC2034 # HEALTH_VERSION est lue par rune-unlock
wait_health() {
  local want=${1:-} tries i json start left
  tries=$((HEALTH_TIMEOUT_S / (2 * HEALTH_POLL_S)))
  if [ "$tries" -lt 1 ]; then tries=1; fi
  HEALTH_VERSION=""
  for ((i = 1; i <= tries; i++)); do
    start=$SECONDS
    if json=$(health_json "$HEALTH_POLL_S") && [ "$("$JQ" -r '.status' <<<"$json" 2>/dev/null)" = ok ]; then
      HEALTH_VERSION=$("$JQ" -r '.version // ""' <<<"$json" 2>/dev/null)
      if [ -z "$want" ] || [ "$HEALTH_VERSION" = "$want" ]; then return 0; fi
    fi
    left=$((2 * HEALTH_POLL_S - (SECONDS - start)))
    if [ "$i" -lt "$tries" ] && [ "$left" -gt 0 ]; then "$SLEEP" "$left"; fi
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

# data/ appartient au conteneur (utilisateur 1000, code non fiable) : root n'y suit jamais un lien symbolique.
# in_ops_dir <commande…> : lance la commande dans data/ops, répertoire épinglé (cd -P puis chemin physique
# vérifié) ; un data/ops remplacé par un lien vers l'hôte est refusé, un renommage reste dans le volume.
in_ops_dir() {
  local d="$RUNE_ROOT/data/ops" root
  root=$(cd -P "$RUNE_ROOT" && pwd -P) || return 1
  if [ ! -d "$d" ] || [ -L "$d" ]; then
    log "$d n'est pas un répertoire (lien symbolique ?) : refusé."
    return 1
  fi
  (cd -P "$d" && [ "$(pwd -P)" = "$root/data/ops" ] && "$@")
}

# data/ops appartient au conteneur (utilisateur 1000), 0750.
ensure_ops_dir() {
  mkdir -p "$RUNE_ROOT/data/ops" &&
    in_ops_dir chmod 0750 . &&
    "$CHOWN" -h 1000:1000 "$RUNE_ROOT/data/ops"
}

# Répertoire de root (0700) sur le même volume que data/ : temporaire et verrou de status.json.
ops_tmp_dir() {
  local d="$RUNE_ROOT/.ops-tmp"
  (umask 077 && mkdir -p "$d") && [ -d "$d" ] && [ ! -L "$d" ] && printf '%s\n' "$d"
}

# Contenu de status.json (objet JSON, vide sinon), lu dans data/ops (in_ops_dir) : le descripteur ouvert doit
# désigner le fichier même du répertoire, jamais la cible d'un lien posé par le conteneur.
read_status_json() {
  if [ ! -f status.json ] || [ -L status.json ]; then return 0; fi
  exec 7<status.json || return 0
  [ "$(stat -L -c %d:%i /dev/fd/7)" = "$(stat -c %d:%i status.json)" ] || return 0
  "$JQ" -c 'if type == "object" then . else {} end' <&7 2>/dev/null
}

# status_merge <section> <json> : remplace une section de status.json (OpsStatus), écriture atomique,
# sérialisée par son propre verrou (rune-check ne prend pas LOCK_FILE).
status_merge() {
  local dir
  ensure_ops_dir || return 1
  dir=$(ops_tmp_dir) || return 1
  status_merge_locked "$1" "$2" "$dir" 8>"$dir/status.lock"
}

status_merge_locked() {
  local tmp base
  "$FLOCK" -w 30 8 || return 1
  base=$(in_ops_dir read_status_json) || base=""
  if [ -z "$base" ]; then base='{}'; fi
  tmp=$(mktemp "$3/status.XXXXXX") || return 1
  # shellcheck disable=SC2016 # variables du filtre jq, pas du shell
  if "$JQ" --arg k "$1" --argjson v "$2" '.[$k] = $v' <<<"$base" >"$tmp" &&
    chmod 0640 "$tmp" && "$CHOWN" 1000:1000 "$tmp" && in_ops_dir mv -f -T "$tmp" status.json; then
    return 0
  fi
  rm -f "$tmp"
  return 1
}

# ops_check_json <true|false> <détail> : section {at, ok, detail} de status.json (backup, restoreTest).
# shellcheck disable=SC2016 # variables du filtre jq, pas du shell
ops_check_json() {
  "$JQ" -cn --arg at "$(now_iso)" --argjson ok "$1" --arg d "$2" '{at: $at, ok: $ok, detail: $d}'
}

# join_problems <motif…> : motifs joints par « ; » (détail de status.json et motif Healthchecks).
join_problems() {
  local out=$1
  shift
  while [ $# -gt 0 ]; do
    out+=" ; $1"
    shift
  done
  printf '%s\n' "$out"
}

# Restes d'un rune-restore-test tué hors de son trap EXIT (coupure, SIGKILL, OOM) : conteneur jetable d'abord
# (il tient la copie ouverte), puis copies en clair de tmp/ (données personnelles, 30 jours au plus : R-OPS-10).
# Appelée sous LOCK_FILE seulement (rune-backup chaque nuit, rune-restore-test) : aucun test en cours.
purge_restore_test_leftovers() {
  "$DOCKER" rm -f rune-restore-test >/dev/null 2>&1 || true
  if [ -L "$RUNE_ROOT/tmp" ]; then
    log "$RUNE_ROOT/tmp est un lien symbolique : refusé."
    return 1
  fi
  rm -rf -- "$RUNE_ROOT/tmp"/restore-test-*
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
        . "$RUNE_ROOT/secrets/b2.env" || exit 1
        set +a
        "$RESTIC" -r "$RESTIC_OFFSITE_REPOSITORY" "$@"
      )
      ;;
    *) die "restic_on : dépôt inconnu $where" 2 ;;
  esac
}

# restic_backup_on <local|offsite> <tag> : instantanés, secrets, deploy.* et identité Tailscale ; base vive exclue.
restic_backup_on() {
  restic_on "$1" backup --tag "$2" --exclude "$RUNE_ROOT/data/rune.db*" \
    "$RUNE_ROOT/data/snapshots" "$RUNE_ROOT/secrets" "$RUNE_ROOT/deploy.env" \
    "$RUNE_ROOT/deploy.log" "$TAILSCALE_STATE" >&2
}

# restic_backup_all <tag> : local puis offsite ; dépôts en échec sur stdout, 1 si au moins un échec.
restic_backup_all() {
  local tag=$1 where failed=0
  for where in local offsite; do
    if ! restic_backup_on "$where" "$tag"; then
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
  [ -r "$RUNE_ROOT/deploy.env" ] || return 1
  sed -n 's/^RUNE_VERSION=//p' "$RUNE_ROOT/deploy.env" | tail -n1
}

write_deploy_env() {
  local tmp
  tmp=$(mktemp "$RUNE_ROOT/.deploy.env.XXXXXX") || return 1
  if printf 'RUNE_VERSION=%s\n' "$1" >"$tmp" && chmod 0644 "$tmp" && mv -f "$tmp" "$RUNE_ROOT/deploy.env"; then
    return 0
  fi
  rm -f "$tmp"
  return 1
}

# log_deploy <ancienne> <nouvelle> <ok|pull-failed|backup-failed|rolled-back-image|rolled-back-restore|rollback-failed>
log_deploy() { printf '%s %s %s %s\n' "$(now_iso)" "$1" "$2" "$3" >>"$RUNE_ROOT/deploy.log"; }
