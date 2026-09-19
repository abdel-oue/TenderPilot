# Comment l'agent fonctionne

Ce document décrit ce que le système fait entre le dépôt d'un PDF et un verdict.
Pour l'architecture technique, voir [architecture.md](architecture.md). Pour les
endpoints, voir [api.md](api.md).

## Le graphe

Neuf nœuds, deux arêtes conditionnelles. Le graphe est un `StateGraph` LangGraph
(`apps/api/src/graph/index.js`) avec un checkpointer Postgres.

Le diagramme vit dans [diagrams.md](diagrams.md#4-le-graphe-de-lagent) — une seule
copie, pour qu'un changement de nœud ne se répercute qu'à un endroit. En texte :

```
ingest → extractRequirements → classifyRequirements → parseRubric
      → matchProfile → computeScore → decide ─[no-go]─→ FIN
                                             └─[go]───→ draft → compliance
                                                          ↑         │
                                                          └──refus──┘  (max 2)
```

## Les deux arêtes conditionnelles

Ce sont elles qui font la différence entre un pipeline et un agent.

### `decide` — un no-go ne rédige jamais

Rédiger un mémoire technique pour un dossier dont l'entreprise est écartée est
exactement le gaspillage que ce produit existe pour éviter. L'arête coupe avant
le Writer : zéro token dépensé sur un dossier perdu.

### `compliance` — une section refusée repart au Writer

C'est le verbe « réviser » du critère de profondeur agentique. Le Compliance relit
la section contre ses propres citations et la **refuse** si elle ne tient pas. La
section repart au Writer avec des instructions précises.

**Les deux boucles sont bornées dans la condition d'arête, jamais dans un prompt.**
`MAX_REDRAFTS = 2`. On ne demande pas au modèle de s'arrêter : on l'en empêche.
Une boucle d'agent sans borne dans une démo en direct est un mode de panne.

## Les outils

Les définitions partent au modèle dans la requête (`tools`), le modèle **choisit**
ce qu'il appelle, et `LlmService.runToolLoop` exécute puis réinjecte les résultats
jusqu'à ce qu'il arrête d'appeler. Ce n'est pas une recherche codée en dur
enveloppée dans une boucle : les appels sont les siens.

Le **Writer** et le **Matcher** portent la ceinture. Le Matcher surtout : chaque
`unknown` qu'il produit devient un bloquant dans `findBlockers`, donc un `unknown`
qu'un appel d'outil aurait levé est une faute, pas de la prudence.

| Outil | Ce qu'il fait | Pourquoi il existe |
|---|---|---|
| `search_documents` | pgvector sur le corpus entreprise **ou** sur ce dossier (`corpus`) | citer REF-07 **au lieu de l'inventer** ; retrouver où une clause est écrite |
| `get_company_facts` | profil / références / équipe / marchés passés, en structuré et filtrable | le vectoriel ne répond pas à « CA 2024 ? » ni à « références > 5 MDH en assainissement » |
| `read_source_page` | relit le texte exact d'une page, **avec repli OCR** | vérifier une citation avant de déclarer une exigence éliminatoire |
| `get_run_state` | étapes, appels, exigences, verdict courant | le verbe « mémoriser » : empêche de relancer une requête déjà échouée |
| `check_dossier_checklist` | pièces exigées × documents réellement déposés | transforme « il manque peut-être X » en fait vérifié |
| `compute_deadline` | jours calendaires et ouvrés avant l'échéance | les modèles se trompent sur l'arithmétique des dates **avec assurance** |
| `calculate` | arithmétique exacte (caution 1,5 %, TVA, pénalités) | un montant faux dans un mémoire est l'échec le plus visible possible |
| `get_current_date` | la date du jour | sans lui le modèle raisonne depuis sa date d'entraînement |
| `simulate_score` | rejoue le verdict sous hypothèse | transforme un no-go en conseil actionnable |
| `web_search` | Tavily, extraits ou page complète | marchés similaires attribués, contexte acheteur. **Absent si aucune clé** |

Trois outils écartés volontairement : un scraper de marchespublics.gov.ma (HTML
fragile, casse en démo), une traduction FR/AR (spéculatif tant qu'aucun dossier
arabe n'arrive), et un outil « appeler un sous-agent » — le graphe est
l'orchestrateur, il n'en faut pas un second.

### Ce que le dirigeant lit

La trace n'est pas pour nous. `get_company_facts` ne veut rien dire pour un
dirigeant de PME, et un flux qu'il ne peut pas lire ne prouve rien — tout
l'intérêt d'afficher les étapes est que quelqu'un puisse les vérifier.

Chaque appel d'outil est donc affiché en trois parties, et le découpage est
volontaire :

| | D'où ça vient | Pourquoi |
|---|---|---|
| **la raison** | du modèle, via un argument `raison` présent sur **tous** les outils | c'est son raisonnement réel, pas notre reformulation — et c'est gratuit, il remplit ce champ sur l'appel qu'il faisait déjà |
| **le résultat** | de `lib/narration.js`, à partir des vrais arguments et du vrai retour | déterministe, impossible à halluciner |
| **le nom technique** | tel quel, en retrait | un lecteur technique veut voir qu'un vrai outil nommé a tourné |

Le résultat n'est **jamais** demandé au modèle. Un agent qui raconte ses propres
résultats, c'est exactement comme ça qu'apparaît « j'ai trouvé 3 références » sous
une recherche qui n'en a trouvé aucune. `raison` est optionnel sur tous les
outils : un modèle qui l'oublie obtient quand même sa réponse, la ligne de
résultat s'affiche seule. Et `raison` est retiré des arguments avant le dispatch,
donc aucune implémentation d'outil n'a à savoir que ce champ existe.

`calculate` n'utilise pas `eval` : l'expression est écrite par un modèle qui vient
de lire le PDF d'un tiers. C'est une descente récursive sur six opérateurs, sans
identifiant ni appel de fonction dans la grammaire — il n'y a rien d'où s'échapper.

Un outil ne lève jamais d'exception dans le graphe : il renvoie `{ error }`. Un
outil cassé dégrade une étape, il ne tue pas un dossier.

`web_search` n'est pas enregistré du tout sans `TAVILY_API_KEY` — le modèle ne peut
pas appeler quelque chose qui échouerait. Et si Tavily tombe, la réponse est
« recherche indisponible », jamais une liste vide qui se lirait comme « rien n'existe ».

## La règle qui décide d'un no-go

Une exigence porte une **nature**, et c'est elle qui décide si elle peut bloquer :

| nature | exemple | peut bloquer ? |
|---|---|---|
| `capacite` | « être certifié ISO 22301 », « 4 références attestées en éducation » | **oui** |
| `procedure` | « déposer le pli avant le 12/03 à 09h30 », « joindre l'acte d'engagement » | non |
| `notation` | « obtenir au moins 60 points sur 85 » | non |

**Seule une `capacite` non satisfaite écarte l'entreprise.** Une `procedure` est une
tâche de la réponse, pas une preuve d'inéligibilité : l'entreprise ne peut pas
« échouer » aujourd'hui à déposer un pli qu'elle n'a pas encore rédigé. Une
`notation` est décidée par la commission après le dépôt.

Sans cette distinction, chaque dossier revenait en no-go parce que le profil ne
disait rien d'une date de dépôt. Le corpus est 6 go / 4 no-go ; un agent qui
répond « non » systématiquement se trompe six fois sur dix.

Le score projeté sur la grille de notation est une **alerte**, jamais un blocage.
Déduire « vous ferez moins de 60/85 » de « 38 % des exigences sont justifiées »
n'est pas une inférence défendable.

## Ce que l'agent refuse de faire

- **Inventer une référence.** Le Writer ne cite que ce que les outils ont renvoyé.
  Le Compliance vérifie chaque `REF-xx` / `CV-xx` du texte contre la liste des
  citations, **sans appeler de modèle** : une référence fabriquée se détecte sans
  jugement.
- **Masquer une lacune.** Sans élément probant, la section porte
  `[A COMPLETER PAR L'HUMAIN]` et dit ce qui manque. C'est le comportement voulu,
  pas un échec.
- **Interpréter une page illisible.** Une page que l'OCR n'a pas pu lire est
  stockée avec `extraction: 'unread'` et remontée telle quelle. Elle n'est jamais
  ni supprimée ni renvoyée comme texte vide — vide se lirait « cette page ne dit
  rien », et c'est ainsi qu'un agent invente des exigences pour un scan.

## Routage des modèles

Le quota est partagé entre toutes les équipes et le choix du modèle fait partie de
l'évaluation. Le tier **volume est le défaut** : appeler le modèle cher est un acte
délibéré, jamais la pente naturelle.

| Agent | Tier | Modèle | Pourquoi |
|---|---|---|---|
| Extractor | volume | gpt-4.1 | extraction structurée à haut débit |
| Classifier | volume | gpt-4.1 | une question bornée, répétée par exigence |
| Matcher | **reasoning** | gpt-5.5 | pèse des preuves partielles sur 24 références et 14 CV, et doit refuser d'extrapoler |
| Writer | **reasoning** | gpt-5.5 | planifie ses outils puis rédige un texte qu'un humain signera |
| Compliance | volume | gpt-4.1 | vérifie un texte court contre une liste courte |
| Embeddings | — | embedder-small-3 (512 dim) | calculés une fois, stockés, jamais réindexés par requête |

Chaque appel — y compris une reprise après échec de schéma et y compris un 429 —
écrit une ligne dans `llm_usage`, corrélée à la requête qui l'a causée.

## Traçabilité

Chaque nœud écrit une entrée de trace, par **un seul callback au niveau du graphe**
et non dans chaque nœud : ajouter un nœud ne peut pas oublier de tracer.

```
[ok] ingest               4 pages lues, dont 4 par OCR          34042ms
[ok] extractRequirements  11 exigences extraites                13228ms
[ok] classifyRequirements 8 exigences eliminatoires             10072ms
[ok] matchProfile         0/11 couvertes par le profil          21990ms
[ok] decide               go - 0 point(s) bloquant(s)               2ms
[ok] draft                4 sections redigees                   25920ms
[ok] compliance           4 sections validees, 0 refusees        8785ms
```

Cette trace vit dans `analysis_runs.node_trace`, donc elle survit à un
rafraîchissement de page et reste lisible après coup. C'est ce que l'interface
affiche en direct.

Chaque exigence porte sa page source et sa citation verbatim. Une affirmation sans
page source est un risque d'hallucination : ici la page est portée depuis
l'extraction, jamais reconstruite après coup.
