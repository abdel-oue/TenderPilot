/**
 * Matcher Agent (the Qualifier of the cahier des charges)
 * Requirements x company profile -> a per-requirement verdict with evidence.
 *
 * Runs on the REASONING tier, and it is the only extraction-adjacent agent that
 * does. It weighs partial evidence across 24 references and 14 CVs and has to
 * refuse to stretch: "8 years where 10 are demanded" is partial, not met, and
 * inventing a reference is the failure the jury tests for. That judgement is
 * what the expensive model is for.
 *
 * The profile is small enough to go into the prompt whole. Building an embedding
 * pipeline to retrieve 24 rows would cost more than it saves and would add a way
 * to silently miss one.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import { MATCHER_SYSTEM, renderProfile, renderRequirements } from '../prompts/matcher.prompts.js';
import { MATCHER_STUB, matchedProfileSchema } from './matcher.schema.js';

export default class MatcherAgent {
  /** @param {LlmService} [llm] injectable for tests */
  constructor(llm = new LlmService()) {
    this.llm = llm;
  }

  /**
   * @param {object[]} requirements
   * @param {{ profile: object, references: object[], team: object[] }} company
   * @returns {Promise<{ matches: object[] }>}
   */
  async match(requirements, company) {
    const user = [
      renderProfile(company.profile, company.references, company.team),
      '',
      renderRequirements(requirements),
    ].join('\n');

    return this.llm.complete({
      name: 'matcher',
      tier: TIERS.REASONING,
      system: MATCHER_SYSTEM,
      user,
      schema: matchedProfileSchema,
      stub: {
        matches: requirements.map((r) => ({ ...MATCHER_STUB.matches[0], requirementId: r.id })),
      },
    });
  }
}
