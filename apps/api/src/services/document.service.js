/**
 * Document Service
 * Reading documents back out: metadata, extracted pages, and the original file.
 * Ingestion itself belongs to the graph's ingest node.
 */
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { appError } from '../lib/errors.js';
import DocumentRepository from '../repositories/document.repository.js';

export default class DocumentService {
  /** @param {DocumentRepository} [documents] injectable for tests */
  constructor(documents = new DocumentRepository()) {
    this.documents = documents;
  }

  /**
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(id) {
    const document = await this.documents.findById(id);
    if (!document) throw appError('Document introuvable.', 'DOCUMENT_NOT_FOUND', 404);
    return document;
  }

  /**
   * Extracted pages in reading order.
   *
   * An unread page is returned WITH readable:false rather than omitted or blanked.
   * EX-07 asks the system to say what it could not read; a missing page and an
   * empty page are indistinguishable to a reader, and both look like "there was
   * nothing there".
   *
   * @param {string} id
   * @returns {Promise<{ documentId: string, pageCount: number, pages: object[], unreadPages: number[] }>}
   */
  async getPages(id) {
    const document = await this.getById(id);
    const chunks = await this.documents.findChunks(id);

    const pages = chunks.map((chunk) => ({
      page: chunk.page,
      article: chunk.article,
      readable: chunk.extraction !== 'unread',
      extraction: chunk.extraction,
      text: chunk.extraction === 'unread' ? null : chunk.content,
    }));

    return {
      documentId: document.id,
      kind: document.kind,
      extractionPath: document.extractionPath,
      pageCount: document.pageCount,
      pages,
      unreadPages: pages.filter((p) => !p.readable).map((p) => p.page),
    };
  }

  /**
   * The original PDF, for EX-03: the UI links a citation to
   * /documents/:id/file#page=N and the browser's own viewer jumps to the page.
   * No PDF.js embed, no viewer component - an anchor and a byte stream.
   *
   * The path comes from the DB, never from the request, so there is nothing for a
   * caller to traverse with.
   *
   * @param {string} id
   * @returns {Promise<{ stream: import('node:fs').ReadStream, filename: string }>}
   */
  async getFileStream(id) {
    const document = await this.getById(id);
    try {
      await access(document.filePath);
    } catch {
      throw appError(
        'Fichier source absent du disque. Le corpus est-il monté ?',
        'DOCUMENT_FILE_MISSING',
        410,
      );
    }
    return {
      stream: createReadStream(document.filePath),
      filename: document.filePath.split(/[\/]/).pop(),
    };
  }
}
