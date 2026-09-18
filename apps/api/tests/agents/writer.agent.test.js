import { describe, expect, it, vi } from 'vitest';
import WriterAgent from '../../src/agents/writer.agent.js';

const CONTEXT = {
  title: 'Moyens humains',
  requirements: [{ text: 'Chef de projet certifie PMP, 10 ans minimum', obligation: 'obligatoire', sourcePage: 4 }],
};

/**
 * The search query has to be the model's, not a string built from the section
 * title: a template asks the same question every time, so it can only ever find
 * the same thing.
 */
describe('WriterAgent.draft', () => {
  const agentWith = ({ plan, tools }) => {
    const llm = {
      complete: vi.fn(async ({ name }) =>
        name === 'writer:plan' ? plan : { title: CONTEXT.title, content: 'ok', citations: [], needsHuman: false },
      ),
    };
    return [new WriterAgent(llm, tools), llm];
  };

  it('searches the company corpus with the query the model asked for', async () => {
    const tools = { execute: vi.fn(async () => ({ extracts: [{ documentId: 'd1', page: 3, excerpt: 'CV-03 PMP' }] })) };
    const [agent] = agentWith({ plan: { queries: ['chef de projet certifie PMP'] }, tools });

    const section = await agent.draft(CONTEXT);

    expect(tools.execute).toHaveBeenCalledWith(
      'search_company_docs',
      { query: 'chef de projet certifie PMP', limit: 4 },
      {},
    );
    expect(section.toolCalls).toHaveLength(1);
  });

  it('tries the next query when the first one finds nothing', async () => {
    const tools = { execute: vi.fn(async () => ({ extracts: [] })) };
    const [agent] = agentWith({ plan: { queries: ['premiere', 'seconde'] }, tools });

    await agent.draft(CONTEXT);

    expect(tools.execute.mock.calls.map((c) => c[1].query)).toEqual(['premiere', 'seconde']);
  });

  it('stops searching as soon as a query finds evidence', async () => {
    const tools = {
      execute: vi.fn(async () => ({ extracts: [{ documentId: 'd1', page: 1, excerpt: 'x' }] })),
    };
    const [agent] = agentWith({ plan: { queries: ['a', 'b', 'c'] }, tools });

    await agent.draft(CONTEXT);

    expect(tools.execute).toHaveBeenCalledTimes(1);
  });

  it('never fires the same query twice', async () => {
    const tools = { execute: vi.fn(async () => ({ extracts: [] })) };
    const [agent] = agentWith({ plan: { queries: ['meme', 'meme'] }, tools });

    await agent.draft(CONTEXT);

    expect(tools.execute).toHaveBeenCalledTimes(1);
  });

  it('falls back to the section title when the planning call fails', async () => {
    const tools = { execute: vi.fn(async () => ({ extracts: [] })) };
    const llm = {
      complete: vi.fn(async ({ name }) => {
        if (name === 'writer:plan') throw new Error('LLM_REQUEST_FAILED');
        return { title: CONTEXT.title, content: 'ok', citations: [], needsHuman: false };
      }),
    };
    const agent = new WriterAgent(llm, tools);

    const section = await agent.draft(CONTEXT);

    expect(tools.execute.mock.calls[0][1].query).toBe('Moyens humains');
    expect(section.content).toBe('ok');
  });

  it('tells the Writer to mark the section for a human when nothing is found', async () => {
    const tools = { execute: vi.fn(async () => ({ extracts: [] })) };
    const [, llm] = agentWith({ plan: { queries: ['rien'] }, tools });
    const agent = new WriterAgent(llm, tools);

    await agent.draft(CONTEXT);

    const draftCall = llm.complete.mock.calls.find(([o]) => o.name === 'writer')[0];
    expect(draftCall.user).toContain('[A COMPLETER PAR L');
  });
});
