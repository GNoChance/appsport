#!/usr/bin/env bash
# Contrat d'image (08 §4, contrôles 1 à 7 de la spec) vérifié sur une image construite, avant toute publication.
# Usage : infra/test/image-contract.sh <image> <version>
# Exige docker, curl et jq. Code 0 si l'image respecte le contrat, 1 sinon.
set -euo pipefail

IMAGE="${1:?usage : image-contract.sh <image> <version>}"
VERSION="${2:?usage : image-contract.sh <image> <version>}"
HOST_PORT=3300
APP_ORIGIN="http://127.0.0.1:${HOST_PORT}"
NAME="appsport-contract-$$"
DATA_DIR="$(mktemp -d)"
# Le conteneur tourne en uid 1000, le runner en uid 1001 : /data doit lui rester inscriptible.
chmod 0777 "$DATA_DIR"

cleanup() {
  local code=$?
  docker rm -f "$NAME" "$NAME-guard" >/dev/null 2>&1 || true
  rm -rf -- "$DATA_DIR" 2>/dev/null || true
  exit "$code"
}
trap cleanup EXIT

fail() {
  echo "ÉCHEC : $*" >&2
  if docker container inspect "$NAME" >/dev/null 2>&1; then
    echo "--- journaux du conteneur ---" >&2
    docker logs --tail 50 "$NAME" 1>&2 || true
  fi
  exit 1
}

ok() {
  echo "OK $1 : $2"
}

# Lance le serveur avec la racine en lecture seule et /tmp en tmpfs, comme compose.yaml.
run_args=(--read-only --tmpfs /tmp -e "APP_ORIGIN=${APP_ORIGIN}" -v "${DATA_DIR}:/data")

# 1. Métadonnées : utilisateur 1000, seul port 3000/tcp, version inscrite, santé sur /api/health.
config="$(docker image inspect --format '{{json .Config}}' "$IMAGE")" || fail "1. image introuvable : $IMAGE"
jq -e '.User == "1000"' <<<"$config" >/dev/null || fail "1. l'utilisateur de l'image n'est pas 1000"
jq -e '(.ExposedPorts // {} | keys) == ["3000/tcp"]' <<<"$config" >/dev/null ||
  fail "1. ports exposés : $(jq -c '.ExposedPorts' <<<"$config"), attendu 3000/tcp seul"
jq -e --arg v "APP_VERSION=${VERSION}" 'any(.Env[]; . == $v)' <<<"$config" >/dev/null ||
  fail "1. APP_VERSION=${VERSION} absent de l'environnement de l'image"
jq -e '(.Healthcheck.Test // []) | join(" ") | contains("/api/health")' <<<"$config" >/dev/null ||
  fail "1. HEALTHCHECK absent ou hors /api/health"
ok 1 "utilisateur 1000, port 3000/tcp seul, APP_VERSION=${VERSION}, santé sur /api/health"

# 2. Contenu : server.mjs, public/index.html et data/, sans node_modules.
in_image() {
  docker run --rm --entrypoint sh "$IMAGE" -c "$1"
}
in_image 'test ! -e /app/node_modules' || fail "2. /app/node_modules présent dans l'image"
in_image 'test -f /app/server.mjs' || fail "2. /app/server.mjs absent"
in_image 'test -f /app/public/index.html' || fail "2. /app/public/index.html absent"
in_image 'test -d /app/data' || fail "2. /app/data absent"
ok 2 "server.mjs, public/index.html et data/ présents, pas de node_modules"

# 3. Garde de démarrage (R-OPS-3) : refus sans sentinelle, puis avec sentinelle mais sans base.
#    timeout : un serveur qui démarre malgré tout est un échec, pas un blocage.
guard_refuses() {
  local expected="$1" output code=0
  output="$(timeout 60 docker run --rm --name "$NAME-guard" "${run_args[@]}" "$IMAGE" 2>&1)" || code=$?
  [[ $code -ne 0 && $code -ne 124 ]] || return 1
  grep -qF -- "$expected" <<<"$output"
}
guard_refuses 'Volume de données absent' || fail "3. démarrage non refusé sans fichier sentinelle"
touch "$DATA_DIR/.appsport-volume"
guard_refuses 'Base introuvable' || fail "3. démarrage non refusé sans base"
[[ ! -e "$DATA_DIR/appsport.db" ]] || fail "3. une base vide a été créée"
ok 3 "démarrage refusé sans sentinelle puis sans base, aucune base créée"

# 4. init crée la base du volume neuf.
docker run --rm "${run_args[@]}" "$IMAGE" node /app/server.mjs init >/dev/null || fail "4. init en échec"
[[ -f "$DATA_DIR/appsport.db" ]] || fail "4. init n'a pas créé appsport.db"
ok 4 "init crée /data/appsport.db"

# 5. Le service répond sur /api/health en 60 s au plus, avec la version de l'image.
docker run -d --name "$NAME" "${run_args[@]}" -p "127.0.0.1:${HOST_PORT}:3000" "$IMAGE" >/dev/null ||
  fail "5. le conteneur ne démarre pas"
deadline=$((SECONDS + 60))
until health="$(curl -fsS --max-time 5 "http://127.0.0.1:${HOST_PORT}/api/health" 2>/dev/null)"; do
  ((SECONDS < deadline)) || fail "5. /api/health sans réponse 200 en 60 s"
  sleep 1
done
jq -e --arg v "$VERSION" '.status == "ok" and .db == "ok" and .version == $v' <<<"$health" >/dev/null ||
  fail "5. /api/health inattendu : $health"
ok 5 "/api/health : status ok, db ok, version ${VERSION}"

# 6. Écriture seulement dans /data et /tmp.
if docker exec "$NAME" touch /app/x 2>/dev/null; then fail "6. /app est inscriptible"; fi
docker exec "$NAME" touch /tmp/x || fail "6. /tmp n'est pas inscriptible"
docker exec "$NAME" touch /data/x || fail "6. /data n'est pas inscriptible"
ok 6 "/app en lecture seule, /tmp et /data inscriptibles"

# 7. Un seul port en écoute dans le conteneur : 3000 (0BB8 en hexadécimal), état 0A = LISTEN.
listening="$(docker exec "$NAME" sh -c 'cat /proc/net/tcp /proc/net/tcp6 2>/dev/null; true' |
  awk '$4 == "0A" { split($2, a, ":"); print a[2] }' | sort -u | tr '\n' ' ')" ||
  fail "7. lecture de /proc/net/tcp impossible"
[[ "$listening" == "0BB8 " ]] || fail "7. ports en écoute : ${listening:-aucun}, attendu 0BB8 seul"
ok 7 "seul le port 3000 (0BB8) est en écoute"

# 8. Journaux : chaque ligne de stdout est un objet JSON (stderr écarté).
stdout="$(docker logs "$NAME" 2>/dev/null)" || fail "8. docker logs en échec"
[[ -n "$stdout" ]] || fail "8. aucune ligne de journal sur stdout"
while IFS= read -r line; do
  jq -e . <<<"$line" >/dev/null 2>&1 || fail "8. ligne de stdout non JSON : $line"
done <<<"$stdout"
ok 8 "$(wc -l <<<"$stdout") ligne(s) de stdout, toutes en JSON"

# 9. Arrêt propre sur SIGTERM : moins de 10 s et code de sortie 0.
start_ms=$(date +%s%3N)
docker stop -t 15 "$NAME" >/dev/null || fail "9. docker stop en échec"
elapsed_ms=$(($(date +%s%3N) - start_ms))
((elapsed_ms < 10000)) || fail "9. arrêt en ${elapsed_ms} ms, attendu moins de 10 s"
exit_code="$(docker container inspect --format '{{.State.ExitCode}}' "$NAME")"
[[ "$exit_code" == 0 ]] || fail "9. code de sortie ${exit_code} après SIGTERM, attendu 0"
ok 9 "arrêt sur SIGTERM en ${elapsed_ms} ms, code 0"

echo "Contrat d'image respecté (9 contrôles)."
