/**
 * Turns one tool call into a sentence a company director can read.
 *
 * The trace is for the dirigeant of a PME, not for us. `get_company_facts` and
 * `search_documents` mean nothing to them, and a feed they cannot read is a feed
 * that proves nothing - the whole point of showing the agent's steps is that
 * somebody can check them.
 *
 * The split is deliberate and load-bearing:
 *
 *   the WHY   comes from the model, as a `raison` argument it fills in on the
 *             call it was already making. Free, and it is the agent's own
 *             reasoning rather than our guess at it.
 *   the WHAT  is built HERE, from the arguments and the real result. It is
 *             deterministic and cannot be hallucinated: if the search returned
 *             nothing, this says it returned nothing, whatever the model claims.
 *
 * That is why the outcome is never asked of the model. An agent narrating its
 * own results is exactly how "j'ai trouve 3 references" appears under a search
 * that found none.
 */

const numberFormat = new Intl.NumberFormat('fr-FR');

/**
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural] defaults to singular + 's'
 * @returns {string}
 */
function count(count_, singular, plural) {
  const word = count_ === 1 ? singular : (plural ?? singular + 's');
  return count_ + ' ' + word;
}

/**
 * The pages an extract list touches, as a readable fragment.
 * @param {object[]} extracts
 * @returns {string}
 */
function pages(extracts) {
  const unique = [...new Set(extracts.map((e) => e.page).filter((p) => Number.isFinite(p)))];
  if (unique.length === 0) return '';
  const shown = unique.slice(0, 3).map((p) => 'p. ' + p).join(', ');
  return ' (' + shown + (unique.length > 3 ? '…' : '') + ')';
}

/**
 * A plain-French description of what a tool call actually did.
 *
 * Every branch reads the REAL result, so an empty search, an unreadable page and
 * a failed tool each say so in the feed instead of being smoothed over.
 *
 * @param {string} tool
 * @param {object} args the arguments the model supplied
 * @param {object} result what the tool actually returned
 * @returns {string} one phrase, no trailing period
 */
export function describeToolCall(tool, args = {}, result = {}) {
  // A failure is reported as a failure. The reader needs to know the agent
  // reasoned without this answer, not be told a comforting half-truth.
  if (result?.error) return 'échec : ' + result.error;

  switch (tool) {
    case 'search_documents': {
      const where = args.corpus === 'dossier' ? 'le dossier de consultation' : 'vos documents';
      const extracts = result.extracts ?? [];
      const query = args.query ? ' « ' + args.query + ' »' : '';
      return extracts.length === 0
        ? 'recherche' + query + ' dans ' + where + ' : aucun passage ne correspond'
        : 'recherche' + query + ' dans ' + where + ' : ' +
            count(extracts.length, 'passage trouvé', 'passages trouvés') + pages(extracts);
    }

    case 'get_company_facts':
      return describeCompanyFacts(args, result);

    case 'read_source_page': {
      if (result.readable === false) {
        return 'page ' + result.page + ' du dossier : illisible, même après OCR';
      }
      return (
        'relecture de la page ' + result.page + ' du dossier' +
        (result.extraction === 'ocr' ? ' (récupérée par OCR)' : '')
      );
    }

    case 'get_run_state': {
      const parts = [];
      if (result.steps) parts.push(count(result.steps.length, 'étape', 'étapes'));
      if (result.calls) parts.push(count(result.calls.length, 'appel', 'appels'));
      if (result.requirements) parts.push(count(result.requirements.length, 'exigence', 'exigences'));
      return parts.length
        ? "relecture de ce que l'analyse a déjà fait : " + parts.join(', ')
        : "relecture de ce que l'analyse a déjà fait";
    }

    case 'check_dossier_checklist': {
      const missing = result.manquantes ?? [];
      if ((result.pieces ?? []).length === 0) {
        return 'vérification des pièces à fournir : aucune pièce exigée identifiée';
      }
      return missing.length === 0
        ? 'vérification des pièces à fournir : toutes les pièces exigées sont déposées'
        : 'vérification des pièces à fournir : ' +
            count(missing.length, 'pièce manquante', 'pièces manquantes') +
            ' — ' + missing.slice(0, 2).join(' ; ') + (missing.length > 2 ? '…' : '');
    }

    case 'compute_deadline': {
      if (result.depassee) {
        return 'échéance du ' + frenchDate(result.deadline) + ' : dépassée depuis ' +
          count(Math.abs(result.joursCalendaires), 'jour');
      }
      return 'échéance du ' + frenchDate(result.deadline) + ' : il reste ' +
        count(result.joursOuvres, 'jour ouvré', 'jours ouvrés') +
        ' (' + count(result.joursCalendaires, 'jour calendaire', 'jours calendaires') + ')';
    }

    case 'calculate':
      return 'calcul : ' + args.expression + ' = ' + numberFormat.format(result.value);

    case 'get_current_date':
      return "date du jour : " + frenchDate(result.today);

    case 'simulate_score': {
      const from = result.actuel?.verdict;
      const to = result.projete?.verdict;
      const remaining = (result.bloquantsRestants ?? []).length;
      return (
        'simulation : le verdict passerait de ' + (from ?? '?') + ' à ' + (to ?? '?') +
        (remaining === 0
          ? ', plus aucun point bloquant'
          : ', il resterait ' + count(remaining, 'point bloquant', 'points bloquants'))
      );
    }

    case 'web_search': {
      const results = result.results ?? [];
      return results.length === 0
        ? 'recherche web « ' + args.query + " » : aucun résultat exploitable"
        : 'recherche web « ' + args.query + ' » : ' +
            count(results.length, 'résultat', 'résultats');
    }

    default:
      return tool;
  }
}

/**
 * @param {object} args
 * @param {object} result
 * @returns {string}
 */
function describeCompanyFacts(args, result) {
  switch (args.scope) {
    case 'profil':
      return result.profil
        ? "consultation du profil de l'entreprise"
        : "consultation du profil de l'entreprise : aucun profil importé";

    case 'references': {
      const filters = [];
      if (args.secteur) filters.push('secteur ' + args.secteur);
      if (typeof args.montantMin === 'number') {
        filters.push('montant ≥ ' + numberFormat.format(args.montantMin));
      }
      if (typeof args.anneeMin === 'number') filters.push('depuis ' + args.anneeMin);
      const scope = filters.length ? ' (' + filters.join(', ') + ')' : '';
      return result.count === 0
        ? 'consultation de vos références' + scope + ' : aucune ne correspond'
        : 'consultation de vos références' + scope + ' : ' +
            count(result.count, 'référence trouvée', 'références trouvées');
    }

    case 'equipe':
      return result.count === 0
        ? "consultation de votre équipe : aucun CV importé"
        : 'consultation de votre équipe : ' + count(result.count, 'CV consulté', 'CV consultés');

    case 'marches_passes':
      return result.count === 0
        ? 'consultation de vos marchés passés : aucun autre marché traité'
        : 'consultation de vos marchés passés : ' +
            count(result.count, 'marché', 'marchés');

    default:
      return "consultation des données de l'entreprise";
  }
}

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {string} DD/MM/YYYY, or the input when it is not a date
 */
function frenchDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return match ? match[3] + '/' + match[2] + '/' + match[1] : String(iso ?? '');
}
