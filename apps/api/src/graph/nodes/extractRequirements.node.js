// Extractor, step 2: page-tagged text -> structured requirements.
//
// Runs ONE pass per document over the whole document. Not chunked: a condition
// in the règlement and the threshold in the grading grid have to be visible to
// the same call, and per-document keeps sourceDocumentId knowable without the
// model having to guess it.

import ExtractorAgent from '../../agents/extractor.agent.js';

const extractor = new ExtractorAgent();
import RequirementRepository from '../../repositories/requirement.repository.js';

const requirementsRepo = new RequirementRepository();
import { logger } from '../../lib/logger.js';

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function extractRequirementsNode(state) {
  const byDocument = new Map();
  for (const page of state.pages) {
    if (!byDocument.has(page.documentId)) byDocument.set(page.documentId, []);
    byDocument.get(page.documentId).push(page);
  }

  const rows = [];
  const errors = [];

  for (const [documentId, pages] of byDocument) {
    const readable = pages.filter((p) => p.extraction !== 'unread');
    if (readable.length === 0) {
      // Every page of this document is unreadable. Say so; do not guess.
      errors.push({
        node: 'extractRequirements',
        message: `document ${documentId}: aucune page lisible, aucune exigence extraite`,
      });
      continue;
    }

    try {
      const { requirements } = await extractor.extractRequirements(
        pages.sort((a, b) => a.page - b.page),
      );
      for (const requirement of requirements) {
        rows.push({
          tenderId: state.tenderId,
          text: requirement.text,
          category: requirement.category,
          obligation: requirement.obligation,
          quote: requirement.quote,
          sourceDocumentId: documentId,
          sourcePage: requirement.sourcePage,
          sourceArticle: requirement.sourceArticle,
        });
      }
    } catch (error) {
      errors.push({ node: 'extractRequirements', message: error.message });
      logger.error({ documentId, err: error.message }, 'extractRequirements: failed');
    }
  }

  // Replaces this tender's requirements only. Re-running a run must not stack
  // duplicates, and it must never touch another tender's rows.
  await requirementsRepo.deleteByTender(state.tenderId);
  const saved = await requirementsRepo.insertMany(rows);

  logger.info(
    {
      tenderId: state.tenderId,
      extracted: saved.length,
      eliminatory: saved.filter((r) => r.obligation === 'eliminatoire').length,
    },
    'extractRequirements: done',
  );

  return { requirements: saved, errors };
}
