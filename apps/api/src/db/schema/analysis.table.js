// Drizzle table definitions for analysis runs and their results.
//
// TODO: analysis_runs - id, tender_id fk, graph_version text, status,
//       checkpoint jsonb (LangGraph checkpointer), started_at, finished_at
// TODO: analysis_results - id, run_id fk, verdict, score, confidence,
//       blockers jsonb, gaps jsonb, matched_references jsonb
//
// Checkpointing means a run that dies at node 6 resumes instead of restarting,
// and gives a per-node audit trail for free.
