import { describe, expect, it } from 'vitest';
import { Command, END, START, MemorySaver, StateGraph, interrupt } from '@langchain/langgraph';
import { decide } from '../../src/graph/nodes/decide.node.js';

const state = { requirements: [{ id: 'r1', nature: 'capacite', obligation: 'eliminatoire', quoteVerified: true, text: 'ISO 22301' }],
  matches: [{ requirementId: 'r1', status: 'unmet', confidence: 0.95, evidence: [], reason: 'Absente' }], score: 0 };

describe('human decision and evidence enforcement', () => {
  it('refuses GO for a model assertion with no validated support', async () => {
    expect(await decide({ ...state, matches: [{ ...state.matches[0], status: 'met' }] })).toMatchObject({ verdict: 'no-go', needsHuman: true });
  });
  it('keeps risks visible after an explicit human GO', async () => {
    const result = await decide({ ...state, humanDecisions: [{ verdictOverride: 'go', instruction: 'Partenariat a verifier avant depot.' }] });
    expect(result).toMatchObject({ verdict: 'go', needsHuman: true });
    expect(result.blockers).toHaveLength(1);
    expect(result.justification).toContain('Decision humaine');
  });
  it('applies dismissed blockers without rewriting the source matches', async () => {
    const result = await decide({ ...state, humanDecisions: [{ dismissedBlockers: ['r1'], instruction: 'Justificatif controle hors ligne.' }] });
    expect(result.blockers).toEqual([]);
    expect(result.matches[0].status).toBe('unmet');
    expect(result.needsHuman).toBe(true);
  });
  it('applies an override from an actual interrupt/resume checkpoint', async () => {
    const replace = { reducer: (_, next) => next };
    const graph = new StateGraph({ channels: { ...Object.fromEntries(Object.keys(state).map((k) => [k, replace])), humanDecisions: replace, verdict: replace, needsHuman: replace, justification: replace } })
      .addNode('ask', () => { interrupt({ question: 'Arbitrage ?' }); return {}; })
      .addNode('decide', async (value) => { const result = await decide(value); return { verdict: result.verdict, needsHuman: result.needsHuman, justification: result.justification }; })
      .addEdge(START, 'ask').addEdge('ask', 'decide').addEdge('decide', END).compile({ checkpointer: new MemorySaver() });
    const config = { configurable: { thread_id: 'human-review' } };
    await graph.invoke(state, config);
    expect((await graph.getState(config)).next).toContain('ask');
    const result = await graph.invoke(new Command({ resume: { choice: 'continue' }, update: { humanDecisions: [{ verdictOverride: 'go', instruction: 'Validation humaine explicite.' }] } }), config);
    expect(result).toMatchObject({ verdict: 'go', needsHuman: true });
    expect((await graph.getState(config)).next).toEqual([]);
  });
});
