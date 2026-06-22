#!/usr/bin/env bash
# Test de charge en CONDITIONS REELLES : l'endpoint /:code lit ET écrit en base.
# Prérequis : npx autocannon (ou `bun x autocannon`).
# Usage : RUNTIME=node ./bench/load-bench.sh  |  RUNTIME=bun ./bench/load-bench.sh
set -euo pipefail
RUNTIME="${RUNTIME:-node}"
PORT=3030
if [ "$RUNTIME" = "bun" ]; then
  bun run src/index.ts &
else
  node --experimental-strip-types --experimental-sqlite src/index.ts &
fi
SRV=$!
sleep 1
# Crée un lien et récupère son code
CODE=$(curl -s -X POST "http://localhost:$PORT/api/links" \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}' | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
echo "Charge sur /$CODE (lecture+écriture BDD) — runtime=$RUNTIME"
npx autocannon -d 10 -c 50 "http://localhost:$PORT/$CODE"
kill $SRV 2>/dev/null || true
