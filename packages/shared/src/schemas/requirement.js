import { z } from 'zod';

// Requirements are SCATTERED across each dossier: participation conditions in the
// reglement, team composition in the CPS, the elimination threshold in the grading
// grid. The schema carries where it came from — a verdict that cannot cite
// "CPS art. 7.3, p. 4" is unauditable, and EX-03 makes that citation clickable.

export const REQUIREMENT_CATEGORIES = [
  'administrative',
  'technical',
  'financial',
  'team',
  'schedule',
];

// EX-02 types every requirement. One enum, not an enum plus a redundant boolean:
// `obligation === 'eliminatoire'` IS the eliminatory flag.
export const REQUIREMENT_OBLIGATIONS = ['obligatoire', 'optionnelle', 'eliminatoire'];

// What KIND of thing the requirement demands. This is not a nicety: it decides
// whether a requirement can block a dossier.
//
//   capacite  something the company must already hold or be - a certification, a
//             reference in a sector, N years of experience, a turnover floor.
//             Not holding it disqualifies the company, so it CAN be a blocker.
//   procedure something the response must do - submit before a date, include the
//             acte d'engagement, sign each page, use a particular envelope.
//             The company cannot "fail" these at analysis time; they are the
//             responder's checklist. Treating them as capability gaps is how an
//             agent ends up disqualifying a company for not having posted a file
//             it has not written yet.
//   notation  a threshold in the EVALUATION itself - "obtenir au moins 60 points
//             sur 85". Nobody holds a technical mark before the commission sits,
//             so the profile can never evidence it and it can never be a blocker.
//             It is surfaced as a risk to the human instead.
export const REQUIREMENT_NATURES = ['capacite', 'procedure', 'notation'];

export const requirementSchema = z.object({
  id: z.string(),
  tenderId: z.string(),
  text: z.string().min(1),
  category: z.enum(REQUIREMENT_CATEGORIES),
  obligation: z.enum(REQUIREMENT_OBLIGATIONS),
  nature: z.enum(REQUIREMENT_NATURES),
  sourceDocumentId: z.string(),
  sourcePage: z.number().int().positive(),
  sourceArticle: z.string().nullable(),
});

// What the Extractor is allowed to return: no ids yet (the DB assigns them), and
// provenance is mandatory so the model cannot skip it.
export const extractedRequirementSchema = requirementSchema
  .omit({ id: true, tenderId: true, sourceDocumentId: true })
  .extend({ quote: z.string().min(1).describe('verbatim sentence supporting this requirement') });

export const extractedRequirementsSchema = z.object({
  requirements: z.array(extractedRequirementSchema),
});

/** @typedef {import('zod').infer<typeof requirementSchema>} Requirement */
/** @typedef {import('zod').infer<typeof extractedRequirementSchema>} ExtractedRequirement */

/**
 * @param {{ obligation: string }} requirement
 * @returns {boolean}
 */
export function isEliminatory(requirement) {
  return requirement.obligation === 'eliminatoire';
}

/**
 * Only an unmet CAPABILITY can disqualify. A procedural instruction is a task on
 * the response checklist, not evidence the company is ineligible.
 * @param {{ obligation: string, nature: string }} requirement
 * @returns {boolean}
 */
export function canBlock(requirement) {
  return requirement.obligation === 'eliminatoire' && requirement.nature === 'capacite';
}
