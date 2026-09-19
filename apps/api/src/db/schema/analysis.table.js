import { boolean, index, jsonb, numeric, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenders } from './tender.table.js';

// Checkpointing means a run that dies at node 6 resumes instead of restarting.
// `nodeTrace` is the agent-activity feed the UI polls and the video films: it is
// written by ONE graph-level callback, so adding a node cannot forget to log.
export const analysisRuns = pgTable(
  'analysis_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    graphVersion: text('graph_version').notNull(),
    status: text('status').notNull().default('queued'), // queued|running|awaiting_human|done|failed
    nodeTrace: jsonb('node_trace').notNull().default([]),
    // Set when the agent called ask_human and the graph parked on its checkpoint.
    // Nullable and cleared on resume, so "is this run waiting on me" is one
    // column rather than a scan of the trace. Shape: pendingQuestionSchema.
    pendingQuestion: jsonb('pending_question'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [index('analysis_runs_tender_idx').on(table.tenderId, table.startedAt)],
);

export const analysisResults = pgTable('analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => analysisRuns.id, { onDelete: 'cascade' })
    .unique(),
  verdict: text('verdict').notNull(), // go|no-go
  confidence: real('confidence').notNull(),
  justification: text('justification').notNull(),
  score: numeric('score'),
  blockers: jsonb('blockers').notNull().default([]),
  // Risks surfaced to the human, never grounds for an automatic no-go.
  warnings: jsonb('warnings').notNull().default([]),
  matches: jsonb('matches').notNull().default([]),
  rubricBreakdown: jsonb('rubric_breakdown').notNull().default([]),
  // EX-07: pages that could not be read, surfaced rather than silently dropped.
  unreadPages: jsonb('unread_pages').notNull().default([]),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

// EX-06. A human correction is kept AND fed into the prompt for the sections
// drafted after it — the reuse is the requirement, not the saving.
export const sectionEdits = pgTable(
  'section_edits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    sectionKey: text('section_key').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    // false = still the agent's draft, true = a human rewrote it.
    editedByHuman: boolean('edited_by_human').notNull().default(false),
    editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('section_edits_run_idx').on(table.runId, table.sectionKey)],
);
