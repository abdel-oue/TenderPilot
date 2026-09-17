import { index, integer, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { tenders } from './tender.table.js';

// `contentHash` unique IS the parse cache: the same bytes are never OCR'd twice.
// Each OCR pass is ~a minute, and you will re-run the same PDF fifty times while
// tuning prompts.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // avis|cps|reglement|bpu|planning|attestation|memoire|profil
  filePath: text('file_path').notNull(),
  contentHash: text('content_hash').notNull().unique(),
  extractionPath: text('extraction_path').notNull(), // text_layer|ocr|mixed
  pageCount: integer('page_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// embedder-small-3 at 512 dimensions, as provisioned for the hackathon. A vector
// column's width is fixed in the DDL, so this constant and EMBEDDING_DIMENSIONS in
// .env must agree: env.js is the one the code reads, this is the one the table is
// built with, and a mismatch fails at insert time with a dimension error.
const EMBEDDING_DIMENSIONS = 512;

// `page` is NOT NULL on purpose. Provenance is carried from extraction, never
// reconstructed afterwards — EX-03 is only possible because of this column.
// `extraction` = 'unread' keeps a page the pipeline could not read as a ROW rather
// than a silent gap. That list is EX-07.
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    page: integer('page').notNull(),
    article: text('article'),
    content: text('content').notNull(),
    extraction: text('extraction').notNull().default('text_layer'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (table) => [
    index('document_chunks_document_page_idx').on(table.documentId, table.page),
    index('document_chunks_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);
