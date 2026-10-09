#!/usr/bin/env bats
# appsport-update (R-DEP-3, R-DEP-4, 08 §8) : déploiement, retour arrière automatique et --rollback.
# Review Focus 4 : l'image précédente seule d'abord, sans restauration ni nouvelle époque.

HEALTH=http://127.0.0.1:3000/api/health
OFFSITE=s3:https://s3.test/appsport-backups
ISO='[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z'
ISO_GLOB='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'

setup() {
  load helpers
  setup_host
  UPDATE="$HOST_DIR/appsport-update"
  STATUS_FILE="$APPSPORT_ROOT/data/ops/status.json"
}

last_deploy_line() { tail -n1 "$APPSPORT_ROOT/deploy.log"; }
deployed_version() { sed -n 's/^APPSPORT_VERSION=//p' "$APPSPORT_ROOT/deploy.env"; }

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
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 0 ]
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
    "chown 1000:1000 $APPSPORT_ROOT/data/ops/.status.*"
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
}

@test "confirmation « n » : abandon, code 1, aucun git" {
  remember_files
  run "$UPDATE" v1.3.0 <<<"n"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Aucune séance en cours depuis moins de 3 h."* ]]
  [[ "$output" == *"Déployer v1.3.0 (version actuelle v1.2.0) ? [o/N]"* ]]
  [[ "$output" == *"Abandon : rien n'a été changé."* ]]
  assert_nothing_changed
}

@test "confirmation « o » : déploiement, code 0" {
  set_healthy_versions v1.2.0 v1.3.0
  run "$UPDATE" v1.3.0 <<<"o"
  [ "$status" -eq 0 ]
  [ "$(deployed_version)" = "v1.3.0" ]
  [[ "$(last_deploy_line)" =~ \ v1\.2\.0\ v1\.3\.0\ ok$ ]]
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
    "chown 1000:1000 $APPSPORT_ROOT/data/ops" \
    "docker compose * run --rm --no-deps app node /app/server.mjs privacy:collect --since * --out /data/ops/privacy-v1.3.0-*.json" \
    "docker compose * stop app" \
    "docker compose * run --rm --no-deps app node /app/server.mjs restore /data/snapshots/pre-v1.3.0.db" \
    "docker compose * run --rm --no-deps app node /app/server.mjs privacy:reapply /data/ops/privacy-v1.3.0-*.json" \
    "docker compose * up -d"
  # Lecture seule de la base courante (T24) : jamais --source ; depuis l'instantané moins 5 min.
  refute_call "* privacy:collect *--source*"
  assert_calls_in_order "* privacy:collect --since $ISO_GLOB --out *"
  [ "$(deployed_version)" = "v1.2.0" ]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rolled-back-restore$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .previousVersion == "v1.2.0" and .ok == false' "$STATUS_FILE"
  [ -z "$(compgen -G "$APPSPORT_ROOT/data/ops/privacy-*.json" || true)" ]
}

@test "restauration impossible : P4, liste privacy gardée, rollback-failed" {
  set_healthy_versions "v1.2.0@restored"
  on docker '* restore *' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Restauration ou réapplication impossible : suivez P4."* ]]
  refute_call "* privacy:reapply *"
  compgen -G "$APPSPORT_ROOT/data/ops/privacy-v1.3.0-*.json"
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rollback-failed$ ]]
  jq -e '.deploy.ok == false' "$STATUS_FILE"
}

@test "retour arrière dont le checkout du tag précédent échoue : P4, rollback-failed" {
  on git '* checkout --quiet v1.2.0' 1
  run "$UPDATE" v1.3.0 --yes
  [ "$status" -eq 1 ]
  [[ "$output" == *"Tag v1.2.0 introuvable : suivez P4."* ]]
  [[ "$(last_deploy_line)" =~ ^$ISO\ v1\.2\.0\ v1\.3\.0\ rollback-failed$ ]]
  jq -e '.deploy | .version == "v1.3.0" and .ok == false' "$STATUS_FILE"
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

@test "version mal formée : usage, code 2, aucune commande" {
  run "$UPDATE" v1.3
  [ "$status" -eq 2 ]
  [[ "$output" == *"Usage"* ]]
  [ ! -s "$CALLS" ]
}
