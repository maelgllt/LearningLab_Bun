#!/usr/bin/env bash
# Mesure le temps de démarrage à froid (process prêt à SERVIR) sur N itérations.
# Compare `node` et `bun` sur le MEME code (src/index.ts).
# Le chrono court du lancement du process jusqu'à la première réponse HTTP 200
# sur /health : c'est le vrai "cold start" perçu, pas une attente fixe.
set -euo pipefail
N=10
PORT=3031
export PORT

measure() {
  local label="$1"; shift
  local total=0
  for i in $(seq 1 $N); do
    local start=$(date +%s%N)
    "$@" >/dev/null 2>&1 &
    local pid=$!
    # Probe actif : on interroge /health jusqu'à obtenir une réponse.
    until curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; do
      sleep 0.005
    done
    local end=$(date +%s%N)
    kill $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
    total=$(( total + (end - start) ))
  done
  echo "$label : ~$(( total / N / 1000000 )) ms / démarrage (process -> premier 200 sur /health, moyenne sur $N)"
}

measure "node" node --experimental-strip-types --experimental-sqlite src/index.ts
measure "bun " bun run src/index.ts
