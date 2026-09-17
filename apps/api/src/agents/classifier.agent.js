/**
 * Classifier Agent
 * One requirement in, one precise obligation typing out.
 *
 * Runs on the VOLUME tier: it is a single bounded judgement against a quote that
 * is already in front of it, repeated tens of times per dossier. High volume,
 * narrow question - the cheap model is the right one, and the separation from the
 * Extractor is what buys the precision, not a bigger model.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import { CLASSIFIER_SYSTEM, renderRequirement } from '../prompts/classifier.prompts.js';
import { CLASSIFIER_STUB, classificationSchema } from './classifier.schema.js';

export default class ClassifierAgent {
  /** @param {LlmService} [llm] injectable for tests */
  constructor(llm = new LlmService()) {
    this.llm = llm;
  }

  /**
   * @param {{ text: string, quote: string, sourceArticle: string|null, sourcePage: number }} requirement
   * @returns {Promise<{ obligation: string, confidence: number, reason: string }>}
   */
  async classify(requirement) {
    return this.llm.complete({
      name: 'classifier',
      tier: TIERS.VOLUME,
      system: CLASSIFIER_SYSTEM,
      user: renderRequirement(requirement),
      schema: classificationSchema,
      stub: CLASSIFIER_STUB,
    });
  }
}
