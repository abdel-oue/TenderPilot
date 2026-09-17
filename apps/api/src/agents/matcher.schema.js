// The Qualifier's output contract. Shared with the UI, so it lives in
// packages/shared and is only re-exported here.
export { matchedProfileSchema } from '@tenderpilot/shared';

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
