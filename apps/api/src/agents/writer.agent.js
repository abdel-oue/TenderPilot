/**
 * Writer Agent
 * Drafts one section of the memoire technique, with tools.
 *
 * Runs on the REASONING tier: this is the agent that plans (which tool to call),
 * acts, and writes prose a human will sign. It is also the one place where
 * fabricating a reference would be catastrophic and plausible at the same time,
 * so it gets the model that can be told "admit the gap" and comply.
 *
 * The model chooses its own tool calls - it is not a hardcoded search wrapped in
 * a loop. It asks the corpus what it needs, reads exact figures out of the
 * profile, checks a date or a montant with the arithmetic tools, and only then
 * writes. Every call it makes is recorded on the section, so the trace panel and
 * the jury see the reasoning, not just the output.
 *
 * The loop is bounded by LlmService. An agent that can call tools forever is a
 * demo that never finishes.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import ToolsService from '../services/tools.service.js';
import { WRITER_SYSTEM, renderWriterTask } from '../prompts/writer.prompts.js';
import { WRITER_STUB, draftedSectionSchema } from './schema.js';

const MAX_TOOL_ROUNDS = 4;

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

    const section = await this.llm.complete({
      name: 'writer',
      tier: TIERS.REASONING,
      system: WRITER_SYSTEM,
      user: renderWriterTask(context),
      schema: draftedSectionSchema,
      stub: { ...WRITER_STUB, title: context.title },
      toolkit: {
        definitions: this.tools.definitions(),
        maxRounds: MAX_TOOL_ROUNDS,
        execute: (name, args) => this.tools.execute(name, args, runContext),
        onToolCall: (call) => toolCalls.push(call),
        // Offline, the belt is still exercised against the real repositories -
        // owner scoping, pgvector, the trace - so a broken tool fails the suite
        // instead of waiting to fail in front of the jury.
        stubCall: () => ({
          tool: 'search_documents',
          args: { query: context.title, corpus: 'entreprise', limit: 4 },
        }),
      },
    });

    return { ...section, toolCalls };
  }
}
