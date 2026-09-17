import { describe, expect, it } from 'vitest';
import ToolsService from '../../src/services/tools.service.js';

const stubLlm = { async embed(inputs) { return inputs.map(() => [0.1, 0.2]); } };
const noTavily = { isEnabled: false, async search() { return { results: [], answer: null, degraded: true }; } };
const liveTavily = {
  isEnabled: true,
  async search() { return { results: [{ title: 't', url: 'u', content: 'c', score: 1 }], answer: 'a', degraded: false }; },
};

function build(overrides = {}) {
  return new ToolsService({
    llm: stubLlm,
    tavily: noTavily,
    documents: { async searchSimilarChunks() { return []; }, async findChunks() { return []; } },
    analyses: { async findRunById() { return null; } },
    usage: { async findByRequest() { return []; } },
    ...overrides,
  });
}

describe('ToolsService.definitions', () => {
  it('omits web_search entirely when Tavily has no key', () => {
    expect(build().names()).not.toContain('web_search');
  });

  it('offers web_search once Tavily is configured', () => {
    expect(build({ tavily: liveTavily }).names()).toContain('web_search');
  });

  it('always offers the three internal tools', () => {
    expect(build().names()).toEqual(
      expect.arrayContaining(['search_company_docs', 'read_source_page', 'get_run_history']),
    );
  });
});

describe('ToolsService.execute', () => {
  it('returns an error object for an unknown tool rather than throwing', async () => {
    await expect(build().execute('rm_rf', {})).resolves.toMatchObject({ error: expect.any(String) });
  });

  it('turns a throwing tool into an error object, so the graph survives it', async () => {
    const tools = build({
      documents: { async searchSimilarChunks() { throw new Error('pgvector down'); } },
    });
    const result = await tools.execute('search_company_docs', { query: 'ISO 27001' });
    expect(result).toEqual({ error: 'pgvector down' });
  });
});

describe('search_company_docs', () => {
  it('says plainly when nothing matches, instead of returning a near miss', async () => {
    const result = await build().execute('search_company_docs', { query: 'aeronautique' });
    expect(result.extracts).toEqual([]);
    expect(result.note).toMatch(/Aucun document/);
  });

  it('carries document and page through every extract, so a citation stays checkable', async () => {
    const tools = build({
      documents: {
        async searchSimilarChunks() {
          return [{ documentId: 'd1', page: 4, article: 'Art. 3', content: 'texte', distance: 0.2 }];
        },
        async findChunks() { return []; },
      },
    });
    const result = await tools.execute('search_company_docs', { query: 'ISO' });
    expect(result.extracts[0]).toMatchObject({ documentId: 'd1', page: 4, article: 'Art. 3' });
  });

  it('rejects an empty query without spending an embedding call', async () => {
    const result = await build().execute('search_company_docs', { query: '   ' });
    expect(result.extracts).toEqual([]);
  });
});

describe('read_source_page', () => {
  const chunks = [
    { page: 3, article: 'Article 7.2', content: 'Le candidat doit...', extraction: 'text_layer' },
    { page: 4, article: null, content: '', extraction: 'unread' },
  ];
  const tools = () => build({ documents: { async findChunks() { return chunks; }, async searchSimilarChunks() { return []; } } });

  it('returns the exact page text for verification', async () => {
    const result = await tools().execute('read_source_page', { documentId: 'd1', page: 3 });
    expect(result).toMatchObject({ readable: true, page: 3, article: 'Article 7.2' });
  });

  it('flags an unreadable page instead of returning empty text', async () => {
    // Empty text would read as "this page says nothing", which is how an agent
    // ends up inventing requirements for a scan it could not read.
    const result = await tools().execute('read_source_page', { documentId: 'd1', page: 4 });
    expect(result.readable).toBe(false);
    expect(result.text).toBeUndefined();
    expect(result.note).toMatch(/pas pu etre lue/);
  });

  it('reports a missing page as an error', async () => {
    const result = await tools().execute('read_source_page', { documentId: 'd1', page: 99 });
    expect(result.error).toMatch(/introuvable/);
  });
});

describe('get_run_history', () => {
  it('returns what the run already tried, which is what stops a repeated query', async () => {
    const tools = build({
      analyses: {
        async findRunById() {
          return { nodeTrace: [{ node: 'retrieve', summary: 'ISO 27001 -> 0 hits', status: 'ok', at: 'now' }] };
        },
      },
      usage: { async findByRequest() { return [{ operation: 'matcher', status: 'ok', totalTokens: 90 }]; } },
    });
    const result = await tools.execute('get_run_history', {}, { runId: 'run-1' });
    expect(result.steps[0].summary).toContain('0 hits');
    expect(result.calls[0].operation).toBe('matcher');
  });

  it('is harmless when called outside a run', async () => {
    const result = await build().execute('get_run_history', {}, {});
    expect(result.steps).toEqual([]);
  });
});

describe('web_search', () => {
  it('tells the model the search was unavailable rather than implying no results exist', async () => {
    const result = await build({ tavily: noTavily }).execute('web_search', { query: 'q' });
    expect(result.results).toEqual([]);
    expect(result.note).toMatch(/indisponible/);
  });

  it('returns results when Tavily answers', async () => {
    const result = await build({ tavily: liveTavily }).execute('web_search', { query: 'q' });
    expect(result.results).toHaveLength(1);
    expect(result.answer).toBe('a');
  });
});
