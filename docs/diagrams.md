# Diagrammes

Tous les schémas d'architecture du projet, en **Mermaid**. Chaque bloc est
autonome : copiez-le tel quel dans un README GitHub/GitLab, une page Notion, un
ticket, [mermaid.live](https://mermaid.live) (export PNG/SVG), ou un `.md` rendu
par VS Code.

Ils décrivent l'état actuel du code — un changement de graphe, de table ou de
service se répercute ici, comme pour [architecture.md](architecture.md).

| Diagramme | Répond à |
|---|---|
| [Cas d'usage](#1-cas-dusage) | qui fait quoi avec le produit |
| [Services](#2-les-services-vue-conteneurs) | qui parle à qui, sur quel port |
| [Couches api](#3-couches-côté-api) | où atterrit une requête |
| [Graphe de l'agent](#4-le-graphe-de-lagent) | les nœuds et les deux arêtes conditionnelles |
| [Séquence d'une analyse](#5-séquence--lancer-une-analyse) | ce qui est synchrone, ce qui ne l'est pas |
| [Extraction d'un PDF](#6-extraction--décision-par-page) | couche texte, OCR, cache |
| [Modèle de données](#7-modèle-de-données) | les tables et leurs liens |
| [Cycle de vie d'un run](#8-cycle-de-vie-dun-run) | les états d'un `analysis_run` |

---

## 1. Cas d'usage

```mermaid
graph LR
  pme(["Chargé d'offres<br/>(PME)"])
  agent(["Agent TenderPilot<br/>worker + LLM"])

  subgraph TenderPilot
    uc1([S'inscrire / se connecter])
    uc2([Importer le profil entreprise])
    uc3([Déposer le corpus entreprise<br/>références, CV, attestations])
    uc4([Créer un dossier et<br/>y déposer les pièces])
    uc5([Lancer l'analyse])
    uc6([Consulter les exigences<br/>avec leur page source])
    uc7([Lire le go / no-go argumenté])
    uc8([Corriger une section du mémoire])
    uc9([Exporter le mémoire .docx])
    uc10([Suivre la consommation de tokens])
    uc11([Extraire et classer les exigences])
    uc12([Rédiger et auto-réviser les sections])
  end

  pme --- uc1
  pme --- uc2
  pme --- uc3
  pme --- uc4
  pme --- uc5
  pme --- uc6
  pme --- uc7
  pme --- uc8
  pme --- uc9
  pme --- uc10
  uc5 -.déclenche.-> uc11
  uc11 -.si go.-> uc12
  uc11 --- agent
  uc12 --- agent
```

## 2. Les services (vue conteneurs)

```mermaid
flowchart LR
  user([Navigateur])

  subgraph compose["docker compose"]
    web["<b>web</b><br/>Next.js · TS<br/>:3100"]
    api["<b>api</b><br/>Fastify · JS ESM<br/>:3000"]
    worker["<b>worker</b><br/>même image que l'api<br/>LangGraph"]
    pg[("<b>postgres</b> 16<br/>+ pgvector<br/>:5432")]
    redis[("<b>redis</b> 7<br/>BullMQ<br/>:6379")]
  end

  azure["Azure OpenAI<br/>raisonnement · volume · embeddings"]
  tavily["Tavily<br/>outil web_search"]

  user -->|HTTP| web
  web -->|"fetch, cookie de session"| api
  api --> pg
  api -->|"enqueue : analysis, index"| redis
  redis --> worker
  worker --> pg
  worker --> azure
  worker --> tavily
  api --> azure
```

Le `web` n'appelle jamais un modèle et ne touche jamais la base. L'`api` ne fait
jamais tourner le graphe : elle valide, écrit, met en file.

## 3. Couches côté api

```mermaid
flowchart LR
  r["routes/<br/><i>dispatch</i>"] --> c["controllers/<br/><i>valide, mappe le HTTP</i>"]
  c --> s["services/<br/><i>logique métier</i>"]
  s --> repo["repositories/<br/><i>tout le SQL</i>"]
  repo --> db[("postgres")]
  s --> q["queue/<br/>BullMQ"]
  q --> g["graph/<br/>nœuds LangGraph"]
  g --> a["agents/<br/>+ prompts/"]
  a --> llm["services/llm.service.js<br/><i>un seul client</i>"]
  g --> repo
  c -.zod.-> v["validators/"]
```

Une règle par flèche absente : pas de SQL dans un service, pas de logique dans un
contrôleur, pas de texte de prompt hors de `prompts/`.

## 4. Le graphe de l'agent

```mermaid
flowchart LR
  START([Dépôt du dossier]) --> ingest

  subgraph EX["Extractor"]
    direction TB
    ingest["ingest<br/><i>PDF → pages numérotées</i><br/>couche texte ou OCR"]
    extract["extractRequirements<br/><i>pages → exigences</i>"]
    classify["classifyRequirements<br/><i>éliminatoire ?</i>"]
    rubric["parseRubric<br/><i>grille de notation<br/>de CE dossier</i>"]
    ingest --> extract --> classify --> rubric
  end

  subgraph QU["Qualifier"]
    direction TB
    match["matchProfile<br/><i>exigences × profil</i>"]
    score["computeScore<br/><i>couverture pondérée</i>"]
    decide{"decide<br/>go / no-go"}
    match --> score --> decide
  end

  subgraph WR["Writer + Compliance"]
    direction TB
    draft["draft<br/><i>rédige, appelle des outils</i>"]
    comp{"compliance<br/><i>relit et refuse</i>"}
    draft --> comp
  end

  rubric --> match
  decide -->|no-go| STOP([FIN<br/>aucune rédaction])
  decide -->|go| draft
  comp -->|"refus, max 2"| draft
  comp -->|validé| DONE([Dossier prêt])
```

Les deux bornes vivent dans la condition d'arête (`shouldDraft`, `shouldRedraft`),
jamais dans un prompt. Détail des nœuds : [agents.md](agents.md).

## 5. Séquence : lancer une analyse

```mermaid
sequenceDiagram
  autonumber
  participant U as Navigateur
  participant W as web
  participant A as api
  participant R as redis
  participant K as worker
  participant P as postgres
  participant L as Azure OpenAI

  U->>W: clic « Analyser »
  W->>A: POST /tenders/:id/analyze
  A->>P: INSERT analysis_runs (status=queued)
  A->>R: enqueue analysis, jobId = tender + graphVersion + run
  A-->>W: { runId }
  Note over A,R: la requête ne porte jamais l'OCR (~35 s)

  R->>K: job
  K->>P: status=running
  W->>A: GET /tenders/:id/analysis/stream (SSE)
  A->>R: SUBSCRIBE run:<runId>
  loop chaque nœud
    K->>L: appel modèle (tier raisonnement ou volume)
    L-->>K: JSON
    K->>R: PUBLISH run:<runId> (un événement par outil rendu)
    R-->>A: événement
    A-->>W: SSE : la ligne d'outil, tout de suite
    K->>P: safeParse ok, append node_trace + llm_usage
  end
  K->>P: analysis_results, status=done

  loop tant que le run n'est pas terminé
    W->>A: GET /tenders/:id/analysis
    A->>P: SELECT run + trace
    A-->>W: trace en cours, puis résultat
  end
  Note over W,A: le sondage fait foi, le SSE n'est qu'un miroir
```

Et si l'agent appelle `ask_human` :

```mermaid
sequenceDiagram
  autonumber
  participant U as Navigateur
  participant A as api
  participant R as redis
  participant K as worker
  participant P as postgres

  K->>P: analysis_runs.pending_question
  K->>R: PUBLISH run:<runId> { type: ask }
  R-->>A: question
  A-->>U: SSE : la question et ses options
  Note over K: interrupt() : le graphe se gare sur son checkpoint,<br/>le job BullMQ se termine normalement
  K->>P: status=awaiting_human
  U->>A: POST /analyses/:runId/answer
  A->>P: entrée `human` dans node_trace
  A->>R: re-enqueue
  R->>K: job
  Note over K,P: reprise avec new Command({ resume }),<br/>le nœud entier est rejoué
```

## 6. Extraction : décision par page

```mermaid
flowchart LR
  subgraph IN["1 · Dépôt — lib/uploads.js"]
    direction TB
    up["PDF déposé"] --> bytes{"octets = %PDF ?"}
    bytes -->|non| ko["415 UPLOAD_NOT_PDF"]
    bytes -->|oui| size{"taille ≤ MAX_UPLOAD_MB ?"}
    size -->|non| ko2["413 UPLOAD_TOO_LARGE"]
    size -->|oui| store["uploads/user/sha256.pdf<br/>upsert sur (owner_id, content_hash)"]
    store --> idx["file <b>index</b><br/>IndexingService<br/><i>tout dépôt</i>"]
    store --> route{"tender_id ?"}
    route -->|défini| ana["file <b>analysis</b><br/>le graphe, au lancement<br/>de l'analyse"]
  end

  subgraph ING["2 · Extraction — ingest.node.js"]
    direction TB
    ing["nœud ingest"] --> cache{"cache sur sha256 ?"}
    cache -->|"hit, 0 illisible"| done["retour ~12 ms"]
    cache -->|miss| pages["unpdf : une entrée par page"]
    pages --> read{"isReadablePage ?"}
    read -->|oui| tl["extraction = text_layer"]
    read -->|non| ocr["pdftoppm 200 dpi<br/>puis tesseract -l fra"]
    ocr --> read2{"relu lisible ?"}
    read2 -->|oui| o["extraction = ocr"]
    read2 -->|non| u["extraction = unread<br/>la page reste une ligne"]
  end

  subgraph OUT["3 · Sortie"]
    direction TB
    agg["extraction_path du document :<br/>text_layer, ocr ou mixed"]
    chunks["document_chunks + embeddings<br/>vector(512), index HNSW cosine"]
    agg --> chunks
  end

  idx --> ing
  ana --> ing
  tl --> agg
  o --> agg
  u --> agg
```

## 7. Modèle de données

```mermaid
erDiagram
  users ||--o| company_profile : "possède"
  users ||--o{ company_references : "REF-01.."
  users ||--o{ team_members : "CV-01.."
  users ||--o{ tenders : "dépose"
  users ||--o{ documents : "possède"
  tenders ||--o{ documents : "pièces du dossier"
  tenders ||--o{ requirements : "exigences"
  tenders ||--o{ rubric_criteria : "grille de notation"
  tenders ||--o{ analysis_runs : "analyses"
  documents ||--o{ document_chunks : "pages, chunks"
  documents ||--o{ requirements : "source citée"
  analysis_runs ||--o| analysis_results : "verdict"
  analysis_runs ||--o{ section_edits : "sections du mémoire"

  users {
    uuid id PK
    text email UK
    text password_hash
  }
  tenders {
    uuid id PK
    uuid owner_id FK
    text reference
    text status
    timestamptz deadline
  }
  documents {
    uuid id PK
    uuid owner_id FK
    uuid tender_id FK "NULL = corpus entreprise"
    text kind
    text content_hash UK "cache de parsing"
    text extraction_path "text_layer|ocr|mixed|pending"
    int page_count
  }
  document_chunks {
    uuid id PK
    uuid document_id FK
    int page "NOT NULL, la provenance"
    text extraction "text_layer|ocr|unread"
    vector embedding "512, HNSW cosine"
  }
  requirements {
    uuid id PK
    uuid tender_id FK
    text category
    text obligation "eliminatoire, ..."
    text nature "capacite|procedure|notation"
    uuid source_document_id FK
    int source_page
  }
  analysis_runs {
    uuid id PK
    uuid tender_id FK
    text graph_version
    text status "queued|running|done|failed"
    jsonb node_trace
  }
  analysis_results {
    uuid id PK
    uuid run_id FK
    text verdict "go|no-go"
    jsonb blockers
    jsonb rubric_breakdown
  }
  section_edits {
    uuid id PK
    uuid run_id FK
    text section_key
    bool edited_by_human "relu par les sections suivantes"
  }
  llm_usage {
    uuid id PK
    text request_id "porté par AsyncLocalStorage"
    text tier "reasoning|volume|embedding"
    text operation
    int total_tokens
  }
```

`llm_usage` n'a pas de clé étrangère : une ligne de consommation doit survivre à
la suppression du dossier qui l'a provoquée.

## 8. Cycle de vie d'un run

```mermaid
stateDiagram-v2
  direction LR
  [*] --> queued: POST /tenders/:id/analyze
  queued --> running: le worker prend le job
  running --> running: nœud en erreur, consigné, le graphe continue
  running --> awaiting_human: l'agent appelle ask_human
  awaiting_human --> queued: POST /analyses/:runId/answer
  running --> done: analysis_results écrit
  running --> failed: erreur non rattrapable
  done --> [*]: export .docx

  note right of queued
    jobId = tender + graphVersion + run
    double-clic n'est pas deux analyses
  end note
  note right of running
    checkpoint Postgres :
    un run mort au nœud 6 reprend
  end note
  note right of awaiting_human
    l'attente est sans limite de temps :
    le checkpoint est en base.
    Trois questions par analyse au maximum
  end note
```
