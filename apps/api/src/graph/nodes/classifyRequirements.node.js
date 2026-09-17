// Extractor, step 4: a narrow precision pass on the obligation typing.
//
// Only re-decides ONE field - whether the requirement is eliminatory - with the
// verbatim quote in front of the model. The Extractor optimises for recall over a
// whole dossier; this optimises for precision on the single question that decides
// the verdict. That is the discreet page-47 clause the jury tests for.

import ClassifierAgent from '../../agents/classifier.agent.js';

const classifier = new ClassifierAgent();
import { logger } from '../../lib/logger.js';
import RequirementRepository from '../../repositories/requirement.repository.js';

const requirementsRepo = new RequirementRepository();

// Small, bounded fan-out: the corpus has tens of requirements per dossier, not
// thousands. A fixed window keeps provider rate limits predictable.
const CONCURRENCY = 5;

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function classifyRequirements(state) {
  const queue = [...state.requirements];
  const classified = [];
  const errors = [];
  let reclassified = 0;

  async function worker() {
    while (queue.length > 0) {
      const requirement = queue.shift();
      if (!requirement) return;
      try {
        const result = await classifier.classify(requirement);
        if (result.obligation !== requirement.obligation) {
          reclassified += 1;
          await requirementsRepo.updateObligation(requirement.id, result.obligation);
        }
        classified.push({ ...requirement, obligation: result.obligation });
      } catch (error) {
        // A classification failure keeps the extractor's typing rather than
        // dropping the requirement. Losing it entirely is the worse failure.
        errors.push({ node: 'classifyRequirements', message: error.message });
        classified.push(requirement);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, state.requirements.length) }, worker));

  logger.info(
    {
      total: classified.length,
      reclassified,
      eliminatory: classified.filter((r) => r.obligation === 'eliminatoire').length,
    },
    'classifyRequirements: done',
  );

  return { requirements: classified, errors };
}
