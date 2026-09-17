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

export const verdictSchema = z.object({
  verdict: z.enum(['go', 'no-go']),
  confidence: z.number().min(0).max(1),
  justification: z.string().min(1),
  blockers: z.array(blockerSchema),
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
  status: z.enum(['queued', 'running', 'done', 'failed']),
  nodeTrace: z.array(
    z.object({
      node: z.string(),
      at: z.string(),
      summary: z.string(),
      status: z.enum(['ok', 'error', 'retry']),
    }),
  ),
  generatedAt: z.string().nullable(),
});

/** @typedef {import('zod').infer<typeof analysisSchema>} Analysis */
/** @typedef {import('zod').infer<typeof blockerSchema>} Blocker */
/** @typedef {import('zod').infer<typeof verdictSchema>} Verdict */
