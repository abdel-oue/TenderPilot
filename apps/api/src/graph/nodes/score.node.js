// Qualifier, step 2: the number. Pure delegation to score.service.js, which has
// no DB and no LLM in it precisely so it can be tested exactly.

import { coverageScore, projectRubric } from '../../services/score.service.js';

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function score(state) {
  const coverage = coverageScore(state.requirements, state.matches);
  const { breakdown, thresholdBlockers } = projectRubric(state.rubric ?? [], coverage);
  return { score: coverage, rubricBreakdown: breakdown, thresholdBlockers };
}
