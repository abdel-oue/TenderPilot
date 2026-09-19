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
 * It has a tool belt, and that matters more here than anywhere else: every
 * `unknown` this agent emits becomes a BLOCKER in findBlockers, and a no-go the
 * company did not deserve is as expensive as a go it did not deserve. An agent
 * that can look the answer up returns fewer unknowns than one guessing from a
 * prompt dump.
 *
 * The profile still goes into the prompt whole - it is small, and having it in
 * front of the model costs less than a tool round. The tools are for what the
 * dump cannot answer: an exact figure, a filtered reference list, the page a
 * clause actually sits on, whether a piece was really uploaded.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import ToolsService from '../services/tools.service.js';
import { MATCHER_SYSTEM, renderProfile, renderRequirements } from '../prompts/matcher.prompts.js';
import { MATCHER_STUB, matchedProfileSchema } from './schema.js';

const MAX_TOOL_ROUNDS = 4;

export default class MatcherAgent {
  /**
   * @param {LlmService} [llm] injectable for tests
   * @param {ToolsService} [tools]
   */
  constructor(llm = new LlmService(), tools = new ToolsService()) {
    this.llm = llm;
    this.tools = tools;
  }

  /**
   * @param {object[]} requirements
   * @param {{ profile: object, references: object[], team: object[] }} company
   * @param {{ runId?: string|null, tenderId?: string|null, ownerId?: string|null }} [runContext]
   * @returns {Promise<{ matches: object[], toolCalls: object[] }>}
   */
  async match(requirements, company, runContext = {}) {
    const toolCalls = [];

    const user = [
      renderProfile(company.profile, company.references, company.team),
      '',
      renderRequirements(requirements),
    ].join('\n');

    const result = await this.llm.complete({
      name: 'matcher',
      tier: TIERS.REASONING,
      system: MATCHER_SYSTEM,
      user,
      schema: matchedProfileSchema,
      stub: {
        matches: requirements.map((r) => ({ ...MATCHER_STUB.matches[0], requirementId: r.id })),
      },
      toolkit: {
        definitions: this.tools.definitions(),
        maxRounds: MAX_TOOL_ROUNDS,
        execute: (name, args) => this.tools.execute(name, args, runContext),
        onToolCall: (call) => toolCalls.push(call),
        stubCall: () => ({ tool: 'get_company_facts', args: { scope: 'references' } }),
      },
    });

    return { ...result, toolCalls };
  }
}
