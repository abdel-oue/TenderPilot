// OCR for scanned PDFs. AO-2026-004 and AO-2026-009 have no text layer at all.
// TODO: ocrPages(buffer, lang) -> { page, text }[]
// TODO: rasterize at a fixed DPI so results are reproducible
// Slow and expensive: always behind the content-hash cache.
