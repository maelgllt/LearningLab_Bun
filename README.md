# POC Learning Lab — Bun vs Node.js : la même API, deux runtimes

Micro-API de raccourcissement d'URL (URL shortener) **strictement identique**, exécutable
sur **Bun** et sur **Node.js**, conçue pour mesurer les gains *réels* de Bun annoncés dans la
note de cadrage : rapidité de l'outillage/CI, démarrage à froid, et débit en conditions réelles
(routage + validation + base de données).

> **Auteurs :** Maël Guilloteau & Victor Willoteaux — Module M2DFS Learning Lab.
> Ce dépôt accompagne le dossier `Dossier_LearningLab_Bun.docx` (Partie 2 : démarche R&D et POC).

---

## 1. Le projet en bref

L'idée du POC tient en une phrase : **écrire l'application une seule fois, puis l'exécuter telle
quelle sur deux runtimes différents** (Bun et Node.js), pour que la comparaison soit honnête — la
*seule* variable étant le runtime, jamais le code applicatif.

- **Pourquoi un URL shortener ?** Parce qu'il exerce un vrai chemin applicatif (validation d'entrée,
  écriture **et** lecture SQLite à chaque requête) plutôt qu'un « Hello World » qui flatte
  artificiellement les benchmarks.
- **Comment un même code tourne sur les deux ?** Grâce à trois choix :
  1. **Hono** (framework HTTP portable, standard WinterCG) s'exécute à l'identique sur Bun, Node et Deno ;
  2. les modules de test standard (`node:test`, `node:assert`) sont compris **aussi** par Bun ;
  3. les **deux seules différences réelles** (le serveur HTTP et le client SQLite) sont isolées
     derrière une petite couche d'adaptation.

> **Le « joint » entre les deux mondes :** un seul fichier contient du code spécifique au runtime,
> [`src/db.ts`](src/db.ts) (~15 lignes), qui masque `bun:sqlite` (Bun) et `node:sqlite` (Node)
> derrière une interface commune. C'est en soi un résultat de l'étude : les clients SQLite natifs
> des deux runtimes sont excellents mais **incompatibles** entre eux.

### Stack

- **Hono** — framework HTTP portable.
- **Zod** — validation des entrées.
- **SQLite intégré au runtime** (en mémoire) — `bun:sqlite` côté Bun, `node:sqlite` côté Node.

### Les routes de l'API

| Méthode & route      | Rôle                                                            |
|----------------------|----------------------------------------------------------------|
| `GET  /health`       | Vérifie que le serveur répond et **affiche le runtime détecté** |
| `POST /api/links`    | Crée un lien court (validation Zod + insertion en base)        |
| `GET  /:code`        | Redirige (302) vers l'URL d'origine + incrémente un compteur   |
| `GET  /api/links`    | Liste les liens créés                                          |

---

## 2. Tutoriel — tester le POC pas à pas

> ⏱️ **~5 minutes.** Ce tutoriel est pensé pour être suivi de bout en bout sans connaissance
> préalable de Bun. Les commandes sont données pour **Windows PowerShell** ; les équivalents
> macOS/Linux (bash) sont identiques sauf mention contraire.

### Prérequis

| Outil       | Version    | Vérifier avec        | Installer                                                            |
|-------------|------------|----------------------|---------------------------------------------------------------------|
| **Node.js** | ≥ 22.5     | `node --version`     | https://nodejs.org (LTS)                                             |
| **Bun**     | ≥ 1.3      | `bun --version`      | PowerShell : `powershell -c "irm bun.sh/install.ps1 \| iex"` — bash : `curl -fsSL https://bun.sh/install \| bash` |

> 💡 **Pas envie d'installer Bun ?** Le POC reste testable **uniquement sur Node** : suivez les
> étapes en sautant simplement les commandes marquées « (Bun) ». Mais l'intérêt de la démo est
> justement de voir le **même code** tourner sur les deux.

### Étape 1 — Récupérer le projet et installer les dépendances

```bash
git clone https://github.com/maelgllt/LearningLab_Bun.git
cd LearningLab_Bun

npm install      # avec Node/npm
# ou, plus rapide :
bun install      # (Bun)
```

### Étape 2 — Lancer le serveur

Choisissez **un** des deux runtimes (le serveur écoute sur `http://localhost:3000`) :

```bash
# Sur Node.js
npm run start:node

# Sur Bun
bun run src/index.ts        # ou : npm run start:bun
```

Vous devriez voir s'afficher, selon le runtime :

```
[node] URL shortener à l'écoute sur http://localhost:3000
[bun]  URL shortener à l'écoute sur http://localhost:3000
```

### Étape 3 — Tester l'API (dans un **second** terminal)

**Le test le plus parlant** — demander au serveur quel runtime l'exécute :

```bash
curl http://localhost:3000/health
# Node => {"status":"ok","runtime":"node"}
# Bun  => {"status":"ok","runtime":"bun"}
```

> 👉 C'est ici que la magie se voit : **la même URL `/health`** renvoie `node` ou `bun` selon le
> serveur lancé à l'étape 2, **sans qu'une ligne de code n'ait changé**.

Puis le parcours complet de l'application :

```bash
# 1) Créer un lien court (PowerShell)
curl.exe -X POST http://localhost:3000/api/links -H "content-type: application/json" -d "{\"url\":\"https://anthropic.com\"}"
# => {"code":"ab12cd","url":"https://anthropic.com","shortUrl":"/ab12cd"}

# 2) Suivre la redirection (remplacez ab12cd par le code reçu) — montre le 302 + Location
curl.exe -i http://localhost:3000/ab12cd

# 3) Lister les liens créés
curl.exe http://localhost:3000/api/links

# 4) Vérifier la validation : une URL invalide est rejetée (400)
curl.exe -X POST http://localhost:3000/api/links -H "content-type: application/json" -d "{\"url\":\"pas-une-url\"}"
# => 400 {"error":"URL invalide", ...}
```

> Sous **macOS/Linux** (bash), utilisez `curl` (sans le `.exe`) et des guillemets simples :
> `curl -X POST ... -d '{"url":"https://anthropic.com"}'`.

Arrêtez le serveur avec `Ctrl + C`.

### Étape 4 — Lancer la suite de tests (la preuve de la parité)

C'est **le même fichier de tests** ([`tests/api.test.ts`](tests/api.test.ts)) exécuté par les deux
runtimes — il doit passer **3/3** dans les deux cas :

```bash
npm run test:node     # test runner natif de Node
bun test              # test runner intégré de Bun (généralement plus rapide)
```

✅ **Si les deux affichent 3 tests au vert, le cœur du POC est validé** : une application
identique, fonctionnelle sur Bun et sur Node, avec une seule couche d'adaptation (`src/db.ts`).

---

## 3. (Optionnel) Rejouer les mesures — le « crash-test »

Les scripts de [`bench/`](bench/) reproduisent les 4 axes de mesure du dossier. Ils sont en **bash** :
sous Windows, lancez-les depuis **Git Bash** (installé avec Git).

```bash
bash bench/install-bench.sh                 # temps d'install npm vs bun
bash bench/coldstart-bench.sh               # démarrage à froid node vs bun (probe HTTP réel sur /health)
RUNTIME=node bash bench/load-bench.sh       # débit en conditions réelles (Node)
RUNTIME=bun  bash bench/load-bench.sh       # débit en conditions réelles (Bun)
```

> Les chiffres dépendent de la machine : nos relevés figurent dans
> [`bench/RESULTS.md`](bench/RESULTS.md) et [`bench/RESULTS-victor.md`](bench/RESULTS-victor.md),
> et leur lecture critique est reprise dans la **Partie 2.7** du dossier `.docx`.

### Comparer les images conteneur (si Docker est installé)

```bash
docker build -f Dockerfile.node -t poc-node .
docker build -f Dockerfile.bun  -t poc-bun  .
docker images | grep poc-
```

---

## 4. Structure du dépôt

```
.
├── src/
│   ├── index.ts     # point d'entrée : détecte le runtime et démarre le serveur (Bun.serve ou @hono/node-server)
│   ├── routes.ts    # routes Hono + validation Zod (100 % commun aux deux runtimes)
│   └── db.ts        # adaptateur SQLite — LE seul code spécifique au runtime (bun:sqlite / node:sqlite)
├── tests/
│   └── api.test.ts  # tests d'intégration (via app.request, sans serveur réseau)
├── bench/           # scripts de mesure + fiches de résultats
├── Dockerfile.bun / Dockerfile.node
└── package.json
```

| Script npm            | Action                                                                 |
|-----------------------|------------------------------------------------------------------------|
| `npm run start:node`  | Démarre le serveur sur Node.js                                         |
| `npm run start:bun`   | Démarre le serveur sur Bun                                             |
| `npm run test:node`   | Lance les tests avec le runner de Node                                 |
| `npm run test:bun`    | Lance les tests avec le runner de Bun (`bun test`)                     |

> ℹ️ Côté Node, les drapeaux `--experimental-strip-types` (exécuter du TypeScript sans build) et
> `--experimental-sqlite` (activer `node:sqlite`) sont nécessaires — Bun fait les deux nativement,
> sans configuration. C'est l'un des arguments « DX » du dossier.
