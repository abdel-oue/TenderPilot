import { describe, expect, it, vi } from 'vitest';
import WriterAgent from '../../src/agents/writer.agent.js';

const CONTEXT = {
  title: 'Moyens humains',
  requirements: [
    { text: 'Chef de projet certifie PMP, 10 ans minimum', obligation: 'obligatoire', sourcePage: 4 },
  ],
};

const RUN = { runId: 'run-1', tenderId: 'tender-1', ownerId: 'owner-1' };

const SECTION = { title: CONTEXT.title, content: 'ok', citations: [], needsHuman: false };

/**
 * The Writer does not drive the search itself any more: it hands the belt to the
 * model and the model decides what to call. So what is worth asserting here is
 * the CONTRACT it passes down - that the tools are really offered, really bound
 * to this run's owner, and really recorded - not a query string the agent no
 * longer invents.
 */
function build(tools = { definitions: () => [], execute: vi.fn() }) {
  const llm = { complete: vi.fn(async () => SECTION) };
  return [new WriterAgent(llm, tools), llm];
}

describe('WriterAgent.draft', () => {
  it('offers the model the whole tool belt', async () => {
    const definitions = [{ type: 'function', function: { name: 'search_documents' } }];
    const [agent, llm] = build({ definitions: () => definitions, execute: vi.fn() });

    await agent.draft(CONTEXT, RUN);

    expect(llm.complete.mock.calls[0][0].toolkit.definitions).toBe(definitions);
  });

  it('binds every tool call to this run, so a tool cannot widen its own scope', async () => {
    // The ownerId comes from the run context, never from an argument the model
    // wrote - the model has been reading an outsider's PDF.
    const execute = vi.fn(async () => ({ extracts: [] }));
    const [agent, llm] = build({ definitions: () => [{}], execute });

    await agent.draft(CONTEXT, RUN);
    await llm.complete.mock.calls[0][0].toolkit.execute('search_documents', { query: 'x' });

    expect(execute).toHaveBeenCalledWith('search_documents', { query: 'x' }, RUN);
  });

  it('records every tool call on the section, so the trace shows what it looked at', async () => {
    const [agent, llm] = build({ definitions: () => [{}], execute: vi.fn() });

    const llmComplete = llm.complete;
    llmComplete.mockImplementation(async (options) => {
      options.toolkit.onToolCall({ tool: 'get_company_facts', args: { scope: 'equipe' }, result: {} });
      options.toolkit.onToolCall({ tool: 'calculate', args: { expression: '1+1' }, result: {} });
      return SECTION;
    });

    const section = await agent.draft(CONTEXT, RUN);

    expect(section.toolCalls.map((c) => c.tool)).toEqual(['get_company_facts', 'calculate']);
  });

  it('bounds the tool loop, because an agent that can loop forever is a hung demo', async () => {
    const [agent, llm] = build();
    await agent.draft(CONTEXT, RUN);
    expect(llm.complete.mock.calls[0][0].toolkit.maxRounds).toBeGreaterThan(0);
  });

  it('runs on the reasoning tier, which is where admitting a gap is affordable', async () => {
    const [agent, llm] = build();
    await agent.draft(CONTEXT, RUN);
    expect(llm.complete.mock.calls[0][0].tier).toBe('reasoning');
  });

  it('passes earlier human corrections into the prompt so later sections align', async () => {
    const [agent, llm] = build();

    await agent.draft(
      { ...CONTEXT, humanEdits: [{ title: 'Methodologie', content: 'Texte reecrit par le dirigeant.' }] },
      RUN,
    );

    expect(llm.complete.mock.calls[0][0].user).toContain('Texte reecrit par le dirigeant.');
  });

  it('passes the compliance refusal back in when a section is redrafted', async () => {
    const [agent, llm] = build();

    await agent.draft({ ...CONTEXT, instructions: 'Retire REF-99, il est invente.' }, RUN);

    expect(llm.complete.mock.calls[0][0].user).toContain('REF-99');
  });
});
