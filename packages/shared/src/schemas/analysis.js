// zod schema for the analysis result surfaced to the web app.
//
// TODO: analysisSchema - tenderId, verdict ('go' | 'no-go'), confidence,
//       blockers (unmet eliminatory requirements), gaps[], matchedReferences[],
//       score, rubricBreakdown[], generatedAt
// TODO: /** @typedef {import('zod').infer<typeof analysisSchema>} Analysis */
//
// The verdict is never a bare boolean: the blockers are the product.
