// zod schema for the analysis result surfaced to the web app.
//
// TODO: analysisSchema - tenderId, verdict ('go' | 'no-go'), confidence,
//       blockers: Requirement[] (unmet eliminatory), gaps[], matchedReferences[],
//       score, rubricBreakdown[], generatedAt
// TODO: export type Analysis = z.infer<typeof analysisSchema>
//
// The verdict is never a bare boolean: the blockers are the product.
