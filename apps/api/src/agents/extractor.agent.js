/**
 * Extractor Agent
 * Dossier text -> structured requirements + the grading grid of that dossier.
 *
 * Runs on the VOLUME tier. This is high-throughput structured extraction over
 * seven pages of legal French, not a judgement call: gpt-4.1 is exactly the job,
 * and routing it to the reasoning tier would burn shared quota for no gain.
 *
 * Extraction and classification are deliberately separate passes - see
 * classifier.agent.js.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import { z } from 'zod';
import { rubricCriterionSchema } from '@tenderpilot/shared';
import { EXTRACTION_AUDIT_SYSTEM, renderExtractionAudit } from '../prompts/extractor.prompts.js';
import { EXTRACTOR_SYSTEM, RUBRIC_SYSTEM, renderPages } from '../prompts/extractor.prompts.js';
import {
  EXTRACTOR_STUB,
  RUBRIC_STUB,
  extractedRequirementsSchema,
  parsedRubricSchema,
} from './schema.js';

export default class ExtractorAgent {
  /** @param {LlmService} [llm] injectable for tests */
  constructor(llm = new LlmService()) {
    this.llm = llm;
  }

  /**
   * One whole-document pass. Never chunked: a condition in the reglement and the
   * threshold in the grading grid have to be visible to the same call.
   * @param {{ page: number, text: string, extraction: string }[]} pages
   * @returns {Promise<{ requirements: object[] }>}
   */
  async extractRequirements(pages) {
    return this.llm.complete({
      name: 'extractor',
      tier: TIERS.VOLUME,
      system: EXTRACTOR_SYSTEM,
      user: renderPages(pages),
      schema: extractedRequirementsSchema,
      stub: EXTRACTOR_STUB,
    });
  }

  /** A bounded second read that also accounts for pages containing no requirements.
   * @param {object[]} pages @param {object[]} requirements @returns {Promise<object>}
   */
  async auditRequirements(pages, requirements) {
    return this.llm.complete({
      name: 'extractionAudit',
      tier: TIERS.VOLUME,
      system: EXTRACTION_AUDIT_SYSTEM,
      user: renderExtractionAudit(pages, requirements),
      schema: extractedRequirementsSchema.extend({
        reviewedPages: z.array(z.number().int().positive()),
      }),
      stub: { requirements, reviewedPages: pages.map((p) => p.page) },
    });
  }

  /**
   * The grading grid of THIS dossier. Never a hardcoded bareme.
   * @param {{ page: number, text: string, extraction: string }[]} pages
   * @returns {Promise<{ criteria: object[] }>}
   */
  async extractRubric(pages) {
    const criterionSchema = rubricCriterionSchema.extend({
      maxPoints: z.number().positive(),
      sourcePage: z.number().int().positive(),
      quote: z.string().min(1),
    });

    return this.llm.complete({
      name: 'rubric',
      tier: TIERS.VOLUME,
      system: RUBRIC_SYSTEM,
      user: renderPages(pages),
      schema: parsedRubricSchema.extend({ criteria: z.array(criterionSchema) }),
      stub: { criteria: [] },
    });
  }
}
