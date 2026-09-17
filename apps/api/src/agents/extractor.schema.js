// The Extractor's output contract.
//
// Re-exported from packages/shared rather than redefined: the React UI renders
// these exact requirements, and a schema duplicated across the two sides is a bug.

export { extractedRequirementsSchema, parsedRubricSchema } from '@tenderpilot/shared';

// Returned instead of a model call when STUB_LLM=1, so E2E runs are deterministic
// and burn no quota. It lives beside the agent because the agent is what knows
// its own shape.
export const EXTRACTOR_STUB = {
  requirements: [
    {
      text: "Le candidat doit être certifié ISO 27001 en cours de validité.",
      category: 'administrative',
      obligation: 'eliminatoire',
      sourcePage: 3,
      sourceArticle: 'Article 7.2',
      quote: "Le candidat doit être certifié ISO 27001 en cours de validité, sous peine de rejet.",
    },
    {
      text: "Le chef de projet doit justifier de 10 ans d'expérience.",
      category: 'team',
      obligation: 'obligatoire',
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
