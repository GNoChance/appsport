# shellcheck shell=bash
# Comportements par défaut des stubs (stub.sh) : un hôte appsport simulé dans $STATE. T44 l'étend.
#   luks-open, mounted, running : volume ouvert, monté, service app en marche ;
#   image : version de l'image en marche (APPSPORT_VERSION du shell, sinon deploy.env, lue par `compose up`) ;
#   healthy : versions saines (« v » ; « v@restored » : saine tant qu'aucune autre version n'a démarré, schéma
#   non migré, puis seulement après `restore`) ; started : versions démarrées par `compose up` ;
#   health-code : code de sortie imposé au curl de santé (set_health) ;
#   sessions : sortie de sessions:active ; pulled, up-env (une ligne par up), restic-env : environnement vu
#   par pull, up, restic.

# Chemin sur l'hôte d'un chemin /data/… du conteneur.
host_data_path() { printf '%s\n' "$APPSPORT_ROOT/data${1#/data}"; }

# Commande CLI de server.mjs dans le conteneur (exec -T ou run --rm --no-deps).
default_server_cli() {
  local cmd=${1:-}
  shift || true
  case $cmd in
    sessions:active)
      if [ -f "$STATE/sessions" ]; then cat "$STATE/sessions"; fi
      ;;
    snapshot)
      # snapshot --tag pre-vX.Y.Z
      mkdir -p "$APPSPORT_ROOT/data/snapshots"
      : >"$APPSPORT_ROOT/data/snapshots/$2.db"
      ;;
    restore)
      [ -f "$(host_data_path "$1")" ] || return 1
      touch "$STATE/restored"
      ;;
    privacy:collect)
      # privacy:collect --since <ISO> --out <fichier>
      local out=""
      while [ $# -gt 0 ]; do
        if [ "$1" = --out ]; then out=$2; fi
        shift
      done
      [ -n "$out" ] || return 1
      printf '{"events":[]}\n' >"$(host_data_path "$out")"
      ;;
    privacy:reapply)
      [ -f "$(host_data_path "$1")" ] || return 1
      ;;
  esac
}

default_docker() {
  [ "${1:-}" = compose ] || return 0
  shift
  while [ $# -gt 0 ]; do
    case $1 in
      --project-name | -f | --env-file) shift 2 ;;
      *) break ;;
    esac
  done
  local sub=${1:-}
  shift || true
  case $sub in
    ps)
      if [ -f "$STATE/running" ]; then echo 0123456789ab; fi
      ;;
    up)
      # Comme compose : une variable du shell l'emporte sur --env-file (une fuite démarre une autre image).
      printf '%s\n' "${APPSPORT_VERSION-unset}" >>"$STATE/up-env"
      printf '%s\n' "${APPSPORT_VERSION:-$(sed -n 's/^APPSPORT_VERSION=//p' "$APPSPORT_ROOT/deploy.env")}" \
        >"$STATE/image"
      cat "$STATE/image" >>"$STATE/started"
      touch "$STATE/running"
      ;;
    stop)
      rm -f "$STATE/running"
      ;;
    pull)
      printf '%s\n' "${APPSPORT_VERSION-unset}" >"$STATE/pulled"
      ;;
    exec | run)
      while [ $# -gt 0 ] && [ "$1" != /app/server.mjs ]; do shift; done
      shift || true
      default_server_cli "$@"
      ;;
  esac
}

# Une autre version que $1 a démarré : son schéma a pu être migré.
other_version_started() { grep -qvx "$1" "$STATE/started" 2>/dev/null; }

# Santé : 200 si app tourne et que son image figure dans $STATE/healthy (v@restored : voir plus haut).
health_ok() {
  [ -f "$STATE/running" ] || return 1
  local image tokens token
  image=$(cat "$STATE/image" 2>/dev/null) || return 1
  tokens=$(cat "$STATE/healthy" 2>/dev/null) || return 1
  for token in $tokens; do
    [ "$token" = "$image" ] && return 0
    if [ "$token" = "$image@restored" ]; then
      [ -f "$STATE/restored" ] && return 0
      other_version_started "$image" || return 0
    fi
  done
  return 1
}

default_curl() {
  local last=${*: -1}
  [ "$last" = "$HEALTH_URL" ] || return 0
  if [ -f "$STATE/health-code" ]; then
    local code
    code=$(cat "$STATE/health-code")
    [ "$code" = 0 ] || return "$code"
  fi
  health_ok || return 22
  printf '{"status":"ok","version":"%s","db":"ok","protocol":1,"minProtocol":1,"epoch":"e","swKill":false}\n' \
    "$(cat "$STATE/image")"
}

default_cryptsetup() {
  case ${1:-} in
    status) [ -f "$STATE/luks-open" ] || return 4 ;;
    open) touch "$STATE/luks-open" ;;
  esac
}

default_mountpoint() {
  [ -f "$STATE/mounted" ]
}

default_mount() {
  touch "$STATE/mounted"
}

default_restic() {
  # restic -r <dépôt> … : B2 seulement lit b2.env (sous-shell de restic_on).
  printf '%s %s\n' "${2:-}" "${AWS_ACCESS_KEY_ID:-none}" >>"$STATE/restic-env"
}
