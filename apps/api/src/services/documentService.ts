// Document ingestion logic. No SQL, no route concerns.
//
// TODO: ingest(filePath) - hash the bytes first, check the cache, skip if already parsed
// TODO: detectTextLayer(buffer) - ROUTING decision, not a fallback: pdf.ts or ocr.ts.
//       AO-2026-004 and AO-2026-009 are pure scans and must take the OCR path.
//       Record which path ran on the document row.
// TODO: extract(documentId) - returns pages with page numbers preserved
// TODO: chunk(documentId) - chunks carry page + article provenance, always
