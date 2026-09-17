// Owns the analysis lifecycle: enqueue, resume, read back. No SQL.
//
// TODO: start(tenderId) - enqueue with an idempotency key so a re-run does not
//       double-process (jobId = hash(tenderId + stage + graphVersion))
// TODO: getResult(tenderId) - parsed against analysisSchema before it leaves
// TODO: subscribe(tenderId) - node transitions for the SSE route
