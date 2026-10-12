#!/usr/bin/env bash
# Stub d'une commande de l'hôte, copié en $T/bin/<nom> par setup_host (helpers.bash).
# 1. ajoute « <nom> <args> » à $CALLS ;
# 2. applique la première règle de $T/rules/<nom> (lignes « motif<TAB>code<TAB>extrait » écrites par `on`) :
#    motif glob comparé à « <args> », extrait passé à eval, puis sortie avec le code ;
# 3. sinon default_<nom> de $STUB_DEFAULTS (defaults.bash), ou 0.
set -uo pipefail

name=$(basename "$0")
args="$*"
printf '%s %s\n' "$name" "$args" >>"$CALLS"

rules="$T/rules/$name"
if [ -f "$rules" ]; then
  while IFS=$'\t' read -r pat code snippet; do
    # shellcheck disable=SC2053 # motif glob voulu
    if [[ "$args" == $pat ]]; then
      if [ -n "$snippet" ]; then eval "$snippet"; fi
      exit "$code"
    fi
  done <"$rules"
fi

# shellcheck source=/dev/null
. "$STUB_DEFAULTS"
if declare -F "default_$name" >/dev/null; then
  "default_$name" "$@"
  exit $?
fi
exit 0
