#!/usr/bin/env bash
# Mesure le temps d'installation des dépendances : npm vs bun.
# Usage : ./bench/install-bench.sh
set -euo pipefail
echo "== npm install (cache froid) =="
rm -rf node_modules package-lock.json
time npm install --silent

echo "== bun install (cache froid) =="
rm -rf node_modules bun.lock
time bun install
