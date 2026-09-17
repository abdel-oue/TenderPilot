// zod schema for a tender (dossier de consultation).
//
// TODO: tenderSchema - id, reference (AO-2026-0XX), title, buyer, deadline (ISO),
//       lots, estimatedValue, sourceDocumentIds, status
// TODO: export the JSDoc typedef alongside it:
//         /** @typedef {import('zod').infer<typeof tenderSchema>} Tender */
//
// The web app is TypeScript and imports this file directly. Its z.infer still works
// across the boundary, so the schema stays the single source of truth for both sides.
