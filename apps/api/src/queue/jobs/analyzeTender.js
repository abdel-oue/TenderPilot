// Processor: run the LangGraph pipeline for one tender.
//
// TODO: load or create the checkpoint for (tenderId, graphVersion)
// TODO: invoke the graph, persisting the checkpoint after each node
// TODO: emit node transitions for the SSE route
// TODO: persist the final result, parsed against analysisSchema
