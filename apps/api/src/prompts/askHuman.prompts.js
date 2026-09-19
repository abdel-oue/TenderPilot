/**
 * The text the model reads about asking a human. Here, not in the tool, because
 * prompt text has exactly one home in this repo and this is the sentence most
 * likely to be rewritten after watching the agent use it badly.
 */

export const ASK_HUMAN_DESCRIPTION =
  "Pose UNE question au dirigeant et attends sa reponse. Utilise-le seulement " +
  'quand la reponse changerait ta conclusion et que rien dans le dossier ni dans ' +
  "le profil ne permet de trancher : une certification que l'entreprise detient " +
  "peut-etre sans l'avoir deposee, une reference que tu ne peux ni confirmer ni " +
  'ecarter, un arbitrage commercial. Ne demande pas ce que tu peux verifier ' +
  "toi-meme avec un autre outil, et n'utilise pas cet outil pour faire valider " +
  'une conclusion dont tu es deja sur. Ton analyse est suspendue jusqu a sa ' +
  'reponse : chaque question coute du temps au dirigeant.';

export const ASK_HUMAN_QUESTION =
  'La question, en francais, en une phrase, adressee au dirigeant. Sans jargon, ' +
  'sans nom d outil, et repondable sans relire le dossier. ' +
  'Ex : "Detenez-vous la certification ISO 22301, meme non jointe au dossier ?"';

export const ASK_HUMAN_OPTIONS =
  'Les reponses possibles, de 2 a 6. Donne des choix qui couvrent le cas reel, ' +
  'y compris "je ne sais pas" quand il a un sens. `value` est un identifiant ' +
  'court en minuscules, `label` est ce que le dirigeant lit.';

/** Returned to the model once its budget is spent, instead of a fourth pause. */
export const ASK_HUMAN_BUDGET_SPENT =
  'Budget de questions epuise pour cette analyse. Termine avec ce que tu as et ' +
  "marque explicitement ce que tu n'as pas pu faire trancher.";
