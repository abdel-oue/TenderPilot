/**
 * Content-addressed cache for parse/OCR output, keyed on the file byte hash.
 *
 * There is no separate cache table: documents.content_hash is UNIQUE and the
 * extracted pages live in document_chunks. The same bytes are never parsed twice,
 * which is what keeps prompt iteration fast when OCR costs ~10s per page.
 */
import { createHash } from 'node:crypto';
import DocumentRepository from '../repositories/document.repository.js';

/**
 * @param {Uint8Array|Buffer} buffer
 * @returns {string} sha256 hex digest
 */
export function hashFile(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Previously extracted pages for these exact bytes, or null on a miss.
 * @param {string} hash
 * @param {DocumentRepository} [documents] injectable for tests
 * @returns {Promise<{ documentId: string, pages: object[] }|null>}
 */
export async function getCachedPages(hash, documents = new DocumentRepository()) {
  const document = await documents.findByContentHash(hash);
  if (!document || document.extractionPath === 'pending') return null;

  const chunks = await documents.findChunks(document.id);
  if (chunks.length === 0) return null;

  return {
    documentId: document.id,
    pages: chunks.map((c) => ({ page: c.page, text: c.content, extraction: c.extraction })),
  };
}
