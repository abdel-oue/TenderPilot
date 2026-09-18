import { z } from 'zod';

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
