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

  // A criterion projected under this dossier's own elimination threshold is a
  // WARNING, not a blocker. Requirement coverage is not a technical mark, and
  // turning one into the other invented a disqualification on every dossier.
  // The human sees the risk and decides; the agent does not pretend to know.
  const warnings = (state.thresholdWarnings ?? []).map((t) => ({
    label: t.label,
    text: `Risque sur « ${t.label} » : ${t.points} points projetés pour un seuil éliminatoire de ${t.threshold}.`,
    detail:
      'Projection indicative fondée sur la couverture des exigences, pas une note ' +
      'réelle. À confirmer par un humain.',
  }));

  const result = computeVerdict(state.score ?? 0, blockers, state.matches);

  logger.info(
    { verdict: result.verdict, score: state.score, blockers: blockers.length, warnings: warnings.length },
    'decide: done',
  );

  return { ...result, blockers, warnings };
}
