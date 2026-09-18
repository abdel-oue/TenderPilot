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

  /**
   * The grading grid of THIS dossier. Never a hardcoded bareme.
   * @param {{ page: number, text: string, extraction: string }[]} pages
   * @returns {Promise<{ criteria: object[] }>}
   */
  async extractRubric(pages) {
    return this.llm.complete({
      name: 'rubric',
      tier: TIERS.VOLUME,
      system: RUBRIC_SYSTEM,
      user: renderPages(pages),
      schema: parsedRubricSchema,
      stub: RUBRIC_STUB,
    });
  }
}
