import { index, integer, pgTable, text, timestamp, unique, uuid, vector } from 'drizzle-orm/pg-core';
import { tenders } from './tender.table.js';
import { users } from './user.table.js';

// `ownerId` is on the document itself, not inferred through the tender, because
// COMPANY documents (attestations, memoires, profil) have tenderId = NULL. They
// belong to the company, not to any one dossier — and they are exactly what the
// Writer searches to cite a real reference.
//
// (ownerId, contentHash) unique IS the parse cache: the same bytes are never
// OCR'd twice for the same user. Scoped rather than global, because a global
// unique would hand user B a documentId belonging to user A on a cache hit.
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // avis|cps|reglement|bpu|planning|attestation|memoire|profil
    filePath: text('file_path').notNull(),
    // The name the user's file had when they dropped it. filePath is content
    // addressed (<hash>.pdf), so without this the UI has nothing to display.
    originalName: text('original_name'),
    contentHash: text('content_hash').notNull(),
    extractionPath: text('extraction_path').notNull(), // text_layer|ocr|mixed|pending
    pageCount: integer('page_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('documents_owner_hash_unique').on(table.ownerId, table.contentHash),
    index('documents_owner_kind_idx').on(table.ownerId, table.kind),
  ],
);

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
