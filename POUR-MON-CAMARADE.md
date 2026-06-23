# Récap projet — Learning Lab Bun (passation)

> Note de passation pour reprendre le projet. Résume **le sujet** (dossier `.docx`),
> **ce qui est déjà fait**, et **ce qui reste à faire**. Tout est reproductible : un
> `git clone` + `bun install` suffit.

---

## 1. Le sujet (rappel du dossier)

Dossier Learning Lab sur **Bun**, runtime JS/TS « tout-en-un » présenté comme un remplaçant
*drop-in* de Node.js (moteur JavaScriptCore, gestionnaire de paquets + bundler + transpiler +
test runner dans un seul binaire). Le dossier `.docx` est structuré en 5 parties :

1. **Note de cadrage** — argumentaire décisionnel, SWOT, comparaison Node/Deno/Bun.
   Conclusion : adoption **ciblée et incrémentale** (outillage/CI d'abord, runtime de prod ensuite).
2. **Démarche R&D & POC** — une micro-API *URL shortener*, **le même code** exécuté sur Bun et Node.js,
   pour mesurer les gains *réels* (et non les chiffres marketing).
3. **Étude budgétaire** — ROI : coût d'acquisition ~0 €, coût de transition borné (~31,5 k€),
   gains récurrents > investissement en < 12 mois.
4. **Ingénierie pédagogique** — atelier 2 h + Coding Kata « Migrez et mesurez » + fiche de résultats.
5. **Posture de Lead Developer** — autonomie, esprit critique, rigueur de restitution.

**Thèse centrale à retenir :** le vrai gain de Bun est dans l'**outillage / CI / DX**, pas dans le
débit applicatif brut (qui s'érode dès qu'une vraie base de données entre en jeu). Le POC sert à
**vérifier ça par la mesure**.

---

## 2. Le POC (ce qu'est le code)

Micro-API de raccourcissement d'URL. **Même application** sur les deux runtimes ; seul `src/db.ts`
(~15 lignes, l'adaptateur SQLite `bun:sqlite` vs `node:sqlite`) diffère — c'est le « joint » runtime.

- **Stack :** Hono (HTTP, portable WinterCG) + Zod (validation) + SQLite intégré au runtime (en mémoire).
- **Routes :** `GET /health`, `POST /api/links` (création + validation), `GET /:code` (redirect 302 +
  incrément compteur), `GET /api/links` (liste).
- **Arborescence :**
  ```
  src/      index.ts (détecte le runtime) · routes.ts (Hono+Zod) · db.ts (adaptateur SQLite)
  tests/    api.test.ts (3 tests d'intégration via app.request, sans réseau)
  bench/    install-bench.sh · coldstart-bench.sh · load-bench.sh · RESULTS.md
  Dockerfile.bun · Dockerfile.node · package.json · README.md
  ```

---

## 3. Ce qui est DÉJÀ FAIT ✅

### Tests fonctionnels
- Suite d'intégration **3/3 ✅ sur Node** et **3/3 ✅ sur Bun** (même code).

### Crash-test : les 4 axes mesurés (machine i7-11800H, Windows 11, Node 22.19, Bun 1.3.14)

| Mesure | Node.js | Bun | Lecture |
|---|---|---|---|
| Tests d'intégration | 3/3 ✅ | 3/3 ✅ | parité fonctionnelle |
| `install` (cache froid) | 3,19 s | 2,39 s | Bun ~25 % — modeste *(POC à 3 deps ; le ×10–20 est un effet monorepo)* |
| Cold start (→ 1er 200 `/health`) | ~273 ms | ~270 ms | quasi nul *(artefact Windows ; l'avantage Bun est un phénomène serverless/Linux)* |
| Débit `/:code` (lecture+écriture BDD) | ~14 768 req/s | ~37 849 req/s | **Bun ~2,6×** *(SQLite en mémoire trop rapide pour masquer l'overhead runtime)* |
| Image conteneur (`-slim`) | 353 Mo | 258 Mo | Bun ~27 % plus légère |
| Conteneur qui sert `/health` | ✅ | ✅ | les 2 démarrent |

➡️ Détail + lecture critique complète dans **`bench/RESULTS.md`** (c'est *notre* relevé ; toi tu
rempliras ta propre fiche avec **tes** chiffres quand tu relanceras — ils dépendent de ta machine).

### Corrections apportées (bugs réels trouvés en testant)
- **`bench/load-bench.sh`** : `PORT` n'était pas exporté au serveur (il démarrait sur 3000 pendant
  qu'autocannon tapait sur 3030) → ajout `export PORT`. Et `npx autocannon` → `npx -y autocannon`
  (sinon blocage sur le prompt d'install).
- **`bench/coldstart-bench.sh`** : mesurait un `sleep 0.4` fixe (donc le sleep, pas le démarrage) →
  réécrit avec un **probe HTTP réel** sur `/health`.
- **`package.json`** : `@hono/node-server` (requis au *runtime* côté Node) était en `devDependency` →
  l'image Docker Node crashait au démarrage (`ERR_MODULE_NOT_FOUND`). Déplacé en `dependencies`.

> ⚠️ Ces modifs **ne sont pas encore commitées** (volontairement). Voir section 5.

---

## 4. Ce qu'il RESTE À FAIRE 🔲

- [ ] **Refaire tourner le crash-test sur ta machine** et remplir ta propre fiche (cf. §6). C'est le
      cœur du Kata : comparer nos deux relevés et discuter les écarts.
- [ ] **Commiter** les modifs (scripts + `package.json` + `bench/RESULTS.md`) — pas encore fait.
- [ ] **Pousser le dépôt sur GitHub** : le dossier référence `https://github.com/maelgllt/LearningLab_Bun`.
      Vérifier que le remote existe et que le code y est bien (`git remote -v`).
- [ ] (Option) **Axe conteneur en absolu** : nos images partent des bases `-slim` (plus lourdes qu'Alpine),
      d'où 258/353 Mo vs les ~130/180 Mo cités dans le dossier. Si on veut coller aux ordres de grandeur
      du dossier, tester une base Alpine. Sinon, garder nos chiffres réels + la note explicative.
- [ ] (Option) **Mesure cold-start côté Linux/serverless** pour faire ressortir l'avantage Bun que notre
      poste Windows n'a pas montré.
- [ ] Relire la cohérence dossier `.docx` ↔ chiffres réels (mettre à jour les ordres de grandeur si besoin).

---

## 5. État Git (à la passation)

Modifs présentes mais **non commitées** :
```
 M bench/coldstart-bench.sh
 M bench/load-bench.sh
 M package.json
 ?? bench/RESULTS.md
 ?? POUR-MON-CAMARADE.md   (ce fichier)
```
`node_modules/`, `bun.lock`, `package-lock.json` sont gitignorés (normal).

---

## 6. Comment tout rejouer (reproductibilité)

**Prérequis :** Node ≥ 22.5, Bun ≥ 1.3 (`curl -fsSL https://bun.sh/install | bash`), Docker (option conteneur).

```bash
git clone <URL_DU_DEPOT> && cd bun-poc
bun install            # ou npm install

# Tests (même code, 2 runtimes)
npm run test:node      # node --test
bun test               # test runner de Bun

# Lancer l'app
bun run src/index.ts           # sur Bun
npm run start:node             # sur Node

# Crash-test (les 4 axes)
bash bench/install-bench.sh
bash bench/coldstart-bench.sh
RUNTIME=node bash bench/load-bench.sh
RUNTIME=bun  bash bench/load-bench.sh

# Axe conteneur (Docker doit tourner)
docker build -f Dockerfile.node -t poc-node .
docker build -f Dockerfile.bun  -t poc-bun  .
docker images | grep poc-
```

**Important :** ne supprime pas les scripts `bench/` — ce sont *eux* qui rendent les tests reproductibles
(le dossier, Partie 2.5 et Kata 4.4, s'appuie dessus). Tes chiffres seront différents des nôtres : c'est
attendu, ils dépendent de ta machine. Reporte-les dans une fiche à toi, puis on compare. 👍
