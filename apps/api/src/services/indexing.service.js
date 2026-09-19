/**
 * Indexing Service
 * Turns the company's own documents into something search_documents can find.
 *
 * Two halves, and both were missing:
 *   1. the company corpus (attestations, past memoires, profil) has tenderId NULL,
 *      so the graph's ingest node - which reads findByTender - never touched it;
 *   2. nothing ever called llm.embed() on a chunk, so every embedding was NULL and
 *      the pgvector search could only ever return zero rows.
 *
 * With an empty index the Writer marks every section [A COMPLETER PAR L'HUMAIN].
 * That guard-rail is correct behaviour, but it was firing because there was
 * nothing to cite rather than because the evidence was genuinely absent - which
 * is a different, and much worse, thing to demo.
 */
import { ingestDocument } from '../graph/nodes/ingest.node.js';
import { logger } from '../lib/logger.js';
import DocumentRepository from '../repositories/document.repository.js';
import LlmService from './llm.service.js';

// One embedding request per batch of chunks rather than one per chunk. A memoire
// is ~30 pages; 32 round trips instead of 1 is the whole latency of this step.
const BATCH_SIZE = 32;

export default class IndexingService {
  /**
   * @param {object} [deps]
   * @param {DocumentRepository} [deps.documents]
   * @param {LlmService} [deps.llm]
   */
  constructor({ documents, llm } = {}) {
    this.documents = documents ?? new DocumentRepository();
    this.llm = llm ?? new LlmService();
  }

  /**
   * Reads a document (text layer or OCR) and embeds every chunk that has no
   * vector yet.
   *
   * Resumable by construction: it only ever looks at chunks whose embedding is
   * NULL, so a run interrupted halfway picks up where it stopped instead of
   * paying for the same embeddings twice.
   *
   * @param {{ id: string, ownerId: string, filePath: string, kind: string, tenderId?: string|null }} document
   * @returns {Promise<{ documentId: string, embedded: number }>}
   */
  async indexDocument(document) {
    const { documentId } = await ingestDocument(document);

    const pending = await this.documents.findUnembeddedChunks(documentId);
    // A page the pipeline could not read has no text to embed. It stays in the
    // table as an 'unread' row - that list is EX-07 - it simply is not indexed.
    const embeddable = pending.filter((chunk) => chunk.content.trim().length > 0);

    for (let start = 0; start < embeddable.length; start += BATCH_SIZE) {
      const batch = embeddable.slice(start, start + BATCH_SIZE);
      const vectors = await this.llm.embed(
        batch.map((chunk) => chunk.content),
        { name: 'index:company_docs' },
      );
      for (const [position, chunk] of batch.entries()) {
        await this.documents.setEmbedding(chunk.id, vectors[position]);
      }
    }

    logger.info({ documentId, embedded: embeddable.length }, 'index: document indexed');
    return { documentId, embedded: embeddable.length };
  }

  /**
   * Indexes this user's whole company corpus. Idempotent: an already-embedded
   * document costs one query and nothing else.
   * @param {string} ownerId
   * @returns {Promise<{ documents: number, embedded: number, failed: object[] }>}
   */
  async indexCompanyCorpus(ownerId) {
    const corpus = await this.documents.findCompanyDocuments(ownerId);
    const summary = { documents: 0, embedded: 0, failed: [] };

    for (const document of corpus) {
      try {
        const result = await this.indexDocument(document);
        summary.documents += 1;
        summary.embedded += result.embedded;
      } catch (error) {
        // One unreadable attestation must not stop the two memoires behind it
        // from being indexed. Reported, not swallowed.
        summary.failed.push({ documentId: document.id, message: error.message });
        logger.error({ documentId: document.id, err: error.message }, 'index: document failed');
      }
    }

    logger.info({ ownerId, ...summary, failed: summary.failed.length }, 'index: corpus done');
    return summary;
  }
}
