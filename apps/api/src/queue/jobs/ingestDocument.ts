// Processor: parse one document into pages + chunks.
//
// TODO: cache check on content hash -> return early on hit
// TODO: route text-layer vs OCR, record which
// TODO: chunk with page + article provenance, embed, persist
// TODO: throw on failure so BullMQ retries. Do not swallow.
