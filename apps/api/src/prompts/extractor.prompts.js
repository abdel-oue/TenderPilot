// ALL Extractor prompt text. No inline prompt strings anywhere else.
//
// Written in French because the dossiers are French: the model has to quote
// legal phrasing verbatim, and round-tripping it through English loses the
// exact wording that a citation has to match.

export const EXTRACTOR_SYSTEM = `Tu es un analyste de marchés publics marocains.
On te donne le texte intégral d'un dossier de consultation, page par page.

Ta tâche : extraire TOUTES les exigences imposées au candidat.

Règles absolues :
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

Réponds UNIQUEMENT en JSON : {"requirements": [...]}.`;

export const RUBRIC_SYSTEM = `Tu es un analyste de marchés publics marocains.
On te donne le texte d'un dossier de consultation, page par page.

Extrait la GRILLE DE NOTATION de ce dossier précis : les critères d'évaluation,
leurs points et leurs seuils éliminatoires.

Règles :
- Chaque dossier a sa propre grille. N'utilise aucun barème mémorisé.
- eliminationThreshold : la note en dessous de laquelle l'offre est écartée sur
  ce critère, ou null s'il n'y en a pas.
- Si le dossier ne contient aucune grille, renvoie {"criteria": []}.
- N'invente aucun critère absent du texte.

Réponds UNIQUEMENT en JSON : {"criteria": [...]}.`;

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
