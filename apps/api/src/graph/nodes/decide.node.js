// Qualifier, step 3: go / no-go, its justification, and the blockers first.
//
// EX-04. The blockers ARE the product: a bare verdict tells the dirigeant nothing
// they can act on.

import { findBlockers, verdict as computeVerdict } from '../../services/score.service.js';
import { logger } from '../../lib/logger.js';

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function decide(state) {
  const blockers = findBlockers(state.requirements, state.matches);

  // A criterion falling under this dossier's own elimination threshold is a
  // blocker too, and it is the one a human would never spot by eye.
  for (const t of state.thresholdBlockers ?? []) {
    blockers.push({
      requirementId: null,
      text: `Note projetée insuffisante sur « ${t.label} »`,
      reason:
        `${t.points} points projetés pour un seuil éliminatoire de ${t.threshold} ` +
        `fixé par la grille de notation de ce dossier.`,
      sourcePage: null,
      sourceArticle: null,
      sourceDocumentId: null,
    });
  }

  const result = computeVerdict(state.score ?? 0, blockers, state.matches);

  logger.info(
    { verdict: result.verdict, score: state.score, blockers: blockers.length },
    'decide: done',
  );

  return { ...result, blockers };
}
