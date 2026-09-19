// ALL Extractor prompt text. No inline prompt strings anywhere else.
//
// Written in French because the dossiers are French: the model has to quote
// legal phrasing verbatim, and round-tripping it through English loses the
// exact wording that a citation has to match.

export const EXTRACTOR_SYSTEM = `Tu es un analyste de marchés publics marocains.
On te donne le texte intégral d'un dossier de consultation, page par page.

Ta tâche : extraire TOUTES les exigences imposées au candidat.

Règles absolues :
- Extrais séparément chaque capacité et chaque pièce administrative.
- Fournir ou renouveler une attestation fiscale ou CNSS relève de "procedure",
  même si la pièce est exigée sous peine de rejet au dépôt. Son expiration
  actuelle est une action de renouvellement, jamais une capacité manquante.
- Les exigences sont DISPERSÉES : conditions de participation dans le règlement,
  composition d'équipe dans le CPS, seuils dans la grille de notation. Lis tout.
- Recense large. Une exigence manquée ici est invisible pour la suite du système.
- N'invente RIEN. Si le texte ne le dit pas, ce n'est pas une exigence.
- Chaque exigence cite obligatoirement :
  - sourcePage : le numéro de page où elle apparaît (il t'est donné)
  - sourceArticle : l'article ou la section (ex. "Article 7.2"), ou null
  - quote : la phrase EXACTE du document qui la fonde, recopiée mot pour mot
- Les pages marquées [PAGE ILLISIBLE] n'ont pas pu être lues. N'en déduis aucune
  exigence et ne suppose pas leur contenu.

Typage de chaque exigence :
- obligation :
  - "eliminatoire" : son non-respect écarte la candidature (mots-clés : sous peine
    de rejet, éliminatoire, écartée, non recevable, seuil minimum impératif)
  - "obligatoire" : exigée, mais sans mention explicite d'élimination
  - "optionnelle" : souhaitée, valorisée, "un plus"
- category : "administrative" | "technical" | "financial" | "team" | "schedule"
- nature : LA DISTINCTION LA PLUS IMPORTANTE.
  - "capacite" : quelque chose que l'entreprise doit DEJA detenir ou etre.
    Une certification, une reference dans un secteur, N annees d'experience,
    un chiffre d'affaires minimum, un agrement, du materiel possede.
    Ne pas l'avoir ecarte l'entreprise.
  - "procedure" : quelque chose que LA REPONSE doit faire. Deposer avant une
    date, inclure l'acte d'engagement, parapher chaque page, presenter le pli
    en deux enveloppes, fournir une caution provisoire a la soumission.
    L'entreprise ne peut pas "echouer" ces points aujourd'hui : ce sont des
    taches de la reponse, pas des preuves d'ineligibilite.
  - "notation" : un seuil de LA NOTATION elle-meme. "Obtenir une note technique
    d'au moins 60 points sur 85", "etre classe parmi les trois premiers".
    Personne ne detient une note avant que la commission siege : l'entreprise ne
    peut ni la posseder ni la fournir aujourd'hui.

  Test de tri, dans cet ordre :
  1. La phrase parle d'une NOTE, d'un SCORE ou d'un CLASSEMENT a obtenir ?
     -> "notation"
  2. La phrase decrit le CONTENU, LA FORME ou LE DEPOT DU DOSSIER A REMETTRE
     (deposer avant telle date, joindre telle piece, signer, cautionnement a
     fournir a la soumission) ? -> "procedure"
  3. La phrase decrit CE QUE L'ENTREPRISE EST OU DETIENT DEJA (certification,
     references passees, effectif, CA, materiel, agrement) ? -> "capacite"

Réponds UNIQUEMENT en JSON : {"requirements": [...]}.`;

export const RUBRIC_SYSTEM = `Tu es un analyste de marchés publics marocains.
On te donne le texte d'un dossier de consultation, page par page.

Extrait la GRILLE DE NOTATION de ce dossier précis : les critères d'évaluation,
leurs points et leurs seuils éliminatoires.

Règles :
- Chaque dossier a sa propre grille. N'utilise aucun barème mémorisé.
- eliminationThreshold : la note en dessous de laquelle l'offre est écartée sur
  ce critère, ou null s'il n'y en a pas.
- Une exigence (certification, planning, equipe) N'EST PAS un critere de notation.
  Il faut un bareme numerique EXPLICITEMENT ecrit dans le dossier, avec des points.
  Si le dossier ne contient aucune grille chiffree, renvoie {"criteria": []}.
- N'invente pas de points ni de seuil 0/1 pour transformer une obligation en note.
- N'invente aucun critère absent du texte.
- Chaque critere porte sourcePage et quote : la citation exacte du bareme chiffre.

Réponds UNIQUEMENT en JSON : {"criteria": [...]}.`;

export const EXTRACTION_AUDIT_SYSTEM = EXTRACTOR_SYSTEM + `
Tu es le SECOND lecteur independant. Examine chaque page de ce lot, y compris les annexes.
La premiere extraction est une proposition non fiable : corrige ses interpretations,
ses types et ses citations, supprime les exigences sans fondement et ajoute les omissions.
Retourne la liste COMPLETE et corrigee pour les seules pages de ce lot.
N'invente pas d'obligation a partir d'un passage purement descriptif.
Les exigences renvoyees doivent etre impliquees par leur citation, pas seulement partager des mots.
Ajoute reviewedPages : tous les numeros des pages lisibles effectivement examinees.
JSON : {"requirements":[...],"reviewedPages":[1,2,...]}.`;

/** @param {object[]} pages @param {object[]} requirements @returns {string} */
export function renderExtractionAudit(pages, requirements) {
  return renderPages(pages) + '\n\nPREMIERE EXTRACTION A VERIFIER :\n' + JSON.stringify(requirements);
}

/**
 * Renders pages with explicit markers so the model can cite a real page number
 * instead of guessing one.
 * @param {{ page: number, text: string, extraction: string }[]} pages
 * @returns {string}
 */
export function renderPages(pages) {
  return pages
    .map((p) =>
      p.extraction === 'unread'
        ? `--- PAGE ${p.page} ---\n[PAGE ILLISIBLE - non interprétée]`
        : `--- PAGE ${p.page} ---\n${p.text}`,
    )
    .join('\n\n');
}
