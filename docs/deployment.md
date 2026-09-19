# Exécution et déploiement

## Prérequis

- Docker + Docker Compose
- Le corpus dans `apps/api/src/db/seed/data/` (gitignoré, déposé localement)
- Les clés modèle fournies par l'organisation

Node 22 n'est nécessaire que pour développer hors conteneur.

## Démarrage sur une machine vierge

```bash
git clone <repo> && cd tenderpilot
cp .env.example .env          # puis y coller les clés modèle
cp -r /chemin/vers/corpus/* apps/api/src/db/seed/data/
npm run up                    # → web http://localhost:4100, api http://localhost:4000
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

## Un seul fichier d'environnement

`.env`, à la racine, copié depuis `.env.example` et gitignoré. Il est lu par
`npm run up` **et** par `npm run up:vps` ; les scripts hôte (`npm run db:migrate`,
`db:seed`, `dev:api`…) le passent à Node avec `--env-file=../../.env`.

Le mot de passe Postgres local est une valeur ordinaire de ce fichier, pas un
secret tiré au sort : le port n'est publié que sur `127.0.0.1`, la base n'est
jamais joignable depuis l'extérieur de la machine. Sur le VPS, `.env` contient
les vraies informations d'identification — c'est le même fichier, rempli
autrement.

Postgres n'applique `POSTGRES_PASSWORD` qu'en initialisant un volume **vide**.
Sur un `pgdata` existant il garde l'ancien, et l'api meurt sur `28P01`. Réaligner
le rôle sans perdre les données :

```bash
docker exec tenderpilot-postgres-1 psql -U tenderpilot -d tenderpilot \
  -c "ALTER USER tenderpilot WITH PASSWORD '<POSTGRES_PASSWORD de .env>'"
```

## Variables d'environnement

`.env.example` est utilisable tel quel : ports, mot de passe Postgres et
`JWT_SECRET` ont déjà une valeur qui marche. **Seules les clés modèle sont à
remplir** — elles sont fournies par l'organisation et ne peuvent pas avoir de
défaut.

| Clé | À remplir | Note |
|---|---|---|
| `LLM_URL` · `LLM_API_KEY` · `LLM_MODEL` | **oui** | tier raisonnement (gpt-5.5) |
| `AZURE_OPENAI_API_KEY` · `AZURE_OPENAI_ENDPOINT` | **oui** | tier volume (gpt-4.1) |
| `JWT_SECRET` | non en local | `tenderpilot123` par défaut, aucune longueur imposée ; **à régénérer sur un serveur public** (`openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | non en local | `tenderpilot123` par défaut, le port n'écoute que sur `127.0.0.1` ; à changer sur un serveur |
| `EMBEDDING_MODEL` · `EMBEDDING_DIMENSIONS` | non | `embedder-small-3`, **512** |
| `TAVILY_API_KEY` | non | absente = l'outil `web_search` n'est pas proposé |
| `STUB_LLM` | non | `1` = aucun appel fournisseur (tests, CI) |
| `OCR_LANG` | non | packs tesseract joints par `+`, défaut `fra+eng` ; les deux sont dans l'image api |

`EMBEDDING_DIMENSIONS` doit valoir 512 : la colonne `vector(512)` est figée dans la
DDL, et un écart échoue à l'insertion.

**Aucune clé fournisseur n'est jamais commitée.** `.env` est gitignoré ;
`.env.example` ne contient que des valeurs de développement, jamais un secret
réel. Une clé en clair dans le dépôt est éliminatoire.

## Les services

| Service | Port conteneur | Port hôte publié | Exposé |
|---|---|---|---|
| `web` | 4100 | `WEB_HOST_PORT` (déf. 4100) | 127.0.0.1 |
| `api` | 4000 | `API_HOST_PORT` (déf. 4000) | 127.0.0.1 |
| `worker` | — | — | non (pas de port) |
| `postgres` | 5432 | `POSTGRES_HOST_PORT` (déf. 5433) | 127.0.0.1 |
| `redis` | 6379 | — | non |

**Le même numéro des deux côtés** : l'api écoute 4000 et le web 4100 dans le
conteneur comme sur l'hôte. Seul le port hôte est une variable, et il est publié
sur `127.0.0.1` uniquement : rien n'est joignable
depuis l'extérieur sans passer par le reverse proxy. Sur une machine partagée,
vérifier avant de choisir :

```bash
ss -tlnp | grep -E ':(4000|4100|5433)\b'   # vide = libre
```

En production sur le VPS, `web` n'est pas démarré du tout : il est hébergé par
Vercel. Voir *Mise en production* plus bas et `npm run up:vps`.

`postgres` écrit sur un volume nommé : `npm run down` ne détruit pas la base.
Il faut `docker compose -f docker/docker-compose.yml --env-file .env down -v`
pour cela — volontairement long, ça n'est pas une commande qu'on tape distrait.

## Mise en production — web sur Vercel, api sur le VPS

Les deux moitiés sont déployées séparément.

| Moitié | Où | Hôte |
|---|---|---|
| web (Next.js) | Vercel | `tenderpilot.ouedghiri.dev` |
| api + worker + postgres + redis | VPS, derrière nginx | `api.tenderpilot.ouedghiri.dev` |

Le web ne fait **aucun appel serveur** : tous les composants qui chargent des
données sont des composants client, et ils passent par
[`lib/api/client.ts`](../apps/web/lib/api/client.ts). Le navigateur est donc le
seul client que l'api ait jamais, et le contrat entre les deux moitiés tient en
deux points : le CORS et le cookie de session.

Le cookie est `HttpOnly; SameSite=Lax; Secure`, lié à son hôte. `Lax` suffit
parce que les deux hôtes partagent le domaine enregistrable `ouedghiri.dev` :
les appels sont *same-site*. **Poser le front sur une URL `*.vercel.app` casse
ça** — il faudrait passer le cookie en `SameSite=None`, ce qui est une vraie
perte de protection CSRF. Le domaine personnalisé n'est pas cosmétique.

`Secure` impose HTTPS : tant que certbot n'a pas tourné, une connexion ne tient
pas.

### 1. Le VPS

`npm run up` démarre les cinq services, web compris — c'est ce qu'il faut en
local. En production le web est chez Vercel, donc :

```bash
npm run up:vps     # api + worker + postgres + redis, sans le conteneur web
npm run logs:vps
npm run down:vps
```

`docker/docker-compose.vps.yml` se superpose au fichier de base et gare le
service `web` derrière un profil jamais activé : Compose ne sait pas supprimer
un service depuis une surcharge. Le fichier de base seul continue de démarrer
les cinq services.

Dans `.env`, à la racine :

```bash
NODE_ENV=production
API_HOST_PORT=4000
POSTGRES_HOST_PORT=5433

# l'origine EXACTE du front Vercel : renvoyée telle quelle en
# Access-Control-Allow-Origin. Un schéma ou une barre finale en trop, et tous
# les appels échouent en CORS.
WEB_ORIGIN=https://tenderpilot.ouedghiri.dev

# le port publié, pas 5432, si l'hôte a déjà un postgres
DATABASE_URL=postgres://tenderpilot:tenderpilot@localhost:5433/tenderpilot
```

`NEXT_PUBLIC_API_URL` ne sert plus ici : il est défini côté Vercel. Il reste
dans `.env.example` pour la pile complète en local.

### 2. Le vhost nginx

Un seul, versionné dans [`docs/nginx/`](nginx/), en HTTP simple — certbot ajoute
lui-même le bloc 443 et la redirection.

```bash
sudo cp docs/nginx/api.tenderpilot.ouedghiri.dev.conf /etc/nginx/sites-available/api.tenderpilot.ouedghiri.dev
sudo ln -s /etc/nginx/sites-available/api.tenderpilot.ouedghiri.dev /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`client_max_body_size` vaut `32m`, au-dessus de `MAX_UPLOAD_MB` (25) : en
dessous, nginx renvoie un 413 avant que l'api ne voie la requête, et le message
d'erreur n'est plus le sien.

### 3. Le certificat

L'enregistrement DNS `api.tenderpilot.ouedghiri.dev` doit pointer sur l'IP de la
machine **avant** certbot : le challenge HTTP-01 passe par le port 80 d'ici.

```bash
dig +short api.tenderpilot.ouedghiri.dev
sudo certbot --nginx -d api.tenderpilot.ouedghiri.dev
```

`tenderpilot.ouedghiri.dev`, lui, pointe vers Vercel (CNAME) et son certificat
est géré par Vercel — pas par certbot.

Si le domaine est derrière un proxy (Cloudflare), désactiver le proxy le temps
du challenge, ou utiliser un challenge DNS-01.

### 4. Vercel

Projet pointé sur le dépôt, avec :

| Réglage | Valeur |
|---|---|
| Root Directory | `apps/web` |
| Framework | Next.js (détecté) |
| Domaine | `tenderpilot.ouedghiri.dev` |
| `NEXT_PUBLIC_API_URL` | `https://api.tenderpilot.ouedghiri.dev` |

`NEXT_PUBLIC_API_URL` est figé dans le bundle client au build : le changer
impose un redéploiement, pas un restart.

Le dépôt est un workspace npm et `@tenderpilot/web` dépend de
`@tenderpilot/shared`. Vercel installe depuis la racine du dépôt et résout le
workspace seul ; c'est `outputFileTracingRoot` dans
[`next.config.ts`](../apps/web/next.config.ts) qui garantit que
`packages/shared` est bien embarqué.

Les déploiements de prévisualisation ont une URL unique à chaque fois et ne
correspondent donc pas à `WEB_ORIGIN` : ils sont refusés en CORS. C'est
volontaire — seule la production parle à cette api.

### 5. Vérifier

```bash
curl -fsS http://127.0.0.1:4000/health                   # depuis le VPS
curl -fsS https://api.tenderpilot.ouedghiri.dev/health   # à travers nginx

# le préflight CORS, avec l'origine réelle du front
curl -sS -o /dev/null -D - -X OPTIONS \
  -H 'Origin: https://tenderpilot.ouedghiri.dev' \
  -H 'Access-Control-Request-Method: POST' \
  https://api.tenderpilot.ouedghiri.dev/auth/login | grep -i access-control
```

Le préflight doit renvoyer `access-control-allow-origin` avec l'origine exacte
et `access-control-allow-credentials: true`. Sans le second, le cookie ne part
jamais et la connexion échoue sans erreur visible.

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
| `bind: address already in use` au `up` | le port hôte est pris ; changer `API_HOST_PORT` / `WEB_HOST_PORT` / `POSTGRES_HOST_PORT` |
| tous les appels bloqués en CORS | `WEB_ORIGIN` ≠ l'origine réelle du navigateur (schéma, port ou barre finale) |
| la session ne tient pas après login | cookie `Secure` sans HTTPS, ou `NODE_ENV` ≠ `production` |
| l'interface appelle `localhost:4000` en prod | `NEXT_PUBLIC_API_URL` est figé au build : redéployer sur Vercel |
| le login renvoie 200 mais l'utilisateur reste déconnecté | cookie `Secure` sans HTTPS, ou front sur `*.vercel.app` (cross-site, `SameSite=Lax` non envoyé) |
| les prévisualisations Vercel échouent en CORS | attendu : `WEB_ORIGIN` ne vaut que l'origine de production |
| 413 à l'upload d'un PDF | `client_max_body_size` nginx < `MAX_UPLOAD_MB` |

## Rollback

Les images sont taguées par commit. Revenir en arrière, c'est repointer le tag et
relancer — pas d'étape base de données, parce que les migrations d'une version qui
embarque du code sont additives uniquement. Supprimer une colonne est une release à
part, livrée seule, après que le code qui ne l'utilisait plus soit stable.
