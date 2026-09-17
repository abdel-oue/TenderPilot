// Drizzle table definitions for requirements and the per-tender rubric.
//
// TODO: requirements - id, tender_id fk, text, category, is_eliminatory boolean,
//       document_id fk, source_page int, source_article text
//
// TODO: rubric_criteria - id, tender_id fk, label, max_points, weight,
//       elimination_threshold numeric nullable
//
// The rubric is ROWS, not constants: each dossier's grading grid differs.
