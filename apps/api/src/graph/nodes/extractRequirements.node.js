// Extractor, step 2: page-tagged text -> structured requirements.
//
// Runs ONE pass per document over the whole document. Not chunked: a condition
// in the règlement and the threshold in the grading grid have to be visible to
// the same call, and per-document keeps sourceDocumentId knowable without the
// model having to guess it.

import ExtractorAgent from '../../agents/extractor.agent.js';
import { verifyQuote } from '../../lib/provenance.js';

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
  let auditedPages = 0;
  let recoveredRequirements = 0;

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
      const { requirements: initial } = await extractor.extractRequirements(
        pages.sort((a, b) => a.page - b.page),
      );
      const requirements = [];
      for (let start = 0; start < readable.length; start += 8) {
        const batch = readable.slice(start, start + 8);
        const pageNumbers = new Set(batch.map((p) => p.page));
        const proposed = initial.filter((r) => pageNumbers.has(r.sourcePage));
        const audited = await extractor.auditRequirements(batch, proposed);
        const reviewed = new Set(audited.reviewedPages);
        if (reviewed.size !== pageNumbers.size || [...pageNumbers].some((p) => !reviewed.has(p))) {
          throw new Error(`document ${documentId}: audit incomplet des pages ${[...pageNumbers].join(', ')}`);
        }
        if (audited.requirements.some((r) => !pageNumbers.has(r.sourcePage))) {
          throw new Error(`document ${documentId}: audit cite une page hors du lot`);
        }
        auditedPages += reviewed.size;
        recoveredRequirements += audited.requirements.filter((r) => !proposed.some((p) => p.sourcePage === r.sourcePage && p.quote === r.quote)).length;
        requirements.push(...audited.requirements);
      }
      if (requirements.length === 0) {
        errors.push({ node: 'extractRequirements', message: `document ${documentId}: aucune exigence identifiee, verification humaine requise` });
      }
      for (const requirement of requirements) {
        const quoteVerified = verifyQuote(requirement, pages);
        if (!quoteVerified) {
          errors.push({ node: 'extractRequirements', message: `document ${documentId}, p. ${requirement.sourcePage}: citation introuvable ou page illisible : ${requirement.quote}` });
        }
        rows.push({
          tenderId: state.tenderId,
          text: requirement.text,
          category: requirement.category,
          obligation: requirement.obligation,
          nature: requirement.nature,
          quote: requirement.quote,
          quoteVerified,
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

  return { requirements: saved, errors, extractionAudit: { auditedPages, recoveredRequirements } };
}
