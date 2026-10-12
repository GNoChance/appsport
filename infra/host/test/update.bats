#!/usr/bin/env bats
# appsport-update (R-DEP-3, R-DEP-4, 08 §8) : déploiement, retour arrière automatique et --rollback.
# Review Focus 4 : l'image précédente seule d'abord, sans restauration ni nouvelle époque.

HEALTH=http://127.0.0.1:3000/api/health
OFFSITE=s3:https://s3.test/appsport-backups
ISO='[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z'
ISO_GLOB='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  UPDATE="$HOST_DIR/appsport-update"
  STATUS_FILE="$APPSPORT_ROOT/data/ops/status.json"
}

last_deploy_line() { tail -n1 "$APPSPORT_ROOT/deploy.log"; }
deployed_version() { sed -n 's/^APPSPORT_VERSION=//p' "$APPSPORT_ROOT/deploy.env"; }
# Aucun up -d n'a vu APPSPORT_VERSION dans l'environnement (compose la préférerait à deploy.env).
assert_up_env_unset() { [ -s "$STATE/up-env" ] && ! grep -qvx unset "$STATE/up-env"; }

# Second scénario dans le même test : hôte sain en v1.2.0 repris de zéro (règles, appels et état effacés).
reset_host() {
  rm -rf "${T:?}"/*
  # $T/bin sorti du PATH et des chemins mémorisés : wrap_windows_jq doit retrouver le vrai jq, pas son enveloppe.
  PATH=${PATH//"$T/bin:"/}
  hash -r
  setup_host
}

# Disque plein : deploy.log devient un répertoire, toute écriture (>>) échoue.
break_deploy_log() {
  rm -f "$APPSPORT_ROOT/deploy.log"
  mkdir "$APPSPORT_ROOT/deploy.log"
}

# Volume plein ou en lecture seule pour deploy.env : son temporaire (mktemp) ne peut plus être créé.
break_deploy_env_writes() {
  local real
  real=$(command -v mktemp)
  printf '#!/usr/bin/env bash\ncase "$*" in *.deploy.env.*) echo "mktemp: No space left on device" >&2; exit 1 ;; esac\nexec "%s" "$@"\n' \
    "$real" >"$T/bin/mktemp"
  chmod +x "$T/bin/mktemp"
}

# Les préconditions refusées ne touchent ni au dépôt, ni à l'image, ni à deploy.env, ni à deploy.log.
assert_nothing_changed() {
  refute_call "git *"
  refute_call "docker compose * pull *"
  refute_call "docker compose * up *"
  [ "$(cat "$APPSPORT_ROOT/deploy.env")" = "$ENV_BEFORE" ]
  [ "$(cat "$APPSPORT_ROOT/deploy.log")" = "$LOG_BEFORE" ]
}

remember_files() {
  ENV_BEFORE=$(cat "$APPSPORT_ROOT/deploy.env")
  LOG_BEFORE=$(cat "$APPSPORT_ROOT/deploy.log")
}

@test "nominal --yes : séances affichées, étapes dans l'ordre, deploy.env, deploy.log et .deploy" {
  set_healthy_versions v1.2.0 v1.3.0
  printf 'alice\t2026-10-09T18:00:00.000Z\n' >"$STATE/sessions"
  # Verrou encore tenu à la dernière écriture de status.json : descripteur 9 toujours ouvert sur $LOCK_FILE.
  # shellcheck disable=SC2016 # extrait évalué par le stub
  on chown "1000:1000 $APPSPORT_ROOT/.ops-tmp/status.*" 0 \
    '. "$STUB_DEFAULTS"; if fd_open_on 9 "$LOCK_FILE"; then touch "$STATE/lock-held"; fi'
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 0 ]
  [ -f "$STATE/lock-held" ]
  [[ "$output" == *"- alice (début 2026-10-09T18:00:00.000Z)"* ]]
  [[ "$output" == *"Déploiement de v1.3.0 réussi."* ]]
  assert_calls_in_order \
    "curl *$HEALTH" \
    "docker compose * exec -T app node /app/server.mjs sessions:active --hours 3" \
    "git -C $APPSPORT_REPO fetch --tags" \
    "git -C $APPSPORT_REPO checkout --quiet v1.3.0" \
    "docker compose --project-name appsport -f $APPSPORT_REPO/infra/compose.yaml --env-file $APPSPORT_ROOT/deploy.env pull app" \
    "docker compose * exec -T app node /app/server.mjs snapshot --tag pre-v1.3.0" \
    "restic -r $BACKUP_ROOT/restic backup --tag pre-deploy *" \
    "restic -r $OFFSITE backup --tag pre-deploy *" \
    "docker compose * up -d" \
    "curl *$HEALTH" \
    "chown 1000:1000 $APPSPORT_ROOT/.ops-tmp/status.*"
  # Sauvegarde pre-deploy : base vive exclue, instantanés, secrets, deploy.*, état Tailscale ; B2 en sous-shell.
  assert_calls_in_order "restic -r $BACKUP_ROOT/restic backup --tag pre-deploy --exclude $APPSPORT_ROOT/data/appsport.db* $APPSPORT_ROOT/data/snapshots $APPSPORT_ROOT/secrets $APPSPORT_ROOT/deploy.env $APPSPORT_ROOT/deploy.log $TAILSCALE_STATE"
  [ "$(cat "$STATE/restic-env")" = "$(printf '%s none\n%s b2-key-id' "$BACKUP_ROOT/restic" "$OFFSITE")" ]
  # APPSPORT_VERSION en ligne pour le pull seulement ; up -d lit deploy.env.
  [ "$(cat "$STATE/pulled")" = "v1.3.0" ]
  [ "$(cat "$STATE/up-env")" = "unset" ]
  [ "$(deployed_version)" = "v1.3.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ ok$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == true and (.at | test("Z$"))' "$STATUS_FILE"
  jq -e '.backup.ok == true' "$STATUS_FILE"
}

@test "verrou occupé : code 1, aucun git" {
  on flock '*' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Une autre opération appsport est en cours. Rien n'a été changé."* ]]
  assert_calls_in_order "flock -n 9"
  refute_call "git *"
}

@test "source common.sh : secrets exportés, GIT_SSH_COMMAND sur deploy_key, APPSPORT_VERSION jamais exportée" {
  APPSPORT_VERSION=v9.9.9 run bash -c 'source "$1" && env' _ "$HOST_DIR/lib/common.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"GIT_SSH_COMMAND=ssh -i $APPSPORT_ROOT/secrets/deploy_key -o IdentitiesOnly=yes"* ]]
  [[ "$output" == *"DOCKER_CONFIG=$APPSPORT_ROOT/secrets/docker"* ]]
  [[ "$output" == *"RESTIC_PASSWORD_FILE=$APPSPORT_ROOT/secrets/restic.pass"* ]]
  [[ "$output" == *"RESTIC_CACHE_DIR=$APPSPORT_ROOT/cache/restic"* ]]
  [[ "$output" != *"APPSPORT_VERSION="* ]]

  # Valeurs par défaut de wait_health (setup_host les surcharge) : 30 essais de 2 s séparés par sleep 2.
  run env -u HEALTH_TIMEOUT_S -u HEALTH_POLL_S -u SLEEP \
    bash -c 'source "$1" && echo "$HEALTH_TIMEOUT_S $HEALTH_POLL_S $SLEEP"' _ "$HOST_DIR/lib/common.sh"
  [ "$status" -eq 0 ]
  [ "$output" = "120 2 sleep" ]
}

@test "confirmation « n », Entrée (Non par défaut) ou « y » : abandon, code 1, aucun git" {
  local answer
  for answer in n "" y; do
    reset_host
    remember_files
    run "$UPDATE" v1.3.0 <<<"$answer"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Aucune séance en cours depuis moins de 3 h."* ]]
    [[ "$output" == *"Déployer v1.3.0 (version actuelle v1.2.0) ? [o/N]"* ]]
    [[ "$output" == *"Abandon : rien n'a été changé."* ]]
    assert_nothing_changed
  done
}

@test "confirmation « o » : déploiement, code 0" {
  set_healthy_versions v1.2.0 v1.3.0
  run "$UPDATE" v1.3.0 <<<"o"
  [ "$status" -eq 0 ]
  [ "$(deployed_version)" = "v1.3.0" ]
  [[ "$(last_deploy_line)" =~ \ v1\.2\.0\ v1\.3\.0\ ok$ ]]

  # deploy.log non inscriptible : avertissement, le succès est quand même inscrit dans .deploy.
  reset_host
  set_healthy_versions v1.2.0 v1.3.0
  break_deploy_log
  run "$UPDATE" v1.3.0 <<<"o"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Avertissement : deploy.log non écrit."* ]]
  [[ "$output" == *"Déploiement de v1.3.0 réussi."* ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == true' "$STATUS_FILE"
}

@test "volume non monté : code 1, rien n'a été changé" {
  remember_files
  rm -f "$STATE/mounted"
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Volume non monté : lancez d'abord sudo appsport-unlock. Rien n'a été changé."* ]]
  assert_nothing_changed
}

@test "sentinelle absente : code 1, rien n'a été changé" {
  remember_files
  rm -f "$APPSPORT_ROOT/data/.appsport-volume"
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Sentinelle $APPSPORT_ROOT/data/.appsport-volume absente. Rien n'a été changé."* ]]
  assert_nothing_changed
}

@test "/api/health ne répond pas 200 : code 1, rien n'a été changé" {
  remember_files
  set_health 22
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"L'appli ne répond pas 200 sur /api/health : voir P8. Rien n'a été changé."* ]]
  assert_nothing_changed
}

@test "pull en échec : retour au tag précédent, ni instantané ni up, pull-failed" {
  on docker '* pull app' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Échec du téléchargement de l'image v1.3.0 (jeton GHCR expiré ? voir P5). Rien n'a été changé."* ]]
  assert_calls_in_order \
    "git -C $APPSPORT_REPO checkout --quiet v1.3.0" \
    "docker compose * pull app" \
    "git -C $APPSPORT_REPO checkout --quiet v1.2.0"
  refute_call "docker compose * snapshot *"
  refute_call "docker compose * up *"
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ pull-failed$ ]]

  # deploy.log non inscriptible : avertissement, et le message « Rien n'a été changé » s'affiche quand même.
  reset_host
  on docker '* pull app' 1
  break_deploy_log
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Avertissement : deploy.log non écrit."* ]]
  [[ "$output" == *"Échec du téléchargement de l'image v1.3.0 (jeton GHCR expiré ? voir P5). Rien n'a été changé."* ]]
}

@test "sauvegarde pre-deploy en échec : pas de up, backup-failed, deploy.env inchangé" {
  on restic "-r $OFFSITE backup *" 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Échec de l'instantané ou de la sauvegarde pre-deploy. Le service n'a pas été modifié."* ]]
  assert_calls_in_order "restic -r $OFFSITE backup *" "git -C $APPSPORT_REPO checkout --quiet v1.2.0"
  refute_call "docker compose * up *"
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ backup-failed$ ]]

  # deploy.log non inscriptible : avertissement, et le message d'échec s'affiche quand même.
  reset_host
  on restic "-r $OFFSITE backup *" 1
  break_deploy_log
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Avertissement : deploy.log non écrit."* ]]
  [[ "$output" == *"Échec de l'instantané ou de la sauvegarde pre-deploy. Le service n'a pas été modifié."* ]]
}

@test "nouvelle version KO, image précédente saine : retour image seule, ni restore ni privacy, rolled-back-image" {
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Échec du démarrage de v1.3.0 : retour arrière automatique."* ]]
  assert_calls_in_order \
    "docker compose * up -d" \
    "git -C $APPSPORT_REPO checkout --quiet v1.2.0" \
    "docker compose * up -d" \
    "curl *$HEALTH"
  refute_call "* restore *"
  refute_call "* privacy:*"
  refute_call "docker compose * stop *"
  assert_up_env_unset
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rolled-back-image$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == false' "$STATUS_FILE"

  # deploy.env non écrit (volume plein ou en lecture seule) : échec de l'étape 5, même retour arrière,
  # le dépôt revient à v1.2.0 et deploy.log garde une trace (R-DEP-3 étapes 5 et 7).
  reset_host
  set_healthy_versions v1.2.0 v1.3.0
  break_deploy_env_writes
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"deploy.env non écrit : retour arrière automatique."* ]]
  assert_calls_in_order \
    "restic -r $OFFSITE backup --tag pre-deploy *" \
    "git -C $APPSPORT_REPO checkout --quiet v1.2.0" \
    "docker compose * up -d" \
    "curl *$HEALTH"
  [ "$(count_calls "docker compose * up -d")" -eq 1 ]
  [ "$(cat "$STATE/image")" = "v1.2.0" ]
  refute_call "* restore *"
  refute_call "* privacy:*"
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rolled-back-image$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == false' "$STATUS_FILE"
}

@test "schéma incompatible : v1.2.0 saine seulement après restauration, liste privacy purgée, rolled-back-restore" {
  set_healthy_versions "v1.2.0@restored"
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Base restaurée : les téléphones renverront leurs 60 derniers jours."* ]]
  assert_calls_in_order \
    "docker compose * up -d" \
    "docker compose * up -d" \
    "chown -h 1000:1000 $APPSPORT_ROOT/data/ops" \
    "docker compose * run --rm --no-deps app node /app/server.mjs privacy:collect --since * --out /data/ops/privacy-v1.3.0-*.json" \
    "docker compose * stop app" \
    "docker compose * run --rm --no-deps app node /app/server.mjs restore /data/snapshots/pre-v1.3.0.db" \
    "docker compose * run --rm --no-deps app node /app/server.mjs privacy:reapply /data/ops/privacy-v1.3.0-*.json" \
    "docker compose * up -d"
  # Lecture seule de la base courante (T24) : jamais --source ; depuis l'instantané moins 5 min.
  refute_call "* privacy:collect *--source*"
  assert_calls_in_order "* privacy:collect --since $ISO_GLOB --out *"
  assert_up_env_unset
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rolled-back-restore$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == false' "$STATUS_FILE"
  [ -z "$(compgen -G "$APPSPORT_ROOT/data/ops/privacy-*.json" || true)" ]
  [ ! -e "$APPSPORT_ROOT/reapply-pending" ]

  # Liste privacy non supprimable : avertissement, le retour arrière va jusqu'au bout et reste consigné.
  reset_host
  set_healthy_versions "v1.2.0@restored"
  on docker '* privacy:reapply *' 0 'p=${args##* }; p="$APPSPORT_ROOT/data${p#/data}"; rm -f "$p"; mkdir "$p"'
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Avertissement : liste $APPSPORT_ROOT/data/ops/privacy-v1.3.0-"*".json non supprimée"* ]]
  [[ "$output" == *"Base restaurée : les téléphones renverront leurs 60 derniers jours."* ]]
  assert_calls_in_order "* privacy:reapply *" "docker compose * up -d" "curl *$HEALTH"
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rolled-back-restore$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .ok == false' "$STATUS_FILE"
  # La réapplication a eu lieu : le marqueur est levé même si la liste reste.
  [ ! -e "$APPSPORT_ROOT/reapply-pending" ]
}

@test "restauration impossible : P4, liste privacy et marqueur de réapplication gardés, rollback-failed" {
  set_healthy_versions "v1.2.0@restored"
  on docker '* restore *' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Restauration ou réapplication impossible : suivez P4."* ]]
  refute_call "* privacy:reapply *"
  compgen -G "$APPSPORT_ROOT/data/ops/privacy-v1.3.0-*.json"
  # Écrit avant restore : une restauration partielle ne laisse pas repartir app sans P4.
  [ -f "$APPSPORT_ROOT/reapply-pending" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rollback-failed$ ]]
  jq -e '.deploy.ok == false' "$STATUS_FILE"
}

@test "restauration faite, réapplication en échec : marqueur, puis unlock, --rollback et update refusent tout up -d" {
  set_healthy_versions "v1.2.0@restored"
  on docker '* privacy:reapply *' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Restauration ou réapplication impossible : suivez P4."* ]]
  assert_calls_in_order "* restore /data/snapshots/pre-v1.3.0.db" "* privacy:reapply /data/ops/privacy-v1.3.0-*.json"
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rollback-failed$ ]]
  # Marqueur root hors de data/ : il nomme la liste à réappliquer en P4, gardée elle aussi.
  [[ "$(cat "$APPSPORT_ROOT/reapply-pending")" == /data/ops/privacy-v1.3.0-*.json ]]
  compgen -G "$APPSPORT_ROOT/data/ops/privacy-v1.3.0-*.json"

  # Redémarrage puis P2 : la base restaurée non réappliquée n'est pas servie (03 §8).
  reset_calls
  run "$HOST_DIR/appsport-unlock"
  [ "$status" -eq 1 ]
  [[ "$output" == *"KO : réapplication des suppressions en attente : suivez P4."* ]]
  refute_call "docker compose * up *"
  assert_calls_in_order "curl * https://hc.test/alive/fail"

  # La dernière ligne ok nomme v1.2.0, en place : --rollback passerait sans le marqueur.
  reset_calls
  remember_files
  run "$UPDATE" --rollback --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Réapplication des suppressions en attente : suivez P4."* ]]
  assert_nothing_changed

  reset_calls
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Réapplication des suppressions en attente : suivez P4."* ]]
  assert_nothing_changed
}

@test "retour arrière dont le checkout du tag précédent échoue : P4, rollback-failed" {
  on git '* checkout --quiet v1.2.0' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Tag v1.2.0 introuvable : suivez P4."* ]]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rollback-failed$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .ok == false' "$STATUS_FILE"
}

@test "interrompu (Ctrl-C, TERM) pendant le démarrage de v1.3.0 : consigné rollback-failed, P4" {
  # Le stub de compose up envoie le signal au script, qui le traite dès que up rend la main.
  on docker '* up -d' 0 '. "$STUB_DEFAULTS"; default_docker "$@"; kill -TERM $PPID'
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Interrompu : suivez P4."* ]]
  [ "$(count_calls "docker compose * up -d")" -eq 1 ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rollback-failed$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == false' "$STATUS_FILE"
}

@test "interrompu pendant la sauvegarde pre-deploy : dépôt ramené au tag en place, service intact" {
  on restic "-r $BACKUP_ROOT/restic backup *" 0 'kill -TERM $PPID'
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Interrompu : le service n'a pas été modifié."* ]]
  assert_calls_in_order "restic -r $BACKUP_ROOT/restic backup *" "git -C $APPSPORT_REPO checkout --quiet v1.2.0"
  refute_call "docker compose * up *"
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ \ v1\.1\.0\ v1\.2\.0\ ok$ ]]
}

@test "SSH coupé (HUP) après la confirmation : ignoré, le retour arrière automatique va à son terme" {
  on docker '* up -d' 0 '. "$STUB_DEFAULTS"; default_docker "$@"; kill -HUP $PPID'
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [ "$(count_calls "docker compose * up -d")" -eq 2 ]
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rolled-back-image$ ]]
}

@test "--rollback manuel, image v1.2.0 saine : image seule, ni restore ni privacy, rolled-back-image" {
  write_deploy_env_for_test v1.3.0
  echo "2026-10-08T20:00:00Z v1.2.0 v1.3.0 ok" >>"$APPSPORT_ROOT/deploy.log"
  echo v1.3.0 >"$STATE/image"
  set_healthy_versions v1.2.0 v1.3.0
  run "$UPDATE" --rollback --yes
  [ "$status" -eq 0 ]
  [ "$(deployed_version)" = "v1.2.0" ]
  assert_calls_in_order \
    "git -C $APPSPORT_REPO checkout --quiet v1.2.0" \
    "docker compose * up -d" \
    "curl *$HEALTH"
  refute_call "* restore *"
  refute_call "* privacy:*"
  assert_up_env_unset
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.3\.0\ v1\.2\.0\ rolled-back-image$ ]]
  jq -e '.deploy | .version == "v1.2.0" and .previousVersion == "v1.3.0" and .ok == true' "$STATUS_FILE"
}

@test "--rollback sans déploiement réussi : refus, rien n'a été changé" {
  echo "2026-09-01T20:00:00Z v1.1.0 v1.2.0 pull-failed" >"$APPSPORT_ROOT/deploy.log"
  remember_files
  run "$UPDATE" --rollback --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Aucun déploiement réussi à annuler."* ]]
  assert_nothing_changed
}

@test "versions illisibles dans deploy.log ou deploy.env : refus, ni option git ni chemin hors du volume" {
  # deploy.log et deploy.env reviennent de restic et s'éditent en P4 : relus, ils sont validés comme vX.Y.Z.
  write_deploy_env_for_test v1.3.0
  echo "2026-10-08T20:00:00Z ../../../etc v1.3.0 ok" >>"$APPSPORT_ROOT/deploy.log"
  remember_files
  run "$UPDATE" --rollback --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Dernier déploiement réussi illisible dans $APPSPORT_ROOT/deploy.log. Rien n'a été changé."* ]]
  assert_nothing_changed

  reset_calls
  write_deploy_env_for_test --orphan
  echo "2026-10-08T21:00:00Z v1.2.0 --orphan ok" >>"$APPSPORT_ROOT/deploy.log"
  remember_files
  run "$UPDATE" --rollback --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Dernier déploiement réussi illisible dans $APPSPORT_ROOT/deploy.log. Rien n'a été changé."* ]]
  assert_nothing_changed

  reset_calls
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Version en place illisible dans $APPSPORT_ROOT/deploy.env. Rien n'a été changé."* ]]
  assert_nothing_changed
}

@test "version mal formée : usage, code 2, aucune commande" {
  run "$UPDATE" v1.3
  [ "$status" -eq 2 ]
  [[ "$output" == *"Usage"* ]]
  [ ! -s "$CALLS" ]
}
