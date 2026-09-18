import { numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './user.table.js';

// One row per dossier de consultation, owned by the user who uploaded it.
//
// `reference` (AO-2026-0XX) is unique PER OWNER, not globally: two companies
// answering the same public tender both hold "AO-2026-004", and a global unique
// would let the first user to upload it silently claim it for everyone.
// The pair is still a stable business key, so the seed stays idempotent.
export const tenders = pgTable(
  'tenders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull(),
    title: text('title'),
    buyer: text('buyer'),
    deadline: timestamp('deadline', { withTimezone: true }),
    estimatedValue: numeric('estimated_value'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('tenders_owner_reference_unique').on(table.ownerId, table.reference)],
);
