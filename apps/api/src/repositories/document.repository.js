/**
 * Document Repository
 * ALL document + chunk SQL, including the pgvector similarity search.
 */
import { asc, eq, sql } from 'drizzle-orm';
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
   * @returns {Promise<object|undefined>}
   */
  async findByContentHash(hash) {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.contentHash, hash))
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
   * @param {string} kind
   * @returns {Promise<object[]>}
   */
  async findByKind(kind) {
    return this.db.select().from(documents).where(eq(documents.kind, kind));
  }

  /**
   * Upserts on contentHash, so re-seeding the same corpus is a no-op.
   * @param {object} values
   * @returns {Promise<object>}
   */
  async upsert(values) {
    const [row] = await this.db
      .insert(documents)
      .values(values)
      .onConflictDoUpdate({
        target: documents.contentHash,
        set: { pageCount: values.pageCount, extractionPath: values.extractionPath },
      })
      .returning();
    return row;
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
   * @param {number} [k]
   * @param {string[]} [kinds] restrict to document kinds, e.g. ['memoire']
   * @returns {Promise<object[]>}
   */
  async searchSimilarChunks(embedding, k = 8, kinds) {
    const vector = sql.raw("'[" + embedding.join(',') + "]'::vector");
    const kindFilter = kinds?.length
      ? sql`and d.kind in (${sql.join(kinds.map((kind) => sql`${kind}`), sql`, `)})`
      : sql``;

    return this.db.execute(sql`
      select c.id, c.document_id as "documentId", c.page, c.article, c.content,
             c.embedding <=> ${vector} as distance
      from document_chunks c
      join documents d on d.id = c.document_id
      where c.embedding is not null ${kindFilter}
      order by distance asc
      limit ${k}
    `);
  }
}
