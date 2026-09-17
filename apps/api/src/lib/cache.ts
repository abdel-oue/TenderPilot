// Content-addressed cache for parse/OCR output. Keyed on the file's byte hash.
// TODO: hashFile(buffer) -> sha256
// TODO: get(hash) / set(hash, pages) - Postgres-backed, survives container restarts
// Same bytes are never parsed twice, so prompt iteration stays fast.
