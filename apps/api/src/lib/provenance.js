/** Normalizes typography and PDF line breaks, without inventing missing words. */
export function normalizeQuote(text) {
  return String(text ?? '').normalize('NFKC').replace(/\u00ad/g, '')
    .replace(/['’‘]/g, "'").replace(/[-‐‑]\s*\n\s*/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** @param {object} requirement @param {object[]} pages @returns {boolean} */
export function verifyQuote(requirement, pages) {
  const page = pages.find((p) => p.page === requirement.sourcePage);
  const quote = normalizeQuote(requirement.quote);
  return Boolean(page && page.extraction !== 'unread' && quote && normalizeQuote(page.text).includes(quote));
}
