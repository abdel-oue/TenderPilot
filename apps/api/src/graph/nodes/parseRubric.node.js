// Extractor, step 3: the grading grid of THIS dossier.
//
// The rubric is rows, never constants: each dossier scores differently, and the
// elimination threshold that decides a no-go lives in its grid, not in our code.

import ExtractorAgent from '../../agents/extractor.agent.js';

const extractor = new ExtractorAgent();
import RequirementRepository from '../../repositories/requirement.repository.js';

const requirementsRepo = new RequirementRepository();
import { logger } from '../../lib/logger.js';

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function parseRubric(state) {
  const readable = state.pages.filter((p) => p.extraction !== 'unread');
  if (readable.length === 0) {
    return {
      rubric: [],
      errors: [{ node: 'parseRubric', message: 'aucune page lisible, grille non extraite' }],
    };
  }

  try {
    const { criteria } = await extractor.extractRubric(readable.sort((a, b) => a.page - b.page));

    await requirementsRepo.deleteRubricByTender(state.tenderId);
    await requirementsRepo.insertRubric(
      criteria.map((c) => ({
        tenderId: state.tenderId,
        label: c.label,
        maxPoints: String(c.maxPoints),
        weight: String(c.weight),
        eliminationThreshold: c.eliminationThreshold === null ? null : String(c.eliminationThreshold),
      })),
    );

    logger.info({ tenderId: state.tenderId, criteria: criteria.length }, 'parseRubric: done');
    return { rubric: criteria };
  } catch (error) {
    logger.error({ err: error.message }, 'parseRubric: failed');
    return { rubric: [], errors: [{ node: 'parseRubric', message: error.message }] };
  }
}
