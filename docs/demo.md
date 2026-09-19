# Ce que ça fait, concrètement

Une analyse réelle, de bout en bout, sur le corpus livré avec le sujet. Pour le
*pourquoi* des étapes, voir [agents.md](agents.md) ; pour le chemin des données,
[pipeline.md](pipeline.md).

## Un dossier entièrement scanné — `AO-2026-004`

Ce dossier n'a aucune couche texte : les quatre pages passent par l'OCR.

```
[ok] ingest               4 pages lues, dont 4 par OCR          34042ms
[ok] extractRequirements  11 exigences extraites                13228ms
[ok] classifyRequirements 8 exigences eliminatoires             10072ms
[ok] parseRubric          grille de notation : 5 criteres        7274ms
[ok] matchProfile         3/11 couvertes par le profil (4 appels d'outil)
                          get_company_facts · search_documents  21990ms
[ok] computeScore         score de couverture : 50/100              1ms
[ok] decide               go - 0 point(s) bloquant(s)               2ms
[ok] draft                4 sections redigees, 7 appels d'outil
                          search_documents · calculate          25920ms
[ok] compliance           4 sections controlees, 0 a revoir,
                          0 refusees                            8785ms
```

Cette trace vit dans `analysis_runs.node_trace` : elle survit à un
rafraîchissement de page, et reste lisible après coup depuis **Contrôle**.

## Un appel d'outil, tel que le dirigeant le lit

```
Pour vérifier si un de vos CV couvre les 10 ans exigés à l'article 8.
  ↳ recherche « chef de projet certifié PMP » dans vos documents :
    2 passages trouvés (p. 12, p. 4)
  search_documents

Pour vérifier si vous détenez la certification exigée.
  ↳ recherche « certification ISO 22301 » dans vos documents :
    aucun passage ne correspond
  search_documents
```

Trois parties, et le découpage est volontaire :

| | D'où ça vient | Pourquoi |
|---|---|---|
| **la raison** | du modèle, via un argument `raison` porté par tous les outils | c'est son raisonnement réel, pas notre reformulation — et c'est gratuit, il remplit ce champ sur l'appel qu'il faisait déjà |
| **le résultat** | de `lib/narration.js`, à partir des vrais arguments et du vrai retour | déterministe, impossible à halluciner |
| **le nom technique** | tel quel, en retrait | le dirigeant l'ignore ; un évaluateur y voit qu'un vrai outil nommé a tourné |

Le résultat n'est **jamais** demandé au modèle. Un agent qui raconte ses propres
résultats, c'est exactement comme ça qu'apparaît « j'ai trouvé 3 références » sous
une recherche qui n'a rien trouvé.

## Un no-go, et sa raison — `AO-2026-002`

> *Le candidat doit être titulaire de la certification ISO 22301:2019.*
> Les certifications détenues sont ISO 9001:2015, ISO 27001:2022 et Qualiopi.

Le verdict cite l'exigence, sa page, et ce que le profil oppose. Un clic sur
l'exigence ouvre le PDF à cette page.

Et un no-go **ne rédige jamais** : l'arête coupe avant le Writer, donc zéro token
dépensé sur un dossier perdu.

## Ce que l'agent refuse de faire

- **Inventer une référence.** Le Writer ne cite que ce que ses outils ont renvoyé,
  et le Compliance recoupe chaque `REF-xx` / `CV-xx` du texte contre les citations
  **sans appeler de modèle** : une référence fabriquée se détecte sans jugement.
- **Masquer une lacune.** Sans élément probant, la section porte
  `[A COMPLETER PAR L'HUMAIN]` et dit ce qui manque. L'export ne nettoie pas ces
  marqueurs — un fichier qui a l'air fini sans l'être est l'échec que ce produit
  évite.
- **Interpréter une page illisible.** Une page que l'OCR n'a pas su lire est
  remontée comme illisible, jamais renvoyée comme page vide.
- **Fabriquer une disqualification.** Seule une *capacité* exigée et absente
  écarte l'entreprise ; « déposer le pli avant le 12/03 » est une tâche de la
  réponse.

## L'agent peut vous interroger

Quand un fait est établi mais que la règle ne le tranche pas — une attestation qui
expire avant la date limite, un seuil manqué d'un an, une certification déclarée
mais non jointe — l'agent appelle `ask_human`, **suspend l'analyse** et pose sa
question avec ses réponses possibles. Le run repart de son point de contrôle
quand vous répondez, des minutes ou des jours plus tard.

Trois questions par analyse au maximum, borné dans le code. Détail :
[agents.md](agents.md#lhumain-dans-la-boucle).

## Le rejouer soi-même

```bash
npm run up
# http://localhost:4100 · demo@tenderpilot.local / demo1234
```

Ou, sans compte : **Essayer avec des données d'exemple** sur l'écran de connexion
ouvre un espace temporaire pré-rempli. Les dix dossiers du corpus sont déjà là ;
`AO-2026-004` et `AO-2026-009` sont les deux scans.
