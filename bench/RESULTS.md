# Fiche de résultats — crash-test Bun vs Node.js

> Mesures réelles produites par les scripts de `bench/` sur le POC *URL shortener*.
> Le principe directeur reste celui de la note de cadrage : **on mesure, on ne récite pas.**
> Ces chiffres sont des relevés ponctuels sur **une** machine — ils sont reproductibles
> mais doivent être recalibrés sur votre poste / votre CI.

## Contexte de mesure

| Élément | Valeur |
|---|---|
| Machine | 11th Gen Intel Core i7-11800H @ 2.30 GHz, 16 threads, 16,9 Go RAM |
| OS | Windows 11 |
| Node.js | v22.19.0 (`--experimental-strip-types --experimental-sqlite`) |
| Bun | 1.3.14 |
| Date | 22 juin 2026 |
| Application | même code Hono + Zod + SQLite en mémoire ; seul `src/db.ts` diffère |

## Fiche de résultats

| Mesure | Node.js | Bun | Écart constaté |
|---|---|---|---|
| Suite de tests (intégration) | **3/3 ✅** | **3/3 ✅** | Parité fonctionnelle totale |
| Installation des dépendances (cache froid) | 3,19 s | 2,39 s | Bun ~25 % plus rapide *(projet à 3 deps)* |
| Démarrage à froid (process → 1er 200 sur `/health`) | ~273 ms | ~270 ms | Quasi identique *(voir lecture critique)* |
| Débit sur `/:code` (lecture + écriture BDD) | **~14 768 req/s** (lat. moy. 3,1 ms) | **~37 849 req/s** (lat. moy. 1,1 ms) | **Bun ~2,6×** |
| Taille de l'image conteneur (`-slim`) | **353 Mo** | **258 Mo** | **Bun ~27 % plus légère** |
| Conteneur qui sert (`/health`) | `{"runtime":"node"}` ✅ | `{"runtime":"bun"}` ✅ | les 2 démarrent et répondent |

## Lecture critique (le cœur de l'exercice)

1. **Tests : parité totale.** La *même* application passe 3/3 sur les deux runtimes sans
   réécriture — seules les ~15 lignes de `src/db.ts` (adaptateur `bun:sqlite` / `node:sqlite`)
   diffèrent. C'est la confirmation pratique de la portabilité annoncée en Partie 1.

2. **Installation : gain réel mais modeste *ici*.** Le POC n'a que 3 dépendances ; l'écart
   npm/Bun y est faible. Le gain spectaculaire (×10–20) de la littérature s'observe sur de
   **gros monorepos** à cache froid, pas sur un micro-projet. Honnêteté de mesure : ne pas
   sur-vendre ce chiffre.

3. **Démarrage à froid : quasi nul *sur ce poste*.** Contre-intuitif vs les 8–15 ms annoncés.
   Explication : sur Windows, le chrono est dominé par le coût de *spawn* du process et du
   *probe* `curl`, pas par le runtime lui-même. L'avantage cold-start de Bun est un phénomène
   **serverless/Linux (Lambda)** — il ne se révèle pas dans ce setup local. À remesurer en
   conditions edge/serverless réelles avant d'en faire un argument.

4. **Débit : Bun nettement devant, même avec BDD.** On attendait un resserrement de l'écart une
   fois la base de données dans la boucle. Il se resserre par rapport au « Hello World » mais
   Bun garde ~2,6×, car le SQLite **en mémoire** est si rapide que l'overhead du runtime reste
   le facteur dominant. Avec une BDD réseau (Postgres distant), l'écart se réduirait davantage —
   c'est la latence I/O qui deviendrait limitante. **Nuance à conserver** : ce chiffre reflète
   un SQLite local, pas une stack de production typique.

5. **Conteneur : Bun plus léger, mais attention aux dépendances.** Bun ~27 % d'image en moins
   (258 vs 353 Mo). Les valeurs absolues dépassent les ordres de grandeur de la note de cadrage
   (~130/180 Mo) car on part ici des bases `-slim` officielles, plus lourdes qu'une base Alpine.
   **Bug rencontré et corrigé** : `@hono/node-server` (requis au *runtime* côté Node) était
   déclaré en `devDependency` ; avec `npm install --omit=dev` dans `Dockerfile.node`, l'image
   Node crashait au démarrage (`ERR_MODULE_NOT_FOUND`). Déplacé en `dependencies` → l'image Node
   sert désormais correctement. C'est une illustration concrète du « joint » runtime : Bun n'a
   pas besoin de ce paquet (il utilise `Bun.serve`), Node si.

## Verdict du crash-test

Le POC confirme la thèse de cadrage : **adoption ciblée et incrémentale**. Le gain le plus sûr
et le plus universel reste l'**outillage / CI** (et la DX : TypeScript natif, binaire unique,
tests rapides). Les gains de débit et de cold-start sont réels mais **contextuels** — ils
dépendent fortement de la charge, de la base de données et de l'environnement de déploiement.
À objectiver service par service avant toute bascule du runtime de production.
