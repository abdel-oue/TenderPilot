/**
 * Document Repository
 * ALL document + chunk SQL, including the pgvector similarity search.
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { documentChunks, documents } from '../db/schema/index.js';

export default class DocumentRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * The parse cache lookup. Called before any parse or OCR: the same bytes are
   * never read twice, which is what keeps prompt iteration fast when OCR costs
   * ~10s a page.
   * @param {string} hash sha256 of the file bytes
   * @param {string} ownerId scoped: a cache hit must never hand back another
   *   user's documentId, which is what a global hash lookup would do
   * @returns {Promise<object|undefined>}
   */
  async findByContentHash(hash, ownerId) {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.contentHash, hash), eq(documents.ownerId, ownerId)))
      .limit(1);
    return row;
  }

  /**
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async findById(id) {
    const [row] = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return row;
  }

  /**
   * @param {string} tenderId
   * @returns {Promise<object[]>}
   */
  async findByTender(tenderId) {
    return this.db.select().from(documents).where(eq(documents.tenderId, tenderId));
  }

  /**
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<object|undefined>}
   */
  async findByIdForOwner(id, ownerId) {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
      .limit(1);
    return row;
  }

  /**
   * The company's own corpus: attestations, past memoires, the profil. These have
   * tenderId NULL - they belong to the company, not to one dossier - and they are
   * what search_company_docs reads. Without them the Writer has nothing real to
   * cite and every section comes back marked for a human.
   * @param {string} ownerId
   * @param {string[]} [kinds]
   * @returns {Promise<object[]>}
   */
  async findCompanyDocuments(ownerId, kinds = ['memoire', 'attestation', 'profil']) {
    return this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.ownerId, ownerId),
          isNull(documents.tenderId),
          inArray(documents.kind, kinds),
        ),
      )
      .orderBy(asc(documents.createdAt));
  }

  /**
   * Upserts on (ownerId, contentHash), so re-seeding or re-uploading the same
   * file is a no-op rather than a duplicate row.
   * @param {object} values
   * @returns {Promise<object>}
   */
  async upsert(values) {
    const [row] = await this.db
      .insert(documents)
      .values(values)
      .onConflictDoUpdate({
        target: [documents.ownerId, documents.contentHash],
        set: {
          pageCount: values.pageCount,
          extractionPath: values.extractionPath,
          // A file re-uploaded against a dossier stops being loose company
          // material, so these two follow the newest upload.
          tenderId: values.tenderId ?? null,
          kind: values.kind,
        },
      })
      .returning();
    return row;
  }

  /**
   * Chunks with no embedding yet - the work list for the indexing service.
   * @param {string} documentId
   * @returns {Promise<object[]>}
   */
  async findUnembeddedChunks(documentId) {
    return this.db
      .select({ id: documentChunks.id, content: documentChunks.content })
      .from(documentChunks)
      .where(and(eq(documentChunks.documentId, documentId), isNull(documentChunks.embedding)));
  }

  /**
   * @param {object[]} rows each carrying page + article provenance
   * @returns {Promise<void>}
   */
  async insertChunks(rows) {
    if (rows.length === 0) return;
    await this.db.insert(documentChunks).values(rows);
  }

  /**
   * @param {string} documentId
   * @returns {Promise<void>}
   */
  async deleteChunks(documentId) {
    await this.db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  }

  /**
   * Pages in reading order, INCLUDING the ones marked 'unread'. EX-07 depends on
   * those rows existing rather than being silently absent.
   * @param {string} documentId
   * @returns {Promise<object[]>}
   */
  async findChunks(documentId) {
    return this.db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.page));
  }

  /**
   * Rewrites one page in place, for a chunk repaired by a later OCR pass.
   *
   * The embedding is left alone: an unread page never had one, so the row stays in
   * findUnembeddedChunks() and the next indexing run picks it up with no special
   * case anywhere.
   *
   * @param {string} chunkId
   * @param {{ content: string, extraction: string }} values
   * @returns {Promise<void>}
   */
  async updateChunk(chunkId, { content, extraction }) {
    await this.db
      .update(documentChunks)
      .set({ content, extraction })
      .where(eq(documentChunks.id, chunkId));
  }

  /**
   * @param {string} documentId
   * @param {string} extractionPath text_layer|ocr|mixed|pending
   * @returns {Promise<void>}
   */
  async updateExtractionPath(documentId, extractionPath) {
    await this.db
      .update(documents)
      .set({ extractionPath })
      .where(eq(documents.id, documentId));
  }

  /**
   * @param {string} chunkId
   * @param {number[]} embedding
   * @returns {Promise<void>}
   */
  async setEmbedding(chunkId, embedding) {
    await this.db
      .update(documentChunks)
      .set({ embedding })
      .where(eq(documentChunks.id, chunkId));
  }

  /**
   * Nearest chunks by cosine distance.
   *
   * Raw sql`` is allowed here and only here: pgvector's `<=>` operator has no
   * representation in the drizzle query builder.
   * @param {number[]} embedding
   * @param {string} ownerId one company's corpus only - a citation lifted from
   *   another company's memoire would be the exact hallucination EX-03 guards against
   * @param {number} [k]
   * @param {string[]} [kinds] restrict to document kinds, e.g. ['memoire']
   * @returns {Promise<object[]>}
   */
  async searchSimilarChunks(embedding, ownerId, k = 8, kinds) {
    const vector = sql.raw("'[" + embedding.join(',') + "]'::vector");
    const kindFilter = kinds?.length
      ? sql`and d.kind in (${sql.join(kinds.map((kind) => sql`${kind}`), sql`, `)})`
      : sql``;

    return this.db.execute(sql`
      select c.id, c.document_id as "documentId", c.page, c.article, c.content,
             c.embedding <=> ${vector} as distance
      from document_chunks c
      join documents d on d.id = c.document_id
      where c.embedding is not null and d.owner_id = ${ownerId} ${kindFilter}
      order by distance asc
      limit ${k}
    `);
  }
}
