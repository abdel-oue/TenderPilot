import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// One row per LLM/embedding call. The quota is shared across every team and
// "le bon modele au bon endroit" is graded, so token spend is a product feature
// here, not an afterthought: this table is what the usage dashboard reads.
//
// requestId correlates every call made while serving one HTTP request, including
// the ones fired deep inside the graph. It is carried by AsyncLocalStorage, so a
// node does not have to thread it through eight function signatures to be counted.
export const llmUsage = pgTable(
  'llm_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: text('request_id').notNull(),
    runId: uuid('run_id'),
    tenderId: uuid('tender_id'),

    // 'reasoning' (gpt-5.5) | 'volume' (gpt-4.1) | 'embedding'
    tier: text('tier').notNull(),
    model: text('model').notNull(),
    // Which agent or node spent it: 'extractor', 'classifier', 'matcher', ...
    operation: text('operation').notNull(),

    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),

    latencyMs: integer('latency_ms').notNull().default(0),
    status: text('status').notNull().default('ok'), // ok | error
    error: text('error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('llm_usage_request_idx').on(table.requestId),
    index('llm_usage_created_idx').on(table.createdAt),
    index('llm_usage_run_idx').on(table.runId),
  ],
);
