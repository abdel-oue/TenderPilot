# Exécution et déploiement

## Prérequis

- Docker + Docker Compose
- Le corpus dans `apps/api/src/db/seed/data/` (gitignoré, déposé localement)
- Les clés modèle fournies par l'organisation

Node 22 n'est nécessaire que pour développer hors conteneur.

## Démarrage sur une machine vierge

```bash
git clone <repo> && cd tenderpilot
cp .env.example .env          # puis remplir les clés (voir plus bas)
cp -r /chemin/vers/corpus/* apps/api/src/db/seed/data/
npm run up                    # → web http://localhost:3100, api http://localhost:3000
```

`npm run up` applique les migrations et lance le seed. C'est le test
d'acceptation de ce fichier : si ça ne suffit pas, c'est un bug.

Tout le Docker vit dans `docker/` : `Dockerfile`, `init.sql`,
`docker-compose.yml`, `docker-compose.dev.yml`. Seul `.dockerignore` reste à la
racine, parce que Docker ne le lit qu'à la racine du contexte de build. Les
chemins des fichiers compose sont relatifs à `docker/`, et `.env` reste à la
racine : d'où les `-f docker/docker-compose.yml --env-file .env` que les scripts
npm portent à votre place.

```bash
# l'équivalent explicite de npm run up
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

## Variables d'environnement

Tout est dans `.env.example`. Les seules qu'il faut réellement remplir :

| Clé | Obligatoire | Note |
|---|---|---|
| `JWT_SECRET` | oui | `openssl rand -hex 32` |
| `LLM_URL` · `LLM_API_KEY` · `LLM_MODEL` | oui | tier raisonnement (gpt-5.5) |
| `EMBEDDING_MODEL` · `EMBEDDING_DIMENSIONS` | oui | `embedder-small-3`, **512** |
| `AZURE_OPENAI_*` | oui | tier volume (gpt-4.1) |
| `TAVILY_API_KEY` | **non** | absente = l'outil `web_search` n'est pas proposé |
| `STUB_LLM` | non | `1` = aucun appel fournisseur (tests, CI) |

`EMBEDDING_DIMENSIONS` doit valoir 512 : la colonne `vector(512)` est figée dans la
DDL, et un écart échoue à l'insertion.

**Aucune clé n'est jamais commitée.** `.env` est gitignoré, `.env.example` ne
contient que des valeurs vides. Une clé en clair dans le dépôt est éliminatoire.

## Les services

| Service | Port | Exposé |
|---|---|---|
| `web` | 3100 | oui |
| `api` | 3000 | oui |
| `worker` | — | non (pas de port) |
| `postgres` | 5432 | en local seulement |
| `redis` | 6379 | non |

`postgres` écrit sur un volume nommé : `npm run down` ne détruit pas la base.
Il faut `docker compose -f docker/docker-compose.yml --env-file .env down -v`
pour cela — volontairement long, ça n'est pas une commande qu'on tape distrait.

## Boucle de développement

```bash
npm run up:dev     # monte les sources dans api + worker
npm run up:dev     # et de nouveau après une modification : les conteneurs
                   # redémarrent sur les sources montées, sans rebuild
npm run logs
```

`docker/docker-compose.dev.yml` n'est **pas** nommé `.override.yml`
volontairement : il monte les sources en bind, et le `npm run up` du jury doit
utiliser les images autonomes, pas le disque du développeur.

## Base de données

```bash
npm run db:migrate   # applique les migrations en attente
npm run db:seed      # idempotent, non destructif, rejouable
npm run db:reset     # DESTRUCTIF, refuse toute cible non locale
```

Le seed ne fait jamais de `TRUNCATE`, `DROP` ni de `DELETE` non filtré. Le relancer
cinq fois laisse exactement les mêmes lignes. `db:reset` est une commande séparée
qui refuse de tourner avec `NODE_ENV=production` ou contre un hôte qui n'est ni
`localhost` ni `postgres`.

## Tests

```bash
npm test                    # tout, sans réseau ni base
npm run test:e2e            # Playwright
```

`STUB_LLM=1` par défaut dans les tests : rien dans la suite par défaut n'a le droit
d'appeler un fournisseur. Un test unitaire qui dépense du quota n'est pas un test
unitaire, c'est une facture instable.

## Diagnostic

| Symptôme | Cause habituelle |
|---|---|
| l'api ne démarre pas, `Invalid environment` | une clé manque dans `.env` ; le message nomme laquelle |
| `DOCUMENT_FILE_MISSING` | le corpus n'est pas dans `seed/data/` |
| l'analyse reste en `queued` | le worker est arrêté : `npm run logs` |
| `relation already exists` au démarrage | une migration appliquée a été éditée. Ne jamais faire ça |
| l'OCR échoue | `pdftoppm` / `tesseract` absents — ils sont dans l'image api, pas sur l'hôte |
| dimension d'embedding refusée | `EMBEDDING_DIMENSIONS` ≠ 512 |

## Rollback

Les images sont taguées par commit. Revenir en arrière, c'est repointer le tag et
relancer — pas d'étape base de données, parce que les migrations d'une version qui
embarque du code sont additives uniquement. Supprimer une colonne est une release à
part, livrée seule, après que le code qui ne l'utilisait plus soit stable.
