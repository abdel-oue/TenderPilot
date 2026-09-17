// Drizzle table definitions for source documents + their chunks.
//
// TODO: documents - id, tender_id fk, kind ('avis'|'cps'|'reglement'|'bpu'|'planning'
//       |'attestation'|'memoire'|'profil'), file_path, content_hash text unique,
//       extraction_path text ('text_layer'|'ocr'), page_count, created_at
//
// content_hash unique = the parse cache. Same bytes, never re-OCR'd.
//
// TODO: document_chunks - id, document_id fk, content text, page int NOT NULL,
//       article text, embedding vector(N)
//
// page and article are NOT NULL on purpose: provenance is carried from extraction,
// never reconstructed afterwards.
// TODO: ivfflat/hnsw index on embedding
