// LangGraph wiring ONLY. Node logic lives in nodes/, prompts in agents/.
//
// TODO: build the StateGraph over graphStateSchema
// TODO: ingest -> extractRequirements -> classifyRequirements -> parseRubric
//       -> matchProfile -> score -> decide -> draft
// TODO: conditional edge after decide: no-go skips draft
// TODO: attach the Postgres checkpointer
// TODO: export GRAPH_VERSION - bump it on any node/prompt change so runs are
//       keyed correctly and stale checkpoints are not resumed
