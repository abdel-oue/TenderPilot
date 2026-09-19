import { describe, expect, it, vi } from 'vitest';
import DocumentController from '../../src/controllers/document.controller.js';
import DocumentService from '../../src/services/document.service.js';

const UUID = '4e3d9250-2caf-47da-afe6-32b1af32c4db';
const OWNER = 'owner-1';

/** Every controller reads its owner from the session, never from the body. */
const asUser = (request) => ({ ...request, user: { id: OWNER } });

function fakeReply() {
  const reply = {
    statusCode: 200,
    headers: {},
    payload: undefined,
    code(s) { reply.statusCode = s; return reply; },
    header(k, v) { reply.headers[k] = v; return reply; },
    send(p) { reply.payload = p; return reply; },
  };
  return reply;
}

describe('DocumentController.file (EX-03)', () => {
  it('serves the PDF inline, so the browser viewer honours #page=N', async () => {
    const service = { getFileStream: async () => ({ stream: 'STREAM', filename: 'AO-2026-001.pdf' }) };
    const reply = fakeReply();

    await new DocumentController(service).file(asUser({ params: { id: UUID } }), reply);

    expect(reply.headers['content-type']).toBe('application/pdf');
    // `inline`, not `attachment`: an attachment downloads instead of jumping to
    // the page, which is exactly what EX-03 asks for and against.
    expect(reply.headers['content-disposition']).toContain('inline');
    expect(reply.payload).toBe('STREAM');
  });

  it('rejects a malformed id before touching the filesystem', async () => {
    const service = { getFileStream: vi.fn() };
    await expect(
      new DocumentController(service).file(asUser({ params: { id: '../../etc/passwd' } }), fakeReply()),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    expect(service.getFileStream).not.toHaveBeenCalled();
  });
});

describe('DocumentService.getPages (EX-07)', () => {
  const documents = {
    async findByIdForOwner() {
      return { id: UUID, kind: 'avis', extractionPath: 'ocr', pageCount: 3, filePath: '/x.pdf' };
    },
    async findChunks() {
      return [
        { page: 1, article: 'Art. 1', content: 'Texte lisible', extraction: 'ocr' },
        { page: 2, article: null, content: '', extraction: 'unread' },
        { page: 3, article: null, content: 'Encore du texte', extraction: 'ocr' },
      ];
    },
  };

  it('keeps an unreadable page in the list and marks it as such', async () => {
    const result = await new DocumentService({ documents }).getPages(UUID, OWNER);
    // Omitting it would make "could not read" indistinguishable from "was blank",
    // which is the silent failure EX-07 forbids.
    expect(result.pages).toHaveLength(3);
    expect(result.pages[1]).toMatchObject({ page: 2, readable: false, text: null });
  });

  it('lists the unread page numbers for the UI banner', async () => {
    const result = await new DocumentService({ documents }).getPages(UUID, OWNER);
    expect(result.unreadPages).toEqual([2]);
  });

  it('returns the text of readable pages', async () => {
    const result = await new DocumentService({ documents }).getPages(UUID, OWNER);
    expect(result.pages[0].text).toBe('Texte lisible');
  });

  it('throws NOT_FOUND for an unknown document', async () => {
    const empty = { async findByIdForOwner() { return undefined; }, async findChunks() { return []; } };
    await expect(new DocumentService({ documents: empty }).getPages(UUID, OWNER)).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  });
});
