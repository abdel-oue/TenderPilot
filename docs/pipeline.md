# Le pipeline de données

Ce que deviennent des octets de PDF entre le dépôt et le mémoire exporté. Pour le
*comportement* de l'agent (outils, boucles, refus), voir [agents.md](agents.md) ;
pour les services et les tables, [architecture.md](architecture.md).

```
PDF déposé
   │  lib/uploads.js        octets validés (%PDF), écrits sous
   │                        uploads/<owner>/<tender|company>/<sha256>.pdf
   ▼
documents (ligne)          upsert sur (owner_id, content_hash), extraction_path = 'pending'
   │
   ├─ TOUT dépôt ─────────────────────────────▶ file `index`  ──▶ IndexingService
   │                                                               (ingest + embeddings)
   └─ document de dossier (tender_id défini) ──▶ file `analysis` ▶ le graphe
        quand l'analyse est lancée                                  (ingest, puis 9 nœuds)
```

L'extraction n'arrive **jamais** dans le handler HTTP. Un OCR complet, c'est ~35 s ;
une requête qui l'attend est une requête qui expire.

---

## 1. Entrée : le fichier

`lib/uploads.js`, appelé par `DocumentService.upload()`.

- Le type est décidé sur les **octets** (`%PDF`), pas sur l'en-tête annoncé par le
  navigateur. Un `.pdf` qui n'en est pas un est refusé en `UPLOAD_NOT_PDF` (415).
- Taille plafonnée par `MAX_UPLOAD_MB` (25 par défaut) → `UPLOAD_TOO_LARGE` (413).
- Le nom du fichier sur disque **est** le sha256 de son contenu. Redéposer le même
  PDF réécrit le même chemin : pas de doublon, et le cache d'extraction est déjà
  chaud.
- Rien ne touche la base avant que les octets ne soient validés et écrits : un
  fichier refusé ne laisse aucune ligne derrière lui.

La ligne `documents` est upsertée sur `(owner_id, content_hash)` : les mêmes octets
déposés par deux comptes sont deux documents, parce que renvoyer l'id de l'autre
serait une fuite.

## 2. Aiguillage : dossier ou entreprise

| `tender_id` | Nature | Qui le lit |
|---|---|---|
| `NULL` | corpus d'entreprise (attestations, mémoires rendus, profil) | file `index`, à l'upload |
| défini | pièce d'un dossier (CPS, RC, avis) | file `index` à l'upload, **et** le graphe quand l'analyse est lancée |

**Tout dépôt part à l'indexation**, pièce de dossier comprise. Ça a longtemps
ressemblé à payer l'OCR deux fois, donc les pièces de dossier étaient exclues —
mais les chunks que l'analyse écrit n'ont pas de vecteur et rien d'autre ne les
remplissait jamais, si bien que `search_documents(corpus='dossier')` ne pouvait
renvoyer que zéro ligne, alors que l'outil est annoncé au modèle. Ça ne coûte rien :
l'extraction est mise en cache sur l'empreinte du contenu, et l'indexeur ne regarde
que les chunks dont l'`embedding` est encore NULL.

## 3. Extraction : chaque page, couche texte ou OCR

`graph/nodes/ingest.node.js`, qui s'appuie sur `lib/pdf.js`, `lib/ocr.js` et
`lib/cache.js`. Ce nœud est partagé : le graphe et l'indexeur passent par lui.

```
readFile → sha256 ─┬─ cache ─┬─ 0 page illisible ────────────▶ retour (12 ms)
                   │         ├─ n illisibles, path 'text_layer' ─▶ réparation OCR
                   │         └─ n illisibles, path 'mixed'|'ocr' ─▶ retour (déjà tenté)
                   │
                   └─ miss
                        │
                        ├─ unpdf : extractPages(), une entrée par page
                        │
                        ├─ isReadablePage() sur CHAQUE page
                        │     lisible ──▶ extraction = 'text_layer'
                        │     douteuse ─▶ pdftoppm -f N -l M -r 200 → PNG
                        │                 → tesseract -l $OCR_LANG (fra+eng)
                        │                   relu par isReadablePage() :
                        │                     lisible ──▶ 'ocr'
                        │                     sinon ───▶ 'unread'
                        ▼
              extraction_path du document = 'text_layer' | 'ocr' | 'mixed',
              déduit de ce que les pages se sont révélées être
```

Les décisions qui comptent :

- **La décision est par page, pas par document.** Un dossier est rarement d'une
  seule matière : un CPS de 60 pages avec cinq annexes scannées prenait autrefois le
  chemin texte en entier, et ces cinq pages finissaient `unread` sans jamais passer
  par l'OCR — invisibles pour l'extracteur. Une seule page lisible suffisait à
  condamner les autres.
- **Le coût ne se dégrade pas pour autant.** Les pages à OCRiser sont regroupées en
  **plages contiguës** (`toPageRanges`), une invocation `pdftoppm` par plage : un
  scan intégral reste une seule rastérisation — le coût qu'il a toujours eu — et
  cinq annexes dispersées coûtent cinq appels courts au lieu de rastériser 60 pages.
  Pas de constante de seuil, pas de branche « quelques pages » contre « tout ».
- **Le numéro de page est lu dans le nom du fichier produit**, jamais compté depuis
  la boucle : avec `-f`/`-l`, la sortie commence à la première page de la plage, et
  compter renommerait la page 56 en page 1.
- **Lisible ne veut pas dire long.** `isReadablePage()` garde le plancher de 40
  caractères non blancs — une page scannée rend régulièrement une poignée de glyphes
  parasites, et `length > 0` l'aurait classée lisible — et y ajoute deux tests de
  forme : un ratio lettres+chiffres sous 0,5, ou plus d'un dixième de caractères de
  remplacement (`U+FFFD`, contrôles), et la page part à l'OCR. C'est ce qui rattrape
  un PDF encodé en CID sans table ToUnicode : des centaines de caractères, tous
  faux, qui passaient le comptage et dont le modèle tirait des exigences.
- **C'est une heuristique de forme, pas un modèle de langue.** Une page d'un script
  inattendu partira à l'OCR : ~10 s pour récupérer le même texte. Se tromper dans ce
  sens-là est sans conséquence.
- **La sortie OCR est tenue au même standard** que la couche texte : elle repasse
  par `isReadablePage()`.
- **DPI figé à 200** pour que le même scan rende le même texte sur toute machine.
- **Une page illisible reste une ligne**, avec `extraction = 'unread'`. Jamais
  supprimée, jamais renvoyée comme page vide : vide se lirait « cette page ne dit
  rien », et c'est ainsi qu'un agent invente des exigences pour un scan. C'est
  cette liste que l'interface affiche en bandeau.
- **Aucune page lisible et pas d'OCR disponible** ⇒ erreur bruyante, pas zéro
  exigence. `pdftoppm` et `tesseract` sont dans l'image api, pas sur votre hôte. Si
  *certaines* pages ont été lues, le document passe avec ses pages `unread` : un
  document partiellement lu et honnête vaut mieux qu'un dossier refusé.
- **Une page qui fait échouer tesseract** est poussée avec un texte vide plutôt
  que de perdre les six autres.

### Le cache de parsing

Il n'y a pas de table de cache. `documents.content_hash` est la clé,
`document_chunks` est le contenu : mêmes octets ⇒ pages déjà en base ⇒ on les
relit. ~35 s d'OCR contre ~12 ms. C'est ce qui rend l'itération sur les prompts
supportable. Le cache est **par propriétaire** (`getCachedPages(hash, ownerId)`).

### La réparation, et pourquoi elle n'arrive qu'une fois

Un document rangé avant que le routage par page n'existe garde ses pages `unread` :
le cache les rend telles quelles. À la lecture suivante, ingest OCRise ces pages et
met les lignes à jour — mais **seulement si `extraction_path` vaut encore
`'text_layer'`**, c'est-à-dire si l'OCR n'a jamais été tenté sur ce document.

La réparation repositionne ensuite le document en `'mixed'` ou `'ocr'`, qu'elle ait
récupéré quelque chose ou non. C'est ce qui borne la reprise : une page réellement
blanche (intercalaire, page de signature) coûte une passe d'OCR une fois, pas une
par analyse. La borne est l'état déjà stocké — ni colonne supplémentaire, ni
compteur.

Un chunk réparé garde son `embedding` à NULL : il reste donc dans
`findUnembeddedChunks()` et le prochain `db:index` le plonge, sans cas particulier.

## 4. Découpage : un chunk = une page

`document_chunks` : une ligne par page, jamais un découpage à taille fixe.

| Colonne | Pourquoi |
|---|---|
| `page` | `NOT NULL`. Portée depuis l'extraction, jamais reconstruite. C'est ce qui rend EX-03 (« ouvrir le PDF à la bonne page ») possible |
| `extraction` | `text_layer` / `ocr` / `unread` : la provenance suit le texte |
| `content` | le texte de la page |
| `embedding` | `vector(512)`, HNSW cosine, **NULL tant qu'on n'a pas indexé** |

Un chunk = une page parce que la citation doit rester vérifiable. Un chunk à cheval
sur deux pages ne peut plus dire de laquelle il vient.

Réingérer un document remplace **les chunks de ce document seulement**
(`deleteChunks(documentId)`), jamais un effacement global.

## 5. Embeddings : tout ce que le compte possède

`services/indexing.service.js`, déclenché par la file `index`. `indexCorpus(ownerId)`
parcourt **tous** les documents du compte — corpus d'entreprise et pièces de
dossier.

- Ne regarde que les chunks dont `embedding IS NULL` ⇒ **reprise gratuite**, un run
  interrompu repart où il s'est arrêté au lieu de repayer les vecteurs.
- Par lots de 32 : un mémoire fait ~30 pages, et 32 allers-retours au lieu d'un
  seul, c'est toute la latence de l'étape.
- Une page `unread` n'a pas de texte à plonger : elle reste en base, elle n'est pas
  indexée.
- Une attestation illisible n'arrête pas les deux mémoires derrière elle : l'échec
  est rapporté dans le résumé, pas avalé.

Les pièces du dossier sont plongées elles aussi : le graphe les lit page par page,
mais `search_documents(corpus='dossier')` a besoin de leurs vecteurs pour retrouver
où une clause est écrite.

Sans index, `search_documents` ne peut rien renvoyer, et le Writer marque chaque
section `[A COMPLETER PAR L'HUMAIN]`. Le garde-fou est correct, mais il se
déclencherait faute de matière plutôt que faute de preuve — ce qui n'est pas la
même chose. D'où `npm run db:index`.

## 6. Le graphe : pages → verdict → mémoire

Dix nœuds. Le comportement est détaillé dans [agents.md](agents.md) ; ici, ce que
chacun transforme.

| Nœud | Entrée | Sortie | Modèle |
|---|---|---|---|
| `ingest` | documents du dossier | `pages[]` numérotées + étiquetées | — |
| `extractRequirements` | pages lisibles, **une passe par document**, puis un audit par lot de 8 pages | lignes `requirements` avec page + citation verbatim, vérifiée sur la page | volume |
| `classifyRequirements` | chaque exigence + sa citation | `obligation` re-décidée, concurrence 5 | volume |
| `parseRubric` | pages lisibles | `rubric_criteria` de CE dossier | volume |
| `matchProfile` | exigences × profil + références + CV | `met` / `partial` / `unmet` / `unknown` + confiance, **preuves contrôlées** | **raisonnement** + volume (contrôle) |
| `computeScore` | exigences + correspondances | couverture 0-100, projection sur la grille | — (pur) |
| `decide` | score + correspondances | `go` / `no-go`, blockers, alertes | — (pur) |
| `draft` | exigences groupées par catégorie | sections rédigées, avec outils | **raisonnement** |
| `reconcileDecision` | l'état après rédaction | le verdict rejugé — même code que `decide` | — (pur) |
| `compliance` | chaque section + ses citations | approuvée ou **refusée** avec instructions | volume |

Pourquoi ces découpes :

- **`extractRequirements` fait une passe par document, pas par chunk.** Une
  condition du règlement et le seuil de la grille doivent être visibles par le même
  appel ; et par document, `sourceDocumentId` est connu sans que le modèle ait à le
  deviner.
- **L'extraction est relue par lots de 8 pages.** Le premier appel optimise le
  rappel sur tout le document ; l'audit repasse page par page, doit rendre compte
  de **chaque** page du lot (sinon l'étape échoue), et récupère les omissions. Le
  compte d'omissions récupérées apparaît dans la trace.
- **Chaque citation est vérifiée sur sa page source** (`lib/provenance.js`) avant
  d'être écrite : le texte cité doit se retrouver dans la page, aux ellipses près
  et sans recoller des fragments dans un ordre que le document n'a pas. Une
  citation non retrouvée reste visible, marquée non vérifiée — elle n'est jamais
  comptée comme point bloquant, et l'écart remonte comme erreur d'étape.
- **`classifyRequirements` ne re-décide qu'un champ.** L'extracteur optimise le
  rappel sur tout un dossier ; cette passe optimise la précision sur la seule
  question qui décide du verdict. C'est la clause discrète de la page 47.
- **`computeScore` et `decide` n'ont ni SQL ni modèle**
  (`services/score.service.js`), précisément pour être testables exactement. Un
  verdict faux, c'est le produit qui échoue.
- **La grille est des lignes, jamais des constantes.** Chaque dossier note
  différemment, et le seuil éliminatoire vit dans sa grille, pas dans notre code.

### Ce qui bloque, et ce qui ne bloque pas

Seule une exigence `obligation = eliminatoire` **et** `nature = capacite` non
satisfaite (`unmet`, `unknown` ou `partial`) devient un blocker. Un `unknown`
bloque volontairement : une exigence éliminatoire qu'on n'a pas su évaluer est un
risque à remonter, pas un trou à cacher. Un `partial` aussi : « 2 références sur
les 3 exigées » est un rejet en commission.

Deux exigences échappent au calcul, et les deux sont dans le code :

- une **attestation administrative renouvelable** (fiscale, CNSS, régularité) se
  demande au guichet avant le dépôt — elle sort en avertissement, jamais en no-go
  (`lib/renewableAttestations.js`) ;
- une exigence dont la **citation n'a pas été vérifiée** sur sa page source
  (`quoteVerified === false`) ne disqualifie personne ; l'écart est remonté comme
  erreur d'étape.

Et un `met` sur une capacité éliminatoire est contrôlé avant d'être cru :
identifiants de preuve recoupés contre les enregistrements de l'entreprise
(`lib/evidence.js`), puis jugés un par un par l'agent Evidence. Un contrôle
négatif, absent ou sauté retombe en `unknown`, donc en point bloquant. Détail :
[agents.md](agents.md#le-contrôle-des-preuves).

Le score de couverture n'est calculé que sur les `capacite`, pondéré par obligation
(`eliminatoire` 3, `obligatoire` 2, `optionnelle` 1) et crédité par statut (`met` 1,
`partial` 0,5, le reste 0). Une procédure ne dit rien de l'aptitude de l'entreprise
et n'a pas à tirer la couverture vers le bas.

Une projection sous le seuil de la grille est une **alerte**, jamais un blocage.

### Écritures pendant le run

| Quoi | Où | Quand |
|---|---|---|
| exigences | `requirements` | `extractRequirements`, après `deleteByTender` du seul dossier |
| grille | `rubric_criteria` | `parseRubric`, idem |
| trace | `analysis_runs.node_trace` | un callback **au niveau du graphe** : ajouter un nœud ne peut pas oublier de tracer |
| sections | `section_edits` | `draft`, puis relues par `compliance` |
| coût | `llm_usage` | un appel = une ligne, y compris une reprise de schéma et un 429, corrélés par `request_id` |

Un nœud qui échoue **écrit son erreur et laisse le graphe continuer** : un dossier à
moitié analysé avec une erreur explicite vaut mieux que pas de réponse.

`request_id` circule sur un `AsyncLocalStorage` (`lib/requestContext.js`), pas en
paramètre : les appels qui dépensent les tokens se produisent huit niveaux sous le
handler, et le seul site d'appel qu'on oublierait de câbler est celui qui cesserait
silencieusement d'être compté.

## 7. Toute sortie de modèle passe par zod

C'est la même frontière partout, du HTTP au disque :

```
appel modèle → texte → safeParse(schéma)
                          │ ok     ▶ l'objet est de confiance à l'intérieur
                          └ échec  ▶ UNE reprise, les issues zod réinjectées dans
                                     le prompt, puis SCHEMA_VALIDATION_FAILED (502)
```

Jamais un `JSON.parse` suivi d'un espoir. Les schémas vivent dans
`packages/shared/src/schemas/` et sont importés des deux côtés — l'api directement,
le web via `z.infer`.

## 8. Sortie : le DOCX

`services/export.service.js`. Sections ordonnées `technical → team → schedule →
financial → administrative` (un mémoire qui ouvre sur les pièces administratives se
lit à l'envers).

L'export est **volontairement pas propre** : les `[A COMPLETER PAR L'HUMAIN]` sont
recopiés tels quels et la page de verdict annonce les blockers d'abord. Un export
qui nettoierait discrètement ces marqueurs rendrait un fichier qui a l'air fini et
ne l'est pas — exactement l'échec que ce produit évite, réintroduit à la dernière
étape.

Un no-go n'a pas de sections : l'export répond `NOTHING_TO_EXPORT` (409).

## 9. Ce qui rejoue, et ce qui ne rejoue pas

| Action | Effet |
|---|---|
| redéposer le même PDF | même chemin, même ligne, cache d'extraction réutilisé |
| relancer une analyse en cours | rien : BullMQ déduplique sur `jobId` = hash(`tender + graphVersion + run`) |
| relancer une analyse terminée | nouveau run ; exigences et grille du dossier remplacées |
| relancer `db:index` | ne plonge que ce qui ne l'est pas encore |
| relire un document `text_layer` avec des pages illisibles | ces pages seules sont OCRisées, le document passe en `mixed` |
| le relire encore | retour immédiat : `extraction_path` dit que l'OCR a déjà été tenté |
| relancer `db:seed` | mêmes lignes. Jamais de `TRUNCATE`, `DROP` ni `DELETE` non filtré |
| reprise après crash du worker | checkpointer Postgres, reprise au nœud, clé sur `GRAPH_VERSION` |

`GRAPH_VERSION` est incrémentée à tout changement de nœud ou de prompt : un
checkpoint d'un ancien graphe n'est jamais repris dans un nouveau.
