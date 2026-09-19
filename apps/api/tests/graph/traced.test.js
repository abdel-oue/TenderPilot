import { describe, expect, it, vi } from 'vitest';
import { GraphInterrupt } from '@langchain/langgraph';
import { traced } from '../../src/graph/index.js';

/** A repository double that records what was appended instead of touching a DB. */
function repo() {
  const entries = [];
  return { entries, async appendTrace(_runId, entry) { entries.push(entry); } };
}

const STATE = { runId: 'run-1', tenderId: 'tender-1' };

describe('traced', () => {
  it('records one entry when the node succeeds', async () => {
    const analyses = repo();
    const node = traced('ingest', async () => ({ pages: [1, 2] }), analyses);

    const patch = await node(STATE);

    expect(analyses.entries).toHaveLength(1);
    expect(analyses.entries[0]).toMatchObject({ node: 'ingest', status: 'ok' });
    expect(patch.nodeTrace).toHaveLength(1);
    expect(patch.pages).toEqual([1, 2]);
  });

  it('records an ordinary failure and lets the graph carry on', async () => {
    // A dossier half-analysed with an explicit error beats no answer at all, so
    // the node swallows the throw and returns an error entry instead.
    const analyses = repo();
    const node = traced('matchProfile', async () => { throw new Error('OCR indisponible'); }, analyses);

    const patch = await node(STATE);

    expect(analyses.entries[0]).toMatchObject({ status: 'error', summary: 'OCR indisponible' });
    expect(patch.errors).toEqual([{ node: 'matchProfile', message: 'OCR indisponible' }]);
  });

  it('rethrows an interrupt instead of recording it as a failed node', async () => {
    // This is the whole human-in-the-loop feature in one assertion. ask_human
    // signals by throwing, and this catch-all is the last thing between that
    // throw and LangGraph: swallowed here, the pause becomes a failed node and
    // the agent answers the dossier alone having been told nothing.
    const analyses = repo();
    const interrupt = new GraphInterrupt([{ value: { question: 'ISO 22301 ?' } }]);
    const node = traced('matchProfile', async () => { throw interrupt; }, analyses);

    await expect(node(STATE)).rejects.toBe(interrupt);
    expect(analyses.entries).toEqual([]);
  });

  it('does not write a trace for a run that has no id', async () => {
    const analyses = repo();
    const appendTrace = vi.spyOn(analyses, 'appendTrace');

    await traced('ingest', async () => ({}), analyses)({});

    expect(appendTrace).not.toHaveBeenCalled();
  });
});
