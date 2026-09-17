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
import { WRITER_SYSTEM, renderWriterTask } from '../prompts/writer.prompts.js';
import { WRITER_STUB, draftedSectionSchema } from './writer.schema.js';

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
   * @param {{ runId?: string|null, tenderId?: string|null }} [runContext]
   * @returns {Promise<{ title: string, content: string, citations: string[], needsHuman: boolean, toolCalls: object[] }>}
   */
  async draft(context, runContext = {}) {
    const toolCalls = [];

    // Plan-and-act, bounded: the agent gathers evidence with tools, then writes
    // once. Every tool result is recorded so the trace shows what it actually
    // looked at - and so a retry can read it back through get_run_history.
    let evidence = '';
    for (let round = 1; round <= MAX_TOOL_ROUNDS; round += 1) {
      const query = this.planQuery(context, round);
      if (!query) break;

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
   * Successive, different questions - never the same query twice, which is what
   * get_run_history exists to prevent at the graph level too.
   * @param {object} context
   * @param {number} round
   * @returns {string|null}
   */
  planQuery(context, round) {
    const texts = context.requirements.map((r) => r.text);
    if (round === 1) return context.title + ' ' + (texts[0] ?? '');
    if (round === 2) return texts.slice(1, 3).join(' ') || null;
    return context.title;
  }
}
