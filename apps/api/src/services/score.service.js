// Scoring + go/no-go verdict. No SQL, no LLM calls outside lib/llm.js.
//
// TODO: scoreTender(tenderId) - match requirements against the company profile
// TODO: findBlockers(requirements, company) - unmet ELIMINATORY requirements.
//       One blocker = no-go, regardless of the rest of the score.
// TODO: scoreAgainstRubric(rubric, evidence) - the threshold comes from the parsed
//       grading grid of THAT dossier. Never hardcode a threshold: it differs per tender.
// TODO: verdict(score, blockers) -> 'go' | 'no-go' + the reasons
