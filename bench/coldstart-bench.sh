#!/usr/bin/env bash
# Mesure le temps de démarrage à froid (process prêt à servir) sur 10 itérations.
# Compare `node` et `bun` sur le MEME code (src/index.ts).
set -euo pipefail
N=10
measure() {
  local label="$1"; shift
  local total=0
  for i in $(seq 1 $N); do
    local start=$(date +%s%N)
    PORT=0 "$@" >/dev/null 2>&1 &
    local pid=$!
    # Attendre que le process soit en ligne puis le tuer
    sleep 0.4
    kill $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
    local end=$(date +%s%N)
    total=$(( total + (end - start) ))
  done
  echo "$label : ~$(( total / N / 1000000 )) ms / démarrage (mesure brute, à affiner avec un probe HTTP)"
}
measure "node" node --experimental-strip-types --experimental-sqlite src/index.ts
measure "bun " bun run src/index.ts
