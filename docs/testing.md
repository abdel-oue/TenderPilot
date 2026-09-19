# Installer, lancer, tester

Ce document part d'une machine vierge et va jusqu'à une suite verte. Pour
l'exécution en conteneur, les variables et le diagnostic, voir
[deployment.md](deployment.md) ; ce fichier-ci parle de la boucle du développeur et
des tests.

## État actuel de la suite

Au dernier passage (`npm test`) : **273 tests passent, 0 échoue, sur 25 fichiers**.

Les 15 échecs précédents étaient des tests en retard sur le code, pas des
régressions du produit : trois fichiers doublaient des dépôts dont la signature
avait changé au cloisonnement par compte (migration `0004_owner_scoping`). Ils
ont été remis à la signature réelle — `request.user` sur les requêtes factices,
`findByIdForOwner` sur les doubles — et non contournés.

Ce qui a été ajouté en même temps :

| Fichier | Ce qu'il couvre |
|---|---|
| `tests/services/llm.service.test.js` | la boucle d'outils : exécution, réinjection, bornage, échec du fournisseur, arguments malformés |
| `tests/services/tools.service.test.js` | les 10 outils, le cloisonnement par propriétaire, et le fait que **tout outil déclaré est réellement dispatché** |
| `tests/lib/calc.test.js` | l'arithmétique des montants, et le refus d'évaluer du code |
| `tests/lib/dates.test.js` | les trois formats de date du corpus, jours ouvrés, dates impossibles |
| `tests/repositories/analysis.repository.test.js` | une correction humaine n'est jamais écrasée par un brouillon d'agent |
| `tests/services/score.service.test.js` | l'ordre des points bloquants par gravité |
| `tests/lib/narration.test.js` | les phrases en français lues par le dirigeant — dont le fait qu'une recherche vide se lit comme vide, même si le modèle prétend le contraire |

`npm run test:e2e` exécute désormais les parcours de la vitrine et de l’espace de
travail, sur Chromium desktop et mobile. Le serveur Next local utilise le port
`3101` et les appels API des parcours authentifiés sont interceptés par Playwright.
Cette suite vérifie le frontend ; elle ne valide pas les services backend réels.

Pour cibler l’espace de travail : `npm run test:e2e:workspace -w @tenderpilot/web`.
Pour les tests unitaires web : `npx vitest run --project web`.
Dernière vérification frontend : **13 tests unitaires passent ; 31 tests navigateur
passent, 1 est ignoré sur desktop car il teste uniquement le menu mobile**.
La configuration dédiée à la vitrine reste disponible via
`npm run test:e2e:landing -w @tenderpilot/web` (port `3100`).

---

## Installation

### Prérequis

| Outil | Pourquoi |
|---|---|
| Docker + Compose | la façon normale de tout lancer |
| Node 22.11+ (`.nvmrc`) | développer ou tester hors conteneur |
| le corpus | `apps/api/src/db/seed/data/`, gitignoré, déposé à la main |
| les clés modèle | `.env`, jamais commitées |

`pdftoppm` (poppler) et `tesseract` ne sont **pas** requis sur l'hôte : ils sont
dans l'image api. Sans eux, un PDF dont aucune page n'est lisible échoue bruyamment
— c'est voulu ; un document dont certaines pages se lisent passe, les autres
restant marquées illisibles.

### En conteneur (la voie normale)

```bash
git clone <repo> && cd tenderpilot
cp .env.example .env               # remplir JWT_SECRET, LLM_*, AZURE_OPENAI_*
cp -r /chemin/vers/corpus/* apps/api/src/db/seed/data/
npm run up                         # build + migrations + seed
```

→ web `http://localhost:3100` · api `http://localhost:3000` ·
compte `demo@tenderpilot.local` / `demo1234`.

### Hors conteneur

Les tests unitaires n'ont besoin ni de base ni de réseau ; le reste, si.

```bash
npm install                        # workspaces npm, une seule installation à la racine
npm test                           # suffit déjà : aucune dépendance externe

# pour faire tourner l'application :
npm run up                         # laisser postgres + redis dans docker
npm run db:migrate
npm run db:seed
npm run db:index                   # plonge le corpus d'entreprise ; sans ça le
                                   # rédacteur n'a rien à citer
npm run dev:api                    # :3000   (node --watch, aucun build)
npm run dev:worker                 # le graphe tourne ici, pas dans l'api
npm run dev:web                    # :3100
```

L'api lit `.env` via `node --env-file`, pas via `dotenv`. `lib/env.js` parse
`process.env` avec zod **au démarrage** : une clé manquante échoue au boot avec un
message qui la nomme, jamais en `undefined` dans une requête une heure plus tard.

---

## Lancer les tests

```bash
npm test                                   # les deux workspaces
npx vitest run --project api               # api seulement
npx vitest run --project web               # web seulement
npx vitest run apps/api/tests/services     # un dossier
npx vitest                                 # mode watch
```

Un seul `vitest.config.js` à la racine, deux projets :

| Projet | Racine | Fichiers | Setup |
|---|---|---|---|
| `api` | `apps/api` | `tests/**/*.test.js` | `tests/setup.js` |
| `web` | `apps/web` | `tests/**/*.test.ts`, `e2e/` exclu | — |

`apps/api/tests/setup.js` tourne **avant tout import**, parce que `lib/env.js` parse
`process.env` au chargement du module et que tous les dépôts l'importent
transitivement. Il pose des valeurs délibérément fausses :

- `DATABASE_URL` pointe sur un port où rien n'écoute — une requête accidentellement
  réelle échoue bruyamment au lieu de taper la base de dev de quelqu'un ;
- `STUB_LLM=1` — **rien dans la suite par défaut n'a le droit d'appeler un
  fournisseur**. Un test unitaire qui dépense du quota n'est pas un test unitaire,
  c'est une facture instable ;
- `LOG_LEVEL=silent`.

### End-to-end

```bash
npm run test:e2e -w @tenderpilot/web           # à réparer : config squelette
npm run test:e2e:landing -w @tenderpilot/web   # fonctionne
```

Les specs vivent dans `apps/web/e2e/`, `[flow].spec.ts`, jamais à côté de la source.
Elles tournent contre la pile compose avec le seed appliqué et `STUB_LLM=1`, donc
elles sont déterministes et ne brûlent pas de quota. `smoke.spec.ts` est la seule à
avoir le droit de toucher la vraie chaîne : elle est lente et hors du run par
défaut.

La configuration `landing` démarre son propre serveur (`webServer`) et couvre
desktop + mobile.

---

## Écrire un test

Les règles complètes sont dans [CLAUDE.md](../CLAUDE.md) ; le strict nécessaire :

- **Jamais à côté du code.** `src/services/score.service.js` →
  `tests/services/score.service.test.js`. Le chemin est le miroir du chemin source.
- Nommage `[entité].[rôle].test.js` côté api, `[nom].test.ts` côté web.
- Un `describe` par module, un `it` par **comportement** —
  `it("flags an eliminatory requirement as a blocker")`, pas
  `it("findBlockers works")`.
- Les appels modèle sont bouchonnés à la frontière `services/llm.service.js`. Jamais
  plus bas, jamais le vrai point de terminaison.
- Les fixtures vivent dans `tests/fixtures/` et sont de **vraies charges utiles
  capturées**, pas des cas heureux écrits à la main.
- Chaque schéma zod a un test avec une charge malformée, pas seulement une valide.
  Sans vérificateur de types côté api, ces tests sont la seule chose qui affirme une
  forme : ils pèsent plus lourd ici qu'ils ne pèseraient en TypeScript.
- Les tests base tournent contre le Postgres de compose, migrations appliquées, dans
  une transaction annulée. Aucun test ne laisse une ligne derrière lui.
- **Aucun snapshot sur une sortie de modèle.** Elle n'est pas stable : on affirme la
  forme parsée et les invariants.
- Un E2E qui échoue bloque le commit. Il n'est pas « instable », il est en échec.

Tout est construit par injection de dépendances : chaque classe prend ses
dépendances au constructeur, donc un service se teste avec un faux dépôt et un faux
`LlmService`, sans base ni fournisseur.

```js
// tests/services/score.service.test.js — rien à bouchonner : score.service.js
// n'a ni SQL, ni modèle, ni horloge. C'est pour ça qu'il est écrit comme ça.
import { findBlockers } from '../../src/services/score.service.js';
```

## Vérifications avant de livrer

```bash
npm test
npm run lint
npm run build            # Next.js ; l'api n'a pas d'étape de build, c'est du JS
```

Ne pas commiter avec un test en échec ou une vérification de types en échec.
Committer reste la décision de l'humain : le travail fini attend dans l'arbre de
travail.
