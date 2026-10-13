# shellcheck shell=bash
# Comportements par défaut des stubs (stub.sh) : un hôte Rune simulé dans $STATE. T44 l'étend.
#   luks-open, mounted, running : volume ouvert, monté, service app en marche ;
#   image : version de l'image en marche (RUNE_VERSION du shell, sinon deploy.env, lue par `compose up`) ;
#   healthy : versions saines (« v » ; « v@restored » : saine tant qu'aucune autre version n'a démarré, schéma
#   non migré, puis seulement après `restore`) ; started : versions démarrées par `compose up` ;
#   health-code : code de sortie imposé au curl de santé (set_health) ;
#   sessions : sortie de sessions:active ; pulled, up-env (une ligne par up), restic-env, restic-pass :
#   environnement vu par pull, up, restic ;
#   db-stats-live, db-stats-copy : sortie de db:stats sur la base réelle (compose exec ou run) et sur la copie du
#   test de restauration (docker run --rm) ; db-stats-source : contenu de la copie lue (nom de l'instantané).

# db:stats par défaut : bases saines ; la base réelle a 18 h 30 d'avance sur le daily restauré.
DB_STATS_LIVE='{"integrity":"ok","users":2,"syncCounter":52,"lastWriteAt":"2026-10-05T20:00:00.000Z"}'
DB_STATS_COPY='{"integrity":"ok","users":2,"syncCounter":40,"lastWriteAt":"2026-10-05T01:30:00.000Z"}'

# Chemin sur l'hôte d'un chemin /data/… du conteneur.
host_data_path() { printf '%s\n' "$RUNE_ROOT/data${1#/data}"; }

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
      mkdir -p "$RUNE_ROOT/data/snapshots"
      : >"$RUNE_ROOT/data/snapshots/$2.db"
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
    db:stats)
      if [ -f "$STATE/db-stats-live" ]; then cat "$STATE/db-stats-live"; else echo "$DB_STATS_LIVE"; fi
      ;;
  esac
}

# docker run hors compose (rune-restore-test) : -d → conteneur jetable démarré (identifiant affiché) ;
# sinon db:stats sur le dossier monté en /data, qui doit contenir la copie et la sentinelle.
default_docker_run() {
  local arg prev="" src=""
  for arg in "$@"; do
    if [ "$arg" = -d ]; then
      echo 0123456789cd
      return 0
    fi
    if [ "$prev" = -v ] && [[ "$arg" == *:/data ]]; then src=${arg%:/data}; fi
    prev=$arg
  done
  [ "${*: -1}" = db:stats ] || return 0
  [ -n "$src" ] && [ -f "$src/rune.db" ] && [ -f "$src/.rune-volume" ] || return 1
  cat "$src/rune.db" >"$STATE/db-stats-source"
  if [ -f "$STATE/db-stats-copy" ]; then cat "$STATE/db-stats-copy"; else echo "$DB_STATS_COPY"; fi
}

default_docker() {
  case ${1:-} in
    compose) shift ;;
    run)
      shift
      default_docker_run "$@"
      return
      ;;
    *) return 0 ;;
  esac
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
      printf '%s\n' "${RUNE_VERSION-unset}" >>"$STATE/up-env"
      printf '%s\n' "${RUNE_VERSION:-$(sed -n 's/^RUNE_VERSION=//p' "$RUNE_ROOT/deploy.env")}" \
        >"$STATE/image"
      cat "$STATE/image" >>"$STATE/started"
      touch "$STATE/running"
      ;;
    stop)
      rm -f "$STATE/running"
      ;;
    pull)
      printf '%s\n' "${RUNE_VERSION-unset}" >"$STATE/pulled"
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

# Santé locale (HEALTH_URL) ou par l'URL *.ts.net (rune-alive) : même simulation.
default_curl() {
  local last=${*: -1}
  [ "$last" = "$HEALTH_URL" ] || [[ "$last" == https://*/api/health ]] || return 0
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
  printf '%s\n' "${RESTIC_PASSWORD_FILE:-none}" >>"$STATE/restic-pass"
  [ "${3:-}" = restore ] || return 0
  # restore latest --tag daily --target <dossier> --include <chemin> : comme restic, le chemin absolu sauvegardé
  # est recréé sous <dossier> ; trois daily (dans le désordre) et un pre-v, chacun contenant son nom.
  local target="" include="" name
  shift 3
  while [ $# -gt 0 ]; do
    case $1 in
      --target | --include)
        if [ "$1" = --target ]; then target=${2:-}; else include=${2:-}; fi
        shift 2 || return 1
        ;;
      *) shift ;;
    esac
  done
  [ -n "$target" ] && [ -n "$include" ] || return 1
  mkdir -p "$target$include"
  for name in daily-20261003 daily-20261005 daily-20261004 pre-v1.2.0; do
    echo "$name" >"$target$include/$name.db"
  done
}

# df --output=pcent <montage> : 42 % partout.
default_df() { printf 'Use%%\n 42%%\n'; }

default_smartctl() { echo "SMART overall-health self-assessment test result: PASSED"; }

# fd_open_on <fd> <fichier> : descripteur hérité ouvert en écriture, et sur <fichier> (même périphérique et inode)
# là où /proc le montre (Linux, MSYS ; sous MSYS, /tmp et son chemin Windows désignent le même fichier).
fd_open_on() {
  { : >&"$1"; } 2>/dev/null || return 1
  if [ -d "/proc/$$/fd" ]; then
    [ "/proc/$$/fd/$1" -ef "$2" ] || return 1
  fi
}

# Comme le vrai flock, échoue si le descripteur n'est pas ouvert : flock -n 9 sur $LOCK_FILE (take_lock),
# flock -w 30 8 sur le verrou de status.json (status_merge).
default_flock() {
  local fd=${*: -1} want
  case $fd in
    9) want=$LOCK_FILE ;;
    8) want=$RUNE_ROOT/.ops-tmp/status.lock ;;
    *)
      echo "flock: $fd: descripteur inattendu" >&2
      return 1
      ;;
  esac
  fd_open_on "$fd" "$want" && return 0
  echo "flock: $fd: Bad file descriptor" >&2
  return 1
}
