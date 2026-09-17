import { z } from 'zod';
import { REQUIREMENT_OBLIGATIONS } from '@tenderpilot/shared';

// api-only: the UI renders the requirement, not this intermediate judgement.
export const classificationSchema = z.object({
  obligation: z.enum(REQUIREMENT_OBLIGATIONS),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export const CLASSIFIER_STUB = {
  obligation: 'eliminatoire',
  confidence: 0.9,
  reason: 'La citation prévoit explicitement le rejet de la candidature.',
};
