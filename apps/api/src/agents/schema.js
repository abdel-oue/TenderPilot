/**
 * Every agent's output contract, in one place.
 *
 * The contracts the UI also renders are re-exported from packages/shared rather
 * than redefined here — a schema duplicated across the two sides is a bug. What
 * is defined here is only what never leaves the api.
 *
 * The `*_STUB` constants are returned instead of a model call when STUB_LLM=1,
 * so E2E runs are deterministic and burn no quota.
 */
import { z } from 'zod';
import { REQUIREMENT_OBLIGATIONS } from '@tenderpilot/shared';

export {
  extractedRequirementsSchema,
  parsedRubricSchema,
  matchedProfileSchema,
} from '@tenderpilot/shared';

// --- Extractor ---------------------------------------------------------------

export const EXTRACTOR_STUB = {
  requirements: [
    {
      text: "Le candidat doit être certifié ISO 27001 en cours de validité.",
      category: 'administrative',
      obligation: 'eliminatoire',
      nature: 'capacite',
      sourcePage: 3,
      sourceArticle: 'Article 7.2',
      quote: "Le candidat doit être certifié ISO 27001 en cours de validité, sous peine de rejet.",
    },
    {
      text: "Le chef de projet doit justifier de 10 ans d'expérience.",
      category: 'team',
      obligation: 'obligatoire',
      nature: 'capacite',
      sourcePage: 4,
      sourceArticle: 'Article 8',
      quote: "Le chef de projet justifiera d'une expérience minimale de dix (10) années.",
    },
  ],
};

export const RUBRIC_STUB = {
  criteria: [
    { label: 'Valeur technique', maxPoints: 85, weight: 0.7, eliminationThreshold: 60 },
    { label: 'Prix', maxPoints: 15, weight: 0.3, eliminationThreshold: null },
  ],
};

// --- Classifier --------------------------------------------------------------

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

// --- Matcher (the Qualifier) -------------------------------------------------

export const MATCHER_STUB = {
  matches: [
    {
      requirementId: 'stub-1',
      status: 'unmet',
      evidence: [],
      reason: "La certification exigée ne figure pas dans les certifications détenues.",
      confidence: 0.9,
    },
  ],
};

// --- Writer + Compliance -----------------------------------------------------

// api-internal: the UI reads the persisted section row, not this payload.
export const draftedSectionSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  // Only identifiers the tools actually returned. Compliance checks the body
  // against this list, so an empty list means the body may cite nothing.
  citations: z.array(z.string()),
  needsHuman: z.boolean(),
});

// The Writer's own search plan. The queries are the model's words, not a
// template built from the section title: it is the agent deciding what it does
// not know yet.
export const searchPlanSchema = z.object({
  queries: z.array(z.string().min(3)).min(1).max(3),
});

export const complianceVerdictSchema = z.object({
  approved: z.boolean(),
  reasons: z.array(z.string()),
  instructions: z.string(),
});

export const WRITER_STUB = {
  title: 'Moyens humains',
  content:
    "[A COMPLETER PAR L'HUMAIN] Aucun CV du profil ne couvre l'experience exigee " +
    'pour ce poste.',
  citations: [],
  needsHuman: true,
};

export const SEARCH_PLAN_STUB = {
  queries: ['moyens humains chef de projet experience'],
};

export const COMPLIANCE_STUB = {
  approved: true,
  reasons: [],
  instructions: '',
};
