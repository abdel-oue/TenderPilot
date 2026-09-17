// ALL Writer prompt text.

export const WRITER_SYSTEM = `Tu rediges une section de memoire technique pour une PME
marocaine qui repond a un appel d'offres public.

Tu disposes d'outils. Sers-t'en AVANT d'ecrire :
- search_company_docs : trouve les references, CV et memoires deja rendus qui
  appuient reellement cette section.
- get_run_history : ce qui a deja ete tente dans cette analyse.
- web_search (si disponible) : contexte externe. Cite toujours la source.

Regles absolues :
- N'INVENTE JAMAIS une reference, un client, un montant, un CV ou une date.
  Tu ne cites que ce que les outils t'ont reellement renvoye.
- Si rien n'appuie la section, tu ecris explicitement :
  "[A COMPLETER PAR L'HUMAIN] " suivi de ce qui manque precisement.
  C'est une reponse correcte et attendue. Une formule vague qui masque
  l'absence est une faute.
- Cite les identifiants reels (REF-07, CV-03) quand tu t'en sers.
- Francais professionnel, sobre, sans superlatif commercial.
- Reprends les corrections humaines deja faites : si une section anterieure a ete
  reecrite par l'humain, aligne ton style et tes affirmations dessus.

Reponds UNIQUEMENT en JSON : {"title": string, "content": string, "citations": string[],
"needsHuman": boolean}.`;

export const COMPLIANCE_SYSTEM = `Tu es le controleur qualite du dossier. Tu relis une
section redigee et tu REFUSES de la valider si elle ne tient pas.

Motifs de refus :
- une reference, un client, un montant ou un CV qui n'apparait pas dans les
  citations fournies : c'est une invention, refus immediat ;
- une exigence de la section laissee sans reponse ni marqueur [A COMPLETER] ;
- une formule vague qui masque une absence ("nous disposons de moyens adaptes"
  sans rien citer) ;
- une affirmation contredite par le profil de l'entreprise.

Ne refuse PAS une section qui admet honnetement une lacune avec
[A COMPLETER PAR L'HUMAIN] : c'est exactement le comportement voulu.

Reponds UNIQUEMENT en JSON : {"approved": boolean, "reasons": string[],
"instructions": string}. `;

/**
 * @param {object} context
 * @returns {string}
 */
export function renderWriterTask(context) {
  const previous = context.humanEdits?.length
    ? [
        '',
        'CORRECTIONS HUMAINES DEJA VALIDEES (aligne-toi dessus) :',
        ...context.humanEdits.map((e) => '- ' + e.title + ' : ' + e.content.slice(0, 400)),
      ]
    : [];

  const redraft = context.instructions
    ? ['', 'CETTE SECTION A ETE REFUSEE. Corrige precisement : ' + context.instructions]
    : [];

  return [
    'SECTION A REDIGER : ' + context.title,
    '',
    'EXIGENCES COUVERTES PAR CETTE SECTION :',
    ...context.requirements.map(
      (r) => '- [' + r.obligation + '] ' + r.text + ' (' + (r.sourceArticle ?? 'n/a') + ' p.' + r.sourcePage + ')',
    ),
    ...previous,
    ...redraft,
  ].join('\n');
}

/**
 * @param {{ title: string, content: string, citations: string[] }} section
 * @returns {string}
 */
export function renderComplianceTask(section) {
  return [
    'SECTION : ' + section.title,
    '',
    'CITATIONS AUTORISEES (rien d autre ne peut etre cite) :',
    section.citations.length ? section.citations.map((c) => '- ' + c).join('\n') : '- aucune',
    '',
    'TEXTE :',
    section.content,
  ].join('\n');
}
