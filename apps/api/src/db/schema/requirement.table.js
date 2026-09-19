import { boolean, index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { documents } from './document.table.js';
import { tenders } from './tender.table.js';

// `obligation` is the EX-02 typing: obligatoire | optionnelle | eliminatoire.
// No separate is_eliminatory boolean — one column cannot disagree with itself.
export const requirements = pgTable(
  'requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    category: text('category').notNull(),
    obligation: text('obligation').notNull(),
    // capacite | procedure - only a capacite can block. See packages/shared.
    nature: text('nature').notNull().default('capacite'),
    quote: text('quote'),
    // Whether `quote` was actually found on `source_page` of the source
    // document. The page number and the verbatim are the model's claim; a
    // clickable citation that nobody checked is a claim wearing a link. false
    // means the extractor cited a page the sentence is not on.
    quoteVerified: boolean('quote_verified').notNull().default(false),
    sourceDocumentId: uuid('source_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    sourcePage: integer('source_page').notNull(),
    sourceArticle: text('source_article'),
  },
  (table) => [index('requirements_tender_idx').on(table.tenderId)],
);

// The grading grid differs per dossier, so the rubric is ROWS, not constants.
export const rubricCriteria = pgTable(
  'rubric_criteria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    maxPoints: numeric('max_points').notNull(),
    weight: numeric('weight').notNull(),
    eliminationThreshold: numeric('elimination_threshold'),
  },
  (table) => [index('rubric_criteria_tender_idx').on(table.tenderId)],
);
