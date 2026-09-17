// Route file: validate input, dispatch to a service. Nothing else.
//
// TODO: POST /documents/ingest   -> validate, then documentService.ingest (queues the job)
// TODO: GET  /documents/:id      -> documentService.getById
// TODO: GET  /documents/:id/text -> documentService.getExtractedText
//
// Ingestion is long work: it goes to BullMQ, never into the request handler.
