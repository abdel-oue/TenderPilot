import { describe, expect, it } from 'vitest';
import { END } from '@langchain/langgraph';
import { shouldDraft, summarize } from '../../src/graph/index.js';
import { MAX_REDRAFTS, shouldRedraft } from '../../src/graph/nodes/compliance.node.js';

describe('shouldDraft (the go/no-go edge)', () => {
  it('sends a go dossier to the Writer', () => {
    expect(shouldDraft({ verdict: 'go' })).toBe('draft');
  });

  it('stops a no-go before drafting, so no tokens are spent on a lost dossier', () => {
    expect(shouldDraft({ verdict: 'no-go' })).toBe(END);
  });

  it('stops when no verdict was reached at all', () => {
    expect(shouldDraft({ verdict: null })).toBe(END);
    expect(shouldDraft({})).toBe(END);
  });
});

describe('shouldRedraft (the compliance refusal edge)', () => {
  it('goes to export when nothing was refused', () => {
    expect(shouldRedraft({ rejected: [], redraftCount: {} })).toBe('export');
  });

  it('sends a refused section back to the Writer', () => {
    expect(shouldRedraft({ rejected: [{ key: 'team' }], redraftCount: { team: 1 } })).toBe('draft');
  });

  it('stops once every refused section is over the cap', () => {
    // The cap is enforced HERE, in the edge, never by asking the model to stop.
    expect(
      shouldRedraft({ rejected: [{ key: 'team' }], redraftCount: { team: MAX_REDRAFTS + 1 } }),
    ).toBe('export');
  });

  it('cannot loop forever: the count only ever grows', () => {
    let state = { rejected: [{ key: 'team' }], redraftCount: { team: 0 } };
    let hops = 0;
    while (shouldRedraft(state) === 'draft' && hops < 20) {
      state = { ...state, redraftCount: { team: state.redraftCount.team + 1 } };
      hops += 1;
    }
    expect(hops).toBeLessThanOrEqual(MAX_REDRAFTS + 1);
  });

  it('sends a freshly rejected section back to the Writer', () => {
    // A rejection with no recorded attempt is a first refusal, and a first
    // refusal is exactly what the revision loop exists for. The previous
    // assertion expected 'export' here, which described the old guard's bug -
    // it read every entry in redraftCount, including approved sections sitting
    // at zero, so it never actually bounded anything.
    expect(shouldRedraft({ rejected: [{ key: 'team' }] })).toBe('draft');
  });

  it('stops redrafting a section that has used up its attempts', () => {
    expect(
      shouldRedraft({ rejected: [{ key: 'team' }], redraftCount: { team: MAX_REDRAFTS + 1 } }),
    ).toBe('export');
  });
});

describe('summarize (what the trace panel and the video show)', () => {
  it('makes a fast cached ingestion explicit even if pages originally came from OCR', () => {
    expect(summarize('ingest', { documents: [{ extractionPath: 'cached' }], pages: [{ extraction: 'ocr' }] })).toContain('1 document(s) repris du cache');
  });
  it('reports OCR and unreadable pages, which is EX-07 made visible', () => {
    const summary = summarize('ingest', {
      pages: [
        { extraction: 'ocr' },
        { extraction: 'ocr' },
        { extraction: 'unread' },
      ],
    });
    expect(summary).toContain('3 pages lues');
    expect(summary).toContain('2 par OCR');
    expect(summary).toContain('1 illisibles');
  });

  it('says nothing about OCR when the dossier had a text layer', () => {
    expect(summarize('ingest', { pages: [{ extraction: 'text_layer' }] })).toBe('1 pages lues');
  });

  it('counts eliminatory requirements, not just requirements', () => {
    const summary = summarize('classifyRequirements', {
      requirements: [{ obligation: 'eliminatoire' }, { obligation: 'obligatoire' }],
    });
    expect(summary).toContain('1 exigences eliminatoires');
  });

  it('leads the verdict with its blockers', () => {
    expect(summarize('decide', { verdict: 'no-go', blockers: [{}, {}] })).toBe(
      'no-go - 2 point(s) bloquant(s)',
    );
  });

  it('never throws on an empty patch', () => {
    expect(() => summarize('decide', {})).not.toThrow();
    expect(() => summarize('unknown-node')).not.toThrow();
  });
});

describe('trace narration', () => {
  it('counts the tool calls in the node summary', () => {
    const summary = summarize('draft', {
      sections: [{}, {}],
      toolCalls: [{ tool: 'search_documents' }, { tool: 'calculate' }],
    });
    expect(summary).toContain('2 sections redigees');
    expect(summary).toContain("2 appel(s) d'outil");
  });

  it('says nothing about tools on a node that called none', () => {
    expect(summarize('draft', { sections: [{}] })).toBe('1 sections redigees');
  });
});
