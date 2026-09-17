import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// One row per dossier de consultation. `reference` (AO-2026-0XX) is the seed's
// business key — that is what makes re-running the seed a no-op.
export const tenders = pgTable('tenders', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: text('reference').notNull().unique(),
  title: text('title'),
  buyer: text('buyer'),
  deadline: timestamp('deadline', { withTimezone: true }),
  estimatedValue: numeric('estimated_value'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
