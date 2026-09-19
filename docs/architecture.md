# Architecture

Voir [agents.md](agents.md) pour le comportement de l'agent,
[pipeline.md](pipeline.md) pour le chemin des données du PDF au DOCX,
[frontend.md](frontend.md) pour le web, [api.md](api.md) pour les endpoints,
[testing.md](testing.md) pour installer et tester, [deployment.md](deployment.md)
pour l'exécution.
Tous les schémas de ce document existent aussi en Mermaid, copiables, dans
[diagrams.md](diagrams.md).

## Les cinq services

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│   web    │─────▶│   api    │─────▶│ postgres │
│ Next.js  │ HTTP │ Fastify  │      │ + pgvector│
│  :3100   │◀ ─ ─ │  :3000   │      │  :5432   │
└──────────┘ SSE  └────┬─────┘      └────▲─────┘
                       │ enqueue          │
                       │ subscribe        │
                  ┌────▼─────┐      ┌─────┴────┐
                  │  redis   │◀─────│  worker  │
                  │  :6379   │ pub  │ LangGraph│
                  └──────────┘      └──────────┘
```

| Service | Rôle |
|---|---|
| `web` | Next.js. Interface uniquement : aucun appel LLM, aucun accès base |
| `api` | Fastify. Valide, dispatche, met en file. Ne fait jamais tourner le graphe |
| `worker` | Même image que l'api, commande différente. C'est ici que le graphe tourne |
| `postgres` | Vérité métier, vecteurs (pgvector) et checkpoints LangGraph |
| `redis` | File BullMQ, **et** le pub/sub qui porte les événements de run jusqu'au SSE |

**Pourquoi un worker séparé.** Une analyse complète, c'est une minute d'OCR et
d'appels modèle. Tant que c'était une promesse non attendue dans le process api,
un redémarrage de l'api perdait silencieusement toutes les analyses en cours, sans
rien pour les rejouer — constaté, pas théorique : trois analyses orphelines en une
session. BullMQ déduplique sur un `jobId` dérivé de `tender + graphVersion + run`,
donc double-cliquer « analyser » ne peut pas lancer deux fois le même graphe.

**Pourquoi Redis porte aussi les événements.** Le graphe tourne dans le worker,
et c'est l'api que le navigateur interroge : les deux sont des conteneurs
distincts, donc un appel d'outil terminé n'a aucun chemin direct vers l'écran. Le
worker publie sur `run:<runId>`, l'api s'y abonne et relaie en SSE. Redis était
déjà là pour BullMQ, avec son healthcheck — aucune dépendance de plus, aucun
service de plus.

Ce chemin ne porte **que de la fraîcheur** : tout ce qui y passe est aussi écrit
en base et arrive sur le sondage d'une seconde. Un Redis absent n'arrête pas une
analyse et ne perd pas une trace, il rend l'écran une seconde plus lent.

## Deux langages, délibérément

`apps/web` est en **TypeScript**. `apps/api` et `packages/shared` sont en
**JavaScript ESM** : pas d'étape de build, `node src/server.js` exécute la source.

Zod remplace le vérificateur de types côté api. Toute valeur qui franchit une
frontière — corps HTTP, réponse de modèle, fichier sur disque, variable
d'environnement — est *parsée* à cette frontière. À l'intérieur, elle est de
confiance. Cette ligne est toute la conception.

`packages/shared` est en JavaScript pour que l'api l'importe directement ; le web
en tire quand même ses types via `z.infer`. Un schéma dupliqué entre les deux
côtés est un bug.

## Couches côté api

```
routes/          dispatch uniquement, ~10 lignes par fichier
controllers/     valide, appelle un service, mappe le code HTTP
services/        toute la logique métier. Aucun SQL
repositories/    tout le SQL. Aucune logique métier
agents/          un agent = une classe, LlmService injecté ; contrats dans schema.js
prompts/         TOUT le texte de prompt, et rien d'autre
graph/           câblage LangGraph + nœuds
queue/           déclarations BullMQ + processors
lib/             auth, pdf, ocr, cache, env, requestContext
```

Toutes les classes prennent leurs dépendances au constructeur, ce qui les rend
testables sans base de données ni fournisseur.

## Les données

13 tables. Les colonnes qui portent une décision de conception :

| Table | Point notable |
|---|---|
| `documents.content_hash` | UNIQUE. **C'est le cache de parsing** : les mêmes octets ne sont jamais relus. Un OCR coûte ~35 s, une relecture en cache 12 ms |
| `document_chunks.page` | `NOT NULL`. La provenance est portée depuis l'extraction, jamais reconstruite. EX-03 en dépend |
| `document_chunks.extraction` | `text_layer` / `ocr` / `unread`. Une page illisible reste une ligne |
| `document_chunks.embedding` | `vector(512)`, index HNSW cosine |
| `requirements.nature` | `capacite` / `procedure` / `notation`. Décide si l'exigence peut bloquer |
| `requirements.obligation` | pas de booléen `is_eliminatory` à côté : une seule colonne ne peut pas se contredire |
| `analysis_runs.node_trace` | le fil d'activité de l'agent, en base, donc il survit à un rafraîchissement |
| `section_edits.edited_by_human` | EX-06. Une correction humaine est relue par les sections suivantes |
| `llm_usage` | une ligne par appel modèle, corrélée par `request_id` |

Le `request_id` circule sur un `AsyncLocalStorage` (`lib/requestContext.js`), pas
en paramètre : les appels qui dépensent les tokens se produisent huit niveaux sous
le handler, et le seul site d'appel qu'on oublierait de câbler est celui qui
cesserait silencieusement d'être compté.

## Migrations

Drizzle Kit, fichiers SQL générés et commités. **Une migration appliquée n'est
jamais éditée** — leçon apprise pendant ce build : la 0001 avait été supprimée puis
régénérée, et la base gardait les tables de l'ancienne ; la migration suivante est
morte sur `relation already exists`. Une base locale a pu être reconstruite ; une
base partagée, non.
