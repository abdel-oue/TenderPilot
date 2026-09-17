// zod schema for a tender (dossier de consultation) + inferred type.
//
// TODO: tenderSchema - id, reference (AO-2026-0XX), title, buyer, deadline (ISO),
//       lots, estimatedValue, sourceDocumentIds, status
// TODO: export type Tender = z.infer<typeof tenderSchema>
// Never hand-write the interface. Infer it.
