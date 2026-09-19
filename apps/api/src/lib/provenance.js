/** Normalizes typography and PDF line breaks, without inventing missing words. */
export function normalizeQuote(text) {
  return String(text ?? '').normalize('NFKC').replace(/­/g, '')
    .replace(/['’‘]/g, "'").replace(/[-‐‑]\s*\n\s*/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

// An extractor quoting one item out of an enumeration elides the middle:
// "Le dossier administratif comprend ... l'attestation fiscale". A literal
// substring test can never match that, so every elided citation was reported as
// "citation introuvable" and became a stage error that forced a no-go on a
// dossier that had in fact been read. Segments are matched IN ORDER and without
// overlapping, which is what keeps this from accepting a quote stitched out of
// fragments the document never put in that sequence.
const ELLIPSIS = /\s*(?:\.{3,}|…|\[\.{3,}\]|\[…\])\s*/;

/** @param {object} requirement @param {object[]} pages @returns {boolean} */
export function verifyQuote(requirement, pages) {
  const page = pages.find((p) => p.page === requirement.sourcePage);
  if (!page || page.extraction === 'unread') return false;

  const haystack = normalizeQuote(page.text);
  const segments = normalizeQuote(requirement.quote).split(ELLIPSIS).filter(Boolean);
  if (segments.length === 0) return false;

  let cursor = 0;
  for (const segment of segments) {
    const at = haystack.indexOf(segment, cursor);
    if (at === -1) return false;
    cursor = at + segment.length;
  }
  return true;
}
