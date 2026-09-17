// zod schema for a single extracted requirement.
//
// Requirements are SCATTERED across each dossier: participation conditions in the
// reglement, team composition in the CPS, the elimination threshold in the grading
// grid. The schema has to carry where it came from.
//
// TODO: requirementSchema - id, tenderId, text, category
//       ('administrative' | 'technical' | 'financial' | 'team' | 'schedule'),
//       isEliminatory (boolean), sourceDocumentId, sourcePage, sourceArticle
// TODO: /** @typedef {import('zod').infer<typeof requirementSchema>} Requirement */
//
// A verdict that cannot cite "CPS art. 7.3, p. 4" is unauditable.
