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

---

# Dossier Learning Lab — Bun, du runtime émergent au transfert de compétences

*Module : M2DFS — Learning Lab*
*Auteurs : Maël GUILLOTEAU & Victor WILLOTEAUX*
*Technologie étudiée : Bun (runtime JavaScript / TypeScript tout-en-un)*
*Date : 22-24 Juin 2026*

Nous avons utilisé Claude comme aide à la rédaction du dossier et au développement du POC.

---

## Partie 1 — Note de cadrage stratégique

### 1.1 Introduction et contexte

#### La technologie

Bun est un runtime JavaScript et TypeScript pensé comme un remplaçant direct (« drop-in replacement ») de Node.js. Il se distingue par deux choix techniques. D'un côté, Node.js et Deno utilisent le moteur V8 (Chromium) ; Bun, lui, s'appuie sur JavaScriptCore, le moteur de Safari, connu pour ses temps de démarrage très rapides. De l'autre, Bun ne se limite pas au runtime : un seul binaire natif réunit le gestionnaire de paquets, le bundler, le transpiler et le test runner. Là où une équipe Node assemble historiquement une quinzaine d'outils (npm, webpack, babel, jest, ts-node, nodemon…), Bun propose une chaîne intégrée.

Le projet, créé par Jarred Sumner, a connu sa première version publique en septembre 2021, a atteint sa version 1.0 stable en septembre 2023, et publie à la mi-2026 des versions de la lignée 1.3. Il est distribué en open source sous licence MIT.

#### Le besoin entreprise

Pour ancrer l'étude dans un cas concret, on se place du point de vue de l'équipe d'ingénierie d'une entreprise qui édite une application web à fort trafic : une vingtaine de développeurs, un back-end fait de microservices Node.js conteneurisés et orchestrés sur Kubernetes, et un déploiement partiel de fonctions serverless. Cette équipe rencontre trois problèmes récurrents :

- **Une chaîne d'outillage lourde et lente.** L'installation des dépendances rallonge chaque pipeline d'intégration continue (CI), et la multiplication des fichiers de configuration (transpilation TypeScript, bundling, tests) alourdit la maintenance.
- **Une facture cloud qui grimpe.** La consommation CPU/mémoire des services et les démarrages à froid des fonctions serverless pèsent directement sur les coûts d'infrastructure.
- **Un coût d'entrée élevé pour les nouveaux arrivants**, qui doivent configurer un environnement complexe avant d'être productifs.

Question décisionnelle posée à la direction technique : *Bun peut-il réduire le temps de CI, simplifier la chaîne d'outillage et abaisser les coûts d'infrastructure, sans imposer une migration risquée de tout le parc applicatif ?*

#### Justification de l'étude

Bun mérite une veille structurée pour trois raisons. C'est une technologie émergente mais déjà adoptée en production par des acteurs de référence, ce qui la sort du statut de simple curiosité. Elle promet des gains mesurables sur des postes de coût bien identifiés (CI/CD, infrastructure). Enfin, son adoption peut être incrémentale : `bun install` ou `bun test` s'utilisent dans un projet Node existant sans bascule complète, ce qui rend l'expérimentation peu risquée — un atout décisif pour convaincre une direction prudente.

### 1.2 Argumentaire décisionnel — les gains attendus

#### Performance et coûts d'infrastructure

C'est l'argument le plus médiatisé de Bun, et celui qui demande le plus de prudence. Sur des benchmarks synthétiques (« Hello World » HTTP), Bun affiche un débit 2,8 à 4 fois supérieur à Node.js — par exemple environ 50 000 requêtes/seconde contre 14 000 pour Node dans certains tests de 2026. Le démarrage est aussi bien plus rapide : un cold start de 8 à 15 ms pour Bun, contre 60 à 120 ms pour Node.js, ce qui se traduit directement en facturation moindre sur des fonctions serverless de type Lambda.

**Attention :** ces écarts spectaculaires viennent de tests qui isolent le runtime. En conditions réelles, dès qu'on ajoute le routage, la validation et surtout les accès à une base de données, l'écart se resserre fortement — plusieurs analyses indépendantes de 2026 mesurent des performances quasi identiques entre les trois runtimes une fois la logique métier prise en compte. L'explication est architecturale : JavaScriptCore optimise le démarrage, V8 optimise les processus longs ; dans une application réelle, ces différences deviennent secondaires. Le gain réel et reproductible de Bun se situe donc moins dans le débit applicatif que dans la rapidité de l'outillage et des démarrages à froid. C'est là que notre POC concentre ses mesures.

#### Maintenabilité et productivité (DX)

C'est, à notre sens, le gain le plus solide. L'installation des dépendances est massivement accélérée : sur un monorepo, `bun install` se mesure en secondes là où `npm install` demande plusieurs dizaines de secondes ; sur un projet de près de 1 800 dépendances, des tests rapportent ~47 secondes pour Bun contre plusieurs minutes (voire dizaines de minutes) pour npm. Des retours d'expérience publiés en 2026 font état d'environ 60 % de temps de CI/CD économisé après bascule de l'outillage. Au-delà de la vitesse, le binaire unique réduit la charge cognitive : TypeScript s'exécute nativement sans étape de build, et toute une catégorie de fichiers de configuration disparaît. Un nouvel arrivant peut cloner un dépôt, lancer `bun install` puis les tests en quelques secondes.

#### Scalabilité et empreinte

Bun a une empreinte réduite, ce qui est un atout pour les architectures distribuées. L'image conteneur officielle est plus légère que son équivalent Node (environ 130 Mo contre 180 Mo), et la consommation mémoire est inférieure — certaines sources évoquent jusqu'à 40 % de RAM en moins pour un microservice équivalent, grâce à la stratégie de garbage collection de JavaScriptCore. Conteneurs plus légers et démarrage rapide signifient un scheduling plus rapide sur Kubernetes et une meilleure adéquation aux environnements edge et serverless.

#### Sécurité — un point de vigilance, pas un gain

Soyons honnêtes : la sécurité n'est pas un argument en faveur de Bun. Contrairement à Deno, qui impose un modèle de permissions « refus par défaut » (aucun accès au système de fichiers, au réseau ou aux variables d'environnement sans autorisation explicite), et contrairement à Node.js qui a introduit son propre Permission Model, Bun ne dispose pas à ce jour de bac à sable ni de modèle de permissions natif. Dans un contexte sensible aux attaques de la chaîne d'approvisionnement (supply chain), c'est une limite à assumer.

### 1.3 Analyse comparative de l'écosystème

#### Maturité de la technologie

Bun a franchi en 2025-2026 plusieurs jalons qui changent son profil de risque. En décembre 2025, le projet a été racheté par Anthropic (l'éditeur de Claude), qui l'utilise pour soutenir Claude Code et son SDK d'agents. Ce rachat apporte des ressources solides et accélère le développement, tout en gardant le projet open source sous licence MIT.

Le second jalon est plus ambivalent. En mai 2026, l'équipe a réécrit Bun du langage Zig vers Rust — plus d'un million de lignes de code, produites quasi intégralement par des agents IA (Claude Code) en quelques jours, et passant 99,8 % de la suite de tests existante. La motivation affichée est la sûreté mémoire (Rust offre des garanties à la compilation que Zig laisse au développeur). Mais cette prouesse demande un regard critique : le portage contient, selon les analyses, plus de 10 000 blocs `unsafe`, n'a pas été intégralement relu par des humains, et soulève des questions sur la maintenabilité à long terme et sur une forme de dépendance forte aux outils d'IA d'Anthropic. La maturité fonctionnelle de Bun est donc réelle, mais son socle technique vient de changer profondément, et tous les effets de bord ne sont pas encore connus.

#### Taille et dynamique de la communauté

L'écart avec Node.js reste important mais se réduit. Le dépôt de Bun rassemble environ 92 000 étoiles GitHub, contre environ 117 000 pour Node.js, et le paquet `bun` dépasse 1,5 million de téléchargements hebdomadaires sur npm à la mi-2026. Côté adoption professionnelle, Node.js domine toujours très largement (cité par environ 43 % des développeurs dans les grandes enquêtes, environ 85 % du trafic en entreprise), tandis que les runtimes alternatifs restent minoritaires. La liste des utilisateurs en production de Bun est néanmoins crédible : Figma, le New York Times, Slack, Intercom, Cursor, Midjourney, Railway, ou encore la CLI de Tailwind et Claude Code lui-même.

#### Positionnement face à Node.js et Deno

Le paysage 2026 tient en trois approches : **Node.js**, le choix de la stabilité (plus de 2 millions de paquets npm, support LTS, écosystème d'observabilité mature, addons natifs C++) ; **Deno**, le choix de la sécurité (permissions par défaut, TypeScript natif, registre JSR) ; **Bun**, le choix de la performance et de l'expérience développeur. Point de convergence important : sous l'égide du WinterCG, les trois runtimes s'alignent sur les mêmes API web standard (fetch, Request/Response…), si bien qu'un code écrit avec un framework pensé pour la portabilité comme Hono s'exécute à l'identique sur les trois. La compatibilité npm de Bun est élevée (les paquets JS/TS les plus téléchargés fonctionnent), mais elle bute encore sur la longue traîne : les modules natifs N-API et les bibliothèques qui s'appuient sur des détails internes non documentés de Node restent les principaux points de friction.

#### Matrice SWOT

| Forces | Faiblesses |
| --- | --- |
| Vitesse de l'outillage (installs, CI/CD) et démarrages à froid très rapides | Absence de modèle de permissions / bac à sable (sécurité en retrait vs Deno et Node) |
| Chaîne tout-en-un dans un seul binaire → moins de configuration | Compatibilité Node incomplète sur la longue traîne (addons natifs N-API) |
| TypeScript natif sans étape de build | Écosystème d'observabilité/APM (Datadog, New Relic…) encore émergent pour Bun |
| Empreinte mémoire et conteneur réduites | Communauté et volume de tutoriels plus restreints que Node |
| Compatibilité Node élevée → adoption incrémentale, faible risque | Dette de maintenabilité du portage Rust (>10 000 blocs `unsafe`, peu relu) |

| Opportunités | Menaces |
| --- | --- |
| Soutien d'Anthropic : ressources, cadence, viabilité long terme | Inertie et domination de Node.js (LTS, écosystème, profondeur npm) |
| Adéquation forte aux usages edge / serverless en croissance | Node.js rattrape (TypeScript natif, test runner, Permission Model) |
| Frameworks pensés pour Bun (Hono, Elysia) et convergence WinterCG | Risque de gouvernance / vendor lock-in (Bun désormais propriété d'Anthropic) |
| Gains CI/CD captables sans migration runtime complète | Incertitudes de stabilité après la mutation Zig → Rust |

#### Conclusion du cadrage

Bun n'est ni la « solution miracle » de ses promoteurs ni le pari irréaliste de ses détracteurs. Pour notre cas d'usage, la recommandation raisonnée est une adoption ciblée et incrémentale : commencer par capter les gains les plus sûrs et les moins risqués — l'accélération de l'outillage et de la CI/CD, et l'amélioration des démarrages à froid sur le serverless — avant d'envisager toute bascule du runtime de production. C'est cette hypothèse que la preuve de concept (Partie 2) vient éprouver en conditions réelles, chiffres à l'appui.

### Sources & références — Partie 1

- Bun — site et documentation officiels : <https://bun.com/> et <https://github.com/oven-sh/bun>
- Bun (software) — Wikipedia (historique, acquisition Anthropic, réécriture Rust) : <https://en.wikipedia.org/wiki/Bun_(software)>
- The Register — *Anthropic's Bun Rust rewrite merged at speed of AI* (mai 2026) : <https://www.theregister.com/devops/2026/05/14/anthropics-bun-rust-rewrite-merged-at-speed-of-ai/>
- bytecode.news — *Bun Has Been Converted to Rust. Now What?* (analyse critique du portage)
- daily.dev — *Bun vs Node.js vs Deno: Which Runtime in 2026?*
- byteiota — *Bun vs Deno vs Node.js 2026: Real Benchmarks Mislead* (écart synthétique vs réel)
- Strapi — *Bun vs Node.js in 2026: Benchmarks & Migration Guide*
- endoflife.date — *Bun* (cycle de versions) : <https://endoflife.date/bun>

---

## Partie 2 — Démarche R&D et preuve de concept

### 2.1 Objectif et choix du cas d'usage

La Partie 1 a conclu que le gain le plus sûr et le plus reproductible de Bun ne se situe pas dans le débit applicatif brut — qui s'érode en conditions réelles — mais dans la rapidité de l'outillage (installs, CI/CD) et dans les démarrages à froid. Notre preuve de concept n'a donc pas pour but de « prouver que Bun est rapide », mais de vérifier objectivement cette hypothèse et d'en mesurer la portée.

Le cas d'usage retenu est une micro-API de raccourcissement d'URL (URL shortener). Ce choix est délibéré : plutôt qu'un « Hello World » qui flatte artificiellement les benchmarks, le raccourcisseur exerce un vrai chemin applicatif — validation des entrées, écriture et lecture en base de données à chaque requête. C'est exactement ce que recommandent les analyses critiques de 2026 pour éviter de tirer des conclusions de tests synthétiques trompeurs.

Le principe directeur du POC est la **stricte identité du code** : la même application est exécutée sur Bun et sur Node.js, pour que la comparaison soit honnête et que la seule variable soit le runtime.

### 2.2 Architecture du POC

| Composant | Choix | Justification |
| --- | --- | --- |
| Framework HTTP | Hono | S'exécute à l'identique sur Bun, Node et Deno (portabilité WinterCG) ; permet de tester le même code sur deux runtimes. |
| Validation | Zod | Standard de l'écosystème ; exerce la couche « logique métier » de la requête. |
| Persistance | SQLite intégré au runtime | `bun:sqlite` côté Bun, `node:sqlite` côté Node — aucun module natif tiers, donc installation sans friction. |
| Langage | TypeScript exécuté nativement | Bun lit le `.ts` directement ; Node 22 fait de même via le type stripping (`--experimental-strip-types`). |

L'application expose quatre routes : `GET /health`, `POST /api/links` (création, avec validation), `GET /:code` (redirection 302 + incrément d'un compteur), `GET /api/links` (liste).

Un résultat émerge dès la conception. Pour faire tourner exactement le même applicatif sur les deux runtimes, un seul fichier contient du code spécifique au runtime : `src/db.ts`, l'adaptateur SQLite (≈ 15 lignes). C'est le « joint » entre les deux mondes — et c'est en soi une conclusion de la veille : les clients SQLite natifs de Bun et de Node sont tous deux excellents mais incompatibles entre eux, ce qui illustre concrètement la limite de portabilité vue en Partie 1 (les API spécifiques à un runtime, et a fortiori les modules natifs N-API, demandent une couche d'abstraction).

### 2.3 Accessibilité du code (dépôt GitHub)

- Dépôt GitHub : <https://github.com/maelgllt/LearningLab_Bun>

### 2.4 Viabilité technique : ce qui a été testé

Le POC a été exécuté de bout en bout sur les deux runtimes, Node.js 22 et Bun 1.3, par les deux auteurs et sur deux machines distinctes (les relevés figurent au § 2.7). Le même applicatif Hono tourne à l'identique ; seul l'adaptateur SQLite (`bun:sqlite` / `node:sqlite`) diffère.

Comportements vérifiés sur les deux runtimes :

| Scénario | Résultat observé | Vérifié |
| --- | --- | --- |
| `POST /api/links` avec une URL valide | 201 Created + `{ code, url, shortUrl }` | ✅ |
| `GET /:code` | 302 Found + en-tête `Location` correct | ✅ |
| Effet de bord du clic | le compteur `hits` s'incrémente en base | ✅ |
| `POST /api/links` avec une URL invalide | 400 + détail de l'erreur Zod | ✅ |
| `GET /api/links` | liste JSON des liens | ✅ |
| Suite de tests d'intégration | 3/3 tests au vert (`node --test` et `bun test`) | ✅ |

La présence d'une base SQLite réelle et de la validation Zod garantit que les futures mesures de charge reflètent bien des conditions réelles et non un débit creux.

### 2.5 Le « crash-test » : méthodologie de mesure

Les scripts du dossier `bench/` permettent de produire des chiffres reproductibles sur votre machine, sur quatre axes :

- **Temps d'installation des dépendances** — `bench/install-bench.sh` chronomètre `npm install` puis `bun install` à cache froid. C'est l'axe où le gain de Bun est le plus net et le plus reproductible.
- **Démarrage à froid** — `bench/coldstart-bench.sh` mesure le temps de mise en route du processus sur le même code, pour `node` puis `bun`.
- **Débit en conditions réelles** — `bench/load-bench.sh` envoie une charge (via `autocannon`) sur la route `/:code` qui lit et écrit en base. C'est l'axe où l'on s'attend à voir l'écart synthétique se resserrer.
- **Empreinte conteneur** — `docker build` avec `Dockerfile.bun` et `Dockerfile.node`, puis comparaison des tailles d'image.

### 2.6 Matrice objective avantages / inconvénients

Le tableau ci-dessous croise nos attentes (issues de la veille 2026) et le statut de la mesure. Les valeurs sont des ordres de grandeur de la littérature, à confirmer par vos propres relevés ; c'est le sens même du crash-test. Nos relevés réels figurent au § 2.7.

| Critère | Node.js (référence) | Bun (attendu) | Lecture |
| --- | --- | --- | --- |
| Installation des dépendances | baseline | ~10–20× plus rapide | Avantage Bun net — gain CI/CD direct |
| Démarrage à froid | ~60–120 ms | ~8–15 ms | Avantage Bun — pertinent en serverless |
| Débit HTTP synthétique | baseline | ~2,8–4× | Avantage Bun, mais peu représentatif |
| Débit en conditions réelles (avec BDD) | baseline | écart faible, parfois quasi nul | Prédiction infirmée par nos mesures : Bun garde ~2,6–2,7× même avec SQLite (en mémoire, trop rapide pour masquer l'overhead du runtime). Cf. § 2.7. |
| Empreinte mémoire | baseline | jusqu'à ~40 % de moins | Avantage Bun (variable selon la charge) |
| Image conteneur | ~180 Mo | ~130 Mo | Avantage Bun — mesuré 258 Mo vs 353 Mo sur bases `-slim` (cf. § 2.7). |
| Exécution TypeScript native | oui (type stripping, Node 22+) | oui, sans configuration | Quasi-parité en 2026 |
| Portabilité du code applicatif | — | identique via Hono | Constaté : seul `db.ts` diffère |
| Client SQLite intégré | `node:sqlite` (expérimental) | `bun:sqlite` (mature) | API différentes → couche d'adaptation nécessaire |
| Modèle de permissions / bac à sable | Permission Model | absent | Inconvénient Bun (cf. Deno) |
| Écosystème observabilité (APM) | mature | émergent | Inconvénient Bun |
| Modules natifs N-API | référence | friction sur la longue traîne | Inconvénient Bun à tester selon vos dépendances |

**Synthèse du crash-test.** Le POC confirme par la pratique la thèse de cadrage : la même application web tourne sans réécriture sur les deux runtimes (seules ~15 lignes d'adaptation SQLite diffèrent), les gains d'outillage et de démarrage sont francs et faciles à objectiver, tandis que l'avantage de débit s'estompe dès qu'une base de données entre en jeu. La recommandation d'une adoption ciblée et incrémentale (outillage et CI d'abord, runtime de production ensuite) sort donc renforcée.

### 2.7 Résultats réels du crash-test (nos relevés)

Fidèles au principe « on mesure, on ne récite pas », cette section présente nos relevés réels, produits par les scripts de `bench/` le 22 juin 2026 sur deux machines distinctes :
- **Maël** : Intel Core i7-11800H, 16 threads, Windows 11 ; Node 22.19, Bun 1.3.14
- **Victor** : AMD Ryzen 5 3600, 12 threads, Windows 10 ; Node 22.13, Bun 1.3.14

Le détail complet figure dans `bench/RESULTS.md` et `bench/RESULTS-victor.md` du dépôt.

| Mesure | Node.js (Maël / Victor) | Bun (Maël / Victor) | Écart constaté |
| --- | --- | --- | --- |
| Suite de tests (intégration) | 3/3 ✅ / 3/3 ✅ | 3/3 ✅ / 3/3 ✅ | Parité fonctionnelle totale sur les deux machines |
| Installation des dépendances (cache froid) | 3,19 s / 3,23 s | 2,39 s / 3,38 s | Bun ~25 % plus rapide chez Maël ; avantage qui disparaît voire s'inverse chez Victor — gain fragile sur un POC à 3 dépendances |
| Démarrage à froid (process → 1er 200 sur `/health`) | ~273 ms / ~301 ms | ~270 ms / ~285 ms | Quasi identique — artefact Windows ; l'avantage cold-start de Bun est un phénomène serverless/Linux |
| Débit sur `/:code` (lecture + écriture BDD) | ~14 768 req/s / ~9 243 req/s | ~37 849 req/s / ~25 195 req/s | Bun ~2,6× (Maël) et ~2,7× (Victor) — le **ratio** se reproduit, pas les valeurs absolues |
| Taille de l'image conteneur (`-slim`) | 353 Mo / non mesuré | 258 Mo / non mesuré | Bun ~27 % plus légère (Docker absent du poste de Victor) |

**Lecture critique de nos mesures.**

- **Tests — parité totale.** La même application passe 3/3 sur Node et sur Bun, sur les deux machines, sans réécriture : seules les ~15 lignes de `src/db.ts` diffèrent. La portabilité annoncée en Partie 1 est confirmée indépendamment du poste.
- **Installation — gain réel mais fragile.** Net chez Maël (~25 %), il s'inverse chez Victor (premier `bun install` à cache global froid alors que le cache npm était déjà chaud ; et sur 3 dépendances l'écart tient dans le bruit de mesure). Le ×10–20 de la littérature est un effet « gros monorepo » : à ne pas extrapoler depuis un micro-projet.
- **Démarrage à froid — quasi nul sur ce poste.** Contre-intuitif face aux 8–15 ms annoncés : sous Windows, le chrono est dominé par le coût de spawn du process et du probe `curl`, pas par le runtime. L'avantage cold-start de Bun se révèle en conditions edge/serverless (Lambda, Linux) — à remesurer là avant d'en faire un argument.
- **Débit — Bun nettement devant, même avec base de données.** C'est le résultat le plus robuste : le rapport ~2,6–2,7× se reproduit à l'identique sur les deux machines, alors que les valeurs absolues, elles, dépendent du matériel (toutes plus basses sur le Ryzen plus ancien). Nuance : SQLite est ici en mémoire, donc trop rapide pour masquer l'overhead du runtime ; avec une base réseau (Postgres distant), la latence I/O deviendrait limitante et l'écart se resserrerait. Ce chiffre reflète un SQLite local, pas une stack de production typique — et il infirme la prédiction « écart quasi nul avec BDD » attendue dans la matrice ci-dessus.
- **Conteneur — Bun plus léger, et un bug réel corrigé.** 258 Mo contre 353 Mo (~27 % de moins), à partir des bases `-slim` officielles ; ces valeurs dépassent les ordres de grandeur de la note de cadrage (~130/180 Mo) car `-slim` est plus lourd qu'une base Alpine. Au passage, `@hono/node-server` (requis au runtime côté Node) était déclaré en `devDependency` : avec `npm install --omit=dev`, l'image Node crashait (`ERR_MODULE_NOT_FOUND`) ; déplacé en `dependencies`, elle sert désormais correctement. Illustration concrète du « joint » runtime : Bun n'a pas besoin de ce paquet (`Bun.serve`), Node si.

**Verdict.** Nos mesures confirment la thèse de cadrage et la précisent : ce qui se transfère d'une machine à l'autre, c'est le **rapport** entre runtimes (débit ~2,6–2,7×), pas les valeurs absolues ; le gain d'installation, lui, s'est révélé fragile au point de s'inverser sur un micro-projet. Le gain le plus sûr et le plus universel reste l'outillage / CI / DX ; débit et démarrage à froid sont réels mais contextuels (charge, base de données, environnement de déploiement). Adoption ciblée et incrémentale, à objectiver service par service.

### 2.8 Documentation technique (guide d'installation)

Le **tutoriel pas à pas en haut de ce README** (section 2) sert de guide complet : prérequis, installation, lancement sur les deux runtimes, et exécution des tests. La section 3 décrit les scripts du « crash-test ». Reportez-vous à ces sections pour l'aspect pratique.

---

## Partie 3 — Étude budgétaire et d'adoption

La particularité budgétaire de Bun est qu'il ne coûte presque rien en dépenses directes : c'est un logiciel libre. Le vrai coût est humain et ponctuel, et il se compare à des économies récurrentes. Cette partie chiffre les deux côtés de la balance et conclut sur un retour sur investissement.

### 3.0 Hypothèses de calcul

Pour rester transparents, tous les chiffres reposent sur les hypothèses suivantes (à recalibrer avec vos mesures du POC de la Partie 2) :

| Hypothèse | Valeur retenue | Source / justification |
| --- | --- | --- |
| Taille de l'équipe | 20 développeurs | Contexte de la Partie 1 |
| Coût complet employeur | 500 €/jour/dev (~110 k€/an) | Salaire back-end confirmé Île-de-France ~55–65 k€ + charges (~45 %) + frais ; cohérent avec un TJM freelance confirmé de 483–667 €/jour à Paris |
| Jours travaillés | ~218 jours/an | Standard du marché français |
| Coût CI | runner GitHub Actions Linux 2 cœurs à 0,006 $/min (~0,0055 €) | Tarif GitHub depuis le 1ᵉʳ janvier 2026 (baisse de ~39 %) |
| Licence Bun | 0 € | MIT, gratuit ; reste open source après le rachat par Anthropic |

### 3.1 Coûts directs

| Poste | Coût | Commentaire |
| --- | --- | --- |
| Licence logicielle Bun | 0 € | Open source MIT, sans édition payante |
| Matériel | 0 € | Tourne sur les postes et serveurs existants ; aucun achat |
| Abonnements / SaaS spécifiques | 0 € | Aucun service propriétaire requis |
| Compute CI/CD | économie (voir § 3.3) | `bun install` raccourcit fortement chaque pipeline |
| Infrastructure cloud (runtime) | économie potentielle (phase 2) | Empreinte mémoire et démarrages à froid réduits sur les services migrés |
| Observabilité / APM | surcoût possible, faible | Le support de Bun par Datadog/New Relic est encore émergent : prévoir un effort d'instrumentation, voire un outil d'appoint |

En clair, la seule ligne de coût direct potentiellement positive est l'observabilité ; toutes les autres sont nulles ou génératrices d'économies. C'est un argument fort face à une direction technique.

### 3.2 Coûts indirects (investissement ponctuel)

C'est ici que se concentre le vrai budget. Nous le découpons selon la recommandation d'adoption incrémentale des parties précédentes.

**Phase 1 — Outillage et CI (faible risque)**

| Poste | Charge | Coût |
| --- | --- | --- |
| Formation de l'équipe (~1 j/dev : auto-formation + atelier Learning Lab) | 20 j | 10 000 € |
| Migration de l'outillage et des pipelines CI vers `bun install` / `bun test` | 10 j | 5 000 € |
| Validation de compatibilité de l'arbre de dépendances (dont modules natifs N-API) | 8 j | 4 000 € |
| **Sous-total Phase 1** | **38 j** | **19 000 €** |

**Phase 2 — Pilote runtime sur services non critiques (ciblée)**

| Poste | Charge | Coût |
| --- | --- | --- |
| Migration de 2–3 services + couches d'adaptation spécifiques au runtime | 20 j | 10 000 € |
| Provision pour débogage d'incompatibilités « longue traîne » | 5 j | 2 500 € |
| **Sous-total Phase 2** | **25 j** | **12 500 €** |

**Investissement total ponctuel : ~63 jours-homme, soit ≈ 31 500 €.**

### 3.3 Analyse d'impact : courbe d'apprentissage et productivité

#### Courbe d'apprentissage : douce

C'est l'atout décisif de Bun sur le plan de l'adoption. Comme c'est un remplaçant « drop-in » de Node.js, l'équipe ne change pas de langage (JavaScript/TypeScript), pas d'écosystème (npm), pas de frameworks. La montée en compétence se mesure en jours, là où l'adoption d'un paradigme réellement nouveau (Rust, Go, un modèle d'acteurs…) se mesurerait en semaines voire en mois. La plupart des développeurs sont opérationnels après une journée, ce qui justifie l'enveloppe de formation très réduite du § 3.2.

#### Impact transitoire sur la productivité : limité et maîtrisé

Grâce à l'approche incrémentale, il n'y a pas de « big-bang » : on garde Node en production pendant que l'on bascule l'outillage. Le seul creux de productivité attendu est ponctuel — phase de validation des dépendances et débogage occasionnel des cas limites (un retour d'expérience public de 2026 évoque, par exemple, deux semaines de blocage sur un middleware d'authentification incompatible). C'est précisément ce que couvre la provision de la Phase 2.

#### Gain de productivité récurrent

Une fois la bascule faite, le gain est permanent et porte sur le temps d'attente des développeurs : installations quasi instantanées en local, et retours de CI plus rapides (donc moins de changements de contexte). Les retours de terrain de 2026 font état d'environ 60 % de temps de CI/CD économisé après bascule de l'outillage.

Une estimation prudente : si chaque développeur économise ne serait-ce que 10 minutes par jour d'attente (installs + feedback CI), cela représente environ 36 h/an/dev, soit ~5 jours/an/dev. Pour 20 développeurs, ~100 jours-homme par an, soit ≈ 50 000 €/an de capacité rendue à l'équipe. Même en divisant cette estimation par deux pour rester conservateur, le gain annuel dépasse l'investissement initial.

À cela s'ajoute l'économie directe — plus modeste — sur le compute CI : en supposant ~2 000 exécutions de pipeline par mois et ~2,5 min gagnées par exécution sur l'étape d'installation, on économise ~5 000 min/mois, soit ~330 €/an de compute. Le compute n'est donc pas le vrai gisement : le gain dominant est le temps humain.

### 3.4 Synthèse : retour sur investissement

| Élément | Montant | Nature |
| --- | --- | --- |
| Coûts directs (licences, matériel, abonnements) | 0 € | — |
| Investissement humain ponctuel (Phases 1 + 2) | ≈ 31 500 € | one-shot |
| Gain de productivité récurrent (estimation prudente) | ≈ 25 000 – 50 000 €/an | récurrent |
| Économie de compute CI | ≈ 330 €/an | récurrent |
| Économie cloud runtime (services migrés) | à mesurer (Phase 2) | récurrent |
| **Délai de retour sur investissement** | **< 12 mois** | — |

**Conclusion budgétaire.** L'adoption de Bun ne pose pas un problème de coût d'acquisition (quasi nul) mais un problème de coût de transition, modéré et borné (~31,5 k€), face à des gains récurrents qui le couvrent en moins d'un an. Le risque financier est faible parce que l'adoption est réversible et progressive : si la Phase 1 ne tient pas ses promesses sur vos mesures réelles, l'investissement engagé reste limité (~19 k€) et l'on peut s'arrêter avant la Phase 2. C'est un profil de décision « à faible risque, à gain asymétrique » — exactement ce qu'une direction technique prudente peut valider.

### Sources & références — Partie 3

- Coût employeur / salaires développeurs back-end France 2026 : Glassdoor, talent.io, APEC, et synthèses 2026 (welovedevs, cocowork, licornesociety) — back-end confirmé ~48–65 k€, Node.js senior ~65 k€, TJM freelance confirmé 420–667 €/jour.
- Tarifs GitHub Actions 2026 : <https://docs.github.com/en/billing/reference/actions-runner-pricing> (Linux 2 cœurs à 0,006 $/min depuis le 1ᵉʳ janvier 2026).
- Bun, licence MIT et statut open source post-acquisition : <https://en.wikipedia.org/wiki/Bun_(software)>
- Retours d'expérience de migration (gains CI/CD, cas d'incompatibilité) : analyses comparatives 2026 (Strapi, jsmanifest, byteiota).

---

## Partie 4 — Ingénierie pédagogique

Cette partie conçoit l'atelier de transfert de compétences : ce que les pairs doivent savoir faire, comment l'atelier se déroule, et l'exercice pratique guidé (Coding Kata) qui leur fait manipuler Bun. Le fil conducteur : on n'apprend pas Bun en l'écoutant décrire, on l'apprend en mesurant. L'atelier s'appuie donc directement sur le POC de la Partie 2.

### 4.1 Public, prérequis et format

- **Public :** des pairs développeurs, à l'aise en JavaScript/TypeScript et habitués à Node.js. Aucune connaissance préalable de Bun n'est requise.
- **Format :** atelier de 2 heures, en présentiel ou visio, travail en binômes (cohérent avec le cadre « individuel ou binôme » du module).
- **Prérequis participants :** un poste avec Node.js ≥ 22.5 et un accès internet ; Docker optionnel (pour la comparaison d'images conteneur). Le dépôt du POC (`LearningLab_Bun`) est distribué à l'avance.
- **Matériel animateur :** le dépôt du POC, un support de présentation, et la fiche de résultats (§ 4.4) imprimée ou partagée.

### 4.2 Objectifs pédagogiques

À l'issue de l'atelier, chaque participant est capable de :

| # | Compétence visée | Niveau |
| --- | --- | --- |
| O1 | Expliquer ce qu'est Bun et le situer face à Node.js et Deno (runtime tout-en-un, moteur JavaScriptCore, « drop-in » de Node). | Savoir |
| O2 | Installer Bun et exécuter un script TypeScript sans configuration ni étape de build. | Savoir-faire |
| O3 | Utiliser Bun comme gestionnaire de paquets et test runner dans un projet existant (`bun install`, `bun test`). | Savoir-faire |
| O4 | Lancer une même application sur Node et sur Bun, et produire des mesures comparatives (installation, démarrage, charge). | Savoir-faire |
| O5 | Distinguer les gains réels (outillage, CI, démarrage à froid) des écarts « marketing » qui s'estompent en conditions réelles. | Esprit critique |
| O6 | Identifier les points de friction (modules natifs N-API, API spécifiques au runtime, absence de modèle de permissions). | Esprit critique |
| O7 | Formuler une recommandation d'adoption argumentée, adaptée à un contexte donné. | Posture |

### 4.3 Scénarisation de l'atelier

Déroulé alternant apports théoriques, démonstrations et pratique :

| Temps | Séquence | Format | Objectif |
| --- | --- | --- | --- |
| 0:00 – 0:10 | Accroche : le coût caché de l'outillage JS (CI lente, factures cloud, config qui s'empile). Pourquoi on a regardé Bun. | Apport | Contexte |
| 0:10 – 0:25 | Bun, c'est quoi et d'où ça vient ? Runtime tout-en-un, JavaScriptCore, positionnement vs Node/Deno. Actualité (rachat par Anthropic, réécriture en Rust) présentée avec recul critique. | Apport | O1 |
| 0:25 – 0:35 | Démo live : installer Bun, exécuter un `.ts` directement, `bun install` quasi instantané. | Démo | O2, O3 |
| 0:35 – 0:50 | Gains réels vs marketing : benchmarks synthétiques vs conditions réelles, SWOT express, le point sécurité (pas de modèle de permissions). | Apport | O5, O6 |
| 0:50 – 1:00 | Démo : le POC URL shortener tourne à l'identique sur Node et sur Bun (seul `db.ts` diffère). | Démo | O4 |
| 1:00 – 1:40 | Coding Kata en binômes : « Migrez et mesurez » (§ 4.4). | Pratique | O2 → O6 |
| 1:40 – 1:55 | Restitution & débat : on met en commun les chiffres, puis « on adopte ? si oui, où ? ». | Échange | O5, O7 |
| 1:55 – 2:00 | Projection & ressources : Bun dans 3 ans, dev assisté par IA, où aller plus loin. | Apport | O7 |

### 4.4 Support d'exercice pratique — Coding Kata « Migrez et mesurez »

**Mise en situation.** Vous êtes l'équipe plateforme. On vous confie un micro-service Node existant — l'URL shortener du POC. Votre mission : déterminer, chiffres en main, si Bun mérite d'entrer dans votre chaîne, et à quelles conditions.

**Durée :** 40 minutes, en binômes. **Livrable :** la fiche de résultats remplie + une phrase de recommandation.

#### Étapes guidées

| Étape | Action | Résultat attendu |
| --- | --- | --- |
| 0. Préparation (5 min) | Cloner le dépôt. Installer Bun : `curl -fsSL https://bun.sh/install \| bash`. | `bun --version` répond. |
| 1. Baseline Node (5 min) | Chronométrer `npm install`. Lancer `npm run start:node`. Créer un lien via `curl` puis tester la redirection. | Le service répond ; temps d'install noté. |
| 2. Bascule Bun (5 min) | Chronométrer `bun install`. Lancer `bun run src/index.ts`. Refaire le même test `curl`. | Même application, même comportement ; install nettement plus rapide. Constat clé : c'est le même code. |
| 3. Mesures (12 min) | Exécuter `./bench/install-bench.sh`, `./bench/coldstart-bench.sh`, puis `RUNTIME=node ./bench/load-bench.sh` et `RUNTIME=bun ./bench/load-bench.sh`. Reporter dans la fiche. | Fiche de résultats remplie. |
| 4. Un vrai dev (5 min) | Ajouter une règle de validation dans `routes.ts` (ex. refuser les URL non https). Lancer `bun test` puis `npm run test:node`. | La feature marche sur les deux ; comparaison de la vitesse des deux test runners. |
| 5. Le piège (5 min) | Ouvrir `src/db.ts` : pourquoi deux chemins (`bun:sqlite` vs `node:sqlite`) ? Tenter d'introduire une dépendance à module natif (ex. `better-sqlite3`) et observer le comportement sur Bun. | Découverte par la pratique de la friction de compatibilité : réelle, mais localisée et contournable. |
| 6. Débrief (3 min) | Compléter la colonne « verdict » de la matrice ; rédiger une phrase de reco. | Recommandation argumentée. |

#### Fiche de résultats (à remplir)

| Mesure | Node.js | Bun | Écart constaté |
| --- | --- | --- | --- |
| Temps d'installation des dépendances |   |   |   |
| Démarrage à froid |   |   |   |
| Débit sur `/:code` (req/s, avec BDD) |   |   |   |
| Temps de la suite de tests |   |   |   |
| Taille de l'image conteneur (option Docker) |   |   |   |
| Verdict (gain réel ? friction ?) |   |   |   |

#### Critères de réussite du Kata

Le binôme a (1) produit des chiffres reproductibles, (2) identifié au moins un gain franc (probablement l'installation/CI) et au moins une friction (probablement le module natif ou l'API SQLite runtime-spécifique), et (3) formulé une recommandation nuancée plutôt qu'un « pour » ou « contre » binaire.

### 4.5 Animation : débat et projection dans le futur

**Questions pour lancer le débat (séquence 1:40–1:55) :**

- Sur quels services adopteriez-vous Bun en premier, et lesquels garderiez-vous sur Node — et pourquoi ?
- L'absence de modèle de permissions (contrairement à Deno) est-elle rédhibitoire pour vos services exposés ?
- La réécriture en Rust et le rachat par Anthropic : plutôt rassurants (ressources, viabilité) ou inquiétants (dépendance, dette de code générée par IA) pour un choix à trois ans ?

**Projeter la technologie dans le futur :** l'essor de l'edge/serverless où l'empreinte de Bun fait la différence ; les frameworks pensés pour lui (Hono, Elysia) et la convergence des API web (WinterCG) qui rend le code portable ; et le fait que Bun soit devenu un cas d'école du développement « AI-native » (il est l'exécutable de Claude Code). Le pari Rust incarne la question ouverte du moment : gain de maturité durable, ou dette technique à surveiller ?

### 4.6 Vérification des acquis (ticket de sortie)

Pour objectiver l'atteinte des objectifs, chaque binôme rend en fin d'atelier :

- Sa fiche de résultats complétée (vérifie O4).
- Une phrase de recommandation contextualisée (vérifie O5 et O7).
- Trois questions flash à l'oral ou par sondage : Quel est le gain le plus reproductible de Bun ? Citez une friction concrète. Sur quel type de charge l'avantage de débit s'estompe-t-il ? (vérifie O1, O5, O6).

---

## Partie 5 — Posture de Lead Developer

Cette dernière partie explicite comment notre démarche et le présent dossier démontrent les attitudes professionnelles attendues d'un Lead Developer.

### 5.1 Autonomie et curiosité

Le sujet — Bun — a été choisi pour son caractère émergent et exigeant : un runtime en pleine mutation (rachat par Anthropic, réécriture en Rust) sur lequel il fallait apprendre à apprendre plutôt que mobiliser des acquis. Nous avons travaillé en binôme en nous répartissant la veille, le développement du POC et la rédaction, et avons systématiquement confronté le discours marketing de la technologie à des sources critiques et à nos propres mesures. Cet esprit critique face à une techno « hype » se traduit concrètement dans le dossier par la distinction explicite entre gains réels et gains survendus.

### 5.2 Réactivité et agilité

La démarche a produit, dans le temps imparti, une ébauche structurée et complète : un sujet cadré et argumenté, un POC fonctionnel et testé, une estimation budgétaire chiffrée et un plan d'atelier prêt à animer. Le découpage en phases (adoption incrémentale, Phase 1 puis Phase 2) illustre une capacité à proposer un plan d'action réaliste plutôt qu'une recommandation tout-ou-rien.

### 5.3 Rigueur de restitution

L'ensemble du dossier vise la clarté de la vulgarisation et l'esprit de synthèse : chaque partie part d'un besoin concret, appuie ses affirmations sur des sources datées et des mesures reproductibles, et conclut par une recommandation nuancée. Les supports techniques (cas d'usage du POC, matrice SWOT, fiche de résultats) ont été pensés pour être compréhensibles et réutilisables par des pairs.

Conformément aux attendus d'honnêteté intellectuelle, nous indiquons avoir utilisé l'assistant Claude comme outil d'aide à la recherche, à la rédaction et au développement du POC, les livrables ayant été validés et testés par nos soins.

---

## Partie 6 — Former un développeur Node à Bun & coût de la transition

Cette partie synthétise, dans une optique pratique, ce que les Parties 3 et 4 ont chiffré et conçu : **comment faire monter en compétence un développeur Node sur Bun, et combien coûte concrètement la transition.** L'angle est volontairement opérationnel : ce que ça change pour le dev au quotidien, quelles étapes suivre, ce qu'il faut budgéter et quand on rentre dans ses frais.

### 6.1 Ce qui change (et ce qui ne change pas) pour un dev Node

Bun est un « drop-in replacement » de Node. La plupart des automatismes restent valables. Tableau de correspondance pour cadrer la transition :

| Sur Node tu utilises… | Sur Bun tu utilises… | Ce qui change pour toi |
| --- | --- | --- |
| `npm install` | `bun install` | Quasi instantané sur gros projets ; même `package.json` |
| `npm run script` | `bun run script` (ou `bun script`) | Pas de différence d'usage |
| `ts-node` / `tsx` / build étape | rien — `bun run fichier.ts` | Tu supprimes une catégorie d'outils |
| `jest` / `vitest` | `bun test` | Test runner intégré, API style Jest |
| `dotenv` | rien — `.env` chargé nativement | Une dépendance en moins |
| `node:fs`, `node:path`, etc. | Identiques (compatibles) | Aucune migration de code |
| `@hono/node-server` (Hono) | `Bun.serve` (intégré) | Le serveur HTTP est natif |
| `node:sqlite` | `bun:sqlite` | **Point de friction** : API différentes, prévoir un adaptateur |
| Modules natifs N-API (`better-sqlite3`, `sharp`…) | parfois OK, parfois bloqué | À vérifier au cas par cas |
| Permission Model (Node 22+) | Absent | Ne pas s'appuyer dessus pour la sécurité |

**Ce que ça veut dire concrètement.** Un dev Node qui ouvre un projet Bun pour la première fois retrouve `package.json`, `node_modules`, l'écosystème npm et la même syntaxe JS/TS. Il n'a pas à réapprendre un langage ni un framework. La seule courbe d'apprentissage réelle porte sur (a) les API spécifiques au runtime (`Bun.serve`, `bun:sqlite`…) et (b) la cartographie des modules natifs qui passent ou non. Compter **une journée pour devenir autonome**, deux ou trois pour être à l'aise.

### 6.2 Plan de formation pour une équipe Node

Plan en trois temps, calibré sur ~1 jour/dev (cohérent avec l'enveloppe budgétaire de la Partie 3) :

#### Étape 1 — Auto-formation préalable (~2 h)

À faire avant l'atelier collectif, chacun de son côté :

```bash
# Installer Bun
curl -fsSL https://bun.sh/install | bash

# Tester l'install
bun --version

# Faire tourner un .ts directement, sans config
echo 'console.log("hello from Bun")' > hello.ts
bun run hello.ts

# Installer une dépendance pour mesurer la vitesse
mkdir test-bun && cd test-bun
bun init -y
bun add hono zod
```

Ressources à parcourir : la doc officielle [bun.com/docs](https://bun.com/docs), la page « Bun for Node.js users », et la matrice de compatibilité [bun.com/docs/runtime/nodejs-apis](https://bun.com/docs/runtime/nodejs-apis).

#### Étape 2 — Atelier collectif (2 h)

C'est l'atelier détaillé en Partie 4 : démo live, Coding Kata « Migrez et mesurez » sur le POC, débrief. Le dev y apprend par la mesure, pas par la lecture.

#### Étape 3 — Mise en pratique encadrée (~½ jour)

Chaque dev prend un projet interne réel, tente la bascule outillage (`npm` → `bun` pour install et test), produit un mini-rapport :
- temps d'install avant/après,
- temps de la suite de tests avant/après,
- éventuels modules problématiques (typiquement les binaires natifs).

À l'issue de cette journée cumulée, le dev sait : installer Bun, exécuter un projet Node existant sous Bun, écrire et lancer des tests avec `bun test`, identifier un module natif qui pose problème, et formuler un avis argumenté sur l'opportunité d'adopter Bun pour tel ou tel service.

### 6.3 Faire la transition — méthode incrémentale

La règle d'or, héritée de la note de cadrage : **on ne migre pas tout d'un coup**. On capture d'abord les gains sûrs (outillage / CI), puis on pilote les gains incertains (runtime de production).

#### Phase 1 — Outillage et CI (faible risque, gain rapide)

**Ce qu'on bascule :** `bun install` à la place de `npm install` en local et en CI, `bun test` à la place de `jest`/`vitest`. **On garde `node` comme runtime de production.**

**Pourquoi commencer par là :**
- Réversible en 5 minutes (re-bascule sur npm sans toucher au code).
- Gain visible dès la première CI accélérée.
- Aucun changement comportemental en production.

**Critères de succès :** temps de CI réduit, équipe convaincue par l'expérience, pas d'incompatibilité bloquante remontée.

#### Phase 2 — Pilote runtime sur 2 ou 3 services non critiques

**Ce qu'on bascule :** un ou deux microservices stateless, sans modules natifs exotiques, avec une couverture de tests correcte. Ces services tournent sous Bun en production, derrière un load balancer qui peut être basculé en quelques secondes sur l'image Node si besoin.

**Précautions :**
- Garder l'image Docker `node` prête à redéployer.
- Instrumenter sérieusement (métriques mémoire, latence, taux d'erreurs).
- Définir des seuils d'abandon clairs avant de lancer (ex. « si latence p99 monte de plus de 20 %, on revient sur Node »).

#### Phase 3 — Élargissement (si Phase 2 concluante)

Élargir aux services adjacents, par grappes, en gardant toujours la possibilité de revenir en arrière. **Ne jamais migrer un service à modules natifs N-API sans avoir vérifié individuellement leur compatibilité.**

### 6.4 Le coût de la transition, en clair

Synthèse condensée des chiffres de la Partie 3, pour une équipe type de **20 développeurs back-end Node** (TJM complet 500 €).

| Poste | Détail | Coût |
| --- | --- | --- |
| **Licence Bun** | Open source MIT | **0 €** |
| **Matériel / SaaS** | Tourne sur l'existant | **0 €** |
| **Phase 1 — Outillage & CI** | | |
| — Formation (1 j/dev × 20) | Auto-formation + atelier | 10 000 € |
| — Migration des pipelines CI | 10 jours-homme | 5 000 € |
| — Audit de compatibilité des dépendances | 8 jours-homme | 4 000 € |
| **Sous-total Phase 1** | **38 j-h** | **19 000 €** |
| **Phase 2 — Pilote runtime** | | |
| — Migration de 2–3 services | 20 jours-homme | 10 000 € |
| — Provision incompatibilités | 5 jours-homme | 2 500 € |
| **Sous-total Phase 2** | **25 j-h** | **12 500 €** |
| **TOTAL transition (one-shot)** | **63 j-h** | **≈ 31 500 €** |

**Et si on s'arrête en cours de route ?** L'investissement est borné. Si la Phase 1 ne convainc pas, on stoppe avant la Phase 2 : on a dépensé ~19 k€, on en retire l'apprentissage et on garde la chaîne d'outillage améliorée (ou on revient à npm). **Aucun coût caché de désinstallation** : `bun install` et `npm install` se côtoient sans conflit, le `package.json` reste le même.

### 6.5 Quand est-ce qu'on rentre dans ses frais ?

Hypothèses prudentes :
- Chaque dev économise **10 minutes/jour** d'attente (installs + feedback CI).
- Soit ~36 h/an/dev, ~5 jours/an/dev.
- Pour 20 devs : ~100 jours-homme/an = **≈ 50 000 €/an** de capacité rendue à l'équipe.

| Élément | Montant |
| --- | --- |
| Coût de transition | ≈ 31 500 € (one-shot) |
| Gain annuel récurrent (estimation conservatrice) | 25 000 – 50 000 €/an |
| Économie compute CI | ≈ 330 €/an |
| **Délai de retour sur investissement** | **8 à 15 mois** |

Même en prenant la fourchette basse (gain divisé par deux), **la transition se rembourse en moins d'un an**. Le gain dominant est le temps humain — pas la facture cloud, qui reste marginale à cette échelle.

### 6.6 Risques de la transition et comment les couvrir

| Risque | Probabilité | Parade |
| --- | --- | --- |
| Un module natif N-API bloque la migration | Moyenne | Audit en Phase 1 ; ne migre que les services concernés en Phase 2 ; alternative pure JS si elle existe |
| Régression de performance en production sous Bun | Faible mais possible | Pilote sur service non critique, métriques avant/après, retour Node préparé |
| Manque d'outils APM (Datadog, New Relic) matures | Moyenne | Tester l'instrumentation dès la Phase 2 ; prévoir un outil d'appoint si besoin |
| Dépendance forte à Anthropic (gouvernance, vendor lock-in) | Faible court terme, à surveiller | Bun reste MIT ; Node reste l'issue de secours toujours valide |
| Bugs liés à la réécriture Rust de mai 2026 | Faible mais réelle | Suivre les versions, ne pas adopter une release sans recul (>1 mois) en prod |
| Équipe démotivée par un creux de productivité | Faible | Démarrer par les gains visibles (CI) qui motivent, pas par la migration runtime |

### 6.7 Checklist du chef de projet « passage à Bun »

À cocher dans l'ordre :

- [ ] Auto-formation des devs (2 h, individuel)
- [ ] Atelier collectif Learning Lab (2 h, Coding Kata)
- [ ] Audit des dépendances : lister les modules natifs N-API, vérifier la compatibilité Bun
- [ ] Bascule de l'outillage local : `bun install`, `bun test`
- [ ] Bascule des pipelines CI vers Bun
- [ ] Mesure du gain CI (avant/après) — confirme Phase 1
- [ ] **Décision : Phase 2 ou stop ?**
- [ ] Choix d'un service pilote (stateless, sans natifs, bien testé)
- [ ] Bascule runtime du pilote, métriques en parallèle
- [ ] Mesure en production sur 2 à 4 semaines
- [ ] **Décision : élargissement ou rollback ?**

**En une phrase.** Former un dev Node à Bun, c'est ~1 jour ; faire passer une équipe de 20 dans des conditions sûres, c'est ~31 500 € sur quelques semaines ; et le retour sur investissement tombe en moins d'un an, à la condition de procéder par étapes plutôt que d'un seul bloc.
