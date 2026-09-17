# API

Base locale : `http://localhost:3000`. Toutes les réponses sont en JSON sauf
`GET /documents/:id/file`.

**Forme d'erreur unique**, quel que soit l'endpoint :

```json
{ "error": "Message lisible par un humain.", "code": "SNAKE_CASE_CODE" }
```

| Code | HTTP | Quand |
|---|---|---|
| `VALIDATION_FAILED` | 400 | le corps ou le paramètre n'a pas passé zod |
| `INVALID_CREDENTIALS` | 401 | e-mail ou mot de passe faux |
| `UNAUTHORIZED` | 401 | session absente ou expirée |
| `TENDER_NOT_FOUND` | 404 | l'appel d'offres n'existe pas |
| `DOCUMENT_NOT_FOUND` | 404 | le document n'existe pas |
| `ANALYSIS_NOT_FOUND` | 404 | aucune analyse pour cet appel d'offres |
| `EMAIL_TAKEN` | 409 | e-mail déjà utilisé |
| `DOCUMENT_FILE_MISSING` | 410 | le PDF n'est pas sur le disque (corpus non monté) |
| `SCHEMA_VALIDATION_FAILED` | 502 | le modèle n'a pas produit la forme attendue après une reprise |
| `LLM_REQUEST_FAILED` | 502 | le fournisseur n'a pas répondu |

---

## Santé

### `GET /health`

Vivacité. Aucun appel de dépendance.

```json
{ "status": "ok" }
```

---

## Appels d'offres

### `GET /tenders`

La liste, avec le verdict quand il existe — pour éviter N requêtes de suivi.

```json
{
  "tenders": [
    {
      "id": "4e3d9250-...",
      "reference": "AO-2026-001",
      "title": null,
      "status": "analyzed",
      "createdAt": "2026-09-17T21:00:00.000Z",
      "analysis": {
        "runId": "99dc9df5-...",
        "status": "done",
        "verdict": "no-go",
        "score": "59.1",
        "blockers": 2
      }
    }
  ]
}
```

`analysis` vaut `null` si le dossier n'a jamais été analysé.

### `GET /tenders/:id`

Le dossier et ses documents.

```json
{
  "id": "4e3d9250-...",
  "reference": "AO-2026-001",
  "status": "analyzed",
  "documents": [
    { "id": "a1b2...", "kind": "avis", "pageCount": 7, "extractionPath": "text_layer" }
  ]
}
```

`extractionPath` vaut `text_layer` ou `ocr` — c'est ainsi qu'on sait qu'un dossier
était un scan.

### `POST /tenders`

```json
{ "reference": "AO-2026-011", "title": "Refonte du SI" }
```

`201`. Dédupliqué sur `reference` : redéposer le même dossier le met à jour.

---

## Documents

### `GET /documents/:id`

Métadonnées du document.

### `GET /documents/:id/pages`

Le texte extrait, page par page. **EX-07** : une page illisible reste dans la liste
avec `readable: false` et `text: null`. L'omettre rendrait « je n'ai pas pu lire »
indiscernable de « la page était vide ».

```json
{
  "documentId": "a1b2...",
  "kind": "avis",
  "extractionPath": "ocr",
  "pageCount": 4,
  "pages": [
    { "page": 1, "article": "Article 1", "readable": true, "extraction": "ocr", "text": "..." },
    { "page": 2, "article": null, "readable": false, "extraction": "unread", "text": null }
  ],
  "unreadPages": [2]
}
```

### `GET /documents/:id/file`

Le PDF d'origine, servi **inline** (`content-type: application/pdf`).

**C'est EX-03.** L'interface pointe une citation vers
`/documents/{id}/file#page=4` et le lecteur PDF natif du navigateur saute à la
page. Pas de composant visionneuse, pas de PDF.js : une balise `<a>`.

Le chemin du fichier vient de la base, jamais de la requête : il n'y a rien à
traverser pour un appelant.

---

## Analyse

### `POST /tenders/:id/analyze`

Met l'analyse en file et rend la main tout de suite. **`202 Accepted`.**

```json
{ "runId": "99dc9df5-...", "tenderId": "4e3d9250-...", "status": "queued", "reused": false }
```

Idempotent : rappeler pendant qu'une analyse tourne renvoie le même `runId` avec
`"reused": true`. Double-cliquer ne lance pas deux graphes.

### `GET /tenders/:id/analysis`

**C'est ce que l'interface interroge**, environ toutes les secondes. La trace est
présente quel que soit le statut : une analyse en cours montre son raisonnement en
direct, une analyse échouée montre jusqu'où elle est allée.

```json
{
  "runId": "99dc9df5-...",
  "status": "done",
  "graphVersion": "v1",
  "nodeTrace": [
    { "node": "ingest", "at": "...", "summary": "4 pages lues, dont 4 par OCR", "status": "ok", "ms": 34042 },
    { "node": "decide", "at": "...", "summary": "go - 0 point(s) bloquant(s)", "status": "ok", "ms": 2 }
  ],
  "result": {
    "verdict": "go",
    "confidence": 0.83,
    "score": "50",
    "justification": "Aucune exigence éliminatoire non satisfaite...",
    "blockers": [],
    "warnings": [
      { "label": "Note technique globale", "text": "Risque sur ...", "detail": "Projection indicative..." }
    ],
    "matches": [
      { "requirementId": "...", "status": "unmet", "evidence": [], "reason": "...", "confidence": 0.9 }
    ],
    "rubricBreakdown": [{ "label": "Note technique globale", "points": 42.5, "maxPoints": 85 }],
    "unreadPages": []
  },
  "sections": [
    { "sectionKey": "team", "title": "Moyens humains", "content": "...", "editedByHuman": false }
  ]
}
```

`status` : `queued` | `running` | `done` | `failed`.

**`blockers` vs `warnings`** : un blocker est une capacité exigée que l'entreprise
n'a pas — il force le no-go. Un warning est un risque signalé à l'humain et ne
décide de rien. Voir [agents.md](agents.md#la-règle-qui-décide-dun-no-go).

`evidence` vide est une réponse légitime : l'agent n'a rien trouvé et le dit,
plutôt que de rapprocher la référence la moins éloignée.

### `PATCH /analyses/:runId/sections`

**EX-06.** Enregistre une correction humaine et la marque comme telle, pour que les
sections rédigées ensuite s'y alignent.

```json
{ "sectionKey": "team", "title": "Moyens humains", "content": "Texte corrigé." }
```

---

## Authentification

Hors périmètre du cahier des charges, présente uniquement parce que l'application
a une porte d'entrée. `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`,
`GET /auth/me`. Session JWT en cookie httpOnly. Compte de démonstration créé par le
seed : `demo@tenderpilot.local` / `demo1234`.
