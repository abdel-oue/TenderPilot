import { z } from 'zod';

export const TENDER_STATUSES = ['pending', 'ingesting', 'analyzing', 'analyzed', 'failed'];

export const tenderSchema = z.object({
  id: z.string(),
  reference: z.string().min(1), // AO-2026-0XX
  title: z.string().nullable(),
  buyer: z.string().nullable(),
  deadline: z.string().nullable(), // ISO date
  estimatedValue: z.number().nullable(),
  status: z.enum(TENDER_STATUSES),
  createdAt: z.string(),
});

// Each dossier carries its OWN grading grid, so the rubric is rows, never constants.
export const rubricCriterionSchema = z.object({
  label: z.string().min(1),
  maxPoints: z.number().nonnegative(),
  weight: z.number().nonnegative(),
  eliminationThreshold: z.number().nullable(),
});

export const parsedRubricSchema = z.object({
  criteria: z.array(rubricCriterionSchema),
});

/** @typedef {import('zod').infer<typeof tenderSchema>} Tender */
/** @typedef {import('zod').infer<typeof rubricCriterionSchema>} RubricCriterion */
