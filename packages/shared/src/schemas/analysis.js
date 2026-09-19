import { z } from 'zod';

// The verdict is never a bare boolean: the blockers are the product (EX-04).

export const blockerSchema = z.object({
  requirementId: z.string().nullable(),
  text: z.string().min(1),
  reason: z.string().min(1),
  sourcePage: z.number().int().positive().nullable(),
  sourceArticle: z.string().nullable(),
  sourceDocumentId: z.string().nullable(),
});

export const requirementMatchSchema = z.object({
  requirementId: z.string(),
  status: z.enum(['met', 'partial', 'unmet', 'unknown']),
  // Which REF-xx / CV-xx back this up. Empty is a legitimate answer and must
  // stay empty — the Writer is forbidden from inventing one.
  evidence: z.array(z.string()),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const matchedProfileSchema = z.object({
  matches: z.array(requirementMatchSchema),
});

// A run has a fourth outcome: the agent called ask_human and the graph is parked
// on its checkpoint until somebody answers. It is not 'running' - nothing is
// executing - and it is not terminal, so it needs its own name or the UI stops
// polling a run that is very much alive.
export const runStatusSchema = z.enum(['queued', 'running', 'awaiting_human', 'done', 'failed']);

// 'human' marks the answer a person gave, recorded in the same trace as the
// agent's own steps so the conversation reads in order after the fact.
export const traceStatusSchema = z.enum(['ok', 'error', 'retry', 'human', 'running', 'paused']);

// What the agent asks. `options` is what makes this renderable: a free-text
// question would put the burden of guessing the accepted answers on the reader,
// and the model already knows them when it asks.
export const askOptionSchema = z.object({
  value: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});

export const pendingQuestionSchema = z.object({
  askId: z.string().min(1),
  node: z.string().min(1),
  question: z.string().min(1).max(2000),
  // The model's own sentence for why it is asking, same field every tool carries.
  raison: z.string().nullable(),
  options: z.array(askOptionSchema).min(2).max(6),
  askedAt: z.string(),
});

// The human's reply. Every field but `askId` and `choice` is optional: the two
// buttons are the whole interaction most of the time.
export const humanAnswerSchema = z.object({
  askId: z.string().min(1),
  choice: z.string().min(1).max(64),
  instruction: z.string().max(2000).optional(),
  verdictOverride: z.enum(['go', 'no-go']).nullable().optional(),
  dismissedBlockers: z.array(z.string()).max(50).optional(),
});

// The SSE payloads. Same data the poll returns, sooner - a dropped stream costs
// freshness, never correctness.
export const runEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('node'),
    tools: z.array(z.object({
      id: z.string().optional(), name: z.string(), raison: z.string().nullable(), outcome: z.string(),
      startedAt: z.string().optional(), at: z.string().optional(), ms: z.number().optional(),
      status: z.enum(['running', 'ok', 'error', 'paused']).optional(),
    })).optional(),
    id: z.string().optional(),
    startedAt: z.string().optional(),
    node: z.string(),
    status: traceStatusSchema,
    summary: z.string(),
    ms: z.number().optional(),
    at: z.string(),
  }),
  z.object({
    type: z.literal('tool'),
    id: z.string().optional(),
    startedAt: z.string().optional(),
    status: z.enum(['running', 'ok', 'error', 'paused']).optional(),
    node: z.string(),
    name: z.string(),
    raison: z.string().nullable(),
    outcome: z.string(),
    ms: z.number().optional(),
    at: z.string(),
  }),
  z.object({ type: z.literal('ask'), question: pendingQuestionSchema }),
  z.object({ type: z.literal('status'), status: runStatusSchema }),
]);

export const verdictSchema = z.object({
  verdict: z.enum(['go', 'no-go']),
  confidence: z.number().min(0).max(1),
  justification: z.string().min(1),
  blockers: z.array(blockerSchema),
  needsHuman: z.boolean().default(false),
  stageErrors: z.array(z.object({ node: z.string(), message: z.string() })).default([]),
});

export const analysisSchema = verdictSchema.extend({
  id: z.string(),
  tenderId: z.string(),
  score: z.number().nullable(),
  rubricBreakdown: z.array(
    z.object({ label: z.string(), points: z.number(), maxPoints: z.number() }),
  ),
  // EX-07: pages the pipeline could not read. Surfaced, never silently dropped.
  unreadPages: z.array(z.object({ documentId: z.string(), page: z.number().int() })),
  status: runStatusSchema,
  nodeTrace: z.array(
    z.object({
      id: z.string().optional(),
      startedAt: z.string().optional(),
      node: z.string(),
      at: z.string(),
      summary: z.string(),
      status: traceStatusSchema,
      ms: z.number().optional(),
      tools: z
        .array(
          z.object({
            id: z.string().optional(),
            at: z.string().optional(),
            startedAt: z.string().optional(),
            ms: z.number().optional(),
            status: z.enum(['running', 'ok', 'error', 'paused']).optional(),
            name: z.string(),
            // The model's own words for why it reached for this tool.
            raison: z.string().nullable(),
            // Built from the real result, never from the model: an empty search
            // says so here whatever the model claimed.
            outcome: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  generatedAt: z.string().nullable(),
});

/** @typedef {import('zod').infer<typeof analysisSchema>} Analysis */
/** @typedef {import('zod').infer<typeof blockerSchema>} Blocker */
/** @typedef {import('zod').infer<typeof verdictSchema>} Verdict */
/** @typedef {import('zod').infer<typeof runEventSchema>} RunEvent */
/** @typedef {import('zod').infer<typeof pendingQuestionSchema>} PendingQuestion */
/** @typedef {import('zod').infer<typeof humanAnswerSchema>} HumanAnswer */
