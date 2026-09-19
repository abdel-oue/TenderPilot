import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeActivity } from '../../src/lib/activity.js';

/**
 * The per-page routing, with unpdf and the OCR binaries stubbed out. The real
 * isReadablePage is kept: the decision under test is which pages get rasterized,
 * and faking the readability rule would test nothing.
 */
const mocks = vi.hoisted(() => ({
  readFile: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
  hashFile: vi.fn(() => 'hash'),
  getCachedPages: vi.fn(async () => null),
  extractPages: vi.fn(),
  ocrAvailable: vi.fn(async () => true),
  ocrPages: vi.fn(async () => []),
  repo: {
    upsert: vi.fn(async () => ({ id: 'doc-1' })),
    deleteChunks: vi.fn(async () => {}),
    insertChunks: vi.fn(async () => {}),
    updateChunk: vi.fn(async () => {}),
    updateExtractionPath: vi.fn(async () => {}),
  },
}));

vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }));
vi.mock('../../src/lib/cache.js', () => ({
  hashFile: mocks.hashFile,
  getCachedPages: mocks.getCachedPages,
}));
vi.mock('../../src/lib/ocr.js', () => ({
  ocrAvailable: mocks.ocrAvailable,
  ocrPages: mocks.ocrPages,
}));
vi.mock('../../src/lib/pdf.js', async (importOriginal) => ({
  ...(await importOriginal()),
  extractPages: mocks.extractPages,
}));
vi.mock('../../src/repositories/document.repository.js', () => ({
  default: class {
    constructor() {
      return mocks.repo;
    }
  },
}));

const { documentExtractionPath, ingestDocument } = await import(
  '../../src/graph/nodes/ingest.node.js'
);

const READABLE = 'Le candidat doit fournir une attestation CNSS de moins de trois mois.';
const DOCUMENT = { id: 'doc-1', ownerId: 'user-1', filePath: '/tmp/cps.pdf', kind: 'cps' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readFile.mockResolvedValue(Buffer.from('%PDF-1.7 fake'));
  mocks.hashFile.mockReturnValue('hash');
  mocks.getCachedPages.mockResolvedValue(null);
  mocks.ocrAvailable.mockResolvedValue(true);
  mocks.repo.upsert.mockResolvedValue({ id: 'doc-1' });
});

describe('ingestDocument', () => {
  it('rasterizes only the pages whose text layer was unusable', async () => {
    mocks.extractPages.mockResolvedValue([
      { page: 1, text: READABLE },
      { page: 2, text: '' },
      { page: 3, text: READABLE },
    ]);
    mocks.ocrPages.mockResolvedValue([{ page: 2, text: READABLE }]);

    const result = await ingestDocument(DOCUMENT);

    // The whole point: page 2 alone, not the document.
    expect(mocks.ocrPages).toHaveBeenCalledWith(expect.anything(), [2]);
    expect(result.pages.map((p) => p.extraction)).toEqual(['text_layer', 'ocr', 'text_layer']);
    expect(result.extractionPath).toBe('mixed');
  });

  it('spends nothing on OCR when every page reads', async () => {
    mocks.extractPages.mockResolvedValue([
      { page: 1, text: READABLE },
      { page: 2, text: READABLE },
    ]);

    const result = await ingestDocument(DOCUMENT);

    expect(mocks.ocrPages).not.toHaveBeenCalled();
    expect(result.extractionPath).toBe('text_layer');
  });

  it('keeps a page unread when OCR could not read it either', async () => {
    mocks.extractPages.mockResolvedValue([
      { page: 1, text: READABLE },
      { page: 2, text: '' },
    ]);
    mocks.ocrPages.mockResolvedValue([{ page: 2, text: '' }]);

    const result = await ingestDocument(DOCUMENT);

    // EX-07: the page stays a row, it does not vanish and it is not called empty.
    expect(result.pages[1]).toMatchObject({ page: 2, extraction: 'unread' });
    expect(mocks.repo.insertChunks).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ page: 2, extraction: 'unread' })]),
    );
  });

  it('fails loudly on a scan when the OCR toolchain is missing', async () => {
    mocks.extractPages.mockResolvedValue([{ page: 1, text: '' }, { page: 2, text: '' }]);
    mocks.ocrAvailable.mockResolvedValue(false);

    await expect(ingestDocument(DOCUMENT)).rejects.toThrow(/OCR toolchain/);
  });

  it('reads what it can when the OCR toolchain is missing but some pages have text', async () => {
    mocks.extractPages.mockResolvedValue([
      { page: 1, text: READABLE },
      { page: 2, text: '' },
    ]);
    mocks.ocrAvailable.mockResolvedValue(false);

    const result = await ingestDocument(DOCUMENT);

    expect(result.pages.map((p) => p.extraction)).toEqual(['text_layer', 'unread']);
  });
});

describe('ingestDocument, on a cache hit', () => {
  it('repairs the unread pages of a document that was never OCR"d', async () => {
    mocks.getCachedPages.mockResolvedValue({
      documentId: 'doc-1',
      extractionPath: 'text_layer',
      pages: [
        { id: 'c1', page: 1, text: READABLE, extraction: 'text_layer' },
        { id: 'c2', page: 2, text: '', extraction: 'unread' },
      ],
    });
    mocks.ocrPages.mockResolvedValue([{ page: 2, text: READABLE }]);

    const result = await ingestDocument(DOCUMENT);

    expect(mocks.ocrPages).toHaveBeenCalledWith(expect.anything(), [2]);
    expect(mocks.repo.updateChunk).toHaveBeenCalledWith('c2', {
      content: READABLE,
      extraction: 'ocr',
    });
    // Marking the document is what bounds the retry to once.
    expect(mocks.repo.updateExtractionPath).toHaveBeenCalledWith('doc-1', 'mixed');
    expect(result.pages[1].extraction).toBe('ocr');
  });

  it('does not re-OCR a document where OCR already came up empty', async () => {
    mocks.getCachedPages.mockResolvedValue({
      documentId: 'doc-1',
      extractionPath: 'mixed',
      pages: [
        { id: 'c1', page: 1, text: READABLE, extraction: 'ocr' },
        { id: 'c2', page: 2, text: '', extraction: 'unread' },
      ],
    });

    await ingestDocument(DOCUMENT);

    expect(mocks.ocrPages).not.toHaveBeenCalled();
    expect(mocks.repo.updateChunk).not.toHaveBeenCalled();
  });

  it('returns straight from cache when nothing is unread', async () => {
    mocks.getCachedPages.mockResolvedValue({
      documentId: 'doc-1',
      extractionPath: 'text_layer',
      pages: [{ id: 'c1', page: 1, text: READABLE, extraction: 'text_layer' }],
    });

    await ingestDocument(DOCUMENT);

    expect(mocks.ocrAvailable).not.toHaveBeenCalled();
    expect(mocks.ocrPages).not.toHaveBeenCalled();
  });
});

describe('documentExtractionPath', () => {
  it('reports a document read entirely from its text layer', () => {
    expect(documentExtractionPath([{ extraction: 'text_layer' }])).toBe('text_layer');
  });

  it('reports a pure scan as ocr, unread pages included', () => {
    expect(documentExtractionPath([{ extraction: 'ocr' }, { extraction: 'unread' }])).toBe('ocr');
  });

  it('reports a document read by both paths as mixed', () => {
    expect(documentExtractionPath([{ extraction: 'text_layer' }, { extraction: 'ocr' }])).toBe(
      'mixed',
    );
  });

  it('reports a document nothing could read as ocr, because OCR was tried', () => {
    expect(documentExtractionPath([{ extraction: 'unread' }])).toBe('ocr');
  });
});

describe('ingestion activity and timing', () => {
  it.each(['text', 'ocr', 'mixed'])('reports actual tools and separate durations for %s', async (mode) => {
    let clock = 1000;
    const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const events = [];
    mocks.extractPages.mockImplementation(async () => {
      clock += 25;
      return [{ page: 1, text: mode === 'ocr' ? '' : READABLE }, ...(mode === 'mixed' ? [{ page: 2, text: '' }] : [])];
    });
    mocks.ocrPages.mockImplementation(async (_buffer, pages) => {
      clock += 750;
      return pages.map((page) => ({ page, text: READABLE }));
    });
    try {
      await nodeActivity.run({ node: 'ingest', record: async (tool) => events.push({ ...tool }) }, () => ingestDocument(DOCUMENT));
      const finished = events.filter((event) => event.status === 'ok');
      expect(finished.map((event) => event.name)).toEqual(mode === 'text' ? ['document_cache', 'extract_text'] : ['document_cache', 'extract_text', 'ocr']);
      expect(finished.find((event) => event.name === 'extract_text').ms).toBe(25);
      if (mode !== 'text') expect(finished.find((event) => event.name === 'ocr').ms).toBe(750);
      expect(events.filter((event) => event.status === 'running')).toHaveLength(finished.length);
    } finally { timer.mockRestore(); }
  });

  it('labels reused OCR pages as a cache read, not a new OCR operation', async () => {
    mocks.getCachedPages.mockResolvedValue({ documentId: 'doc-1', extractionPath: 'ocr', pages: [{ page: 1, text: READABLE, extraction: 'ocr' }] });
    const events = [];
    await nodeActivity.run({ node: 'ingest', record: async (tool) => events.push({ ...tool }) }, () => ingestDocument(DOCUMENT));
    expect(events.map((event) => event.name)).toEqual(['document_cache', 'document_cache']);
    expect(mocks.extractPages).not.toHaveBeenCalled();
    expect(mocks.ocrPages).not.toHaveBeenCalled();
  });
});
