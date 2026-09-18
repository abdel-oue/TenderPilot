# TenderPilot

Une PME marocaine qui veut répondre à un appel d'offres public doit lire un CPS de
60 à 100 pages, en extraire les exigences, vérifier qu'elle est éligible, et
rédiger un mémoire technique. Trois à cinq jours-homme par dossier. La plupart des
PME ne répondent pas — ou répondent mal et sont écartées sur un vice de forme.

TenderPilot lit le dossier, en extrait chaque exigence **avec sa page source**,
confronte le tout au profil de l'entreprise, rend un **go / no-go argumenté**, et
rédige un brouillon de mémoire technique que l'humain corrige section par section.

L'objectif n'est pas de remplacer le rédacteur, mais de lui livrer un dossier à
80 % dont il ne fait plus que l'arbitrage.

## Démarrage

```bash
cp .env.example .env     # remplir les clés modèle
# déposer le corpus dans apps/api/src/db/seed/data/
docker compose up
```

→ interface `http://localhost:3100` · api `http://localhost:3000`
→ compte de démonstration `demo@tenderpilot.local` / `demo1234`

Le worker indexe le corpus de l'entreprise à son démarrage. Pour le relancer à la
main (opération idempotente, elle n'embarque que ce qui ne l'est pas encore) :

```bash
npm run db:index                       # le compte de démonstration
npm run db:index -- vous@exemple.com   # un autre compte
```

Détails, variables et diagnostic : **[docs/deployment.md](docs/deployment.md)**.

## Une entreprise par compte

Un compte = une entreprise. Créez un second utilisateur et vous obtenez une
application vide : ni profil, ni dossiers, ni documents. Rien n'est partagé, et il
n'y a ni équipe ni invitation — c'est volontaire, l'authentification multi-
utilisateurs est hors périmètre du cahier des charges.

Un nouveau compte commence donc par **Mon entreprise** : importez votre
`profil-entreprise.json`, puis déposez vos attestations et vos mémoires déjà
rendus. Ce sont eux que le rédacteur fouille pour citer une référence réelle — sans
eux, chaque section revient marquée `[A COMPLETER PAR L'HUMAIN]`.

## Déposer un dossier

Les PDF déposés depuis l'interface sont écrits dans `uploads/<utilisateur>/`, sur
un volume Docker nommé — ils survivent à un `docker compose up --build`. Le nom du
fichier stocké est l'empreinte de son contenu, ce qui fait que redéposer le même
PDF ne crée pas de doublon et réutilise le cache d'extraction.

Le fichier est validé sur ses octets (`%PDF`), pas sur l'en-tête annoncé par le
navigateur, et plafonné à `MAX_UPLOAD_MB` (25 Mo par défaut).

## Ce que ça fait, concrètement

Sur `AO-2026-004`, qui est un **scan intégral sans couche texte** :

```
[ok] ingest               4 pages lues, dont 4 par OCR          34042ms
[ok] extractRequirements  11 exigences extraites                13228ms
[ok] classifyRequirements 8 exigences eliminatoires             10072ms
[ok] parseRubric          grille de notation : 5 criteres        7274ms
[ok] matchProfile         0/11 couvertes par le profil          21990ms
[ok] computeScore         score de couverture : 50/100              1ms
[ok] decide               go - 0 point(s) bloquant(s)               2ms
[ok] draft                4 sections redigees                   25920ms
[ok] compliance           4 sections validees, 0 refusees        8785ms
```

Sur `AO-2026-002`, l'agent rend un **no-go** et dit pourquoi :

> *Le candidat doit être titulaire de la certification ISO 22301:2019.*
> Les certifications détenues sont ISO 9001:2015, ISO 27001:2022 et Qualiopi.

Chaque exigence affichée cite sa page ; un clic ouvre le PDF à cette page.

## Documentation

| Document | Contenu |
|---|---|
| **[docs/agents.md](docs/agents.md)** | **Comment l'agent fonctionne** — le graphe, les outils, les boucles, ce qu'il refuse de faire. Commencez ici |
| [docs/architecture.md](docs/architecture.md) | Les cinq services, les couches, le modèle de données |
| [docs/api.md](docs/api.md) | Tous les endpoints, avec exemples de réponses |
| [docs/deployment.md](docs/deployment.md) | Exécution, variables, tests, diagnostic |
| [CLAUDE.md](CLAUDE.md) | Règles de code du dépôt |

## Le graphe, en une image

```
ingest → extractRequirements → classifyRequirements → parseRubric
      → matchProfile → computeScore → decide ─[no-go]─→ FIN
                                             └─[go]───→ draft → compliance
                                                          ↑         │
                                                          └──refus──┘  (max 2)
```

Deux arêtes conditionnelles, et c'est là qu'est l'agent :

- **un no-go ne rédige jamais.** Écrire un mémoire pour un dossier perdu est
  exactement le gaspillage que ce produit évite.
- **une section refusée repart au Writer**, avec des instructions. C'est la boucle
  planifier → appeler des outils → mémoriser → réviser.

Les deux bornes vivent dans la condition d'arête, jamais dans un prompt. On
n'*demande* pas au modèle de s'arrêter, on l'en empêche.

Diagramme complet et détaillé : [docs/agents.md](docs/agents.md).

## Les garde-fous

- **Ne jamais inventer une référence.** Le Writer ne cite que ce que ses outils ont
  renvoyé. Le Compliance recoupe chaque `REF-xx` / `CV-xx` du texte contre les
  citations **sans appeler de modèle** : une référence fabriquée se détecte sans
  jugement.
- **Admettre une lacune.** Sans élément probant, la section porte
  `[A COMPLETER PAR L'HUMAIN]` et dit ce qui manque.
- **Signaler ce qui n'a pas été lu.** Une page que l'OCR n'a pas pu lire est
  remontée comme illisible, jamais renvoyée comme page vide.
- **Ne pas fabriquer une disqualification.** Seule une *capacité* exigée et absente
  écarte l'entreprise. « Déposer le pli avant le 12/03 » est une tâche de la
  réponse, pas une preuve d'inéligibilité.

## Stack

Next.js 16 + React 19 (TypeScript) · Node 22 + Fastify (JavaScript ESM) ·
LangGraph + checkpointer Postgres · PostgreSQL 16 + pgvector · Redis 7 + BullMQ ·
Zod à chaque frontière · Vitest + Playwright · Docker Compose.

`apps/web` est en TypeScript, `apps/api` en JavaScript : côté api, Zod tient le
rôle du vérificateur de types, à chaque frontière, sans exception.

## Tests

```bash
npm test          # sans réseau ni base de données
```

Aucun test de la suite par défaut n'appelle un fournisseur : `STUB_LLM=1`.
