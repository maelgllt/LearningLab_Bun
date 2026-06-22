# POC Learning Lab — Bun vs Node.js : la même API, deux runtimes

Micro-API de raccourcissement d'URL (URL shortener) **strictement identique**, exécutable
sur **Bun** et sur **Node.js**, conçue pour mesurer les gains *réels* de Bun annoncés dans la
note de cadrage : rapidité de l'outillage/CI, démarrage à froid, et débit en conditions réelles
(routage + validation + base de données).

> Pourquoi un URL shortener ? Parce qu'il exerce un vrai chemin applicatif (validation d'entrée,
> écriture et lecture SQLite à chaque requête) plutôt qu'un « Hello World » qui flatte
> artificiellement les benchmarks.

## Stack

- **Hono** comme framework HTTP — il s'exécute à l'identique sur Bun, Node et Deno.
- **Zod** pour la validation des entrées.
- **SQLite intégré au runtime** (`bun:sqlite` côté Bun, `node:sqlite` côté Node) via une fine
  couche d'adaptation (`src/db.ts`) : c'est l'unique point spécifique au runtime, et c'est en
  soi un résultat de l'étude (les clients SQLite natifs des deux runtimes ont des API différentes).

## Prérequis

- **Node.js ≥ 22.5** (pour `node:sqlite` et le *type stripping* TypeScript natif).
- **Bun ≥ 1.3** — installation : `curl -fsSL https://bun.sh/install | bash`
- Optionnel pour le test de charge : `autocannon` (via `npx autocannon`).

## Installation

```bash
git clone <URL_DU_DEPOT>
cd bun-poc-url-shortener
# Au choix :
bun install        # rapide
# ou
npm install
```

## Lancer l'application

```bash
# Sur Bun
bun run src/index.ts            # ou : npm run start:bun

# Sur Node.js
npm run start:node              # node --experimental-strip-types --experimental-sqlite src/index.ts
```

Le serveur écoute sur `http://localhost:3000` (variable `PORT` configurable).

### Essayer l'API

```bash
# Créer un lien court
curl -X POST http://localhost:3000/api/links \
  -H 'content-type: application/json' \
  -d '{"url":"https://anthropic.com"}'
# => {"code":"ab12cd","url":"...","shortUrl":"/ab12cd"}

# Suivre la redirection
curl -i http://localhost:3000/ab12cd      # => 302 + Location

# Lister les liens
curl http://localhost:3000/api/links
```

## Lancer les tests

```bash
npm run test:node     # test runner natif de Node
bun test              # test runner intégré de Bun (généralement plus rapide)
```

## Lancer les mesures (le « crash-test »)

```bash
./bench/install-bench.sh                 # temps d'install npm vs bun
./bench/coldstart-bench.sh               # temps de démarrage node vs bun
RUNTIME=node ./bench/load-bench.sh       # débit en conditions réelles (Node)
RUNTIME=bun  ./bench/load-bench.sh       # débit en conditions réelles (Bun)
```

## Comparer les images conteneur

```bash
docker build -f Dockerfile.node -t poc-node .
docker build -f Dockerfile.bun  -t poc-bun  .
docker images | grep poc-
```

## Structure

```
.
├── src/
│   ├── index.ts     # point d'entrée : détecte le runtime et démarre le serveur
│   ├── routes.ts    # routes Hono + validation Zod
│   └── db.ts        # adaptateur SQLite agnostique au runtime
├── tests/
│   └── api.test.ts  # tests d'intégration (via app.request, sans serveur réseau)
├── bench/           # scripts de mesure
├── Dockerfile.bun
└── Dockerfile.node
```
