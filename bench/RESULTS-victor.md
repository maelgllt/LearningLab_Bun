# Fiche de résultats — crash-test Bun vs Node.js (relevé Victor)

> Mesures réelles produites par les scripts de `bench/` sur le POC *URL shortener*.
> Le principe directeur reste celui de la note de cadrage : **on mesure, on ne récite pas.**
> Ces chiffres sont des relevés ponctuels sur **ma** machine — à comparer au relevé de Maël
> (`bench/RESULTS.md`), pas à substituer : c'est l'écart entre les deux qui est instructif.

## Contexte de mesure

| Élément | Valeur |
|---|---|
| Machine | AMD Ryzen 5 3600 (6 cœurs / 12 threads), 16 Go RAM |
| OS | Windows 10 Famille (build 10.0.19045) |
| Node.js | v22.13.0 (`--experimental-strip-types --experimental-sqlite`) |
| Bun | 1.3.14 |
| Date | 22 juin 2026 |
| Application | même code Hono + Zod + SQLite en mémoire ; seul `src/db.ts` diffère |

## Fiche de résultats

| Mesure | Node.js | Bun | Écart constaté |
|---|---|---|---|
| Suite de tests (intégration) | **3/3 ✅** | **3/3 ✅** | Parité fonctionnelle totale |
| Installation des dépendances (cache froid) | ~3,23 s | ~3,38 s | **Bun non gagnant ici** — npm très légèrement devant *(voir lecture critique)* |
| Démarrage à froid (process → 1er 200 sur `/health`, moy. 10×) | ~301 ms | ~285 ms | Bun ~5 % plus rapide — quasi identique |
| Débit sur `/:code` (lecture + écriture BDD, 50 conns / 10 s) | **~9 243 req/s** (lat. moy. 4,86 ms) | **~25 195 req/s** (lat. moy. 1,45 ms) | **Bun ~2,7×** |
| Taille de l'image conteneur (`-slim`) | *non mesuré* | *non mesuré* | Docker absent du poste — axe à rejouer |
| Conteneur qui sert (`/health`) | *non mesuré* | *non mesuré* | idem |

## Lecture critique (le cœur de l'exercice) — et comparaison au relevé de Maël

> Rappel des chiffres de Maël (machine **i7-11800H, 16 threads, Windows 11**, Node 22.19, Bun 1.3.14) :
> install npm 3,19 s / bun 2,39 s · cold start 273 / 270 ms · débit 14 768 / 37 849 req/s (Bun ~2,6×) ·
> image 353 / 258 Mo.

1. **Tests : parité totale, identique chez nous deux.** La *même* application passe 3/3 sur Node et
   sur Bun, sans réécriture — seules les ~15 lignes de `src/db.ts` (adaptateur `bun:sqlite` /
   `node:sqlite`) diffèrent. Aucun écart entre nos deux relevés : la portabilité annoncée en Partie 1
   est confirmée indépendamment de la machine.

2. **Installation : le gain de Bun NE s'est PAS reproduit chez moi — c'est le résultat le plus
   parlant.** Maël mesurait Bun ~25 % plus rapide (2,39 s vs 3,19 s) ; chez moi Bun est même
   *légèrement plus lent* (3,38 s vs 3,23 s npm). Deux causes probables : (a) c'était le **tout
   premier `bun install`** de la machine → son cache global (`~/.bun/install/cache`) était **froid et
   à peupler depuis le réseau**, alors que mon cache npm était déjà chaud d'un install précédent — le
   « cache froid » n'était donc pas symétrique ; (b) sur un POC à **3 dépendances**, l'écart est dans
   le bruit de mesure et peut s'inverser d'un run à l'autre. **Conclusion renforcée** : la mise en
   garde de Maël (« ne pas sur-vendre ce chiffre, le ×10–20 est un effet monorepo ») est ici poussée
   à son terme — sur un micro-projet, l'avantage install de Bun n'est pas seulement modeste, il peut
   carrément disparaître. À remesurer sur un vrai gros `package.json` à cache réellement vidé des deux
   côtés avant d'en faire un argument.

3. **Démarrage à froid : quasi nul, comme chez Maël.** Mes valeurs (301 / 285 ms) sont un peu plus
   hautes que les siennes (273 / 270 ms) — cohérent avec un CPU plus ancien (Ryzen 5 3600, 2019) que
   son i7-11800H (2021), et le chrono est de toute façon dominé par le coût de *spawn* du process et du
   *probe* `curl` sous Windows, pas par le runtime. Bun garde un mince avantage (~5 %) là où Maël
   voyait ~1 %, mais on reste dans le même verdict : **l'avantage cold-start de Bun est un phénomène
   serverless/Linux (Lambda)** qui ne se révèle pas dans un setup local Windows. À remesurer en
   conditions edge/serverless avant d'en faire un argument.

4. **Débit : le ratio Bun ~2,7× se reproduit remarquablement (Maël : ~2,6×).** C'est le résultat le
   plus robuste de l'étude. **Nuance importante sur les valeurs absolues** : mes chiffres sont nettement
   plus bas que ceux de Maël (Node 9 243 vs 14 768 ; Bun 25 195 vs 37 849 req/s) — ma machine est tout
   simplement moins rapide (6 cœurs Zen 2 de 2019 vs 8 cœurs Tiger Lake de 2021). **C'est précisément la
   leçon du Kata : les valeurs absolues ne sont PAS transférables d'un poste à l'autre, mais le RAPPORT
   entre runtimes, lui, l'est.** Même analyse de fond que Maël : avec un SQLite **en mémoire**, l'I/O ne
   masque pas l'overhead du runtime, donc Bun reste devant ; avec une BDD réseau (Postgres distant)
   l'écart se resserrerait, la latence I/O devenant limitante. Ce chiffre reflète un SQLite local, pas
   une stack de production typique.

5. **Conteneur : non mesuré chez moi (Docker absent du poste).** Je n'ai pas pu rejouer l'axe image ni
   le « conteneur qui sert ». Je reprends donc tel quel le relevé de Maël (Bun 258 Mo vs Node 353 Mo,
   ~27 % de moins, à partir des bases `-slim`) sans le revérifier. À rejouer si Docker est installé. À
   noter au passage : le bug `@hono/node-server` en `devDependency` que Maël avait corrigé est bien
   présent en `dependencies` dans le code actuel — l'image Node ne crasherait donc pas.

## Verdict du crash-test

Mon relevé **confirme la thèse de cadrage** et la conforte sur un point clé : ce qui se transfère
d'une machine à l'autre, c'est le **rapport** entre runtimes (débit Bun ~2,7×, reproduit à l'identique),
pas les valeurs absolues (toutes plus basses chez moi, simple effet matériel). Inversement, le gain
d'**installation** s'est révélé **fragile au point de s'inverser** sur ce micro-projet — preuve qu'il
faut le mesurer dans ses propres conditions et ne pas le réciter. Le gain le plus sûr et le plus
universel reste donc l'**outillage / CI / DX** (TypeScript natif, binaire unique, tests rapides) ;
les gains de débit et de cold-start sont réels mais **contextuels** (charge, base de données,
environnement de déploiement). **Adoption ciblée et incrémentale**, à objectiver service par service
avant toute bascule du runtime de production.
