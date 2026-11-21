#!/usr/bin/env bash
set -euo pipefail

CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/worker-models.json"

usage() {
  echo "Usage: $0 list | set <role> <agy|omp> <model>" >&2
  exit 2
}

case "${1:-}" in
  list)
    (($# == 1)) || usage
    jq -r 'to_entries[] | "\(.key)\t\(.value.kind)\t\(.value.model)"' "$CONFIG"
    ;;
  set)
    (($# == 4)) || usage
    ROLE=$2
    KIND=$3
    MODEL=$4
    if ! jq -e --arg role "$ROLE" 'has($role)' "$CONFIG" >/dev/null; then
      echo "Unknown role: $ROLE" >&2
      exit 2
    fi
    case "$KIND" in
      agy)
        if ! agy models | awk '{print $1}' | grep -Fxq -- "$MODEL"; then
          echo "Model not available in agy: $MODEL" >&2
          exit 1
        fi
        ;;
      omp)
        if ! omp models --kind chat --json | jq -e --arg model "$MODEL" '.models | any(.selector == $model)' >/dev/null; then
          echo "Model not available in omp: $MODEL" >&2
          exit 1
        fi
        ;;
      *) echo "Unsupported agent kind: $KIND" >&2; exit 2 ;;
    esac
    if jq -e --arg role "$ROLE" --arg kind "$KIND" --arg model "$MODEL" '.[$role] == {kind: $kind, model: $model}' "$CONFIG" >/dev/null; then
      echo "$ROLE already uses $KIND $MODEL"
      exit 0
    fi
    TMP=$(mktemp "${CONFIG}.XXXXXX")
    trap 'rm -f -- "$TMP"' EXIT
    jq --arg role "$ROLE" --arg kind "$KIND" --arg model "$MODEL" '.[$role] = {kind: $kind, model: $model}' "$CONFIG" > "$TMP"
    chmod --reference="$CONFIG" "$TMP"
    mv -- "$TMP" "$CONFIG"
    echo "$ROLE -> $KIND $MODEL"
    ;;
  *) usage ;;
esac
