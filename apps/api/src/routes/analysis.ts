// Route file: validate input, dispatch to a service. Nothing else.
//
// TODO: POST /tenders/:id/analyze  -> analysisValidator, then analysisService.start (enqueues)
// TODO: GET  /tenders/:id/analysis -> analysisService.getResult
// TODO: GET  /tenders/:id/stream   -> SSE of node transitions while the graph runs
//
// 202 on accepted-and-queued. Never 200 on a failure path.
