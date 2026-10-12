#!/usr/bin/env bats
# appsport-alive (08 §9, §13.3) : toutes les 5 min, santé par l'URL *.ts.net (certificat, serve, appli, base).

PUBLIC_HEALTH=https://appsport.test.ts.net/api/health

setup() {
  source "$BATS_TEST_DIRNAME/helpers.bash"
  setup_host
  ALIVE="$HOST_DIR/appsport-alive"
}

@test "santé OK par l'URL publique : ping alive" {
  run "$ALIVE"
  [ "$status" -eq 0 ]
  assert_calls_in_order \
    "curl -sS --fail-with-body --max-time 10 $PUBLIC_HEALTH" \
    "curl * https://hc.test/alive"
  refute_call "curl * https://hc.test/alive/fail"
  refute_call "curl *127.0.0.1*"
}

@test "volume verrouillé : /fail « volume verrouillé : lancer appsport-unlock »" {
  rm -f "$STATE/mounted" "$STATE/running"
  run "$ALIVE"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw volume verrouillé : lancer appsport-unlock https://hc.test/alive/fail"
  refute_call "curl * https://hc.test/alive"
}

@test "api/health injoignable (sans corps) : « appli KO : api/health injoignable »" {
  on curl "* $PUBLIC_HEALTH" 7 'echo "curl: (7) Failed to connect" >&2'
  run "$ALIVE"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw appli KO : api/health injoignable https://hc.test/alive/fail"
  refute_call "curl * https://hc.test/alive"
}

@test "503 avec corps : statut et base repris du corps, « appli KO : status=error db=error »" {
  on curl "* $PUBLIC_HEALTH" 22 \
    "echo '{\"status\":\"error\",\"version\":\"v1.2.0\",\"db\":\"error\",\"protocol\":1,\"minProtocol\":1,\"epoch\":\"e\",\"swKill\":false}'"
  run "$ALIVE"
  [ "$status" -eq 1 ]
  assert_calls_in_order "curl *--data-raw appli KO : status=error db=error https://hc.test/alive/fail"
  refute_call "curl * https://hc.test/alive"
}
