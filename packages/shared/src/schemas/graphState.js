import { z } from 'zod';
import { requirementSchema } from './requirement.js';
import { rubricCriterionSchema } from './tender.js';
import { blockerSchema, requirementMatchSchema } from './analysis.js';

// Every node reads and writes this. It is the one place drift happens, so it is
// schema'd. Nodes return a PARTIAL state and never mutate — that is what makes a
// node testable as "fixture in, object out".

export const extractedPageSchema = z.object({
  documentId: z.string(),
  page: z.number().int().positive(),
  text: z.string(),
  // 'text_layer' | 'ocr' | 'unread' — unread pages are kept as rows, not dropped.
  // EX-07 is built on this field being honest.
  extraction: z.enum(['text_layer', 'ocr', 'unread']),
});

export const traceEntrySchema = z.object({
  node: z.string(),
  at: z.string(),
  summary: z.string(),
  status: z.enum(['ok', 'error', 'retry']),
});

export const graphStateSchema = z.object({
  tenderId: z.string(),
  runId: z.string(),
  // One company per user: the nodes that read the company profile or search the
  // company corpus scope on this, never on "the" company.
  ownerId: z.string(),
  documents: z.array(z.object({ id: z.string(), kind: z.string(), pageCount: z.number().int() })),
  pages: z.array(extractedPageSchema),
  requirements: z.array(requirementSchema),
  rubric: z.array(rubricCriterionSchema),
  matches: z.array(requirementMatchSchema),
  score: z.number().nullable(),
  verdict: z.enum(['go', 'no-go']).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  justification: z.string().nullable(),
  blockers: z.array(blockerSchema),
  sections: z.array(z.object({ key: z.string(), title: z.string(), content: z.string() })),
  // Compliance sends sections back to the Writer. Capped in the edge condition,
  // never trusted to the model: no open-ended loop in a live demo.
  redraftCount: z.record(z.string(), z.number()),
  errors: z.array(z.object({ node: z.string(), message: z.string() })),
  nodeTrace: z.array(traceEntrySchema),
});

/** @typedef {import('zod').infer<typeof graphStateSchema>} GraphState */
/** @typedef {import('zod').infer<typeof extractedPageSchema>} ExtractedPage */
