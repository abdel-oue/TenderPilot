/**
 * Writer Agent
 * Drafts one section of the memoire technique, with tools.
 *
 * Runs on the REASONING tier: this is the only agent that plans (which tool to
 * call), acts, and writes prose a human will sign. It is also the one place
 * where fabricating a reference would be catastrophic and plausible at the same
 * time, so it gets the model that can be told "admit the gap" and comply.
 *
 * The tool loop is bounded. An agent that can call tools forever is a demo that
 * never finishes.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import ToolsService from '../services/tools.service.js';
import {
  WRITER_PLAN_SYSTEM,
  WRITER_SYSTEM,
  renderPlanTask,
  renderWriterTask,
} from '../prompts/writer.prompts.js';
import { SEARCH_PLAN_STUB, WRITER_STUB, draftedSectionSchema, searchPlanSchema } from './writer.schema.js';

const MAX_TOOL_ROUNDS = 3;

export default class WriterAgent {
  /**
   * @param {LlmService} [llm]
   * @param {ToolsService} [tools]
   */
  constructor(llm = new LlmService(), tools = new ToolsService()) {
    this.llm = llm;
    this.tools = tools;
  }

  /**
   * @param {object} context section title, requirements, humanEdits, instructions
   * @param {{ runId?: string|null, tenderId?: string|null, ownerId?: string|null }} [runContext]
   * @returns {Promise<{ title: string, content: string, citations: string[], needsHuman: boolean, toolCalls: object[] }>}
   */
  async draft(context, runContext = {}) {
    const toolCalls = [];

    // Plan-and-act, bounded: the agent gathers evidence with tools, then writes
    // once. Every tool result is recorded so the trace shows what it actually
    // looked at - and so a retry can read it back through get_run_history.
    let evidence = '';
    // One planning call, up to MAX_TOOL_ROUNDS distinct queries. Re-planning
    // after every miss would cost a model call per miss to ask a question the
    // model could already have listed.
    const queries = await this.planQueries(context);
    for (const query of queries.slice(0, MAX_TOOL_ROUNDS)) {
      const result = await this.tools.execute(
        'search_company_docs',
        { query, limit: 4 },
        runContext,
      );
      toolCalls.push({ tool: 'search_company_docs', args: { query }, result });

      const extracts = result.extracts ?? [];
      if (extracts.length > 0) {
        evidence +=
          '\n\nRESULTATS OUTIL (' + query + ') :\n' +
          extracts
            .map((e) => '- doc ' + e.documentId + ' p.' + e.page + ' : ' + e.excerpt.slice(0, 400))
            .join('\n');
        break;
      }
      // Nothing found: the next round asks a different question rather than the
      // same one again.
    }

    if (evidence === '') {
      evidence =
        "\n\nRESULTATS OUTIL : aucun document de l'entreprise ne couvre cette section. " +
        "Tu dois donc marquer la section [A COMPLETER PAR L'HUMAIN].";
    }

    const section = await this.llm.complete({
      name: 'writer',
      tier: TIERS.REASONING,
      system: WRITER_SYSTEM,
      user: renderWriterTask(context) + evidence,
      schema: draftedSectionSchema,
      stub: { ...WRITER_STUB, title: context.title },
    });

    return { ...section, toolCalls };
  }

  /**
   * Asks the model what it needs to look up. The queries are the agent's own
   * words - that is the point: a template built from the section title always
   * asks the same thing, so it can only ever find the same thing, and "je ne
   * sais pas encore X" is never expressed.
   *
   * Degrades to the section title rather than throwing: a planning call that
   * fails must cost one weak search, not the whole section.
   *
   * @param {object} context
   * @returns {Promise<string[]>}
   */
  async planQueries(context) {
    try {
      const plan = await this.llm.complete({
        name: 'writer:plan',
        tier: TIERS.VOLUME,
        system: WRITER_PLAN_SYSTEM,
        user: renderPlanTask(context),
        schema: searchPlanSchema,
        stub: SEARCH_PLAN_STUB,
      });
      return [...new Set(plan.queries)];
    } catch {
      return [context.title];
    }
  }
}
