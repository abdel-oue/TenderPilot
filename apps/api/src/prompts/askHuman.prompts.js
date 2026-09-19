/**
 * The text the model reads about asking a human. Here, not in the tool, because
 * prompt text has exactly one home in this repo and this is the sentence most
 * likely to be rewritten after watching the agent use it badly.
 *
 * The trigger is an arbitration, not a gap. Framed as "information manquante"
 * the tool never fired on the corpus: the agent is never ignorant enough for it,
 * it has ten other tools for what it does not know. The moment that matters is
 * the opposite one - the facts are in hand and they do not decide.
 */

export const ASK_HUMAN_DESCRIPTION =
  'Pose UNE question au dirigeant et attends sa reponse. Le declencheur est un ' +
  'ARBITRAGE, pas une information qui te manque : tu as le fait, la regle ne le ' +
  'tranche pas, et la reponse decide d un no-go. Trois familles :\n' +
  '1. Validite dans le temps : une attestation est expiree a la date limite - ' +
  'no-go, ou sera-t-elle renouvelee avant le depot ? La date est lue, c est la ' +
  'pratique commerciale que tu ignores.\n' +
  '2. Seuil manque de peu : l avis exige 13 ans d experience, le meilleur CV en ' +
  'a 12 - exigence de capacite (eliminatoire) ou de notation (quelques points) ? ' +
  'Le chiffre est sur, c est la nature de l exigence qui ne l est pas.\n' +
  '3. Preuve declaree mais non jointe : le profil annonce une certification que ' +
  'le dossier ne prouve pas - la retenir risque un rejet sur piece, l ecarter ' +
  'est un no-go sur une certification peut-etre reelle.\n' +
  'NE demande PAS : ce que l entreprise detient (get_company_facts), ce qui est ' +
  'au dossier (check_dossier_checklist), ce que dit un article (read_source_page), ' +
  'une conclusion dont tu es deja sur, ni rien dont la reponse ne changerait pas ' +
  'le verdict. Ton analyse est suspendue jusqu a sa reponse : chaque question ' +
  'coute du temps au dirigeant.';

export const ASK_HUMAN_QUESTION =
  'La question, en francais, en deux phrases au plus, adressee au dirigeant. ' +
  'Elle doit porter l ENJEU : le fait etabli, puis ce qui se passe selon la ' +
  'reponse. Sans l enjeu, il repond a une question de forme sans savoir qu il ' +
  'decide d un abandon. Sans jargon, sans nom d outil, repondable sans relire ' +
  'le dossier. Ex : "L attestation fiscale expire le 12/06, avant la date limite ' +
  'du 08/07. Si je la considere expiree, le dossier passe en no-go."';

export const ASK_HUMAN_OPTIONS =
  'Les reponses possibles, de 2 a 6. Ce sont les ISSUES de l arbitrage, pas des ' +
  'oui/non : pour un seuil manque de peu, `eliminatoire` / `risque_note` / ' +
  '`je_ne_sais_pas`, pas `oui` / `non`. Couvre le cas reel, y compris ' +
  '"je ne sais pas" quand il a un sens. `value` est un identifiant court en ' +
  'minuscules, `label` est ce que le dirigeant lit.';

/** Returned to the model once its budget is spent, instead of a fourth pause. */
export const ASK_HUMAN_BUDGET_SPENT =
  'Budget de questions epuise pour cette analyse. Termine avec ce que tu as et ' +
  "marque explicitement ce que tu n'as pas pu faire trancher.";
