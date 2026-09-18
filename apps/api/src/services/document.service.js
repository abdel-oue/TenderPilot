/**
 * Document Service
 * Uploading documents in, and reading them back out: metadata, extracted pages,
 * and the original file.
 *
 * Extraction itself is NOT here. A dossier document is read by the graph's ingest
 * node when the analysis runs; a company document is read by the indexing worker.
 * Either way it is a minute of OCR, which is not something a POST waits on.
 */
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { basename } from 'node:path';
import { appError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { saveUpload } from '../lib/uploads.js';
import { indexJobId, indexQueue } from '../queue/queues.js';
import DocumentRepository from '../repositories/document.repository.js';

export default class DocumentService {
  /**
   * @param {object} [deps]
   * @param {DocumentRepository} [deps.documents]
   * @param {object} [deps.queue] the indexing queue, injectable for tests
   */
  constructor({ documents, queue } = {}) {
    this.documents = documents ?? new DocumentRepository();
    this.queue = queue ?? indexQueue;
  }

  /**
   * EX-01: a PDF dropped from the interface becomes a document row.
   *
   * The bytes are validated and written by lib/uploads.js before anything
   * touches the database, so a rejected file leaves nothing behind. The row is
   * upserted on (ownerId, contentHash): re-uploading the same file updates it
   * rather than creating a twin, and the hash is already the parse-cache key.
   *
   * A COMPANY document (tenderId null) is queued for indexing immediately -
   * that is what makes it citable by the Writer. A DOSSIER document is not: the
   * analysis run reads it, and indexing it here would OCR it twice.
   *
   * @param {object} input
   * @param {Buffer} input.buffer
   * @param {string} input.originalName
   * @param {string} input.kind already validated against the shared enum
   * @param {string} input.ownerId the session user, never a value from the body
   * @param {string|null} [input.tenderId] null for a company document
   * @returns {Promise<object>} the stored document
   */
  async upload({ buffer, originalName, kind, ownerId, tenderId = null }) {
    const { filePath, contentHash } = await saveUpload({ buffer, ownerId, tenderId });

    const document = await this.documents.upsert({
      ownerId,
      tenderId,
      kind,
      filePath,
      originalName,
      contentHash,
      extractionPath: 'pending',
      pageCount: 0,
    });

    if (tenderId === null) {
      await this.queue.add(
        'index',
        { document },
        { jobId: indexJobId(document.id) },
      );
    }

    logger.info({ documentId: document.id, kind, tenderId }, 'document: uploaded');
    return this.toPublic(document);
  }

  /**
   * The company's own corpus, as the UI lists it.
   * @param {string} ownerId
   * @returns {Promise<object[]>}
   */
  async listCompanyDocuments(ownerId) {
    const rows = await this.documents.findCompanyDocuments(ownerId);
    return rows.map((row) => this.toPublic(row));
  }

  /**
   * The wire shape. filePath and contentHash stay server side: one is a path on
   * our disk, the other is only ever useful to us.
   * @param {object} row
   * @returns {object}
   */
  toPublic(row) {
    return {
      id: row.id,
      kind: row.kind,
      tenderId: row.tenderId,
      originalName: row.originalName ?? basename(row.filePath),
      pageCount: row.pageCount,
      extractionPath: row.extractionPath,
      createdAt: row.createdAt,
    };
  }

  /**
   * @param {string} id
   * @param {string} ownerId another user's document is NOT_FOUND, not FORBIDDEN
   * @returns {Promise<object>}
   */
  async getById(id, ownerId) {
    const document = await this.documents.findByIdForOwner(id, ownerId);
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
   * @param {string} ownerId
   * @returns {Promise<{ documentId: string, pageCount: number, pages: object[], unreadPages: number[] }>}
   */
  async getPages(id, ownerId) {
    const document = await this.getById(id, ownerId);
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
   * The path comes from the DB after an ownership check, never from the request,
   * so there is nothing for a caller to traverse with.
   *
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<{ stream: import('node:fs').ReadStream, filename: string }>}
   */
  async getFileStream(id, ownerId) {
    const document = await this.getById(id, ownerId);
    try {
      await access(document.filePath);
    } catch {
      throw appError(
        'Fichier source absent du disque. Le corpus est-il monte ?',
        'DOCUMENT_FILE_MISSING',
        410,
      );
    }
    return {
      stream: createReadStream(document.filePath),
      filename: document.originalName ?? basename(document.filePath),
    };
  }
}
