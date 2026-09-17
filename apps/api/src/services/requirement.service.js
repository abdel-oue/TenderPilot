// Requirement extraction + classification orchestration. No SQL.
//
// TODO: extractForTender(tenderId) - runs the extractor agent over every document,
//       high recall: a requirement missed here is invisible downstream
// TODO: classifyAll(requirements) - runs the classifier agent per requirement,
//       high precision: decides administrative/technical/financial/team/schedule
//       and whether it is eliminatory
//
// Extraction and classification are deliberately SEPARATE passes. One agent doing
// both conflates them and misses the scattered ones.
